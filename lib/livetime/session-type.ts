import type { LiveTimingSessionType, LiveTimingSnapshot } from '@/lib/livetime/types';

function comparable(value: string): string {
  return value
    .replace(/\s+/g, ' ')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
}

export function inferSessionTypeFromText(text: string): LiveTimingSessionType {
  const value = comparable(text);

  if (/\b(TOMADA|TREINO|QUALIFYING|QUALIFICATORIO|QUALIFICATORIA|CLASSIFICATORIO|CLASSIFICATORIA)\b/.test(value)) {
    return 'qualifying';
  }

  if (/\b(CORRIDA|RACE)\b/.test(value)) {
    return 'race';
  }

  return 'unknown';
}

export function inferSessionTypeFromSnapshot(snapshot: LiveTimingSnapshot | null | undefined): LiveTimingSessionType {
  if (!snapshot) return 'unknown';
  if (snapshot.sessionType) return snapshot.sessionType;

  return inferSessionTypeFromText([snapshot.eventName, snapshot.trackName, snapshot.message].filter(Boolean).join(' '));
}

export function isQualifyingSnapshot(snapshot: LiveTimingSnapshot | null | undefined): boolean {
  return inferSessionTypeFromSnapshot(snapshot) === 'qualifying';
}

export function isRaceSnapshot(snapshot: LiveTimingSnapshot | null | undefined): boolean {
  return inferSessionTypeFromSnapshot(snapshot) === 'race';
}

export function isFinishedRaceSnapshot(snapshot: LiveTimingSnapshot | null | undefined): boolean {
  return snapshot?.status === 'finished' && isRaceSnapshot(snapshot);
}
