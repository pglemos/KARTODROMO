/**
 * Motor de cronometragem (sem IO). Recebe passagens ja renumeradas (kart) e mantem o estado
 * de uma bateria: voltas, melhor volta, classificacao, bandeira quadriculada e encerramento.
 *
 * Regras herdadas do uso real no LapTime (dbo.Racing do espelho):
 *  - Fim por tempo (EndType=1): Tomada de Tempo 5 min, Corrida 20 min.
 *  - Tempo minimo de volta 5s (passagens mais proximas que isso sao descartadas).
 *  - A 1a passagem pela linha abre a volta 1 (nao gera tempo).
 *  - Depois da quadriculada, a proxima passagem de cada kart encerra a prova dele.
 */

export type SessionType = 'treino' | 'classificacao' | 'corrida';
export type SessionState = 'preparando' | 'em_andamento' | 'bandeira_final' | 'encerrada' | 'cancelada';

export type Crossing = {
  decoderTimeMs: number;
  wallMs: number;
  /** tempo da volta que ESTA passagem fecha (null na 1a passagem) */
  lapMs: number | null;
  invalid?: boolean;
};

export type Competitor = {
  kart: string;
  name: string;
  customerId?: string | null;
  autoAdded?: boolean;
  crossings: Crossing[];
  finished: boolean;
};

export type Session = {
  id: string;
  name: string;
  type: SessionType;
  durationMs: number;
  maxLaps: number | null;
  minLapMs: number;
  state: SessionState;
  createdAt: number;
  startedAt: number | null;
  checkeredAt: number | null;
  finishedAt: number | null;
  competitors: Competitor[];
};

export type Standing = {
  position: number;
  kart: string;
  name: string;
  laps: number;
  lastLapMs: number | null;
  bestLapMs: number | null;
  bestLapNumber: number | null;
  /** corrida: diferenca pro lider (ms) ou voltas; treino/classificacao: diferenca de melhor volta */
  gapMs: number | null;
  gapLaps: number;
  finished: boolean;
  autoAdded: boolean;
  lastCrossingWallMs: number | null;
};

const DAY_MS = 86_400_000;
/** apos a quadriculada, encerra sozinho depois desse tempo mesmo que algum kart nao passe */
export const AUTO_CLOSE_AFTER_CHECKERED_MS = 3 * 60_000;

export function createSession(input: {
  id: string;
  name: string;
  type: SessionType;
  durationMin: number;
  maxLaps?: number | null;
  minLapSec?: number;
  now: number;
  competitors?: { kart: string; name: string; customerId?: string | null }[];
}): Session {
  return {
    id: input.id,
    name: input.name.trim() || defaultName(input.type),
    type: input.type,
    durationMs: Math.max(0, Math.round(input.durationMin * 60_000)),
    maxLaps: input.maxLaps && input.maxLaps > 0 ? input.maxLaps : null,
    minLapMs: Math.round((input.minLapSec ?? 5) * 1000),
    state: 'preparando',
    createdAt: input.now,
    startedAt: null,
    checkeredAt: null,
    finishedAt: null,
    competitors: dedupeKarts(input.competitors ?? []).map((c) => ({
      kart: c.kart,
      name: c.name.trim(),
      customerId: c.customerId ?? null,
      crossings: [],
      finished: false,
    })),
  };
}

function defaultName(type: SessionType) {
  return type === 'corrida' ? 'Corrida' : type === 'classificacao' ? 'Tomada de Tempo' : 'Treino';
}

