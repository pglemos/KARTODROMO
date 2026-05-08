export type TelaoLayoutVariant = 'table' | 'cards';
export type TelaoField = 'position' | 'kart' | 'name' | 'time';
export type TelaoNameMode = 'hidden' | 'first' | 'full';

export type TelaoLayoutConfig = {
  id: string;
  label: string;
  variant: TelaoLayoutVariant;
  columns: number;
  rows: number;
  fields: TelaoField[];
  nameMode: TelaoNameMode;
  showHeader: boolean;
  positionFontSize: number;
  kartFontSize: number;
  nameFontSize: number;
  timeFontSize: number;
  headerFontSize: number;
  cellGap: number;
  borderWidth: number;
  colors: {
    background: string;
    grid: string;
    accent: string;
    text: string;
    position: string;
    time: string;
    muted: string;
    topCell?: string;
    bottomCell?: string;
  };
};

const FIELD_SET = new Set<TelaoField>(['position', 'kart', 'name', 'time']);

export const DEFAULT_TELAO_LAYOUT: TelaoLayoutConfig = {
  id: 'standard-30',
  label: 'Classico 30 pilotos',
  variant: 'table',
  columns: 6,
  rows: 5,
  fields: ['position', 'kart', 'name', 'time'],
  nameMode: 'first',
  showHeader: true,
  positionFontSize: 24,
  kartFontSize: 26,
  nameFontSize: 24,
  timeFontSize: 22,
  headerFontSize: 20,
  cellGap: 0,
  borderWidth: 2,
  colors: {
    background: '#000000',
    grid: '#444444',
    accent: '#04ff00',
    text: '#ffffff',
    position: '#04ff00',
    time: '#ffffff',
    muted: 'rgba(255,255,255,.22)',
  },
};

export const TELAO_LAYOUT_PRESETS: Record<string, TelaoLayoutConfig> = {
  'standard-30': DEFAULT_TELAO_LAYOUT,
  'cards-16-kart': {
    ...DEFAULT_TELAO_LAYOUT,
    id: 'cards-16-kart',
    label: 'Modelo 16 pilotos - posicao e kart',
    variant: 'cards',
    columns: 8,
    rows: 2,
    fields: ['position', 'kart'],
    nameMode: 'hidden',
    positionFontSize: 42,
    kartFontSize: 54,
    nameFontSize: 28,
    timeFontSize: 28,
    headerFontSize: 20,
    cellGap: 0,
    borderWidth: 3,
    colors: {
      ...DEFAULT_TELAO_LAYOUT.colors,
      topCell: '#050505',
      bottomCell: '#101010',
    },
  },
  'cards-16-time': {
    ...DEFAULT_TELAO_LAYOUT,
    id: 'cards-16-time',
    label: 'Modelo 16 pilotos - kart e tempo',
    variant: 'cards',
    columns: 8,
    rows: 2,
    fields: ['position', 'kart', 'time'],
    nameMode: 'hidden',
    positionFontSize: 26,
    kartFontSize: 40,
    nameFontSize: 22,
    timeFontSize: 28,
    headerFontSize: 20,
    cellGap: 0,
    borderWidth: 3,
    colors: {
      ...DEFAULT_TELAO_LAYOUT.colors,
      topCell: '#050505',
      bottomCell: '#101010',
    },
  },
  'cards-12-name': {
    ...DEFAULT_TELAO_LAYOUT,
    id: 'cards-12-name',
    label: 'Modelo 12 pilotos - nome grande',
    variant: 'cards',
    columns: 6,
    rows: 2,
    fields: ['position', 'kart', 'name', 'time'],
    nameMode: 'first',
    positionFontSize: 24,
    kartFontSize: 34,
    nameFontSize: 32,
    timeFontSize: 26,
    headerFontSize: 20,
    cellGap: 0,
    borderWidth: 3,
  },
};

function clamp(value: unknown, min: number, max: number, fallback: number): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(Math.max(Math.round(numeric), min), max);
}

function normalizeFields(value: unknown): TelaoField[] {
  if (!Array.isArray(value)) return DEFAULT_TELAO_LAYOUT.fields;
  const fields = value.filter((field): field is TelaoField => FIELD_SET.has(field));
  return fields.length > 0 ? fields : DEFAULT_TELAO_LAYOUT.fields;
}

function stringValue(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

export function normalizeTelaoLayoutConfig(value: unknown): TelaoLayoutConfig {
  const input = value && typeof value === 'object' ? (value as Partial<TelaoLayoutConfig>) : {};
  const base = input.id && TELAO_LAYOUT_PRESETS[input.id] ? TELAO_LAYOUT_PRESETS[input.id] : DEFAULT_TELAO_LAYOUT;
  const colors = (input.colors && typeof input.colors === 'object' ? input.colors : {}) as Partial<TelaoLayoutConfig['colors']>;

  return {
    id: stringValue(input.id, base.id),
    label: stringValue(input.label, base.label),
    variant: input.variant === 'cards' || input.variant === 'table' ? input.variant : base.variant,
    columns: clamp(input.columns, 1, 10, base.columns),
    rows: clamp(input.rows, 1, 10, base.rows),
    fields: normalizeFields(input.fields || base.fields),
    nameMode: input.nameMode === 'hidden' || input.nameMode === 'first' || input.nameMode === 'full' ? input.nameMode : base.nameMode,
    showHeader: typeof input.showHeader === 'boolean' ? input.showHeader : base.showHeader,
    positionFontSize: clamp(input.positionFontSize, 10, 80, base.positionFontSize),
    kartFontSize: clamp(input.kartFontSize, 10, 90, base.kartFontSize),
    nameFontSize: clamp(input.nameFontSize, 10, 80, base.nameFontSize),
    timeFontSize: clamp(input.timeFontSize, 10, 80, base.timeFontSize),
    headerFontSize: clamp(input.headerFontSize, 10, 48, base.headerFontSize),
    cellGap: clamp(input.cellGap, 0, 18, base.cellGap),
    borderWidth: clamp(input.borderWidth, 0, 6, base.borderWidth),
    colors: {
      background: stringValue(colors.background, base.colors.background),
      grid: stringValue(colors.grid, base.colors.grid),
      accent: stringValue(colors.accent, base.colors.accent),
      text: stringValue(colors.text, base.colors.text),
      position: stringValue(colors.position, base.colors.position),
      time: stringValue(colors.time, base.colors.time),
      muted: stringValue(colors.muted, base.colors.muted),
      topCell: stringValue(colors.topCell, base.colors.topCell || base.colors.background),
      bottomCell: stringValue(colors.bottomCell, base.colors.bottomCell || base.colors.background),
    },
  };
}

export function firstDriverName(name?: string, mode: TelaoNameMode = 'first'): string {
  if (!name || mode === 'hidden') return '';
  if (mode === 'full') return name.trim();
  return name.trim().split(/\s+/)[0] || '';
}
