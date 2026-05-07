import { describe, expect, it } from 'vitest';
import { normalizeDrivers } from '@/lib/livetime/normalize-drivers';

describe('normalizeDrivers', () => {
  it('normalizes canonical payloads', () => {
    expect(normalizeDrivers([{ position: 1, kart: 12, name: 'Pedro G.', time: '01:14.876' }])).toEqual([
      { position: 1, kart: '12', name: 'PEDRO G.', time: '01:14.876' },
    ]);
  });

  it('accepts alternative field names', () => {
    const result = normalizeDrivers({
      results: [{ pos: '2', number: '105', driver: 'Matteo', bestLapTime: '00:33.012' }],
    });

    expect(result).toEqual([{ position: 2, kart: '105', name: 'MATTEO', time: '00:33.012' }]);
  });

  it('accepts classification data and limits to 30 drivers', () => {
    const payload = {
      classification: Array.from({ length: 35 }, (_, index) => ({
        rank: index + 1,
        kartNumber: 200 + index,
        driverName: `Piloto ${index + 1}`,
        totalTime: '00:00.000',
      })),
    };

    const result = normalizeDrivers(payload);
    expect(result).toHaveLength(30);
    expect(result[29]).toEqual({ position: 30, kart: '229', name: 'PILOTO 30', time: '00:00.000' });
  });

  it('returns an empty list for invalid payloads', () => {
    expect(normalizeDrivers(null)).toEqual([]);
    expect(normalizeDrivers({})).toEqual([]);
    expect(normalizeDrivers({ data: null })).toEqual([]);
  });
});
