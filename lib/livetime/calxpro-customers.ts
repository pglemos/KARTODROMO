import sql from 'mssql';
import type { LapTimeSqlOptions } from '@/lib/livetime/laptime-sql';

export type CalXProCustomer = {
  id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  documento: string | null;
  cidade: string | null;
  criadoEm: string | null;
};

export type CalXProCustomersFilters = {
  q?: string;
  limit?: number;
  offset?: number;
};

type ClienteRow = {
  ID_CLIENTE: number;
  ST_NOME: string | null;
  ST_SOBRENOME: string | null;
  ST_EMAIL: string | null;
  ST_CELULAR: string | null;
  ST_TELEFONE: string | null;
  ST_CPF: string | null;
  ST_CIDADE: string | null;
  DT_INC: Date | null;
};

function toCustomer(row: ClienteRow): CalXProCustomer {
  const nome = [row.ST_NOME?.trim(), row.ST_SOBRENOME?.trim()].filter(Boolean).join(' ');
  return {
    id: String(row.ID_CLIENTE),
    nome: nome || 'Sem nome',
    email: row.ST_EMAIL?.trim() || null,
    telefone: row.ST_CELULAR?.trim() || row.ST_TELEFONE?.trim() || null,
    documento: row.ST_CPF?.trim() || null,
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
    options: {
      encrypt: false,
      trustServerCertificate: true,
      instanceName: options.instanceName,
    },
  };
}

export async function fetchCalXProCustomersPage(
  options: LapTimeSqlOptions,
  filters: CalXProCustomersFilters,
): Promise<{ rows: CalXProCustomer[]; total: number }> {
  const limit = Math.max(1, Math.min(2000, filters.limit ?? 1000));
  const offset = Math.max(0, filters.offset ?? 0);
  const q = filters.q?.trim();

  const pool = new sql.ConnectionPool(sqlConfig(options));
  try {
    await pool.connect();

    const whereSql = q
      ? 'where ST_NOME like @q or ST_SOBRENOME like @q or ST_EMAIL like @q or ST_CELULAR like @q or ST_CPF like @q'
      : '';
    const bindQ = (request: sql.Request) => {
      if (q) request.input('q', sql.NVarChar, `%${q}%`);
      return request;
    };

    const totalResult = await bindQ(pool.request()).query<{ c: number }>(
      `select count(*) as c from dbo.CLIENTE ${whereSql}`,
    );
    const total = totalResult.recordset[0]?.c ?? 0;

    const rowsResult = await bindQ(pool.request())
      .input('limit', sql.Int, limit)
      .input('offset', sql.Int, offset)
      .query<ClienteRow>(`
        select ID_CLIENTE, ST_NOME, ST_SOBRENOME, ST_EMAIL, ST_CELULAR, ST_TELEFONE, ST_CPF, ST_CIDADE, DT_INC
        from dbo.CLIENTE
        ${whereSql}
        order by ID_CLIENTE desc
        offset @offset rows fetch next @limit rows only
      `);

    return { rows: rowsResult.recordset.map(toCustomer), total };
  } finally {
    await pool.close().catch(() => undefined);
  }
}
