import { inferSessionTypeFromText } from '@/lib/livetime/session-type';
import type { LiveTimingDriver, LiveTimingSnapshot } from '@/lib/livetime/types';

type LapTimeApiOptions = {
  baseUrl: string;
  token: string;
  timeoutMs?: number;
};

type LapTimeEnvelope<T> = {
  success?: boolean;
  message?: string;
  data?: T;
};

type LapTimeRacing = Record<string, unknown> & {
  Id_Racing?: number;
  Name?: string;
  RacingState?: number;
  StartDateTime?: string;
  ExpectedDateTime?: string;
  racingtype?: { Name?: string };
  racingtrack?: { Name?: string };
  racinggroup?: { Name?: string };
  racingevent?: { Name?: string };
};

type LapTimeCompetitor = Record<string, unknown> & {
  Pos?: number;
  Number?: string | number;
  Transponder?: string | number;
  Competitor?: string;
  ShortName?: string;
  LapTime?: string;
  BestLapTime?: string;
  TotalTime?: string;
  Diff?: string;
  DiffLeader?: string;
  IsHidden?: boolean;
};

const RACING_STATES_TO_SCAN = [1, 2, 3, 4, 5, 6, 0, 7, 8, 9, 10];
const RACING_QUERY_LIMIT = 100;

function apiUrl(baseUrl: string, path: string): string {
  const normalizedBase = baseUrl.replace(/\/+$/, '');
  const normalizedPath = path.replace(/^\/+/, '');
  const apiPath = normalizedBase.toLowerCase().endsWith('/api')
    ? normalizedPath.replace(/^api\//i, '')
    : normalizedPath;
  return new URL(apiPath, `${normalizedBase}/`).toString();
}

type FetchJsonOptions = {
  /** LapTime returns HTTP 400 with { success: false } when a state has no rows. */
  allowEmptyHttp400?: boolean;
};

async function fetchJson<T>(url: string, token: string, timeoutMs: number, options: FetchJsonOptions = {}): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      cache: 'no-store',
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    });

    if (!response.ok) {
      if (response.status === 400 && options.allowEmptyHttp400) {
        const body = (await response.json().catch(() => null)) as LapTimeEnvelope<unknown> | null;
        if (body?.success === false) return [] as T;
      }

      throw new Error(`LapTime API HTTP ${response.status}`);
    }
    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

function asArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  return [];
}

