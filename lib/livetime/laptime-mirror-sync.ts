import sql from 'mssql';
import { appendFileSync } from 'node:fs';
import {
  mirrorSqlConfig,
  sourceSqlConfig,
  type MirrorSqlOptions,
  type SourceSqlOptions,
} from '@/lib/livetime/laptime-mirror-sql';
import { buildSyncPlan, type SourceTableInfo, type TableSyncPlan } from '@/lib/livetime/laptime-mirror-tables';

export type MirrorEngineOptions = {
  source: SourceSqlOptions; // CRONO1\LAPTIME (leitura)
  mirror: MirrorSqlOptions; // SRVKART\SQLEXPRESS, base LapTimeMirror (escrita)
  logFile?: string;
  batchSize?: number; // linhas por lote no copy incremental / reload
};

type ColumnInfo = {
  name: string;
  dataType: string;
  maxLength: number;
  precision: number;
  scale: number;
  isNullable: boolean;
  isIdentity: boolean;
};

const SYNC_STATE_TABLE = '_MirrorSyncState';

export class LapTimeMirrorEngine {
  private readonly logFile: string | null;
  private readonly batchSize: number;
  private plan: TableSyncPlan[] = [];
  private lastSyncByTable: Record<string, string> = {};

  constructor(private readonly options: MirrorEngineOptions) {
    this.logFile = options.logFile || null;
    this.batchSize = options.batchSize || 5000;
  }

  log(message: string): void {
    const line = `[${new Date().toISOString()}] ${message}`;
    process.stdout.write(`${line}\n`);
    if (this.logFile) {
      try {
        appendFileSync(this.logFile, `${line}\n`);
      } catch {
        /* log em disco e' best-effort */
      }
    }
  }

  getStatus(): { lastSyncByTable: Record<string, string>; tableCount: number } {
    return { lastSyncByTable: this.lastSyncByTable, tableCount: this.plan.length };
  }

  // ---- Conexoes ----

  private async openSource(): Promise<sql.ConnectionPool> {
    const pool = new sql.ConnectionPool(sourceSqlConfig(this.options.source));
    await pool.connect();
    return pool;
  }

  private async openMirror(): Promise<sql.ConnectionPool> {
    const pool = new sql.ConnectionPool(mirrorSqlConfig(this.options.mirror));
    await pool.connect();
    return pool;
  }

  // ---- Introspeccao de schema ----

  private async listSourceTables(source: sql.ConnectionPool): Promise<SourceTableInfo[]> {
    const rows = await source.request().query<{ tn: string; rc: number }>(
      'select t.name tn, p.[rows] rc from sys.tables t join sys.partitions p on p.object_id=t.object_id and p.index_id in (0,1)',
    );
    const ids = await source.request().query<{ tn: string; cn: string }>(
      'select t.name tn, c.name cn from sys.tables t join sys.columns c on c.object_id=t.object_id where c.is_identity=1',
    );
    const idMap: Record<string, string> = {};
    ids.recordset.forEach((r) => {
      idMap[r.tn] = r.cn;
    });
    return rows.recordset.map((r) => ({ name: r.tn, rows: Number(r.rc), idColumn: idMap[r.tn] || null }));
  }

  private async getColumns(source: sql.ConnectionPool, table: string): Promise<ColumnInfo[]> {
    const result = await source
      .request()
      .input('t', sql.NVarChar, table)
      .query<{
        name: string;
        dataType: string;
        maxLength: number;
        precision: number;
        scale: number;
        isNullable: boolean;
        isIdentity: boolean;
      }>(`
        select c.name as name,
               ty.name as dataType,
               c.max_length as maxLength,
               c.precision as precision,
               c.scale as scale,
               c.is_nullable as isNullable,
               c.is_identity as isIdentity
        from sys.columns c
        join sys.tables t on t.object_id = c.object_id
        join sys.types ty on ty.user_type_id = c.system_type_id
        where t.name = @t
        order by c.column_id
      `);
    return result.recordset;
  }

