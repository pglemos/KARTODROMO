import type { LiveTimingDriver, RawDriver } from '@/lib/livetime/types';
import { formatDurationMs, parseDurationMs } from '@/lib/livetime/time-format';

const POSITION_KEYS = ['position', 'pos', 'rank', 'place', 'Position', 'Pos'];
const KART_KEYS = ['kart', 'kartNumber', 'kart_number', 'number', 'car', 'carNumber', 'transponder', 'Kart', 'Number', 'No', '#'];
const NAME_KEYS = ['name', 'driver', 'driverName', 'pilot', 'piloto', 'competitor', 'racer', 'Name', 'Driver', 'Pilot'];
const TEAM_KEYS = ['team', 'teamName', 'team_name', 'equipe', 'equipeName', 'Equipe', 'Team'];
const TIME_KEYS = ['time', 'Time', 'totalTime', 'raceTime', 'lastTime', 'lapTime', 'bestLap', 'bestLapTime', 'gap', 'diff', 'interval'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function firstValue(record: RawDriver, keys: string[]): unknown {
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null && record[key] !== '') {
      return record[key];
    }
  }

  return undefined;
}

function extractArray(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (!isRecord(raw)) return [];

  const candidates = ['drivers', 'positions', 'data', 'results', 'classification'];
  for (const key of candidates) {
    const value = raw[key];
    if (Array.isArray(value)) return value;
  }

  return [];
}

function toPosition(value: unknown, fallback: number): number {
  const numeric = typeof value === 'number' ? value : Number(String(value ?? '').replace(/[^\d]/g, ''));
  return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback;
}

function toCellString(value: unknown): string {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

function normalizeName(value: unknown): string {
  return toCellString(value).replace(/\s+/g, ' ').toUpperCase();
}

function normalizeLongTime(value: unknown): string {
  const raw = toCellString(value);
  const milliseconds = parseDurationMs(raw);
  if (milliseconds === null || milliseconds < 60 * 60 * 1_000) return raw;
  const sign = raw.startsWith('+') ? '+' : '';
  return `${sign}${formatDurationMs(milliseconds) ?? raw}`;
}

export function normalizeDrivers(raw: unknown): LiveTimingDriver[] {
  const normalized = extractArray(raw)
    .filter(isRecord)
    .map((driver, index) => {
      const team = normalizeName(firstValue(driver, TEAM_KEYS));

      return {
        position: toPosition(firstValue(driver, POSITION_KEYS), index + 1),
        kart: toCellString(firstValue(driver, KART_KEYS)),
        name: normalizeName(firstValue(driver, NAME_KEYS)),
        ...(team ? { team } : {}),
        time: normalizeLongTime(firstValue(driver, TIME_KEYS)),
      };
    })
    .filter((driver) => driver.position > 0);

  const seenPositions = new Set<number>();
  return normalized
    .filter((driver) => {
      if (seenPositions.has(driver.position)) return false;
      seenPositions.add(driver.position);
      return true;
    })
    .slice(0, 30);
}
