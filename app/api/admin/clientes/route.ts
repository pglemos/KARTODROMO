import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { adminCookieName, readAdminSession } from '@/lib/admin-auth';
import { resolveBridgeBase, BRIDGE_FETCH_HEADERS } from '@/lib/bridge-base';
import { canAccessAny } from '@/lib/admin-access';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const TIMEOUT_MS = Number(process.env.CLIENTES_TIMEOUT_MS || '8000');

async function requireSession() {
  const cookieStore = await cookies();
  return readAdminSession(cookieStore.get(adminCookieName())?.value);
}

export async function GET(request: NextRequest) {
  const session = await requireSession();
  if (!session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  if (!canAccessAny(session.role, ['clientes', 'recepcao', 'reservas'])) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const base = resolveBridgeBase();
  if (!base) {
    return NextResponse.json({ error: 'laptime_bridge_not_configured' }, { status: 503 });
  }

  const targetUrl = `${base}/api/clientes${request.nextUrl.search}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(targetUrl, {
      headers: BRIDGE_FETCH_HEADERS,
      signal: controller.signal,
      cache: 'no-store',
    });

    const text = await response.text();
    const headers: Record<string, string> = { 'content-type': 'application/json; charset=utf-8' };
    const totalCount = response.headers.get('x-total-count');
    if (totalCount) headers['x-total-count'] = totalCount;

    return new NextResponse(text, { status: response.status, headers });
  } catch (error) {
    console.error('[admin/clientes] bridge request failed', error);
    return NextResponse.json(
      { error: error instanceof Error && error.name === 'AbortError' ? 'laptime_bridge_timeout' : 'laptime_bridge_unreachable' },
      { status: 502 },
    );
  } finally {
    clearTimeout(timeout);
  }
}
