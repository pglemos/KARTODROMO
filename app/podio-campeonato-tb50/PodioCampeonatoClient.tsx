'use client';

import { type CSSProperties, useCallback, useEffect, useMemo, useState } from 'react';
import { Trophy } from 'lucide-react';

type CampeonatoDriver = {
  position: number | null;
  name: string;
  number: string;
  team: string;
  points: number;
  kart: string;
};

type CampeonatoData = {
  id: string;
  nome: string;
  slug: string | null;
  temporada: string | null;
  status: string;
};

type PodioCampeonatoClientProps = {
  campeonatoId: string;
  demo: boolean;
};

const POLL_MS = 10000;

function useScale() {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const resize = () => setScale(Math.min(window.innerWidth / 2048, window.innerHeight / 512));
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  return scale;
}

function formatDriverName(name: string): string {
  return name.trim().toUpperCase();
}

function shortDriverName(name: string): string {
  const words = name.trim().toUpperCase().split(/\s+/).filter(Boolean);
  const first = words[0] || name.toUpperCase();
  const surname = words.find((word, index) => index > 0 && !/^(DE|DA|DO|DOS|DAS|E)$/i.test(word));
  if (!surname) return first;
  if (/^\d{1,3}$/.test(surname)) return `${first} ${surname}`;
  return `${first} ${surname[0]}.`;
}

function kartAccentFromKart(kart: string): string {
  const value = Number.parseInt(kart.replace(/\D/g, ''), 10);
  const normalized = Number.isFinite(value) ? value : kart.length * 17;
  const hue = (normalized * 47 + 18) % 360;
  return `hsl(${hue} 92% 58%)`;
}

function podiumOrderFor(count: number): number[] {
  const orders: Record<number, number[]> = {
    1: [1],
    2: [2, 1],
    3: [2, 1, 3],
    4: [2, 1, 3, 4],
    5: [4, 2, 1, 3, 5],
  };
  return orders[Math.min(Math.max(count, 1), 5)] || orders[5];
}

function podiumSlotFor(rank: number, count: number): number {
  const slots: Record<number, Record<number, number>> = {
    1: { 1: 50 },
    2: { 1: 57, 2: 39 },
    3: { 1: 50, 2: 32, 3: 68 },
    4: { 1: 50, 2: 32, 3: 68, 4: 84 },
    5: { 1: 50, 2: 30, 3: 70, 4: 12, 5: 88 },
  };
  return slots[Math.min(Math.max(count, 1), 5)]?.[rank] || 50;
}

function formatOrdinal(rank: number): string {
  return `${rank}º`;
}

function PodiumPilot({ driver, winner = false }: { driver: CampeonatoDriver; winner?: boolean }) {
  const accent = kartAccentFromKart(driver.kart || String(driver.position || 1));

  return (
    <div className={`final-pilot ${winner ? 'final-pilot-winner' : ''}`} aria-hidden="true">
      <div className="final-pilot-glow" style={{ backgroundColor: accent }} />
      {driver.kart ? <span className="final-pilot-kart">KART {driver.kart}</span> : null}
      <img
        className="final-racer-image"
        src="/podio-final/helmet-premium.png"
        alt=""
        style={{ '--suit-color': accent } as CSSProperties}
      />
    </div>
  );
}

function PodiumBlock({ driver }: { driver: CampeonatoDriver }) {
  const winner = driver.position === 1;
  const accent = kartAccentFromKart(driver.kart || String(driver.position || 1));
  const count = 3;
  const slotX = podiumSlotFor(driver.position || 1, count);

  return (
    <article
      className={`final-podium-block final-rank-${driver.position} ${driver.position ? 'final-filled' : 'final-empty'}`}
      style={{ '--slot-x': `${slotX}%`, '--kart-accent': accent } as CSSProperties}
    >
      <PodiumPilot driver={driver} winner={winner} />
      <div className="final-podium-column">
        <div className="final-driver-card">
          <span className="final-rank-number">{formatOrdinal(driver.position || 0)}</span>
          <strong title={driver.name}>{shortDriverName(driver.name)}</strong>
          <span>{driver.team}</span>
          <em>{driver.points} pts</em>
        </div>
      </div>
    </article>
  );
}

