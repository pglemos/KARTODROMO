import { describe, expect, it } from 'vitest';
import {
  FORMATO_PADRAO_BETIM,
  DESEMPATE_CRITERIOS,
  normalizarFormato,
  parseDesempatesCampeonato,
  parsePontuacao,
  pitRulesDoFormato,
  pontosPorPosicao,
  resolverFormatoCorrida,
} from './race-formats';

const padraoBetimRow = {
  id: 'fmt-padrao-betim',
  nome: 'Padrão Betim — TT + Corrida',
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
  punicoes_fonte: 'cronometragem',
  classificacao_fonte: 'corrida',
  is_default: 1,
};

const enduranceRow = {
  id: 'fmt-endurance',
  nome: 'Endurance com Paradas Obrigatórias',
  tt_habilitada: 1,
  tt_duracao_min: null,
  tt_define_grid: 0,
  tt_pontua: 0,
  corrida_duracao_min: null,
  paradas_habilitadas: 1,
  paradas_quantidade: 11,
  parada_tempo_minimo_ms: 420000,
  boxes_abrem_apos_ms: 600000,
  boxes_fecham_apos_ms: 42000000,
  paradas_adicionais_permitidas: 4,
  punicoes_fonte: 'cronometragem',
  classificacao_fonte: 'corrida',
  desempate: JSON.stringify(['melhor_volta', 'total_vitorias']),
  is_default: 0,
};

const ttPuraRow = {
  id: 'fmt-tt',
  nome: 'Tomada de Tempo pura',
  tt_habilitada: 1,
  tt_define_grid: 1,
  tt_pontua: 1,
  paradas_habilitada: undefined,
  paradas_habilitadas: 0,
  classificacao_fonte: 'melhor_tempo',
  is_default: 0,
};

describe('normalizarFormato', () => {
  it('converte linha crua do banco em objeto tipado', () => {
    const formato = normalizarFormato(enduranceRow as never);
    expect(formato.paradas_habilitadas).toBe(true);
    expect(formato.paradas_quantidade).toBe(11);
    expect(formato.boxes_fecham_apos_ms).toBe(42000000);
    expect(formato.classificacao_fonte).toBe('corrida');
    expect(formato.desempate).toEqual(['melhor_volta', 'total_vitorias']);
    expect(formato.is_default).toBe(false);
    expect(formato.punicoes_fonte).toBe('cronometragem');
  });

  it('classificacao_fonte inválida cai para corrida e booleans aceitam string', () => {
    const formato = normalizarFormato({ ...padraoBetimRow, tt_habilitada: '1', classificacao_fonte: 'x' } as never);
    expect(formato.tt_habilitada).toBe(true);
    expect(formato.classificacao_fonte).toBe('corrida');
  });
});

