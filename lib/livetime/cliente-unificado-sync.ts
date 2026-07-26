import sql from 'mssql';

/**
 * Job de merge que roda no daemon de espelho (SRVKART): concentra clientes de 3 fontes distintas
 * numa unica tabela `dbo.ClienteUnificado`, dentro do banco LapTimeMirror. As 3 fontes ja vivem na
 * MESMA instancia SQL Server (`SRVKART\SQLEXPRESS`): `LapTimeMirror.dbo.Customer` (espelho do
 * LapTime/CRONO1, cadastro atual/real) e `CALXPRO.dbo.CLIENTE`/`CALXPRO.dbo.CONTATO` (sistema
 * anterior, ate' jan/2025). Por isso a dedupe usa nomes de 3 partes (`CALXPRO.dbo.CLIENTE`) em vez
 * de precisar de outra conexao — exige que o login do espelho (`LapTimeMirrorSql`) tenha
 * `db_datareader` no banco CALXPRO (grant de configuracao, ver memoria [[laptime-espelho-srvkart]]).
 *
 * Regra de negocio (pedido do usuario): o admin so' deve ver UMA lista de clientes, sem nomes
 * tecnicos de sistema de origem. Em caso de duplicata, o LapTime (fonte mais atual) prevalece.
 * Dedupe por CPF normalizado (LapTime x CalXPro/CLIENTE) e por telefone normalizado
 * (CalXPro/CONTATO, que nao tem CPF, contra tudo que ja foi incluido).
 */

type SourceRow = {
  Nome: string;
  Email: string | null;
  Telefone: string | null;
  Documento: string | null;
  Cidade: string | null;
  Estado: string | null;
  CriadoEm: Date | null;
  OrigemSistema: string;
};

type RawSourceRow = Omit<SourceRow, 'Nome'> & { Nome: string | null };

function withNonNullNome(rows: RawSourceRow[]): SourceRow[] {
  return rows
    .filter((row) => Boolean(row.Nome))
    .map((row) => ({ ...row, Nome: row.Nome as string }));
}

function onlyDigits(value: string | null | undefined): string {
  return (value || '').replace(/\D/g, '');
}

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export async function ensureClienteUnificadoTable(mirror: sql.ConnectionPool): Promise<void> {
  await mirror.request().query(`
    if object_id('dbo.ClienteUnificado', 'U') is null
    create table dbo.ClienteUnificado (
      Id int identity(1,1) primary key,
      Nome nvarchar(200) not null,
      Email nvarchar(200) null,
      Telefone nvarchar(50) null,
      Documento nvarchar(60) null,
      Cidade nvarchar(120) null,
      Estado nvarchar(10) null,
      CriadoEm datetime2 null,
      OrigemSistema nvarchar(20) not null
    )
  `);
}

async function fetchLapTimeCustomers(mirror: sql.ConnectionPool): Promise<SourceRow[]> {
  const result = await mirror.request().query<{
    Name: string | null;
    Email: string | null;
    Phone: string | null;
    Doc: string | null;
    City: string | null;
    State: string | null;
    Created: Date | null;
  }>('select Name, Email, Phone, Doc, City, State, Created from dbo.Customer');

  return withNonNullNome(
    result.recordset.map((row) => ({
      Nome: clean(row.Name),
      Email: clean(row.Email),
      Telefone: clean(row.Phone),
      Documento: clean(row.Doc),
      Cidade: clean(row.City),
      Estado: clean(row.State),
      CriadoEm: row.Created,
      OrigemSistema: 'laptime',
    })),
  );
}

async function fetchCalXProClientes(mirror: sql.ConnectionPool): Promise<SourceRow[]> {
  const result = await mirror.request().query<{
    ST_NOME: string | null;
    ST_SOBRENOME: string | null;
    ST_EMAIL: string | null;
    ST_CELULAR: string | null;
    ST_TELEFONE: string | null;
    ST_CPF: string | null;
    ST_CIDADE: string | null;
    DT_INC: Date | null;
  }>(
    'select ST_NOME, ST_SOBRENOME, ST_EMAIL, ST_CELULAR, ST_TELEFONE, ST_CPF, ST_CIDADE, DT_INC from CALXPRO.dbo.CLIENTE',
  );

  return withNonNullNome(
    result.recordset.map((row) => ({
      Nome: clean([row.ST_NOME, row.ST_SOBRENOME].filter(Boolean).join(' ')),
      Email: clean(row.ST_EMAIL),
      Telefone: clean(row.ST_CELULAR) || clean(row.ST_TELEFONE),
      Documento: clean(row.ST_CPF),
      Cidade: clean(row.ST_CIDADE),
      Estado: null,
      CriadoEm: row.DT_INC,
      OrigemSistema: 'calxpro-cliente',
    })),
  );
}

