import type { LiveTimingSnapshot } from '@/lib/livetime/types';

const LABELS: Record<LiveTimingSnapshot['status'], string> = {
  live: 'AO VIVO',
  demo: 'DEMO',
  waiting: 'SEM DADOS',
  empty: 'SEM DADOS',
  error: 'ERRO',
};

export function StatusBar({ snapshot }: { snapshot: LiveTimingSnapshot }) {
  const updatedAt = new Date(snapshot.updatedAt);
  const isInitialTimestamp = snapshot.updatedAt === '1970-01-01T00:00:00.000Z';
  const time = Number.isNaN(updatedAt.getTime()) || isInitialTimestamp
    ? '--:--:--'
    : updatedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <header className="telao-status">
      <div className="telao-event">
        <strong>{snapshot.eventName || 'KARTODROMO'}</strong>
        {snapshot.trackName ? <span>{snapshot.trackName}</span> : null}
      </div>
      <div className={`telao-badge telao-badge-${snapshot.status}`}>{LABELS[snapshot.status]}</div>
      <div className="telao-updated">{time}</div>
    </header>
  );
}
