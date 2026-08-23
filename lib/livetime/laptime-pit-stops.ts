import sql from 'mssql';
import type {
  LiveTimingPitStop,
  LiveTimingPitSummary,
  LiveTimingRace,
} from '@/lib/livetime/types';
import type { LapTimeSqlOptions } from '@/lib/livetime/laptime-sql';
import { formatDurationMs, parseDurationMs } from '@/lib/livetime/time-format';

export type LapTimeRacingPitSummary = LiveTimingPitSummary & {
  competitorId: string;
  kart: string | null;
  name: string;
  position: number | null;
};

export type LapTimeRacingPitData = {
  race: LiveTimingRace;
  summaries: LapTimeRacingPitSummary[];
};

type PitRaceRow = {
  Id_Racing: number;
  Name: string | null;
  RacingTypeName: string | null;
  RacingState: number;
  StartDateTime: Date | string | null;
};

export type PitCompetitorRow = {
  Id_RacingCompetitor: number | string;
  Pos: number | null;
  Number: string | null;
  Transponder: string | number | null;
  Competitor: string | null;
  ShortName: string | null;
  Lap: number | null;
  TotalTime: unknown;
  StartPos?: number | null;
  PenaltyTotalTime?: unknown;
  PenaltyLap?: number | null;
  StopAndGo?: number | null;
};

export type PitPassingRow = {
  Id_Passing: number | string;
  Id_RacingCompetitor: number | string | null;
  Lap: number | null;
  LapTime: unknown;
  TotalTime: unknown;
  Pos: number | null;
  InvalidLap: boolean | null;
  DeletedLap: boolean | null;
};

export const PIT_RULES = {
  requiredStops: 11,
  minimumStopMs: 7 * 60 * 1_000,
  additionalStopsAllowed: 4,
  candidateStopMinMs: 4 * 60 * 1_000,
  penaltyLapsPerStop: 7,
  boxOpenAfterMs: 10 * 60 * 1_000,
  boxCloseAfterMs: (11 * 60 + 40) * 60 * 1_000,
} as const;

function clean(value: unknown): string {
  if (value === undefined || value === null) return '';
  return String(value).replace(/\s+/g, ' ').trim();
}

function isoDate(value: Date | string | null): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function millisecondsToText(milliseconds: number): string {
  return formatDurationMs(milliseconds) ?? '0:00.000';
}

function formatSqlTime(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const raw = clean(value);
  if (!raw) return null;
  const milliseconds = parseDurationMs(value);
  return milliseconds === null ? raw : millisecondsToText(milliseconds);
}

function parseTimeMs(value: unknown): number | null {
  return parseDurationMs(formatSqlTime(value));
}

export function pitStopEntryTimeMs(raceTimeMs: number | null, stopDurationMs: number | null): number | null {
  if (raceTimeMs === null) return null;
  if (stopDurationMs === null || stopDurationMs <= 0) return raceTimeMs;
  return raceTimeMs - stopDurationMs;
}

