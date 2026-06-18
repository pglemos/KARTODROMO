import { NextRequest, NextResponse } from 'next/server';
import { createDemoSnapshot, DEFAULT_UID } from '@/lib/livetime/demo-data';
import { fetchExternalSnapshot } from '@/lib/livetime/snapshot-service';
import { canHoldLastSnapshot, canUseCachedSnapshot, getLastSnapshot, holdLastSnapshot, setLastSnapshot, shouldPreserveKartSnapshot } from '@/lib/livetime/snapshot-cache';
import type { LiveTimingSnapshot } from '@/lib/livetime/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
  Expires: '0',
  Pragma: 'no-cache',
};

export async function GET(request: NextRequest) {
  const uid = request.nextUrl.searchParams.get('uid') || process.env.NEXT_PUBLIC_DEFAULT_UID || DEFAULT_UID;
  const demoRequested = request.nextUrl.searchParams.get('demo') === 'true' || process.env.LIVETIME_FORCE_DEMO === 'true';

  if (demoRequested) {
    return NextResponse.json(createDemoSnapshot('Demo solicitado'), {
      headers: NO_CACHE_HEADERS,
    });
  }

  if (!process.env.LIVETIME_SNAPSHOT_ENDPOINT && process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      {
        status: 'error',
        source: 'dom-scraper',
        updatedAt: new Date().toISOString(),
        message: 'LIVETIME_SNAPSHOT_ENDPOINT nao configurado em producao',
        drivers: [],
      } satisfies LiveTimingSnapshot,
      { headers: NO_CACHE_HEADERS },
    );
  }

  try {
    const snapshot = await fetchExternalSnapshot(uid);
    if (snapshot.drivers.length > 0) {
      const cached = getLastSnapshot(uid);
      if (!shouldPreserveKartSnapshot(snapshot, cached)) setLastSnapshot(uid, snapshot);
    } else {
      const cached = getLastSnapshot(uid);
      if (canHoldLastSnapshot(snapshot, cached)) {
        return NextResponse.json(holdLastSnapshot(snapshot, cached), {
          headers: NO_CACHE_HEADERS,
        });
      }
    }

    return NextResponse.json(snapshot, {
      headers: NO_CACHE_HEADERS,
    });
  } catch (error) {
    const cached = getLastSnapshot(uid);
    if (canUseCachedSnapshot(cached)) {
      return NextResponse.json(
        {
          ...cached,
          status: 'error',
          source: 'cache',
          message: error instanceof Error ? error.message : 'Erro temporario no snapshot',
        } satisfies LiveTimingSnapshot,
        {
          headers: NO_CACHE_HEADERS,
        },
      );
    }

    return NextResponse.json(
      {
        status: 'error',
        source: 'dom-scraper',
        updatedAt: new Date().toISOString(),
        message: error instanceof Error ? error.message : 'Erro ao obter snapshot',
        drivers: [],
      } satisfies LiveTimingSnapshot,
      { headers: NO_CACHE_HEADERS },
    );
  }
}