function Leaderboard({ drivers, campeonatoNome }: { drivers: CampeonatoDriver[]; campeonatoNome: string }) {
  return (
    <section className={`final-leaderboard final-leaderboard-count-${drivers.length}`} aria-label={`Classificação final - ${campeonatoNome}`}>
      <div className="final-leaderboard-title">Classificação do Campeonato</div>
      <div className="final-leaderboard-grid">
        {drivers.length ? (
          drivers.map((driver) => (
            <div className="final-leaderboard-row final-filled" key={driver.position}>
              <span>{formatOrdinal(driver.position || 0)}</span>
              <strong title={driver.name}>{formatDriverName(driver.name)}</strong>
              <em>{driver.team}</em>
              <small>{driver.points} pts</small>
            </div>
          ))
        ) : (
          <div className="final-leaderboard-empty">Aguardando classificação</div>
        )}
      </div>
    </section>
  );
}

export function PodioCampeonatoClient({ campeonatoId, demo }: PodioCampeonatoClientProps) {
  const [data, setData] = useState<{ campeonato: CampeonatoData; drivers: CampeonatoDriver[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const scale = useScale();

  const loadData = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (campeonatoId) params.set('campeonato_id', campeonatoId);
      if (demo) params.set('demo', 'true');
      const response = await fetch(`/api/campeonato-podium?${params.toString()}&_ts=${Date.now()}`, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const json = await response.json();
      if (json.error) throw new Error(json.error);
      setData(json);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar pódio do campeonato');
    }
  }, [campeonatoId, demo]);

  useEffect(() => {
    void loadData();
    const timer = window.setInterval(loadData, POLL_MS);
    return () => window.clearInterval(timer);
  }, [loadData]);

  const top3 = useMemo(() => {
    if (!data) return [] as CampeonatoDriver[];
    return data.drivers.filter((d) => d.position !== null && d.position >= 1 && d.position <= 3);
  }, [data]);

  const orderedPodium = useMemo(() => {
    const count = top3.length;
    return podiumOrderFor(count)
      .map((rank) => top3.find((driver) => driver.position === rank))
      .filter((driver): driver is CampeonatoDriver => Boolean(driver));
  }, [top3]);

  const winner = top3.find((driver) => driver.position === 1) || top3[0];
  const campeonatoNome = data?.campeonato.nome || 'Campeonato';

  if (!data && !error) {
    return (
      <main className="final-screen-viewport">
        <div className="final-screen-frame" style={{ '--final-scale': scale } as CSSProperties}>
          <section className="final-screen" style={{ transform: `scale(${scale})` }}>
            <div className="final-stage-photo" />
            <div className="final-stage-grade" />
            <header className="final-header">
              <div className="final-brand">
                <img src="/brand/kartodromo-betim-logo.png" alt="Kartodromo Internacional de Betim" />
              </div>
              <div className="final-title">
                <h1>Carregando pódio...</h1>
              </div>
            </header>
          </section>
        </div>
      </main>
    );
  }

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
              <h1>Classificação Final</h1>
              <span>{campeonatoNome} {data?.campeonato.temporada ? `- ${data.campeonato.temporada}` : ''}</span>
            </div>
            <div className="final-top-five">
              <strong>
                <Trophy className="inline-block mr-1" size={16} /> Campeão
              </strong>
              <small>{data?.drivers.length || 0} pilotos classificados</small>
            </div>
          </header>

          <div className="final-winner-splash">
            <span>{winner ? formatOrdinal(winner.position || 1) : 'Top 3'}</span>
            <strong title={winner?.name}>{winner ? shortDriverName(winner.name) : 'Carregando...'}</strong>
            <em>{winner ? `${winner.points} pts` : 'Campeonato'}</em>
          </div>

          <section className={`final-podium final-podium-count-${orderedPodium.length}`} aria-label={`Pódio do ${campeonatoNome}`}>
            {orderedPodium.map((driver) => (
              <PodiumBlock key={driver.position} driver={driver} />
            ))}
          </section>

          <footer className="final-footer">
            <span>Campeonato finalizado</span>
            <strong>{campeonatoNome}</strong>
          </footer>

          <Leaderboard drivers={data?.drivers ?? []} campeonatoNome={campeonatoNome} />

          {error && <div className="final-error">{error}</div>}
        </section>
      </div>
    </main>
  );
}
