/**
 * API de transmissão ao vivo (parceiros que transmitem as corridas, ex.: YouTube).
 *
 * Retrato PÚBLICO da bateria em foco: só o que aparece no telão (posição, kart, nome, tempos, bandeira, cronômetro).
 * Nada de cliente, documento, e-mail, observação interna ou dados da equalização.
 * Documentação para o parceiro: docs/api-transmissao.md
 */
import { formatLap, type RaceFlag, type SessionState, type SessionType, type Standing } from './race-engine';

export const VERSAO_TRANSMISSAO = 1;

/** O que o servidor da cronometragem sabe da bateria (subconjunto do sessionView). */
export type SessaoParaTransmissao = {
  id: string;
  name: string;
  type: SessionType;
  state: SessionState;
  durationMs: number;
  maxLaps: number | null;
  startedAt: number | null;
  greenAt?: number | null;
  aguardandoLargada?: boolean;
  checkeredAt: number | null;
  finishedAt: number | null;
  remainingMs: number | null;
  elapsedMs: number | null;
  tempoEsgotado?: boolean;
  voltasCompletas?: boolean;
  chuva?: boolean;
  currentFlag?: RaceFlag | string;
  track?: { name?: string | null; lengthMeters?: number | null } | null;
  standings: Standing[];
};

export type Situacao = 'sem-bateria' | 'preparando' | 'aguardando-largada' | 'em-andamento' | 'bandeira-quadriculada' | 'encerrada';

export type PilotoTransmissao = {
  posicao: number;
  kart: string;
  nome: string;
  categoria: string | null;
  voltas: number;
  ultimaVoltaMs: number | null;
  ultimaVolta: string | null;
  melhorVoltaMs: number | null;
  melhorVolta: string | null;
  melhorVoltaNumero: number | null;
  /** é a melhor volta da bateria inteira */
  melhorDaBateria: boolean;
  tempoTotalMs: number | null;
  tempoTotal: string | null;
  /** corrida: atrás do líder em tempo ou em voltas; treino/tomada: diferença de melhor volta */
  diferencaLiderMs: number | null;
  diferencaLiderVoltas: number;
  diferencaLider: string | null;
  /** para o piloto da posição de cima (mesma regra da diferença para o líder) */
  intervaloMs: number | null;
  intervalo: string | null;
  velocidadeMediaKmh: number | null;
  penalidadeMs: number;
  advertencias: number;
  desclassificado: boolean;
  terminou: boolean;
};

export type Transmissao = {
  versao: number;
  atualizadoEm: string;
  situacao: Situacao;
  bateria: null | {
    id: string;
    nome: string;
    tipo: 'treino' | 'classificacao' | 'corrida';
    tipoTexto: string;
    classificacaoPor: 'melhor-volta' | 'voltas-e-tempo';
    chuva: boolean;
    tracado: { nome: string; metros: number | null };
    bandeira: 'nenhuma' | 'verde' | 'amarela' | 'vermelha' | 'branca' | 'quadriculada';
    largadaEm: string | null;
    quadriculadaEm: string | null;
    encerradaEm: string | null;
    duracaoMs: number | null;
    decorridoMs: number | null;
    restanteMs: number | null;
    tempoEsgotado: boolean;
    voltasProgramadas: number | null;
    voltasDoLider: number;
    voltasRestantes: number | null;
  };
  melhorVolta: null | { kart: string; nome: string; tempoMs: number; tempo: string; volta: number | null };
  pilotos: PilotoTransmissao[];
};

const TIPO_TEXTO: Record<string, string> = { treino: 'Treino', classificacao: 'Tomada de tempo', corrida: 'Corrida' };
type Bandeira = NonNullable<Transmissao['bateria']>['bandeira'];
const BANDEIRA: Record<string, Bandeira> = {
  none: 'nenhuma', green: 'verde', yellow: 'amarela', red: 'vermelha', white: 'branca', checkered: 'quadriculada',
};

function iso(ms: number | null | undefined): string | null {
  return ms == null ? null : new Date(ms).toISOString();
}

function texto(ms: number | null | undefined): string | null {
  return ms == null ? null : formatLap(ms);
}

