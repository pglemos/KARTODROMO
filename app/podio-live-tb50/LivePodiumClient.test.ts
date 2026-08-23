import { describe, expect, it } from 'vitest';
import {
  formatLivePodiumEventLabel,
  formatLivePodiumFreshness,
  formatLivePodiumSessionLabel,
  getLivePodiumDisplayStatus,
  isLivePodiumSnapshotStale,
  selectLivePodiumDrivers,
} from './LivePodiumClient';

const LIVE_UPDATED_AT = '2026-08-22T16:15:39.506Z';

describe('live TB50 podium selection', () => {
  it('selects positions 1, 2 and 3 independently of API order', () => {
    const result = selectLivePodiumDrivers({
      status: 'live',
      source: 'rest',
      updatedAt: LIVE_UPDATED_AT,
      drivers: [
        { position: 3, kart: '107', name: 'FA2', time: '1:05.437' },
        { position: 1, kart: '104', name: 'GT1', time: '1:05.864' },
        { position: 2, kart: '126', name: 'ZE2', time: '1:05.723' },
      ],
    });

    expect(result.map((driver) => driver?.kart)).toEqual(['104', '126', '107']);
  });

  it('leaves a missing position empty instead of shifting another kart', () => {
    const result = selectLivePodiumDrivers({
      status: 'waiting',
      source: 'rest',
      updatedAt: LIVE_UPDATED_AT,
      drivers: [{ position: 1, kart: '104', name: 'GT1', time: '1:05.864' }],
    });

    expect(result.map((driver) => driver?.kart)).toEqual(['104', undefined, undefined]);
  });

  it('marks a live snapshot as stale after four missed polling intervals', () => {
    const snapshot = {
      status: 'live' as const,
      source: 'rest' as const,
      updatedAt: LIVE_UPDATED_AT,
      drivers: [],
    };
    const updatedAt = Date.parse(LIVE_UPDATED_AT);

    expect(isLivePodiumSnapshotStale(snapshot, updatedAt + 7_999)).toBe(false);
    expect(isLivePodiumSnapshotStale(snapshot, updatedAt + 8_000)).toBe(false);
    expect(isLivePodiumSnapshotStale(snapshot, updatedAt + 8_001)).toBe(true);
    expect(getLivePodiumDisplayStatus(snapshot, false, updatedAt + 8_001)).toBe('stale');
  });

  it('shows an unstable signal after a failed poll without discarding the last frame', () => {
    const snapshot = {
      status: 'live' as const,
      source: 'rest' as const,
      updatedAt: LIVE_UPDATED_AT,
      drivers: [],
    };

    expect(getLivePodiumDisplayStatus(snapshot, true, Date.parse(LIVE_UPDATED_AT))).toBe('stale');
  });

  it('compresses repeated event feed segments into a readable header', () => {
    const snapshot = {
      status: 'live' as const,
      source: 'rest' as const,
      updatedAt: LIVE_UPDATED_AT,
      sessionType: 'qualifying' as const,
      eventName: '500 MILHAS 2026 - 500 MILHAS - TOMADA DE TEMPO - 500 MILHAS',
      drivers: [],
    };

    expect(formatLivePodiumEventLabel(snapshot)).toBe('500 MILHAS 2026');
    expect(formatLivePodiumSessionLabel(snapshot)).toBe('TOMADA DE TEMPO');
  });

  it('formats freshness from the snapshot timestamp instead of local clock time', () => {
    const snapshot = {
      status: 'live' as const,
      source: 'rest' as const,
      updatedAt: LIVE_UPDATED_AT,
      drivers: [],
    };
    const updatedAt = Date.parse(LIVE_UPDATED_AT);

    expect(formatLivePodiumFreshness(snapshot, updatedAt + 1_000)).toBe('ATUALIZADO AGORA');
    expect(formatLivePodiumFreshness(snapshot, updatedAt + 12_000)).toBe('ATUALIZADO HÁ 12S');
  });

  it('does not call an empty error response updated data', () => {
    expect(formatLivePodiumFreshness({
      status: 'error',
      source: 'dom-scraper',
      updatedAt: LIVE_UPDATED_AT,
      message: 'Sinal indisponível',
      drivers: [],
    }, Date.parse(LIVE_UPDATED_AT))).toBe('AGUARDANDO SINAL');
  });
});
