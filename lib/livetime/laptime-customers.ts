import sql from 'mssql';
import type { LapTimeSqlOptions } from '@/lib/livetime/laptime-sql';

export type LapTimeCustomer = {
  id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  documento: string | null;
  cidade: string | null;
  estado: string | null;
  criadoEm: string | null;
};

export type LapTimeCustomersFilters = {
  q?: string;
  limit?: number;
  offset?: number;
};

type CustomerRow = {
  Id_Customer: number;
  Name: string | null;
  Email: string | null;
  Phone: string | null;
  Doc: string | null;
  City: string | null;
  State: string | null;
  Created: Date | null;
};

function toCustomer(row: CustomerRow): LapTimeCustomer {
  return {
    id: String(row.Id_Customer),
    nome: row.Name?.trim() || 'Sem nome',
    email: row.Email?.trim() || null,
    telefone: row.Phone?.trim() || null,
    documento: row.Doc?.trim() || null,
    cidade: row.City?.trim() || null,
    estado: row.State?.trim() || null,
    criadoEm: row.Created ? row.Created.toISOString() : null,
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

export async function fetchLapTimeCustomersPage(
  options: LapTimeSqlOptions,
  filters: LapTimeCustomersFilters,
): Promise<{ rows: LapTimeCustomer[]; total: number }> {
  const limit = Math.max(1, Math.min(2000, filters.limit ?? 1000));
  const offset = Math.max(0, filters.offset ?? 0);
  const q = filters.q?.trim();

  const pool = new sql.ConnectionPool(sqlConfig(options));
  try {
    await pool.connect();

    const whereSql = q ? 'where Name like @q or Email like @q or Phone like @q or Doc like @q' : '';
    const bindQ = (request: sql.Request) => {
      if (q) request.input('q', sql.NVarChar, `%${q}%`);
      return request;
    };

    const totalResult = await bindQ(pool.request()).query<{ c: number }>(
      `select count(*) as c from dbo.Customer ${whereSql}`,
    );
    const total = totalResult.recordset[0]?.c ?? 0;

    const rowsResult = await bindQ(pool.request())
      .input('limit', sql.Int, limit)
      .input('offset', sql.Int, offset)
      .query<CustomerRow>(`
        select Id_Customer, Name, Email, Phone, Doc, City, State, Created
        from dbo.Customer
        ${whereSql}
        order by Id_Customer desc
        offset @offset rows fetch next @limit rows only
      `);

    return { rows: rowsResult.recordset.map(toCustomer), total };
  } finally {
    await pool.close().catch(() => undefined);
  }
}
