import { DEFAULT_PODIUM_UID, FinalPodiumClient } from './FinalPodiumClient';
import { createDemoSnapshot } from '@/lib/livetime/demo-data';
import { getLastSnapshot } from '@/lib/livetime/snapshot-cache';
import { fetchExternalSnapshot } from '@/lib/livetime/snapshot-service';
import { isFinishedRaceSnapshot, isRaceSnapshot } from '@/lib/livetime/session-type';
import { readTb50DisplayModeFromStore } from '@/lib/tb50-display-mode-store';
import type { LiveTimingSnapshot } from '@/lib/livetime/types';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Pódio Final TB50 | Kartódromo',
};

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function stringParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function forceFinishedSnapshotFromCache(uid: string, promoteRaceCache = false): LiveTimingSnapshot | null {
  const cached = getLastSnapshot(uid);
  if (!cached?.drivers.length || !isRaceSnapshot(cached)) return null;
  if (!promoteRaceCache && !isFinishedRaceSnapshot(cached)) return null;

  return {
    ...cached,
    status: 'finished',
    source: 'cache',
    message: cached.message || 'Resultado final usando ultimo snapshot real da corrida',
  };
}

async function loadInitialSnapshot(uid: string, demo: boolean, allowLiveSnapshot: boolean): Promise<LiveTimingSnapshot | null> {
  if (demo) return createDemoSnapshot('Demo solicitado');

  try {
    const snapshot = await fetchExternalSnapshot(uid);
    if (allowLiveSnapshot && snapshot.status === 'finished' && !snapshot.drivers.length) {
      return forceFinishedSnapshotFromCache(uid, true);
    }

    return isFinishedRaceSnapshot(snapshot) && snapshot.drivers.length > 0 ? snapshot : null;
  } catch {
    if (allowLiveSnapshot) return forceFinishedSnapshotFromCache(uid);
    return null;
  }
}

export default async function PodioFinalTb50Page({ searchParams }: PageProps) {
  const params = (await searchParams) || {};
  const uid = stringParam(params.uid) || process.env.NEXT_PUBLIC_DEFAULT_UID || DEFAULT_PODIUM_UID;
  const demo = stringParam(params.demo) === 'true';
  const force = stringParam(params.force) === 'true';
  const auto = stringParam(params.auto) === 'true';
  const state = await readTb50DisplayModeFromStore();
  const manualFinal = state.mode === 'final-real';
  if (!force && !demo && !manualFinal && !auto) redirect('/placar-telao-tb50?layout=designer');

  const allowLiveSnapshot = force || manualFinal;

  const initialSnapshot = await loadInitialSnapshot(uid, demo, allowLiveSnapshot);
  if (!demo && !isFinishedRaceSnapshot(initialSnapshot)) {
    redirect('/placar-telao-tb50?layout=designer');
  }

  return <FinalPodiumClient uid={uid} demo={demo} force={force} allowLiveSnapshot={allowLiveSnapshot} initialSnapshot={initialSnapshot} />;
}
