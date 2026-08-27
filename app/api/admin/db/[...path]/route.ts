import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { adminCookieName, readAdminSession } from '@/lib/admin-auth';
import { handleAdminD1, type AdminD1Database } from '@/lib/admin-d1';
import { getLocalSQLiteDb, isLocalSQLiteAvailable } from '@/lib/local-sqlite-db';
import { syncKartFleetFromLiveSource } from '@/lib/kart-fleet-sync';
import { canAccessAny, canWriteAny, modulesForAdminResource } from '@/lib/admin-access';

declare global {
  interface CloudflareEnv {
    KARTODROMO_ADMIN_DB?: AdminD1Database;
  }
}

export const dynamic = 'force-dynamic';

const TIMEOUT_MS = Number(process.env.KARTODROMO_LOCAL_API_TIMEOUT_MS || '8000');
let liveFleetSyncInFlight: Promise<{ ok: boolean; count: number; error?: string }> | null = null;

type LiveFleetSyncStatus = { ok: boolean; count: number; error?: string } | null;

async function requireSession() {
  const cookieStore = await cookies();
  return readAdminSession(cookieStore.get(adminCookieName())?.value);
}

async function syncLiveKartFleetIfNeeded(request: NextRequest, path: string[], db: AdminD1Database): Promise<LiveFleetSyncStatus> {
  if (request.method !== 'GET' || path[0] !== 'karts_full' || path.length !== 1) return null;

  try {
    liveFleetSyncInFlight ??= syncKartFleetFromLiveSource(db).finally(() => {
      liveFleetSyncInFlight = null;
    });
    return await liveFleetSyncInFlight;
  } catch (error) {
    console.error('[admin/db] live kart fleet sync failed', error);
    return { ok: false, count: 0, error: error instanceof Error ? error.message : 'laptime_fleet_unavailable' };
  }
}

function markFleetSource(response: NextResponse, status: LiveFleetSyncStatus): NextResponse {
  if (!status) return response;
  response.headers.set('x-live-fleet-status', status.ok ? 'live' : 'stale');
  if (!status.ok) response.headers.set('x-live-fleet-error', 'unavailable');
  return response;
}

async function proxy(request: NextRequest, path: string[]) {
  const session = await requireSession();
  if (!session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const resourceName = path[0] || '';
  const resourceModules = modulesForAdminResource(resourceName);
  const isWrite = request.method !== 'GET';
  if (!resourceModules.length || !canAccessAny(session.role, resourceModules)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  if (isWrite && !canWriteAny(session.role, resourceModules)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  // 1. Try local SQLite (next dev mode)
  if (isLocalSQLiteAvailable()) {
    const localDb = getLocalSQLiteDb();
    if (localDb) {
      const syncStatus = await syncLiveKartFleetIfNeeded(request, path, localDb);
      return markFleetSource(await handleAdminD1(request, path, localDb, session.email), syncStatus);
    }
  }

  // 2. Try Cloudflare D1 (production / wrangler preview)
  try {
    const { env } = await getCloudflareContext({ async: true });
    if (env.KARTODROMO_ADMIN_DB) {
      const syncStatus = await syncLiveKartFleetIfNeeded(request, path, env.KARTODROMO_ADMIN_DB);
      return markFleetSource(await handleAdminD1(request, path, env.KARTODROMO_ADMIN_DB, session.email), syncStatus);
    }
  } catch {
    // `next dev` and conventional Node deployments do not expose Cloudflare bindings.
  }

  // 3. Try remote bridge endpoint (configured via env var)
  const endpoint = process.env.KARTODROMO_LOCAL_API_ENDPOINT;
  if (!endpoint) {
    return NextResponse.json(
      {
        error: 'local_api_not_configured',
        hint: 'Install better-sqlite3 for local dev, or set KARTODROMO_LOCAL_API_ENDPOINT',
      },
      { status: 503 },
    );
  }

  const search = request.nextUrl.search;
  const targetUrl = `${endpoint.replace(/\/+$/, '')}/api/db/${path.join('/')}${search}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const hasBody = request.method === 'POST' || request.method === 'PATCH' || request.method === 'PUT';
    const response = await fetch(targetUrl, {
      method: request.method,
      headers: { 'content-type': 'application/json' },
      body: hasBody ? await request.text() : undefined,
      signal: controller.signal,
      cache: 'no-store',
    });

    const text = await response.text();
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.toLowerCase().includes('application/json')) {
      return NextResponse.json(
        { error: 'local_api_invalid_response', upstreamStatus: response.status },
        { status: 502 },
      );
    }
    const headers: Record<string, string> = { 'content-type': 'application/json; charset=utf-8' };
    const totalCount = response.headers.get('x-total-count');
    if (totalCount) headers['x-total-count'] = totalCount;

    return new NextResponse(text, { status: response.status, headers });
  } catch (error) {
    console.error('[admin/db] bridge request failed', error);
    return NextResponse.json(
      { error: error instanceof Error && error.name === 'AbortError' ? 'local_api_timeout' : 'local_api_unreachable' },
      { status: 502 },
    );
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(request, (await params).path);
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(request, (await params).path);
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(request, (await params).path);
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(request, (await params).path);
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(request, (await params).path);
}
