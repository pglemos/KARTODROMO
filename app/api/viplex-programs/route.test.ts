import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET, PUT } from './route';

describe('/api/viplex-programs', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('returns an empty operational payload when the remote ViPlex endpoint is unavailable', async () => {
    vi.stubEnv('TELAO_LAYOUT_REMOTE_ENDPOINT', 'https://example.test/api/telao-layout-local');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('fetch failed')));

    const response = await GET(new NextRequest('http://localhost/api/viplex-programs'));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({
      programs: [],
      error: 'fetch failed',
    });
  });

  it('normalizes remote GET failures to HTTP 200 so the dashboard can render the warning', async () => {
    vi.stubEnv('TELAO_LAYOUT_REMOTE_ENDPOINT', 'https://example.test/api/telao-layout-local');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: 'viplex_unavailable' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );

    const response = await GET(new NextRequest('http://localhost/api/viplex-programs'));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({
      programs: [],
      error: 'viplex_unavailable',
    });
  });

  it('normalizes remote Cloudflare 524 failures to a ViPlex timeout warning', async () => {
    vi.stubEnv('TELAO_LAYOUT_REMOTE_ENDPOINT', 'https://example.test/api/telao-layout-local');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 524 })));

    const response = await GET(new NextRequest('http://localhost/api/viplex-programs'));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({
      programs: [],
      error: 'viplex_remote_timeout',
    });
  });

  it('allows remote ViPlex actions to outlive the short dashboard read timeout', async () => {
    vi.stubEnv('TELAO_LAYOUT_REMOTE_ENDPOINT', 'https://example.test/api/telao-layout-local');
    vi.stubEnv('TELAO_LAYOUT_REMOTE_TIMEOUT_MS', '1');
    vi.stubEnv('VIPLEX_PROGRAMS_REMOTE_ACTION_TIMEOUT_MS', '100');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(
        () =>
          new Promise<Response>((resolve) => {
            setTimeout(
              () =>
                resolve(
                  new Response(JSON.stringify({ ok: true, identifier: 'program-1' }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                  }),
                ),
              10,
            );
          }),
      ),
    );

    const response = await PUT(
      new NextRequest('http://localhost/api/viplex-programs', {
        method: 'PUT',
        body: JSON.stringify({ identifier: 'program-1' }),
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({ ok: true, identifier: 'program-1' });
  });

  it('returns an explicit error when no remote endpoint is configured (GET)', async () => {
    const response = await GET(new NextRequest('http://localhost/api/viplex-programs'));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({ programs: [], error: 'viplex_remote_not_configured' });
  });

  it('returns an explicit error when no remote endpoint is configured (PUT)', async () => {
    const response = await PUT(
      new NextRequest('http://localhost/api/viplex-programs', {
        method: 'PUT',
        body: JSON.stringify({ identifier: 'program-1' }),
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toEqual({ ok: false, error: 'viplex_remote_not_configured' });
  });
});
