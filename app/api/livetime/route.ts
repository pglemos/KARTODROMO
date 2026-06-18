import { NextRequest, NextResponse } from 'next/server';
import { createDemoSnapshot, DEFAULT_UID } from '@/lib/livetime/demo-data';
import { normalizeDrivers } from '@/lib/livetime/normalize-drivers';
import type { LiveTimingSnapshot } from '@/lib/livetime/types';

export const dynamic = 'force-dynamic';

function withUid(endpoint: string, uid: string): string {
  if (endpoint.includes('{uid}')) return endpoint.split('{uid}').join(encodeURIComponent(uid));
  const url = new URL(endpoint);
  url.searchParams.set('uid', uid);
  return url.toString();
}

async function fetchWithTimeout(url: string, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      cache: 'no-store',
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET(request: NextRequest) {
  const uid = request.nextUrl.searchParams.get('uid') || process.env.NEXT_PUBLIC_DEFAULT_UID || DEFAULT_UID;
  const endpoint = process.env.LIVETIME_ENDPOINT;

  if (!endpoint) {
    return NextResponse.json(createDemoSnapshot('LIVETIME_ENDPOINT nao configurado'));
  }

  try {
    const timeoutMs = Number(process.env.LIVETIME_TIMEOUT_MS || '3000');
    const response = await fetchWithTimeout(withUid(endpoint, uid), timeoutMs);

    if (!response.ok) {
      const snapshot: LiveTimingSnapshot = {
        status: 'error',
        source: 'rest',
        updatedAt: new Date().toISOString(),
        message: `LiveTime HTTP ${response.status}`,
        drivers: [],
      };
      return NextResponse.json(snapshot, { status: 502 });
    }

    const raw = await response.json();
    const drivers = normalizeDrivers(raw);
    const snapshot: LiveTimingSnapshot = {
      status: drivers.length > 0 ? 'live' : 'empty',
      source: 'rest',
      updatedAt: new Date().toISOString(),
      drivers,
    };

    return NextResponse.json(snapshot);
  } catch (error) {
    const snapshot: LiveTimingSnapshot = {
      status: 'error',
      source: 'rest',
      updatedAt: new Date().toISOString(),
      message: error instanceof Error ? error.message : 'Erro ao consultar LiveTime',
      drivers: [],
    };
    return NextResponse.json(snapshot, { status: 502 });
  }
}
