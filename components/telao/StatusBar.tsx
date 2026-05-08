'use client';

import { useEffect, useState } from 'react';
import type { LiveTimingSnapshot } from '@/lib/livetime/types';

const LABELS: Record<LiveTimingSnapshot['status'], string> = {
  live: 'AO VIVO',
  demo: 'DEMO',
  waiting: 'SEM DADOS',
  empty: 'SEM DADOS',
  error: 'ERRO',
};

function formatClock(date: Date): string {
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function StatusBar({ snapshot }: { snapshot: LiveTimingSnapshot }) {
  const updatedAt = new Date(snapshot.updatedAt);
  const isInitialTimestamp = snapshot.updatedAt === '1970-01-01T00:00:00.000Z';
  const initialTime = Number.isNaN(updatedAt.getTime()) || isInitialTimestamp ? '--:--:--' : formatClock(updatedAt);
  const [time, setTime] = useState(initialTime);
  const eventName = snapshot.eventName || 'CRONOMETRAGEM AO VIVO';
  const trackName = snapshot.trackName || 'Kartodromo de Betim';

  useEffect(() => {
    const tick = () => setTime(formatClock(new Date()));
    tick();
    const interval = window.setInterval(tick, 1000);

    return () => window.clearInterval(interval);
  }, []);

  return (
    <header className="telao-status">
      <div className="telao-brand" aria-label="Kartodromo de Betim">
        <img className="telao-logo" src="/brand/kartodromo-betim-logo.png" alt="Kartodromo Internacional de Betim" />
      </div>
      <div className="telao-track">
        <span>{eventName}</span>
        <strong>{trackName}</strong>
      </div>
      <div className="telao-race-state">
        <div className={`telao-badge telao-badge-${snapshot.status}`}>{LABELS[snapshot.status]}</div>
        <div className="telao-updated">{time}</div>
      </div>
    </header>
  );
}
