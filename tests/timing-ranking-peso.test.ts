import { describe, expect, it } from 'vitest';
import { applyPassing, closeSession, copiarCompetidores, createSession, setCompetitors, startSession, type Session } from '../lib/timing/race-engine';
import { rankingPorPeso, tituloFaixas } from '../lib/timing/ranking-peso';

const SAB = Date.UTC(2026, 8, 26, 15, 0, 0); // sábado
const SEG = Date.UTC(2026, 8, 28, 15, 0, 0); // segunda

function corrida(id: string, quando: number, pilotos: { kart: string; name: string; customerId?: string; voltas: number[] }[]): Session {
  const s = createSession({ id, name: id, type: 'corrida', durationMin: 20, now: quando, competitors: pilotos.map((p) => ({ kart: p.kart, name: p.name, customerId: p.customerId ?? null })) });
  startSession(s, quando);
  for (const p of pilotos) {
    let t = quando + 1000;
    applyPassing(s, { kart: p.kart, decoderTimeMs: t - quando, wallMs: t });
    for (const v of p.voltas) { t += v; applyPassing(s, { kart: p.kart, decoderTimeMs: t - quando, wallMs: t }); }
  }
  closeSession(s, quando + 3_600_000);
  return s;
}

describe('ranking por peso', () => {
  const pesos: Record<string, { peso: number; sexo: string }> = { '1': { peso: 70, sexo: 'M' }, '2': { peso: 82, sexo: 'M' }, '3': { peso: 95, sexo: 'M' }, '4': { peso: 60, sexo: 'F' } };
  const dados = (cid: string | null) => (cid ? pesos[cid] ?? {} : {});
  const b1 = corrida('b1', SAB, [
    { kart: '5', name: 'Ana', customerId: '1', voltas: [62_000, 61_000] },
    { kart: '6', name: 'Bruno', customerId: '2', voltas: [60_500] },
    { kart: '7', name: 'Caio', customerId: '3', voltas: [59_000, 30_000] }, // 30 s = corte de pista
    { kart: '8', name: 'Duda', customerId: '4', voltas: [63_000] },
  ]);
  const b2 = corrida('b2', SEG, [{ kart: '5', name: 'Ana', customerId: '1', voltas: [58_000] }]);

  it('separa por faixa e fica com a melhor volta de cada piloto, sem as voltas abaixo do mínimo', () => {
    const g = rankingPorPeso([b1, b2], dados, { top: 10, faixas: [75, 90], minimoMs: 40_000 });
    expect(g.map((x) => x.titulo)).toEqual(tituloFaixas([75, 90]));
    expect(g[0].linhas.map((l) => [l.nome, l.melhorMs])).toEqual([['Ana', 58_000], ['Duda', 63_000]]);
    expect(g[1].linhas.map((l) => l.nome)).toEqual(['Bruno']);
    expect(g[2].linhas.map((l) => [l.nome, l.melhorMs])).toEqual([['Caio', 59_000]]);
  });

  it('filtra sexo, ignora segunda e respeita o top', () => {
    const g = rankingPorPeso([b1, b2], dados, { top: 1, faixas: [75, 90], minimoMs: 40_000, sexo: 'M', ignorarSegunda: true });
    expect(g[0].linhas.map((l) => [l.nome, l.melhorMs])).toEqual([['Ana', 61_000]]);
  });

  it('peso digitado no registro do competidor vale mais que o do cadastro; oculto não entra', () => {
    b1.competitors[1].detalhes = { peso: 70 };
    b1.competitors[3].detalhes = { oculto: true };
    const g = rankingPorPeso([b1], dados, { top: 10, faixas: [75, 90], minimoMs: 40_000 });
    expect(g[0].linhas.map((l) => l.nome)).toEqual(['Bruno', 'Ana']);
  });
});

describe('registro de competidor', () => {
  it('os detalhes seguem o piloto ao trocar a lista e ao copiar para a outra prova do programa', () => {
    const tomada = createSession({ id: 't', name: 'B · TOMADA', type: 'classificacao', durationMin: 5, now: SAB, competitors: [{ kart: '5', name: 'Ana', customerId: '1' }], programaId: 'p' });
    const corridaP = createSession({ id: 'c', name: 'B · CORRIDA', type: 'corrida', durationMin: 20, now: SAB, competitors: [], programaId: 'p' });
    setCompetitors(tomada, [{ kart: '5', name: 'Ana', customerId: '1', detalhes: { iniciais: 'ANA', peso: 71 } }]);
    setCompetitors(tomada, [{ kart: '9', name: 'Ana', customerId: '1' }]);
    expect(tomada.competitors[0]).toMatchObject({ kart: '9', detalhes: { iniciais: 'ANA', peso: 71 } });
    copiarCompetidores(corridaP, tomada);
    expect(corridaP.competitors[0].detalhes).toEqual({ iniciais: 'ANA', peso: 71 });
  });
});
