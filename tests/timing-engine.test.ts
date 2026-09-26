import { describe, expect, it } from 'vitest';
import { formatTrxPassing, LineSplitter, parseTrxLine } from '../lib/timing/trx-parser';
import {
  applyPassing,
  assignCrossing,
  clearCrossings,
  closeSession,
  computeStandings,
  createSession,
  elapsedMs,
  formatLap,
  startSession,
  mesmoPrograma,
  copiarCompetidores,
  setCompetitors,
  includeManualPassing,
  remainingMs,
  updateSessionParameters,
  setCrossingDeleted,
  setCrossingInvalid,
  setRaceFlag,
  tick,
  toggleLapInvalid,
  AUTO_CLOSE_AFTER_CHECKERED_MS,
} from '../lib/timing/race-engine';
import { createCatalogRecord, deleteCatalogRecord, distributeProof, duplicateEvent, emptyCatalog, normalizeCatalog } from '../lib/timing/catalog';

describe('trx-parser', () => {
  it('le a linha de status real capturada do decoder da pista', () => {
    const rec = parseTrxLine('\u0001#\t20\t0\t26\t0\tx4CBD\r\n');
    expect(rec).toMatchObject({ kind: 'status', decoderId: '20', noise: 0x26 });
  });

  it('le passagem com transponder e tempo em hexadecimal', () => {
    const line = formatTrxPassing({ sequence: 7, transponder: 13216539, decoderTimeMs: 45_123_456 });
    expect(parseTrxLine(line)).toMatchObject({ kind: 'passing', sequence: 7, transponder: 13216539, decoderTimeMs: 45_123_456 });
  });

  it('le o formato antigo de largura fixa', () => {
    // $ 20 00 C9AA1B 02B08A40 28 78 00
    const rec = parseTrxLine('$2000C9AA1B02B08A40287800');
    expect(rec).toMatchObject({ kind: 'passing', transponder: 0xc9aa1b, decoderTimeMs: 0x02b08a40 });
  });

  it('ignora transponders especiais (reset/manual)', () => {
    expect(parseTrxLine(formatTrxPassing({ sequence: 1, transponder: 9993, decoderTimeMs: 0 })).kind).toBe('other');
  });

  it('junta pedacos do socket em linhas', () => {
    const s = new LineSplitter();
    expect(s.push('\u0001#\t20\t0')).toEqual([]);
    expect(s.push('\t26\t0\tx1\r\n\u0001#\t20')).toEqual(['\u0001#\t20\t0\t26\t0\tx1']);
  });
});

function race(type: 'treino' | 'corrida' = 'treino', durationMin = 5) {
  const s = createSession({ id: 't', name: '', type, durationMin, now: 0, competitors: [{ kart: '4', name: 'Ana' }, { kart: '5', name: 'Bia' }] });
  startSession(s, 1_000);
  return s;
}

