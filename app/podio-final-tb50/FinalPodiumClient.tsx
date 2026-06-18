'use client';

import { type CSSProperties, useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_UID } from '@/lib/livetime/demo-data';
import { isFinishedRaceSnapshot } from '@/lib/livetime/session-type';
import type { LiveTimingDriver, LiveTimingSnapshot } from '@/lib/livetime/types';
import './podio-final.css';

type FinalPodiumClientProps = {
  uid: string;
  demo: boolean;
  force: boolean;
  allowLiveSnapshot: boolean;
  initialSnapshot: LiveTimingSnapshot | null;
};

type PodiumDriver = {
  rank: number;
  position: number;
  kart: string;
  hasKart: boolean;
  name: string;
  shortName: string;
  leaderboardName: string;
  time: string;
  suitColor: string;
  kartAccent: string;
  slotX: number;
  filled: boolean;
};

const SUIT_COLORS = ['#ef4444', '#22c55e', '#3b82f6', '#eab308', '#a855f7'];
const PODIUM_ORDER_BY_COUNT: Record<number, number[]> = {
  1: [1],
  2: [2, 1],
  3: [2, 1, 3],
  4: [2, 1, 3, 4],
  5: [4, 2, 1, 3, 5],
};
const PODIUM_SLOT_X_BY_COUNT: Record<number, Record<number, number>> = {
  1: { 1: 50 },
  2: { 1: 57, 2: 39 },
  3: { 1: 50, 2: 32, 3: 68 },
  4: { 1: 50, 2: 32, 3: 68, 4: 84 },
  5: { 1: 50, 2: 30, 3: 70, 4: 12, 5: 88 },
};
const FINAL_PODIUM_POLL_MS = 5000;
const NAME_PARTICLES = /^(DE|DA|DO|DOS|DAS|E)$/i;

export function shouldPollManualDisplayMode(force: boolean, demo: boolean, allowLiveSnapshot: boolean): boolean {
  return !force && !demo && allowLiveSnapshot;
}

function displayName(driver: LiveTimingDriver | undefined, rank: number): string {
  return String(driver?.name || '').trim().toUpperCase() || `AGUARDANDO ${rank}`;
}

function displayTime(driver: LiveTimingDriver | undefined): string {
  return String(driver?.time || '') || '--:--.---';
}

function firstDisplayName(name: string): string {
  const words = name
    .trim()
    .toUpperCase()
    .split(/\s+/)
    .filter(Boolean);

  return words[0] || name.toUpperCase();
}

function shortDriverName(name: string, duplicateFirstNames: Set<string>): string {
  const words = name
    .trim()
    .toUpperCase()
    .split(/\s+/)
    .filter(Boolean);
  const first = words[0] || name.toUpperCase();
  const surname = words.find((word, index) => index > 0 && !NAME_PARTICLES.test(word));

  if (!duplicateFirstNames.has(first) || !surname) return first;
  if (/^\d{1,3}$/.test(surname)) return `${first} ${surname}`;

  return `${first} ${surname[0]}.`;
}

function leaderboardDriverName(name: string): string {
  const words = name
    .trim()
    .toUpperCase()
    .split(/\s+/)
    .filter(Boolean);
  const normalized = words.length > 2 && words[words.length - 1].length <= 3 ? words.slice(0, -1) : words;
  const first = normalized[0] || name.toUpperCase();
  const surname = [...normalized].reverse().find((word, index) => index < normalized.length - 1 && !NAME_PARTICLES.test(word));

  return surname && surname !== first ? `${first} ${surname}` : first;
}

function kartAccentFromKart(kart: string): string {
  const value = Number.parseInt(kart.replace(/\D/g, ''), 10);
  const normalized = Number.isFinite(value) ? value : kart.length * 17;
  const hue = (normalized * 47 + 18) % 360;

  return `hsl(${hue} 92% 58%)`;
}

function podiumOrderFor(count: number): number[] {
  return PODIUM_ORDER_BY_COUNT[Math.min(Math.max(count, 1), 5)] || PODIUM_ORDER_BY_COUNT[5];
}

function podiumSlotFor(rank: number, count: number): number {
  const slots = PODIUM_SLOT_X_BY_COUNT[Math.min(Math.max(count, 1), 5)] || PODIUM_SLOT_X_BY_COUNT[5];
  return slots[rank] || 50;
}

function formatOrdinal(rank: number): string {
  return `${rank}\u00ba`;
}

function cleanTrackName(trackName: string | undefined): string {
  const cleaned = (trackName || 'Corrida final')
    .replace(/\b(TRAÇADO)\s+\1\b/gi, '$1')
    .replace(/\b(TRACADO)\s+\1\b/gi, '$1')
    .replace(/\b(TRA\u00c7ADO)\s+\1\b/gi, '$1')
    .replace(/\s+/g, ' ')
    .trim();

  return cleaned || 'Corrida final';
}

