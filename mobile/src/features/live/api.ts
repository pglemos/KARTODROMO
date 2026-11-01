import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { API_BASE_URL, MobileApiError, mobileRequest } from '../../api/client';
import type { LiveCompetitor, LiveSession } from '../../types/racing';

/** O que /api/mobile/v1/live devolve: o retrato da cronometragem (o mesmo do placar e do telão). */
export interface LiveSnapshot {
  status: 'live' | 'finished' | 'empty';
  eventName: string;
  trackName: string;
  sessionType: 'race' | 'qualifying';
  startedAt: string | null;
  updatedAt: string;
  /** hora da cronometragem no envio (ms); vem no tempo real e na busca simples */
  agora?: number;
  drivers: {
    position: number;
    kart: string;
    name: string;
    best: string;
    laps: number | null;
    last: string;
    bestLap: number | null;
    gap: string;
    /** quando o kart completou a última volta, no relógio da cronometragem (ms) */
    passouEm?: number | null;
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
    updatedAt: snap.updatedAt,
    status: aoVivo ? 'GREEN' : 'CHECKERED',
    elapsedTime: aoVivo ? (Number.isFinite(iniciou) ? formatElapsed(elapsedMs) : '—') : 'Encerrada',
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

// ---------------------------------------------------------------- relógio da cronometragem
// Largada e passagens são marcadas no relógio do PC da cronometragem; o celular pode estar adiantado ou atrasado.
// Cada mensagem traz `agora` (hora da crono no envio): a diferença para o relógio do celular fica na melhor amostra
// do último minuto (a de menor atraso de rede). `agoraCrono()` é a hora da crono vista do celular.
const amostras: { em: number; dif: number }[] = [];
let difCrono = 0;

function amostrar(agora: number, enviadoEm?: number) {
  const recebido = Date.now();
  // com ida e volta medida (ping), o meio do caminho é a melhor estimativa
  const dif = enviadoEm ? agora - (enviadoEm + recebido) / 2 : agora - recebido;
  amostras.push({ em: recebido, dif });
  while (amostras.length && recebido - amostras[0].em > 60_000) amostras.shift();
  difCrono = Math.max(...amostras.map((a) => a.dif));
}

export function agoraCrono() {
  return Date.now() + difCrono;
}

const WS_URL = `${API_BASE_URL.replace(/^http/, 'ws')}/api/mobile/v1/live/ws`;

/**
 * Bateria em tempo real: WebSocket com o servidor, que repassa cada passagem no instante em que a cronometragem
 * registra. Se a conexão cair, busca a cada 2 s enquanto tenta reabrir. Pausa com o app em segundo plano.
 */
export function useAoVivo() {
  const [snapshot, setSnapshot] = useState<LiveSnapshot | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const buscarRef = useRef<() => Promise<void>>(async () => undefined);

  useEffect(() => {
    let ligado = false;
    let ws: WebSocket | null = null;
    let tentativa = 0;
    let reabrir: ReturnType<typeof setTimeout> | null = null;
    let busca: ReturnType<typeof setInterval> | null = null;
    let ping: ReturnType<typeof setInterval> | null = null;
    let pingEm = 0;

    const aplicar = (s: LiveSnapshot) => { setSnapshot(s); setError(''); setLoading(false); };
    const buscar = async () => {
      try { const s = await liveApi.snapshot(); if (ligado) aplicar(s); }
      catch (reason) { if (ligado) { setError(reason instanceof MobileApiError ? reason.message : 'Não foi possível carregar a cronometragem.'); setLoading(false); } }
    };
    buscarRef.current = buscar;
    const pararBusca = () => { if (busca) { clearInterval(busca); busca = null; } };

    const abrir = () => {
      if (!ligado) return;
      const sock = new WebSocket(WS_URL);
      ws = sock;
      sock.onopen = () => {
        tentativa = 0;
        pararBusca();
        const pingar = () => { if (sock.readyState === WebSocket.OPEN) { pingEm = Date.now(); sock.send('ping'); } };
        pingar();
        ping = setInterval(pingar, 20_000);
      };
      sock.onmessage = (e) => {
        try {
          const m = JSON.parse(String(e.data)) as LiveSnapshot & { tipo?: string };
          if (typeof m.agora === 'number') amostrar(m.agora, m.tipo === 'pong' ? pingEm : undefined);
          if (m.tipo === 'retrato') aplicar(m);
        } catch { /* mensagem quebrada */ }
      };
      sock.onerror = () => sock.close();
      sock.onclose = () => {
        if (ping) { clearInterval(ping); ping = null; }
        if (ws === sock) ws = null;
        if (!ligado) return;
        if (!busca) { void buscar(); busca = setInterval(() => void buscar(), 2000); }
        reabrir = setTimeout(abrir, Math.min(10_000, 1000 * 2 ** tentativa++));
      };
    };
    const ligar = () => { if (ligado) return; ligado = true; abrir(); };
    const desligar = () => {
      ligado = false;
      if (reabrir) { clearTimeout(reabrir); reabrir = null; }
      pararBusca();
      if (ping) { clearInterval(ping); ping = null; }
      ws?.close();
      ws = null;
    };
    ligar();
    const sub = AppState.addEventListener('change', (estado) => (estado === 'active' ? ligar() : desligar()));
    return () => { desligar(); sub.remove(); };
  }, []);

  const refresh = useCallback(() => buscarRef.current(), []);
  return { snapshot, error, loading, refresh };
}

/** Relógio que anda sozinho no compasso da cronometragem (para tempo de prova e volta correndo). */
export function useAgoraCrono(passoMs = 1000) {
  const [agora, setAgora] = useState(agoraCrono);
  useEffect(() => { const t = setInterval(() => setAgora(agoraCrono()), passoMs); return () => clearInterval(t); }, [passoMs]);
  return agora;
}

/** Tela Ao vivo: bateria em tempo real com o relógio da prova andando de segundo em segundo, sem pular. */
export function useLiveSession() {
  const { snapshot, error, loading, refresh } = useAoVivo();
  const now = useAgoraCrono(1000);
  return { snapshot, session: snapshot ? snapshotToSession(snapshot, now) : null, error, loading, refresh };
}

/** Só para saber se há bateria na pista (tela inicial): busca simples de tempos em tempos, sem conexão aberta. */
export function useLiveStatus(intervalMs = 10_000) {
  const [snapshot, setSnapshot] = useState<LiveSnapshot | null>(null);
  useEffect(() => {
    let ativo = true;
    const buscar = () => liveApi.snapshot().then((s) => { if (ativo) setSnapshot(s); }).catch(() => undefined);
    void buscar();
    const t = setInterval(() => void buscar(), intervalMs);
    return () => { ativo = false; clearInterval(t); };
  }, [intervalMs]);
  return { snapshot };
}
