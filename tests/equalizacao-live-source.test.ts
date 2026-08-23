import { describe, expect, it } from 'vitest';
import { toEqualizacaoLiveCandidate, isQualifyingEqualizacaoRace } from '@/lib/equalizacao/equalizacao-live-source';
import type { LapTimeRacingDetail } from '@/lib/livetime/laptime-racings';

const detail = {
  race: {
    id: 'tomada-1',
    nome: 'Tomada 500 Milhas',
    tipo: 'Tomada de tempo',
    dataHora: '2026-08-23T08:00:00.000Z',
    inicio: '2026-08-23T08:01:00.000Z',
    estado: 2,
    finalizada: false,
    participantes: 1,
    situacao: 'em_andamento',
    evento: null,
    grupo: null,
    pista: 'Traçado principal',
    encerradaEm: null,
    duracaoEncerramento: null,
    voltaFinal: null,
    tempoFinal: null,
    tipoEncerramento: null,
    tempoTotal: null,
    observacao: null,
  },
  competitors: [{
    id: 'competitor-106',
    posicao: 1,
    numero: '106',
    transponder: '4032583',
    nome: 'Piloto Completo da Equipe',
    voltas: 3,
    melhorVolta: '1:05.700',
    tempoTotal: '3:18.400',
    status: 1,
    startPosition: 1,
    positionRecovery: 0,
    averageLap: '1:06.100',
    worstLap: '1:06.200',
    normalLaps: 3,
    validLaps: 3,
    invalidLaps: 0,
    penaltyLaps: 0,
    penaltyTime: null,
    stopAndGo: 0,
    statusLabel: 'Classificado',
    pitStops: {} as never,
  }],
  stops: [],
  laps: [
    { id: '1', competitorId: 'competitor-106', kart: '106', nome: 'Piloto Completo da Equipe', volta: 1, tempoVolta: '1:06.000', tempoTotal: '1:06.000', posicao: 1, invalida: false, excluida: false, manual: false, bandeira: null, parada: false, statusParada: null },
    { id: '2', competitorId: 'competitor-106', kart: '106', nome: 'Piloto Completo da Equipe', volta: 2, tempoVolta: '1:06.200', tempoTotal: '2:12.200', posicao: 1, invalida: false, excluida: false, manual: false, bandeira: null, parada: false, statusParada: null },
    { id: '3', competitorId: 'competitor-106', kart: '106', nome: 'Piloto Completo da Equipe', volta: 3, tempoVolta: '1:06.100', tempoTotal: '3:18.300', posicao: 1, invalida: false, excluida: false, manual: false, bandeira: null, parada: false, statusParada: null },
  ],
} as LapTimeRacingDetail;

describe('equalizacao live source', () => {
  it('recognizes only active qualifying/timing sessions', () => {
    expect(isQualifyingEqualizacaoRace('Tomada 500 Milhas', 'Tomada de tempo')).toBe(true);
    expect(isQualifyingEqualizacaoRace('500 Milhas - corrida', 'Endurance')).toBe(false);
  });

  it('keeps the complete pilot name and calculates real lap metrics', () => {
    const candidate = toEqualizacaoLiveCandidate(detail, 'competitor-106');

    expect(candidate).toMatchObject({
      kart: '106',
      piloto: 'Piloto Completo da Equipe',
      transponder: '4032583',
      melhorVoltaMs: 65_700,
      mediaVoltaMs: 66_100,
      desvioMs: 82,
      voltasValidas: 3,
      ultimaVolta: 3,
      ultimaPassagemId: '3',
    });
  });

  it('ignores a source row with a plate outside the supported fleet', () => {
    const invalidDetail = {
      ...detail,
      competitors: [{ ...detail.competitors[0], numero: '201' }],
    } as LapTimeRacingDetail;

    expect(toEqualizacaoLiveCandidate(invalidDetail, 'competitor-106')).toBeNull();
  });
});
