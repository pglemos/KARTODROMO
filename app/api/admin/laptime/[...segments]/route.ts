import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { adminCookieName, verifyAdminSession } from '@/lib/admin-auth';
import { resolveBridgeBase, BRIDGE_FETCH_HEADERS } from '@/lib/bridge-base';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const configuredTimeoutMs = Number(process.env.LAPTIME_BRIDGE_TIMEOUT_MS || '30000');
const TIMEOUT_MS = Number.isFinite(configuredTimeoutMs) ? Math.max(configuredTimeoutMs, 30000) : 30000;

const ALLOWED_SLUGS = new Set([
  'bookings',
  'booking-customers',
  'racings',
  'racing-competitors',
  'racing-detail',
  'racing-laps',
  'kart-history',
  'kart-fleet',
]);

async function requireSession() {
  const cookieStore = await cookies();
  return verifyAdminSession(cookieStore.get(adminCookieName())?.value);
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ segments: string[] }> }) {
  if (!(await requireSession())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { segments } = await params;
  const slug = segments[0];
  if (!slug || !ALLOWED_SLUGS.has(slug)) {
    return NextResponse.json({ error: 'unknown_laptime_path' }, { status: 404 });
  }

  const base = resolveBridgeBase();
  if (!base) {
    return NextResponse.json({ error: 'laptime_bridge_not_configured' }, { status: 503 });
  }

  const targetUrl = `${base}/api/laptime-${slug}${request.nextUrl.search}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(targetUrl, {
      headers: BRIDGE_FETCH_HEADERS,
      signal: controller.signal,
      cache: 'no-store',
    });

    const text = await response.text();
    const headers: Record<string, string> = {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
      expires: '0',
      pragma: 'no-cache',
    };
    const totalCount = response.headers.get('x-total-count');
    if (totalCount) headers['x-total-count'] = totalCount;

    return new NextResponse(text, { status: response.status, headers });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'laptime_bridge_unreachable' },
      { status: 502 },
    );
  } finally {
    clearTimeout(timeout);
  }
}
