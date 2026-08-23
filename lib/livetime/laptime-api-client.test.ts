import { afterEach, describe, expect, it, vi } from 'vitest';
import { LapTimeApiClient } from './laptime-api-client';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('LapTimeApiClient', () => {
  it('adds the API segment when the configured base points to the application root', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ token: 'token-1', expiration: '2099-01-01T00:00:00.000Z' }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const client = new LapTimeApiClient(
      { baseUrl: 'http://192.168.20.254/laptime' },
      async () => new Date('2026-08-23T21:00:00.000Z'),
    );

    await client.getToken();

    expect(fetchMock).toHaveBeenCalledWith(
      'http://192.168.20.254/laptime/api/Security/Authenticate',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('does not duplicate the API segment when it is already configured', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ token: 'token-2', expiration: '2099-01-01T00:00:00.000Z' }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const client = new LapTimeApiClient(
      { baseUrl: 'http://192.168.20.254/laptime/api/' },
      async () => new Date('2026-08-23T21:00:00.000Z'),
    );

    await client.getToken();

    expect(fetchMock).toHaveBeenCalledWith(
      'http://192.168.20.254/laptime/api/Security/Authenticate',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});
