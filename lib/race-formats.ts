/**
 * Formatos de corrida: resolução de herança e parsing de pontuação/desempate.
 *
 * Hierarquia (o mais específico vence):
 *   formato da sessão/corrida → formato da etapa → formato do campeonato → formato default
 *
 * Princípios (ver docs/superpowers/specs/2026-08-23-formatos-regras-corridas-design.md):
 *  - Nenhum parâmetro global hardcoded em UI/scraper: tudo vem do banco.
 *  - Punições são aplicadas em tempo real pela cronometragem (LapTime) — este módulo
 *    apenas descreve as regras esperadas; nunca calcula punição.
 */

export type ClassificacaoFonte = 'corrida' | 'melhor_tempo' | 'combinada';
export type PunicoesFonte = 'cronometragem';

export type FormatoCorrida = {
  id: string;
  nome: string;
  descricao: string | null;
  tt_habilitada: boolean;
  tt_duracao_min: number | null;
  tt_define_grid: boolean;
  tt_pontua: boolean;
  corrida_duracao_min: number | null;
  paradas_habilitadas: boolean;
  paradas_quantidade: number;
  parada_tempo_minimo_ms: number | null;
  boxes_abrem_apos_ms: number | null;
  boxes_fecham_apos_ms: number | null;
  paradas_adicionais_permitidas: number;
  punicoes_fonte: PunicoesFonte;
  classificacao_fonte: ClassificacaoFonte;
  desempate: DesempateCriterio[];
  is_default: boolean;
};

export type FormatoOrigem = 'sessao' | 'etapa' | 'campeonato' | 'default';

/** Catálogo dos critérios de desempate de campeonato (ordem = prioridade). */
export const DESEMPATE_CRITERIOS = [
  'total_vitorias',
  'total_segundos_lugares',
  'total_terceiros_lugares',
  'melhor_posicao',
  'melhor_posicao_ultima_etapa',
  'melhor_volta',
  'menos_punicoes',
  'mais_poles',
  'mais_voltas_rapidas',
  'segunda_melhor_volta',
  'terceira_melhor_volta',
] as const;

export type DesempateCriterio = (typeof DESEMPATE_CRITERIOS)[number];

export const DESEMPATE_LABELS: Record<DesempateCriterio, string> = {
  total_vitorias: 'Vitórias',
  total_segundos_lugares: 'Segundos lugares',
  total_terceiros_lugares: 'Terceiros lugares',
  melhor_posicao: 'Melhor posição',
  melhor_posicao_ultima_etapa: 'Melhor posição na última etapa',
  melhor_volta: 'Melhor volta',
  menos_punicoes: 'Menos punições',
  mais_poles: 'Poles',
  mais_voltas_rapidas: 'Voltas mais rápidas',
  segunda_melhor_volta: '2ª melhor volta',
  terceira_melhor_volta: '3ª melhor volta',
};

const DEFAULT_DESEMPATE: DesempateCriterio[] = [...DESEMPATE_CRITERIOS];

/** Tabela F1 usada como fallback quando o campeonato não tem pontos_json. */
export const PONTOS_FALLBACK: Record<number, number> = {
  1: 25, 2: 18, 3: 15, 4: 12, 5: 10, 6: 8, 7: 6, 8: 4, 9: 2, 10: 1,
};

export type PontuacaoConfig = {
  posicoes: Record<string, number>;
  foraDaTabela?: number;
};

function toBool(value: unknown): boolean {
  return value === true || value === 1 || value === '1';
}

function toIntOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function parseDesempate(value: unknown): DesempateCriterio[] {
  let raw: unknown = value;
  if (typeof raw === 'string') {
    try { raw = JSON.parse(raw); } catch { return DEFAULT_DESEMPATE; }
  }
  if (!Array.isArray(raw)) return DEFAULT_DESEMPATE;
  const validos = raw.filter(
    (item): item is DesempateCriterio =>
      typeof item === 'string' && (DESEMPATE_CRITERIOS as readonly string[]).includes(item),
  );
  return validos.length ? validos : DEFAULT_DESEMPATE;
}

/** Converte uma linha crua do banco (D1/SQLite) no objeto tipado. */
export function normalizarFormato(row: Record<string, unknown> & { id: string; nome: string }): FormatoCorrida {
  return {
    id: row.id,
    nome: row.nome,
    descricao: typeof row.descricao === 'string' ? row.descricao : null,
    tt_habilitada: toBool(row.tt_habilitada),
    tt_duracao_min: toIntOrNull(row.tt_duracao_min),
    tt_define_grid: toBool(row.tt_define_grid),
    tt_pontua: toBool(row.tt_pontua),
    corrida_duracao_min: toIntOrNull(row.corrida_duracao_min),
    paradas_habilitadas: toBool(row.paradas_habilitadas),
    paradas_quantidade: toIntOrNull(row.paradas_quantidade) ?? 0,
    parada_tempo_minimo_ms: toIntOrNull(row.parada_tempo_minimo_ms),
    boxes_abrem_apos_ms: toIntOrNull(row.boxes_abrem_apos_ms),
    boxes_fecham_apos_ms: toIntOrNull(row.boxes_fecham_apos_ms),
    paradas_adicionais_permitidas: toIntOrNull(row.paradas_adicionais_permitidas) ?? 0,
    punicoes_fonte: 'cronometragem',
    classificacao_fonte:
      row.classificacao_fonte === 'melhor_tempo' || row.classificacao_fonte === 'combinada'
        ? row.classificacao_fonte
        : 'corrida',
    desempate: parseDesempate(row.desempate),
    is_default: toBool(row.is_default),
  };
}

