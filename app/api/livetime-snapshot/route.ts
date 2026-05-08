import { NextRequest, NextResponse } from 'next/server';
import { createDemoSnapshot, DEFAULT_UID } from '@/lib/livetime/demo-data';
import { fetchExternalSnapshot } from '@/lib/livetime/snapshot-service';
import { getLastSnapshot, isFresh, setLastSnapshot } from '@/lib/livetime/snapshot-cache';
import type { LiveTimingSnapshot } from '@/lib/livetime/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

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
