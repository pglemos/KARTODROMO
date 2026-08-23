import { describe, expect, it } from 'vitest';
import {
  ordenarClassificadosPorFormato,
  ordenarClassificacaoCampeonato,
  type EstatisticasPiloto,
} from './race-formats';

const piloto = (sobrescrito: Partial<EstatisticasPiloto> & { pilotoId: string }): EstatisticasPiloto => ({
  pontos: 0,
  vitorias: 0,
  segundosLugares: 0,
  terceirosLugares: 0,
  melhorPosicao: null,
  melhorPosicaoUltimaEtapa: null,
  melhorVoltaMs: null,
  segundaMelhorVoltaMs: null,
  terceiraMelhorVoltaMs: null,
  voltasRapidas: 0,
  ...sobrescrito,
});

describe('ordenarClassificadosPorFormato', () => {
  const linha = (melhorTempo: number, posicaoInformada: number | null) => ({ melhorTempo, posicaoInformada });

  it('corrida: usa posição informada pela cronometragem, mesmo com melhor volta pior', () => {
    const ordem = ordenarClassificadosPorFormato(
      [linha(60_000, 3), linha(65_000, 1), linha(63_000, 2)],
      'corrida',
      'corrida',
    );
    expect(ordem.map((l) => l.posicaoInformada)).toEqual([1, 2, 3]);
  });

  it('tomada de tempo: melhor tempo decide, ignorando posição informada', () => {
    const ordem = ordenarClassificadosPorFormato(
      [linha(64_000, 1), linha(61_000, 2), linha(66_000, 3)],
      'melhor_tempo',
      'classificacao',
    );
    expect(ordem.map((l) => l.melhorTempo)).toEqual([61_000, 64_000, 66_000]);
  });

  it('combinada na corrida: posição informada; combinada na TT: melhor tempo', () => {
    const corrida = ordenarClassificadosPorFormato(
      [linha(60_000, 2), linha(70_000, 1)],
      'combinada',
      'corrida',
    );
    expect(corrida[0].posicaoInformada).toBe(1);

    const tt = ordenarClassificadosPorFormato(
      [linha(70_000, 1), linha(62_000, 2)],
      'combinada',
      'classificacao',
    );
    expect(tt[0].melhorTempo).toBe(62_000);
  });

  it('sem posições informadas cai para o melhor tempo', () => {
    const ordem = ordenarClassificadosPorFormato(
      [linha(68_000, null), linha(61_000, null)],
      'corrida',
      'corrida',
    );
    expect(ordem[0].melhorTempo).toBe(61_000);
  });
});

describe('ordenarClassificacaoCampeonato (desempates)', () => {
  it('pontos decidem primeiro', () => {
    const lista = ordenarClassificacaoCampeonato([
      piloto({ pilotoId: 'a', pontos: 20, vitorias: 3 }),
      piloto({ pilotoId: 'b', pontos: 30 }),
    ]);
    expect(lista.map((p) => p.pilotoId)).toEqual(['b', 'a']);
  });

  it('empate em pontos: vitórias antes de segundos lugares', () => {
    const lista = ordenarClassificacaoCampeonato([
      piloto({ pilotoId: 'maisSegundos', pontos: 25, segundosLugares: 4 }),
      piloto({ pilotoId: 'maisVitorias', pontos: 25, vitorias: 2 }),
    ]);
    expect(lista[0].pilotoId).toBe('maisVitorias');
  });

  it('desempate configurável respeita a ordem passada', () => {
    const custom = ['total_segundos_lugares' as const, 'total_vitorias' as const];
    const lista = ordenarClassificacaoCampeonato(
      [
        piloto({ pilotoId: 'venceuMais', pontos: 25, vitorias: 5, segundosLugares: 0 }),
        piloto({ pilotoId: 'segundoMais', pontos: 25, vitorias: 9, segundosLugares: 1 }),
      ],
      [...custom],
    );
    // Com "segundos lugares" primeiro, quem tem mais 2º lugares vence o empate.
    expect(lista[0].pilotoId).toBe('segundoMais');
  });

  it('melhor volta quebra empate quando posições iguais', () => {
    const lista = ordenarClassificacaoCampeonato(
      [
        piloto({ pilotoId: 'lento', pontos: 18, vitorias: 1, melhorVoltaMs: 65_123 }),
        piloto({ pilotoId: 'rapido', pontos: 18, vitorias: 1, melhorVoltaMs: 64_900 }),
      ],
      ['melhor_volta' as const],
    );
    expect(lista[0].pilotoId).toBe('rapido');
  });

  it('voltas rápidas e última etapa entram na cadeia', () => {
    const lista = ordenarClassificacaoCampeonato(
      [
        piloto({ pilotoId: 'semVoltasRapidas', pontos: 15, voltasRapidas: 0 }),
        piloto({ pilotoId: 'cravouVoltasRapidas', pontos: 15, voltasRapidas: 2 }),
      ],
      ['mais_voltas_rapidas' as const],
    );
    expect(lista[0].pilotoId).toBe('cravouVoltasRapidas');

    const ultimaEtapa = ordenarClassificacaoCampeonato(
      [
        piloto({ pilotoId: 'sumiuNaFinal', pontos: 15, melhorPosicaoUltimaEtapa: 8 }),
        piloto({ pilotoId: 'decidiuNaFinal', pontos: 15, melhorPosicaoUltimaEtapa: 2 }),
      ],
      ['melhor_posicao_ultima_etapa' as const],
    );
    expect(ultimaEtapa[0].pilotoId).toBe('decidiuNaFinal');
  });

  it('critérios sem dados locais (punicao/pole) comparam neutros e caem no desempate por id', () => {
    const lista = ordenarClassificacaoCampeonato(
      [
        piloto({ pilotoId: 'zzz', pontos: 10 }),
        piloto({ pilotoId: 'aaa', pontos: 10 }),
      ],
      ['menos_punicoes' as const, 'mais_poles' as const],
    );
    expect(lista.map((p) => p.pilotoId)).toEqual(['aaa', 'zzz']);
  });
});