/** Formato padrão do kartódromo quando nada está configurado (espelha a seed fmt-padrao-betim). */
export const FORMATO_PADRAO_BETIM: FormatoCorrida = normalizarFormato({
  id: 'fmt-padrao-betim',
  nome: 'Padrão Betim — TT + Corrida',
  descricao: 'Tomada de tempo (~5 min) monta o grid; corrida normal (~20 min) sem parada obrigatória.',
  tt_habilitada: 1,
  tt_duracao_min: 5,
  tt_define_grid: 1,
  tt_pontua: 0,
  corrida_duracao_min: 20,
  paradas_habilitadas: 0,
  paradas_quantidade: 0,
  parada_tempo_minimo_ms: null,
  boxes_abrem_apos_ms: null,
  boxes_fecham_apos_ms: null,
  paradas_adicionais_permitidas: 0,
  classificacao_fonte: 'corrida',
  is_default: 1,
});

export type ResolucaoFormato = {
  formato: FormatoCorrida;
  origem: FormatoOrigem;
};

/**
 * Resolve o formato efetivo seguindo a hierarquia sessão → etapa → campeonato → default.
 */
export function resolverFormatoCorrida(input: {
  formatoSessao?: FormatoCorrida | null;
  formatoEtapa?: FormatoCorrida | null;
  formatoCampeonato?: FormatoCorrida | null;
  formatosDisponiveis?: FormatoCorrida[] | null;
}): ResolucaoFormato {
  if (input.formatoSessao) return { formato: input.formatoSessao, origem: 'sessao' };
  if (input.formatoEtapa) return { formato: input.formatoEtapa, origem: 'etapa' };
  if (input.formatoCampeonato) return { formato: input.formatoCampeonato, origem: 'campeonato' };
  const def = input.formatosDisponiveis?.find((f) => f.is_default);
  if (def) return { formato: def, origem: 'default' };
  return { formato: FORMATO_PADRAO_BETIM, origem: 'default' };
}

/** Faz o parse seguro de pontos_json; retorna null quando inválido/vazio. */
export function parsePontuacao(value: unknown): PontuacaoConfig | null {
  let raw: unknown = value;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    try { raw = JSON.parse(trimmed); } catch { return null; }
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;

  const posicoesRaw = (raw as Record<string, unknown>).posicoes;
  if (!posicoesRaw || typeof posicoesRaw !== 'object' || Array.isArray(posicoesRaw)) return null;

  const posicoes: Record<string, number> = {};
  for (const [key, val] of Object.entries(posicoesRaw as Record<string, unknown>)) {
    const num = Number(val);
    const pos = Number(key);
    if (Number.isFinite(num) && Number.isFinite(pos) && pos >= 1) {
      posicoes[String(Math.trunc(pos))] = num;
    }
  }
  if (!Object.keys(posicoes).length) return null;

  const fora = Number((raw as Record<string, unknown>).foraDaTabela);
  return {
    posicoes,
    ...(Number.isFinite(fora) ? { foraDaTabela: fora } : {}),
  };
}

/** Pontos de uma posição conforme a configuração do campeonato (fallback F1). */
export function pontosPorPosicao(pontuacao: PontuacaoConfig | null, posicao: number): number {
  if (!pontuacao || !Number.isInteger(posicao) || posicao < 1) {
    return PONTOS_FALLBACK[posicao] ?? pontuacao?.foraDaTabela ?? 0;
  }
  const direto = pontuacao.posicoes[String(posicao)];
  if (direto !== undefined) return direto;
  const maiorMapeado = Object.keys(pontuacao.posicoes)
    .map(Number)
    .reduce((max, cur) => Math.max(max, cur), 0);
  if (posicao > maiorMapeado && pontuacao.foraDaTabela !== undefined) {
    return pontuacao.foraDaTabela;
  }
  return PONTOS_FALLBACK[posicao] ?? 0;
}

/** Faz o parse seguro de desempate_json de um campeonato; fallback = ordem canônica completa. */
export function parseDesempatesCampeonato(value: unknown): DesempateCriterio[] {
  return parseDesempate(value);
}

/** Regras de pit stop derivadas do formato (consumidas pelo scraper e pela UI). */
export type PitRulesFromFormato = {
  requiredStops: number;
  minimumStopMs: number;
  additionalStopsAllowed: number;
  candidateStopMinMs: number;
  penaltyLapsPerStop: number;
  boxOpenAfterMs: number;
  boxCloseAfterMs: number;
} | null;

export function pitRulesDoFormato(formato: FormatoCorrida): PitRulesFromFormato {
  if (!formato.paradas_habilitadas) return null;
  return {
    requiredStops: formato.paradas_quantidade,
    minimumStopMs: formato.parada_tempo_minimo_ms ?? 420_000,
    additionalStopsAllowed: formato.paradas_adicionais_permitidas,
    candidateStopMinMs: Math.round((formato.parada_tempo_minimo_ms ?? 420_000) * (4 / 7)),
    penaltyLapsPerStop: 7,
    boxOpenAfterMs: formato.boxes_abrem_apos_ms ?? 600_000,
    boxCloseAfterMs: formato.boxes_fecham_apos_ms ?? 42_000_000,
  };
}
