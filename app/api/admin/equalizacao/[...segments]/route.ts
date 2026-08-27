import { NextRequest, NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { cookies } from 'next/headers';
import { adminCookieName, readAdminSession } from '@/lib/admin-auth';
import { canAccess, canWrite } from '@/src/admin/lib/rbac';
import { resolveBridgeBase, BRIDGE_FETCH_HEADERS } from '@/lib/bridge-base';
import { getLocalSQLiteDb, isLocalSQLiteAvailable } from '@/lib/local-sqlite-db';
import type { AdminD1Database } from '@/lib/admin-d1';
import {
  EQUALIZATION_CRITICAL_DELTA_MS,
  EQUALIZATION_TOLERANCE_MS,
  kartCategoryFromPlate,
  normalizedKartNumber,
  targetForKart,
} from '@/lib/equalizacao/kart';
import type { EqualizacaoLiveCandidate, EqualizacaoLiveSnapshot } from '@/lib/equalizacao/equalizacao-live.types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Row = Record<string, unknown>;

class ApiError extends Error {
  status: number;

  constructor(message: string, status = 422) {
    super(message);
    this.status = status;
  }
}

const BRIDGE_TIMEOUT_MS = Math.max(Number(process.env.LAPTIME_BRIDGE_TIMEOUT_MS || '20000'), 8_000);

const json = (body: unknown, status = 200) => NextResponse.json(body, { status });

async function getActor() {
  const cookieStore = await cookies();
  return readAdminSession(cookieStore.get(adminCookieName())?.value);
}

async function getDatabase(): Promise<AdminD1Database> {
  if (isLocalSQLiteAvailable()) {
    const localDb = getLocalSQLiteDb();
    if (localDb) return localDb;
  }

  try {
    const { env } = await getCloudflareContext({ async: true });
    if (env.KARTODROMO_ADMIN_DB) return env.KARTODROMO_ADMIN_DB;
  } catch {
    // Next dev without a Cloudflare binding falls through to the local adapter.
  }

  throw new ApiError('equalizacao_database_not_configured', 503);
}

async function fetchLiveSnapshot(): Promise<EqualizacaoLiveSnapshot> {
  const base = resolveBridgeBase();
  if (!base) throw new ApiError('laptime_bridge_not_configured', 503);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), BRIDGE_TIMEOUT_MS);
  try {
    const response = await fetch(`${base}/api/laptime-equalizacao-live`, {
      headers: BRIDGE_FETCH_HEADERS,
      signal: controller.signal,
      cache: 'no-store',
    });
    const text = await response.text();
    const body = text ? JSON.parse(text) as Record<string, unknown> : null;
    if (!response.ok) throw new ApiError(String(body?.error || `laptime_live_http_${response.status}`), 502);
    return body as unknown as EqualizacaoLiveSnapshot;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(error instanceof Error ? error.message : 'laptime_live_unreachable', 502);
  } finally {
    clearTimeout(timeout);
  }
}

async function readBody(request: NextRequest): Promise<Row> {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ApiError('invalid_payload', 400);
  return body as Row;
}

function rejectManualTimeFields(body: Row) {
  const manualFields = Object.keys(body).filter((key) => /tempo|volta|media|desvio|melhor|piloto|transponder/i.test(key));
  if (manualFields.length) throw new ApiError('manual_time_fields_not_allowed', 400);
}

async function getKart(db: AdminD1Database, kartId: string): Promise<Row> {
  const kart = await db.prepare('SELECT id, numero, categoria, ativo FROM karts WHERE id = ?').bind(kartId).first<Row>();
  if (!kart || !kart.ativo) throw new ApiError('kart_not_found', 404);
  return kart;
}

async function getSession(db: AdminD1Database, sessionId: string): Promise<Row> {
  const session = await db.prepare('SELECT * FROM karts_equalizacao_sessoes WHERE id = ?').bind(sessionId).first<Row>();
  if (!session) throw new ApiError('equalizacao_session_not_found', 404);
  return session;
}

