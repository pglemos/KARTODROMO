import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { listViplexPrograms, startViplexProgram } from '@/lib/viplex-programs';
import { GET, PUT } from './route';

vi.mock('@/lib/viplex-programs', () => ({
  listViplexPrograms: vi.fn(),
  startViplexProgram: vi.fn(),
}));

describe('/api/viplex-programs', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.mocked(listViplexPrograms).mockReset();
    vi.mocked(startViplexProgram).mockReset();
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

  it('loads local ViPlex programs when no remote endpoint is configured', async () => {
    vi.mocked(listViplexPrograms).mockResolvedValue([
      {
        id: '1',
        identifier: 'program-1',
        name: 'CRONOMETRAGEM',
        width: 2048,
        height: 512,
        duration: 10000,
        statusCode: 1,
        source: 0,
      },
    ]);

    const response = await GET(new NextRequest('http://localhost/api/viplex-programs'));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({
      programs: [
        {
          id: '1',
          identifier: 'program-1',
          name: 'CRONOMETRAGEM',
          width: 2048,
          height: 512,
          duration: 10000,
          statusCode: 1,
          source: 0,
        },
      ],
      local: true,
    });
  });

  it('starts a local ViPlex program when no remote endpoint is configured', async () => {
    vi.mocked(startViplexProgram).mockResolvedValue({ ok: true, identifier: 'program-1' });

    const response = await PUT(
      new NextRequest('http://localhost/api/viplex-programs', {
        method: 'PUT',
        body: JSON.stringify({ identifier: 'program-1' }),
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({ ok: true, identifier: 'program-1' });
    expect(startViplexProgram).toHaveBeenCalledWith('program-1');
  });
});
