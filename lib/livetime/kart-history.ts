import sql from 'mssql';
import { buildKartHistorySummary } from '@/lib/equalizacao/history';
import { formatDurationMs, parseDurationMs } from '@/lib/livetime/time-format';
import type { LapTimeSqlOptions } from '@/lib/livetime/laptime-sql';
import type { KartHistoryItem, KartHistorySummary } from '@/src/admin/modules/equalizacao/equalizacao.types';

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
  KartPlate?: string | null;
  Id_RacingCompetitor?: number;
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
  const plate = clean(row.KartPlate) || clean(row.Number);

  return {
    raceId: String(row.Id_Racing),
    raceName: clean(row.Name) || 'Corrida',
    raceType: clean(row.RacingTypeName) || null,
    raceDate: isoDate(row.ExpectedDateTime),
    trackName: clean(row.RacingTrackName) || null,
    plate: plate || null,
    sensor: row.Transponder === null || row.Transponder === undefined ? null : clean(row.Transponder),
    driver: clean(row.Competitor) || null,
    bestLap: best.text,
    bestLapMs: best.milliseconds,
    laps: row.Lap === null || row.Lap === undefined ? null : Number(row.Lap),
    averageLap: average.text,
    averageLapMs: average.milliseconds,
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

/**
 * Reads the latest real history for the complete LapTime fleet in one SQL
 * round-trip. A renumbered transponder wins only when it has matching races;
 * otherwise the current plate is used, which is how the source records the
 * majority of the historical data.
 */
export async function fetchLapTimeKartHistorySummary(options: LapTimeSqlOptions): Promise<KartHistorySummary[]> {
  const finishedSql = `(r.RacingState in (5, 6)
    or (r.StartDateTime is not null and r.EndTime is not null and convert(time, r.EndTime) > cast('00:00:00' as time))
    or (r.FinishLap is not null and r.FinishLap > 0)
    or lastPassing.Id_RacingFlag in (4, 5))`;
  const pool = new sql.ConnectionPool(sqlConfig(options));

  try {
    await pool.connect();
    const result = await pool.request().query<KartHistoryRow>(`
      with raw_fleet as (
        select
          vc.*,
          try_convert(int, ltrim(rtrim(vc.Number))) as KartNumber
        from dbo.VehicleControl vc with (nolock)
      ), latest_fleet as (
        select
          raw_fleet.*,
          row_number() over (
            partition by raw_fleet.KartNumber
            order by raw_fleet.DateControl desc, raw_fleet.Id_VehicleControl desc
          ) as RowNumber
        from raw_fleet
        where raw_fleet.KartNumber between 1 and 200
      ), fleet as (
        select
          latest_fleet.KartNumber,
          case
            when latest_fleet.KartNumber < 100 then right('00' + convert(varchar(3), latest_fleet.KartNumber), 2)
            else convert(varchar(3), latest_fleet.KartNumber)
          end as PlateKey,
          nullif(ltrim(rtrim(convert(nvarchar(128), transponder.OriginalNumber))), '') as SensorKey
        from latest_fleet
        outer apply (
          select top 1 tr.OriginalNumber
          from dbo.TransponderRenumber tr with (nolock)
          where tr.NewNumber = latest_fleet.KartNumber
          order by tr.Id_TransponderRenumber desc
        ) transponder
        where latest_fleet.RowNumber = 1
      ), identity_matches as (
        select
          fleet.PlateKey,
          cast('sensor' as varchar(8)) as MatchedBy,
          rc.Id_RacingCompetitor,
          rc.Id_Racing,
          rc.Number,
          rc.Transponder,
          rc.Competitor,
          rc.BestLapTime,
          rc.Lap,
          rc.AvgLapTime
        from fleet
        inner join dbo.RacingCompetitor rc with (nolock)
          on fleet.SensorKey is not null
          and convert(nvarchar(64), rc.Transponder) = fleet.SensorKey

        union all

        select
          fleet.PlateKey,
          cast('plate' as varchar(8)) as MatchedBy,
          rc.Id_RacingCompetitor,
          rc.Id_Racing,
          rc.Number,
          rc.Transponder,
          rc.Competitor,
          rc.BestLapTime,
          rc.Lap,
          rc.AvgLapTime
        from fleet
        inner join dbo.RacingCompetitor rc with (nolock)
          on convert(nvarchar(64), rc.Number) = fleet.PlateKey
          or convert(nvarchar(64), rc.Number) = convert(nvarchar(64), fleet.KartNumber)
      ), candidate_rows as (
        select
          identity_matches.PlateKey,
          identity_matches.MatchedBy,
          r.Id_Racing,
          r.Name,
          racing_type.Name as RacingTypeName,
          r.ExpectedDateTime,
          racing_track.Name as RacingTrackName,
          identity_matches.Id_RacingCompetitor,
          identity_matches.Number,
          identity_matches.Transponder,
          identity_matches.Competitor,
          coalesce(identity_matches.BestLapTime, bestPassing.BestLapTime) as BestLapTime,
          identity_matches.Lap,
          identity_matches.AvgLapTime
        from identity_matches
        inner join dbo.Racing r with (nolock) on r.Id_Racing = identity_matches.Id_Racing
        left join dbo.RacingType racing_type with (nolock) on racing_type.Id_RacingType = r.Id_RacingType
        left join dbo.RacingTrack racing_track with (nolock) on racing_track.Id_RacingTrack = r.Id_RacingTrack
        outer apply (
          select top 1 p.Id_RacingFlag
          from dbo.Passing p with (nolock)
          where p.Id_Racing = r.Id_Racing
          order by p.Id_Passing desc
        ) lastPassing
        outer apply (
          select min(p.LapTime) as BestLapTime
          from dbo.Passing p with (nolock)
          where p.Id_Racing = r.Id_Racing
            and p.Id_RacingCompetitor = identity_matches.Id_RacingCompetitor
            and (p.InvalidLap = 0 or p.InvalidLap is null)
            and (p.DeletedLap = 0 or p.DeletedLap is null)
            and p.LapTime is not null
        ) bestPassing
        where ${finishedSql}
          and r.ExpectedDateTime <= getdate()
          and (identity_matches.BestLapTime is not null or bestPassing.BestLapTime is not null)
          and (identity_matches.Number is null or identity_matches.Number not like '%test%')
      ), chosen_identity as (
        select
          PlateKey,
          case when max(case when MatchedBy = 'sensor' then 1 else 0 end) = 1 then 'sensor' else 'plate' end as MatchedBy
        from candidate_rows
        group by PlateKey
      ), ranked_rows as (
        select
          candidate_rows.*,
          row_number() over (
            partition by candidate_rows.PlateKey
            order by candidate_rows.ExpectedDateTime desc, candidate_rows.Id_Racing desc, candidate_rows.Id_RacingCompetitor desc
          ) as RowNumber
        from candidate_rows
        inner join chosen_identity
          on chosen_identity.PlateKey = candidate_rows.PlateKey
          and chosen_identity.MatchedBy = candidate_rows.MatchedBy
      )
      select
        ranked_rows.PlateKey as KartPlate,
        ranked_rows.Id_Racing,
        ranked_rows.Name,
        ranked_rows.RacingTypeName,
        ranked_rows.ExpectedDateTime,
        ranked_rows.RacingTrackName,
        ranked_rows.Id_RacingCompetitor,
        ranked_rows.Number,
        ranked_rows.Transponder,
        ranked_rows.Competitor,
        ranked_rows.BestLapTime,
        ranked_rows.Lap,
        ranked_rows.AvgLapTime,
        ranked_rows.MatchedBy
      from ranked_rows
      where ranked_rows.RowNumber <= 60
      order by ranked_rows.PlateKey, ranked_rows.ExpectedDateTime desc, ranked_rows.Id_Racing desc
    `);

    const grouped = new Map<string, KartHistoryItem[]>();
    for (const row of result.recordset) {
      const item = toHistoryItem(row);
      if (item.bestLapMs === null || !item.plate) continue;
      const current = grouped.get(item.plate) || [];
      current.push(item);
      grouped.set(item.plate, current);
    }

    return [...grouped.entries()]
      .map(([plate, rows]) => {
        const summary = buildKartHistorySummary(rows);
        return summary ? { ...summary, plate } : null;
      })
      .filter((summary): summary is KartHistorySummary => summary !== null)
      .sort((left, right) => Number(left.plate) - Number(right.plate));
  } finally {
    await pool.close().catch(() => undefined);
  }
}
