import type { RaceResultEntry, RaceResultPayload } from '../types/raceResults';

const timePartsToMs = (value: string) => {
  const normalized = value.trim().replace(',', '.');
  const parts = normalized.split(':').map(Number);

  if (parts.some((part) => Number.isNaN(part))) return Number.POSITIVE_INFINITY;

  if (parts.length === 3) {
    const [hours, minutes, seconds] = parts;
    return ((hours * 60 + minutes) * 60 + seconds) * 1000;
  }

  if (parts.length === 2) {
    const [minutes, seconds] = parts;
    return (minutes * 60 + seconds) * 1000;
  }

  if (parts.length === 1) {
    return parts[0] * 1000;
  }

  return Number.POSITIVE_INFINITY;
};

export const getRaceEntryTime = (entry: RaceResultEntry) => {
  if (Number.isFinite(entry.bestLapMs)) return entry.bestLapMs as number;
  if (entry.bestLap) return timePartsToMs(entry.bestLap);
  return Number.POSITIVE_INFINITY;
};

export const sortRaceEntries = (entries: RaceResultEntry[]) =>
  [...entries].sort((a, b) => {
    const positionA = Number.isFinite(a.position) ? a.position : Number.POSITIVE_INFINITY;
    const positionB = Number.isFinite(b.position) ? b.position : Number.POSITIVE_INFINITY;

    if (positionA !== positionB) return positionA - positionB;

    const timeA = getRaceEntryTime(a);
    const timeB = getRaceEntryTime(b);

    if (timeA !== timeB) return timeA - timeB;

    return a.name.localeCompare(b.name, 'pt-BR');
  });

export const normalizeRaceResult = (payload: RaceResultPayload): RaceResultPayload => ({
  ...payload,
  entries: sortRaceEntries(payload.entries).map((entry, index) => ({
    ...entry,
    position: Number.isFinite(entry.position) ? entry.position : index + 1,
  })),
  standings: payload.standings
    ? [...payload.standings].sort((a, b) => a.position - b.position)
    : undefined,
});

export const formatResultDateTime = (value: string) =>
  new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
