import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from './route';
import { clearSnapshotCacheForTests } from '@/lib/livetime/snapshot-cache';
import { fetchExternalSnapshot } from '@/lib/livetime/snapshot-service';

vi.mock('@/lib/livetime/snapshot-service', () => ({
  fetchExternalSnapshot: vi.fn(),
}));

describe('/api/livetime-snapshot cache handoff', () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    clearSnapshotCacheForTests();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns the last valid driver list while LiveTime is between sessions', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-09T12:00:05.000Z'));

    vi.mocked(fetchExternalSnapshot)
      .mockResolvedValueOnce({
        status: 'live',
        source: 'dom-scraper',
        updatedAt: '2026-05-09T12:00:00.000Z',
        drivers: [
          { position: 1, kart: '201', name: 'PILOTO QUALI 01', time: '00:33.101' },
          { position: 2, kart: '202', name: 'PILOTO QUALI 02', time: '00:33.202' },
        ],
      })
      .mockResolvedValueOnce({
        status: 'waiting',
        source: 'dom-scraper',
        updatedAt: '2026-05-09T12:05:00.000Z',
        message: 'Aguardando proxima corrida',
        drivers: [],
      });

    await GET(new NextRequest('http://localhost/api/livetime-snapshot?uid=test-session'));
    vi.setSystemTime(new Date('2026-05-09T12:00:09.000Z'));
    const response = await GET(new NextRequest('http://localhost/api/livetime-snapshot?uid=test-session'));
    const snapshot = await response.json();

    expect(snapshot.source).toBe('cache');
    expect(snapshot.status).toBe('live');
    expect(snapshot.message).toBe('Aguardando proxima corrida');
    expect(snapshot.drivers).toEqual([
      { position: 1, kart: '201', name: 'PILOTO QUALI 01', time: '00:33.101' },
      { position: 2, kart: '202', name: 'PILOTO QUALI 02', time: '00:33.202' },
    ]);
  });

  it('does not keep a stale cached driver list after the hold TTL expires', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-09T12:00:00.000Z'));

    vi.mocked(fetchExternalSnapshot)
      .mockResolvedValueOnce({
        status: 'live',
        source: 'dom-scraper',
        updatedAt: '2026-05-09T12:00:00.000Z',
        drivers: [{ position: 1, kart: '201', name: 'PILOTO QUALI 01', time: '00:33.101' }],
      })
      .mockResolvedValueOnce({
        status: 'empty',
        source: 'dom-scraper',
        updatedAt: '2026-05-09T12:00:11.000Z',
        message: 'Nenhuma corrida aberta',
        drivers: [],
      });

    await GET(new NextRequest('http://localhost/api/livetime-snapshot?uid=test-session'));
    vi.setSystemTime(new Date('2026-05-09T12:00:11.000Z'));
    const response = await GET(new NextRequest('http://localhost/api/livetime-snapshot?uid=test-session'));
    const snapshot = await response.json();

    expect(snapshot.source).toBe('dom-scraper');
    expect(snapshot.status).toBe('empty');
    expect(snapshot.drivers).toEqual([]);
  });

  it('returns an operational error snapshot with HTTP 200 when the external source fails and there is no cache', async () => {
    vi.mocked(fetchExternalSnapshot).mockRejectedValueOnce(new Error('fetch failed'));

    const response = await GET(new NextRequest('http://localhost/api/livetime-snapshot?uid=test-session'));
    const snapshot = await response.json();

    expect(response.status).toBe(200);
    expect(snapshot).toMatchObject({
      status: 'error',
      source: 'dom-scraper',
      message: 'fetch failed',
      drivers: [],
    });
  });
});