describe('race-engine', () => {
  it('salva duração e voltas ao editar uma corrida encerrada sem reabri-la', () => {
    const s = race('corrida', 20);
    closeSession(s, 80_000);
    const finishedAt = s.finishedAt;
    const resultBefore = computeStandings(s);

    updateSessionParameters(s, { name: 'teste corrida editada', durationMin: 25, maxLaps: 18 }, 90_000);

    expect(s).toMatchObject({
      name: 'teste corrida editada', state: 'encerrada', durationMs: 25 * 60_000, maxLaps: 18, finishedAt,
    });
    expect(computeStandings(s)).toEqual(resultBefore);
  });

  it('aplica o limite de voltas alterado durante a corrida na próxima passagem', () => {
    const s = race('corrida', 20);
    applyPassing(s, { kart: '4', decoderTimeMs: 0, wallMs: 2_000 });
    applyPassing(s, { kart: '4', decoderTimeMs: 60_000, wallMs: 62_000 });
    applyPassing(s, { kart: '5', decoderTimeMs: 1_000, wallMs: 3_000 });

    updateSessionParameters(s, { maxLaps: 2 }, 63_000);
    applyPassing(s, { kart: '4', decoderTimeMs: 120_000, wallMs: 122_000 });

    expect(s.state).toBe('bandeira_final');
  });

  it('bandeirada imediatamente se o novo limite já foi atingido pelo líder', () => {
    const s = race('corrida', 20);
    applyPassing(s, { kart: '4', decoderTimeMs: 0, wallMs: 2_000 });
    applyPassing(s, { kart: '4', decoderTimeMs: 60_000, wallMs: 62_000 });

    updateSessionParameters(s, { maxLaps: 1 }, 63_000);

    expect(s.state).toBe('bandeira_final');
    expect(s.checkeredAt).toBe(63_000);
  });

  it('recusa alterar duração ou voltas durante a quadriculada sem salvar parcialmente o nome', () => {
    const s = race('corrida', 20);
    setRaceFlag(s, 'checkered', 10_000);
    const previousName = s.name;

    expect(() => updateSessionParameters(s, { name: 'não salvar', durationMin: 25 }, 11_000))
      .toThrow('Duração e limite de voltas não podem ser alterados neste estado da bateria.');
    expect(s).toMatchObject({ state: 'bandeira_final', name: previousName, durationMs: 20 * 60_000 });
  });

  it('primeira passagem abre a volta e as seguintes geram tempo', () => {
    const s = race();
    applyPassing(s, { kart: '4', decoderTimeMs: 10_000, wallMs: 10_000 });
    applyPassing(s, { kart: '4', decoderTimeMs: 75_250, wallMs: 75_300 });
    applyPassing(s, { kart: '4', decoderTimeMs: 139_000, wallMs: 139_000 });
    const [a] = computeStandings(s);
    expect(a).toMatchObject({ kart: '4', laps: 2, lastLapMs: 63_750, bestLapMs: 63_750, bestLapNumber: 2 });
  });

  it('descarta passagem abaixo do tempo minimo de volta (5s)', () => {
    const s = race();
    applyPassing(s, { kart: '4', decoderTimeMs: 10_000, wallMs: 0 });
    expect(applyPassing(s, { kart: '4', decoderTimeMs: 12_000, wallMs: 0 })).toBe('ignored-min-lap');
  });

  it('trata a virada do relogio do decoder a meia-noite', () => {
    const s = race();
    applyPassing(s, { kart: '4', decoderTimeMs: 86_390_000, wallMs: 0 });
    applyPassing(s, { kart: '4', decoderTimeMs: 50_000, wallMs: 0 });
    expect(computeStandings(s)[0].lastLapMs).toBe(60_000);
  });

  it('kart fora do grid entra sozinho sem perder volta', () => {
    const s = race();
    expect(applyPassing(s, { kart: '99', decoderTimeMs: 1, wallMs: 0 })).toBe('counted');
    expect(s.competitors.find((c) => c.kart === '99')).toMatchObject({ name: 'Kart 99', autoAdded: true });
  });

  it('ignora passagem antes de iniciar a bateria', () => {
    const s = createSession({ id: 'x', name: 'x', type: 'treino', durationMin: 5, now: 0 });
    expect(applyPassing(s, { kart: '4', decoderTimeMs: 1, wallMs: 0 })).toBe('ignored-state');
  });

  it('treino ordena por melhor volta e corrida por voltas e tempo total', () => {
    const t = race('treino');
    const c = race('corrida');
    for (const s of [t, c]) {
      applyPassing(s, { kart: '4', decoderTimeMs: 0, wallMs: 0 });
      applyPassing(s, { kart: '5', decoderTimeMs: 1_000, wallMs: 0 });
      applyPassing(s, { kart: '4', decoderTimeMs: 70_000, wallMs: 0 }); // 70s
      applyPassing(s, { kart: '5', decoderTimeMs: 66_000, wallMs: 0 }); // 65s
      applyPassing(s, { kart: '4', decoderTimeMs: 140_000, wallMs: 0 }); // 2 voltas
    }
    expect(computeStandings(t).map((r) => r.kart)).toEqual(['5', '4']);
    const cs = computeStandings(c);
    expect(cs.map((r) => r.kart)).toEqual(['4', '5']);
    expect(cs[1]).toMatchObject({ gapLaps: 1 });
  });

  it('corrida: kart que cruza a linha de chegada na frente na mesma volta é líder/P1 mesmo se kart atrás tiver tempo total menor', () => {
    const s = createSession({
      id: 'c1',
      name: 'Corrida',
      type: 'corrida',
      durationMin: 20,
      now: 0,
      competitors: [{ kart: '70', name: 'Piloto 70' }, { kart: '63', name: 'Piloto 63' }],
    });
    startSession(s, 1_000);

    // Kart 70 larga na frente (abre a volta no decoder em 10.000 ms)
    applyPassing(s, { kart: '70', decoderTimeMs: 10_000, wallMs: 10_000 });
    // Kart 63 larga atrás (abre a volta no decoder em 12.000 ms)
    applyPassing(s, { kart: '63', decoderTimeMs: 12_000, wallMs: 12_000 });

    // Fim da volta 1:
    // Kart 70 cruza a linha na frente em 75.000 ms (tempo de volta 65s)
    applyPassing(s, { kart: '70', decoderTimeMs: 75_000, wallMs: 75_000 });
    // Kart 63 cruza a linha 1 segundo depois em 76.000 ms (tempo de volta 64s)
    applyPassing(s, { kart: '63', decoderTimeMs: 76_000, wallMs: 76_000 });

    // Na pista, Kart 70 cruzou antes de Kart 63. Kart 70 DEVE ser P1 e Kart 63 P2!
    const standings = computeStandings(s);
    expect(standings.map((r) => r.kart)).toEqual(['70', '63']);
    expect(standings[0].position).toBe(1);
    expect(standings[1].position).toBe(2);
    expect(standings[1].gapMs).toBe(1_000);
  });

  it('corrida: ultrapassagem na pista inverte as posições imediatamente e atualiza o gap real', () => {
    const s = createSession({
      id: 'c2',
      name: 'Corrida Overtake',
      type: 'corrida',
      durationMin: 20,
      now: 0,
      competitors: [{ kart: 'A', name: 'Piloto A' }, { kart: 'B', name: 'Piloto B' }],
    });
    startSession(s, 1_000);

    applyPassing(s, { kart: 'A', decoderTimeMs: 10_000, wallMs: 10_000 });
    applyPassing(s, { kart: 'B', decoderTimeMs: 11_000, wallMs: 11_000 });

    // Volta 1: A lidera e cruza antes de B
    applyPassing(s, { kart: 'A', decoderTimeMs: 70_000, wallMs: 70_000 });
    applyPassing(s, { kart: 'B', decoderTimeMs: 72_000, wallMs: 72_000 });
    expect(computeStandings(s).map((r) => r.kart)).toEqual(['A', 'B']);

    // Volta 2: B ultrapassa A na pista e cruza antes!
    applyPassing(s, { kart: 'B', decoderTimeMs: 130_000, wallMs: 130_000 });
    applyPassing(s, { kart: 'A', decoderTimeMs: 132_500, wallMs: 132_500 });
    const st2 = computeStandings(s);
    expect(st2.map((r) => r.kart)).toEqual(['B', 'A']);
    expect(st2[0].position).toBe(1);
    expect(st2[1].position).toBe(2);
    expect(st2[1].gapMs).toBe(2_500);
  });

  it('classificação: desempate por 2ª melhor volta, 3ª melhor volta e horário de conquista', () => {
    const s = createSession({
      id: 'q1',
      name: 'Classificacao',
      type: 'classificacao',
      durationMin: 10,
      now: 0,
      competitors: [{ kart: 'A', name: 'Piloto A' }, { kart: 'B', name: 'Piloto B' }],
    });
    startSession(s, 1_000);

    applyPassing(s, { kart: 'A', decoderTimeMs: 0, wallMs: 10_000 });
    applyPassing(s, { kart: 'B', decoderTimeMs: 0, wallMs: 10_000 });

    // Volta 1: ambos cravam exatamente 60.000s
    applyPassing(s, { kart: 'A', decoderTimeMs: 60_000, wallMs: 70_000 });
    applyPassing(s, { kart: 'B', decoderTimeMs: 60_000, wallMs: 70_000 });

    // Volta 2: A faz 62.000s, B faz 61.000s (2ª melhor volta de B é melhor)
    applyPassing(s, { kart: 'A', decoderTimeMs: 122_000, wallMs: 132_000 });
    applyPassing(s, { kart: 'B', decoderTimeMs: 121_000, wallMs: 131_000 });

    const st = computeStandings(s);
    expect(st.map((r) => r.kart)).toEqual(['B', 'A']);
    expect(st[0].position).toBe(1);
    expect(st[1].position).toBe(2);
    expect(st[1].gapMs).toBe(0); // mesma melhor volta
  });

  it('ordem de grid preservada para karts que ainda não abriram volta', () => {
    const s = createSession({
      id: 's1',
      name: 'Grid Test',
      type: 'corrida',
      durationMin: 15,
      now: 1_000,
      competitors: [
        { kart: '10', name: 'Piloto 1' },
        { kart: '20', name: 'Piloto 2' },
        { kart: '30', name: 'Piloto 3' },
      ],
    });
    s.state = 'em_andamento';
    const st = computeStandings(s);
    expect(st.map((r) => r.kart)).toEqual(['10', '20', '30']);
  });

  it('quadriculada por tempo: cada kart termina na proxima passagem e a bateria encerra', () => {
    const s = race('corrida', 1);
    applyPassing(s, { kart: '4', decoderTimeMs: 0, wallMs: 5_000 });
    applyPassing(s, { kart: '5', decoderTimeMs: 500, wallMs: 5_500 });
    // o cronômetro começou na 1ª passagem (5 s): 1 min acaba em 65 s
    tick(s, 64_000);
    expect(s.state).toBe('em_andamento');
    tick(s, 65_000);
    expect(s.state).toBe('bandeira_final');
    applyPassing(s, { kart: '4', decoderTimeMs: 62_000, wallMs: 66_000 });
    expect(applyPassing(s, { kart: '4', decoderTimeMs: 130_000, wallMs: 0 })).toBe('ignored-finished');
    applyPassing(s, { kart: '5', decoderTimeMs: 63_000, wallMs: 67_000 });
    expect(s.state).toBe('encerrada');
  });

  it('auto-encerra 3 min depois da quadriculada se algum kart nao passar', () => {
    const s = race('treino', 1);
    applyPassing(s, { kart: '4', decoderTimeMs: 0, wallMs: 0 });
    tick(s, 61_000);
    tick(s, 61_000 + AUTO_CLOSE_AFTER_CHECKERED_MS);
    expect(s.state).toBe('encerrada');
  });

  it('volta anulada nao conta como melhor volta', () => {
    const s = race();
    applyPassing(s, { kart: '4', decoderTimeMs: 0, wallMs: 0 });
    applyPassing(s, { kart: '4', decoderTimeMs: 50_000, wallMs: 0 }); // corte de pista
    applyPassing(s, { kart: '4', decoderTimeMs: 115_000, wallMs: 0 });
    toggleLapInvalid(s, '4', 1);
    expect(computeStandings(s)[0]).toMatchObject({ bestLapMs: 65_000, laps: 2 });
  });

  it('encerrar antes de iniciar vira cancelada', () => {
    const s = createSession({ id: 'x', name: 'x', type: 'treino', durationMin: 5, now: 0 });
    closeSession(s, 1);
    expect(s.state).toBe('cancelada');
  });

  it('bandeira verde arma a bateria: o cronômetro só começa quando o primeiro kart passa na linha', () => {
    for (const tipo of ['classificacao', 'corrida'] as const) {
      const s = race(tipo, 1); // verde em 1 s
      expect(s.state).toBe('em_andamento');
      expect(s.startedAt).toBeNull();
      expect(elapsedMs(s, 50_000)).toBe(0);
      expect(remainingMs(s, 50_000)).toBe(60_000);
      expect(tick(s, 500_000)).toBe(false); // parado esperando: não dá quadriculada
      expect(applyPassing(s, { kart: '4', decoderTimeMs: 0, wallMs: 90_000 })).toBe('counted');
      expect(s.startedAt).toBe(90_000);
      expect(s.greenAt).toBe(1_000);
      applyPassing(s, { kart: '5', decoderTimeMs: 2_000, wallMs: 92_000 }); // o segundo não mexe na largada
      expect(s.startedAt).toBe(90_000);
      expect(elapsedMs(s, 120_000)).toBe(30_000);
      tick(s, 149_999);
      expect(s.state).toBe('em_andamento');
      tick(s, 150_000);
      expect(s.state).toBe('bandeira_final');
    }
  });

  it('vermelha antes do primeiro kart passar continua esperando a largada', () => {
    const s = race('corrida', 1);
    setRaceFlag(s, 'red', 5_000);
    setRaceFlag(s, 'green', 20_000);
    expect(s.startedAt).toBeNull();
    expect(elapsedMs(s, 40_000)).toBe(0);
    applyPassing(s, { kart: '4', decoderTimeMs: 0, wallMs: 45_000 });
    expect(elapsedMs(s, 55_000)).toBe(10_000);
  });

  it('passagem manual também larga o cronômetro', () => {
    const s = race('corrida', 1);
    includeManualPassing(s, { id: 'm1', kart: '4', lapMs: 60_000, wallMs: 30_000 });
    expect(s.startedAt).toBe(30_000);
  });

  it('número do kart digitado na tomada de tempo vai para a corrida da mesma bateria', () => {
    const pilotos = [{ kart: '', name: 'Ana', customerId: '10' }, { kart: '', name: 'Bia', customerId: '11' }];
    const tomada = createSession({ id: 'a', name: 'BATERIA 13:20 · TOMADA DE TEMPO', type: 'classificacao', durationMin: 8, now: 1_000, competitors: pilotos });
    const corrida = createSession({ id: 'b', name: 'BATERIA 13:20 · CORRIDA', type: 'corrida', durationMin: 20, now: 1_002, competitors: pilotos });
    const outra = createSession({ id: 'c', name: 'BATERIA 13:55 · CORRIDA', type: 'corrida', durationMin: 20, now: 1_004, competitors: pilotos });
    expect(mesmoPrograma(tomada, corrida)).toBe(true);
    expect(mesmoPrograma(tomada, outra)).toBe(false);
    setCompetitors(tomada, [{ kart: '8', name: 'Ana', customerId: '10' }, { kart: '47', name: 'Bia', customerId: '11' }]);
    expect(copiarCompetidores(corrida, tomada)).toBe(true);
    expect(corrida.competitors.map((c) => `${c.kart}:${c.name}`)).toEqual(['8:Ana', '47:Bia']);
    startSession(corrida, 5_000);
    expect(copiarCompetidores(corrida, tomada)).toBe(false); // corrida já largou: não mexe
  });

  it('com programaId só liga as provas do mesmo programa', () => {
    const a = createSession({ id: 'a', name: 'X · TOMADA', type: 'classificacao', durationMin: 5, now: 0, programaId: 'p1' });
    const b = createSession({ id: 'b', name: 'X · CORRIDA', type: 'corrida', durationMin: 5, now: 0, programaId: 'p1' });
    const c = createSession({ id: 'c', name: 'X · CORRIDA', type: 'corrida', durationMin: 5, now: 0, programaId: 'p2' });
    expect(mesmoPrograma(a, b)).toBe(true);
    expect(mesmoPrograma(a, c)).toBe(false);
  });

  describe('troca de kart', () => {
    const volta = (s: ReturnType<typeof race>, kart: string, seg: number) => applyPassing(s, { kart, decoderTimeMs: seg * 1000, wallMs: seg * 1000 + 500 });
    const pilotos = (s: ReturnType<typeof race>) => Object.fromEntries(computeStandings(s).map((r) => [r.name, { kart: r.kart, laps: r.laps, best: r.bestLapMs }]));

    it('as voltas do kart anterior continuam com o piloto no kart novo', () => {
      const s = race('corrida', 20);
      setCompetitors(s, [{ kart: '8', name: 'Ana', customerId: '10' }, { kart: '5', name: 'Bia', customerId: '11' }]);
      volta(s, '8', 10); volta(s, '8', 70); volta(s, '8', 131); // 2 voltas no kart 8
      volta(s, '5', 12); volta(s, '5', 73);
      // o kart 8 quebrou: Ana vai pro kart 12
      setCompetitors(s, [{ kart: '12', name: 'Ana', customerId: '10' }, { kart: '5', name: 'Bia', customerId: '11' }]);
      expect(pilotos(s).Ana).toEqual({ kart: '12', laps: 2, best: 60_000 });
      expect(volta(s, '12', 230)).toBe('counted'); // volta longa (troca nos boxes)
      expect(volta(s, '12', 291)).toBe('counted');
      expect(pilotos(s).Ana).toMatchObject({ kart: '12', laps: 4 });
      expect(s.competitors.find((c) => c.kart === '8')).toBeUndefined();
    });

    it('junta as passagens que o kart novo já tinha feito sem piloto', () => {
      const s = race('corrida', 20);
      setCompetitors(s, [{ kart: '8', name: 'Ana', customerId: '10' }]);
      volta(s, '8', 10); volta(s, '8', 70);
      volta(s, '12', 150); volta(s, '12', 211); // kart 12 já na pista, entrou sozinho como 'Kart 12'
      expect(s.competitors.find((c) => c.kart === '12')?.autoAdded).toBe(true);
      setCompetitors(s, [{ kart: '12', name: 'Ana', customerId: '10' }]);
      expect(s.competitors).toHaveLength(1);
      expect(pilotos(s).Ana).toMatchObject({ kart: '12', laps: 3 });
    });

    it('dois pilotos que trocam de kart entre si levam cada um as próprias voltas', () => {
      const s = race('classificacao', 10);
      setCompetitors(s, [{ kart: '8', name: 'Ana', customerId: '10' }, { kart: '12', name: 'Bia', customerId: '11' }]);
      volta(s, '8', 0); volta(s, '8', 58);   // Ana 58 s
      volta(s, '12', 1); volta(s, '12', 64); // Bia 63 s
      setCompetitors(s, [{ kart: '12', name: 'Ana', customerId: '10' }, { kart: '8', name: 'Bia', customerId: '11' }]);
      expect(pilotos(s)).toMatchObject({ Ana: { kart: '12', best: 58_000 }, Bia: { kart: '8', best: 63_000 } });
    });

    it('corrigir só o nome mantém as voltas do kart', () => {
      const s = race('corrida', 20);
      setCompetitors(s, [{ kart: '8', name: 'Ana' }]);
      volta(s, '8', 10); volta(s, '8', 70);
      setCompetitors(s, [{ kart: '8', name: 'Ana Maria' }]);
      expect(pilotos(s)['Ana Maria']).toMatchObject({ kart: '8', laps: 1 });
    });
  });

  it('formata tempo de volta', () => {
    expect(formatLap(64_062)).toBe('1:04.062');
    expect(formatLap(9_500)).toBe('9.500');
    expect(formatLap(null)).toBe('--');
  });

  it('bandeira vermelha pausa o cronômetro e a verde retoma do tempo restante', () => {
    const s = race('corrida', 1);
    applyPassing(s, { kart: '5', decoderTimeMs: 0, wallMs: 1_000 }); // largada
    expect(remainingMs(s, 31_000)).toBe(30_000);
    setRaceFlag(s, 'red', 31_000);
    expect(remainingMs(s, 200_000)).toBe(30_000);
    expect(applyPassing(s, { kart: '4', decoderTimeMs: 40_000, wallMs: 200_000 })).toBe('ignored-red-flag');
    expect(tick(s, 200_000)).toBe(false);
    setRaceFlag(s, 'green', 200_000);
    expect(elapsedMs(s, 200_000)).toBe(30_000);
    tick(s, 230_001);
    expect(s.state).toBe('bandeira_final');
  });

  it('inclui passagem manual e recalcula volta ao excluir e restaurar passagem', () => {
    const s = race();
    applyPassing(s, { id: 'linha-1', kart: '4', decoderTimeMs: 0, wallMs: 1_000 });
    applyPassing(s, { id: 'linha-2', kart: '4', decoderTimeMs: 60_000, wallMs: 61_000 });
    applyPassing(s, { id: 'linha-3', kart: '4', decoderTimeMs: 124_000, wallMs: 125_000 });
    setCrossingInvalid(s, 'linha-2', true);
    expect(computeStandings(s)[0].bestLapMs).toBe(64_000);
    setCrossingDeleted(s, 'linha-2', true);
    expect(computeStandings(s)[0]).toMatchObject({ laps: 1, lastLapMs: 124_000 });
    setCrossingDeleted(s, 'linha-2', false);
    setCrossingInvalid(s, 'linha-2', false);
    includeManualPassing(s, { id: 'manual-1', kart: '4', lapMs: 65_000, wallMs: 190_000 });
    expect(computeStandings(s)[0]).toMatchObject({ laps: 3, lastLapMs: 65_000 });
  });

  it('mantem a passagem manual e calcula corretamente a volta seguinte e velocidade media', () => {
    const s = race('corrida');
    applyPassing(s, { id: 'antes-1', kart: '4', decoderTimeMs: 0, wallMs: 1_000 });
    applyPassing(s, { id: 'antes-2', kart: '4', decoderTimeMs: 60_000, wallMs: 61_000 });
    includeManualPassing(s, { id: 'manual-1', kart: '4', lapMs: 65_000, wallMs: 126_000 });
    applyPassing(s, { id: 'depois-1', kart: '4', decoderTimeMs: 10_000, wallMs: 132_000 });

    const [row] = computeStandings(s, 1_000);
    expect(row).toMatchObject({ laps: 3, lastLapMs: 6_000, totalMs: 131_000 });
    expect(row.averageSpeedKmh).toBeCloseTo((3 * 1_000 * 3_600) / 131_000);

    setCrossingDeleted(s, 'manual-1', true);
    setCrossingDeleted(s, 'manual-1', false);
    expect(computeStandings(s)[0].lastLapMs).toBe(6_000);
  });

  it('atribui passagem a outro competidor e permite cancelar a atribuição', () => {
    const s = race();
    applyPassing(s, { id: 'linha-1', kart: '4', decoderTimeMs: 0, wallMs: 1_000 });
    applyPassing(s, { id: 'linha-2', kart: '4', decoderTimeMs: 60_000, wallMs: 61_000 });
    assignCrossing(s, 'linha-2', '5');
    expect(s.competitors.find((c) => c.kart === '4')?.crossings).toHaveLength(1);
    expect(s.competitors.find((c) => c.kart === '5')?.crossings).toHaveLength(1);
    assignCrossing(s, 'linha-2', null);
    expect(s.competitors.find((c) => c.kart === '4')?.crossings).toHaveLength(2);
  });

  it('limpa passagens mantendo o diário restaurável', () => {
    const s = race();
    applyPassing(s, { id: 'linha-1', kart: '4', decoderTimeMs: 0, wallMs: 1_000 });
    applyPassing(s, { id: 'linha-2', kart: '4', decoderTimeMs: 60_000, wallMs: 61_000 });
    clearCrossings(s);
    expect(computeStandings(s)[0].laps).toBe(0);
    setCrossingDeleted(s, 'linha-1', false);
    setCrossingDeleted(s, 'linha-2', false);
    expect(computeStandings(s)[0].laps).toBe(1);
  });
});

