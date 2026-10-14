import { getGpsDatabase } from './local-db';
import type { GpsPoint } from './lap-detector';

export interface GpsLap {
  number: number;
  durationMs: number;
  crossedAt: number;
}

export interface GpsSessionSummary {
  id: string;
  startedAt: number;
  endedAt: number | null;
  lapCount: number;
  bestLapMs: number | null;
}

export async function createGpsSession(startedAt: number) {
  const id = `gps-${startedAt}-${Math.random().toString(36).slice(2)}`;
  const db = await getGpsDatabase();
  await db.runAsync('INSERT INTO gps_sessions (id, started_at) VALUES (?, ?)', id, startedAt);
  return id;
}

export async function saveGpsPoint(sessionId: string, point: GpsPoint) {
  if (!Number.isFinite(point.latitude) || point.latitude < -90 || point.latitude > 90 ||
      !Number.isFinite(point.longitude) || point.longitude < -180 || point.longitude > 180 ||
      !Number.isFinite(point.timestamp) || !Number.isFinite(point.accuracy) || point.accuracy < 0) {
    throw new Error('O ponto GPS recebido é inválido.');
  }
  const db = await getGpsDatabase();
  await db.runAsync(
    'INSERT INTO gps_points (session_id, timestamp, latitude, longitude, accuracy) VALUES (?, ?, ?, ?, ?)',
    sessionId, point.timestamp, point.latitude, point.longitude, point.accuracy,
  );
}

export async function saveGpsLap(sessionId: string, durationMs: number, crossedAt: number): Promise<GpsLap> {
  if (!Number.isSafeInteger(durationMs) || durationMs <= 0 || !Number.isFinite(crossedAt)) {
    throw new Error('A volta GPS recebida é inválida.');
  }
  const db = await getGpsDatabase();
  let lap: GpsLap | null = null;
  await db.withExclusiveTransactionAsync(async (transaction) => {
    const next = await transaction.getFirstAsync<{ number: number }>(
      'SELECT COALESCE(MAX(number), 0) + 1 AS number FROM gps_laps WHERE session_id = ?', sessionId,
    );
    const number = next?.number ?? 1;
    await transaction.runAsync(
      'INSERT INTO gps_laps (session_id, number, duration_ms, crossed_at) VALUES (?, ?, ?, ?)',
      sessionId, number, durationMs, crossedAt,
    );
    lap = { number, durationMs, crossedAt };
  });
  if (!lap) throw new Error('Não foi possível salvar a volta GPS.');
  return lap;
}

export async function pauseGpsSession(sessionId: string, endedAt: number) {
  const db = await getGpsDatabase();
  await db.runAsync('UPDATE gps_sessions SET ended_at = ? WHERE id = ?', endedAt, sessionId);
}

export async function resumeGpsSession(sessionId: string) {
  const db = await getGpsDatabase();
  await db.runAsync('UPDATE gps_sessions SET ended_at = NULL WHERE id = ?', sessionId);
}

export async function listGpsSessions() {
  const db = await getGpsDatabase();
  return db.getAllAsync<GpsSessionSummary>(`
    SELECT s.id, s.started_at AS startedAt, s.ended_at AS endedAt,
      COUNT(l.id) AS lapCount, MIN(l.duration_ms) AS bestLapMs
    FROM gps_sessions s LEFT JOIN gps_laps l ON l.session_id = s.id
    GROUP BY s.id ORDER BY s.started_at DESC LIMIT 50
  `);
}

export async function deleteGpsSession(sessionId: string) {
  const db = await getGpsDatabase();
  await db.runAsync('DELETE FROM gps_sessions WHERE id = ?', sessionId);
}