  private columnDdl(col: ColumnInfo): string {
    const name = `[${col.name}]`;
    const t = col.dataType.toLowerCase();
    let typeDef: string;

    switch (t) {
      case 'varchar':
      case 'char':
      case 'varbinary':
      case 'binary': {
        const len = col.maxLength === -1 ? 'MAX' : String(col.maxLength);
        typeDef = `${t}(${len})`;
        break;
      }
      case 'nvarchar':
      case 'nchar': {
        // max_length em bytes; nchar/nvarchar usam 2 bytes por caractere.
        const len = col.maxLength === -1 ? 'MAX' : String(Math.floor(col.maxLength / 2));
        typeDef = `${t}(${len})`;
        break;
      }
      case 'decimal':
      case 'numeric':
        typeDef = `${t}(${col.precision},${col.scale})`;
        break;
      case 'datetime':
        // `datetime` (limite minimo 1753) pode estourar com datas legadas < 1753 no historico do
        // LapTime. No espelho usamos `datetime2` (aceita 0001-9999), um superset seguro.
        typeDef = 'datetime2';
        break;
      default:
        typeDef = t;
        break;
    }

    const nullable = col.isNullable ? 'NULL' : 'NOT NULL';
    return `${name} ${typeDef} ${nullable}`;
  }

  private async ensureSyncStateTable(mirror: sql.ConnectionPool): Promise<void> {
    await mirror.request().query(`
      if object_id('dbo.${SYNC_STATE_TABLE}', 'U') is null
      create table dbo.${SYNC_STATE_TABLE} (
        TableName nvarchar(200) not null primary key,
        LastId bigint null,
        LastSyncUtc datetime2 null
      )
    `);
  }

  private async ensureMirrorTable(
    source: sql.ConnectionPool,
    mirror: sql.ConnectionPool,
    table: string,
  ): Promise<ColumnInfo[]> {
    const columns = await this.getColumns(source, table);
    const exists = await mirror
      .request()
      .input('t', sql.NVarChar, table)
      .query<{ cnt: number }>("select count(*) as cnt from sys.tables where name = @t");

    if (exists.recordset[0].cnt === 0) {
      // Cria a tabela SEM a propriedade IDENTITY (queremos inserir os mesmos Ids da origem) e sem
      // FKs (para nao amarrar a ordem de carga). PK simples pela coluna identity, quando houver.
      const colDefs = columns.map((c) => this.columnDdl(c)).join(',\n  ');
      await mirror.request().query(`create table dbo.[${table}] (\n  ${colDefs}\n)`);
      this.log(`schema: criada tabela dbo.[${table}] (${columns.length} colunas)`);
    }

    return columns;
  }

  // ---- Copia de dados ----

  private tediousType(col: ColumnInfo): sql.ISqlType {
    const t = col.dataType.toLowerCase();
    switch (t) {
      case 'bigint':
        return sql.BigInt();
      case 'int':
        return sql.Int();
      case 'smallint':
        return sql.SmallInt();
      case 'tinyint':
        return sql.TinyInt();
      case 'bit':
        return sql.Bit();
      case 'decimal':
      case 'numeric':
        return sql.Decimal(col.precision, col.scale);
      case 'money':
        return sql.Money();
      case 'float':
        return sql.Float();
      case 'real':
        return sql.Real();
      case 'datetime':
        // Espelhado como datetime2 (ver columnDdl) — evita o limite de 1753 do datetime.
        return sql.DateTime2(7);
      case 'datetime2':
        return sql.DateTime2(col.scale);
      case 'smalldatetime':
        return sql.SmallDateTime();
      case 'date':
        return sql.Date();
      case 'time':
        return sql.Time(col.scale);
      case 'image':
        return sql.Image();
      case 'text':
        return sql.Text();
      case 'ntext':
        return sql.NText();
      case 'uniqueidentifier':
        return sql.UniqueIdentifier();
      case 'char':
        return sql.Char(col.maxLength === -1 ? undefined : col.maxLength);
      case 'varchar':
        return sql.VarChar(col.maxLength === -1 ? sql.MAX : col.maxLength);
      case 'nchar':
        return sql.NChar(col.maxLength === -1 ? undefined : Math.floor(col.maxLength / 2));
      case 'nvarchar':
        return sql.NVarChar(col.maxLength === -1 ? sql.MAX : Math.floor(col.maxLength / 2));
      case 'varbinary':
        return sql.VarBinary(col.maxLength === -1 ? sql.MAX : col.maxLength);
      case 'binary':
        return sql.Binary();
      default:
        return sql.NVarChar(sql.MAX);
    }
  }

