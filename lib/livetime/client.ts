import type { LiveTimingSnapshot } from '@/lib/livetime/types';
import { createDemoSnapshot } from '@/lib/livetime/demo-data';

export async function fetchLiveTimingSnapshot(uid: string, signal?: AbortSignal, demo = false): Promise<LiveTimingSnapshot> {
  const params = new URLSearchParams({ uid });
  if (demo) params.set('demo', 'true');
  const response = await fetch(`/api/livetime-snapshot?${params.toString()}`, {
    cache: 'no-store',
    signal,
  });

  if (!response.ok) {
    throw new Error(`Snapshot API failed with HTTP ${response.status}`);
  }

  return response.json() as Promise<LiveTimingSnapshot>;
}

export function safeSnapshot(value: unknown): LiveTimingSnapshot {
  if (!value || typeof value !== 'object') return createDemoSnapshot('Payload invalido');
  const snapshot = value as LiveTimingSnapshot;
  if (!Array.isArray(snapshot.drivers)) return createDemoSnapshot('Payload sem lista de pilotos');
  return snapshot;
}
