'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createDemoSnapshot, DEFAULT_UID } from '@/lib/livetime/demo-data';
import { fetchLiveTimingSnapshot } from '@/lib/livetime/client';
import type { LiveTimingSnapshot } from '@/lib/livetime/types';
import { LiveTimingTable } from '@/components/telao/LiveTimingTable';
import { StatusBar } from '@/components/telao/StatusBar';
import './telao.css';

const INITIAL_SNAPSHOT: LiveTimingSnapshot = {
  status: 'demo',
  source: 'demo',
  updatedAt: '1970-01-01T00:00:00.000Z',
  eventName: 'KARTODROMO',
  trackName: 'CARREGANDO DADOS',
  message: 'Carregando dados',
  drivers: [],
};

function readParams() {
  if (typeof window === 'undefined') {
    return {
      uid: process.env.NEXT_PUBLIC_DEFAULT_UID || DEFAULT_UID,
      showHeader: true,
      fontScale: 1,
      demo: false,
    };
  }

  const params = new URLSearchParams(window.location.search);
  const fontScale = Number(params.get('fontScale') || '1');

  return {
    uid: params.get('uid') || process.env.NEXT_PUBLIC_DEFAULT_UID || DEFAULT_UID,
    showHeader: params.get('showHeader') !== 'false',
    fontScale: Number.isFinite(fontScale) ? Math.min(Math.max(fontScale, 0.85), 1.2) : 1,
    demo: params.get('demo') === 'true',
  };
}

export function TelaoClient() {
  const config = useMemo(readParams, []);
  const [snapshot, setSnapshot] = useState<LiveTimingSnapshot>(INITIAL_SNAPSHOT);
  const lastValid = useRef<LiveTimingSnapshot | null>(null);

  useEffect(() => {
    document.documentElement.style.setProperty('--font-scale', String(config.fontScale));
  }, [config.fontScale]);

  useEffect(() => {
    let stopped = false;
    let controller: AbortController | null = null;

    async function load() {
      controller?.abort();
      controller = new AbortController();

      try {
        const nextSnapshot = await fetchLiveTimingSnapshot(config.uid, controller.signal, config.demo);
        if (stopped) return;

        if (nextSnapshot.drivers.length > 0) {
          lastValid.current = nextSnapshot;
        }

        if (nextSnapshot.status === 'error' && lastValid.current) {
          setSnapshot({ ...lastValid.current, status: 'error', source: 'cache', message: nextSnapshot.message });
          return;
        }

        setSnapshot(nextSnapshot);
      } catch (error) {
        if (stopped) return;
        if (lastValid.current) {
          setSnapshot({ ...lastValid.current, status: 'error', source: 'cache', message: error instanceof Error ? error.message : 'Erro de conexao' });
          return;
        }

        setSnapshot({
          ...createDemoSnapshot('Erro de conexao'),
          status: 'error',
          drivers: [],
        });
      }
    }

    void load();
    const interval = window.setInterval(load, 2000);

    return () => {
      stopped = true;
      controller?.abort();
      window.clearInterval(interval);
    };
  }, [config.uid]);

  return (
    <main className={`telao-page telao-theme-dark ${config.showHeader ? '' : 'telao-no-header'}`}>
      {config.showHeader ? <StatusBar snapshot={snapshot} /> : null}
      <section className="telao-table-wrap">
        <LiveTimingTable drivers={snapshot.drivers} />
      </section>
    </main>
  );
}
