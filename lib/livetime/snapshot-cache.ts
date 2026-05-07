import type { LiveTimingSnapshot } from '@/lib/livetime/types';

let lastSnapshot: LiveTimingSnapshot | null = null;

export function getLastSnapshot(): LiveTimingSnapshot | null {
  return lastSnapshot;
}

export function setLastSnapshot(snapshot: LiveTimingSnapshot): LiveTimingSnapshot {
  lastSnapshot = snapshot;
  return snapshot;
}

export function isFresh(snapshot: LiveTimingSnapshot, ttlMs: number): boolean {
  return Date.now() - new Date(snapshot.updatedAt).getTime() <= ttlMs;
}
