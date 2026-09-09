import { parseDurationMs } from '../livetime/time-format';
import { lapTimeToMillis, normalizeDriverName } from './live-stage-utils';

const CATEGORY_SLUGS = ['insanos', 'rapidos'] as const;
const FINISH_FLAG_IDS = new Set([4, 5]);
const NON_NAME_TOKENS = new Set(['de', 'da', 'do', 'dos', 'das', 'e', 'i']);

export type StageBinding = {
  stageId: string;
  seasonId: string;
  title: string;
  races: { racingId: number; groupId: number; sessionId: string; label: string }[];
  /** Slugs are deliberately explicit so another active category cannot enter the result. */
  categorySlugs?: string[];
  /** LapTime display name -> UDK driver id, full name, or sport name. */
  aliases?: Record<string, string>;
};

export type StageDriver = {
  id: string;
  full_name: string;
  sport_name: string | null;
  category_id: string;
};

export type StageCompetitor = {
  Id_RacingCompetitor: number;
  Competitor: string;
  Number: string | number | null;
  Pos: number;
  Lap: number;
  BestLapTime: Date | string | null;
  TotalTime: Date | string | null;
  PenaltyTotalTime: Date | string | null;
  PenaltyLap?: number | string | null;
  StopAndGo?: number | string | null;
  StartPos: number;
  RacingStatus: number;
  IsHidden: boolean | null;
};

export type StageRace = {
  racingId: number;
  groupId: number;
  state: number;
  startedAt?: Date | string | null;
  endTime?: Date | string | null;
  finishLap?: number | null;
  lastPassingFlag?: number | null;
  isFinished?: boolean | number | null;
  competitors: StageCompetitor[];
};

export type StageRule = {
  position_points: Record<string, number>;
  pole_points: number;
  fastest_lap_points: number;
};

export type StageCategory = { id: string; name: string; slug: string };

export type StageHeatEntry = {
  driverId: string;
  name: string;
  categoryId: string;
  externalCompetitorId: number;
  kart: string | null;
  position: number | null;
  laps: number;
  bestLapMs: number | null;
  totalTimeMs: number | null;
  /** Copied from LapTime. No local penalty calculation is performed. */
  penaltyMs: number | null;
  penaltyLaps: number | null;
  stopAndGo: number | null;
  pole: boolean;
  fastestLap: boolean;
  status: 'disqualified' | 'classified' | 'not_classified';
  points: number | null;
};

export type StageHeat = StageBinding['races'][number] & {
  state: 'scheduled' | 'live' | 'finished';
  entries: StageHeatEntry[];
};

export type StageClassificationRow = {
  driverId: string;
  name: string;
  racePoints: Array<number | null>;
  total: number | null;
  position: number | null;
};

export type StageCategoryClassification = StageCategory & {
  rows: StageClassificationRow[];
};

export type StageSnapshot = {
  stageId: string;
  title: string;
  source: 'LapTime';
  provisional: boolean;
  complete: boolean;
  points: {
    baseWinnerPerRace: 50;
    baseMaximum: 100;
    positionPoints: Record<string, number>;
    pole: number;
    fastestLap: number;
  };
  unresolved: string[];
  heats: StageHeat[];
  categories: StageCategoryClassification[];
};

function durationToMillis(value: Date | string | null | undefined): number | null {
  if (value == null) return null;
  return parseDurationMs(value) ?? lapTimeToMillis(value);
}

function normalizedAliasMap(aliases: Record<string, string> = {}): Map<string, string> {
  return new Map(
    Object.entries(aliases)
      .map(([name, target]) => [normalizeDriverName(name), target] as const)
      .filter(([name, target]) => Boolean(name && target)),
  );
}

function driverDisplayNames(driver: StageDriver): string[] {
  return [driver.full_name, driver.sport_name || ''].filter(Boolean);
}

function findAliasDriver(target: string, drivers: StageDriver[]): StageDriver | null {
  const normalizedTarget = normalizeDriverName(target);
  const matches = drivers.filter(
    (driver) => driver.id === target || driverDisplayNames(driver).some((name) => normalizeDriverName(name) === normalizedTarget),
  );
  return matches.length === 1 ? matches[0] : null;
}

function meaningfulTokens(value: string): string[] {
  return normalizeDriverName(value)
    .split(' ')
    .filter((token) => token && !NON_NAME_TOKENS.has(token));
}