/** Um piloto por kart. Piloto sem kart ainda (veio da agenda) fica, desde que tenha nome. */
function dedupeKarts<T extends { kart: string; name?: string }>(list: T[]): T[] {
  const seen = new Set<string>();
  return list.filter((c) => {
    const k = String(c.kart).trim();
    if (!k) return Boolean(c.name?.trim());
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function setCompetitors(session: Session, list: { kart: string; name: string; customerId?: string | null }[]) {
  const previous = new Map(session.competitors.map((c) => [c.kart, c]));
  session.competitors = dedupeKarts(list).map((c) => {
    const old = previous.get(c.kart);
    return {
      kart: c.kart,
      name: c.name.trim(),
      customerId: c.customerId ?? old?.customerId ?? null,
      autoAdded: false,
      crossings: old?.crossings ?? [],
      finished: old?.finished ?? false,
    };
  });
}

export function startSession(session: Session, now: number) {
  if (session.state !== 'preparando') throw new Error('A bateria ja foi iniciada.');
  session.state = 'em_andamento';
  session.startedAt = now;
}

export function checkered(session: Session, now: number) {
  if (session.state !== 'em_andamento') return;
  session.state = 'bandeira_final';
  session.checkeredAt = now;
}

export function closeSession(session: Session, now: number) {
  if (session.state === 'encerrada' || session.state === 'cancelada') return;
  if (session.state === 'preparando') {
    session.state = 'cancelada';
  } else {
    session.state = 'encerrada';
    session.checkeredAt ??= now;
  }
  session.finishedAt = now;
}

export function cancelSession(session: Session, now: number) {
  session.state = 'cancelada';
  session.finishedAt = now;
}

export type PassingResult = 'counted' | 'ignored-state' | 'ignored-min-lap' | 'ignored-finished';

/** Aplica uma passagem ja renumerada. Karts fora do grid entram sozinhos (autoAdded). */
export function applyPassing(session: Session, p: { kart: string; decoderTimeMs: number; wallMs: number }): PassingResult {
  if (session.state !== 'em_andamento' && session.state !== 'bandeira_final') return 'ignored-state';

  let comp = session.competitors.find((c) => c.kart === p.kart);
  if (!comp) {
    // kart na pista sem ter sido lancado no grid: nao perde volta, entra como "Kart N"
    if (session.state === 'bandeira_final') return 'ignored-state';
    comp = { kart: p.kart, name: `Kart ${p.kart}`, autoAdded: true, crossings: [], finished: false };
    session.competitors.push(comp);
  }
  if (comp.finished) return 'ignored-finished';

  const last = comp.crossings[comp.crossings.length - 1];
  let lapMs: number | null = null;
  if (last) {
    lapMs = p.decoderTimeMs - last.decoderTimeMs;
    if (lapMs < 0) lapMs += DAY_MS; // relogio do decoder virou a meia-noite
    if (lapMs < session.minLapMs) return 'ignored-min-lap';
  }

  comp.crossings.push({ decoderTimeMs: p.decoderTimeMs, wallMs: p.wallMs, lapMs });

  const laps = comp.crossings.length - 1;
  if (session.state === 'bandeira_final' && lapMs !== null) {
    comp.finished = true;
  } else if (session.state === 'em_andamento' && session.maxLaps && laps >= session.maxLaps) {
    // lider completou o numero de voltas: quadriculada pra todo mundo
    comp.finished = true;
    checkered(session, p.wallMs);
  }

  if (session.state === 'bandeira_final' && session.competitors.every((c) => c.finished || c.crossings.length === 0)) {
    closeSession(session, p.wallMs);
  }
  return 'counted';
}

/** Chamado periodicamente: quadriculada por tempo e auto-encerramento. */
export function tick(session: Session, now: number): boolean {
  const before = session.state;
  if (session.state === 'em_andamento' && session.durationMs > 0 && session.startedAt !== null) {
    if (now - session.startedAt >= session.durationMs) checkered(session, now);
  }
  if (session.state === 'bandeira_final' && session.checkeredAt !== null) {
    if (now - session.checkeredAt >= AUTO_CLOSE_AFTER_CHECKERED_MS) closeSession(session, now);
  }
  return before !== session.state;
}

export function toggleLapInvalid(session: Session, kart: string, lapNumber: number) {
  const comp = session.competitors.find((c) => c.kart === kart);
  const crossing = comp?.crossings[lapNumber]; // volta N e fechada pela passagem de indice N
  if (!crossing || crossing.lapMs === null) throw new Error('Volta nao encontrada.');
  crossing.invalid = !crossing.invalid;
}

export function remainingMs(session: Session, now: number): number | null {
  if (!session.durationMs || session.startedAt === null) return session.durationMs || null;
  if (session.state !== 'em_andamento') return 0;
  return Math.max(0, session.durationMs - (now - session.startedAt));
}

export function computeStandings(session: Session): Standing[] {
  const rows = session.competitors.map((c) => {
    const laps = Math.max(0, c.crossings.length - 1);
    let best: number | null = null;
    let bestN: number | null = null;
    c.crossings.forEach((x, i) => {
      if (x.lapMs === null || x.invalid) return;
      if (best === null || x.lapMs < best) {
        best = x.lapMs;
        bestN = i;
      }
    });
    const lastCrossing = c.crossings[c.crossings.length - 1];
    const first = c.crossings[0];
    let total: number | null = null;
    if (first && lastCrossing && laps > 0) {
      total = lastCrossing.decoderTimeMs - first.decoderTimeMs;
      if (total < 0) total += DAY_MS;
    }
    return {
      c,
      laps,
      best: best as number | null,
      bestN: bestN as number | null,
      lastLap: lastCrossing?.lapMs ?? null,
      total,
      lastWall: lastCrossing?.wallMs ?? null,
    };
  });

  if (session.type === 'corrida') {
    rows.sort((a, b) => {
      if (b.laps !== a.laps) return b.laps - a.laps;
      if (a.total === null || b.total === null) return (a.total === null ? 1 : 0) - (b.total === null ? 1 : 0);
      return a.total - b.total;
    });
  } else {
    rows.sort((a, b) => {
      if (a.best === null || b.best === null) return (a.best === null ? 1 : 0) - (b.best === null ? 1 : 0) || b.laps - a.laps;
      return a.best - b.best;
    });
  }

  const leader = rows[0];
  return rows.map((r, i) => {
    let gapMs: number | null = null;
    let gapLaps = 0;
    if (i > 0 && leader) {
      if (session.type === 'corrida') {
        gapLaps = leader.laps - r.laps;
        if (gapLaps === 0 && r.total !== null && leader.total !== null) gapMs = r.total - leader.total;
      } else if (r.best !== null && leader.best !== null) {
        gapMs = r.best - leader.best;
      }
    }
    return {
      position: i + 1,
      kart: r.c.kart,
      name: r.c.name,
      laps: r.laps,
      lastLapMs: r.lastLap,
      bestLapMs: r.best,
      bestLapNumber: r.bestN,
      gapMs,
      gapLaps,
      finished: r.c.finished,
      autoAdded: Boolean(r.c.autoAdded),
      lastCrossingWallMs: r.lastWall,
    };
  });
}

export function formatLap(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return '--';
  const totalSec = ms / 1000;
  const m = Math.floor(totalSec / 60);
  const s = totalSec - m * 60;
  return m > 0 ? `${m}:${s.toFixed(3).padStart(6, '0')}` : s.toFixed(3);
}
