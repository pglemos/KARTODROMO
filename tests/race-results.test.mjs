import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildStandings,
  extractEntriesFromSnapshot,
  pointsForPosition,
} from '../scripts/lib/race-results.mjs';

test('snapshot vira resultado ordenado com vencedor e pontos corretos', () => {
  const entries = extractEntriesFromSnapshot({
    drivers: [
      { position: 3, name: 'Piloto C', time: '1:21.000' },
      { position: 1, name: 'Piloto sem tempo', time: '' },
      { position: 2, name: 'Piloto B', time: '1:20.000' },
      { position: 1, name: 'Piloto A', time: '1:19.000' },
    ],
  });

  assert.deepEqual(entries.map(({ position, name, points }) => ({ position, name, points })), [
    { position: 1, name: 'Piloto A', points: 25 },
    { position: 2, name: 'Piloto B', points: 22 },
    { position: 3, name: 'Piloto C', points: 20 },
  ]);
});

test('pontuacao cai um ponto por posicao depois do quarto colocado', () => {
  assert.equal(pointsForPosition(4), 18);
  assert.equal(pointsForPosition(5), 17);
  assert.equal(pointsForPosition(21), 1);
  assert.equal(pointsForPosition(22), 0);
});

test('classificacao usa as quatro melhores corridas e desempata por vitorias', () => {
  const races = [
    { entries: [{ position: 1, name: 'Ana', points: 25 }, { position: 2, name: 'Bia', points: 22 }] },
    { entries: [{ position: 2, name: 'Ana', points: 22 }, { position: 1, name: 'Bia', points: 25 }] },
    { entries: [{ position: 1, name: 'Ana', points: 25 }, { position: 2, name: 'Bia', points: 22 }] },
    { entries: [{ position: 2, name: 'Ana', points: 22 }, { position: 1, name: 'Bia', points: 25 }] },
    { entries: [{ position: 5, name: 'Ana', points: 17 }, { position: 6, name: 'Bia', points: 16 }] },
  ];
  const standings = buildStandings(races);

  assert.equal(standings[0].name, 'Ana');
  assert.equal(standings[0].points, 94);
  assert.deepEqual(standings[0].discardedResults, [17]);
  assert.equal(standings[1].points, 94);
});
