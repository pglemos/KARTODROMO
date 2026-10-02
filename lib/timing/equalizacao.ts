/**
 * Equalização dos karts (Planilha de Gestão de Frota, Oficina e Equalização v3).
 *
 * A equalização é uma bateria da cronometragem do tipo "equalizacao": as voltas vêm do decoder como sempre, mas ficam
 * separadas das baterias normais (não entram no ranking, nos resultados nem no e-mail dos pilotos).
 *
 * Regras:
 * - Karts referência (2 ou 3): todas as voltas valem; a meta é a MELHOR volta entre eles — não a média: o motor
 *   falha às vezes e as primeiras voltas são descartadas, então só a melhor volta serve de comparação (ou a meta fixa
 *   do traçado, se o cronometrista escolher).
 * - Demais karts: as voltas válidas formam blocos de 2. O bloco 1 é com o redutor que está no kart (o "inicial"); a
 *   cada 2 voltas o redutor é trocado para chegar perto da meta.
 * - O que se compara com a meta é a MELHOR volta do bloco, não a média das 2: uma volta lenta (tráfego, erro, saída
 *   de box) não pode virar "abrir 16 mm".
 * - Regra do redutor (por tipo de kart, editável): a diferença da melhor volta do bloco para a meta diz quanto mexer.
 *   Kart Indoor: até ±0,200 s = equalizado; de 0,200 a 0,400 s mais lento = abrir 0,1 mm; de 0,400 a 0,600 = abrir
 *   0,2 mm; e assim por diante (a cada 0,200 s, mais 0,1 mm). Mais rápido que a meta: o mesmo, com "fechar".
 * - O redutor de cada bloco é guardado como abertura em mm em relação ao inicial (+ aberto, − fechado). Presume-se
 *   que a oficina fez o ajuste sugerido no bloco anterior; dá para corrigir à mão. Com a medida do redutor inicial
 *   informada, tudo aparece na medida real (17,3 mm).
 * - Vale o ÚLTIMO bloco completo (o redutor que está no kart agora): dentro da tolerância = EQUALIZADO. Fora:
 *   AJUSTANDO enquanto a equalização está aberta e REVISAR (oficina) depois de finalizada.
 */
import type { Competitor, Session } from './race-engine';

/** Regra do redutor: até toleranciaMs = equalizado; depois, a cada faixaMs de diferença, passoMm de abertura. */
export type RegraRedutor = { nome?: string; toleranciaMs: number; faixaMs: number; passoMm: number };
export const REGRA_PADRAO = { nome: 'Kart Indoor', toleranciaMs: 200, faixaMs: 200, passoMm: 0.1 } as const;
export const TOLERANCIA_PADRAO_MS = REGRA_PADRAO.toleranciaMs;
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
  /** referencia = a melhor volta entre os karts referência; fixa = meta escolhida para o traçado */
  metaModo?: 'referencia' | 'fixa';
  metaFixaMs?: number | null;
  /** até quanto de diferença para a meta o kart está equalizado (a primeira faixa da regra do redutor) */
  toleranciaMs?: number;
  /** regra do redutor desta equalização (copiada do tipo de kart ao criar, pode ser ajustada) */
  regraNome?: string;
  faixaMs?: number;
  passoMm?: number;
  /** números dos karts referência (2 ou 3) */
  referencias?: string[];
  /** medida (mm) do redutor que estava no kart no bloco 1, quando conhecida: { "08": 17.2 } */
  redutorInicialMm?: Record<string, number>;
  /** correção manual: abertura do redutor de um bloco em relação ao inicial, em mm: { "08": { "2": 0.3 } } */
  aberturas?: Record<string, Record<string, number>>;
  checklist?: Record<string, ChecklistKart>;
  finalizadaEm?: number | null;
  mecanico?: string;
};

export type BlocoEqualizacao = {
  bloco: number;
  /** abertura do redutor deste bloco em relação ao inicial (mm; + aberto, − fechado) */
  aberturaMm: number;
  /** medida real do redutor (mm), quando a do inicial foi informada */
  redutorMm: number | null;
  /** "inicial", "+0,3 mm" ou "17,3 mm" */
  rotulo: string;
  voltasMs: number[];
  /** a melhor volta do bloco — é ela que se compara com a meta (deltaMs = melhorMs − meta) */
  melhorMs: number | null;
  mediaMs: number | null; deltaMs: number | null; dentro: boolean; completo: boolean;
  /** o que a regra manda fazer depois deste bloco (mm; + abrir, − fechar, 0 = equalizado); null sem meta ou incompleto */
  ajusteMm: number | null;
};
export type StatusKart = 'REF' | 'EQUALIZADO' | 'AJUSTANDO' | 'REVISAR' | 'SEM VOLTAS';

