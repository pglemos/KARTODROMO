import { describe, expect, it } from 'vitest';
import { applyPassing, closeSession, createSession, startSession, swapKart, type Session } from '../lib/timing/race-engine';
import { historicoDoKart, rankingKarts } from '../lib/timing/ranking-karts';

// 30/09/2026 20:00 em Brasília
const BASE = Date.UTC(2026, 8, 30, 23, 0, 0);

function bateria(id: string, inicio: number, voltas: Record<string, number[]>, pilotos: Record<string, string>) {
  const s = createSession({ id, name: `Bateria ${id}`, type: 'classificacao', durationMin: 10, now: inicio, competitors: Object.keys(voltas).map((k) => ({ kart: k, name: pilotos[k] })) });
  startSession(s, inicio);
  for (const [kart, tempos] of Object.entries(voltas)) {
    let t = inicio + 1_000;
    applyPassing(s, { kart, decoderTimeMs: t, wallMs: t, transponder: Number(kart) * 100 });
    for (const lap of tempos) { t += lap; applyPassing(s, { kart, decoderTimeMs: t, wallMs: t, transponder: Number(kart) * 100 }); }
  }
  closeSession(s, inicio + 600_000);
  return s;
}

const semFiltro = { de: null, ate: null, trackId: null, tipos: null };
const kartPeloNumero = (kart: string) => kart;

describe('ranking dos karts', () => {
  it('ordena pelo melhor tempo de cada kart somando todas as baterias do período', () => {
    const a = bateria('a', BASE, { '10': [55_000, 54_000], '11': [53_900, 56_000] }, { '10': 'Ana', '11': 'Bia' });
    const b = bateria('b', BASE + 3_600_000, { '10': [53_500, 54_100], '11': [54_200] }, { '10': 'Caio', '11': 'Duda' });
    const r = rankingKarts([a, b], semFiltro, () => null, kartPeloNumero);
    expect(r.map((x) => x.kart)).toEqual(['10', '11']);
    expect(r[0]).toMatchObject({ posicao: 1, melhorMs: 53_500, melhorPiloto: 'Caio', voltas: 4, baterias: 2, pilotos: 2, melhorData: '2026-09-30' });
    expect(r[1]).toMatchObject({ melhorMs: 53_900, voltas: 3 });
  });

  it('filtra pelo período (data de Brasília) e mostra o histórico do kart', () => {
    const a = bateria('a', BASE, { '10': [55_000] }, { '10': 'Ana' });
    const b = bateria('b', BASE + 2 * 86_400_000, { '10': [54_000] }, { '10': 'Caio' });
    expect(rankingKarts([a, b], { ...semFiltro, de: '2026-10-01', ate: '2026-10-31' }, () => null, kartPeloNumero)[0].melhorMs).toBe(54_000);
    const h = historicoDoKart([a, b], '10', semFiltro, () => null, kartPeloNumero);
    expect(h.map((x) => x.bateria)).toEqual(['Bateria b', 'Bateria a']);
    expect(h[1]).toMatchObject({ data: '2026-09-30', hora: '20:00', piloto: 'Ana', voltas: 1, melhorMs: 55_000 });
  });

  it('bateria em andamento ou cancelada não entra; na troca de kart a volta fica com o kart físico (transponder)', () => {
    const s = createSession({ id: 'x', name: 'x', type: 'corrida', durationMin: 10, now: BASE, competitors: [{ kart: '10', name: 'Ana' }] });
    startSession(s, BASE);
    applyPassing(s, { kart: '10', decoderTimeMs: 1_000, wallMs: BASE + 1_000, transponder: 1000 });
    applyPassing(s, { kart: '10', decoderTimeMs: 56_000, wallMs: BASE + 56_000, transponder: 1000 });
    expect(rankingKarts([s], semFiltro, () => null, kartPeloNumero)).toEqual([]);
    swapKart(s, { fromKart: '10', toKart: '12', name: 'Ana' });
    closeSession(s, BASE + 600_000);
    const mapa: Record<string, string> = { '1000': '10' };
    const r = rankingKarts([s as Session], semFiltro, () => null, (k, t) => (t != null && mapa[String(t)]) || k);
    expect(r.map((x) => x.kart)).toEqual(['10']);
  });
});
