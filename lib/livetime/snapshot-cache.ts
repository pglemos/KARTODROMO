import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { LiveTimingSnapshot } from '@/lib/livetime/types';

const defaultCacheKey = '__default__';
const cacheDir = join(process.cwd(), '.runtime', process.env.NODE_ENV === 'test' ? 'livetime-snapshots-test' : 'livetime-snapshots');
const memorySnapshots = new Map<string, LiveTimingSnapshot>();

function cacheKey(uid?: string): string {
  return uid?.trim() || defaultCacheKey;
}

function cachePath(uid?: string): string {
  return join(cacheDir, `${cacheKey(uid).replace(/[^a-zA-Z0-9_-]/g, '_')}.json`);
}

function readSnapshotFromDisk(uid?: string): LiveTimingSnapshot | null {
  const path = cachePath(uid);
  if (!existsSync(path)) return null;

  try {
    const value = JSON.parse(readFileSync(path, 'utf8')) as { snapshot?: LiveTimingSnapshot };
    if (!value.snapshot || !Array.isArray(value.snapshot.drivers)) return null;
    memorySnapshots.set(cacheKey(uid), value.snapshot);
    return value.snapshot;
  } catch {
    return null;
  }
}

export function getLastSnapshot(uid?: string): LiveTimingSnapshot | null {
  return memorySnapshots.get(cacheKey(uid)) || readSnapshotFromDisk(uid);
}

export function setLastSnapshot(snapshot: LiveTimingSnapshot): LiveTimingSnapshot;
export function setLastSnapshot(uid: string, snapshot: LiveTimingSnapshot): LiveTimingSnapshot;
export function setLastSnapshot(uidOrSnapshot: string | LiveTimingSnapshot, maybeSnapshot?: LiveTimingSnapshot): LiveTimingSnapshot {
  const uid = typeof uidOrSnapshot === 'string' ? uidOrSnapshot : undefined;
  const snapshot = typeof uidOrSnapshot === 'string' ? maybeSnapshot : uidOrSnapshot;
  if (!snapshot) throw new Error('Snapshot ausente');

  memorySnapshots.set(cacheKey(uid), snapshot);

  try {
    mkdirSync(dirname(cachePath(uid)), { recursive: true });
    writeFileSync(cachePath(uid), JSON.stringify({ uid: cacheKey(uid), storedAt: new Date().toISOString(), snapshot }, null, 2));
  } catch {
    // Cache em memoria continua valido mesmo se o disco local estiver indisponivel.
  }

  return snapshot;
}

export function isFresh(snapshot: LiveTimingSnapshot, ttlMs: number): boolean {
  const updatedAt = new Date(snapshot.updatedAt).getTime();
  return Number.isFinite(updatedAt) && Date.now() - updatedAt <= ttlMs;
}

export function shouldHoldLastSnapshot(snapshot: LiveTimingSnapshot): boolean {
  return snapshot.drivers.length === 0 && (snapshot.status === 'finished' || snapshot.status === 'waiting' || snapshot.status === 'empty');
}

export function snapshotCacheTtlMs(): number {
  const value = Number(process.env.LIVETIME_CACHE_TTL_MS || '10000');
  return Number.isFinite(value) && value > 0 ? value : 10000;
}

export function canUseCachedSnapshot(cached: LiveTimingSnapshot | null, ttlMs = snapshotCacheTtlMs()): cached is LiveTimingSnapshot {
  return Boolean(cached?.drivers.length && isFresh(cached, ttlMs));
}

export function canHoldLastSnapshot(current: LiveTimingSnapshot, cached: LiveTimingSnapshot | null, ttlMs = snapshotCacheTtlMs()): cached is LiveTimingSnapshot {
  return shouldHoldLastSnapshot(current) && canUseCachedSnapshot(cached, ttlMs);
}

export function hasAnyKart(snapshot: LiveTimingSnapshot): boolean {
  return snapshot.drivers.some((driver) => Boolean(driver.kart?.trim()));
}

export function shouldPreserveKartSnapshot(current: LiveTimingSnapshot, cached: LiveTimingSnapshot | null): boolean {
  return current.drivers.length > 0 && !hasAnyKart(current) && Boolean(cached?.drivers.length && hasAnyKart(cached));
}

export function holdLastSnapshot(current: LiveTimingSnapshot, cached: LiveTimingSnapshot): LiveTimingSnapshot {
  return {
    ...cached,
    status: cached.status === 'demo' ? 'demo' : 'live',
    source: 'cache',
    message: current.message || 'Aguardando nova corrida; mantendo ultimo grid valido',
  };
}

export function clearSnapshotCacheForTests(): void {
  memorySnapshots.clear();

  if (!existsSync(cacheDir)) return;

  for (const entry of readdirSync(cacheDir)) {
    rmSync(join(cacheDir, entry), { force: true });
  }
}
