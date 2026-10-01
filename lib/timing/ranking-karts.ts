/**
 * Ranking dos karts: todo o histórico de voltas de cada kart (não do piloto), no período escolhido
 * (dia, semana, mês ou personalizado). Serve para saber qual kart anda mais e acompanhar a manutenção.
 */
import type { Session, SessionType } from './race-engine';

export type RankingKartsOpcoes = {
  /** AAAA-MM-DD, inclusive (data da bateria no horário de Brasília) */
  de?: string | null;
  ate?: string | null;
  trackId?: string | null;
  tipos?: SessionType[] | null;
  /** extensão do traçado de cada bateria (m): descarta voltas impossíveis (média acima de 120 km/h), como as de teste */
  extensaoM?: (s: Session) => number;
};

/** Volta mais rápida que isto (média acima de 120 km/h) é leitura errada ou bateria de teste. */
export function voltaMinimaPlausivelMs(extensaoM: number) {
  return Math.round((extensaoM / (120 / 3.6)) * 1000);
}

export type KartRanking = {
  posicao: number;
  kart: string;
  melhorMs: number;
  melhorPiloto: string;
  melhorData: string;
  melhorBateria: string;
  /** média das 10 melhores voltas do kart no período */
  media10Ms: number;
  /** mediana de todas as voltas válidas (mostra o ritmo normal, sem deixar a volta de box pesar) */
  medianaMs: number;
  voltas: number;
  baterias: number;
  pilotos: number;
  ultimaVez: string;
};

export type KartHistorico = {
  sessionId: string;
  data: string;
  hora: string;
  bateria: string;
  tipo: SessionType;
  piloto: string;
  voltas: number;
  melhorMs: number;
  medianaMs: number;
};

type Volta = { kart: string; lapMs: number; wallMs: number; s: Session; piloto: string };

export function dataBrasilia(ms: number) {
  return new Date(ms).toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
}

function horaBrasilia(ms: number) {
  return new Date(ms).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });
}

function mediana(v: number[]) {
  const o = [...v].sort((a, b) => a - b);
  const m = Math.floor(o.length / 2);
  return o.length % 2 ? o[m] : Math.round((o[m - 1] + o[m]) / 2);
}

/** Voltas válidas das baterias finalizadas no período, já com o kart físico de cada volta. */
function voltasDoPeriodo(sessions: Iterable<Session>, o: RankingKartsOpcoes, trackDe: (s: Session) => string | null, kartDaPassagem: (kart: string, transponder: number | null | undefined) => string): Volta[] {
  const out: Volta[] = [];
  for (const s of sessions) {
    if (s.state !== 'encerrada' && s.state !== 'bandeira_final') continue;
    const dia = dataBrasilia(s.startedAt ?? s.createdAt);
    if (o.de && dia < o.de) continue;
    if (o.ate && dia > o.ate) continue;
    if (o.trackId && trackDe(s) !== o.trackId) continue;
    if (o.tipos?.length && !o.tipos.includes(s.type)) continue;
    const minimo = o.extensaoM ? voltaMinimaPlausivelMs(o.extensaoM(s)) : 0;
    for (const c of s.competitors) {
      const ativas = c.crossings.filter((x) => !x.deleted).sort((a, b) => a.wallMs - b.wallMs);
      ativas.forEach((x, i) => {
        if (i === 0 || x.lapMs === null || x.invalid || x.lapMs <= 0 || x.lapMs < minimo) return;
        out.push({ kart: kartDaPassagem(c.kart, x.transponder), lapMs: x.lapMs, wallMs: x.wallMs, s, piloto: c.name });
      });
    }
  }
  return out;
}

export function rankingKarts(sessions: Iterable<Session>, o: RankingKartsOpcoes, trackDe: (s: Session) => string | null, kartDaPassagem: (kart: string, transponder: number | null | undefined) => string): KartRanking[] {
  const porKart = new Map<string, Volta[]>();
  for (const v of voltasDoPeriodo(sessions, o, trackDe, kartDaPassagem)) {
    if (!porKart.has(v.kart)) porKart.set(v.kart, []);
    porKart.get(v.kart)!.push(v);
  }
  const linhas = [...porKart.entries()].map(([kart, vs]) => {
    const ord = [...vs].sort((a, b) => a.lapMs - b.lapMs);
    const melhor = ord[0];
    const top = ord.slice(0, 10);
    return {
      posicao: 0,
      kart,
      melhorMs: melhor.lapMs,
      melhorPiloto: melhor.piloto,
      melhorData: dataBrasilia(melhor.wallMs),
      melhorBateria: melhor.s.name,
      media10Ms: Math.round(top.reduce((t, v) => t + v.lapMs, 0) / top.length),
      medianaMs: mediana(vs.map((v) => v.lapMs)),
      voltas: vs.length,
      baterias: new Set(vs.map((v) => v.s.id)).size,
      pilotos: new Set(vs.map((v) => v.piloto.trim().toLowerCase())).size,
      ultimaVez: dataBrasilia(Math.max(...vs.map((v) => v.wallMs))),
    } satisfies KartRanking;
  });
  linhas.sort((a, b) => a.melhorMs - b.melhorMs || a.media10Ms - b.media10Ms || a.kart.localeCompare(b.kart, 'pt-BR', { numeric: true }));
  linhas.forEach((l, i) => { l.posicao = i + 1; });
  return linhas;
}

/** Cada bateria em que o kart andou no período (mais recente primeiro). */
export function historicoDoKart(sessions: Iterable<Session>, kart: string, o: RankingKartsOpcoes, trackDe: (s: Session) => string | null, kartDaPassagem: (kart: string, transponder: number | null | undefined) => string): KartHistorico[] {
  const porBateria = new Map<string, Volta[]>();
  for (const v of voltasDoPeriodo(sessions, o, trackDe, kartDaPassagem)) {
    if (v.kart !== kart) continue;
    const chave = `${v.s.id}|${v.piloto}`;
    if (!porBateria.has(chave)) porBateria.set(chave, []);
    porBateria.get(chave)!.push(v);
  }
  return [...porBateria.values()].map((vs) => {
    const s = vs[0].s;
    const inicio = s.startedAt ?? s.createdAt;
    return {
      sessionId: s.id,
      data: dataBrasilia(inicio),
      hora: horaBrasilia(inicio),
      bateria: s.name,
      tipo: s.type,
      piloto: vs[0].piloto,
      voltas: vs.length,
      melhorMs: Math.min(...vs.map((v) => v.lapMs)),
      medianaMs: mediana(vs.map((v) => v.lapMs)),
      _ordem: inicio,
    };
  }).sort((a, b) => b._ordem - a._ordem).map(({ _ordem, ...h }) => h);
}