// Kart numbers can change between heats; only the pilot identity determines the total.
export function resolveStageDriver(
  name: string,
  drivers: StageDriver[],
  aliases: Record<string, string> = {},
): StageDriver | null {
  const normalized = normalizeDriverName(name);
  if (!normalized) return null;

  const aliasTarget = normalizedAliasMap(aliases).get(normalized);
  if (aliasTarget) return findAliasDriver(aliasTarget, drivers);

  const exact = drivers.filter((driver) =>
    driverDisplayNames(driver).some((value) => normalizeDriverName(value) === normalized),
  );
  if (exact.length === 1) return exact[0];
  if (exact.length > 1) return null;

  // A shortened LapTime name is safe only when every meaningful token from a
  // UDK name is present and the candidate has at least two tokens. Single-word
  // names are intentionally kept behind an explicit alias to avoid collisions.
  const sourceTokens = new Set(meaningfulTokens(normalized));
  const matches = drivers.filter((driver) => {
    const candidateTokens = meaningfulTokens(driver.full_name);
    return candidateTokens.length >= 2 && candidateTokens.every((token) => sourceTokens.has(token));
  });
  return matches.length === 1 ? matches[0] : null;
}

function raceIsFinished(race: StageRace): boolean {
  // LapTime stores EndTime as the configured race duration (for example,
  // 00:17:00), so it is not a completion marker even after the start.
  const started = Boolean(race.startedAt);
  return Boolean(
    race.isFinished ||
      [5, 6].includes(Number(race.state)) ||
      (started && race.finishLap !== null && race.finishLap !== undefined && Number(race.finishLap) > 0) ||
      (started && race.lastPassingFlag !== null && race.lastPassingFlag !== undefined && FINISH_FLAG_IDS.has(Number(race.lastPassingFlag))),
  );
}

function raceState(race: StageRace): StageHeat['state'] {
  if (raceIsFinished(race)) return 'finished';
  if (Number(race.state) === 0 && !race.startedAt) return 'scheduled';
  return 'live';
}

function rankRows<T extends { total: number | null }>(rows: T[]): Array<T & { position: number | null }> {
  let lastTotal: number | null = null;
  let lastPosition: number | null = null;

  return rows.map((row, index) => {
    if (row.total === null) return { ...row, position: null };
    const position = row.total === lastTotal && lastPosition !== null ? lastPosition : index + 1;
    lastTotal = row.total;
    lastPosition = position;
    return { ...row, position };
  });
}

function selectedCategories(binding: StageBinding, categories: StageCategory[]): StageCategory[] {
  const slugs = binding.categorySlugs?.length ? binding.categorySlugs : categories.map((category) => category.slug);
  if (
    binding.categorySlugs &&
    (new Set(slugs).size !== 2 || slugs.some((slug) => !CATEGORY_SLUGS.includes(slug as (typeof CATEGORY_SLUGS)[number])))
  ) {
    throw new Error('A etapa Ultras exige exatamente as categorias insanos e rapidos');
  }

  const selected = slugs
    .map((slug) => categories.find((category) => category.slug === slug))
    .filter((category): category is StageCategory => Boolean(category));
  if (selected.length !== slugs.length || new Set(selected.map((category) => category.id)).size !== selected.length) {
    throw new Error('Categorias Ultras não vinculadas ao UDK');
  }
  return selected;
}

