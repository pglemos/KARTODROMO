import { normalizeDrivers } from '@/lib/livetime/normalize-drivers';
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

function clean(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
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

export function inferStatusFromText(text: string, drivers: LiveTimingDriver[]): LiveTimingStatus {
  const lowered = text.toLowerCase();
  if (drivers.length > 0) return 'live';
  if (lowered.includes('aguarde') || lowered.includes('corrida') || lowered.includes('começar') || lowered.includes('comecar')) return 'waiting';
  return 'empty';
}

export function extractEventNames(text: string): Pick<ExtractedDomTable, 'eventName' | 'trackName'> {
  const lines = text
    .split('\n')
    .map(clean)
    .filter(Boolean)
    .filter((line) => !['P', '#', 'NAME', 'LAP', 'TIME', 'GAP', 'INTERVAL', 'B.LAP', 'B.TIME'].includes(line.toUpperCase()));

  const eventLine = lines.find((line) => /[A-ZÀ-Ú]{3,}/i.test(line));
  const trackLine = lines.find((line) => line !== eventLine && /TRA[ÇC]ADO|TRACK/i.test(line));

  return {
    eventName: eventLine,
    trackName: trackLine,
  };
}

export type { DomRow, ExtractedDomTable };