function cell(value: unknown): string {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

export function formatLapTimeValue(value: unknown): string {
  const raw = cell(value);
  if (!raw) return '';

  const match = raw.match(/T(?<hours>\d{2}):(?<minutes>\d{2}):(?<seconds>\d{2})(?:\.(?<fraction>\d{1,6}))?/);
  if (!match?.groups) return raw;

  const hours = Number(match.groups.hours);
  const minutes = Number(match.groups.minutes);
  const seconds = match.groups.seconds;
  const millis = (match.groups.fraction || '').padEnd(3, '0').slice(0, 3);
  const totalMinutes = hours * 60 + minutes;

  return `${totalMinutes}:${seconds}${millis ? `.${millis}` : ''}`;
}

function driverTime(competitor: LapTimeCompetitor): string {
  return (
    formatLapTimeValue(competitor.BestLapTime) ||
    formatLapTimeValue(competitor.LapTime) ||
    formatLapTimeValue(competitor.TotalTime) ||
    formatLapTimeValue(competitor.Diff) ||
    formatLapTimeValue(competitor.DiffLeader)
  );
}

function toDriver(competitor: LapTimeCompetitor, index: number): LiveTimingDriver {
  const shortName = cell(competitor.ShortName);
  const competitorName = cell(competitor.Competitor);
  const name = shortName || competitorName;
  const team = shortName && competitorName && shortName.toUpperCase() !== competitorName.toUpperCase() ? competitorName : '';

  return {
    position: Number(competitor.Pos) > 0 ? Number(competitor.Pos) : index + 1,
    kart: cell(competitor.Number || competitor.Transponder),
    name: name.replace(/\s+/g, ' ').toUpperCase(),
    ...(team ? { team: team.replace(/\s+/g, ' ') } : {}),
    time: driverTime(competitor),
  };
}

function statusFromRacing(racing: LapTimeRacing | null, drivers: LiveTimingDriver[]): LiveTimingSnapshot['status'] {
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

async function fetchRacingsByState(options: LapTimeApiOptions, state: number, timeoutMs: number): Promise<LapTimeRacing[]> {
  const racingEnvelope = await fetchJson<LapTimeEnvelope<LapTimeRacing[]>>(
    apiUrl(options.baseUrl, `/api/Racing/getByState/${state}?qtd=${RACING_QUERY_LIMIT}`),
    options.token,
    timeoutMs,
    { allowEmptyHttp400: true },
  );

  return asArray<LapTimeRacing>(racingEnvelope.data);
}

async function fetchDriversByRacingId(options: LapTimeApiOptions, racingId: number, timeoutMs: number): Promise<LiveTimingDriver[]> {
  const competitorsEnvelope = await fetchJson<LapTimeEnvelope<LapTimeCompetitor[]>>(
    apiUrl(options.baseUrl, `/api/RacingCompetitor/ListResultByRacingId?idRacing=${encodeURIComponent(String(racingId))}`),
    options.token,
    timeoutMs,
  );

  return asArray<LapTimeCompetitor>(competitorsEnvelope.data)
    .filter((competitor) => !competitor.IsHidden)
    .map(toDriver)
    .filter((driver) => driver.position > 0 && (driver.kart || driver.name))
    .sort((a, b) => a.position - b.position)
    .slice(0, 30);
}

function driverScore(drivers: LiveTimingDriver[]): number {
  const kartCount = drivers.filter((driver) => driver.kart.trim()).length;
  return kartCount * 100 + drivers.length;
}

function racingSelectionType(racing: LapTimeRacing): LiveTimingSnapshot['sessionType'] {
  return inferSessionTypeFromText(cell(racing.racingtype?.Name) || cell(racing.Name));
}

function racingStartTimestamp(racing: LapTimeRacing): number {
  const value = cell(racing.StartDateTime) || cell(racing.ExpectedDateTime);
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

/**
 * The LapTime API returns the current event's qualifying row before its race row.
 * Prefer the running race, then the most recently started row, so an old
 * qualifying grid cannot hide the event leaderboard (for example 637100 vs 637101).
 */
function prioritizeRacings(racings: LapTimeRacing[]): LapTimeRacing[] {
  return [...racings].sort((left, right) => {
    const leftIsRace = racingSelectionType(left) === 'race' ? 1 : 0;
    const rightIsRace = racingSelectionType(right) === 'race' ? 1 : 0;
    if (leftIsRace !== rightIsRace) return rightIsRace - leftIsRace;

    const startDifference = racingStartTimestamp(right) - racingStartTimestamp(left);
    if (startDifference !== 0) return startDifference;

    return Number(right.Id_Racing || 0) - Number(left.Id_Racing || 0);
  });
}

async function fetchRacingWithDrivers(options: LapTimeApiOptions, timeoutMs: number): Promise<{ racing: LapTimeRacing | null; drivers: LiveTimingDriver[] }> {
  let best: { racing: LapTimeRacing; drivers: LiveTimingDriver[] } | null = null;

  for (const state of RACING_STATES_TO_SCAN) {
    const racings = prioritizeRacings(await fetchRacingsByState(options, state, timeoutMs));

    for (const racing of racings) {
      if (!racing?.Id_Racing) continue;

      const drivers = await fetchDriversByRacingId(options, racing.Id_Racing, timeoutMs);
      if (drivers.some((driver) => driver.kart.trim())) return { racing, drivers };

      if (drivers.length > 0 && (!best || driverScore(drivers) > driverScore(best.drivers))) {
        best = { racing, drivers };
      }
    }
  }

  return best || { racing: null, drivers: [] };
}

export async function fetchLapTimeApiSnapshot(options: LapTimeApiOptions): Promise<LiveTimingSnapshot> {
  const timeoutMs = options.timeoutMs || 3000;
  const { racing, drivers } = await fetchRacingWithDrivers(options, timeoutMs);

  if (!racing?.Id_Racing) {
    return {
      status: 'empty',
      source: 'rest',
      updatedAt: new Date().toISOString(),
      message: 'Nenhuma corrida aberta na API LapTime',
      drivers: [],
    };
  }

  const trackName = cell(racing.racingtrack?.Name);
  const typeName = cell(racing.racingtype?.Name);
  const displayRacingName = racingNameForDisplay(typeName, cell(racing.Name));
  const eventName = [cell(racing.racingevent?.Name), cell(racing.racinggroup?.Name), displayRacingName]
    .filter(Boolean)
    .join(' - ');

  return {
    status: statusFromRacing(racing, drivers),
    source: 'rest',
    updatedAt: new Date().toISOString(),
    sessionType: sessionTypeFromLapTime(typeName, eventName),
    eventName: eventName || undefined,
    trackName: trackName || undefined,
    drivers,
  };
}