export function buildStageSnapshot(
  binding: StageBinding,
  races: StageRace[],
  drivers: StageDriver[],
  categories: StageCategory[],
  rule: StageRule,
): StageSnapshot {
  if (
    binding.races.length !== 2 ||
    new Set(binding.races.map((race) => race.racingId)).size !== 2 ||
    new Set(binding.races.map((race) => race.sessionId)).size !== 2
  ) {
    throw new Error('A etapa exige duas corridas e sessões distintas');
  }

  if (Number(rule.position_points['1']) !== 50) {
    throw new Error('A regra Ultras precisa atribuir 50 pontos base ao vencedor de cada corrida');
  }

  const stageCategories = selectedCategories(binding, categories);
  const stageCategoryIds = new Set(stageCategories.map((category) => category.id));
  const unresolved = new Set<string>();
  const aliases = binding.aliases || {};

  const heats = binding.races.map((expected): StageHeat => {
    const race = races.find((item) => item.racingId === expected.racingId);
    if (!race || race.groupId !== expected.groupId) throw new Error(`Vínculo LapTime inválido: ${expected.racingId}`);

    const seen = new Set<string>();
    const entrants = race.competitors
      .filter((entry) => !entry.IsHidden)
      .map((entry) => {
        const driver = resolveStageDriver(entry.Competitor, drivers, aliases);
        if (!driver || !stageCategoryIds.has(driver.category_id)) {
          unresolved.add(entry.Competitor);
          return null;
        }
        if (seen.has(driver.id)) throw new Error(`Piloto duplicado na corrida ${race.racingId}: ${driver.id}`);
        seen.add(driver.id);
        return { entry, driver };
      })
      .filter((item): item is { entry: StageCompetitor; driver: StageDriver } => item !== null);

    const state = raceState(race);
    const entries = stageCategories.flatMap((category) => {
      const group = entrants
        .filter(({ driver }) => driver.category_id === category.id)
        .sort(
          (left, right) =>
            (Number(left.entry.Pos) || 99999) - (Number(right.entry.Pos) || 99999) || left.driver.id.localeCompare(right.driver.id),
        );
      const valid = group.filter(({ entry }) => Number(entry.RacingStatus) !== 2 && Number(entry.Pos) > 0 && Number(entry.Lap) > 0);
      const hasResult = valid.length > 0;
      const fastest = Math.min(
        ...valid
          .map(({ entry }) => durationToMillis(entry.BestLapTime))
          .filter((value): value is number => value !== null && value > 0),
      );
      const startPositions = group
        .filter(({ entry }) => Number(entry.RacingStatus) !== 2 && Number(entry.StartPos) > 0)
        .map(({ entry }) => Number(entry.StartPos));
      const start = Math.min(...startPositions);

      return group.map(({ entry, driver }): StageHeatEntry => {
        const disqualified = Number(entry.RacingStatus) === 2;
        const classified = state !== 'scheduled' && valid.some((candidate) => candidate.driver.id === driver.id);
        const position = classified ? valid.findIndex((candidate) => candidate.driver.id === driver.id) + 1 : null;
        const bestLapMs = durationToMillis(entry.BestLapTime);
        const pole = state !== 'scheduled' && !disqualified && Number(entry.StartPos) > 0 && Number(entry.StartPos) === start;
        const fastestLap = classified && bestLapMs !== null && bestLapMs > 0 && bestLapMs === fastest;
        const basePoints = position ? Number(rule.position_points[String(position)] || 0) : 0;

        return {
          driverId: driver.id,
          name: driver.sport_name || driver.full_name,
          categoryId: category.id,
          externalCompetitorId: Number(entry.Id_RacingCompetitor),
          kart: entry.Number === null || entry.Number === undefined ? null : String(entry.Number),
          position,
          laps: Number(entry.Lap) || 0,
          bestLapMs,
          totalTimeMs: durationToMillis(entry.TotalTime),
          penaltyMs: durationToMillis(entry.PenaltyTotalTime),
          penaltyLaps: entry.PenaltyLap === null || entry.PenaltyLap === undefined ? null : Number(entry.PenaltyLap),
          stopAndGo: entry.StopAndGo === null || entry.StopAndGo === undefined ? null : Number(entry.StopAndGo),
          pole,
          fastestLap,
          status: disqualified ? 'disqualified' : classified ? 'classified' : 'not_classified',
          points:
            state === 'scheduled' || !hasResult
              ? null
              : basePoints + (pole ? Number(rule.pole_points || 0) : 0) + (fastestLap ? Number(rule.fastest_lap_points || 0) : 0),
        };
      });
    });

    return { ...expected, state, entries };
  });

  const classification = stageCategories.map((category): StageCategoryClassification => {
    const ids = new Set(
      heats.flatMap((heat) => heat.entries.filter((entry) => entry.categoryId === category.id).map((entry) => entry.driverId)),
    );
    const rows = [...ids]
      .map((driverId) => {
        const racePoints = heats.map((heat) => heat.entries.find((entry) => entry.driverId === driverId)?.points ?? null);
        const entry = heats.flatMap((heat) => heat.entries).find((candidate) => candidate.driverId === driverId);
        return {
          driverId,
          name: entry?.name || driverId,
          racePoints,
          total: racePoints.every((points) => points === null) ? null : racePoints.reduce<number>((sum, points) => sum + (points ?? 0), 0),
        };
      })
      .sort((left, right) => (right.total ?? -Infinity) - (left.total ?? -Infinity) || left.name.localeCompare(right.name, 'pt-BR'));

    return { ...category, rows: rankRows(rows) };
  });

  const complete = heats.every((heat) => heat.state === 'finished') && unresolved.size === 0;
  return {
    stageId: binding.stageId,
    title: binding.title,
    source: 'LapTime',
    provisional: !complete,
    complete,
    points: {
      baseWinnerPerRace: 50,
      baseMaximum: 100,
      positionPoints: rule.position_points,
      pole: Number(rule.pole_points || 0),
      fastestLap: Number(rule.fastest_lap_points || 0),
    },
    unresolved: [...unresolved],
    heats,
    categories: classification,
  };
}
