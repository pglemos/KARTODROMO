import sql from 'mssql';
import {
  PIT_RULES,
  summarizePitStops,
  type PitCompetitorRow,
  type PitPassingRow,
} from '@/lib/livetime/laptime-pit-stops';
import type { LapTimeSqlOptions } from '@/lib/livetime/laptime-sql';
import type { LiveTimingPitStopStatus, LiveTimingPitSummary } from '@/lib/livetime/types';
import { formatDurationMs, parseDurationMs } from '@/lib/livetime/time-format';

export type LapTimeRacing = {
  id: string;
  nome: string;
  tipo: string | null;
  dataHora: string;
  inicio: string | null;
  estado: number;
  finalizada: boolean;
  participantes: number;
  situacao: 'finalizada' | 'em_andamento' | 'agendada';
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

export type LapTimeRacingLap = {
  id: string;
  volta: number | null;
  tempoVolta: string | null;
  tempoTotal: string | null;
  posicao: number | null;
  invalida: boolean;
  excluida: boolean;
  manual: boolean;
  bandeira: number | null;
};

export type LapTimeRacingLapsFilters = {
  limit?: number;
  offset?: number;
};

export type LapTimeRacingDetailLap = LapTimeRacingLap & {
  competitorId: string;
  kart: string | null;
  nome: string;
  parada: boolean;
  statusParada: LiveTimingPitStopStatus | null;
};

export type LapTimeRacingDetailStop = {
  competitorId: string;
  kart: string | null;
  nome: string;
  id: string;
  lap: number | null;
  stopTime: string | null;
  raceTime: string | null;
  position: number | null;
  status: LiveTimingPitStopStatus;
  mandatoryNumber?: number;
};

export type LapTimeRacingDetailCompetitor = LapTimeRacingCompetitor & {
  startPosition: number | null;
  positionRecovery: number | null;
  averageLap: string | null;
  worstLap: string | null;
  normalLaps: number;
  validLaps: number;
  invalidLaps: number;
  penaltyLaps: number | null;
  penaltyTime: string | null;
  stopAndGo: number | null;
  statusLabel: string;
  pitStops: LiveTimingPitSummary;
};

export type LapTimeRacingDetail = {
  race: LapTimeRacing & {
    evento: string | null;
    grupo: string | null;
    pista: string | null;
    encerradaEm: string | null;
    duracaoEncerramento: string | null;
    voltaFinal: number | null;
    tempoFinal: string | null;
    tipoEncerramento: number | null;
    tempoTotal: string | null;
    observacao: string | null;
  };
  competitors: LapTimeRacingDetailCompetitor[];
  stops: LapTimeRacingDetailStop[];
  laps: LapTimeRacingDetailLap[];
};

type RacingRow = {
  Id_Racing: number;
  Name: string | null;
  RacingTypeName: string | null;
  ExpectedDateTime: Date;
  StartDateTime: Date | null;
  RacingState: number;
  Participantes: number;
  EndTime?: Date | string | null;
  FinishLap?: number | null;
  IsFinished?: boolean | number;
  LastPassingFlag?: number | null;
};

type RacingCompetitorRow = {
  Id_RacingCompetitor: number | string;
  Pos: number | null;
  Number: string | null;
  Competitor: string | null;
  ShortName: string | null;
  Lap: number | null;
  BestLapTime: unknown;
  TotalTime: unknown;
  RacingStatus: number;
};

type PassingRow = {
  Id_Passing: number | string;
  Lap: number | null;
  LapTime: unknown;
  TotalTime: unknown;
  Pos: number | null;
  InvalidLap: boolean | null;
  DeletedLap: boolean | null;
  ManualLap: boolean;
  Id_RacingFlag: number | null;
};

type DetailRaceRow = RacingRow & {
  EndTime: Date | string | null;
  FinishLap: number | null;
  FinishTime: unknown;
  Id_EndType: number | null;
  TotalTime: unknown;
  Comment: string | null;
  RacingGroupName: string | null;
  RacingEventName: string | null;
  RacingTrackName: string | null;
  LastPassingTime: unknown;
  LastPassingLap: number | null;
};

type DetailCompetitorRow = PitCompetitorRow & {
  Id_Racing: number;
  BestLapTime: unknown;
  AvgLapTime: unknown;
  RacingStatus: number;
  IsHidden: boolean | null;
  Diff: unknown;
  DiffLeader: unknown;
  Finish: boolean | null;
};

type DetailPassingRow = PitPassingRow & Pick<PassingRow, 'ManualLap' | 'Id_RacingFlag'>;

const FINISH_FLAG_IDS = (process.env.LAPTIME_FINISH_FLAG_IDS || '4,5')
  .split(',')
  .map((value) => Number(value.trim()))
  .filter((value) => Number.isInteger(value));

const FINISH_FLAG_SQL = FINISH_FLAG_IDS.length ? FINISH_FLAG_IDS.join(',') : '4,5';

function clean(value: unknown): string {
  if (value === undefined || value === null) return '';
  return String(value).replace(/\s+/g, ' ').trim();
}

function millisecondsToText(milliseconds: number): string {
  return formatDurationMs(milliseconds) ?? '0:00.000';
}

function formatSqlTime(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const raw = clean(value);
  const milliseconds = parseDurationMs(value);
  return milliseconds === null ? raw || null : millisecondsToText(milliseconds);
}

export function isLapTimeRacingFinalized(
  state: number,
  lastPassingFlag: number | null | undefined,
  endTime?: Date | string | null,
  finishLap?: number | null,
): boolean {
  const hasEndTime = endTime !== null && endTime !== undefined && (parseDurationMs(endTime) ?? 0) > 0;
  return (
    Number(state) === 5 ||
    Number(state) === 6 ||
    hasEndTime ||
    (finishLap !== null && finishLap !== undefined && Number(finishLap) > 0) ||
    (lastPassingFlag !== null && lastPassingFlag !== undefined && FINISH_FLAG_IDS.includes(Number(lastPassingFlag)))
  );
}

function racingSituation(
  state: number,
  lastPassingFlag: number | null | undefined,
  startedAt: string | null,
  endTime?: Date | string | null,
  finishLap?: number | null,
): LapTimeRacing['situacao'] {
  if (isLapTimeRacingFinalized(state, lastPassingFlag, endTime, finishLap)) return 'finalizada';
  return startedAt ? 'em_andamento' : 'agendada';
}

function toRacing(row: RacingRow): LapTimeRacing {
  const inicio = row.StartDateTime ? row.StartDateTime.toISOString() : null;
  const endTime = inicio ? row.EndTime : null;
  const finalizada = Boolean(row.IsFinished) || isLapTimeRacingFinalized(row.RacingState, row.LastPassingFlag, endTime, row.FinishLap);

  return {
    id: String(row.Id_Racing),
    nome: row.Name?.trim() || 'Corrida',
    tipo: row.RacingTypeName?.trim() || null,
    dataHora: row.ExpectedDateTime.toISOString(),
    inicio,
    estado: row.RacingState,
    finalizada,
    participantes: row.Participantes,
    situacao: racingSituation(row.RacingState, row.LastPassingFlag, inicio, endTime, row.FinishLap),
  };
}

function toCompetitor(row: RacingCompetitorRow): LapTimeRacingCompetitor {
  return {
    id: String(row.Id_RacingCompetitor),
    posicao: row.Pos,
    numero: row.Number?.trim() || null,
    nome: clean(row.Competitor) || clean(row.ShortName) || 'Sem nome',
    voltas: row.Lap,
    melhorVolta: formatSqlTime(row.BestLapTime),
    tempoTotal: formatSqlTime(row.TotalTime),
    status: row.RacingStatus,
  };
}

function toLap(row: PassingRow): LapTimeRacingLap {
  return {
    id: String(row.Id_Passing),
    volta: row.Lap,
    tempoVolta: formatSqlTime(row.LapTime),
    tempoTotal: formatSqlTime(row.TotalTime),
    posicao: row.Pos,
    invalida: Boolean(row.InvalidLap),
    excluida: Boolean(row.DeletedLap),
    manual: Boolean(row.ManualLap),
    bandeira: row.Id_RacingFlag === null ? null : Number(row.Id_RacingFlag),
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
    const finishedSql = `(r.RacingState in (5, 6) or (r.StartDateTime is not null and r.EndTime is not null and convert(time, r.EndTime) > cast('00:00:00' as time)) or (r.FinishLap is not null and r.FinishLap > 0) or lastPassing.Id_RacingFlag in (${FINISH_FLAG_SQL}))`;
    if (filters.status === 'finalizada') conditions.push(finishedSql);
    if (filters.status === 'aberta') conditions.push(`not ${finishedSql}`);
    if (filters.from) conditions.push('r.ExpectedDateTime >= @from');
    if (filters.to) conditions.push('r.ExpectedDateTime <= @to');
    const whereSql = conditions.length ? `where ${conditions.join(' and ')}` : '';
    const fromSql = `
      from dbo.Racing r with (nolock)
      outer apply (
        select top 1 p.Id_RacingFlag
        from dbo.Passing p with (nolock)
        where p.Id_Racing = r.Id_Racing
        order by p.Id_Passing desc
      ) lastPassing
    `;

    const bind = (request: sql.Request) => {
      if (q) request.input('q', sql.NVarChar, `%${q}%`);
      if (filters.from) request.input('from', sql.DateTime, new Date(filters.from));
      if (filters.to) request.input('to', sql.DateTime, new Date(filters.to));
      return request;
    };

    const totalResult = await bind(pool.request()).query<{ c: number }>(
      `select count(*) as c ${fromSql} ${whereSql}`,
    );
    const total = totalResult.recordset[0]?.c ?? 0;

    const rowsResult = await bind(pool.request())
      .input('limit', sql.Int, limit)
      .input('offset', sql.Int, offset)
      .query<RacingRow>(`
        select
          r.Id_Racing, r.Name, rt.Name as RacingTypeName, r.ExpectedDateTime, r.StartDateTime, r.RacingState,
          r.EndTime, r.FinishLap,
          lastPassing.Id_RacingFlag as LastPassingFlag,
          case when ${finishedSql} then cast(1 as bit) else cast(0 as bit) end as IsFinished,
          (select count(*) from dbo.RacingCompetitor rc where rc.Id_Racing = r.Id_Racing and (rc.IsHidden = 0 or rc.IsHidden is null)) as Participantes
        ${fromSql}
        left join dbo.RacingType rt on rt.Id_RacingType = r.Id_RacingType
        ${whereSql}
        order by r.ExpectedDateTime desc, r.StartDateTime desc, r.Id_Racing desc
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

export async function fetchLapTimeRacingLaps(
  options: LapTimeSqlOptions,
  racingId: string,
  racingCompetitorId: string,
  filters: LapTimeRacingLapsFilters = {},
): Promise<{ rows: LapTimeRacingLap[]; total: number }> {
  const limit = Math.max(1, Math.min(200, filters.limit ?? 100));
  const offset = Math.max(0, filters.offset ?? 0);
  const pool = new sql.ConnectionPool(sqlConfig(options));

  try {
    await pool.connect();
    const request = pool
      .request()
      .input('racingId', sql.BigInt, Number(racingId))
      .input('racingCompetitorId', sql.BigInt, Number(racingCompetitorId));

    const totalResult = await request.query<{ c: number }>(`
      select count(*) as c
      from dbo.Passing with (nolock)
      where Id_Racing = @racingId and Id_RacingCompetitor = @racingCompetitorId
    `);
    const total = Number(totalResult.recordset[0]?.c ?? 0);

    const rowsResult = await pool
      .request()
      .input('racingId', sql.BigInt, Number(racingId))
      .input('racingCompetitorId', sql.BigInt, Number(racingCompetitorId))
      .input('limit', sql.Int, limit)
      .input('offset', sql.Int, offset)
      .query<PassingRow>(`
        select
          Id_Passing,
          Lap,
          LapTime,
          TotalTime,
          Pos,
          InvalidLap,
          DeletedLap,
          ManualLap,
          Id_RacingFlag
        from dbo.Passing with (nolock)
        where Id_Racing = @racingId and Id_RacingCompetitor = @racingCompetitorId
        order by coalesce(Lap, -1) desc, Id_Passing desc
        offset @offset rows fetch next @limit rows only
      `);

    return { rows: rowsResult.recordset.map(toLap), total };
  } finally {
    await pool.close().catch(() => undefined);
  }
}

function isoDate(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (date.getUTCFullYear() <= 1970) return null;
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function parseNumber(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function detailStatus(status: number, finish: boolean | null, laps: number | null): string {
  if (Number(status) === 2) return 'Desclassificado';
  if (finish) return 'Finalizado';
  if (!laps) return 'Não largou';
  return 'Classificado';
}

export async function fetchLapTimeRacingDetail(
  options: LapTimeSqlOptions,
  racingId: string,
): Promise<LapTimeRacingDetail | null> {
  const pool = new sql.ConnectionPool({
    ...sqlConfig(options),
    connectionTimeout: options.timeoutMs || 8_000,
    requestTimeout: Math.max(options.timeoutMs || 8_000, 30_000),
  });

  try {
    await pool.connect();
    const raceResult = await pool
      .request()
      .input('racingId', sql.BigInt, Number(racingId))
      .query<DetailRaceRow>(`
        select top 1
          r.Id_Racing,
          r.Name,
          r.RacingState,
          r.ExpectedDateTime,
          r.StartDateTime,
          r.EndTime,
          r.FinishLap,
          r.FinishTime,
          r.Id_EndType,
          r.TotalTime,
          r.Comment,
          rt.Name as RacingTypeName,
          rg.Name as RacingGroupName,
          re.Name as RacingEventName,
          tr.Name as RacingTrackName,
          lastPassing.Id_RacingFlag as LastPassingFlag,
          lastPassing.TotalTime as LastPassingTime,
          lastPassing.Lap as LastPassingLap,
          (select count(*) from dbo.RacingCompetitor rc with (nolock)
            where rc.Id_Racing = r.Id_Racing and (rc.IsHidden = 0 or rc.IsHidden is null)) as Participantes
        from dbo.Racing r with (nolock)
        left join dbo.RacingType rt with (nolock) on rt.Id_RacingType = r.Id_RacingType
        left join dbo.RacingGroup rg with (nolock) on rg.Id_RacingGroup = r.Id_RacingGroup
        left join dbo.RacingEvent re with (nolock) on re.Id_RacingEvent = r.Id_RacingEvent
        left join dbo.RacingTrack tr with (nolock) on tr.Id_RacingTrack = r.Id_RacingTrack
        outer apply (
          select top 1 p.Id_RacingFlag, p.TotalTime, p.Lap
          from dbo.Passing p with (nolock)
          where p.Id_Racing = r.Id_Racing
          order by p.Id_Passing desc
        ) lastPassing
        where r.Id_Racing = @racingId
      `);

    const race = raceResult.recordset[0];
    if (!race) return null;

    const competitorResult = await pool
      .request()
      .input('racingId', sql.BigInt, Number(racingId))
      .query<DetailCompetitorRow>(`
        select
          Id_RacingCompetitor,
          Id_Racing,
          Pos,
          Number,
          Transponder,
          Competitor,
          ShortName,
          Lap,
          TotalTime,
          BestLapTime,
          AvgLapTime,
          RacingStatus,
          IsHidden,
          StartPos,
          PenaltyTotalTime,
          PenaltyLap,
          StopAndGo,
          Finish
        from dbo.RacingCompetitor with (nolock)
        where Id_Racing = @racingId and (IsHidden = 0 or IsHidden is null)
        order by coalesce(Pos, 9999), Id_RacingCompetitor
      `);

    const passingResult = await pool
      .request()
      .input('racingId', sql.BigInt, Number(racingId))
      .query<DetailPassingRow>(`
        select
          Id_Passing,
          Id_RacingCompetitor,
          Lap,
          LapTime,
          TotalTime,
          Pos,
          InvalidLap,
          DeletedLap,
          ManualLap,
          Id_RacingFlag
        from dbo.Passing with (nolock)
        where Id_Racing = @racingId and Id_RacingCompetitor is not null
        order by Id_RacingCompetitor, coalesce(Lap, -1), Id_Passing
      `);

    const passingByCompetitor = new Map<string, DetailPassingRow[]>();
    for (const row of passingResult.recordset) {
      const key = String(row.Id_RacingCompetitor);
      const current = passingByCompetitor.get(key) || [];
      current.push(row);
      passingByCompetitor.set(key, current);
    }

    const allLaps: LapTimeRacingDetailLap[] = [];
    const allStops: LapTimeRacingDetailStop[] = [];
    const competitors = competitorResult.recordset.map((competitor) => {
      const competitorId = String(competitor.Id_RacingCompetitor);
      const rows = passingByCompetitor.get(competitorId) || [];
      const pitCompetitor: PitCompetitorRow = competitor;
      const pitStops = summarizePitStops(pitCompetitor, rows);
      const pitStopById = new Map(pitStops.stops.map((stop) => [stop.id, stop] as const));
      const orderedRows = [...rows].sort((left, right) => {
        const lapDifference = (left.Lap ?? Number.MAX_SAFE_INTEGER) - (right.Lap ?? Number.MAX_SAFE_INTEGER);
        return lapDifference || Number(left.Id_Passing) - Number(right.Id_Passing);
      });
      const firstPosition = orderedRows.find((row) => row.Pos !== null && Number(row.Pos) > 0)?.Pos ?? null;
      const startPosition = competitor.StartPos ?? firstPosition;
      const positionRecovery = startPosition !== null && competitor.Pos !== null ? startPosition - competitor.Pos : null;
      const normalLapTimes = rows
        .filter((row) => !row.InvalidLap && !row.DeletedLap)
        .map((row) => parseDurationMs(row.LapTime))
        .filter((value): value is number => value !== null && value > 0 && value < PIT_RULES.candidateStopMinMs);
      const invalidLaps = rows.filter((row) => Boolean(row.InvalidLap || row.DeletedLap)).length;
      const validLaps = rows.filter((row) => !row.InvalidLap && !row.DeletedLap && parseDurationMs(row.LapTime) !== null).length;
      const averageLap = normalLapTimes.length
        ? millisecondsToText(Math.round(normalLapTimes.reduce((total, value) => total + value, 0) / normalLapTimes.length))
        : null;
      const worstLap = normalLapTimes.length ? millisecondsToText(Math.max(...normalLapTimes)) : null;

      for (const row of rows) {
        const pitStop = pitStopById.get(String(row.Id_Passing));
        allLaps.push({
          ...toLap(row),
          competitorId,
          kart: clean(competitor.Number || competitor.Transponder) || null,
          nome: clean(competitor.Competitor) || clean(competitor.ShortName) || 'Sem nome',
          parada: Boolean(pitStop),
          statusParada: pitStop?.status || null,
        });
      }

      for (const stop of pitStops.stops) {
        allStops.push({
          competitorId,
          kart: pitStops.kart,
          nome: pitStops.name,
          ...stop,
        });
      }

      const sourcePenaltyLaps = parseNumber(competitor.PenaltyLap);
      return {
        ...toCompetitor(competitor),
        status: competitor.RacingStatus,
        startPosition,
        positionRecovery,
        averageLap,
        worstLap,
        normalLaps: normalLapTimes.length,
        validLaps,
        invalidLaps,
        penaltyLaps: Math.max(pitStops.penaltyLaps, sourcePenaltyLaps || 0),
        penaltyTime: formatSqlTime(competitor.PenaltyTotalTime),
        stopAndGo: competitor.StopAndGo ?? null,
        pitStops,
        statusLabel: detailStatus(competitor.RacingStatus, competitor.Finish, competitor.Lap),
      };
    });

    const lastTimedPassing = passingResult.recordset
      .filter((row) => row.TotalTime !== null && row.TotalTime !== undefined)
      .sort((left, right) => Number(right.Id_Passing) - Number(left.Id_Passing))[0];
    const maxRecordedLap = Math.max(
      0,
      ...competitors.map((competitor) => competitor.voltas ?? 0),
      ...passingResult.recordset.map((passing) => passing.Lap ?? 0),
    );
    const finalLap = race.FinishLap && race.FinishLap > 0
      ? race.FinishLap
      : Math.max(race.LastPassingLap ?? 0, lastTimedPassing?.Lap ?? 0, maxRecordedLap) || null;
    const finalTime = formatSqlTime(race.FinishTime) || formatSqlTime(race.TotalTime) || formatSqlTime(race.LastPassingTime) || formatSqlTime(lastTimedPassing?.TotalTime);
    const inicio = race.StartDateTime ? race.StartDateTime.toISOString() : null;
    const endTime = race.StartDateTime ? race.EndTime : null;
    const finalizada = Boolean(race.IsFinished) || isLapTimeRacingFinalized(race.RacingState, race.LastPassingFlag, endTime, race.FinishLap);
    const raceName = clean(race.Name) || 'Corrida';
    const raceType = clean(race.RacingTypeName) || null;
    const raceData: LapTimeRacingDetail['race'] = {
      id: String(race.Id_Racing),
      nome: raceName,
      tipo: raceType,
      dataHora: race.ExpectedDateTime.toISOString(),
      inicio,
      estado: race.RacingState,
      finalizada,
      participantes: Number(race.Participantes),
      situacao: racingSituation(race.RacingState, race.LastPassingFlag, inicio, endTime, race.FinishLap),
      evento: clean(race.RacingEventName) || null,
      grupo: clean(race.RacingGroupName) || null,
      pista: clean(race.RacingTrackName) || null,
      encerradaEm: isoDate(race.EndTime),
      duracaoEncerramento: formatSqlTime(race.EndTime),
      voltaFinal: finalLap,
      tempoFinal: finalTime,
      tipoEncerramento: race.Id_EndType ?? null,
      tempoTotal: formatSqlTime(race.TotalTime) || formatSqlTime(race.LastPassingTime),
      observacao: clean(race.Comment) || null,
    };

    return { race: raceData, competitors, stops: allStops, laps: allLaps };
  } finally {
    await pool.close().catch(() => undefined);
  }
}
