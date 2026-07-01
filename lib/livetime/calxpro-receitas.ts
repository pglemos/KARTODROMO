import sql from 'mssql';
import type { LapTimeSqlOptions } from '@/lib/livetime/laptime-sql';

export type CalXProReceita = {
  id: string;
  descricao: string;
  cliente: string | null;
  valor: number;
  dataLancamento: string | null;
  dataVencimento: string | null;
};

export type CalXProReceitasFilters = {
  q?: string;
  limit?: number;
  offset?: number;
};

export type CalXProCredito = {
  id: string;
  clienteId: string;
  documento: string | null;
  valor: number;
  status: string | null;
  data: string | null;
  cancelado: boolean;
};

export type CalXProCreditosFilters = {
  limit?: number;
  offset?: number;
};

type ReceitaRow = {
  ID_RECEITA: number;
  ST_OBS: string | null;
  ST_CLIENTE: string | null;
  NM_TOTALRECEITA: number | null;
  DT_LANCAMENTO: Date | null;
  DT_VENCIMENTO: Date | null;
};

type CreditoRow = {
  ID_CREDITO_CLIENTE: number;
  ID_CLIENTE: number;
  DOC: string | null;
  VALOR: number | null;
  STATUS: string | null;
  DATA: Date | null;
  CANCELADO: number | null;
};

function toReceita(row: ReceitaRow): CalXProReceita {
  return {
    id: String(row.ID_RECEITA),
    descricao: row.ST_OBS?.trim() || 'Sem descrição',
    cliente: row.ST_CLIENTE?.trim() || null,
    valor: Number(row.NM_TOTALRECEITA ?? 0),
    dataLancamento: row.DT_LANCAMENTO ? row.DT_LANCAMENTO.toISOString() : null,
    dataVencimento: row.DT_VENCIMENTO ? row.DT_VENCIMENTO.toISOString() : null,
  };
}

function toCredito(row: CreditoRow): CalXProCredito {
  return {
    id: String(row.ID_CREDITO_CLIENTE),
    clienteId: String(row.ID_CLIENTE),
    documento: row.DOC?.trim() || null,
    valor: Number(row.VALOR ?? 0),
    status: row.STATUS?.trim() || null,
    data: row.DATA ? row.DATA.toISOString() : null,
    cancelado: Number(row.CANCELADO ?? 0) === 1,
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

export async function fetchCalXProReceitasPage(
  options: LapTimeSqlOptions,
  filters: CalXProReceitasFilters,
): Promise<{ rows: CalXProReceita[]; total: number }> {
  const limit = Math.max(1, Math.min(2000, filters.limit ?? 1000));
  const offset = Math.max(0, filters.offset ?? 0);
  const q = filters.q?.trim();

  const pool = new sql.ConnectionPool(sqlConfig(options));
  try {
    await pool.connect();

    const whereSql = q ? 'where ST_CLIENTE like @q or ST_OBS like @q' : '';
    const bindQ = (request: sql.Request) => {
      if (q) request.input('q', sql.NVarChar, `%${q}%`);
      return request;
    };

    const totalResult = await bindQ(pool.request()).query<{ c: number }>(
      `select count(*) as c from dbo.RECEITA ${whereSql}`,
    );
    const total = totalResult.recordset[0]?.c ?? 0;

    const rowsResult = await bindQ(pool.request())
      .input('limit', sql.Int, limit)
      .input('offset', sql.Int, offset)
      .query<ReceitaRow>(`
        select ID_RECEITA, ST_OBS, ST_CLIENTE, NM_TOTALRECEITA, DT_LANCAMENTO, DT_VENCIMENTO
        from dbo.RECEITA
        ${whereSql}
        order by DT_LANCAMENTO desc, ID_RECEITA desc
        offset @offset rows fetch next @limit rows only
      `);

    return { rows: rowsResult.recordset.map(toReceita), total };
  } finally {
    await pool.close().catch(() => undefined);
  }
}

export async function fetchCalXProCreditosPage(
  options: LapTimeSqlOptions,
  filters: CalXProCreditosFilters,
): Promise<{ rows: CalXProCredito[]; total: number }> {
  const limit = Math.max(1, Math.min(2000, filters.limit ?? 1000));
  const offset = Math.max(0, filters.offset ?? 0);

  const pool = new sql.ConnectionPool(sqlConfig(options));
  try {
    await pool.connect();

    const totalResult = await pool.request().query<{ c: number }>('select count(*) as c from dbo.CREDITO_CLIENTE');
    const total = totalResult.recordset[0]?.c ?? 0;

    const rowsResult = await pool
      .request()
      .input('limit', sql.Int, limit)
      .input('offset', sql.Int, offset)
      .query<CreditoRow>(`
        select ID_CREDITO_CLIENTE, ID_CLIENTE, DOC, VALOR, STATUS, DATA, CANCELADO
        from dbo.CREDITO_CLIENTE
        order by DATA desc, ID_CREDITO_CLIENTE desc
        offset @offset rows fetch next @limit rows only
      `);

    return { rows: rowsResult.recordset.map(toCredito), total };
  } finally {
    await pool.close().catch(() => undefined);
  }
}
