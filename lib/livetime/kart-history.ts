import sql from 'mssql';
import { formatDurationMs, parseDurationMs } from '@/lib/livetime/time-format';
import type { LapTimeSqlOptions } from '@/lib/livetime/laptime-sql';

export type KartHistoryQuery = {
  plate?: string | null;
  sensor?: string | null;
  limit?: number;
};

export type KartHistoryItem = {
  raceId: string;
  raceName: string;
  raceType: string | null;
  raceDate: string;
  trackName: string | null;
  plate: string | null;
  sensor: string | null;
  driver: string | null;
  bestLap: string | null;
  bestLapMs: number | null;
  laps: number | null;
  averageLap: string | null;
  matchedBy: 'sensor' | 'plate';
};

type KartHistoryRow = {
  Id_Racing: number;
  Name: string | null;
  RacingTypeName: string | null;
  ExpectedDateTime: Date | string;
  RacingTrackName: string | null;
  Number: string | number | null;
  Transponder: string | number | null;
  Competitor: string | null;
  BestLapTime: unknown;
  Lap: number | null;
  AvgLapTime: unknown;
  MatchedBy: string;
};

function clean(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).replace(/\s+/g, ' ').trim();
}

function isoDate(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString();
}

function formatTime(value: unknown): { text: string | null; milliseconds: number | null } {
  const milliseconds = parseDurationMs(value);
  return {
    text: milliseconds === null ? (clean(value) || null) : formatDurationMs(milliseconds),
    milliseconds,
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
    requestTimeout: Math.max(options.timeoutMs || 5000, 15000),
    pool: { max: 1, min: 0, idleTimeoutMillis: 30000 },
    options: { encrypt: false, trustServerCertificate: true, instanceName: options.instanceName },
  };
}

function toHistoryItem(row: KartHistoryRow): KartHistoryItem {
  const best = formatTime(row.BestLapTime);
  const average = formatTime(row.AvgLapTime);

  return {
    raceId: String(row.Id_Racing),
    raceName: clean(row.Name) || 'Corrida',
    raceType: clean(row.RacingTypeName) || null,
    raceDate: isoDate(row.ExpectedDateTime),
    trackName: clean(row.RacingTrackName) || null,
    plate: row.Number === null || row.Number === undefined ? null : clean(row.Number),
    sensor: row.Transponder === null || row.Transponder === undefined ? null : clean(row.Transponder),
    driver: clean(row.Competitor) || null,
    bestLap: best.text,
    bestLapMs: best.milliseconds,
    laps: row.Lap === null || row.Lap === undefined ? null : Number(row.Lap),
    averageLap: average.text,
    matchedBy: row.MatchedBy === 'sensor' ? 'sensor' : 'plate',
  };
}

/**
 * Reads the historical performance by transponder first. The plate is only
 * used when no sensor is registered, preventing a swapped sensor from mixing
 * two physical karts in the same history.
 */
export async function fetchLapTimeKartHistory(
  options: LapTimeSqlOptions,
  query: KartHistoryQuery,
): Promise<KartHistoryItem[]> {
  const sensor = clean(query.sensor);
  const plate = clean(query.plate);
  if (!sensor && !plate) return [];

  const limit = Math.max(1, Math.min(60, Math.floor(query.limit ?? 60)));
  const matchBySensor = Boolean(sensor);
  const matchSql = matchBySensor
    ? 'convert(nvarchar(64), rc.Transponder) = @sensor'
    : '(convert(nvarchar(64), rc.Number) = @plate or convert(nvarchar(64), rc.Number) = @plateNumeric)';
  const finishedSql = `(r.RacingState in (5, 6)
    or (r.StartDateTime is not null and r.EndTime is not null and convert(time, r.EndTime) > cast('00:00:00' as time))
    or (r.FinishLap is not null and r.FinishLap > 0)
    or lastPassing.Id_RacingFlag in (4, 5))`;

  const pool = new sql.ConnectionPool(sqlConfig(options));
  try {
    await pool.connect();
    const request = pool
      .request()
      .input('limit', sql.Int, limit)
      .input('sensor', sql.NVarChar(128), sensor)
      .input('plate', sql.NVarChar(128), plate)
      .input('plateNumeric', sql.NVarChar(128), /^\d+$/.test(plate) ? String(Number(plate)) : '');

    const result = await request.query<KartHistoryRow>(`
      select
        r.Id_Racing,
        r.Name,
        rt.Name as RacingTypeName,
        r.ExpectedDateTime,
        tr.Name as RacingTrackName,
        rc.Number,
        rc.Transponder,
        rc.Competitor,
        coalesce(rc.BestLapTime, bestPassing.BestLapTime) as BestLapTime,
        rc.Lap,
        rc.AvgLapTime,
        '${matchBySensor ? 'sensor' : 'plate'}' as MatchedBy
      from dbo.Racing r with (nolock)
      left join dbo.RacingType rt with (nolock) on rt.Id_RacingType = r.Id_RacingType
      left join dbo.RacingTrack tr with (nolock) on tr.Id_RacingTrack = r.Id_RacingTrack
      outer apply (
        select top 1 p.Id_RacingFlag
        from dbo.Passing p with (nolock)
        where p.Id_Racing = r.Id_Racing
        order by p.Id_Passing desc
      ) lastPassing
      cross apply (
        select top 1
          rc0.Id_RacingCompetitor,
          rc0.Number,
          rc0.Transponder,
          rc0.Competitor,
          rc0.BestLapTime,
          rc0.Lap,
          rc0.AvgLapTime
        from dbo.RacingCompetitor rc0 with (nolock)
        outer apply (
          select min(p0.LapTime) as BestLapTime
          from dbo.Passing p0 with (nolock)
          where p0.Id_Racing = rc0.Id_Racing
            and p0.Id_RacingCompetitor = rc0.Id_RacingCompetitor
            and (p0.InvalidLap = 0 or p0.InvalidLap is null)
            and (p0.DeletedLap = 0 or p0.DeletedLap is null)
            and p0.LapTime is not null
        ) bestPassing
        where rc0.Id_Racing = r.Id_Racing
          and (rc0.IsHidden = 0 or rc0.IsHidden is null)
          and ${matchBySensor ? 'convert(nvarchar(64), rc0.Transponder) = @sensor' : '(convert(nvarchar(64), rc0.Number) = @plate or convert(nvarchar(64), rc0.Number) = @plateNumeric)'}
        order by coalesce(rc0.BestLapTime, bestPassing.BestLapTime), rc0.Id_RacingCompetitor
      ) rc
      outer apply (
        select min(p1.LapTime) as BestLapTime
        from dbo.Passing p1 with (nolock)
        where p1.Id_Racing = r.Id_Racing
          and p1.Id_RacingCompetitor = rc.Id_RacingCompetitor
          and (p1.InvalidLap = 0 or p1.InvalidLap is null)
          and (p1.DeletedLap = 0 or p1.DeletedLap is null)
          and p1.LapTime is not null
      ) bestPassing
      where ${finishedSql}
        and r.ExpectedDateTime <= getdate()
        and ${matchSql.replace(/\brc\./g, 'rc.')}
        and coalesce(rc.BestLapTime, bestPassing.BestLapTime) is not null
      order by r.ExpectedDateTime desc, r.Id_Racing desc
      offset 0 rows fetch next @limit rows only
    `);

    return result.recordset.map(toHistoryItem).filter((item) => item.bestLapMs !== null);
  } finally {
    await pool.close().catch(() => undefined);
  }
}
