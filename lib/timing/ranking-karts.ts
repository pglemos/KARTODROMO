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
  /** categoria(s) permitida(s), em minúsculas e sem acentos; lista vazia não inclui nenhuma categoria */
  categorias?: string[] | null;
  /** categoria herdada do grupo/prova quando uma sessão antiga não a gravou no competidor */
  categoriaDaBateria?: (s: Session) => string | null;
  /** extensão do traçado de cada bateria (m): descarta voltas impossíveis (média acima de 120 km/h), como as de teste */
  extensaoM?: (s: Session) => number;
};

/** Traçados importados com o sufixo "(Chuva)" representam pista molhada. */
export function condicaoChuvaPeloTracado(nome: string | null | undefined) {
  return /\bchuva\b/i.test(String(nome ?? ''));
}

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
  /** bateria da melhor volta: o ranking troca o traçado dela ali mesmo */
  melhorSessionId: string;
  melhorTracado: string;
  /** a melhor volta foi registrada em condição de chuva */
  chuva: boolean;
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
  tracado: string;
  piloto: string;
  /** a bateria foi realizada em condição de chuva */
  chuva: boolean;
  voltas: number;
  melhorMs: number;
  medianaMs: number;
};

type Volta = { kart: string; lapMs: number; wallMs: number; s: Session; piloto: string; chuva: boolean; tracado: string };

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