describe('catalogo de eventos e provas', () => {
  it('cadastra, distribui, duplica e exclui eventos com seus grupos e provas', () => {
    const catalog = emptyCatalog();
    let seq = 0;
    const id = () => `id-${++seq}`;
    const event = createCatalogRecord(catalog, 'events', { name: 'Etapa de teste', date: '2026-09-26' }, id(), 100) as { id: string };
    const group = createCatalogRecord(catalog, 'groups', { eventId: event.id, name: 'Bateria 18:00' }, id(), 100) as { id: string };
    const proof = createCatalogRecord(catalog, 'provas', { groupId: group.id, name: 'Corrida', type: 'corrida', durationMin: 20 }, id(), 100) as { id: string };
    expect(distributeProof(catalog, proof.id, { heats: 3, startAt: '18:00', intervalMin: 15 })).toMatchObject({ heats: 3, startAt: '18:00', intervalMin: 15 });
    const copy = duplicateEvent(catalog, event.id, id, 200);
    expect(catalog.events).toHaveLength(2);
    expect(catalog.groups).toHaveLength(2);
    expect(catalog.provas).toHaveLength(2);
    expect(catalog.provas.find((item) => item.eventId === copy.id)?.name).toBe('Corrida');
    deleteCatalogRecord(catalog, 'events', event.id);
    expect(catalog.groups).toHaveLength(1);
    expect(catalog.provas).toHaveLength(1);
  });

  it('recusa importação com referências quebradas', () => {
    expect(() => normalizeCatalog({ events: [], groups: [{ id: 'g', eventId: 'missing', name: 'Grupo' }], provas: [], categories: [], tracks: [] })).toThrow('evento inexistente');
  });

  it('cadastra competidor com categoria e impede transponder duplicado', () => {
    const catalog = emptyCatalog();
    const category = createCatalogRecord(catalog, 'categories', { name: 'Graduados', color: '#12ab34' }, 'c-1', 1) as { id: string };
    const competitor = createCatalogRecord(catalog, 'competitors', { name: 'Piloto teste', kart: '42', transponder: '123456', categoryId: category.id, weightKg: 80 }, 'p-1', 1);
    expect(competitor).toMatchObject({ name: 'Piloto teste', kart: '42', transponder: '123456', categoryId: category.id, weightKg: 80, active: true });
    expect(() => createCatalogRecord(catalog, 'competitors', { name: 'Outro piloto', kart: '43', transponder: '123456' }, 'p-2', 1))
      .toThrow('já está vinculado');
  });

  it('ao excluir uma categoria, remove o vínculo dos grupos e competidores', () => {
    const catalog = emptyCatalog();
    const category = createCatalogRecord(catalog, 'categories', { name: 'Graduados' }, 'c-1', 1) as { id: string };
    createCatalogRecord(catalog, 'competitors', { name: 'Piloto teste', kart: '42', categoryId: category.id }, 'p-1', 1);
    deleteCatalogRecord(catalog, 'categories', category.id);
    expect(catalog.competitors[0].categoryId).toBeNull();
  });
});

