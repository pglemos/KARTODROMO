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

type RouteContext = { params: Promise<{ id: string }> };

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

export async function PATCH(request: NextRequest, context: RouteContext) {
  if (!(await requireSession())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as {
    status?: ChampionshipRegistrationStatus;
    admin_notes?: string | null;
  };

  const update: { status?: ChampionshipRegistrationStatus; admin_notes?: string | null; reviewed_at?: string } = {};

  if (body.status !== undefined) {
    if (!statusValues.includes(body.status)) {
      return NextResponse.json({ error: 'status_invalid' }, { status: 400 });
    }
    update.status = body.status;
    update.reviewed_at = new Date().toISOString();
  }

  if (body.admin_notes !== undefined) {
    update.admin_notes = body.admin_notes?.trim() || null;
  }

  if (!Object.keys(update).length) {
    return NextResponse.json({ error: 'empty_update' }, { status: 400 });
  }

  try {
    const supabase = getChampionshipServiceClient();
    const { data, error } = await supabase.rpc('kartodromo_update_campeonato_inscricao', {
      p_admin_key: getChampionshipRegistrationsAdminKey(),
      p_admin_notes: update.admin_notes ?? null,
      p_id: id,
      p_status: update.status ?? null,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'championship_registration_update_failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
