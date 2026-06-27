import sql from 'mssql';
import type { LapTimeSqlOptions } from '@/lib/livetime/laptime-sql';

export type LapTimeRacing = {
  id: string;
  nome: string;
  tipo: string | null;
  dataHora: string;
  inicio: string | null;
  estado: number;
  finalizada: boolean;
  participantes: number;
};

export type LapTimeRacingsFilters = {
  q?: string;
  status?: 'finalizada' | 'aberta' | '';
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
};

export type LapTimeRacingCompetitor = {
  id: string;
  posicao: number | null;
  numero: string | null;
  nome: string;
  voltas: number | null;
  melhorVolta: string | null;
  tempoTotal: string | null;
  status: number;
};

type RacingRow = {
  Id_Racing: number;
  Name: string | null;
  RacingTypeName: string | null;
  ExpectedDateTime: Date;
  StartDateTime: Date | null;
  RacingState: number;
  Participantes: number;
};

type RacingCompetitorRow = {
  Id_RacingCompetitor: number;
  Pos: number | null;
  Number: string | null;
  Competitor: string | null;
  ShortName: string | null;
  Lap: number | null;
  BestLapTime: unknown;
  TotalTime: unknown;
  RacingStatus: number;
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

function toRacing(row: RacingRow): LapTimeRacing {
  return {
    id: String(row.Id_Racing),
    nome: row.Name?.trim() || 'Corrida',
    tipo: row.RacingTypeName?.trim() || null,
    dataHora: row.ExpectedDateTime.toISOString(),
    inicio: row.StartDateTime ? row.StartDateTime.toISOString() : null,
    estado: row.RacingState,
    finalizada: row.RacingState === 6,
    participantes: row.Participantes,
  };
}

function toCompetitor(row: RacingCompetitorRow): LapTimeRacingCompetitor {
  return {
    id: String(row.Id_RacingCompetitor),
    posicao: row.Pos,
    numero: row.Number?.trim() || null,
    nome: clean(row.ShortName || row.Competitor) || 'Sem nome',
    voltas: row.Lap,
    melhorVolta: formatSqlTime(row.BestLapTime),
    tempoTotal: formatSqlTime(row.TotalTime),
    status: row.RacingStatus,
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

export async function fetchLapTimeRacingsPage(
  options: LapTimeSqlOptions,
  filters: LapTimeRacingsFilters,
): Promise<{ rows: LapTimeRacing[]; total: number }> {
  const limit = Math.max(1, Math.min(2000, filters.limit ?? 200));
  const offset = Math.max(0, filters.offset ?? 0);
  const q = filters.q?.trim();

  const pool = new sql.ConnectionPool(sqlConfig(options));
  try {
    await pool.connect();

    const conditions: string[] = [];
    if (q) conditions.push('r.Name like @q');
    if (filters.status === 'finalizada') conditions.push('r.RacingState = 6');
    if (filters.status === 'aberta') conditions.push('r.RacingState <> 6');
    if (filters.from) conditions.push('r.ExpectedDateTime >= @from');
    if (filters.to) conditions.push('r.ExpectedDateTime <= @to');
    const whereSql = conditions.length ? `where ${conditions.join(' and ')}` : '';

    const bind = (request: sql.Request) => {
      if (q) request.input('q', sql.NVarChar, `%${q}%`);
      if (filters.from) request.input('from', sql.DateTime, new Date(filters.from));
      if (filters.to) request.input('to', sql.DateTime, new Date(filters.to));
      return request;
    };

    const totalResult = await bind(pool.request()).query<{ c: number }>(
      `select count(*) as c from dbo.Racing r ${whereSql}`,
    );
    const total = totalResult.recordset[0]?.c ?? 0;

    const rowsResult = await bind(pool.request())
      .input('limit', sql.Int, limit)
      .input('offset', sql.Int, offset)
      .query<RacingRow>(`
        select
          r.Id_Racing, r.Name, rt.Name as RacingTypeName, r.ExpectedDateTime, r.StartDateTime, r.RacingState,
          (select count(*) from dbo.RacingCompetitor rc where rc.Id_Racing = r.Id_Racing and (rc.IsHidden = 0 or rc.IsHidden is null)) as Participantes
        from dbo.Racing r
        left join dbo.RacingType rt on rt.Id_RacingType = r.Id_RacingType
        ${whereSql}
        order by r.ExpectedDateTime desc
        offset @offset rows fetch next @limit rows only
      `);

    return { rows: rowsResult.recordset.map(toRacing), total };
  } finally {
    await pool.close().catch(() => undefined);
  }
}

export async function fetchLapTimeRacingCompetitors(
  options: LapTimeSqlOptions,
  racingId: string,
): Promise<LapTimeRacingCompetitor[]> {
  const pool = new sql.ConnectionPool(sqlConfig(options));
  try {
    await pool.connect();
    const result = await pool
      .request()
      .input('racingId', sql.BigInt, Number(racingId))
      .query<RacingCompetitorRow>(`
        select top 60 Id_RacingCompetitor, Pos, Number, Competitor, ShortName, Lap, BestLapTime, TotalTime, RacingStatus
        from dbo.RacingCompetitor
        where Id_Racing = @racingId and (IsHidden = 0 or IsHidden is null)
        order by coalesce(Pos, 9999), Id_RacingCompetitor
      `);

    return result.recordset.map(toCompetitor);
  } finally {
    await pool.close().catch(() => undefined);
  }
}
