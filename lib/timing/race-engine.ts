/** Motor de cronometragem sem IO: passagens, bandeiras, correcoes e classificacao. */

export type SessionType = 'treino' | 'classificacao' | 'corrida';
export type SessionState = 'preparando' | 'em_andamento' | 'bandeira_final' | 'encerrada' | 'cancelada';
export type RaceFlag = 'none' | 'green' | 'yellow' | 'red' | 'white' | 'checkered';

export type Crossing = {
  id?: string;
  decoderTimeMs: number;
  wallMs: number;
  /** tempo da volta que ESTA passagem fecha (null na primeira passagem) */
  lapMs: number | null;
  invalid?: boolean;
  deleted?: boolean;
  source?: 'decoder' | 'manual';
  transponder?: number | null;
  originalKart?: string;
};

export type Observation = { id: string; text: string; wallMs: number; author?: string };

export type Competitor = {
  kart: string;
  name: string;
  customerId?: string | null;
  category?: string | null;
  autoAdded?: boolean;
  flag?: RaceFlag;
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
  currentFlag?: RaceFlag;
  redFlagAt?: number | null;
  redFlagElapsedMs?: number | null;
  eventId?: string | null;
  groupId?: string | null;
  proofId?: string | null;
  observations?: Observation[];
  competitors: Competitor[];
};

export type Standing = {
  position: number;
  kart: string;
  name: string;
  category: string | null;
  laps: number;
  lastLapMs: number | null;
  bestLapMs: number | null;
  bestLapNumber: number | null;
  totalMs: number | null;
  averageSpeedKmh: number | null;
  /** corrida: diferença pro líder (ms) ou voltas; treino/classificação: diferença de melhor volta */
  gapMs: number | null;
  gapLaps: number;
  finished: boolean;
  autoAdded: boolean;
  lastCrossingWallMs: number | null;
};

const DAY_MS = 86_400_000;
/** Diferença aceitável entre o relógio do decoder e o do servidor numa volta (atraso de rede). */
const DECODER_CLOCK_TOLERANCE_MS = 3_000;
/** após a quadriculada, encerra sozinho depois desse tempo mesmo que algum kart não passe */
export const AUTO_CLOSE_AFTER_CHECKERED_MS = 3 * 60_000;

