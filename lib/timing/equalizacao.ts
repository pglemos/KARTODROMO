/**
 * Equalização dos karts (Planilha de Gestão de Frota, Oficina e Equalização v3).
 *
 * A equalização é uma bateria da cronometragem do tipo "equalizacao": as voltas vêm do decoder como sempre, mas ficam
 * separadas das baterias normais (não entram no ranking, nos resultados nem no e-mail dos pilotos).
 *
 * Regras:
 * - Karts referência (2 ou 3): todas as voltas valem; a meta é a média das melhores voltas deles (ou a meta fixa
 *   do traçado, se o cronometrista escolher).
 * - Demais karts: as voltas válidas formam blocos de 2. Cada bloco é um redutor: bloco 1 = sem redutor, bloco 2 =
 *   redutor 1... (a cada 2 voltas o kart troca de redutor para chegar perto da meta). O redutor de um bloco pode ser
 *   corrigido à mão.
 * - Vale o ÚLTIMO bloco completo (o redutor que está no kart agora): média dentro de meta ± tolerância (padrão
 *   0,080 s) = EQUALIZADO com aquele redutor. Fora: AJUSTANDO enquanto a equalização está aberta e REVISAR (oficina)
 *   depois de finalizada. O redutor pode deixar o kart mais rápido ou mais lento: não se presume o sentido.
 */
import type { Competitor, Session } from './race-engine';

export const TOLERANCIA_PADRAO_MS = 80;
export const SISTEMAS_KART = ['chassi', 'pneu', 'motor', 'embreagem', 'freio'] as const;
export type SistemaKart = (typeof SISTEMAS_KART)[number];
export type StatusSistema = 'ok' | 'atencao' | 'critico';

export type ChecklistKart = {
  sistemas?: Partial<Record<SistemaKart, { status: StatusSistema; nota?: string }>>;
  observacoes?: string;
  /** ação da oficina / peças */
  acaoOficina?: string;
  atualizadoEm?: number;
  autor?: string;
};

export type ConfigEqualizacao = {
  trackId?: string | null;
  /** referencia = média das melhores voltas dos karts referência; fixa = meta escolhida para o traçado */
  metaModo?: 'referencia' | 'fixa';
  metaFixaMs?: number | null;
  toleranciaMs?: number;
  /** números dos karts referência (2 ou 3) */
  referencias?: string[];
  /** correção manual do redutor de um bloco: { "08": { "2": 3 } } = bloco 2 do kart 08 foi com o redutor 3 */
  redutores?: Record<string, Record<string, number>>;
  checklist?: Record<string, ChecklistKart>;
  finalizadaEm?: number | null;
  mecanico?: string;
};

export type BlocoEqualizacao = { bloco: number; redutor: number; voltasMs: number[]; mediaMs: number | null; deltaMs: number | null; dentro: boolean; completo: boolean };
export type StatusKart = 'REF' | 'EQUALIZADO' | 'AJUSTANDO' | 'REVISAR' | 'SEM VOLTAS';

export type KartEqualizacao = {
  kart: string;
  piloto: string;
  referencia: boolean;
  voltas: number;
  melhorMs: number | null;
  mediaMs: number | null;
  blocos: BlocoEqualizacao[];
  redutorFinal: number | null;
  status: StatusKart;
  acao: string;
  checklist: ChecklistKart | null;
};

export type ResultadoEqualizacao = {
  metaMs: number | null;
  metaOrigem: 'referencia' | 'fixa' | 'sem-meta';
  toleranciaMs: number;
  referencias: { kart: string; melhorMs: number | null; mediaMs: number | null; voltas: number }[];
  karts: KartEqualizacao[];
};

const nomeRedutor = (r: number) => (r === 0 ? 'sem redutor' : `redutor ${r}`);

