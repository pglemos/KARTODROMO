import { NextRequest, NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { requireAdminSession } from '@/lib/require-admin-session';
import { handleAdminD1, type AdminD1Database } from '@/lib/admin-d1';

declare global {
  interface CloudflareEnv {
    KARTODROMO_ADMIN_DB?: AdminD1Database;
  }
}

export const dynamic = 'force-dynamic';

const TIMEOUT_MS = Number(process.env.CALXPRO_BRIDGE_TIMEOUT_MS || '8000');

const ALLOWED_SLUGS = new Set(['receitas', 'creditos', 'corridas', 'corrida-competidores']);

function resolveBridgeBase(): string | null {
  const endpoint = process.env.LIVETIME_SNAPSHOT_ENDPOINT;
  if (!endpoint) return null;
  return endpoint.replace(/\/api\/livetime-snapshot.*$/, '').replace(/\/+$/, '');
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ segments: string[] }> }) {
  const session = await requireAdminSession('/admin');

  const { segments } = await params;
  const slug = segments[0];
  if (!slug || !ALLOWED_SLUGS.has(slug)) {
    return NextResponse.json({ error: 'unknown_calxpro_path' }, { status: 404 });
  }

  // Try bridge first (dados reais do SQL local via tunnel/scraper)
  const base = resolveBridgeBase();
  if (base) {
    const targetUrl = `${base}/api/calxpro-${slug}${request.nextUrl.search}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await fetch(targetUrl, {
        headers: { 'ngrok-skip-browser-warning': 'true' },
        signal: controller.signal,
        cache: 'no-store',
      });

      if (response.ok) {
        const text = await response.text();
        const headers: Record<string, string> = { 'content-type': 'application/json; charset=utf-8' };
        const totalCount = response.headers.get('x-total-count');
        if (totalCount) headers['x-total-count'] = totalCount;
        return new NextResponse(text, { status: response.status, headers });
      }
    } catch {
      // bridge fallback
    } finally {
      clearTimeout(timeout);
    }
  }

  // Fallback: D1 (dados de semente / manuais)
  try {
    const { env } = await getCloudflareContext({ async: true });
    if (env.KARTODROMO_ADMIN_DB) {
      const d1Resource = slug === 'corridas' ? 'corridas' : slug === 'receitas' ? 'financeiro_lancamentos' : null;
      if (d1Resource) {
        return handleAdminD1(request, [d1Resource], env.KARTODROMO_ADMIN_DB, session.email);
      }
    }
  } catch {
    // D1 fallback
  }

  return NextResponse.json([], { headers: { 'content-type': 'application/json', 'x-total-count': '0' } });
}
