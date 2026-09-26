import { describe, expect, it } from 'vitest';
import { formatTrxPassing, LineSplitter, parseTrxLine } from '../lib/timing/trx-parser';
import {
  applyPassing,
  closeSession,
  computeStandings,
  createSession,
  formatLap,
  startSession,
  tick,
  toggleLapInvalid,
  AUTO_CLOSE_AFTER_CHECKERED_MS,
} from '../lib/timing/race-engine';

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
});