export type KartEqualizacao = {
  kart: string;
  piloto: string;
  referencia: boolean;
  voltas: number;
  melhorMs: number | null;
  mediaMs: number | null;
  blocos: BlocoEqualizacao[];
  /** quanto mexer no redutor agora (mm; + abrir, − fechar, 0 = equalizado) */
  ajusteMm: number | null;
  /** abertura do redutor sugerido em relação ao inicial (mm) e a medida real, quando conhecida */
  aberturaMm: number | null;
  redutorMm: number | null;
  /** redutor a usar: "inicial", "inicial + 0,3 mm" ou "17,3 mm" */
  redutorSugerido: string | null;
  status: StatusKart;
  acao: string;
  checklist: ChecklistKart | null;
};

export type ResultadoEqualizacao = {
  metaMs: number | null;
  metaOrigem: 'referencia' | 'fixa' | 'sem-meta';
  toleranciaMs: number;
  regra: Required<RegraRedutor>;
  referencias: { kart: string; melhorMs: number | null; mediaMs: number | null; voltas: number }[];
  karts: KartEqualizacao[];
};

const mm2 = (x: number) => Math.round(x * 100) / 100;
/** 0.1 → "0,1" · 0.25 → "0,25" · 17 → "17,0" (sem sinal) */
export const fmtMm = (x: number) => Math.abs(x).toFixed(2).replace(/0$/, '').replace('.', ',');

/** Tempo de volta como MM:SS:mmm (01:14:000) — o formato da equalização, porque há traçado de mais de um minuto. */
export function fmtTempoVolta(ms: number | null | undefined) {
  if (ms == null || !(ms > 0)) return '';
  const t = Math.round(ms);
  const p = (n: number, d: number) => String(n).padStart(d, '0');
  return `${p(Math.floor(t / 60000), 2)}:${p(Math.floor((t % 60000) / 1000), 2)}:${p(t % 1000, 3)}`;
}

/**
 * Tempo de volta digitado → ms: "01:14:000" (minutos:segundos:milésimos), "1:14.000", "1:14,5", "74,000" ou "52.395".
 * null se não for um tempo. Os milésimos incompletos valem como fração ("01:14:5" = 1 min 14,5 s).
 */
export function tempoVoltaParaMs(v: unknown): number | null {
  const txt = String(v ?? '').trim();
  if (!txt) return null;
  const partes = txt.split(':').map((x) => x.trim());
  if (partes.length > 3) return null;
  let ms: number;
  if (partes.length === 1) {
    const s = Number(txt.replace(',', '.'));
    if (!Number.isFinite(s)) return null;
    ms = Math.round(s * 1000);
  } else {
    if (!/^\d{1,3}$/.test(partes[0])) return null;
    let segundosMs: number;
    if (partes.length === 3) {
      if (!/^\d{1,2}$/.test(partes[1]) || !/^\d{1,3}$/.test(partes[2])) return null;
      segundosMs = Number(partes[1]) * 1000 + Number(partes[2].padEnd(3, '0'));
    } else {
      const s = Number(partes[1].replace(',', '.'));
      if (!/^\d{1,2}([.,]\d{1,3})?$/.test(partes[1]) || !Number.isFinite(s)) return null;
      segundosMs = Math.round(s * 1000);
    }
    if (segundosMs >= 60_000) return null;
    ms = Number(partes[0]) * 60_000 + segundosMs;
  }
  return ms > 0 ? ms : null;
}

/** Regra do redutor em uso: a da equalização, completada pelo padrão (Kart Indoor). */
export function regraDa(cfg: ConfigEqualizacao | RegraRedutor | null | undefined): Required<RegraRedutor> {
  const c = (cfg ?? {}) as Partial<RegraRedutor> & { regraNome?: string };
  const pos = (v: unknown, padrao: number) => (Number(v) > 0 ? Number(v) : padrao);
  return { nome: String(c.regraNome ?? c.nome ?? REGRA_PADRAO.nome), toleranciaMs: pos(c.toleranciaMs, REGRA_PADRAO.toleranciaMs), faixaMs: pos(c.faixaMs, REGRA_PADRAO.faixaMs), passoMm: pos(c.passoMm, REGRA_PADRAO.passoMm) };
}

/**
 * Quanto mexer no redutor pela diferença para a meta: + abrir (kart mais lento), − fechar (mais rápido), 0 = equalizado.
 * O limite de cima de cada faixa ainda pertence a ela (0,400 s = abrir 0,1 mm; 0,401 s = abrir 0,2 mm).
 */
export function ajusteRedutorMm(deltaMs: number, regra: RegraRedutor): number {
  const a = Math.abs(deltaMs);
  if (a <= regra.toleranciaMs) return 0;
  return mm2(Math.sign(deltaMs) * Math.ceil((a - regra.toleranciaMs) / regra.faixaMs) * regra.passoMm);
}

