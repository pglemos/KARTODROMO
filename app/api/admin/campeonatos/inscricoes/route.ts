import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import {
  type ChampionshipRegistrationStatus,
} from '@/lib/championship-registrations';
import { getCloudflareAdminDb } from '@/lib/cloudflare-admin-db';
import { listChampionshipRegistrations } from '@/lib/championship-registrations-d1';
import { adminCookieName, verifyAdminSession } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const statusValues: ChampionshipRegistrationStatus[] = [
  'pendente',
  'em_analise',
  'confirmada',
  'recusada',
  'cancelada',
];

async function requireSession() {
  const cookieStore = await cookies();
  return verifyAdminSession(cookieStore.get(adminCookieName())?.value);
}

const cleanSearch = (value: string | null) => value?.trim().replace(/[,%]/g, ' ') ?? '';

export async function GET(request: NextRequest) {
  if (!(await requireSession())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const limit = Math.min(Math.max(Number(searchParams.get('limit') || 10), 1), 100);
  const offset = Math.max(Number(searchParams.get('offset') || 0), 0);
  const status = searchParams.get('status') as ChampionshipRegistrationStatus | null;
  const evento = searchParams.get('evento');
  const q = cleanSearch(searchParams.get('q'));

  try {
    const db = await getCloudflareAdminDb();
    if (!db) return NextResponse.json({ error: 'cloudflare_d1_not_configured' }, { status: 503 });

    const result = await listChampionshipRegistrations(db, {
      evento: evento || null,
      limit,
      offset,
      q: q || null,
      status: status && statusValues.includes(status) ? status : null,
    });

    return NextResponse.json(result.rows, {
      headers: { 'x-total-count': String(result.total) },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'championship_registrations_unavailable';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
