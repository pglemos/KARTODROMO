import sql from 'mssql';
import type { LapTimeSqlOptions } from '@/lib/livetime/laptime-sql';

export type CalXProContato = {
  id: string;
  nome: string;
  telefone: string | null;
  celular: string | null;
  cidade: string | null;
  criadoEm: string | null;
};

export type CalXProContatosFilters = {
  q?: string;
  limit?: number;
  offset?: number;
};

type ContatoRow = {
  ID_CONTATO: number;
  ST_NOME: string | null;
  ST_TELEFONE: string | null;
  ST_CELULAR: string | null;
  ST_CIDADE: string | null;
  DT_INC: Date | null;
};

function toContato(row: ContatoRow): CalXProContato {
  return {
    id: String(row.ID_CONTATO),
    nome: row.ST_NOME?.trim() || 'Sem nome',
    telefone: row.ST_TELEFONE?.trim() || null,
    celular: row.ST_CELULAR?.trim() || null,
    cidade: row.ST_CIDADE?.trim() || null,
    criadoEm: row.DT_INC ? row.DT_INC.toISOString() : null,
  };
}

function sqlConfig(options: LapTimeSqlOptions): sql.config {
  return {
    server: options.server,
    database: options.database,
    user: options.user,
    password: options.password,
    port: options.port,
    connectionTimeout: options.timeoutMs || 5000,
    requestTimeout: options.timeoutMs || 5000,
    pool: { max: 1, min: 0, idleTimeoutMillis: 30000 },
    options: { encrypt: false, trustServerCertificate: true, instanceName: options.instanceName },
  };
}

export async function fetchCalXProContatosPage(
  options: LapTimeSqlOptions,
  filters: CalXProContatosFilters,
): Promise<{ rows: CalXProContato[]; total: number }> {
  const limit = Math.max(1, Math.min(2000, filters.limit ?? 1000));
  const offset = Math.max(0, filters.offset ?? 0);
  const q = filters.q?.trim();

  const pool = new sql.ConnectionPool(sqlConfig(options));
  try {
    await pool.connect();

    const whereSql = q ? 'where ST_NOME like @q or ST_TELEFONE like @q or ST_CELULAR like @q' : '';
    const bindQ = (request: sql.Request) => {
      if (q) request.input('q', sql.NVarChar, `%${q}%`);
      return request;
    };

    const totalResult = await bindQ(pool.request()).query<{ c: number }>(
      `select count(*) as c from dbo.CONTATO ${whereSql}`,
    );
    const total = totalResult.recordset[0]?.c ?? 0;

    const rowsResult = await bindQ(pool.request())
      .input('limit', sql.Int, limit)
      .input('offset', sql.Int, offset)
      .query<ContatoRow>(`
        select ID_CONTATO, ST_NOME, ST_TELEFONE, ST_CELULAR, ST_CIDADE, DT_INC
        from dbo.CONTATO
        ${whereSql}
        order by ID_CONTATO desc
        offset @offset rows fetch next @limit rows only
      `);

    return { rows: rowsResult.recordset.map(toContato), total };
  } finally {
    await pool.close().catch(() => undefined);
  }
}