describe('decoder TranX (conexão real)', () => {
  it('lê a linha de passagem do TranX como o LapTime (hex, TAB, SOH)', () => {
    const r = parseTrxLine('\u0001$\t20\t7\t17C8C9\t0001D4C0\t0A\t3C\t01\tx1234');
    expect(r).toMatchObject({ kind: 'passing', decoderId: '20', sequence: 7, transponder: 1558729, decoderTimeMs: 120_000, hits: 10, strength: 60 });
  });

  it('status do decoder não vira passagem', () => {
    expect(parseTrxLine('\u0001#\t20\t0\t24\t0\tx2ADF').kind).toBe('status');
  });

  it('manda @RESET e SOH ?;;;11; ao conectar, igual ao LapTime', async () => {
    const { TRX_INIT_COMMANDS } = await import('../lib/timing/decoder-client');
    expect(TRX_INIT_COMMANDS).toEqual(['@RESET', '\u0001?;;;11;']);
  });

  it('relógio do decoder zerado no meio da prova (reconexão) usa o tempo real da volta', () => {
    const s = race();
    applyPassing(s, { kart: '4', decoderTimeMs: 600_000, wallMs: 1_000_000 });
    // conexão caiu e voltou: decoder reiniciou o relógio perto de zero
    applyPassing(s, { kart: '4', decoderTimeMs: 20_000, wallMs: 1_062_500 });
    const [a] = computeStandings(s);
    expect(a).toMatchObject({ laps: 1, lastLapMs: 62_500 });
  });
});

