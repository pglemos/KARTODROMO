import { TelaoClient } from '@/components/telao/TelaoClient';
import { createDemoSnapshot, DEFAULT_UID } from '@/lib/livetime/demo-data';
import { fetchExternalSnapshot } from '@/lib/livetime/snapshot-service';
import type { LiveTimingSnapshot } from '@/lib/livetime/types';

export const dynamic = 'force-dynamic';

type SearchParams = Record<string, string | string[] | undefined>;

function firstParam(params: SearchParams, key: string): string | undefined {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

async function initialSnapshot(uid: string, demoRequested: boolean): Promise<LiveTimingSnapshot> {
  if (demoRequested) return createDemoSnapshot('Demo solicitado');

  if (!process.env.LIVETIME_SNAPSHOT_ENDPOINT && process.env.NODE_ENV === 'production') {
    return {
      status: 'error',
      source: 'dom-scraper',
      updatedAt: new Date().toISOString(),
      message: 'LIVETIME_SNAPSHOT_ENDPOINT nao configurado em producao',
      drivers: [],
    };
  }

  try {
    return await fetchExternalSnapshot(uid);
  } catch (error) {
    return {
      status: 'error',
      source: 'dom-scraper',
      updatedAt: new Date().toISOString(),
      message: error instanceof Error ? error.message : 'Erro ao obter snapshot',
      drivers: [],
    };
  }
}

export default async function PlacarTelaoPage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const params = (await searchParams) || {};
  const uid = firstParam(params, 'uid') || process.env.NEXT_PUBLIC_DEFAULT_UID || DEFAULT_UID;
  const demoRequested = firstParam(params, 'demo') === 'true' || process.env.LIVETIME_FORCE_DEMO === 'true';
  const snapshot = await initialSnapshot(uid, demoRequested);

  return <TelaoClient initialSnapshot={snapshot} />;
}