describe('resolverFormatoCorrida (herança)', () => {
  const sessao = normalizarFormato(enduranceRow as never);
  const etapa = normalizarFormato(ttPuraRow as never);
  const campeonato = normalizarFormato(padraoBetimRow as never);
  const lista = [sessao, etapa, campeonato];

  it('sessão vence tudo', () => {
    const r = resolverFormatoCorrida({ formatoSessao: sessao, formatoEtapa: etapa, formatoCampeonato: campeonato, formatosDisponiveis: lista });
    expect(r.origem).toBe('sessao');
    expect(r.formato.id).toBe('fmt-endurance');
  });

  it('etapa vence campeonato quando sessão não tem override', () => {
    const r = resolverFormatoCorrida({ formatoEtapa: etapa, formatoCampeonato: campeonato, formatosDisponiveis: lista });
    expect(r.origem).toBe('etapa');
    expect(r.formato.id).toBe('fmt-tt');
  });

  it('campeonato vence default', () => {
    const r = resolverFormatoCorrida({ formatoCampeonato: campeonato, formatosDisponiveis: lista });
    expect(r.origem).toBe('campeonato');
    expect(r.formato.id).toBe('fmt-padrao-betim');
  });

  it('usa o default marcado na lista quando nada atribuído', () => {
    const r = resolverFormatoCorrida({ formatosDisponiveis: [enduranceRow, campeonato].map((f) => normalizarFormato(f as never)) });
    expect(r.origem).toBe('default');
    expect(r.formato.is_default).toBe(true);
  });

  it('sem nada disponível devolve Padrão Betim embutido', () => {
    const r = resolverFormatoCorrida({});
    expect(r.formato.id).toBe(FORMATO_PADRAO_BETIM.id);
    expect(r.formato.paradas_habilitadas).toBe(false);
    expect(r.formato.classificacao_fonte).toBe('corrida');
  });

  it('override pontual por sessão cobre o caso da corrida diferente do campeonato', () => {
    const campeonatoEndurance = normalizarFormato(enduranceRow as never);
    const corridaAvulsa = normalizarFormato(ttPuraRow as never);
    const r = resolverFormatoCorrida({ formatoSessao: corridaAvulsa, formatoCampeonato: campeonatoEndurance });
    expect(r.origem).toBe('sessao');
    expect(r.formato.classificacao_fonte).toBe('melhor_tempo');
  });
});

describe('parsePontuacao / pontosPorPosicao', () => {
  it('fallback F1 quando sem config', () => {
    expect(pontosPorPosicao(null, 1)).toBe(25);
    expect(pontosPorPosicao(null, 10)).toBe(1);
    expect(pontosPorPosicao(null, 11)).toBe(0);
  });

  it('usa tabela customizada e foraDaTabela', () => {
    const cfg = parsePontuacao({ posicoes: { 1: 30, 2: 24 }, foraDaTabela: 2 });
    expect(pontosPorPosicao(cfg, 1)).toBe(30);
    expect(pontosPorPosicao(cfg, 2)).toBe(24);
    expect(pontosPorPosicao(cfg, 3)).toBe(2);
    expect(pontosPorPosicao(cfg, 15)).toBe(2);
  });

  it('aceita string JSON do banco e rejeita lixo', () => {
    expect(parsePontuacao('{"posicoes":{"1":50}}')).toEqual({ posicoes: { '1': 50 } });
    expect(parsePontuacao('nao-json')).toBeNull();
    expect(parsePontuacao('')).toBeNull();
    expect(parsePontuacao({ foo: 1 })).toBeNull();
  });
});

describe('desempates', () => {
  it('catálogo tem os 11 critérios Paddock', () => {
    expect(DESEMPATE_CRITERIOS).toHaveLength(11);
  });

  it('parse de desempate_json válido mantém ordem configurada', () => {
    const ordem = parseDesempatesCampeonato('["mais_poles","melhor_volta"]');
    expect(ordem).toEqual(['mais_poles', 'melhor_volta']);
  });

  it('inválido/vazio volta para a ordem canônica completa', () => {
    expect(parseDesempatesCampeonato('lixo')).toEqual([...DESEMPATE_CRITERIOS]);
    expect(parseDesempatesCampeonato(null)).toHaveLength(11);
    expect(parseDesempatesCampeonato(['criterio_inexistente'])).toHaveLength(11);
  });
});

describe('pitRulesDoFormato', () => {
  it('sem paradas habilitadas retorna null (UI esconde colunas de box)', () => {
    expect(pitRulesDoFormato(normalizarFormato(padraoBetimRow as never))).toBeNull();
  });

  it('endurance gera regras completas a partir do formato', () => {
    const rules = pitRulesDoFormato(normalizarFormato(enduranceRow as never));
    expect(rules).toEqual({
      requiredStops: 11,
      minimumStopMs: 420000,
      additionalStopsAllowed: 4,
      candidateStopMinMs: 240000,
      penaltyLapsPerStop: 7,
      boxOpenAfterMs: 600000,
      boxCloseAfterMs: 42000000,
    });
  });
});