function situacaoDa(s: SessaoParaTransmissao): Situacao {
  if (s.state === 'encerrada' || s.state === 'cancelada') return 'encerrada';
  if (s.state === 'bandeira_final') return 'bandeira-quadriculada';
  if (s.state === 'em_andamento') return s.startedAt == null || s.aguardandoLargada ? 'aguardando-largada' : 'em-andamento';
  return 'preparando';
}

/** "+1.234" (tempo) ou "+2 voltas"; null para o líder. */
function diferencaTexto(ms: number | null, voltas: number): string | null {
  if (voltas > 0) return `+${voltas} ${voltas === 1 ? 'volta' : 'voltas'}`;
  if (ms == null) return null;
  return `+${formatLap(ms)}`;
}

export function montarTransmissao(s: SessaoParaTransmissao | null, agora: number = Date.now()): Transmissao {
  const atualizadoEm = new Date(agora).toISOString();
  if (!s || s.type === 'equalizacao') return { versao: VERSAO_TRANSMISSAO, atualizadoEm, situacao: 'sem-bateria', bateria: null, melhorVolta: null, pilotos: [] };

  const corrida = s.type === 'corrida';
  const ordenados = [...s.standings].sort((a, b) => a.position - b.position);
  const melhor = ordenados
    .filter((r) => r.bestLapMs != null && !r.desclassificado)
    .reduce<Standing | null>((m, r) => (m == null || (r.bestLapMs as number) < (m.bestLapMs as number) ? r : m), null);

  const pilotos = ordenados.map((r, i): PilotoTransmissao => {
    const acima = i > 0 ? ordenados[i - 1] : null;
    let intervaloMs: number | null = null;
    let intervaloVoltas = 0;
    if (acima) {
      if (corrida) {
        intervaloVoltas = Math.max(0, (acima.laps ?? 0) - (r.laps ?? 0));
        if (intervaloVoltas === 0 && r.gapMs != null) intervaloMs = Math.max(0, r.gapMs - (acima.gapMs ?? 0));
      } else if (r.bestLapMs != null && acima.bestLapMs != null) {
        intervaloMs = Math.max(0, r.bestLapMs - acima.bestLapMs);
      }
    }
    const lider = i === 0;
    return {
      posicao: r.position,
      kart: r.kart,
      nome: r.name,
      categoria: r.category ?? null,
      voltas: r.laps,
      ultimaVoltaMs: r.lastLapMs,
      ultimaVolta: texto(r.lastLapMs),
      melhorVoltaMs: r.bestLapMs,
      melhorVolta: texto(r.bestLapMs),
      melhorVoltaNumero: r.bestLapNumber ?? null,
      melhorDaBateria: melhor != null && r.kart === melhor.kart && r.name === melhor.name,
      tempoTotalMs: r.totalMs,
      tempoTotal: texto(r.totalMs),
      diferencaLiderMs: lider ? null : r.gapMs,
      diferencaLiderVoltas: lider ? 0 : r.gapLaps ?? 0,
      diferencaLider: lider ? null : diferencaTexto(r.gapMs, r.gapLaps ?? 0),
      intervaloMs: lider ? null : intervaloMs,
      intervalo: lider ? null : diferencaTexto(intervaloMs, intervaloVoltas),
      velocidadeMediaKmh: r.averageSpeedKmh == null ? null : Math.round(r.averageSpeedKmh * 10) / 10,
      penalidadeMs: r.penaltyMs ?? 0,
      advertencias: r.advertencias ?? 0,
      desclassificado: r.desclassificado === true,
      terminou: r.finished === true,
    };
  });

  const voltasDoLider = ordenados[0]?.laps ?? 0;
  const tipo = s.type; // equalização já saiu como sem-bateria lá em cima
  return {
    versao: VERSAO_TRANSMISSAO,
    atualizadoEm,
    situacao: situacaoDa(s),
    bateria: {
      id: s.id,
      nome: s.name,
      tipo,
      tipoTexto: TIPO_TEXTO[tipo] ?? 'Treino',
      classificacaoPor: corrida ? 'voltas-e-tempo' : 'melhor-volta',
      chuva: s.chuva === true,
      tracado: { nome: s.track?.name || 'Traçado principal', metros: s.track?.lengthMeters ?? null },
      bandeira: BANDEIRA[String(s.currentFlag ?? 'none')] ?? 'nenhuma',
      largadaEm: iso(s.startedAt),
      quadriculadaEm: iso(s.checkeredAt),
      encerradaEm: iso(s.finishedAt),
      duracaoMs: s.durationMs > 0 ? s.durationMs : null,
      // em segundos inteiros: o retrato muda no máximo 1x por segundo pelo relógio (passagens saem na hora)
      decorridoMs: s.elapsedMs == null ? null : Math.floor(s.elapsedMs / 1000) * 1000,
      restanteMs: s.durationMs > 0 ? Math.ceil(Math.max(0, s.remainingMs ?? 0) / 1000) * 1000 : null,
      tempoEsgotado: s.tempoEsgotado === true,
      voltasProgramadas: s.maxLaps ?? null,
      voltasDoLider,
      voltasRestantes: s.maxLaps ? Math.max(0, s.maxLaps - voltasDoLider) : null,
    },
    melhorVolta: melhor && melhor.bestLapMs != null
      ? { kart: melhor.kart, nome: melhor.name, tempoMs: melhor.bestLapMs, tempo: formatLap(melhor.bestLapMs), volta: melhor.bestLapNumber ?? null }
      : null,
    pilotos,
  };
}

