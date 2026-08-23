import { describe, expect, it } from 'vitest';
import { mergeTeamRows } from './team-enrichment';
import type { LiveTimingSnapshot } from './types';

const snapshot: LiveTimingSnapshot = {
  status: 'live',
  source: 'rest',
  updatedAt: '2026-08-22T16:15:39.506Z',
  drivers: [
    { position: 1, kart: '104', name: 'GT1', time: '1:05.864' },
    { position: 2, kart: '126', name: 'ZE2', time: '1:05.723' },
    { position: 3, kart: '107', name: 'FA2', time: '1:05.437' },
  ],
};

describe('LiveTime team enrichment', () => {
  it('joins the full DOM team by kart and preserves the API timing fields', () => {
    const result = mergeTeamRows(snapshot, [
      { position: 1, kart: '#104', team: 'GORILLAS TEAM RACING 1' },
      { position: 2, kart: '126', team: 'ZERO27/AGUIA 2' },
      { position: 3, kart: '107', team: 'FIREPIT/ APEX 2' },
    ]);

    expect(result.drivers).toEqual([
      { position: 1, kart: '104', name: 'GT1', team: 'GORILLAS TEAM RACING 1', time: '1:05.864' },
      { position: 2, kart: '126', name: 'ZE2', team: 'ZERO27/AGUIA 2', time: '1:05.723' },
      { position: 3, kart: '107', name: 'FA2', team: 'FIREPIT/ APEX 2', time: '1:05.437' },
    ]);
  });

  it('falls back to position when the DOM temporarily omits the kart number', () => {
    const result = mergeTeamRows(snapshot, [{ position: 2, kart: '', team: 'ZERO27/AGUIA 2' }]);

    expect(result.drivers[1].team).toBe('ZERO27/AGUIA 2');
    expect(result.drivers[0].team).toBeUndefined();
  });
});