export function isPitStopInsideBoxWindow(raceTimeMs: number | null, stopDurationMs: number | null): boolean {
  const entryTimeMs = pitStopEntryTimeMs(raceTimeMs, stopDurationMs);

  return (
    entryTimeMs === null ||
    (entryTimeMs >= PIT_RULES.boxOpenAfterMs && entryTimeMs <= PIT_RULES.boxCloseAfterMs)
  );
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

function emptySummary(competitor: PitCompetitorRow): LapTimeRacingPitSummary {
  return {
    competitorId: String(competitor.Id_RacingCompetitor),
    kart: clean(competitor.Number || competitor.Transponder) || null,
    name: clean(competitor.Competitor) || clean(competitor.ShortName) || 'Sem nome',
    position: competitor.Pos,
    required: PIT_RULES.requiredStops,
    minimumStopMs: PIT_RULES.minimumStopMs,
    currentLap: competitor.Lap,
    currentRaceTime: formatSqlTime(competitor.TotalTime),
    currentRaceTimeMs: parseTimeMs(competitor.TotalTime),
    mandatory: 0,
    remaining: PIT_RULES.requiredStops,
    short: 0,
    total: 0,
    additional: 0,
    excess: 0,
    penaltyLaps: PIT_RULES.requiredStops * PIT_RULES.penaltyLapsPerStop,
    outsideWindow: 0,
    stops: [],
  };
}

export function summarizePitStops(
  competitor: PitCompetitorRow,
  rows: PitPassingRow[],
): LapTimeRacingPitSummary {
  const summary = emptySummary(competitor);
  let mandatory = 0;

  const stops = rows
    .filter((row) => (parseTimeMs(row.LapTime) ?? 0) >= PIT_RULES.candidateStopMinMs)
    .sort((left, right) => {
      const lapDifference = (left.Lap ?? Number.MAX_SAFE_INTEGER) - (right.Lap ?? Number.MAX_SAFE_INTEGER);
      return lapDifference || Number(left.Id_Passing) - Number(right.Id_Passing);
    })
    .map<LiveTimingPitStop>((row) => {
      const stopMs = parseTimeMs(row.LapTime);
      const raceTimeMs = parseTimeMs(row.TotalTime);
      const outsideWindow = !isPitStopInsideBoxWindow(raceTimeMs, stopMs);
      const invalid = Boolean(row.InvalidLap || row.DeletedLap);

      if (outsideWindow) {
        summary.outsideWindow += 1;
        return {
          id: String(row.Id_Passing),
          lap: row.Lap,
          stopTime: formatSqlTime(row.LapTime),
          raceTime: formatSqlTime(row.TotalTime),
          position: row.Pos,
          status: 'outside-window',
        };
      }

      if (invalid || stopMs === null) {
        return {
          id: String(row.Id_Passing),
          lap: row.Lap,
          stopTime: formatSqlTime(row.LapTime),
          raceTime: formatSqlTime(row.TotalTime),
          position: row.Pos,
          status: 'invalid',
        };
      }

      if (stopMs >= PIT_RULES.minimumStopMs) {
        mandatory += 1;
        if (mandatory <= PIT_RULES.requiredStops) {
          return {
            id: String(row.Id_Passing),
            lap: row.Lap,
            stopTime: formatSqlTime(row.LapTime),
            raceTime: formatSqlTime(row.TotalTime),
            position: row.Pos,
            status: 'mandatory',
            mandatoryNumber: mandatory,
          };
        }

        return {
          id: String(row.Id_Passing),
          lap: row.Lap,
          stopTime: formatSqlTime(row.LapTime),
          raceTime: formatSqlTime(row.TotalTime),
          position: row.Pos,
          status: 'additional',
        };
      }

      summary.short += 1;
      return {
        id: String(row.Id_Passing),
        lap: row.Lap,
        stopTime: formatSqlTime(row.LapTime),
        raceTime: formatSqlTime(row.TotalTime),
        position: row.Pos,
        status: 'short',
      };
    });

  const total = stops.filter((stop) => stop.status === 'mandatory' || stop.status === 'additional' || stop.status === 'short').length;
  summary.mandatory = mandatory;
  summary.remaining = Math.max(0, PIT_RULES.requiredStops - mandatory);
  summary.total = total;
  summary.additional = Math.max(0, total - PIT_RULES.requiredStops);
  summary.excess = Math.max(0, total - PIT_RULES.requiredStops - PIT_RULES.additionalStopsAllowed);
  summary.penaltyLaps = (summary.remaining + summary.excess) * PIT_RULES.penaltyLapsPerStop;
  summary.stops = stops;
  return summary;
}

export async function fetchLapTimeCurrentPitData(
  options: LapTimeSqlOptions,
): Promise<LapTimeRacingPitData | null> {
  const pool = new sql.ConnectionPool(sqlConfig(options));

  try {
    await pool.connect();
    const raceResult = await pool.request().query<PitRaceRow>(`
      select top 1
        r.Id_Racing,
        r.Name,
        rt.Name as RacingTypeName,
        r.RacingState,
        r.StartDateTime
      from dbo.Racing r with (nolock)
      left join dbo.RacingType rt with (nolock) on rt.Id_RacingType = r.Id_RacingType
      where r.RacingState in (1, 2, 3, 4, 5, 6)
      order by
        case when r.RacingState in (1, 2, 3, 4) then 0 when r.RacingState = 5 then 1 else 2 end,
        case when upper(coalesce(r.Name, '')) like '%500 MILHAS%' then 0 else 1 end,
        coalesce(r.StartDateTime, r.ExpectedDateTime) desc,
        r.Id_Racing desc
    `);

    const race = raceResult.recordset[0];
    if (!race?.Id_Racing) return null;

    const competitorResult = await pool
      .request()
      .input('racingId', sql.BigInt, Number(race.Id_Racing))
      .query<PitCompetitorRow>(`
        select
          Id_RacingCompetitor,
          Pos,
          Number,
          Transponder,
          Competitor,
          ShortName,
          Lap,
          TotalTime
        from dbo.RacingCompetitor with (nolock)
        where Id_Racing = @racingId and (IsHidden = 0 or IsHidden is null)
        order by coalesce(Pos, 9999), Id_RacingCompetitor
      `);

    const passingResult = await pool
      .request()
      .input('racingId', sql.BigInt, Number(race.Id_Racing))
      .query<PitPassingRow>(`
        select
          Id_Passing,
          Id_RacingCompetitor,
          Lap,
          LapTime,
          TotalTime,
          Pos,
          InvalidLap,
          DeletedLap
        from dbo.Passing with (nolock)
        where Id_Racing = @racingId
          and Id_RacingCompetitor is not null
          and LapTime >= '00:04:00'
        order by Id_RacingCompetitor, coalesce(Lap, -1), Id_Passing
      `);

    const rowsByCompetitor = new Map<string, PitPassingRow[]>();
    for (const row of passingResult.recordset) {
      const key = String(row.Id_RacingCompetitor);
      const rows = rowsByCompetitor.get(key) || [];
      rows.push(row);
      rowsByCompetitor.set(key, rows);
    }

    const competitors = [...competitorResult.recordset];
    for (const [competitorId] of rowsByCompetitor) {
      if (!competitors.some((competitor) => String(competitor.Id_RacingCompetitor) === competitorId)) {
        competitors.push({
          Id_RacingCompetitor: competitorId,
          Pos: null,
          Number: null,
          Transponder: null,
          Competitor: null,
          ShortName: null,
          Lap: null,
          TotalTime: null,
        });
      }
    }

    const summaries = competitors
      .map((competitor) => summarizePitStops(competitor, rowsByCompetitor.get(String(competitor.Id_RacingCompetitor)) || []))
      .sort((left, right) => (left.position ?? 9999) - (right.position ?? 9999));

    return {
      race: {
        id: String(race.Id_Racing),
        name: clean(race.Name) || 'Sessão ao vivo',
        type: clean(race.RacingTypeName) || null,
        state: Number(race.RacingState),
        startedAt: isoDate(race.StartDateTime),
        rules: PIT_RULES,
      },
      summaries,
    };
  } finally {
    await pool.close().catch(() => undefined);
  }
}
