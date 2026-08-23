// Leitura de corridas ULTRAS no SQL LapTime (mirror local ou CRONO1).
// Só expõe corridas que passaram no filtro isUltrasRacing e que terminaram.
import sql from 'mssql';
import { matchUltrasRacing, ultrasFilterSummary } from '@/lib/livetime/ultras-filter';
import { racingTypeToSessionKind } from '@/lib/udk-bridge/transform';
import type { UltrasFilterOptions } from '@/lib/livetime/ultras-filter';
import type { LapTimeCompetitorRow, LapTimeRacingFull, LapTimeRacingRow } from '@/lib/udk-bridge/types';

export type LapTimeSqlSource = {
  server: string;
  database: string;
  user: string;
  password: string;
  instanceName?: string;
  port?: number;
  timeoutMs?: number;
};

type RacingWithNames = LapTimeRacingRow & {
  RacingTypeName?: string;
  RacingGroupName?: string;
  RacingEventName?: string;
  RacingTrackName?: string;
};

type CompetitorRow = LapTimeCompetitorRow & {
  Number?: string;
  Transponder?: number;
};

const FINISH_FLAG_IDS = (process.env.LAPTIME_FINISH_FLAG_IDS || '4,5')
  .split(',')
  .map((v) => Number(v.trim()))
  .filter((v) => Number.isInteger(v));

function sqlConfig(options: LapTimeSqlSource): sql.config {
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

async function fetchFinishedRacings(pool: sql.ConnectionPool, filterOptions: UltrasFilterOptions): Promise<RacingWithNames[]> {
  const result = await pool.request().query<RacingWithNames>(`
    select top 50
      r.Id_Racing,
      r.RacingState,
      r.Name,
      r.Id_RacingType,
      rt.Name as RacingTypeName,
      r.Id_RacingGroup,
      rg.Name as RacingGroupName,
      r.Id_RacingEvent,
      re.Name as RacingEventName,
      r.Id_RacingTrack,
      tr.Name as RacingTrackName,
      r.ExpectedDateTime,
      r.StartDateTime,
      r.EndTime,
      r.Id_EndType,
      r.FinishLap,
      r.FinishTime,
      r.Id_Booking,
      r.TotalTime
    from dbo.Racing r with (nolock)
    left join dbo.RacingType rt with (nolock) on rt.Id_RacingType = r.Id_RacingType
    left join dbo.RacingGroup rg with (nolock) on rg.Id_RacingGroup = r.Id_RacingGroup
    left join dbo.RacingEvent re with (nolock) on re.Id_RacingEvent = r.Id_RacingEvent
    left join dbo.RacingTrack tr with (nolock) on tr.Id_RacingTrack = r.Id_RacingTrack
    where r.RacingState in (5, 6)
    order by r.Id_Racing desc
  `);

  const summary = ultrasFilterSummary(filterOptions);
  const accepted: RacingWithNames[] = [];
  const rejected: string[] = [];

  for (const racing of result.recordset) {
    const candidate = {
      id: racing.Id_Racing,
      racingGroupId: racing.Id_RacingGroup,
      racingEventId: racing.Id_RacingEvent,
      racingTypeId: racing.Id_RacingType,
      state: racing.RacingState,
      name: racing.Name,
      groupName: racing.RacingGroupName,
      eventName: racing.RacingEventName,
    };
    const match = matchUltrasRacing(candidate, filterOptions);
    const isRace = racingTypeToSessionKind(racing.Id_RacingType, racing.RacingTypeName) === 'race';
    if (isRace && (match.kind === 'id' || (match.kind === 'text' && filterOptions.allowTextOnly))) {
      accepted.push(racing);
    } else if (!isRace) {
      rejected.push(`#${racing.Id_Racing} (${racing.RacingGroupName || '-'}): sessão não é corrida (${racing.RacingTypeName || '?'})`);
    } else {
      rejected.push(`#${racing.Id_Racing} (${racing.RacingGroupName || '-'}): ${match.reason}`);
    }
  }

  console.log(`[udk-bridge] filtro ULTRAS (${summary}): aceitas=${accepted.length}, rejeitadas=${rejected.length} nas últimas 50 finalizadas`);
  for (const reason of rejected) console.log(`[udk-bridge]   rejeitada ${reason}`);

  return accepted;
}

async function fetchCompetitors(pool: sql.ConnectionPool, racingId: number): Promise<CompetitorRow[]> {
  const result = await pool
    .request()
    .input('racingId', sql.BigInt, racingId)
    .query<CompetitorRow>(`
      select
        Id_RacingCompetitor,
        Id_Racing,
        Id_Category,
        Number,
        Transponder,
        Competitor,
        ShortName,
        Email,
        Pos,
        Lap,
        LapTime,
        BestLapTime,
        TotalTime,
        DiffLeader,
        Diff,
        AvgLapTime,
        AvgSpeedRacing,
        StartPos,
        RacingStatus,
        IsHidden,
        Finish,
        BookingCustomerUId,
        PenaltyTotalTime,
        PenaltyLap,
        Transponder2, Name2, Transponder3, Name3, Transponder4, Name4,
        Transponder5, Name5, Transponder6, Name6
      from dbo.RacingCompetitor with (nolock)
      where Id_Racing = @racingId
      order by coalesce(Pos, 9999), Id_RacingCompetitor
    `);

  return result.recordset;
}

async function racingFinishedByFlag(pool: sql.ConnectionPool, racingId: number): Promise<boolean> {
  try {
    const result = await pool
      .request()
      .input('racingId', sql.BigInt, racingId)
      .query<{ Id_RacingFlag: number | null }>(`
        select top 1 Id_RacingFlag
        from dbo.Passing with (nolock)
        where Id_Racing = @racingId
        order by Id_Passing desc
      `);
    const flag = result.recordset[0]?.Id_RacingFlag;
    return flag != null && FINISH_FLAG_IDS.includes(Number(flag));
  } catch {
    return false;
  }
}

export async function fetchFinishedUltrasRacings(
  source: LapTimeSqlSource,
  filterOptions: UltrasFilterOptions = {},
): Promise<LapTimeRacingFull[]> {
  const pool = new sql.ConnectionPool(sqlConfig(source));
  const full: LapTimeRacingFull[] = [];

  try {
    await pool.connect();
    const racings = await fetchFinishedRacings(pool, filterOptions);

    for (const racing of racings) {
      const competitors = await fetchCompetitors(pool, racing.Id_Racing);
      const finishedByFlag = await racingFinishedByFlag(pool, racing.Id_Racing);
      full.push({ racing, competitors, finishedByFlag });
    }

    return full;
  } finally {
    await pool.close().catch(() => undefined);
  }
}