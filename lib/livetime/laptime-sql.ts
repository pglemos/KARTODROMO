import sql from 'mssql';
import { inferSessionTypeFromText } from '@/lib/livetime/session-type';
import { formatDurationMs, parseDurationMs } from '@/lib/livetime/time-format';
import type { LiveTimingDriver, LiveTimingSnapshot } from '@/lib/livetime/types';

export type LapTimeSqlOptions = {
  server: string;
  database: string;
  user: string;
  password: string;
  instanceName?: string;
  port?: number;
  timeoutMs?: number;
};

type SqlRacingRow = {
  Id_Racing: number;
  RacingState: number;
  Name?: string;
  RacingTypeName?: string;
  RacingGroupName?: string;
  RacingEventName?: string;
  RacingTrackName?: string;
};

type SqlCompetitorRow = {
  Pos?: number;
  Number?: string;
  Transponder?: number;
  Competitor?: string;
  ShortName?: string;
  LapTime?: unknown;
  BestLapTime?: unknown;
  TotalTime?: unknown;
  Diff?: unknown;
  DiffLeader?: unknown;
  IsHidden?: boolean;
};

const RACING_STATES_TO_SCAN = [1, 2, 3, 4, 5, 6, 0, 7, 8, 9, 10];

function clean(value: unknown): string {
  if (value === undefined || value === null) return '';
  return String(value).replace(/\s+/g, ' ').trim();
}

function formatSqlTime(value: unknown, moduloHour = false): string {
  if (value === undefined || value === null) return '';
  const raw = clean(value);
  const milliseconds = parseDurationMs(value);
  if (milliseconds === null) return raw;
  return formatDurationMs(milliseconds, { totalMinutes: moduloHour }) ?? raw;
}

function isZeroTime(value: unknown): boolean {
  const formatted = formatSqlTime(value);
  return !formatted || /^0:00(?:\.0+)?$/.test(formatted);
}

function driverTime(competitor: SqlCompetitorRow): string {
  if (!isZeroTime(competitor.DiffLeader)) return `+${formatSqlTime(competitor.DiffLeader, true)}`;
  if (!isZeroTime(competitor.Diff)) return `+${formatSqlTime(competitor.Diff, true)}`;
  return formatSqlTime(competitor.BestLapTime) || formatSqlTime(competitor.LapTime) || formatSqlTime(competitor.TotalTime);
}

function toDriver(competitor: SqlCompetitorRow, index: number): LiveTimingDriver {
  const registeredName = clean(competitor.Competitor) || clean(competitor.ShortName);

  return {
    position: Number(competitor.Pos) > 0 ? Number(competitor.Pos) : index + 1,
    kart: clean(competitor.Number || competitor.Transponder),
    name: registeredName.toUpperCase(),
    time: driverTime(competitor),
  };
}

function statusFromRacing(racing: SqlRacingRow | null, drivers: LiveTimingDriver[]): LiveTimingSnapshot['status'] {
  if (!racing) return 'empty';
  if (drivers.length === 0) return 'empty';
  return Number(racing.RacingState) === 6 ? 'finished' : 'live';
}

function sessionTypeFromLapTime(typeName: string, eventText: string): LiveTimingSnapshot['sessionType'] {
  const typeSession = inferSessionTypeFromText(typeName);
  return typeSession === 'unknown' ? inferSessionTypeFromText(eventText) : typeSession;
}

function racingNameForDisplay(typeName: string, racingName: string): string {
  const typeSession = inferSessionTypeFromText(typeName);
  const nameSession = inferSessionTypeFromText(racingName);

  if (typeSession !== 'unknown' && nameSession !== 'unknown' && typeSession !== nameSession) {
    return typeName;
  }

  return racingName || typeName;
}

function sqlConfig(options: LapTimeSqlOptions): sql.config {
  return {
    server: options.server,
    database: options.database,
    user: options.user,
    password: options.password,
    port: options.port,
    connectionTimeout: options.timeoutMs || 3000,
    requestTimeout: options.timeoutMs || 3000,
    pool: { max: 1, min: 0, idleTimeoutMillis: 30000 },
    options: {
      encrypt: false,
      trustServerCertificate: true,
      instanceName: options.instanceName,
    },
  };
}

