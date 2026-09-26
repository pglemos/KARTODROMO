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
  includeManualPassing,
  remainingMs,
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

  it('quadriculada por tempo: cada kart termina na proxima passagem e a bateria encerra', () => {
    const s = race('corrida', 1);
    applyPassing(s, { kart: '4', decoderTimeMs: 0, wallMs: 5_000 });
    applyPassing(s, { kart: '5', decoderTimeMs: 500, wallMs: 5_500 });
    tick(s, 61_000);
    expect(s.state).toBe('bandeira_final');
    applyPassing(s, { kart: '4', decoderTimeMs: 62_000, wallMs: 62_000 });
    expect(applyPassing(s, { kart: '4', decoderTimeMs: 130_000, wallMs: 0 })).toBe('ignored-finished');
    applyPassing(s, { kart: '5', decoderTimeMs: 63_000, wallMs: 63_000 });
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

  it('formata tempo de volta', () => {
    expect(formatLap(64_062)).toBe('1:04.062');
    expect(formatLap(9_500)).toBe('9.500');
    expect(formatLap(null)).toBe('--');
  });

  it('bandeira vermelha pausa o cronômetro e a verde retoma do tempo restante', () => {
    const s = race('corrida', 1);
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
