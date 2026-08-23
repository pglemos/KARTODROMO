import type { Metadata } from 'next';
import { createDemoSnapshot, DEFAULT_UID } from '@/lib/livetime/demo-data';
import { fetchExternalSnapshot } from '@/lib/livetime/snapshot-service';
import type { LiveTimingSnapshot } from '@/lib/livetime/types';
import { LivePodiumClient } from './LivePodiumClient';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Top 3 ao vivo | Kartódromo',
};

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

async function loadInitialSnapshot(uid: string, demo: boolean): Promise<LiveTimingSnapshot | null> {
  if (demo) return createDemoSnapshot('Demo solicitado');
  if (!process.env.LIVETIME_SNAPSHOT_ENDPOINT) return null;

  try {
    return await fetchExternalSnapshot(uid);
  } catch {
    return null;
  }
}

export default async function PodioLiveTb50Page({ searchParams }: PageProps) {
  const params = (await searchParams) || {};
  const uid = firstParam(params.uid) || process.env.NEXT_PUBLIC_DEFAULT_UID || DEFAULT_UID;
  const demo = firstParam(params.demo) === 'true';
  const initialSnapshot = await loadInitialSnapshot(uid, demo);

  return <LivePodiumClient uid={uid} demo={demo} initialSnapshot={initialSnapshot} />;
}
