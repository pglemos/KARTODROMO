import { describe, expect, it } from 'vitest';
import { buildKartHistoryWindows } from '@/lib/equalizacao/history';

const row = (raceId: string, bestLapMs: number | null) => ({
  raceId,
  raceName: `Corrida ${raceId}`,
  raceType: 'Corrida',
  raceDate: '2026-08-20T12:00:00.000Z',
  trackName: 'Principal',
  plate: '106',
  sensor: null,
  driver: 'Piloto',
  bestLap: bestLapMs === null ? null : '1:05.000',
  bestLapMs,
  laps: 50,
  averageLap: null,
  matchedBy: 'plate' as const,
});

describe('janelas de historico da equalizacao', () => {
  it('calcula quantidade, melhor volta, media e tendencia em cada janela', () => {
    const rows = Array.from({ length: 15 }, (_, index) => row(String(index + 1), 65_000 + index * 100));
    const windows = buildKartHistoryWindows(rows);

    expect(windows['7']).toMatchObject({ count: 7, bestLapMs: 65_000, averageBestLapMs: 65_300, trendMs: -600 });
    expect(windows['15']).toMatchObject({ count: 15, bestLapMs: 65_000, averageBestLapMs: 65_700, trendMs: -1_400 });
    expect(windows['30'].count).toBe(15);
    expect(windows['60'].count).toBe(15);
  });

  it('ignora corridas sem melhor volta sem quebrar a janela', () => {
    const windows = buildKartHistoryWindows([row('1', null), row('2', 66_000)]);
    expect(windows['7']).toMatchObject({ count: 1, bestLapMs: 66_000, averageBestLapMs: 66_000 });
  });
});