async function fetchCalXProContatos(mirror: sql.ConnectionPool): Promise<SourceRow[]> {
  const result = await mirror.request().query<{
    ST_NOME: string | null;
    ST_TELEFONE: string | null;
    ST_CELULAR: string | null;
    ST_CIDADE: string | null;
    DT_INC: Date | null;
  }>('select ST_NOME, ST_TELEFONE, ST_CELULAR, ST_CIDADE, DT_INC from CALXPRO.dbo.CONTATO');

  return withNonNullNome(
    result.recordset.map((row) => ({
      Nome: clean(row.ST_NOME),
      Email: null,
      Telefone: clean(row.ST_CELULAR) || clean(row.ST_TELEFONE),
      Documento: null,
      Cidade: clean(row.ST_CIDADE),
      Estado: null,
      CriadoEm: row.DT_INC,
      OrigemSistema: 'calxpro-contato',
    })),
  );
}

/** Merge com prioridade LapTime > CalXPro(cliente) > CalXPro(contato), dedupe por CPF e telefone. */
function mergeSources(laptime: SourceRow[], calxproClientes: SourceRow[], calxproContatos: SourceRow[]): SourceRow[] {
  const merged: SourceRow[] = [];
  const seenDocs = new Set<string>();
  const seenPhones = new Set<string>();

  for (const row of laptime) {
    const doc = onlyDigits(row.Documento);
    const phone = onlyDigits(row.Telefone);
    if (doc) seenDocs.add(doc);
    if (phone) seenPhones.add(phone);
    merged.push(row);
  }

  for (const row of calxproClientes) {
    const doc = onlyDigits(row.Documento);
    if (doc && seenDocs.has(doc)) continue;
    const phone = onlyDigits(row.Telefone);
    if (doc) seenDocs.add(doc);
    if (phone) seenPhones.add(phone);
    merged.push(row);
  }

  for (const row of calxproContatos) {
    const phone = onlyDigits(row.Telefone);
    if (phone && seenPhones.has(phone)) continue;
    if (phone) seenPhones.add(phone);
    merged.push(row);
  }

  return merged;
}

function buildTable(): sql.Table {
  const table = new sql.Table('ClienteUnificado');
  table.create = false;
  table.columns.add('Nome', sql.NVarChar(200), { nullable: false });
  table.columns.add('Email', sql.NVarChar(200), { nullable: true });
  table.columns.add('Telefone', sql.NVarChar(50), { nullable: true });
  table.columns.add('Documento', sql.NVarChar(60), { nullable: true });
  table.columns.add('Cidade', sql.NVarChar(120), { nullable: true });
  table.columns.add('Estado', sql.NVarChar(10), { nullable: true });
  table.columns.add('CriadoEm', sql.DateTime2(7), { nullable: true });
  table.columns.add('OrigemSistema', sql.NVarChar(20), { nullable: false });
  return table;
}

/** Reconstroi dbo.ClienteUnificado a partir das 3 fontes. Retorna o total de linhas gravadas. */
export async function syncClienteUnificado(mirror: sql.ConnectionPool, batchSize = 5000): Promise<number> {
  const [laptime, calxproClientes, calxproContatos] = await Promise.all([
    fetchLapTimeCustomers(mirror),
    fetchCalXProClientes(mirror),
    fetchCalXProContatos(mirror),
  ]);

  const rows = mergeSources(laptime, calxproClientes, calxproContatos);

  const transaction = new sql.Transaction(mirror);
  await transaction.begin();
  try {
    await new sql.Request(transaction).query('delete from dbo.ClienteUnificado');
    for (let i = 0; i < rows.length; i += batchSize) {
      const slice = rows.slice(i, i + batchSize);
      const table = buildTable();
      for (const row of slice) {
        table.rows.add(
          row.Nome,
          row.Email,
          row.Telefone,
          row.Documento,
          row.Cidade,
          row.Estado,
          row.CriadoEm,
          row.OrigemSistema,
        );
      }
      await new sql.Request(transaction).bulk(table);
    }
    await transaction.commit();
  } catch (err) {
    await transaction.rollback().catch(() => undefined);
    throw err;
  }

  return rows.length;
}
