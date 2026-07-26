import { NextRequest, NextResponse } from 'next/server';
import {
  getChampionshipRegistrationsAdminKey,
  getChampionshipServiceClient,
  type ChampionshipRegistrationStatus,
} from '@/lib/championship-registrations';
import { requireAdminSession } from '@/lib/require-admin-session';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

const statusValues: ChampionshipRegistrationStatus[] = [
  'pendente',
  'em_analise',
  'confirmada',
  'recusada',
  'cancelada',
];

export async function PATCH(request: NextRequest, context: RouteContext) {
  await requireAdminSession('/admin');

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
      return NextResponse.json({ ok: true, updated: false, id, message: error.message });
    }

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ ok: true, updated: false, id, message: error instanceof Error ? error.message : 'update_failed' });
  }
}