function cleanEventName(eventName: string | undefined, topLabel: string): string {
  const cleaned = (eventName || `${topLabel} da corrida`)
    .replace(/\b(CORRIDA|TREINO|TOMADA|FINAL)\s+\(\1\)/gi, '$1')
    .replace(/\s+/g, ' ')
    .trim();

  return cleaned || `${topLabel} da corrida`;
}

function normalizeFinalists(snapshot: LiveTimingSnapshot | null): PodiumDriver[] {
  const ranked = (snapshot?.drivers || [])
    .filter((driver) => driver.position >= 1 && driver.position <= 5)
    .sort((left, right) => left.position - right.position);

  const firstNameCounts = ranked.reduce((counts, driver) => {
    const first = firstDisplayName(displayName(driver, driver.position));
    counts.set(first, (counts.get(first) || 0) + 1);
    return counts;
  }, new Map<string, number>());

  const duplicateFirstNames = new Set(
    Array.from(firstNameCounts.entries())
      .filter(([, count]) => count > 1)
      .map(([first]) => first),
  );

  return ranked.map((driver, index) => {
    const name = displayName(driver, driver.position);
    const kart = String(driver.kart || '').trim();

    return {
      rank: driver.position,
      position: driver.position,
      kart,
      hasKart: Boolean(kart),
      name,
      shortName: shortDriverName(name, duplicateFirstNames),
      leaderboardName: leaderboardDriverName(name),
      time: displayTime(driver),
      suitColor: SUIT_COLORS[driver.position - 1] || SUIT_COLORS[index % SUIT_COLORS.length],
      kartAccent: kartAccentFromKart(kart || `${driver.position}`),
      slotX: 50,
      filled: true,
    };
  });
}

