import { NextRequest, NextResponse } from 'next/server';
import { createDemoSnapshot, DEFAULT_UID } from '@/lib/livetime/demo-data';
import { getLastSnapshot, isFresh, setLastSnapshot } from '@/lib/livetime/snapshot-cache';
import type { LiveTimingSnapshot } from '@/lib/livetime/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function resolveExternalUrl(endpoint: string, uid: string): string {
  if (endpoint.includes('{uid}')) return endpoint.split('{uid}').join(encodeURIComponent(uid));
  const url = new URL(endpoint);
  url.searchParams.set('uid', uid);
  return url.toString();
}

async function fetchExternalSnapshot(uid: string): Promise<LiveTimingSnapshot> {
  const endpoint = process.env.LIVETIME_SNAPSHOT_ENDPOINT;
  if (!endpoint) return createDemoSnapshot('LIVETIME_SNAPSHOT_ENDPOINT nao configurado');

  const timeoutMs = Number(process.env.LIVETIME_TIMEOUT_MS || '3000');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(resolveExternalUrl(endpoint, uid), {
      cache: 'no-store',
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Snapshot HTTP ${response.status}`);
    }

    return (await response.json()) as LiveTimingSnapshot;
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET(request: NextRequest) {
  const uid = request.nextUrl.searchParams.get('uid') || process.env.NEXT_PUBLIC_DEFAULT_UID || DEFAULT_UID;
  const demoRequested = request.nextUrl.searchParams.get('demo') === 'true' || process.env.LIVETIME_FORCE_DEMO === 'true';

  if (!process.env.LIVETIME_SNAPSHOT_ENDPOINT && process.env.NODE_ENV === 'production' && !demoRequested) {
    return NextResponse.json(
      {
        status: 'error',
        source: 'dom-scraper',
        updatedAt: new Date().toISOString(),
        message: 'LIVETIME_SNAPSHOT_ENDPOINT nao configurado em producao',
        drivers: [],
      } satisfies LiveTimingSnapshot,
      { status: 503 },
    );
  }

  try {
    const snapshot = await fetchExternalSnapshot(uid);
    if (snapshot.drivers.length > 0) {
      setLastSnapshot(snapshot);
    }
    return NextResponse.json(snapshot);
  } catch (error) {
    const cached = getLastSnapshot();
    if (cached && isFresh(cached, Number(process.env.LIVETIME_CACHE_TTL_MS || '10000'))) {
      return NextResponse.json({
        ...cached,
        status: 'error',
        source: 'cache',
        message: error instanceof Error ? error.message : 'Erro temporario no snapshot',
      } satisfies LiveTimingSnapshot);
    }

    return NextResponse.json(
      {
        status: 'error',
        source: 'dom-scraper',
        updatedAt: new Date().toISOString(),
        message: error instanceof Error ? error.message : 'Erro ao obter snapshot',
        drivers: [],
      } satisfies LiveTimingSnapshot,
      { status: 502 },
    );
  }
}