  private buildTable(table: string, columns: ColumnInfo[]): sql.Table {
    const tvp = new sql.Table(table);
    tvp.create = false;
    for (const col of columns) {
      tvp.columns.add(col.name, this.tediousType(col), { nullable: col.isNullable });
    }
    return tvp;
  }

  private rowValues(columns: ColumnInfo[], row: Record<string, unknown>): sql.IRow {
    return columns.map((c) => (row[c.name] ?? null) as sql.IRow[number]);
  }

  private async insertRows(
    mirror: sql.ConnectionPool,
    table: string,
    columns: ColumnInfo[],
    rows: Record<string, unknown>[],
  ): Promise<void> {
    if (rows.length === 0) return;
    for (let i = 0; i < rows.length; i += this.batchSize) {
      const slice = rows.slice(i, i + this.batchSize);
      const tvp = this.buildTable(table, columns);
      for (const row of slice) {
        tvp.rows.add(...this.rowValues(columns, row));
      }
      await mirror.request().bulk(tvp);
    }
  }

  private async getCheckpoint(mirror: sql.ConnectionPool, table: string): Promise<bigint | null> {
    const result = await mirror
      .request()
      .input('t', sql.NVarChar, table)
      .query<{ LastId: string | null }>(`select LastId from dbo.${SYNC_STATE_TABLE} where TableName = @t`);
    const value = result.recordset[0]?.LastId;
    return value === null || value === undefined ? null : BigInt(value);
  }

  private async setCheckpoint(mirror: sql.ConnectionPool, table: string, lastId: bigint | null): Promise<void> {
    await mirror
      .request()
      .input('t', sql.NVarChar, table)
      .input('id', sql.BigInt, lastId === null ? null : lastId.toString())
      .query(`
        merge dbo.${SYNC_STATE_TABLE} as target
        using (select @t as TableName) as src on target.TableName = src.TableName
        when matched then update set LastId = @id, LastSyncUtc = sysutcdatetime()
        when not matched then insert (TableName, LastId, LastSyncUtc) values (@t, @id, sysutcdatetime());
      `);
  }

  // ---- Estrategias de sync por tabela ----

  private async syncIncremental(
    source: sql.ConnectionPool,
    mirror: sql.ConnectionPool,
    plan: TableSyncPlan,
    columns: ColumnInfo[],
  ): Promise<number> {
    const idCol = plan.idColumn as string;
    const checkpoint = await this.getCheckpoint(mirror, plan.name);
    const colList = columns.map((c) => `[${c.name}]`).join(',');

    const request = source.request();
    let whereClause = '';
    if (checkpoint !== null) {
      request.input('cp', sql.BigInt, checkpoint.toString());
      whereClause = `where [${idCol}] > @cp`;
    }
    const result = await request.query<Record<string, unknown>>(
      `select ${colList} from dbo.[${plan.name}] ${whereClause} order by [${idCol}]`,
    );

    const rows = result.recordset;
    if (rows.length === 0) return 0;

    await this.insertRows(mirror, plan.name, columns, rows);

    const maxId = rows.reduce((max, row) => {
      const v = BigInt(row[idCol] as string | number);
      return v > max ? v : max;
    }, checkpoint ?? 0n);
    await this.setCheckpoint(mirror, plan.name, maxId);
    return rows.length;
  }

