import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { MobileApiError, mobileRequest } from '../../api/client';
import type { LiveCompetitor, LiveSession } from '../../types/racing';

/** O que /api/mobile/v1/live devolve: o retrato da cronometragem (o mesmo do placar e do telão). */
export interface LiveSnapshot {
  status: 'live' | 'finished' | 'empty';
  eventName: string;
  trackName: string;
  sessionType: 'race' | 'qualifying';
  startedAt: string | null;
  updatedAt: string;
  drivers: {
    position: number;
    kart: string;
    name: string;
    best: string;
    laps: number | null;
    last: string;
    bestLap: number | null;
    gap: string;
  }[];
}

export const liveApi = {
  snapshot() {
    return mobileRequest<LiveSnapshot>('/api/mobile/v1/live');
  },
};

/** "1:15.418" ou "58.120" → ms; vazio/inválido → null. */
export function lapMs(value: string): number | null {
  const m = /^(?:(\d+):)?(\d{1,2})\.(\d{1,3})$/.exec(value.trim());
  if (!m) return null;
  return (Number(m[1] ?? 0) * 60 + Number(m[2])) * 1000 + Number(m[3].padEnd(3, '0'));
}

/** "+2.350" → 2350 ms; "+1 volta" e vazio → null. */
function gapMs(value: string): number | null {
  const m = /^\+?(\d+)\.(\d{1,3})$/.exec(value.trim());
  const ms = m ? Number(m[1]) * 1000 + Number(m[2].padEnd(3, '0')) : null;
  // +0.000 fora do líder vem de passagem lançada à mão depois das outras: não há diferença confiável
  return ms ? ms : null;
}

/** diferença para exibir: tempo válido ou "+N voltas"; o resto vira travessão */
function gapLabel(value: string) {
  return gapMs(value) !== null || /volta/.test(value) ? value : '—';
}

export function formatElapsed(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}

/** Retrato da crono → formato da tela Ao vivo. null quando não há bateria para mostrar. */
export function snapshotToSession(snap: LiveSnapshot, now = Date.now()): LiveSession | null {
  if (snap.status === 'empty' || !snap.drivers.length) return null;
  const [titulo, prova] = snap.eventName.split(' · ');
  const tipo = snap.sessionType === 'race' ? 'CORRIDA' : 'TOMADA DE TEMPO';
  const aoVivo = snap.status === 'live';
  const iniciou = snap.startedAt ? Date.parse(snap.startedAt) : NaN;
  const elapsedMs = aoVivo && Number.isFinite(iniciou) ? now - iniciou : 0;
  const tempos = snap.drivers.map((d) => lapMs(d.best));
  const melhor = tempos.reduce<number | null>((min, t) => (t !== null && (min === null || t < min) ? t : min), null);
  const iMelhor = melhor === null ? -1 : tempos.indexOf(melhor);
  const competitors: LiveCompetitor[] = snap.drivers.map((d, i) => {
    const anterior = i > 0 ? gapMs(snap.drivers[i - 1].gap) ?? (i === 1 ? 0 : null) : null;
    const meu = gapMs(d.gap);
    const diffPrev = i === 0 ? '—' : meu !== null && anterior !== null ? `+${((meu - anterior) / 1000).toFixed(3)}` : gapLabel(d.gap);
    return {
      position: d.position,
      kartNumber: d.kart,
      name: d.name,
      category: tipo,
      flag: 'MG',
      currentLap: d.laps ?? 0,
      lastLapTime: d.last || '—',
      lastLapMs: lapMs(d.last) ?? 0,
      bestLapTime: d.best || '—',
      bestLapMs: tempos[i] ?? 0,
      bestLapNumber: d.bestLap ?? 0,
      diffLeader: i === 0 ? '—' : gapLabel(d.gap),
      diffPrev,
      isFastestLap: i === iMelhor,
      deltaRealtime: { value: '', trend: 'neutral' },
    };
  });
  return {
    id: snap.startedAt ?? snap.eventName,
    title: (titulo || snap.eventName || 'Bateria').toUpperCase(),
    subtitle: `${(prova || tipo).toUpperCase()} · ${aoVivo ? 'AO VIVO' : 'ENCERRADA'}`,
    trackName: (snap.trackName || 'Kartódromo Internacional de Betim').replace('Kartodromo', 'Kartódromo'),
    status: aoVivo ? 'GREEN' : 'CHECKERED',
    elapsedTime: aoVivo ? formatElapsed(elapsedMs) : 'Encerrada',
    elapsedMs,
    fastestLap: iMelhor >= 0 ? {
      competitorNumber: snap.drivers[iMelhor].kart,
      name: snap.drivers[iMelhor].name,
      time: snap.drivers[iMelhor].best,
      timeMs: melhor!,
      lapNumber: snap.drivers[iMelhor].bestLap ?? 0,
    } : null,
    competitors,
  };
}

/** Busca o retrato a cada `intervalMs` enquanto a tela está aberta e o app em primeiro plano. */
export function useLiveSession(intervalMs = 3000) {
  const [snapshot, setSnapshot] = useState<LiveSnapshot | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => Date.now());
  const active = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const next = await liveApi.snapshot();
      if (!active.current) return;
      setSnapshot(next);
      setError('');
    } catch (reason) {
      if (!active.current) return;
      setError(reason instanceof MobileApiError ? reason.message : 'Não foi possível carregar a cronometragem.');
    } finally {
      if (active.current) { setLoading(false); setNow(Date.now()); }
    }
  }, []);

  useEffect(() => {
    active.current = true;
    let timer: ReturnType<typeof setInterval> | null = null;
    const start = () => { if (!timer) { void refresh(); timer = setInterval(() => void refresh(), intervalMs); } };
    const stop = () => { if (timer) { clearInterval(timer); timer = null; } };
    start();
    const sub = AppState.addEventListener('change', (state) => (state === 'active' ? start() : stop()));
    return () => { active.current = false; stop(); sub.remove(); };
  }, [intervalMs, refresh]);

  return { snapshot, session: snapshot ? snapshotToSession(snapshot, now) : null, error, loading, refresh };
}
