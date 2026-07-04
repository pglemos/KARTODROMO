import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import {
  getChampionshipRegistrationsAdminKey,
  getChampionshipServiceClient,
  type ChampionshipRegistrationStatus,
} from '@/lib/championship-registrations';
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
    const supabase = getChampionshipServiceClient();
    const { data, error } = await supabase.rpc('kartodromo_list_campeonato_inscricoes', {
      p_admin_key: getChampionshipRegistrationsAdminKey(),
      p_evento: evento || null,
      p_limit: limit,
      p_offset: offset,
      p_q: q || null,
      p_status: status && statusValues.includes(status) ? status : null,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const payload = data as { data?: unknown[]; total?: number } | null;
    const rows = Array.isArray(payload?.data) ? payload.data : [];

    return NextResponse.json(rows, {
      headers: { 'x-total-count': String(payload?.total ?? rows.length) },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'championship_registrations_unavailable';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