function useScale() {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const resize = () => {
      const fitWidthScale = window.innerWidth / 2048;
      const fitHeightScale = window.innerHeight / 512;
      const minimumPreviewScale = window.innerWidth < 720 ? 0.42 : 0;
      setScale(Math.min(Math.max(fitWidthScale, minimumPreviewScale), fitHeightScale, 1));
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  return scale;
}

function PodiumPilot({ driver, winner = false }: { driver: PodiumDriver; winner?: boolean }) {
  return (
      <div className={`final-pilot ${winner ? 'final-pilot-winner' : ''}`} aria-hidden="true">
        <div className="final-pilot-glow" style={{ backgroundColor: driver.suitColor }} />
      {driver.hasKart ? <span className="final-pilot-kart">{driver.kart}</span> : null}
      <img
        className="final-racer-image"
        src="/podio-final/helmet-premium.png"
        alt=""
        style={{ '--suit-color': driver.suitColor } as CSSProperties}
      />
    </div>
  );
}

function PodiumBlock({ driver }: { driver: PodiumDriver }) {
  const winner = driver.rank === 1;

  return (
    <article
      className={`final-podium-block final-rank-${driver.rank} ${driver.filled ? 'final-filled' : 'final-empty'}`}
      style={{ '--slot-x': `${driver.slotX}%`, '--kart-accent': driver.kartAccent } as CSSProperties}
    >
      <PodiumPilot driver={driver} winner={winner} />
      <div className="final-podium-column">
        <div className="final-driver-card">
          <span className="final-rank-number">{formatOrdinal(driver.rank)}</span>
          <strong title={driver.name}>{driver.shortName}</strong>
          {driver.hasKart ? <span>Kart {driver.kart}</span> : <span>Classificado</span>}
          <em>{driver.time}</em>
        </div>
      </div>
    </article>
  );
}

function Leaderboard({ drivers, topLabel }: { drivers: PodiumDriver[]; topLabel: string }) {
  return (
    <section className={`final-leaderboard final-leaderboard-count-${drivers.length}`} aria-label={`${topLabel} final`}>
      <div className="final-leaderboard-title">Resultado Final</div>
      <div className="final-leaderboard-grid">
        {drivers.length ? (
          drivers.map((driver) => (
            <div className="final-leaderboard-row final-filled" key={driver.rank}>
              <span>{driver.rank}</span>
              <strong title={driver.name}>{driver.leaderboardName}</strong>
              <em>{driver.hasKart ? `#${driver.kart}` : 'Final'}</em>
              <small>{driver.time}</small>
            </div>
          ))
        ) : (
          <div className="final-leaderboard-empty">Aguardando resultado oficial</div>
        )}
      </div>
    </section>
  );
}

export function FinalPodiumClient({ uid, demo, force, allowLiveSnapshot, initialSnapshot }: FinalPodiumClientProps) {
  const [snapshot, setSnapshot] = useState<LiveTimingSnapshot | null>(initialSnapshot);
  const [error, setError] = useState<string | null>(null);
  const hasFinalSnapshotRef = useRef(normalizeFinalists(initialSnapshot).length > 0 && (demo || isFinishedRaceSnapshot(initialSnapshot)));
  const scale = useScale();
  const finalists = useMemo(() => normalizeFinalists(snapshot), [snapshot]);
  const orderedPodium = useMemo(
    () => {
      const count = finalists.length;
      return podiumOrderFor(count)
        .map((rank) => finalists.find((driver) => driver.rank === rank))
        .filter((driver): driver is PodiumDriver => Boolean(driver))
        .map((driver) => ({ ...driver, slotX: podiumSlotFor(driver.rank, count) }));
    },
    [finalists],
  );
  const winner = finalists.find((driver) => driver.rank === 1) || finalists[0];
  const topLabel = finalists.length ? `Top ${finalists.length}` : 'Top 5';
  const stageBadgeLabel = 'Final';
  const classifiedLabel = finalists.length ? `${finalists.length} classificados` : 'Classificados';
  const trackLabel = cleanTrackName(snapshot?.trackName);
  const eventLabel = cleanEventName(snapshot?.eventName, topLabel);

  useEffect(() => {
    if (window.innerWidth >= 720) return undefined;

    const frame = window.requestAnimationFrame(() => {
      const viewport = document.querySelector<HTMLElement>('.final-screen-viewport');
      if (!viewport) return;
      viewport.scrollLeft = Math.max(0, (viewport.scrollWidth - viewport.clientWidth) / 2);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [scale]);

  useEffect(() => {
    let cancelled = false;

    async function loadSnapshot() {
      try {
        const params = new URLSearchParams({ uid });
        if (demo) params.set('demo', 'true');
        const response = await fetch(`/api/livetime-snapshot?${params.toString()}&_ts=${Date.now()}`, { cache: 'no-store' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = (await response.json()) as LiveTimingSnapshot;
        if (!cancelled) {
          const keepFinalOnTemporaryError = hasFinalSnapshotRef.current && data.status === 'error';
          if (!demo && !isFinishedRaceSnapshot(data) && !keepFinalOnTemporaryError) {
            window.location.replace('/placar-telao-tb50?layout=designer');
            return;
          }

          const hasFinalists = normalizeFinalists(data).length > 0;
          if (demo || hasFinalists || !hasFinalSnapshotRef.current) {
            setSnapshot(data);
            if (hasFinalists && (demo || isFinishedRaceSnapshot(data))) hasFinalSnapshotRef.current = true;
          }
          setError(null);
        }
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'Falha ao carregar resultado final');
      }
    }

    void loadSnapshot();
    const timer = window.setInterval(loadSnapshot, FINAL_PODIUM_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [uid, demo, force, allowLiveSnapshot]);

  useEffect(() => {
    if (!shouldPollManualDisplayMode(force, demo, allowLiveSnapshot)) return undefined;

    const timer = window.setInterval(async () => {
      try {
        const response = await fetch(`/api/tb50-display-mode?_ts=${Date.now()}`, { cache: 'no-store' });
        if (!response.ok) return;
        const data = (await response.json()) as { mode?: string };
        if (data.mode === 'live') window.location.replace('/placar-telao-tb50?layout=designer');
      } catch {
        // Keep the final page visible if the control endpoint is temporarily unavailable.
      }
    }, 2000);

    return () => window.clearInterval(timer);
  }, [allowLiveSnapshot, demo, force]);

  return (
    <main className="final-screen-viewport">
      <div className="final-screen-frame" style={{ '--final-scale': scale } as CSSProperties}>
        <section className="final-screen" style={{ transform: `scale(${scale})` }}>
        <div className="final-stage-photo" />
        <div className="final-stage-grade" />
        <div className="final-fireworks" aria-hidden="true">
          <span className="final-firework final-firework-1" />
          <span className="final-firework final-firework-2" />
          <span className="final-firework final-firework-3" />
          <span className="final-firework final-firework-4" />
          <span className="final-firework final-firework-5" />
          <span className="final-firework final-firework-6" />
          <span className="final-firework final-firework-7" />
        </div>
        <div className="final-stage-smoke" />

        <header className="final-header">
          <div className="final-brand">
            <img src="/brand/kartodromo-betim-logo.png" alt="Kartodromo Internacional de Betim" />
          </div>
          <div className="final-title">
            <h1>Resultado Final</h1>
            <span>{eventLabel}</span>
          </div>
          <div className="final-top-five">
            <strong>{stageBadgeLabel}</strong>
            <small>{classifiedLabel}</small>
          </div>
        </header>

        <div className="final-winner-splash">
          <span>{winner ? formatOrdinal(winner.rank) : topLabel}</span>
          <strong title={winner?.name}>{winner ? winner.leaderboardName : 'Carregando dados reais'}</strong>
          <em>{winner ? winner.time : 'LiveTime'}</em>
        </div>

        <section className={`final-podium final-podium-count-${orderedPodium.length}`} aria-label={`Pódio final ${topLabel}`}>
          {orderedPodium.map((driver) => (
            <PodiumBlock driver={driver} key={driver.rank} />
          ))}
        </section>

        <footer className="final-footer">
          <span>Final de corrida</span>
          <strong>{trackLabel}</strong>
        </footer>

        <Leaderboard drivers={finalists} topLabel={topLabel} />

        {error ? <div className="final-error">{error}</div> : null}
        </section>
      </div>
    </main>
  );
}

export const DEFAULT_PODIUM_UID = DEFAULT_UID;