  private async syncReload(
    source: sql.ConnectionPool,
    mirror: sql.ConnectionPool,
    plan: TableSyncPlan,
    columns: ColumnInfo[],
  ): Promise<number> {
    const colList = columns.map((c) => `[${c.name}]`).join(',');
    const result = await source
      .request()
      .query<Record<string, unknown>>(`select ${colList} from dbo.[${plan.name}]`);
    const rows = result.recordset;

    // Reload atomico: carrega numa tabela de staging, depois troca. Para simplicidade e dado o
    // tamanho modesto, fazemos delete+insert numa transacao.
    const transaction = new sql.Transaction(mirror);
    await transaction.begin();
    try {
      await new sql.Request(transaction).query(`delete from dbo.[${plan.name}]`);
      // insertRows usa bulk fora da transacao; para manter atomicidade, inserimos via TVP na txn.
      for (let i = 0; i < rows.length; i += this.batchSize) {
        const slice = rows.slice(i, i + this.batchSize);
        const tvp = this.buildTable(plan.name, columns);
        for (const row of slice) {
          tvp.rows.add(...this.rowValues(columns, row));
        }
        await new sql.Request(transaction).bulk(tvp);
      }
      await transaction.commit();
    } catch (err) {
      await transaction.rollback().catch(() => undefined);
      throw err;
    }
    return rows.length;
  }

  // ---- API publica ----

  /** Prepara o espelho: cria _MirrorSyncState e todas as tabelas, e monta o plano de sync. */
  async prepare(): Promise<void> {
    const source = await this.openSource();
    const mirror = await this.openMirror();
    try {
      await this.ensureSyncStateTable(mirror);
      const tables = await this.listSourceTables(source);
      this.plan = buildSyncPlan(tables);
      this.log(`plano: ${this.plan.length} tabelas para espelhar`);
      for (const plan of this.plan) {
        await this.ensureMirrorTable(source, mirror, plan.name);
      }
    } finally {
      await source.close().catch(() => undefined);
      await mirror.close().catch(() => undefined);
    }
  }

  /** Carga inicial completa (bootstrap): copia TODAS as linhas de todas as tabelas do plano. */
  async bootstrap(): Promise<void> {
    await this.prepare();
    const source = await this.openSource();
    const mirror = await this.openMirror();
    try {
      for (const plan of this.plan) {
        const started = Date.now();
        const columns = await this.getColumns(source, plan.name);
        try {
          const count = await this.syncReload(source, mirror, plan, columns);
          // Para tabelas incrementais, grava o checkpoint = maior Id copiado.
          if (plan.mode === 'incremental' && plan.idColumn) {
            const maxRes = await mirror
              .request()
              .query<{ m: string | null }>(`select max([${plan.idColumn}]) as m from dbo.[${plan.name}]`);
            const m = maxRes.recordset[0]?.m;
            await this.setCheckpoint(mirror, plan.name, m === null || m === undefined ? null : BigInt(m));
          }
          this.log(`bootstrap: ${plan.name} = ${count} linhas em ${Date.now() - started}ms`);
        } catch (err) {
          this.log(`bootstrap ERRO ${plan.name}: ${(err as Error).message}`);
        }
      }
    } finally {
      await source.close().catch(() => undefined);
      await mirror.close().catch(() => undefined);
    }
  }

  /** Sincroniza apenas as tabelas cujo intervalo alcancou o limite (chamado periodicamente). */
  async runDueTables(now: number, dueSelector: (plan: TableSyncPlan) => boolean): Promise<void> {
    const due = this.plan.filter(dueSelector);
    if (due.length === 0) return;

    const source = await this.openSource();
    const mirror = await this.openMirror();
    try {
      for (const plan of due) {
        const started = Date.now();
        try {
          const columns = await this.getColumns(source, plan.name);
          const count =
            plan.mode === 'incremental' && plan.idColumn
              ? await this.syncIncremental(source, mirror, plan, columns)
              : await this.syncReload(source, mirror, plan, columns);
          this.lastSyncByTable[plan.name] = new Date().toISOString();
          if (count > 0) {
            this.log(`sync: ${plan.name} (${plan.mode}) = ${count} linhas em ${Date.now() - started}ms`);
          }
        } catch (err) {
          this.log(`sync ERRO ${plan.name}: ${(err as Error).message}`);
        }
      }
    } finally {
      await source.close().catch(() => undefined);
      await mirror.close().catch(() => undefined);
    }
  }

  getPlan(): TableSyncPlan[] {
    return this.plan;
  }
}
