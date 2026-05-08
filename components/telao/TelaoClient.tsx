'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createDemoSnapshot, DEFAULT_UID } from '@/lib/livetime/demo-data';
import { fetchLiveTimingSnapshot } from '@/lib/livetime/client';
import type { LiveTimingSnapshot } from '@/lib/livetime/types';
import { DEFAULT_TELAO_LAYOUT, normalizeTelaoLayoutConfig, type TelaoLayoutConfig } from '@/lib/telao-layout-config';
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

type TelaoClientProps = {
  initialSnapshot?: LiveTimingSnapshot;
};

export function TelaoClient({ initialSnapshot = INITIAL_SNAPSHOT }: TelaoClientProps) {
  const config = useMemo(readParams, []);
  const [snapshot, setSnapshot] = useState<LiveTimingSnapshot>(initialSnapshot);
  const [layout, setLayout] = useState<TelaoLayoutConfig>(DEFAULT_TELAO_LAYOUT);
  const lastValid = useRef<LiveTimingSnapshot | null>(initialSnapshot.drivers.length > 0 ? initialSnapshot : null);

  useEffect(() => {
    document.documentElement.style.setProperty('--font-scale', String(config.fontScale));
  }, [config.fontScale]);

  useEffect(() => {
    let stopped = false;
    let controller: AbortController | null = null;
    let inFlight = false;

    async function load() {
      if (inFlight) return;
      inFlight = true;
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
      } finally {
        inFlight = false;
      }
    }

    void load();
    const interval = window.setInterval(load, 1000);

    return () => {
      stopped = true;
      controller?.abort();
      window.clearInterval(interval);
    };
  }, [config.uid, config.demo]);

  useEffect(() => {
    let stopped = false;

    async function loadLayout() {
      try {
        const response = await fetch(`/api/telao-layout?_ts=${Date.now()}`, { cache: 'no-store' });
        if (!response.ok) return;
        const data = await response.json();
        if (!stopped) setLayout(normalizeTelaoLayoutConfig(data.layout));
      } catch {
        // Keep the last valid layout if the designer API is temporarily unavailable.
      }
    }

    void loadLayout();
    const interval = window.setInterval(loadLayout, 2000);

    return () => {
      stopped = true;
      window.clearInterval(interval);
    };
  }, []);

  const showHeader = config.showHeader && layout.showHeader;

  return (
    <main className={`telao-page telao-theme-dark ${showHeader ? '' : 'telao-no-header'}`}>
      {showHeader ? <StatusBar snapshot={snapshot} /> : null}
      <section className="telao-table-wrap">
        <LiveTimingTable drivers={snapshot.drivers} layout={layout} />
      </section>
    </main>
  );
}