function chaveCategoria(valor: string | null | undefined) {
  return String(valor ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase('pt-BR');
}

/** Voltas válidas filtradas do período. */
export function voltasDoPeriodo(sessions: Iterable<Session>, o: RankingKartsOpcoes, trackDe: (s: Session) => string | null, kartDaPassagem: (kart: string, transponder: number | null | undefined) => string, nomeTracado: (s: Session) => string = (s) => s.trackId || 'Traçado principal', filtroKart?: string): Volta[] {
  const out: Volta[] = [];
  for (const s of sessions) {
    if (s.state !== 'encerrada' && s.state !== 'bandeira_final') continue;
    const dia = dataBrasilia(s.startedAt ?? s.createdAt);
    if (o.de && dia < o.de) continue;
    if (o.ate && dia > o.ate) continue;
    if (o.trackId && trackDe(s) !== o.trackId) continue;
    if (o.tipos?.length && !o.tipos.includes(s.type)) continue;
    if (s.type === 'equalizacao' && !o.tipos?.includes('equalizacao')) continue;
    const minimo = o.extensaoM ? voltaMinimaPlausivelMs(o.extensaoM(s)) : 0;
    const tracado = nomeTracado(s);
    const chuva = s.chuva === true;

    for (const c of s.competitors) {
      if (o.categorias != null && !o.categorias.includes(chaveCategoria(c.category || o.categoriaDaBateria?.(s)))) continue;
      const ativas = c.crossings.filter((x) => !x.deleted).sort((a, b) => a.wallMs - b.wallMs);
      for (let i = 1; i < ativas.length; i++) {
        const x = ativas[i];
        if (x.lapMs === null || x.invalid || x.lapMs <= 0 || x.lapMs < minimo) continue;
        const kart = kartDaPassagem(c.kart, x.transponder);
        if (filtroKart && kart !== filtroKart) continue;
        out.push({ kart, lapMs: x.lapMs, wallMs: x.wallMs, s, piloto: c.name, chuva, tracado });
      }
    }
  }
  return out;
}

type KartAcumulado = {
  tempos: number[];
  melhor: { lapMs: number; wallMs: number; sId: string; sName: string; piloto: string; chuva: boolean; tracado: string } | null;
  baterias: Set<string>;
  pilotos: Set<string>;
  ultimaWallMs: number;
};

export function rankingKarts(sessions: Iterable<Session>, o: RankingKartsOpcoes, trackDe: (s: Session) => string | null, kartDaPassagem: (kart: string, transponder: number | null | undefined) => string, nomeTracado: (s: Session) => string = (s) => s.trackId || 'Traçado principal'): KartRanking[] {
  // Item 34: Acumulação direta sem array plano intermediário gigante para prevenir GC Stop-The-World
  const porKart = new Map<string, KartAcumulado>();

  for (const s of sessions) {
    if (s.state !== 'encerrada' && s.state !== 'bandeira_final') continue;
    const dia = dataBrasilia(s.startedAt ?? s.createdAt);
    if (o.de && dia < o.de) continue;
    if (o.ate && dia > o.ate) continue;
    if (o.trackId && trackDe(s) !== o.trackId) continue;
    if (o.tipos?.length && !o.tipos.includes(s.type)) continue;
    if (s.type === 'equalizacao' && !o.tipos?.includes('equalizacao')) continue;
    const minimo = o.extensaoM ? voltaMinimaPlausivelMs(o.extensaoM(s)) : 0;
    const tracado = nomeTracado(s);
    const chuva = s.chuva === true;

    for (const c of s.competitors) {
      if (o.categorias != null && !o.categorias.includes(chaveCategoria(c.category || o.categoriaDaBateria?.(s)))) continue;
      const ativas = c.crossings.filter((x) => !x.deleted).sort((a, b) => a.wallMs - b.wallMs);
      for (let i = 1; i < ativas.length; i++) {
        const x = ativas[i];
        if (x.lapMs === null || x.invalid || x.lapMs <= 0 || x.lapMs < minimo) continue;
        const kart = kartDaPassagem(c.kart, x.transponder);
        let ac = porKart.get(kart);
        if (!ac) {
          ac = { tempos: [], melhor: null, baterias: new Set(), pilotos: new Set(), ultimaWallMs: 0 };
          porKart.set(kart, ac);
        }
        ac.tempos.push(x.lapMs);
        ac.baterias.add(s.id);
        const pNorm = c.name.trim().toLowerCase();
        if (pNorm) ac.pilotos.add(pNorm);
        if (x.wallMs > ac.ultimaWallMs) ac.ultimaWallMs = x.wallMs;
        if (!ac.melhor || x.lapMs < ac.melhor.lapMs) {
          ac.melhor = { lapMs: x.lapMs, wallMs: x.wallMs, sId: s.id, sName: s.name, piloto: c.name, chuva, tracado };
        }
      }
    }
  }

  const linhas = [...porKart.entries()].map(([kart, ac]) => {
    const tempos = ac.tempos.sort((a, b) => a - b);
    const top = tempos.slice(0, 10);
    const melhor = ac.melhor!;
    return {
      posicao: 0,
      kart,
      melhorMs: melhor.lapMs,
      melhorPiloto: melhor.piloto,
      melhorData: dataBrasilia(melhor.wallMs),
      melhorBateria: melhor.sName,
      melhorSessionId: melhor.sId,
      melhorTracado: melhor.tracado,
      chuva: melhor.chuva,
      media10Ms: Math.round(top.reduce((t, v) => t + v, 0) / top.length),
      medianaMs: mediana(tempos),
      voltas: tempos.length,
      baterias: ac.baterias.size,
      pilotos: ac.pilotos.size,
      ultimaVez: dataBrasilia(ac.ultimaWallMs),
    } satisfies KartRanking;
  });
  linhas.sort((a, b) => a.melhorMs - b.melhorMs || a.media10Ms - b.media10Ms || a.kart.localeCompare(b.kart, 'pt-BR', { numeric: true }));
  linhas.forEach((l, i) => { l.posicao = i + 1; });
  return linhas;
}

/** Cada bateria em que o kart andou no período (mais recente primeiro). */
export function historicoDoKart(sessions: Iterable<Session>, kart: string, o: RankingKartsOpcoes, trackDe: (s: Session) => string | null, kartDaPassagem: (kart: string, transponder: number | null | undefined) => string, nomeTracado: (s: Session) => string = (s) => s.trackId || 'Traçado principal'): KartHistorico[] {
  const porBateria = new Map<string, Volta[]>();
  for (const v of voltasDoPeriodo(sessions, o, trackDe, kartDaPassagem, nomeTracado)) {
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
      tracado: vs[0].tracado,
      piloto: vs[0].piloto,
      chuva: s.chuva === true,
      voltas: vs.length,
      melhorMs: Math.min(...vs.map((v) => v.lapMs)),
      medianaMs: mediana(vs.map((v) => v.lapMs)),
      _ordem: inicio,
    };
  }).sort((a, b) => b._ordem - a._ordem).map((h) => { const { _ordem: _descartado, ...resto } = h; void _descartado; return resto; });
}