/** Mesmo retrato sem o carimbo de hora: para saber se algo mudou e só então reenviar. */
export function assinaturaDoConteudo(t: Transmissao): string {
  const { atualizadoEm: _ignorar, ...resto } = t;
  void _ignorar;
  // com a corrida andando, decorrido/restante mudam 1x por segundo; passagem, bandeira e posições mudam na hora
  return JSON.stringify(resto);
}

// ---------------------------------------------------------------- chaves (tokens)

/** Prefixo das chaves geradas por scripts/transmissao-chave.mjs (ajuda a reconhecer uma chave vazada). */
export const PREFIXO_CHAVE = 'kib_tx_';

/** SHA-256 em hexadecimal (Web Crypto: funciona no Node e no Cloudflare Worker). */
export async function sha256Hex(textoPlano: string): Promise<string> {
  const dados = new TextEncoder().encode(textoPlano);
  const hash = await globalThis.crypto.subtle.digest('SHA-256', dados);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Comparação em tempo constante (não revela quantos caracteres bateram). */
function iguaisTempoConstante(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let dif = 0;
  for (let i = 0; i < a.length; i++) dif |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return dif === 0;
}

/** Lista de hashes aceitos: "hash1,hash2" ou com rótulo "cosmo:hash1, outro:hash2". */
export function lerHashes(config: string | null | undefined): { rotulo: string; hash: string }[] {
  return String(config ?? '')
    .split(/[,;\s]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const i = item.lastIndexOf(':');
      return i > 0 ? { rotulo: item.slice(0, i), hash: item.slice(i + 1).toLowerCase() } : { rotulo: 'parceiro', hash: item.toLowerCase() };
    })
    .filter((x) => /^[0-9a-f]{64}$/.test(x.hash));
}

/** Confere a chave contra os hashes aceitos; devolve o rótulo do parceiro (para o log) ou null. */
export async function conferirChave(chave: string | null | undefined, aceitos: { rotulo: string; hash: string }[]): Promise<string | null> {
  if (!chave || chave.length < 20 || chave.length > 200 || aceitos.length === 0) return null;
  const hash = await sha256Hex(chave);
  let achado: string | null = null;
  for (const a of aceitos) if (iguaisTempoConstante(hash, a.hash)) achado = a.rotulo;
  return achado;
}

/** A chave vem em "Authorization: Bearer …", em "X-Api-Key" ou (para fontes de navegador do OBS/vMix) em ?chave=. */
export function extrairChave(cabecalho: (nome: string) => string | null | undefined, url: URL): string | null {
  const auth = cabecalho('authorization') ?? '';
  const m = /^Bearer\s+(.+)$/i.exec(auth.trim());
  if (m) return m[1].trim();
  const api = cabecalho('x-api-key');
  if (api) return api.trim();
  return url.searchParams.get('chave') ?? url.searchParams.get('token');
}