function requireLiveRace(snapshot: EqualizacaoLiveSnapshot, session?: Row) {
  if (snapshot.status !== 'online' || !snapshot.race) throw new ApiError('no_qualifying_session', 409);
  if (session && String(session.racing_id) !== snapshot.race.id) throw new ApiError('qualifying_session_changed', 409);
}

function findCandidate(snapshot: EqualizacaoLiveSnapshot, kart: Row, competitorId?: string): EqualizacaoLiveCandidate {
  const kartNumber = normalizedKartNumber(kart.numero);
  const candidates = snapshot.candidates.filter((candidate) => normalizedKartNumber(candidate.kart) === kartNumber);
  const selected = competitorId ? candidates.find((candidate) => candidate.competitorId === competitorId) : candidates[0];
  if (!selected) throw new ApiError('kart_not_found_in_live_timing', 409);
  if (!competitorId && candidates.length > 1) throw new ApiError('kart_has_multiple_live_competitors', 409);
  if (selected.melhorVoltaMs === null || selected.mediaVoltaMs === null || selected.voltasValidas <= 0) {
    throw new ApiError('kart_without_valid_live_lap', 409);
  }
  return selected;
}

function captureView(row: Row): Row {
  return row;
}

async function startSession(db: AdminD1Database, actor: string, request: NextRequest) {
  const body = await readBody(request).catch(() => ({}));
  rejectManualTimeFields(body);
  const snapshot = await fetchLiveSnapshot();
  requireLiveRace(snapshot);

  const existing = await db.prepare(`SELECT * FROM karts_equalizacao_sessoes
    WHERE racing_id = ? AND status = 'aberta' ORDER BY created_at DESC LIMIT 1`).bind(snapshot.race?.id).first<Row>();
  if (existing) return { session: existing, snapshot, reused: true };

  const id = crypto.randomUUID();
  await db.prepare(`INSERT INTO karts_equalizacao_sessoes
    (id, racing_id, racing_name, racing_type, track_name, started_at, status, fonte, responsavel)
    VALUES (?, ?, ?, ?, ?, ?, 'aberta', 'cronometragem', ?)`)
    .bind(
      id,
      snapshot.race?.id,
      snapshot.race?.nome,
      snapshot.race?.tipo,
      snapshot.race?.pista,
      snapshot.race?.inicio || snapshot.atualizadoEm,
      actor,
    )
    .run();

  return { session: await getSession(db, id), snapshot, reused: false };
}

async function captureBefore(db: AdminD1Database, actor: string, sessionId: string, request: NextRequest) {
  const body = await readBody(request);
  rejectManualTimeFields(body);
  const kartId = String(body.kartId || '');
  if (!kartId) throw new ApiError('kart_id_required', 400);

  const session = await getSession(db, sessionId);
  if (session.status !== 'aberta') throw new ApiError('equalizacao_session_closed', 409);
  const snapshot = await fetchLiveSnapshot();
  requireLiveRace(snapshot, session);
  const kart = await getKart(db, kartId);
  const candidate = findCandidate(snapshot, kart, body.competitorId ? String(body.competitorId) : undefined);
  const existing = await db.prepare(`SELECT * FROM karts_equalizacao_capturas
    WHERE sessao_id = ? AND kart_id = ?`).bind(sessionId, kartId).first<Row>();
  if (existing) throw new ApiError(existing.status === 'completa' ? 'equalizacao_capture_already_complete' : 'equalizacao_before_already_captured', 409);

  const captureId = crypto.randomUUID();
  await db.prepare(`INSERT INTO karts_equalizacao_capturas
    (id, sessao_id, kart_id, racing_id, racing_competitor_id_antes, numero_kart, piloto_antes,
     transponder_antes, tempo_antes_ms, media_antes_ms, desvio_antes_ms, voltas_antes, volta_antes,
     capturado_antes_em, status, fonte, responsavel)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'antes', 'cronometragem', ?)`)
    .bind(
      captureId,
      sessionId,
      kartId,
      snapshot.race?.id,
      candidate.competitorId,
      candidate.kart,
      candidate.piloto,
      candidate.transponder,
      candidate.melhorVoltaMs,
      candidate.mediaVoltaMs,
      candidate.desvioMs,
      candidate.voltasValidas,
      candidate.ultimaVolta,
      snapshot.atualizadoEm,
      actor,
    )
    .run();

  const capture = await db.prepare('SELECT * FROM karts_equalizacao_capturas WHERE id = ?').bind(captureId).first<Row>();
  return { session, capture: captureView(capture || {}), candidate, snapshot };
}

