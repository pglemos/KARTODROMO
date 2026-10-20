import { authenticateMobileRequest, type MobileAuthEnv } from './auth';

export interface MobileResultsEnv extends MobileAuthEnv {
  MOBILE_PUBLISH_TOKEN?: string;
  MOBILE_ADMIN_TOKEN?: string;
}

type ResultInput = {
  customerId: string;
  displayName: string;
  position: number;
  kart: string;
  laps: number;
  bestLapMs: number | null;
};
type Publication = {
  sessionId: string;
  eventName: string;
  eventDate: string;
  results: ResultInput[];
};
type ResultRow = {
  session_id: string;
  customer_id: string;
  event_name: string;
  event_date: string;
  display_name: string;
  position: number;
  kart: string;
  laps: number;
  best_lap_ms: number | null;
  status: 'published' | 'withdrawn';
};

const encoder = new TextEncoder();
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
});
const invalid = () => json(400, { erro: 'Dados de publicação inválidos.' });
const unavailable = () => json(503, { erro: 'Não foi possível concluir agora. Tente novamente.' });

function constantTimeEqual(left: string, right: string) {
  if (!left || left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index++) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

function authorized(request: Request, expected: string | undefined, header: string) {
  return Boolean(expected && constantTimeEqual(request.headers.get(header) ?? '', expected));
}

async function parseBody(request: Request) {
  if (Number(request.headers.get('content-length') ?? 0) > 64_000) return null;
  const raw = await request.text();
  if (encoder.encode(raw).length > 64_000) return null;
  try {
    const body = JSON.parse(raw) as unknown;
    return body !== null && typeof body === 'object' && !Array.isArray(body) ? body as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function isDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function parsePublication(body: Record<string, unknown>): Publication | null {
  const sessionId = typeof body.sessionId === 'string' ? body.sessionId.trim() : '';
  const eventName = typeof body.eventName === 'string' ? body.eventName.trim() : '';
  if (!/^[A-Za-z0-9._:-]{1,128}$/.test(sessionId) || !eventName || eventName.length > 160 || !isDate(body.eventDate)) return null;
  if (!Array.isArray(body.results) || body.results.length < 1 || body.results.length > 100) return null;
  const seen = new Set<string>();
  const results: ResultInput[] = [];
  for (const value of body.results) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const row = value as Record<string, unknown>;
    const customerId = typeof row.customerId === 'string' ? row.customerId.trim() : '';
    const displayName = typeof row.displayName === 'string' ? row.displayName.replace(/\s+/g, ' ').trim() : '';
    const kart = typeof row.kart === 'string' ? row.kart.trim() : '';
    const position = Number(row.position);
    const laps = Number(row.laps);
    const bestLapMs = row.bestLapMs === null ? null : Number(row.bestLapMs);
    if (!/^\d{1,20}$/.test(customerId) || seen.has(customerId) || !displayName || displayName.length > 80 ||
        !kart || kart.length > 40 || !Number.isSafeInteger(position) || position < 1 || position > 1000 ||
        !Number.isSafeInteger(laps) || laps < 0 || laps > 10_000 ||
        (bestLapMs !== null && (!Number.isSafeInteger(bestLapMs) || bestLapMs < 1 || bestLapMs > 600_000))) return null;
    seen.add(customerId);
    results.push({ customerId, displayName, position, kart, laps, bestLapMs });
  }
  return { sessionId, eventName, eventDate: body.eventDate, results };
}

function publicResult(row: ResultRow) {
  return {
    displayName: row.display_name,
    position: Number(row.position),
    kart: row.kart,
    laps: Number(row.laps),
    bestLapMs: row.best_lap_ms == null ? null : Number(row.best_lap_ms),
  };
}

function auditJson(row: ResultRow | null) {
  return row ? JSON.stringify({
    eventName: row.event_name,
    eventDate: row.event_date,
    ...publicResult(row),
    status: row.status,
  }) : null;
}

function identical(previous: ResultRow, publication: Publication, result: ResultInput) {
  return previous.status === 'published' && previous.event_name === publication.eventName &&
    previous.event_date === publication.eventDate && previous.display_name === result.displayName &&
    Number(previous.position) === result.position && previous.kart === result.kart &&
    Number(previous.laps) === result.laps && (previous.best_lap_ms == null ? null : Number(previous.best_lap_ms)) === result.bestLapMs;
}

async function publish(env: MobileResultsEnv, body: Record<string, unknown>) {
  if (!env.MOBILE_DB || !env.MOBILE_PUBLISH_TOKEN) return unavailable();
  if (body.action !== 'publish') return invalid();
  const publication = parsePublication(body);
  if (!publication) return invalid();

  const existing = await env.MOBILE_DB.prepare('SELECT * FROM mobile_results WHERE session_id = ?')
    .bind(publication.sessionId).all<ResultRow>();
  const previousByCustomer = new Map(existing.results.map((row) => [row.customer_id, row]));
  const nextByCustomer = new Set(publication.results.map((row) => row.customerId));
  const now = Date.now();
  const statements: D1PreparedStatement[] = [];

  for (const result of publication.results) {
    const previous = previousByCustomer.get(result.customerId) ?? null;
    if (previous && identical(previous, publication, result)) continue;
    const current: ResultRow = {
      session_id: publication.sessionId,
      customer_id: result.customerId,
      event_name: publication.eventName,
      event_date: publication.eventDate,
      display_name: result.displayName,
      position: result.position,
      kart: result.kart,
      laps: result.laps,
      best_lap_ms: result.bestLapMs,
      status: 'published',
    };
    statements.push(env.MOBILE_DB.prepare(
      `INSERT INTO mobile_results(session_id, customer_id, event_name, event_date, display_name, position, kart, laps, best_lap_ms, status, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'published', ?)
       ON CONFLICT(session_id, customer_id) DO UPDATE SET event_name = excluded.event_name,
         event_date = excluded.event_date, display_name = excluded.display_name, position = excluded.position,
         kart = excluded.kart, laps = excluded.laps, best_lap_ms = excluded.best_lap_ms,
         status = 'published', updated_at = excluded.updated_at`,
    ).bind(publication.sessionId, result.customerId, publication.eventName, publication.eventDate,
      result.displayName, result.position, result.kart, result.laps, result.bestLapMs, now));
    statements.push(env.MOBILE_DB.prepare(
      `INSERT INTO mobile_results_audit(session_id, customer_id, action, previous_json, current_json, actor, changed_at)
       VALUES (?, ?, ?, ?, ?, 'timing-server', ?)`,
    ).bind(publication.sessionId, result.customerId, previous ? 'correct' : 'publish', auditJson(previous), auditJson(current), now));
  }

  for (const previous of existing.results) {
    if (previous.status !== 'published' || nextByCustomer.has(previous.customer_id)) continue;
    statements.push(env.MOBILE_DB.prepare(
      `UPDATE mobile_results SET status = 'withdrawn', updated_at = ? WHERE session_id = ? AND customer_id = ?`,
    ).bind(now, publication.sessionId, previous.customer_id));
    statements.push(env.MOBILE_DB.prepare(
      `INSERT INTO mobile_results_audit(session_id, customer_id, action, previous_json, current_json, actor, changed_at)
       VALUES (?, ?, 'withdraw', ?, NULL, 'timing-server', ?)`,
    ).bind(publication.sessionId, previous.customer_id, auditJson(previous), now));
  }

  if (statements.length) await env.MOBILE_DB.batch(statements);
  return json(200, { ok: true, status: 'published' });
}

async function withdraw(env: MobileResultsEnv, body: Record<string, unknown>) {
  if (!env.MOBILE_DB || !env.MOBILE_PUBLISH_TOKEN) return unavailable();
  const sessionId = typeof body.sessionId === 'string' ? body.sessionId.trim() : '';
  if (!/^[A-Za-z0-9._:-]{1,128}$/.test(sessionId)) return invalid();
  const rows = await env.MOBILE_DB.prepare('SELECT * FROM mobile_results WHERE session_id = ?')
    .bind(sessionId).all<ResultRow>();
  const now = Date.now();
  const active = rows.results.filter((row) => row.status === 'published');
  const statements: D1PreparedStatement[] = [];
  for (const row of active) {
    statements.push(env.MOBILE_DB.prepare(
      `UPDATE mobile_results SET status = 'withdrawn', updated_at = ? WHERE session_id = ? AND customer_id = ?`,
    ).bind(now, sessionId, row.customer_id));
    statements.push(env.MOBILE_DB.prepare(
      `INSERT INTO mobile_results_audit(session_id, customer_id, action, previous_json, current_json, actor, changed_at)
       VALUES (?, ?, 'withdraw', ?, NULL, 'timing-server', ?)`,
    ).bind(sessionId, row.customer_id, auditJson(row), now));
  }
  if (!rows.results.length) {
    statements.push(env.MOBILE_DB.prepare(
      `INSERT INTO mobile_results_audit(session_id, customer_id, action, previous_json, current_json, actor, changed_at)
       VALUES (?, NULL, 'withdraw', NULL, NULL, 'timing-server', ?)`,
    ).bind(sessionId, now));
  }
  if (statements.length) await env.MOBILE_DB.batch(statements);
  return json(200, { ok: true, status: 'withdrawn' });
}

async function emailLookup(env: MobileResultsEnv, email: string) {
  if (!env.MOBILE_LOOKUP_KEY) return null;
  const key = await crypto.subtle.importKey('raw', encoder.encode(env.MOBILE_LOOKUP_KEY),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(`email:${email.trim().toLowerCase()}`)));
  let binary = '';
  for (const byte of signature) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function linkIdentity(request: Request, env: MobileResultsEnv) {
  if (!env.MOBILE_DB || !env.MOBILE_ADMIN_TOKEN || !env.MOBILE_LOOKUP_KEY ||
      env.MOBILE_ADMIN_TOKEN === env.MOBILE_PUBLISH_TOKEN) return unavailable();
  if (!authorized(request, env.MOBILE_ADMIN_TOKEN, 'x-mobile-admin-token')) return json(401, { erro: 'Não autorizado.' });
  const body = await parseBody(request);
  const customerId = typeof body?.customerId === 'string' ? body.customerId.trim() : '';
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!/^\d{1,20}$/.test(customerId) || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return invalid();
  const lookup = await emailLookup(env, email);
  if (!lookup) return unavailable();
  const account = await env.MOBILE_DB.prepare(
    'SELECT id FROM mobile_accounts WHERE email_lookup = ? AND email_verified_at IS NOT NULL LIMIT 1',
  ).bind(lookup).first<{ id: string }>();
  if (!account) return json(404, { erro: 'Não foi possível validar o e-mail informado.' });
  const now = Date.now();
  await env.MOBILE_DB.batch([
    env.MOBILE_DB.prepare(
      `INSERT OR IGNORE INTO mobile_identity_links(customer_id, account_id, linked_at) VALUES (?, ?, ?)`,
    ).bind(customerId, account.id, now),
    env.MOBILE_DB.prepare(
      `INSERT OR IGNORE INTO mobile_identity_link_audit(customer_id, account_id, action, changed_at)
       SELECT ?, ?, 'linked', ? WHERE EXISTS (
         SELECT 1 FROM mobile_identity_links WHERE customer_id = ? AND account_id = ?
       )`,
    ).bind(customerId, account.id, now, customerId, account.id),
  ]);
  const link = await env.MOBILE_DB.prepare(
    'SELECT account_id FROM mobile_identity_links WHERE customer_id = ? LIMIT 1',
  ).bind(customerId).first<{ account_id: string }>();
  if (link?.account_id !== account.id) return json(409, { erro: 'Este cliente ou esta conta já está vinculado.' });
  return json(200, { ok: true });
}

async function publicResults(env: MobileResultsEnv) {
  if (!env.MOBILE_DB) return unavailable();
  const sessions = await env.MOBILE_DB.prepare(
    `SELECT session_id, event_name, event_date FROM mobile_results WHERE status = 'published'
     GROUP BY session_id, event_name, event_date ORDER BY event_date DESC, session_id DESC LIMIT 200`,
  ).all<{ session_id: string; event_name: string; event_date: string }>();
  const results = [];
  for (const session of sessions.results) {
    const rows = await env.MOBILE_DB.prepare(
      `SELECT display_name, position, kart, laps, best_lap_ms FROM mobile_results
       WHERE session_id = ? AND status = 'published' ORDER BY position, display_name LIMIT 100`,
    ).bind(session.session_id).all<{
      display_name: string; position: number; kart: string; laps: number; best_lap_ms: number | null;
    }>();
    results.push({
      sessionId: session.session_id,
      eventName: session.event_name,
      eventDate: session.event_date,
      results: rows.results.map((row) => ({
        displayName: row.display_name,
        position: Number(row.position),
        kart: row.kart,
        laps: Number(row.laps),
        bestLapMs: row.best_lap_ms == null ? null : Number(row.best_lap_ms),
      })),
    });
  }
  return json(200, results);
}

async function personalResults(request: Request, env: MobileResultsEnv) {
  const account = await authenticateMobileRequest(request, env);
  if (!account) return json(401, { erro: 'Sessão inválida ou expirada.' });
  if (!env.MOBILE_DB) return unavailable();
  const link = await env.MOBILE_DB.prepare(
    'SELECT customer_id FROM mobile_identity_links WHERE account_id = ? LIMIT 1',
  ).bind(account.id).first<{ customer_id: string }>();
  if (!link) return json(200, {
    vinculo: 'pendente',
    mensagem: 'Para ver seu histórico, procure a recepção.',
    results: [],
  });
  const rows = await env.MOBILE_DB.prepare(
    `SELECT session_id, event_name, event_date, display_name, position, kart, laps, best_lap_ms
     FROM mobile_results WHERE customer_id = ? AND status = 'published'
     ORDER BY event_date DESC, session_id DESC, position LIMIT 500`,
  ).bind(link.customer_id).all<Record<string, unknown>>();
  return json(200, {
    vinculo: 'validado',
    results: rows.results.map((row) => ({
      sessionId: row.session_id,
      eventName: row.event_name,
      eventDate: row.event_date,
      displayName: row.display_name,
      position: Number(row.position),
      kart: row.kart,
      laps: Number(row.laps),
      bestLapMs: row.best_lap_ms == null ? null : Number(row.best_lap_ms),
    })),
  });
}

export async function handleMobileResults(request: Request, env: MobileResultsEnv) {
  const path = new URL(request.url).pathname;
  try {
    if (path === '/api/mobile/v1/internal/results') {
      if (request.method !== 'POST') return json(405, { erro: 'Método não permitido.' });
      if (!env.MOBILE_DB || !env.MOBILE_PUBLISH_TOKEN) return unavailable();
      if (!authorized(request, env.MOBILE_PUBLISH_TOKEN, 'x-mobile-publish-token')) return json(401, { erro: 'Não autorizado.' });
      const body = await parseBody(request);
      if (!body) return invalid();
      if (body.action === 'withdraw') {
        return await withdraw(env, body);
      }
      return await publish(env, body);
    }
    if (path === '/api/mobile/v1/internal/identity-links') {
      if (request.method !== 'POST') return json(405, { erro: 'Método não permitido.' });
      return await linkIdentity(request, env);
    }
    if (path === '/api/mobile/v1/results') {
      if (request.method !== 'GET') return json(405, { erro: 'Método não permitido.' });
      return await publicResults(env);
    }
    if (path === '/api/mobile/v1/results/me') {
      if (request.method !== 'GET') return json(405, { erro: 'Método não permitido.' });
      return await personalResults(request, env);
    }
    return json(404, { erro: 'Rota desconhecida.' });
  } catch {
    return unavailable();
  }
}
