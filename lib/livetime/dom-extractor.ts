import { normalizeDrivers } from '@/lib/livetime/normalize-drivers';
import { inferSessionTypeFromText } from '@/lib/livetime/session-type';
import type { LiveTimingDriver, LiveTimingStatus } from '@/lib/livetime/types';

type ExtractedDomTable = {
  status: LiveTimingStatus;
  eventName?: string;
  trackName?: string;
  drivers: LiveTimingDriver[];
};

type DomRow = {
  cells: string[];
};

const POSITION_HEADERS = new Set(['P', 'POS', 'POSITION', 'CLASS']);
const KART_HEADERS = new Set(['#', 'KART', 'NO', 'NUMBER', 'CAR']);
const NAME_HEADERS = new Set(['NAME', 'DRIVER', 'PILOT', 'PILOTO']);
const TIME_HEADERS = new Set(['TIME', 'B.TIME', 'BEST', 'BESTLAPTIME']);
const MATERIAL_ICON_LINES = new Set(['wifi_tethering']);

function clean(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function comparable(value: string): string {
  return clean(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
}

function headerIndex(headers: string[], accepted: Set<string>): number {
  return headers.findIndex((header) => accepted.has(header.toUpperCase()));
}

function resolveTimeIndex(headers: string[]): number {
  const exactTime = headers.findIndex((header) => header.toUpperCase() === 'TIME');
  if (exactTime >= 0) return exactTime;
  return headerIndex(headers, TIME_HEADERS);
}

export function extractDriversFromTable(headers: string[], rows: DomRow[]): LiveTimingDriver[] {
  const normalizedHeaders = headers.map(clean);
  const positionIndex = headerIndex(normalizedHeaders, POSITION_HEADERS);
  const kartIndex = headerIndex(normalizedHeaders, KART_HEADERS);
  const nameIndex = headerIndex(normalizedHeaders, NAME_HEADERS);
  const timeIndex = resolveTimeIndex(normalizedHeaders);

  if (positionIndex < 0 || kartIndex < 0 || nameIndex < 0 || timeIndex < 0) {
    return [];
  }

  return normalizeDrivers(
    rows.map((row) => ({
      position: row.cells[positionIndex],
      kart: row.cells[kartIndex],
      name: row.cells[nameIndex],
      time: row.cells[timeIndex],
    })),
  );
}

function stripLabel(value: string, label: string): string {
  return clean(value).replace(new RegExp(`^${label}\\s*`, 'i'), '').trim();
}

function splitKartAndName(value: string): { kart: string; name: string } {
  const cleaned = clean(value);
  const match = cleaned.match(/^#\s*([^\s]+)\s*(.*)$/);

  if (!match) return { kart: '', name: cleaned };

  return {
    kart: match[1],
    name: match[2] || cleaned,
  };
}

function extractKartFromCardText(value: string): string {
  return clean(value).match(/#\s*([^\s]+)/)?.[1] || '';
}

function chooseLapTime(gap: string, bestLapTime: string, lastLapTime: string, diff: string): string {
  if (gap.startsWith('+')) return gap;
  if (gap && gap !== '00:00.000') return `+${gap}`;
  if (bestLapTime) return bestLapTime;
  if (lastLapTime) return lastLapTime;
  return diff;
}

export function extractDriversFromLapTimeCards(rows: DomRow[]): LiveTimingDriver[] {
  return normalizeDrivers(
    rows.map((row) => {
      const position = clean(row.cells[0] || '');
      const competitor = splitKartAndName(row.cells[1] || '');
      const lastLapTime = stripLabel(row.cells[2] || '', 'U-Lap');
      const bestLapTime = stripLabel(row.cells[3] || '', 'B-Lap');
      const diff = stripLabel(row.cells[4] || '', 'Diff');
      const gap = stripLabel(row.cells[5] || '', 'Gap');
      const kart = competitor.kart || extractKartFromCardText(row.cells[6] || '');

      return {
        position,
        kart,
        name: competitor.name,
        time: chooseLapTime(gap, bestLapTime, lastLapTime, diff),
      };
    }),
  );
}

export function extractDriversFromResultCards(rows: DomRow[]): LiveTimingDriver[] {
  return normalizeDrivers(
    rows.map((row) => ({
      position: row.cells[0],
      kart: row.cells[3] || '',
      name: row.cells[2],
      time: row.cells[1],
    })),
  );
}

export function inferStatusFromText(text: string, drivers: LiveTimingDriver[], hasResultCards = false): LiveTimingStatus {
  const lowered = comparable(text).toLowerCase();
  const finishedNeedles = [
    'fim de corrida',
    'corrida final',
    'corrida finalizada',
    'corrida encerrada',
    'prova finalizada',
    'prova encerrada',
    'classificacao final',
    'resultado final',
    'race finished',
    'final result',
    'finished',
  ];

  if (finishedNeedles.some((needle) => lowered.includes(needle))) return 'finished';
  if (hasResultCards && drivers.length > 0) return 'finished';
  if (drivers.length > 0) return 'live';
  if (lowered.includes('aguarde') || lowered.includes('corrida') || lowered.includes('comecar')) return 'waiting';
  return 'empty';
}

export { inferSessionTypeFromText };

export function extractEventNames(text: string): Pick<ExtractedDomTable, 'eventName' | 'trackName'> {
  const lines = text
    .split('\n')
    .map(clean)
    .filter(Boolean)
    .filter((line) => !MATERIAL_ICON_LINES.has(line.toLowerCase()))
    .filter((line) => !['P', '#', 'NAME', 'LAP', 'TIME', 'GAP', 'INTERVAL', 'B.LAP', 'B.TIME'].includes(line.toUpperCase()));

  const raceLine = lines.find((line) => {
    const value = comparable(line);
    return value.includes('(CORRIDA)') || value.includes('(RACE)') || value.includes('TRACADO') || value.includes('TRACK');
  });
  const eventLine = raceLine || lines.find((line) => /[A-Z]{3,}/i.test(comparable(line)));
  const trackLine =
    lines.find((line) => line !== eventLine && /TRACADO|TRACK/i.test(comparable(line))) ||
    eventLine?.match(/Tra[cç]ado\s+\d+/i)?.[0];

  return {
    eventName: eventLine,
    trackName: trackLine,
  };
}

export type { DomRow, ExtractedDomTable };
