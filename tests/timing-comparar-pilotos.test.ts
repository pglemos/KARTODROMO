import { describe, expect, it } from 'vitest';
import { compararHistorico } from '../lib/timing/equalizacao';
import type { Session } from '../lib/timing/types';

describe('Comparação histórica de karts por melhor volta de cada piloto', () => {
  it('seleciona a melhor volta de cada piloto diferente em vez de repetir o mesmo piloto 5 vezes', () => {
    const now = 20 * 86400000;
    const sessao: Session = {
      id: 's-hist-1',
      name: 'Treino Teste',
      type: 'treino',
      state: 'encerrada',
      createdAt: now - 1000000,
      startedAt: now - 900000,
      finishedAt: now - 800000,
      minLapMs: 5000,
      currentFlag: 'checkered',
      competitors: [
        {
          kart: '55',
          name: 'Piloto Rapido',
          customerId: 'cust-piloto-1',
          crossings: [
            { id: 'p1-0', wallMs: now - 700000, decoderTimeMs: 0, lapMs: null, source: 'decoder' },
            { id: 'p1-1', wallMs: now - 650000, decoderTimeMs: 50000, lapMs: 50000, source: 'decoder' }, // melhor do piloto 1: 50.000
            { id: 'p1-2', wallMs: now - 600000, decoderTimeMs: 101000, lapMs: 51000, source: 'decoder' },
            { id: 'p1-3', wallMs: now - 550000, decoderTimeMs: 153000, lapMs: 52000, source: 'decoder' },
            { id: 'p1-4', wallMs: now - 500000, decoderTimeMs: 206000, lapMs: 53000, source: 'decoder' },
            { id: 'p1-5', wallMs: now - 450000, decoderTimeMs: 260000, lapMs: 54000, source: 'decoder' },
          ],
        },
        {
          kart: '55',
          name: 'Piloto Dois',
          customerId: 'cust-piloto-2',
          crossings: [
            { id: 'p2-0', wallMs: now - 400000, decoderTimeMs: 0, lapMs: null, source: 'decoder' },
            { id: 'p2-1', wallMs: now - 350000, decoderTimeMs: 50500, lapMs: 50500, source: 'decoder' }, // melhor do piloto 2: 50.500
            { id: 'p2-2', wallMs: now - 300000, decoderTimeMs: 102000, lapMs: 51500, source: 'decoder' },
          ],
        },
        {
          kart: '55',
          name: 'Piloto Tres',
          customerId: 'cust-piloto-3',
          crossings: [
            { id: 'p3-0', wallMs: now - 250000, decoderTimeMs: 0, lapMs: null, source: 'decoder' },
            { id: 'p3-1', wallMs: now - 200000, decoderTimeMs: 51200, lapMs: 51200, source: 'decoder' }, // melhor do piloto 3: 51.200
          ],
        },
        {
          kart: '25',
          name: 'Referencia',
          customerId: 'cust-ref',
          crossings: [
            { id: 'ref-0', wallMs: now - 150000, decoderTimeMs: 0, lapMs: null, source: 'decoder' },
            { id: 'ref-1', wallMs: now - 100000, decoderTimeMs: 49000, lapMs: 49000, source: 'decoder' },
          ],
        },
      ],
      manualPositions: {},
      chuva: false,
      trackId: null,
      eventId: null,
      groupId: null,
      proofId: null,
      programaId: null,
      greenAt: null,
      checkeredAt: null,
      redFlagAt: null,
      redFlagElapsedMs: null,
      observations: [],
      durationMs: 0,
      maxLaps: null,
    };

    const r = compararHistorico([sessao], { kart: '55', referencia: '25', now });
    expect(r.kart.amostra).toBe(8); // total de voltas computadas do kart 55

    // As três primeiras voltas DEVEM pertencer aos três pilotos diferentes!
    const voltas = r.kart.voltas;
    expect(voltas[0].lapMs).toBe(50000); // Piloto Rapido
    expect(voltas[0].piloto).toBe('Piloto Rapido');

    expect(voltas[1].lapMs).toBe(50500); // Piloto Dois
    expect(voltas[1].piloto).toBe('Piloto Dois');

    expect(voltas[2].lapMs).toBe(51200); // Piloto Tres
    expect(voltas[2].piloto).toBe('Piloto Tres');
  });
});