describe('decoder TranX formato decimal (linhas reais de 26/09)', () => {
  it('lê kart 008 e 047 do formato @', () => {
    expect(parseTrxLine('\u0001@\t20\t31\t5617602\t147.367\t178\t167\t2\txF7B9')).toMatchObject({ kind: 'passing', decoderId: '20', sequence: 31, transponder: 5617602, decoderTimeMs: 147_367, hits: 178, strength: 167 });
    expect(parseTrxLine('\u0001@\t20\t32\t4202107\t148.146\t354\t183\t2\tx963D')).toMatchObject({ kind: 'passing', transponder: 4202107, decoderTimeMs: 148_146 });
  });

  it('milésimos curtos e confirmações de comando', () => {
    expect(parseTrxLine('\u0001@\t20\t1\t5617602\t65.5\t10\t90\t2\tx0000')).toMatchObject({ decoderTimeMs: 65_500 });
    expect(parseTrxLine('\u0001$\t20\t0\t0\t1\tx1F46').kind).toBe('other');
    expect(parseTrxLine('\u0001@\t20\t2\t9993\t1.000\t1\t1\t2\tx0000').kind).toBe('other');
  });
});

describe('leitura ignorada restaurada pelo operador', () => {
  it('volta a contar e recalcula as voltas em ordem', async () => {
    const { acceptRejected } = await import('../lib/timing/race-engine');
    const s = race();
    applyPassing(s, { kart: '8', decoderTimeMs: 0, wallMs: 1_000 });
    expect(applyPassing(s, { kart: '8', decoderTimeMs: 3_000, wallMs: 4_000 })).toBe('ignored-min-lap');
    acceptRejected(s, { id: 'r1', kart: '8', transponder: 5617602, wallMs: 4_000, decoderTimeMs: 3_000, reason: 'ignored-min-lap', sinceLastMs: 3_000 });
    applyPassing(s, { kart: '8', decoderTimeMs: 60_000, wallMs: 61_000 });
    const [a] = computeStandings(s);
    expect(a.laps).toBe(2);
    expect(a.lastLapMs).toBe(57_000);
  });
});

