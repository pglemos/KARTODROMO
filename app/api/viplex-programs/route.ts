import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
  Expires: '0',
  Pragma: 'no-cache',
};

function viplexRemoteEndpoint() {
  if (process.env.VIPLEX_PROGRAMS_REMOTE_ENDPOINT) return process.env.VIPLEX_PROGRAMS_REMOTE_ENDPOINT;
  const layoutEndpoint = process.env.TELAO_LAYOUT_REMOTE_ENDPOINT;
  if (!layoutEndpoint) return null;
  return layoutEndpoint.replace(/\/api\/telao-layout-local\/?$/, '/api/viplex-programs-local');
}

function viplexRemoteTimeoutMs(method: string) {
  if (method !== 'GET') {
    return Number(process.env.VIPLEX_PROGRAMS_REMOTE_ACTION_TIMEOUT_MS || '90000');
  }

  return Number(process.env.VIPLEX_PROGRAMS_REMOTE_TIMEOUT_MS || process.env.TELAO_LAYOUT_REMOTE_TIMEOUT_MS || '1500');
}

function remoteHttpError(status: number, error?: unknown) {
  if (typeof error === 'string' && error) return error;
  if (status === 524) return 'viplex_remote_timeout';
  return `viplex_remote_http_${status}`;
}

function remoteFailureError(error: unknown) {
  if (error instanceof Error && error.name === 'AbortError') return 'viplex_remote_timeout';
  return error instanceof Error ? error.message : 'viplex_remote_failed';
}

async function proxyRemote(request: NextRequest, endpoint: string) {
  const body = request.method === 'GET' ? undefined : await request.text();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), viplexRemoteTimeoutMs(request.method));

  try {
    const response = await fetch(endpoint, {
      method: request.method,
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true',
      },
      body,
      cache: 'no-store',
      signal: controller.signal,
    });
    const data = await response.json().catch(() => ({}));

    if (request.method === 'GET' && !response.ok) {
      return NextResponse.json(
        { programs: [], error: remoteHttpError(response.status, data?.error) },
        { headers: NO_CACHE_HEADERS },
      );
    }

    return NextResponse.json(data, {
      status: response.status,
      headers: NO_CACHE_HEADERS,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ...(request.method === 'GET' ? { programs: [] } : { ok: false }),
        error: remoteFailureError(error),
      },
      { status: request.method === 'GET' ? 200 : 502, headers: NO_CACHE_HEADERS },
    );
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET(request: NextRequest) {
  const endpoint = viplexRemoteEndpoint();
  if (endpoint) return proxyRemote(request, endpoint);

  return NextResponse.json(
    { programs: [], error: 'viplex_remote_not_configured' },
    { headers: NO_CACHE_HEADERS },
  );
}

export async function PUT(request: NextRequest) {
  const endpoint = viplexRemoteEndpoint();
  if (endpoint) return proxyRemote(request, endpoint);

  return NextResponse.json(
    { ok: false, error: 'viplex_remote_not_configured' },
    { status: 400, headers: NO_CACHE_HEADERS },
  );
}
