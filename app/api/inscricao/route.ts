import {
  generateRegistrationProtocol,
  normalizeChampionshipRegistration,
  validateChampionshipRegistration,
  type ChampionshipRegistrationInput,
} from '@/lib/championship-registrations';
import { createChampionshipRegistration } from '@/lib/championship-registrations-d1';
import { getCloudflareAdminDb } from '@/lib/cloudflare-admin-db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAX_CONTENT_LENGTH = 30000;
const TWO_HUNDRED_MILHAS_OPEN_AT = Date.parse('2026-10-05T10:00:00-03:00');
const TWO_HUNDRED_MILHAS_DEADLINE = Date.parse('2027-01-10T23:59:59-03:00');

const jsonResponse = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });

const readEnv = (...keys: string[]) => {
  for (const key of keys) {
    const value = process.env[key];
    if (value) return value;
  }
  return '';
};

async function forwardToWebhook(body: unknown) {
  const user = readEnv('FORM_MANAGEMENT_USER', 'FORM_MANAGERMENT_USER', 'VITE_FORM_MANAGERMENT_USER');
  const key = readEnv('FORM_MANAGEMENT_KEY', 'FORM_MANAGERMENT_KEY', 'VITE_FORM_MANAGERMENT_KEY');
  const webhookUrl = readEnv('FORM_WEBHOOK_URL', 'VITE_WEBHOOK_URL');

  if (!user || !key || !webhookUrl) return;

  const credentials = btoa(`${user}:${key}`);
  await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  }).catch(() => undefined);
}

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > MAX_CONTENT_LENGTH) {
    return jsonResponse({ error: 'Payload too large' }, 413);
  }

  let rawBody: ChampionshipRegistrationInput;
  try {
    rawBody = (await request.json()) as ChampionshipRegistrationInput;
  } catch {
    return jsonResponse({ error: 'Payload inválido.' }, 400);
  }

  const payload = normalizeChampionshipRegistration(rawBody);
  const validationErrors = validateChampionshipRegistration(payload);

  if (validationErrors.length > 0) {
    return jsonResponse({ error: 'Invalid registration payload', details: validationErrors }, 400);
  }

  if (payload.campeonato_id === '200-milhas') {
    const now = Date.now();
    if (now < TWO_HUNDRED_MILHAS_OPEN_AT) {
      return jsonResponse({ error: 'As inscrições das 200 Milhas de Betim 2027 abrem em 05/10/2026 às 10h (horário de Brasília).' }, 409);
    }
    if (now > TWO_HUNDRED_MILHAS_DEADLINE) {
      return jsonResponse({ error: 'As inscrições das 200 Milhas de Betim 2027 estão encerradas.' }, 409);
    }
  }

  try {
    const db = await getCloudflareAdminDb();
    if (!db) return jsonResponse({ error: 'cloudflare_d1_not_configured' }, 503);

    const protocol = generateRegistrationProtocol();
    const row = await createChampionshipRegistration(db, payload, protocol);

    await forwardToWebhook({ ...rawBody, protocol });

    return jsonResponse({
      ok: true,
      id: row.id,
      protocol: row.protocol,
      status: row.status,
      message: 'Inscrição recebida com sucesso.',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to process registration';
    return jsonResponse({ error: message }, 500);
  }
}
