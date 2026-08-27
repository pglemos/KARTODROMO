import { NextRequest, NextResponse } from 'next/server';
import { readTelaoLayoutConfigFromRemote, telaoLayoutStoreStatus, writeTelaoLayoutConfig } from '@/lib/telao-layout-store';
import { TELAO_LAYOUT_PRESETS } from '@/lib/telao-layout-config';
import { requireAdminPermission } from '@/lib/admin-api-guard';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
  Expires: '0',
  Pragma: 'no-cache',
};

export async function GET() {
  const endpoint = process.env.TELAO_LAYOUT_REMOTE_ENDPOINT;

  return NextResponse.json(
    {
      layout: await readTelaoLayoutConfigFromRemote(),
      presets: TELAO_LAYOUT_PRESETS,
      store: {
        ...telaoLayoutStoreStatus(),
        ...(endpoint
          ? {
              storage: 'remote',
              persistent: true,
            }
          : {}),
      },
    },
    { headers: NO_CACHE_HEADERS },
  );
}

export async function PUT(request: NextRequest) {
  const denied = await requireAdminPermission('telao', true, request);
  if (denied) return denied;

  const body = await request.json();
  const endpoint = process.env.TELAO_LAYOUT_REMOTE_ENDPOINT;

  if (endpoint) {
    try {
      const response = await fetch(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        cache: 'no-store',
      });

      if (response.ok) {
        const data = await response.json();
        return NextResponse.json(
          {
            ...data,
            remote: true,
            store: {
              ...telaoLayoutStoreStatus(),
              storage: 'remote',
              persistent: true,
            },
          },
          { headers: NO_CACHE_HEADERS },
        );
      }
    } catch {
      // Fall back to local storage so the designer remains usable offline.
    }
  }

  const result = await writeTelaoLayoutConfig(body);
  return NextResponse.json({ ...result, store: telaoLayoutStoreStatus() }, { headers: NO_CACHE_HEADERS });
}
