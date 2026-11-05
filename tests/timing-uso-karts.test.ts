import { describe, expect, it } from 'vitest';
import { createSession, startSession, applyPassing, setCompetitors, type Session, type Crossing } from '../lib/timing/race-engine';
import { kartFisicoDaPassagem, usoKartsDaSessao } from '../lib/timing/kart-fisico';

describe('identidade física de karts e horas de uso para a oficina', () => {
  it('kartFisicoDaPassagem prioriza originalKart, depois transponder no mapa e depois c.kart', () => {
    const comp = { kart: '5', name: 'Ana', crossings: [], finished: false };
    const xComOriginal: Crossing = { decoderTimeMs: 1000, wallMs: 1000, lapMs: null, originalKart: '4' };
    expect(kartFisicoDaPassagem(comp, xComOriginal)).toBe('4');

    const xComTransponder: Crossing = { decoderTimeMs: 1000, wallMs: 1000, lapMs: null, transponder: 109 };
    expect(kartFisicoDaPassagem(comp, xComTransponder, { '109': '9' })).toBe('9');

    const xPadrao: Crossing = { decoderTimeMs: 1000, wallMs: 1000, lapMs: null };
    expect(kartFisicoDaPassagem(comp, xPadrao)).toBe('5');
  });

  it('uso_oficina_separa_karts_apos_troca: fixture com segmentos contínuos de 10 min por kart4 e kart5; assert 10/10, não 0/20. Cobrir manual, autoAdded, deleted e JSON sem originalKart', () => {
    const s = createSession({ id: 's1', name: 'Corrida', type: 'corrida', durationMin: 20, now: 0 });
    startSession(s, 0);
    setCompetitors(s, [{ kart: '4', name: 'Piloto 1', customerId: '1' }]);

    // Piloto 1 roda no kart 4 de t=0 até t=10 min (600_000 ms)
    applyPassing(s, { kart: '4', decoderTimeMs: 0, wallMs: 0 }); // largada
    applyPassing(s, { kart: '4', decoderTimeMs: 300_000, wallMs: 300_000 }); // 5 min
    applyPassing(s, { kart: '4', decoderTimeMs: 600_000, wallMs: 600_000 }); // 10 min

    // Troca para o kart 5 aos 10 min
    setCompetitors(s, [{ kart: '5', name: 'Piloto 1', customerId: '1' }]);

    // Piloto 1 roda no kart 5 de t=11 min até t=21 min
    applyPassing(s, { kart: '5', decoderTimeMs: 660_000, wallMs: 660_000 }); // 11 min (saída dos boxes no kart 5)
    applyPassing(s, { kart: '5', decoderTimeMs: 960_000, wallMs: 960_000 }); // 16 min
    applyPassing(s, { kart: '5', decoderTimeMs: 1_260_000, wallMs: 1_260_000 }); // 21 min (10 min no kart 5)

    const comp5 = s.competitors.find((c) => c.kart === '5')!;

    // Cobertura autoAdded: kart 8 entrou avulso na pista de t=0 a t=5 min (300_000 ms)
    applyPassing(s, { kart: '8', decoderTimeMs: 0, wallMs: 0 });
    applyPassing(s, { kart: '8', decoderTimeMs: 300_000, wallMs: 300_000 });

    // Cobertura deleted: passagem apagada aos 30 min no kart 5 (não deve estender o tempo para 30 min)
    comp5.crossings.push({ decoderTimeMs: 1_800_000, wallMs: 1_800_000, lapMs: 600_000, deleted: true, originalKart: '5' });

    // Cobertura manual: passagem manual válida aos 10 min no kart 4
    comp5.crossings.push({ decoderTimeMs: 600_000, wallMs: 600_000, lapMs: 60_000, source: 'manual', originalKart: '4' });

    const uso = usoKartsDaSessao(s);
    const u4 = uso.find((u) => u.kart === '4');
    const u5 = uso.find((u) => u.kart === '5');
    const u8 = uso.find((u) => u.kart === '8');

    expect(u4).toBeDefined();
    expect(u5).toBeDefined();
    expect(u8).toBeDefined();

    // Assert 10/10, não 0/20!
    expect(u4?.minutos).toBe(10);
    expect(u5?.minutos).toBe(10);
    expect(u8?.minutos).toBe(5);

    // Cobertura JSON antigo sem originalKart (usa transponder via mapa ou kart atual)
    const sAntiga = createSession({ id: 's-old', name: 'Antiga', type: 'corrida', durationMin: 20, now: 0 });
    startSession(sAntiga, 0);
    setCompetitors(sAntiga, [{ kart: '7', name: 'Legado' }]);
    const c7 = sAntiga.competitors[0];
    c7.crossings = [
      { decoderTimeMs: 0, wallMs: 0, lapMs: null, transponder: 777 },
      { decoderTimeMs: 600_000, wallMs: 600_000, lapMs: 60_000, transponder: 777 },
    ];
    const usoAntigo = usoKartsDaSessao(sAntiga, { '777': '7' });
    expect(usoAntigo.find((u) => u.kart === '7')?.minutos).toBe(10);
  });
});