describe('decoder P3 (porta 5403, a do Orbits)', () => {
  function quadroPassagem(transponder: number, rtcUs: bigint) {
    const campos = Buffer.concat([
      Buffer.from([0x01, 4]), Buffer.from(Uint32Array.of(77).buffer),
      Buffer.from([0x03, 4]), Buffer.from(Uint32Array.of(transponder).buffer),
      Buffer.from([0x04, 8]), (() => { const b = Buffer.alloc(8); b.writeBigUInt64LE(rtcUs); return b; })(),
      Buffer.from([0x05, 2, 0xb3, 0x00, 0x06, 2, 0xee, 0x00]),
    ]);
    const cab = Buffer.alloc(9); cab[0] = 2; cab.writeUInt16LE(campos.length + 11, 1); cab.writeUInt16LE(0x0001, 7);
    // escapa 0x8A..0x8F como o decoder faz
    const corpo: number[] = [];
    for (const x of Buffer.concat([cab, campos])) { if (x >= 0x8a && x <= 0x8f) corpo.push(0x8d, x + 0x20); else corpo.push(x); }
    return Buffer.from([0x8e, ...corpo, 0x8f]);
  }

  it('lê transponder e horário RTC (ms) igual ao Orbits', async () => {
    const { P3FrameSplitter, parseP3Frame } = await import('../lib/timing/p3-parser');
    const sp = new P3FrameSplitter();
    // horário do Orbits de 26/09 (kart 8): 1790395454872000 µs; o transponder 5617602 tem byte 0x8F? não, mas testa escape com 0x8E no tempo
    const a = quadroPassagem(5617602, 1790395454872000n);
    const b = quadroPassagem(5617602, 1790395462580000n);
    const frames = [...sp.push(a.subarray(0, 10)), ...sp.push(Buffer.concat([a.subarray(10), b]))];
    const recs = frames.map(parseP3Frame);
    expect(recs).toHaveLength(2);
    expect(recs[0]).toMatchObject({ kind: 'passing', transponder: 5617602, sequence: 77, hits: 238, strength: 179 });
    const volta = (recs[1] as { decoderTimeMs: number }).decoderTimeMs - (recs[0] as { decoderTimeMs: number }).decoderTimeMs;
    expect(volta).toBe(7_708); // mesma volta que o Orbits mostrou
  });

  it('desfaz escape de bytes 0x8A..0x8F', async () => {
    const { P3FrameSplitter, parseP3Frame } = await import('../lib/timing/p3-parser');
    const q = quadroPassagem(0x8e8d8f, 0x8f8e8d8an * 1000n);
    const [f] = new P3FrameSplitter().push(q);
    expect(parseP3Frame(f)).toMatchObject({ transponder: 0x8e8d8f, decoderTimeMs: Number(0x8f8e8d8an) });
  });
});