/** "abrir 0,2 mm", "fechar 0,1 mm" ou "manter o redutor". */
export const textoAjuste = (mm: number) => (mm === 0 ? 'manter o redutor' : `${mm > 0 ? 'abrir' : 'fechar'} ${fmtMm(mm)} mm`);

/** As primeiras faixas da regra, para mostrar na tela e no relatório (depois da última, segue no mesmo passo). */
export function faixasDaRegra(regra: RegraRedutor, linhas = 4) {
  return Array.from({ length: linhas }, (_, i) => ({
    deMs: i === 0 ? 0 : regra.toleranciaMs + (i - 1) * regra.faixaMs,
    ateMs: regra.toleranciaMs + i * regra.faixaMs,
    mm: mm2(i * regra.passoMm),
  }));
}

/** Nome do redutor pela abertura em relação ao inicial; com a medida do inicial, a medida real. */
export function rotuloRedutor(aberturaMm: number, inicialMm: number | null, curto = false) {
  if (inicialMm != null) return `${fmtMm(inicialMm + aberturaMm)} mm`;
  if (aberturaMm === 0) return 'inicial';
  const sinal = aberturaMm > 0 ? '+' : '−';
  return curto ? `${sinal}${fmtMm(aberturaMm)} mm` : `inicial ${sinal} ${fmtMm(aberturaMm)} mm`;
}

function voltasValidas(c: Competitor) {
  const ativas = c.crossings.filter((x) => !x.deleted).sort((a, b) => a.wallMs - b.wallMs);
  return ativas.slice(1).filter((x) => x.lapMs != null && x.lapMs > 0 && !x.invalid).map((x) => x.lapMs as number);
}

const media = (v: number[]) => (v.length ? Math.round(v.reduce((s, x) => s + x, 0) / v.length) : null);

const seg = (ms: number) => (Math.abs(ms) / 1000).toFixed(3).replace('.', ',');

