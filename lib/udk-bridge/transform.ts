// Transformação de dados LapTime (Racing + RacingCompetitor) em payloads UDK.
// Funções puras: nenhum I/O, fáceis de testar.
import type {
  LapTimeCompetitorRow,
  LapTimeRacingFull,
  LapTimeRacingRow,
  UdkBridgeConfig,
  UdkResultDraft,
  UdkResultEntryDraft,
} from '@/lib/udk-bridge/types';

const MS_PER_SECOND = 1000;

// Converte um datetime SQL (1970-01-01T00:01:21.662Z) em milissegundos de
// tempo de volta. O LapTime guarda tempos como datetime com base em 1970-01-01.
export function lapTimeToMillis(value: Date | string | null | undefined): number | null {
  if (value == null) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const hours = date.getUTCHours();
  const minutes = date.getUTCMinutes();
  const seconds = date.getUTCSeconds();
  const millis = date.getUTCMilliseconds();
  return (hours * 3600 + minutes * 60 + seconds) * MS_PER_SECOND + millis;
}

export function racingTypeToSessionKind(typeId: number | undefined, name?: string): 'race' | 'qualifying' | 'practice' {
  const normalized = (name || '').toLowerCase();
  if (typeId === 4 || normalized.includes('corrida') || normalized.includes('final')) return 'race';
  if (typeId === 3 || normalized.includes('classificat')) return 'qualifying';
  if (typeId === 1 || typeId === 2) return 'practice';
  return 'race';
}

export function entryStatusFromCompetitor(competitor: LapTimeCompetitorRow): UdkResultEntryDraft['status'] {
  const position = Number(competitor.Pos);
  const laps = Number(competitor.Lap);
  if (competitor.RacingStatus === 2) return 'disqualified';
  if (position > 0 && laps > 0) return 'classified';
  if (position === 0 && laps > 0) return 'not_classified';
  if (laps === 0) return 'did_not_finish';
  return 'not_classified';
}

export function competitorDisplayName(competitor: LapTimeCompetitorRow): string {
  // Prioriza o nome completo; ShortName (sigla) é só fallback.
  const name = competitor.Competitor?.trim() || competitor.ShortName?.trim();
  return (name || `#${competitor.Number || competitor.Transponder || competitor.Id_RacingCompetitor}`).toUpperCase();
}

// Membros de equipe em corridas endurance: Name2..Name6 preenchidos.
export function enduranceCoDrivers(competitor: LapTimeCompetitorRow): string[] {
  return [competitor.Name2, competitor.Name3, competitor.Name4, competitor.Name5, competitor.Name6]
    .map((name) => (name || '').trim())
    .filter(Boolean);
}

export function fastestLapMillis(competitors: LapTimeCompetitorRow[]): number | null {
  const bests = competitors
    .map((c) => lapTimeToMillis(c.BestLapTime))
    .filter((value): value is number => value != null && value > 0);
  return bests.length ? Math.min(...bests) : null;
}

export function fastestLapCompetitorId(competitors: LapTimeCompetitorRow[]): number | null {
  let best: { id: number; time: number } | null = null;
  for (const competitor of competitors) {
    const time = lapTimeToMillis(competitor.BestLapTime);
    if (time == null || time <= 0) continue;
    if (!best || time < best.time) best = { id: competitor.Id_RacingCompetitor, time };
  }
  return best?.id ?? null;
}

export function totalTimeMillis(competitor: LapTimeCompetitorRow): number | null {
  const value = lapTimeToMillis(competitor.TotalTime);
  if (value == null || value <= 0) return null;
  // Tempos de corrida podem cruzar a meia-noite; TotalTime vem como datetime do
  // dia do evento. Se for menor que o melhor tempo, é improvável: descarta.
  return value;
}

export function buildResultDraft(race: LapTimeRacingRow, config: UdkBridgeConfig, version = 1): UdkResultDraft {
  const typeName = race.RacingTypeName || '';
  const kind = racingTypeToSessionKind(race.Id_RacingType, typeName);
  const stage = Object.values(config.stages)[0];
  const session = stage?.find((s) => s.kind === (kind === 'practice' ? 'endurance' : kind)) ?? stage?.[0] ?? null;

  const title = [
    race.RacingGroupName || '',
    race.Name || typeName,
    race.RacingEventName ? `(${race.RacingEventName})` : '',
  ]
    .filter(Boolean)
    .join(' ');

  return {
    stage_id: Object.keys(config.stages)[0],
    session_id: session?.sessionId ?? null,
    category_id: null,
    title: title.trim() || `Corrida LapTime ${race.Id_Racing}`,
    status: 'draft',
    version,
    source_system: 'laptime',
    external_racing_id: race.Id_Racing,
    external_imported_at: new Date().toISOString(),
    fastest_lap_ms: null,
  };
}

export function buildEntriesDraft(competitors: LapTimeCompetitorRow[]): UdkResultEntryDraft[] {
  return competitors
    .filter((competitor) => !competitor.IsHidden)
    .filter((competitor) => Number(competitor.Pos) > 0 || Number(competitor.Lap) > 0)
    .map((competitor) => ({
      driver_id: '',
      driver_name: competitorDisplayName(competitor),
      position: Number(competitor.Pos),
      kart_number: competitor.Number ? Number(competitor.Number) || null : null,
      laps: Number(competitor.Lap) || 0,
      total_time_ms: totalTimeMillis(competitor),
      best_lap_ms: lapTimeToMillis(competitor.BestLapTime),
      penalty_ms: lapTimeToMillis(competitor.PenaltyTotalTime),
      status: entryStatusFromCompetitor(competitor),
      external_competitor_id: competitor.Id_RacingCompetitor,
    }))
    .sort((a, b) => a.position - b.position);
}

// Candidata a melhor volta: usa Id_RacingCompetitor para marcar fastest_lap.
export function markFastestLap(
  entries: UdkResultEntryDraft[],
  competitors: LapTimeCompetitorRow[],
): UdkResultEntryDraft[] {
  const fastestId = fastestLapCompetitorId(competitors);
  if (fastestId == null) return entries;
  return entries.map((entry) => ({
    ...entry,
    fastest_lap: entry.external_competitor_id === fastestId,
  }));
}

export function racingFinished(race: LapTimeRacingRow): boolean {
  return Number(race.RacingState) === 5 || Number(race.RacingState) === 6;
}

export function enduranceRacing(competitors: LapTimeCompetitorRow[]): boolean {
  return competitors.some((competitor) => enduranceCoDrivers(competitor).length > 0);
}

export function bridgeSummary(race: LapTimeRacingFull, config: UdkBridgeConfig): Record<string, unknown> {
  return {
    racingId: race.racing.Id_Racing,
    name: race.racing.Name,
    group: race.racing.RacingGroupName,
    event: race.racing.RacingEventName,
    competitors: race.competitors.length,
    endurance: enduranceRacing(race.competitors),
    finishedByFlag: race.finishedByFlag,
    championshipId: config.championshipId,
    seasonId: config.seasonId,
  };
}