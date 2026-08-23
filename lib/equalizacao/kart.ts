export type KartCategory = 'indoor' | 'super' | 'unknown';

export const KART_CATEGORY_TARGETS_MS: Readonly<Record<Exclude<KartCategory, 'unknown'>, number>> = {
  indoor: 74_500,
  super: 65_700,
};

export const KART_CATEGORY_LABELS: Readonly<Record<KartCategory, string>> = {
  indoor: 'Kart Indoor',
  super: 'Super Kart',
  unknown: 'Fora do padrão',
};

export const EQUALIZATION_TOLERANCE_MS = 1_500;
export const EQUALIZATION_CRITICAL_DELTA_MS = 3_000;

export function normalizedKartNumber(value: unknown): number | null {
  const digits = String(value ?? '').trim().replace(/^#/, '');
  if (!/^\d{1,3}$/.test(digits)) return null;
  const number = Number(digits);
  return Number.isInteger(number) ? number : null;
}

export function kartCategoryFromPlate(value: unknown): KartCategory {
  const number = normalizedKartNumber(value);
  if (number !== null && number >= 1 && number <= 99) return 'indoor';
  if (number !== null && number >= 100 && number <= 200) return 'super';
  return 'unknown';
}

export function targetForKart(value: unknown): number | null {
  const category = kartCategoryFromPlate(value);
  return category === 'unknown' ? null : KART_CATEGORY_TARGETS_MS[category];
}

export function equalizationDeltaMs(mediaMs: number | null | undefined, plate: unknown): number | null {
  const target = targetForKart(plate);
  if (target === null || mediaMs === null || mediaMs === undefined || !Number.isFinite(mediaMs)) return null;
  return Math.round(mediaMs - target);
}

export function equalizationState(
  mediaMs: number | null | undefined,
  plate: unknown,
): 'equilibrado' | 'ajustar' | 'critico' | 'pendente' | 'fora_do_padrao' {
  const category = kartCategoryFromPlate(plate);
  if (category === 'unknown') return 'fora_do_padrao';
  if (mediaMs === null || mediaMs === undefined || !Number.isFinite(mediaMs)) return 'pendente';
  const delta = Math.abs(equalizationDeltaMs(mediaMs, plate) ?? Number.POSITIVE_INFINITY);
  if (delta <= EQUALIZATION_TOLERANCE_MS) return 'equilibrado';
  if (delta <= EQUALIZATION_CRITICAL_DELTA_MS) return 'ajustar';
  return 'critico';
}

export type EqualizationCategorySummary = {
  category: Exclude<KartCategory, 'unknown'>;
  total: number;
  measured: number;
  averageMs: number | null;
  averageDeltaMs: number | null;
};

export function summarizeCategory(
  karts: ReadonlyArray<{ numero: string; media_equalizacao_ms?: number | null }>,
  category: Exclude<KartCategory, 'unknown'>,
): EqualizationCategorySummary {
  const inCategory = karts.filter((kart) => kartCategoryFromPlate(kart.numero) === category);
  const measurements = inCategory
    .map((kart) => kart.media_equalizacao_ms)
    .filter((value): value is number => value !== null && value !== undefined && Number.isFinite(value));
  const target = KART_CATEGORY_TARGETS_MS[category];
  const averageMs = measurements.length
    ? Math.round(measurements.reduce((total, value) => total + value, 0) / measurements.length)
    : null;
  const averageDeltaMs = averageMs === null ? null : averageMs - target;

  return {
    category,
    total: inCategory.length,
    measured: measurements.length,
    averageMs,
    averageDeltaMs,
  };
}