async function captureAfter(db: AdminD1Database, actor: string, sessionId: string, request: NextRequest) {
  const body = await readBody(request);
  rejectManualTimeFields(body);
  const captureId = String(body.captureId || '');
  if (!captureId) throw new ApiError('capture_id_required', 400);

  const session = await getSession(db, sessionId);
  if (session.status !== 'aberta') throw new ApiError('equalizacao_session_closed', 409);
  const capture = await db.prepare('SELECT * FROM karts_equalizacao_capturas WHERE id = ? AND sessao_id = ?').bind(captureId, sessionId).first<Row>();
  if (!capture) throw new ApiError('equalizacao_capture_not_found', 404);
  if (capture.status === 'completa') throw new ApiError('equalizacao_capture_already_complete', 409);

  const snapshot = await fetchLiveSnapshot();
  requireLiveRace(snapshot, session);
  const kart = await getKart(db, String(capture.kart_id));
  const candidate = snapshot.candidates.find((item) => item.competitorId === String(capture.racing_competitor_id_antes))
    || findCandidate(snapshot, kart);
  const category = kartCategoryFromPlate(kart.numero);
  const target = targetForKart(kart.numero);
  if (target === null || category === 'unknown') throw new ApiError('kart_category_invalid', 422);
  if (candidate.mediaVoltaMs === null) throw new ApiError('kart_without_valid_live_lap', 409);

  const delta = Math.abs(candidate.mediaVoltaMs - target);
  const status = delta <= EQUALIZATION_TOLERANCE_MS ? 'aprovada' : delta <= EQUALIZATION_CRITICAL_DELTA_MS ? 'ajustar' : 'ajustar';
  const now = snapshot.atualizadoEm;
  const measurementId = crypto.randomUUID();
  const track = snapshot.race?.pista || `Tomada de tempo · ${snapshot.race?.nome || 'LapTime'}`;
  const observation = `Captura automática da cronometragem LapTime. Antes: ${capture.tempo_antes_ms} ms; depois: ${candidate.melhorVoltaMs} ms; corrida ${snapshot.race?.id}.`;

  await db.batch([
    db.prepare(`UPDATE karts_equalizacao_capturas SET
      racing_competitor_id_depois = ?, piloto_depois = ?, transponder_depois = ?, tempo_depois_ms = ?,
      media_depois_ms = ?, desvio_depois_ms = ?, voltas_depois = ?, volta_depois = ?,
      capturado_depois_em = ?, status = 'completa', responsavel = ?, updated_at = datetime('now')
      WHERE id = ?`).bind(
      candidate.competitorId,
      candidate.piloto,
      candidate.transponder,
      candidate.melhorVoltaMs,
      candidate.mediaVoltaMs,
      candidate.desvioMs,
      candidate.voltasValidas,
      candidate.ultimaVolta,
      now,
      actor,
      captureId,
    ),
    db.prepare(`INSERT INTO karts_equalizacoes
      (id, kart_id, categoria, piloto, traco, data, voltas_validas, melhor_volta_ms, media_ms, desvio_ms,
       alvo_ms, status, observacoes, sessao_id, captura_id, racing_id, racing_competitor_id, fonte,
       tempo_antes_ms, tempo_depois_ms, media_antes_ms, media_depois_ms, desvio_antes_ms, desvio_depois_ms,
       voltas_antes, voltas_depois, volta_antes, volta_depois, capturado_em, responsavel)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'cronometragem', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(
        measurementId,
        capture.kart_id,
        category,
        candidate.piloto,
        track,
        now,
        candidate.voltasValidas,
        candidate.melhorVoltaMs,
        candidate.mediaVoltaMs,
        candidate.desvioMs || 0,
        target,
        status,
        observation,
        sessionId,
        captureId,
        snapshot.race?.id,
        candidate.competitorId,
        capture.tempo_antes_ms,
        candidate.melhorVoltaMs,
        capture.media_antes_ms,
        candidate.mediaVoltaMs,
        capture.desvio_antes_ms,
        candidate.desvioMs,
        capture.voltas_antes,
        candidate.voltasValidas,
        capture.volta_antes,
        candidate.ultimaVolta,
        now,
        actor,
      ),
    db.prepare(`UPDATE karts SET
      ultimo_piloto_equalizacao = ?, traco_equalizacao = ?, media_equalizacao_ms = ?,
      melhor_equalizacao_ms = ?, desvio_equalizacao_ms = ?, ultima_equalizacao = ?
      WHERE id = ?`).bind(
      candidate.piloto,
      track,
      candidate.mediaVoltaMs,
      candidate.melhorVoltaMs,
      candidate.desvioMs || 0,
      now,
      capture.kart_id,
    ),
  ]);

  const updatedCapture = await db.prepare('SELECT * FROM karts_equalizacao_capturas WHERE id = ?').bind(captureId).first<Row>();
  const measurement = await db.prepare('SELECT * FROM karts_equalizacoes WHERE id = ?').bind(measurementId).first<Row>();
  return { session, capture: captureView(updatedCapture || {}), measurement: measurement || {}, candidate, snapshot };
}

async function sessionDetail(db: AdminD1Database, sessionId: string) {
  const session = await getSession(db, sessionId);
  const captures = await db.prepare(`SELECT * FROM karts_equalizacao_capturas
    WHERE sessao_id = ? ORDER BY created_at DESC`).bind(sessionId).all<Row>();
  return { session, captures: captures.results.map(captureView) };
}

async function closeSession(db: AdminD1Database, actor: string, sessionId: string) {
  const session = await getSession(db, sessionId);
  if (session.status === 'aberta') {
    await db.prepare(`UPDATE karts_equalizacao_sessoes SET status = 'encerrada', ended_at = datetime('now'), responsavel = ? WHERE id = ?`)
      .bind(actor, sessionId).run();
  }
  return sessionDetail(db, sessionId);
}

function errorResponse(error: unknown) {
  if (error instanceof ApiError) return json({ error: error.message }, error.status);
  console.error('[admin/equalizacao]', error);
  return json({ error: 'equalizacao_request_failed' }, 500);
}

async function authorize(write = false) {
  const session = await getActor();
  if (!session) throw new ApiError('unauthorized', 401);
  if (!canAccess(session.role, 'equalizacao')) throw new ApiError('forbidden', 403);
  if (write && !canWrite(session.role, 'equalizacao')) throw new ApiError('forbidden', 403);
  return session;
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ segments: string[] }> }) {
  try {
    await authorize();
    const segments = (await params).segments;
    if (segments[0] !== 'sessions' || !segments[1] || segments.length !== 2) return json({ error: 'equalizacao_path_not_found' }, 404);
    return json(await sessionDetail(await getDatabase(), segments[1]));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ segments: string[] }> }) {
  try {
    const actor = (await authorize(true)).email;
    const segments = (await params).segments;
    const db = await getDatabase();
    if (segments[0] !== 'sessions') return json({ error: 'equalizacao_path_not_found' }, 404);
    if (segments.length === 1) return json(await startSession(db, actor, request), 201);
    if (segments.length === 3 && segments[2] === 'before') return json(await captureBefore(db, actor, segments[1], request), 201);
    if (segments.length === 3 && segments[2] === 'after') return json(await captureAfter(db, actor, segments[1], request));
    if (segments.length === 3 && segments[2] === 'close') return json(await closeSession(db, actor, segments[1]));
    return json({ error: 'equalizacao_path_not_found' }, 404);
  } catch (error) {
    return errorResponse(error);
  }
}
