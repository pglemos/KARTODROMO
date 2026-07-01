import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { adminCookieName, verifyAdminSession } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const TIMEOUT_MS = Number(process.env.CALXPRO_BRIDGE_TIMEOUT_MS || '8000');

const ALLOWED_SLUGS = new Set(['contatos', 'receitas', 'creditos', 'corridas', 'corrida-competidores']);

async function requireSession() {
  const cookieStore = await cookies();
  return verifyAdminSession(cookieStore.get(adminCookieName())?.value);
}

function resolveBridgeBase(): string | null {
  const endpoint = process.env.LIVETIME_SNAPSHOT_ENDPOINT;
  if (!endpoint) return null;
  return endpoint.replace(/\/api\/livetime-snapshot.*$/, '').replace(/\/+$/, '');
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ segments: string[] }> }) {
  if (!(await requireSession())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { segments } = await params;
  const slug = segments[0];
  if (!slug || !ALLOWED_SLUGS.has(slug)) {
    return NextResponse.json({ error: 'unknown_calxpro_path' }, { status: 404 });
  }

  const base = resolveBridgeBase();
  if (!base) {
    return NextResponse.json({ error: 'calxpro_bridge_not_configured' }, { status: 503 });
  }

  const targetUrl = `${base}/api/calxpro-${slug}${request.nextUrl.search}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(targetUrl, {
      headers: { 'ngrok-skip-browser-warning': 'true' },
      signal: controller.signal,
      cache: 'no-store',
    });

    const text = await response.text();
    const headers: Record<string, string> = { 'content-type': 'application/json; charset=utf-8' };
    const totalCount = response.headers.get('x-total-count');
    if (totalCount) headers['x-total-count'] = totalCount;

    return new NextResponse(text, { status: response.status, headers });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'calxpro_bridge_unreachable' },
      { status: 502 },
    );
  } finally {
    clearTimeout(timeout);
  }
}
