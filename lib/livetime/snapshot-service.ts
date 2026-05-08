import { createDemoSnapshot } from '@/lib/livetime/demo-data';
import type { LiveTimingSnapshot } from '@/lib/livetime/types';

function resolveExternalUrl(endpoint: string, uid: string): string {
  if (endpoint.includes('{uid}')) return endpoint.split('{uid}').join(encodeURIComponent(uid));
  const url = new URL(endpoint);
  url.searchParams.set('uid', uid);
  return url.toString();
}

export async function fetchExternalSnapshot(uid: string): Promise<LiveTimingSnapshot> {
  const endpoint = process.env.LIVETIME_SNAPSHOT_ENDPOINT;
  if (!endpoint) return createDemoSnapshot('LIVETIME_SNAPSHOT_ENDPOINT nao configurado');

  const timeoutMs = Number(process.env.LIVETIME_TIMEOUT_MS || '3000');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(resolveExternalUrl(endpoint, uid), {
      cache: 'no-store',
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Snapshot HTTP ${response.status}`);
    }

    return (await response.json()) as LiveTimingSnapshot;
  } finally {
    clearTimeout(timeout);
  }
}