export function createSession(input: {
  id: string;
  name: string;
  type: SessionType;
  durationMin: number;
  maxLaps?: number | null;
  minLapSec?: number;
  now: number;
  competitors?: { kart: string; name: string; customerId?: string | null; category?: string | null }[];
  eventId?: string | null;
  groupId?: string | null;
  proofId?: string | null;
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
    currentFlag: 'none',
    redFlagAt: null,
    redFlagElapsedMs: null,
    eventId: input.eventId ?? null,
    groupId: input.groupId ?? null,
    proofId: input.proofId ?? null,
    observations: [],
    competitors: dedupeKarts(input.competitors ?? []).map((c) => ({
      kart: c.kart,
      name: c.name.trim(),
      customerId: c.customerId ?? null,
      category: c.category ?? null,
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

export function setCompetitors(session: Session, list: { kart: string; name: string; customerId?: string | null; category?: string | null }[]) {
  const previous = new Map(session.competitors.map((c) => [c.kart, c]));
  session.competitors = dedupeKarts(list).map((c) => {
    const old = previous.get(c.kart);
    return {
      kart: c.kart,
      name: c.name.trim(),
      customerId: c.customerId ?? old?.customerId ?? null,
      category: c.category ?? old?.category ?? null,
      autoAdded: false,
      flag: old?.flag ?? 'none',
      crossings: old?.crossings ?? [],
      finished: old?.finished ?? false,
    };
  });
}

export function startSession(session: Session, now: number) {
  if (session.state !== 'preparando') throw new Error('A bateria já foi iniciada.');
  session.state = 'em_andamento';
  session.startedAt = now;
  session.currentFlag = 'green';
}

export function elapsedMs(session: Session, now: number): number {
  if (session.startedAt === null) return 0;
  if (session.redFlagAt != null) return Math.max(0, session.redFlagElapsedMs ?? (session.redFlagAt - session.startedAt));
  return Math.max(0, (session.finishedAt ?? now) - session.startedAt);
}

export function setRaceFlag(session: Session, flag: Exclude<RaceFlag, 'none'>, now: number) {
  if (flag === 'green' && session.state === 'preparando') return startSession(session, now);
  if (session.state !== 'em_andamento' && session.state !== 'bandeira_final') throw new Error('A bateria precisa estar em andamento.');
  if (flag === 'red') {
    if (session.redFlagAt == null) {
      session.redFlagElapsedMs = elapsedMs(session, now);
      session.redFlagAt = now;
    }
    session.currentFlag = 'red';
    return;
  }
  if (session.redFlagAt != null) {
    const frozenElapsed = session.redFlagElapsedMs ?? 0;
    session.startedAt = now - frozenElapsed;
    session.redFlagAt = null;
    session.redFlagElapsedMs = null;
  }
  session.currentFlag = flag;
  if (flag === 'checkered') checkered(session, now);
}

export function checkered(session: Session, now: number) {
  if (session.state !== 'em_andamento') return;
  session.state = 'bandeira_final';
  session.checkeredAt = now;
  session.currentFlag = 'checkered';
}

export function closeSession(session: Session, now: number) {
  if (session.state === 'encerrada' || session.state === 'cancelada') return;
  if (session.state === 'preparando') {
    session.state = 'cancelada';
  } else {
    session.state = 'encerrada';
    session.checkeredAt ??= now;
    session.currentFlag = 'checkered';
  }
  session.finishedAt = now;
  session.redFlagAt = null;
}

export function cancelSession(session: Session, now: number) {
  session.state = 'cancelada';
  session.finishedAt = now;
  session.redFlagAt = null;
}

export type PassingResult = 'counted' | 'ignored-state' | 'ignored-min-lap' | 'ignored-finished' | 'ignored-red-flag';

function activeCrossings(competitor: Competitor) {
  return competitor.crossings.filter((x) => !x.deleted).sort((a, b) => a.wallMs - b.wallMs);
}

function lapDuration(previous: Crossing, current: Crossing) {
  if (current.source === 'manual' && current.lapMs !== null) return current.lapMs;
  // Depois de uma passagem manual, o relógio do decoder não foi sincronizado
  // com o valor digitado. Use o intervalo real entre os registros no diário.
  if (previous.source === 'manual') return Math.max(0, current.wallMs - previous.wallMs);
  let ms = current.decoderTimeMs - previous.decoderTimeMs;
  if (ms < 0) ms += DAY_MS;
  // O relógio do decoder é zerado a cada conexão (@RESET + ?;;;11;). Se a conexão caiu no
  // meio da prova, a diferença pelo decoder deixa de fazer sentido: usa o intervalo real.
  const wall = current.wallMs - previous.wallMs;
  if (wall > 0 && Math.abs(ms - wall) > DECODER_CLOCK_TOLERANCE_MS) return wall;
  return ms;
}

function recalculate(competitor: Competitor) {
  const active = activeCrossings(competitor);
  let previous: Crossing | null = null;
  active.forEach((crossing, i) => {
    if (i === 0 || previous === null) crossing.lapMs = null;
    else if (crossing.source !== 'manual' || crossing.lapMs === null) crossing.lapMs = lapDuration(previous, crossing);
    previous = crossing;
  });
}

/** Aplica uma passagem já renumerada. Karts fora do grid entram sozinhos (autoAdded). */
export function applyPassing(session: Session, p: { id?: string; kart: string; decoderTimeMs: number; wallMs: number; transponder?: number | null; source?: 'decoder' | 'manual' }): PassingResult {
  if (session.state !== 'em_andamento' && session.state !== 'bandeira_final') return 'ignored-state';
  if (session.redFlagAt != null || session.currentFlag === 'red') return 'ignored-red-flag';

  let comp = session.competitors.find((c) => c.kart === p.kart);
  if (!comp) {
    if (session.state === 'bandeira_final') return 'ignored-state';
    comp = { kart: p.kart, name: `Kart ${p.kart}`, autoAdded: true, flag: 'none', crossings: [], finished: false };
    session.competitors.push(comp);
  }
  if (comp.finished) return 'ignored-finished';

  const active = activeCrossings(comp);
  const last = active[active.length - 1];
  const lapMs = last ? lapDuration(last, { decoderTimeMs: p.decoderTimeMs, wallMs: p.wallMs, lapMs: null }) : null;
  if (lapMs !== null && lapMs < session.minLapMs) return 'ignored-min-lap';

  comp.crossings.push({ id: p.id, decoderTimeMs: p.decoderTimeMs, wallMs: p.wallMs, lapMs, source: p.source ?? 'decoder', transponder: p.transponder ?? null });
  recalculate(comp);

  const laps = activeCrossings(comp).length - 1;
  if (session.state === 'bandeira_final' && lapMs !== null) {
    comp.finished = true;
  } else if (session.state === 'em_andamento' && session.maxLaps && laps >= session.maxLaps) {
    comp.finished = true;
    checkered(session, p.wallMs);
  }

  if (session.state === 'bandeira_final' && session.competitors.every((c) => c.finished || activeCrossings(c).length === 0)) closeSession(session, p.wallMs);
  return 'counted';
}

/** Inclui uma volta manual usando o tempo informado, sem depender do decoder. */
export function includeManualPassing(session: Session, p: { id: string; kart: string; lapMs: number; wallMs: number; name?: string; transponder?: number | null }) {
  if (!p.kart.trim()) throw new Error('Informe o número do kart.');
  if (!Number.isFinite(p.lapMs) || p.lapMs < session.minLapMs) throw new Error(`O tempo manual deve ser de pelo menos ${session.minLapMs / 1000} segundos.`);
  let competitor = session.competitors.find((c) => c.kart === p.kart);
  if (!competitor) {
    competitor = { kart: p.kart, name: p.name?.trim() || `Kart ${p.kart}`, flag: 'none', crossings: [], finished: false };
    session.competitors.push(competitor);
  }
  const active = activeCrossings(competitor);
  const previous = active[active.length - 1];
  const decoderTimeMs = previous ? (previous.decoderTimeMs + p.lapMs) % DAY_MS : (p.wallMs % DAY_MS);
  competitor.crossings.push({ id: p.id, decoderTimeMs, wallMs: p.wallMs, lapMs: previous ? p.lapMs : null, source: 'manual', transponder: p.transponder ?? null });
  recalculate(competitor);
  return competitor.crossings.find((x) => x.id === p.id)!;
}

export function locateCrossing(session: Session, id: string) {
  for (const competitor of session.competitors) {
    const crossing = competitor.crossings.find((x) => x.id === id);
    if (crossing) return { competitor, crossing };
  }
  return null;
}

export function setCrossingDeleted(session: Session, id: string, deleted: boolean) {
  const found = locateCrossing(session, id);
  if (!found) throw new Error('Passagem não encontrada.');
  found.crossing.deleted = deleted;
  recalculate(found.competitor);
  found.competitor.finished = false;
  return found;
}

export function setCrossingInvalid(session: Session, id: string, invalid: boolean) {
  const found = locateCrossing(session, id);
  if (!found) throw new Error('Passagem não encontrada.');
  if (found.crossing.lapMs === null) throw new Error('A primeira passagem do kart não fecha uma volta.');
  found.crossing.invalid = invalid;
  return found;
}

/** Transfere uma passagem para outro kart; o vínculo original permite cancelar a atribuição. */
export function assignCrossing(session: Session, id: string, kart: string | null, name?: string) {
  const found = locateCrossing(session, id);
  if (!found) throw new Error('Passagem não encontrada.');
  if (kart !== null && !kart.trim()) throw new Error('Informe o número do competidor.');
  if (!kart) {
    if (!found.crossing.originalKart) throw new Error('A passagem não tem atribuição para cancelar.');
    kart = found.crossing.originalKart;
  } else if (!found.crossing.originalKart) {
    found.crossing.originalKart = found.competitor.kart;
  }
  if (found.competitor.kart === kart) return found;
  found.competitor.crossings = found.competitor.crossings.filter((x) => x !== found.crossing);
  recalculate(found.competitor);
  let target = session.competitors.find((c) => c.kart === kart);
  if (!target) {
    target = { kart, name: name?.trim() || `Kart ${kart}`, flag: 'none', crossings: [], finished: false };
    session.competitors.push(target);
  }
  target.crossings.push(found.crossing);
  recalculate(target);
  return { competitor: target, crossing: found.crossing };
}

export function clearCrossings(session: Session) {
  for (const competitor of session.competitors) {
    for (const crossing of competitor.crossings) crossing.deleted = true;
    competitor.finished = false;
  }
}

/** Chamado periodicamente: quadriculada por tempo e auto-encerramento. */
export function tick(session: Session, now: number): boolean {
  const before = session.state;
  if (session.state === 'em_andamento' && session.durationMs > 0 && session.startedAt !== null && session.redFlagAt == null) {
    if (elapsedMs(session, now) >= session.durationMs) checkered(session, now);
  }
  if (session.state === 'bandeira_final' && session.checkeredAt !== null) {
    if (now - session.checkeredAt >= AUTO_CLOSE_AFTER_CHECKERED_MS) closeSession(session, now);
  }
  return before !== session.state;
}

export function toggleLapInvalid(session: Session, kart: string, lapNumber: number) {
  const comp = session.competitors.find((c) => c.kart === kart);
  const crossing = comp ? activeCrossings(comp)[lapNumber] : undefined;
  if (!crossing || crossing.lapMs === null) throw new Error('Volta não encontrada.');
  crossing.invalid = !crossing.invalid;
}

export function remainingMs(session: Session, now: number): number | null {
  if (!session.durationMs || session.startedAt === null) return session.durationMs || null;
  if (session.state !== 'em_andamento') return 0;
  return Math.max(0, session.durationMs - elapsedMs(session, now));
}

export function computeStandings(session: Session, trackLengthMeters = 1_000): Standing[] {
  const rows = session.competitors.map((c) => {
    const crossings = activeCrossings(c);
    const laps = Math.max(0, crossings.length - 1);
    let best: number | null = null;
    let bestN: number | null = null;
    crossings.forEach((x, i) => {
      if (x.lapMs === null || x.invalid) return;
      if (best === null || x.lapMs < best) {
        best = x.lapMs;
        bestN = i;
      }
    });
    const lastCrossing = crossings[crossings.length - 1];
    const first = crossings[0];
    let total: number | null = null;
    if (first && lastCrossing && laps > 0) total = crossings.slice(1).reduce((sum, crossing) => sum + (crossing.lapMs ?? 0), 0);
    return {
      c,
      laps,
      best: best as number | null,
      bestN: bestN as number | null,
      lastLap: lastCrossing?.lapMs ?? null,
      total,
      averageSpeed: total && total > 0 ? (laps * trackLengthMeters * 3_600) / total : null,
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
      category: r.c.category ?? null,
      laps: r.laps,
      lastLapMs: r.lastLap,
      bestLapMs: r.best,
      bestLapNumber: r.bestN,
      totalMs: r.total,
      averageSpeedKmh: r.averageSpeed,
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