async function fetchRacings(pool: sql.ConnectionPool): Promise<SqlRacingRow[]> {
  const stateValues = RACING_STATES_TO_SCAN.map((state) => `(${state})`).join(',');
  const result = await pool.request().query<SqlRacingRow>(`
    declare @states table (state int not null primary key);
    insert into @states (state) values ${stateValues};

    select top 100
      r.Id_Racing,
      r.RacingState,
      r.Name,
      rt.Name as RacingTypeName,
      rg.Name as RacingGroupName,
      re.Name as RacingEventName,
      tr.Name as RacingTrackName
    from dbo.Racing r with (nolock)
    left join dbo.RacingType rt with (nolock) on rt.Id_RacingType = r.Id_RacingType
    left join dbo.RacingGroup rg with (nolock) on rg.Id_RacingGroup = r.Id_RacingGroup
    left join dbo.RacingEvent re with (nolock) on re.Id_RacingEvent = r.Id_RacingEvent
    left join dbo.RacingTrack tr with (nolock) on tr.Id_RacingTrack = r.Id_RacingTrack
    where r.RacingState in (select state from @states)
    order by
      case when r.RacingState in (1,2,3,4) then 0 when r.RacingState = 5 then 1 when r.RacingState = 6 then 2 else 3 end,
      r.Id_Racing desc
  `);

  return result.recordset;
}

async function fetchDrivers(pool: sql.ConnectionPool, racingId: number): Promise<LiveTimingDriver[]> {
  const result = await pool
    .request()
    .input('racingId', sql.BigInt, racingId)
    .query<SqlCompetitorRow>(`
      select top 40
        Pos,
        Number,
        Transponder,
        Competitor,
        ShortName,
        LapTime,
        BestLapTime,
        TotalTime,
        Diff,
        DiffLeader,
        IsHidden
      from dbo.RacingCompetitor with (nolock)
      where Id_Racing = @racingId and (IsHidden = 0 or IsHidden is null)
      order by coalesce(Pos, 9999), Id_RacingCompetitor
    `);

  return result.recordset
    .map(toDriver)
    .filter((driver) => driver.position > 0 && driver.kart.trim() && driver.name.trim())
    .sort((a, b) => a.position - b.position)
    .slice(0, 60);
}

async function fetchRacingWithDrivers(pool: sql.ConnectionPool): Promise<{ racing: SqlRacingRow | null; drivers: LiveTimingDriver[] }> {
  const racings = await fetchRacings(pool);
  let best: { racing: SqlRacingRow; drivers: LiveTimingDriver[] } | null = null;

  for (const racing of racings) {
    const drivers = await fetchDrivers(pool, racing.Id_Racing);
    if (drivers.some((driver) => driver.kart.trim())) return { racing, drivers };
    if (drivers.length > 0 && (!best || drivers.length > best.drivers.length)) best = { racing, drivers };
  }

  return best || { racing: null, drivers: [] };
}

// Bandeiras que marcam o ENCERRAMENTO da corrida (a cronometragem aperta a "bandeira de
// encerramento"). Este LapTime nao usa RacingState=6; o fim e detectado pela bandeira da
// ultima passagem. 4=Finish, 5=bandeira de encerramento usada na operacao.
const FINISH_FLAG_IDS = (process.env.LAPTIME_FINISH_FLAG_IDS || '4,5')
  .split(',')
  .map((v) => Number(v.trim()))
  .filter((v) => Number.isInteger(v));

async function racingIsFinished(pool: sql.ConnectionPool, racingId: number): Promise<boolean> {
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

export async function fetchLapTimeSqlSnapshot(options: LapTimeSqlOptions): Promise<LiveTimingSnapshot> {
  const pool = new sql.ConnectionPool(sqlConfig(options));

  try {
    await pool.connect();
    const { racing, drivers } = await fetchRacingWithDrivers(pool);

    if (!racing?.Id_Racing) {
      return {
        status: 'empty',
        source: 'sql',
        updatedAt: new Date().toISOString(),
        message: 'Nenhuma corrida aberta no SQL LapTime',
        drivers: [],
      };
    }

    const typeName = clean(racing.RacingTypeName);
    const displayRacingName = racingNameForDisplay(typeName, clean(racing.Name));
    const eventName = [clean(racing.RacingEventName), clean(racing.RacingGroupName), displayRacingName].filter(Boolean).join(' - ');

    const finishedByFlag = drivers.length > 0 && (await racingIsFinished(pool, racing.Id_Racing));

    return {
      status: finishedByFlag ? 'finished' : statusFromRacing(racing, drivers),
      source: 'sql',
      updatedAt: new Date().toISOString(),
      sessionType: sessionTypeFromLapTime(typeName, eventName),
      eventName: eventName || undefined,
      trackName: clean(racing.RacingTrackName) || undefined,
      drivers,
    };
  } finally {
    await pool.close().catch(() => undefined);
  }
}
