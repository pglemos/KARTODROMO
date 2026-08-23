import { describe, expect, it } from 'vitest';
import { isLapTimeRacingFinalized } from '@/lib/livetime/laptime-racings';

describe('situação das corridas LapTime', () => {
  it('considera estados, bandeiras e marcadores de encerramento como finalizados', () => {
    expect(isLapTimeRacingFinalized(5, null)).toBe(true);
    expect(isLapTimeRacingFinalized(6, null)).toBe(true);
    expect(isLapTimeRacingFinalized(2, 4)).toBe(true);
    expect(isLapTimeRacingFinalized(2, null, '2026-08-22T12:00:00.000Z')).toBe(true);
    expect(isLapTimeRacingFinalized(2, null, null, 579)).toBe(true);
    expect(isLapTimeRacingFinalized(2, null, null, 0)).toBe(false);
    expect(isLapTimeRacingFinalized(2, null, new Date('1970-01-01T00:00:00.000Z'))).toBe(false);
  });

  it('mantém uma corrida sem encerramento como não finalizada', () => {
    expect(isLapTimeRacingFinalized(1, null)).toBe(false);
    expect(isLapTimeRacingFinalized(2, 1)).toBe(false);
  });
});
