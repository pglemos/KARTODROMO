import sql from 'mssql';
import type { LapTimeSqlOptions } from '@/lib/livetime/laptime-sql';

export type CalXProCorrida = {
  id: string;
  nome: string;
  dataHora: string;
  participantes: number;
};

export type CalXProCorridasFilters = {
  q?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
};

export type CalXProCorridaCompetidor = {
  id: string;
  posicao: number | null;
  nome: string;
  cidade: string | null;
  voltas: number | null;
  melhorVolta: string | null;
  tempoTotal: string | null;
};

type CorridaRow = {
  ID_CORRIDA: number;
  ST_NOME: string | null;
  DT_DATA_HORA: Date;
  Participantes: number;
};

type CompetidorRow = {
  ID_COMPETIDOR_CORRIDA: number;
  NM_POSICAO: number | null;
  ST_NOME: string | null;
  ST_SOBRENOME: string | null;
  ST_CIDADE: string | null;
  TOT_VOLTAS: number | null;
  TEMPO_MELHOR_VOLTA: unknown;
  TEMPO_TOTAL: unknown;
};

function clean(value: unknown): string {
  if (value === undefined || value === null) return '';
  return String(value).replace(/\s+/g, ' ').trim();
}

function formatSqlTime(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (value instanceof Date) {
    const totalMinutes = value.getUTCHours() * 60 + value.getUTCMinutes();
    const seconds = String(value.getUTCSeconds()).padStart(2, '0');
    const millis = String(value.getUTCMilliseconds()).padStart(3, '0');
    return `${totalMinutes}:${seconds}.${millis}`;
  }
  const raw = clean(value);
  return raw || null;
}

function toCorrida(row: CorridaRow): CalXProCorrida {
  return {
    id: String(row.ID_CORRIDA),
    nome: row.ST_NOME?.trim() || 'Corrida',
    dataHora: row.DT_DATA_HORA.toISOString(),
    participantes: row.Participantes,
  };
}

function toCompetidor(row: CompetidorRow): CalXProCorridaCompetidor {
  return {
    id: String(row.ID_COMPETIDOR_CORRIDA),
    posicao: row.NM_POSICAO,
    nome: clean([row.ST_NOME, row.ST_SOBRENOME].filter(Boolean).join(' ')) || 'Sem nome',
    cidade: row.ST_CIDADE?.trim() || null,
    voltas: row.TOT_VOLTAS,
    melhorVolta: formatSqlTime(row.TEMPO_MELHOR_VOLTA),
    tempoTotal: formatSqlTime(row.TEMPO_TOTAL),
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

export async function fetchCalXProCorridasPage(
  options: LapTimeSqlOptions,
  filters: CalXProCorridasFilters,
): Promise<{ rows: CalXProCorrida[]; total: number }> {
  const limit = Math.max(1, Math.min(2000, filters.limit ?? 200));
  const offset = Math.max(0, filters.offset ?? 0);
  const q = filters.q?.trim();

  const pool = new sql.ConnectionPool(sqlConfig(options));
  try {
    await pool.connect();

    const conditions: string[] = [];
    if (q) conditions.push('c.ST_NOME like @q');
    if (filters.from) conditions.push('c.DT_DATA_HORA >= @from');
    if (filters.to) conditions.push('c.DT_DATA_HORA <= @to');
    const whereSql = conditions.length ? `where ${conditions.join(' and ')}` : '';

    const bind = (request: sql.Request) => {
      if (q) request.input('q', sql.NVarChar, `%${q}%`);
      if (filters.from) request.input('from', sql.DateTime, new Date(filters.from!));
      if (filters.to) request.input('to', sql.DateTime, new Date(filters.to!));
      return request;
    };

    const totalResult = await bind(pool.request()).query<{ c: number }>(
      `select count(*) as c from dbo.CORRIDA c ${whereSql}`,
    );
    const total = totalResult.recordset[0]?.c ?? 0;

    const rowsResult = await bind(pool.request())
      .input('limit', sql.Int, limit)
      .input('offset', sql.Int, offset)
      .query<CorridaRow>(`
        select
          c.ID_CORRIDA, c.ST_NOME, c.DT_DATA_HORA,
          (select count(*) from dbo.COMPETIDOR_CORRIDA cc where cc.ID_CORRIDA = c.ID_CORRIDA) as Participantes
        from dbo.CORRIDA c
        ${whereSql}
        order by c.DT_DATA_HORA desc
        offset @offset rows fetch next @limit rows only
      `);

    return { rows: rowsResult.recordset.map(toCorrida), total };
  } finally {
    await pool.close().catch(() => undefined);
  }
}

export async function fetchCalXProCorridaCompetidores(
  options: LapTimeSqlOptions,
  corridaId: string,
): Promise<CalXProCorridaCompetidor[]> {
  const pool = new sql.ConnectionPool(sqlConfig(options));
  try {
    await pool.connect();
    const result = await pool
      .request()
      .input('corridaId', sql.BigInt, Number(corridaId))
      .query<CompetidorRow>(`
        select top 60
          ID_COMPETIDOR_CORRIDA, NM_POSICAO, ST_NOME, ST_SOBRENOME, ST_CIDADE,
          TOT_VOLTAS, TEMPO_MELHOR_VOLTA, TEMPO_TOTAL
        from dbo.COMPETIDOR_CORRIDA
        where ID_CORRIDA = @corridaId
        order by coalesce(NM_POSICAO, 9999), ID_COMPETIDOR_CORRIDA
      `);

    return result.recordset.map(toCompetidor);
  } finally {
    await pool.close().catch(() => undefined);
  }
}
