import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import {
  type ChampionshipRegistrationStatus,
} from '@/lib/championship-registrations';
import { getCloudflareAdminDb } from '@/lib/cloudflare-admin-db';
import { updateChampionshipRegistration } from '@/lib/championship-registrations-d1';
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
    const db = await getCloudflareAdminDb();
    if (!db) return NextResponse.json({ error: 'cloudflare_d1_not_configured' }, { status: 503 });
    return NextResponse.json(await updateChampionshipRegistration(db, id, update));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'championship_registration_update_failed';
    return NextResponse.json({ error: message }, { status: message.endsWith('_not_found') ? 404 : 500 });
  }
}