function voltasValidas(c: Competitor) {
  const ativas = c.crossings.filter((x) => !x.deleted).sort((a, b) => a.wallMs - b.wallMs);
  return ativas.slice(1).filter((x) => x.lapMs != null && x.lapMs > 0 && !x.invalid).map((x) => x.lapMs as number);
}

const media = (v: number[]) => (v.length ? Math.round(v.reduce((s, x) => s + x, 0) / v.length) : null);

const seg = (ms: number) => (Math.abs(ms) / 1000).toFixed(3).replace('.', ',');

export function calcularEqualizacao(s: Session, cfg: ConfigEqualizacao = s.equalizacao ?? {}): ResultadoEqualizacao {
  const finalizada = cfg.finalizadaEm != null || s.state === 'encerrada' || s.state === 'cancelada';
  const tol = Number(cfg.toleranciaMs) > 0 ? Number(cfg.toleranciaMs) : TOLERANCIA_PADRAO_MS;
  const refs = new Set((cfg.referencias ?? []).map((k) => String(k).trim()).filter(Boolean));
  const competidores = s.competitors.filter((c) => !c.detalhes?.oculto);
  const referencias = competidores.filter((c) => refs.has(c.kart)).map((c) => {
    const v = voltasValidas(c);
    return { kart: c.kart, melhorMs: v.length ? Math.min(...v) : null, mediaMs: media(v), voltas: v.length };
  });
  referencias.sort((a, b) => a.kart.localeCompare(b.kart, 'pt-BR', { numeric: true }));
  const melhoresRefs = referencias.map((r) => r.melhorMs).filter((x): x is number => x != null);
  let metaMs: number | null = null;
  let metaOrigem: ResultadoEqualizacao['metaOrigem'] = 'sem-meta';
  if (cfg.metaModo === 'fixa' && Number(cfg.metaFixaMs) > 0) { metaMs = Math.round(Number(cfg.metaFixaMs)); metaOrigem = 'fixa'; }
  else if (melhoresRefs.length) { metaMs = media(melhoresRefs); metaOrigem = 'referencia'; }

  const karts = competidores.map((c): KartEqualizacao => {
    const v = voltasValidas(c);
    const base = { kart: c.kart, piloto: c.name, voltas: v.length, melhorMs: v.length ? Math.min(...v) : null, mediaMs: media(v), checklist: cfg.checklist?.[c.kart] ?? null };
    if (refs.has(c.kart)) return { ...base, referencia: true, blocos: [], redutorFinal: 0, status: 'REF', acao: 'Mantido como base de comparação' };
    const blocos: BlocoEqualizacao[] = [];
    for (let i = 0; i < v.length; i += 2) {
      const n = i / 2 + 1;
      const voltasMs = v.slice(i, i + 2);
      const redutor = cfg.redutores?.[c.kart]?.[String(n)] ?? n - 1;
      const m = media(voltasMs);
      const delta = m != null && metaMs != null ? m - metaMs : null;
      blocos.push({ bloco: n, redutor, voltasMs, mediaMs: m, deltaMs: delta, dentro: delta != null && Math.abs(delta) <= tol, completo: voltasMs.length === 2 });
    }
    const completos = blocos.filter((b) => b.completo);
    let status: StatusKart = 'SEM VOLTAS';
    let acao = 'Aguardando 2 voltas';
    let redutorFinal: number | null = null;
    const ultimo = completos[completos.length - 1];
    const anterior = completos[completos.length - 2];
    if (metaMs == null && completos.length) { status = 'AJUSTANDO'; redutorFinal = ultimo.redutor; acao = 'Defina os karts referência ou a meta do traçado'; }
    else if (ultimo?.dentro) {
      status = 'EQUALIZADO'; redutorFinal = ultimo.redutor;
      acao = ultimo.redutor === 0 ? 'Liberado sem redutor' : `Instalar o ${nomeRedutor(ultimo.redutor)} e liberar`;
    } else if (ultimo) {
      const d = ultimo.deltaMs ?? 0;
      const quanto = `${seg(d)} s ${d > 0 ? 'mais lento' : 'mais rápido'} que a meta`;
      // piorou em relação ao bloco anterior: o redutor não trouxe ganho
      const semGanho = anterior != null && Math.abs(d) >= Math.abs(anterior.deltaMs ?? 0);
      const perto = [...completos].sort((a, b) => Math.abs(a.deltaMs ?? 1e9) - Math.abs(b.deltaMs ?? 1e9))[0];
      redutorFinal = finalizada ? perto.redutor : ultimo.redutor;
      if (finalizada) { status = 'REVISAR'; acao = `Não chegou na meta (${quanto}; o mais perto foi o ${nomeRedutor(perto.redutor)}): encaminhar para a oficina`; }
      else { status = 'AJUSTANDO'; acao = semGanho ? `Sem ganho com o ${nomeRedutor(ultimo.redutor)} (${quanto}): voltar ao anterior ou encaminhar para a oficina` : `${quanto}: trocar o redutor e dar mais 2 voltas`; }
    } else if (blocos.length) acao = 'Falta 1 volta para fechar o bloco';
    if (status === 'SEM VOLTAS' && finalizada) acao = 'Não andou nesta equalização';
    // o que a oficina escreveu vale mais que a sugestão automática
    const daOficina = cfg.checklist?.[c.kart]?.acaoOficina?.trim();
    if (daOficina) acao = daOficina;
    return { ...base, referencia: false, blocos, redutorFinal, status, acao };
  });
  karts.sort((a, b) => Number(b.referencia) - Number(a.referencia) || a.kart.localeCompare(b.kart, 'pt-BR', { numeric: true }));
  return { metaMs, metaOrigem, toleranciaMs: tol, referencias, karts };
}