export function calcularEqualizacao(s: Session, cfg: ConfigEqualizacao = s.equalizacao ?? {}): ResultadoEqualizacao {
  const finalizada = cfg.finalizadaEm != null || s.state === 'encerrada' || s.state === 'cancelada';
  const regra = regraDa(cfg);
  const tol = regra.toleranciaMs;
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
  else if (melhoresRefs.length) { metaMs = Math.min(...melhoresRefs); metaOrigem = 'referencia'; }

  const karts = competidores.map((c): KartEqualizacao => {
    const v = voltasValidas(c);
    const base = { kart: c.kart, piloto: c.name, voltas: v.length, melhorMs: v.length ? Math.min(...v) : null, mediaMs: media(v), checklist: cfg.checklist?.[c.kart] ?? null };
    if (refs.has(c.kart)) return { ...base, referencia: true, blocos: [], ajusteMm: null, aberturaMm: null, redutorMm: null, redutorSugerido: null, status: 'REF', acao: 'Mantido como base de comparação' };
    const inicial = Number(cfg.redutorInicialMm?.[c.kart]) > 0 ? Number(cfg.redutorInicialMm?.[c.kart]) : null;
    const blocos: BlocoEqualizacao[] = [];
    for (let i = 0; i < v.length; i += 2) {
      const n = i / 2 + 1;
      const voltasMs = v.slice(i, i + 2);
      // o bloco 1 é o redutor inicial; os seguintes presumem o ajuste sugerido no bloco anterior, salvo correção à mão
      const antes = blocos[blocos.length - 1];
      const manual = cfg.aberturas?.[c.kart]?.[String(n)];
      const aberturaMm = !antes ? 0 : manual != null && Number.isFinite(Number(manual)) ? mm2(Number(manual)) : mm2(antes.aberturaMm + (antes.ajusteMm ?? 0));
      const melhor = voltasMs.length ? Math.min(...voltasMs) : null;
      const completo = voltasMs.length === 2;
      const delta = melhor != null && metaMs != null ? melhor - metaMs : null;
      blocos.push({
        bloco: n, aberturaMm, redutorMm: inicial != null ? mm2(inicial + aberturaMm) : null, rotulo: rotuloRedutor(aberturaMm, inicial, true),
        voltasMs, melhorMs: melhor, mediaMs: media(voltasMs), deltaMs: delta, dentro: delta != null && Math.abs(delta) <= tol, completo,
        ajusteMm: completo && delta != null ? ajusteRedutorMm(delta, regra) : null,
      });
    }
    const completos = blocos.filter((b) => b.completo);
    let status: StatusKart = 'SEM VOLTAS';
    let acao = 'Aguardando 2 voltas';
    let ajusteMm: number | null = null;
    let aberturaMm: number | null = null;
    const ultimo = completos[completos.length - 1];
    const anterior = completos[completos.length - 2];
    if (metaMs == null && completos.length) { status = 'AJUSTANDO'; aberturaMm = ultimo.aberturaMm; acao = 'Defina os karts referência ou a meta do traçado'; }
    else if (ultimo?.dentro) {
      status = 'EQUALIZADO'; ajusteMm = 0; aberturaMm = ultimo.aberturaMm;
      acao = inicial != null ? `Equalizado com o redutor ${fmtMm(inicial + aberturaMm)} mm: liberar`
        : aberturaMm === 0 ? 'Equalizado com o redutor inicial: liberar'
        : `Equalizado com o redutor ${aberturaMm > 0 ? 'aberto' : 'fechado'} ${fmtMm(aberturaMm)} mm em relação ao inicial: liberar`;
    } else if (ultimo) {
      const d = ultimo.deltaMs ?? 0;
      const quanto = `${seg(d)} s ${d > 0 ? 'mais lento' : 'mais rápido'} que ${metaOrigem === 'fixa' ? 'a meta' : 'a referência'}`;
      ajusteMm = ultimo.ajusteMm ?? 0;
      aberturaMm = mm2(ultimo.aberturaMm + ajusteMm);
      const alvo = inicial != null ? ` (redutor ${fmtMm(inicial + aberturaMm)} mm)` : '';
      // o redutor foi trocado depois do bloco anterior e a diferença não diminuiu
      const semGanho = anterior != null && anterior.ajusteMm !== 0 && ultimo.aberturaMm !== anterior.aberturaMm && Math.abs(d) >= Math.abs(anterior.deltaMs ?? 0);
      if (finalizada) { status = 'REVISAR'; acao = `Não chegou na meta: ${quanto} (faltou ${textoAjuste(ajusteMm)}${alvo}). Encaminhar para a oficina`; }
      else {
        status = 'AJUSTANDO';
        const t = textoAjuste(ajusteMm);
        acao = `${t[0].toUpperCase()}${t.slice(1)}${alvo}: ${quanto}. Dar mais 2 voltas${semGanho ? ' (o último ajuste não trouxe ganho: se repetir, encaminhar para a oficina)' : ''}`;
      }
    } else if (blocos.length) acao = 'Falta 1 volta para fechar o bloco';
    if (status === 'SEM VOLTAS' && finalizada) acao = 'Não andou nesta equalização';
    // o que a oficina escreveu vale mais que a sugestão automática
    const daOficina = cfg.checklist?.[c.kart]?.acaoOficina?.trim();
    if (daOficina) acao = daOficina;
    return {
      ...base, referencia: false, blocos, ajusteMm, aberturaMm, redutorMm: inicial != null && aberturaMm != null ? mm2(inicial + aberturaMm) : null,
      redutorSugerido: aberturaMm == null ? null : rotuloRedutor(aberturaMm, inicial), status, acao,
    };
  });
  karts.sort((a, b) => Number(b.referencia) - Number(a.referencia) || a.kart.localeCompare(b.kart, 'pt-BR', { numeric: true }));
  return { metaMs, metaOrigem, toleranciaMs: tol, regra, referencias, karts };
}

/**
 * Traz para a equalização karts que andaram em outra bateria (as voltas foram cronometradas fora da equalização).
 * Copia as passagens como estão; a bateria de origem não muda. Kart que já tem voltas na equalização fica como está.
 */
export function importarKarts(destino: Session, origem: Session, karts: string[]) {
  const importados: { kart: string; piloto: string; voltas: number }[] = [];
  const ignorados: { kart: string; motivo: string }[] = [];
  for (const kart of [...new Set(karts.map((k) => String(k).trim().replace(/^0+(?=\d)/, '')).filter(Boolean))]) {
    const de = origem.competitors.find((c) => c.kart === kart);
    const ativas = de?.crossings.filter((x) => !x.deleted) ?? [];
    if (!de || ativas.length < 2) { ignorados.push({ kart, motivo: 'sem volta nesta bateria' }); continue; }
    const ja = destino.competitors.find((c) => c.kart === kart);
    if (ja?.crossings.some((x) => !x.deleted)) { ignorados.push({ kart, motivo: 'já tem voltas na equalização' }); continue; }
    const passagens = de.crossings.map((x) => ({ ...x }));
    if (ja) { ja.crossings = passagens; ja.name = de.name || ja.name; ja.finished = false; }
    else destino.competitors.push({ kart, name: de.name, customerId: de.customerId ?? null, category: de.category ?? null, flag: 'none', crossings: passagens, finished: false });
    importados.push({ kart, piloto: de.name, voltas: ativas.length - 1 });
  }
  return { importados, ignorados };
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
