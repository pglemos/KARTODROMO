import sql from 'mssql';
import type { LapTimeSqlOptions } from '@/lib/livetime/laptime-sql';

function toSqlDatetime(date: Date | null): string | null {
  if (!date) return null;
  return new Date(date.getTime() + date.getTimezoneOffset() * 60_000).toISOString();
}

/**
 * Leitura da tabela unificada de clientes (`dbo.ClienteUnificado`), mantida pelo daemon de
 * espelho no SRVKART (ver lib/livetime/cliente-unificado-sync.ts). Concentra LapTime + CalXPro
 * (histórico + contatos) numa unica lista, sem expor de qual sistema cada registro veio — essa
 * distincao e' puramente interna (coluna `OrigemSistema`, nao selecionada aqui).
 */
export type Cliente = {
  id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  documento: string | null;
  cidade: string | null;
  estado: string | null;
  criadoEm: string | null;
};

export type ClientesFilters = {
  q?: string;
  limit?: number;
  offset?: number;
};

type ClienteRow = {
  Id: number;
  Nome: string;
  Email: string | null;
  Telefone: string | null;
  Documento: string | null;
  Cidade: string | null;
  Estado: string | null;
  CriadoEm: Date | null;
};

function toCliente(row: ClienteRow): Cliente {
  return {
    id: String(row.Id),
    nome: row.Nome,
    email: row.Email,
    telefone: row.Telefone,
    documento: row.Documento,
    cidade: row.Cidade,
    estado: row.Estado,
    criadoEm: toSqlDatetime(row.CriadoEm),
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
      ...(options.port ? {} : { instanceName: options.instanceName }),
    },
  };
}

export async function fetchClientesPage(
  options: LapTimeSqlOptions,
  filters: ClientesFilters,
): Promise<{ rows: Cliente[]; total: number }> {
  const limit = Math.max(1, Math.min(2000, filters.limit ?? 1000));
  const offset = Math.max(0, filters.offset ?? 0);
  const q = filters.q?.trim();

  const pool = new sql.ConnectionPool(sqlConfig(options));
  try {
    await pool.connect();

    const whereSql = q
      ? 'where Nome like @q or Email like @q or Telefone like @q or Documento like @q'
      : '';
    const bindQ = (request: sql.Request) => {
      if (q) request.input('q', sql.NVarChar, `%${q}%`);
      return request;
    };

    const totalResult = await bindQ(pool.request()).query<{ c: number }>(
      `select count(*) as c from dbo.ClienteUnificado ${whereSql}`,
    );
    const total = totalResult.recordset[0]?.c ?? 0;

    const rowsResult = await bindQ(pool.request())
      .input('limit', sql.Int, limit)
      .input('offset', sql.Int, offset)
      .query<ClienteRow>(`
        select Id, Nome, Email, Telefone, Documento, Cidade, Estado, CriadoEm
        from dbo.ClienteUnificado
        ${whereSql}
        order by Nome
        offset @offset rows fetch next @limit rows only
      `);

    return { rows: rowsResult.recordset.map(toCliente), total };
  } finally {
    await pool.close().catch(() => undefined);
  }
}