/**
 * Voltas que cada kart deu nas baterias normais (não equalização, finalizadas) num intervalo — "entre uma equalização e
 * outra". kartDaPassagem: o kart físico (transponder) de cada passagem.
 */
export function voltasNasBaterias(sessions: Iterable<Session>, deMs: number | null, ateMs: number | null, kartDaPassagem: (kart: string, transponder: number | null | undefined) => string) {
  const out = new Map<string, { voltas: number; baterias: Set<string> }>();
  for (const s of sessions) {
    if (s.type === 'equalizacao' || (s.state !== 'encerrada' && s.state !== 'bandeira_final')) continue;
    for (const c of s.competitors) {
      const ativas = c.crossings.filter((x) => !x.deleted).sort((a, b) => a.wallMs - b.wallMs);
      ativas.forEach((x, i) => {
        if (i === 0 || x.lapMs == null) return;
        if (deMs != null && x.wallMs < deMs) return;
        if (ateMs != null && x.wallMs > ateMs) return;
        const k = kartDaPassagem(c.kart, x.transponder);
        if (!out.has(k)) out.set(k, { voltas: 0, baterias: new Set() });
        const e = out.get(k)!;
        e.voltas++; e.baterias.add(s.id);
      });
    }
  }
  return new Map([...out].map(([k, e]) => [k, { voltas: e.voltas, baterias: e.baterias.size }]));
}

/** Momento em que cada kart foi equalizado pela última vez antes de `antesDe` (para contar as voltas desde então). */
export function ultimaEqualizacaoPorKart(sessions: Iterable<Session>, antesDe: number) {
  const out = new Map<string, number>();
  for (const s of sessions) {
    if (s.type !== 'equalizacao' || s.state === 'cancelada') continue;
    const quando = s.equalizacao?.finalizadaEm ?? s.finishedAt ?? s.startedAt ?? s.createdAt;
    if (quando >= antesDe) continue;
    for (const c of s.competitors) if (c.crossings.some((x) => !x.deleted)) out.set(c.kart, Math.max(out.get(c.kart) ?? 0, quando));
  }
  return out;
}
