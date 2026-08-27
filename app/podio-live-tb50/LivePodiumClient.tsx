'use client';

import { type CSSProperties, useEffect, useMemo, useRef, useState } from 'react';
import type { LiveTimingDriver, LiveTimingSnapshot } from '@/lib/livetime/types';
import { resolveTeamAsset, teamAssetSrc, teamCodeForDriver } from '@/lib/livetime/team-assets';
import './live-podium.css';

type LivePodiumClientProps = {
  uid: string;
  demo: boolean;
  initialSnapshot: LiveTimingSnapshot | null;
};

const PODIUM_RANKS = [1, 2, 3] as const;
export const LIVE_PODIUM_VIDEO_SRC = '/videos/k-base-led-2048x512.mp4';
export const LIVE_PODIUM_VIDEO_POSTER = '/videos/k-base-led-poster.jpg';
export const LIVE_PODIUM_MOTION_SRC = '/videos/k-base-led-motion.gif';
export const LIVE_PODIUM_POLL_MS = 2000;
export const LIVE_PODIUM_STALE_AFTER_MS = LIVE_PODIUM_POLL_MS * 4;

type LivePodiumDisplayStatus = LiveTimingSnapshot['status'] | 'stale';

const STATUS_LABELS: Record<LivePodiumDisplayStatus, string> = {
  live: 'AO VIVO',
  waiting: 'AGUARDANDO',
  empty: 'SEM GRID',
  error: 'SINAL INSTÁVEL',
  stale: 'SINAL INSTÁVEL',
  demo: 'DEMONSTRAÇÃO',
  finished: 'FINALIZADA',
};

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

export function selectLivePodiumDrivers(snapshot: LiveTimingSnapshot | null): Array<LiveTimingDriver | undefined> {
  const byPosition = new Map((snapshot?.drivers || []).map((driver) => [driver.position, driver]));
  return PODIUM_RANKS.map((rank) => byPosition.get(rank));
}

function eventParts(snapshot: LiveTimingSnapshot | null): string[] {
  return (snapshot?.eventName || '')
    .split(/\s+-\s+/)
    .map((part) => part.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

export function formatLivePodiumEventLabel(snapshot: LiveTimingSnapshot | null): string {
  return eventParts(snapshot)[0] || 'CRONOMETRAGEM AO VIVO';
}

export function formatLivePodiumSessionLabel(snapshot: LiveTimingSnapshot | null): string {
  const sessionPart = eventParts(snapshot).find((part) => /tomada|qualif|classif|treino|corrida|prova/i.test(part));
  if (sessionPart) return sessionPart;
  if (snapshot?.sessionType === 'qualifying') return 'CLASSIFICAÇÃO';
  if (snapshot?.sessionType === 'race') return 'CORRIDA';
  return 'CRONOMETRAGEM AO VIVO';
}

function snapshotTimestamp(snapshot: LiveTimingSnapshot | null): number | null {
  if (!snapshot?.updatedAt) return null;
  const timestamp = Date.parse(snapshot.updatedAt);
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function isLivePodiumSnapshotStale(snapshot: LiveTimingSnapshot | null, now = Date.now()): boolean {
  if (!snapshot || snapshot.status !== 'live') return false;
  const timestamp = snapshotTimestamp(snapshot);
  return timestamp === null || now - timestamp > LIVE_PODIUM_STALE_AFTER_MS;
}

export function getLivePodiumDisplayStatus(
  snapshot: LiveTimingSnapshot | null,
  pollError: boolean,
  now = Date.now(),
): LivePodiumDisplayStatus {
  if (!snapshot) return pollError ? 'stale' : 'waiting';
  if (snapshot.status === 'finished') return 'finished';
  if (snapshot.status === 'error' || snapshot.source === 'cache' || pollError || isLivePodiumSnapshotStale(snapshot, now)) {
    return 'stale';
  }
  return snapshot.status;
}

export function formatLivePodiumFreshness(snapshot: LiveTimingSnapshot | null, now = Date.now()): string {
  if (snapshot && (snapshot.status === 'error' || snapshot.source === 'cache') && snapshot.drivers.length === 0) {
    return 'AGUARDANDO SINAL';
  }

  const timestamp = snapshotTimestamp(snapshot);
  if (timestamp === null) return snapshot ? 'DATA SEM HORÁRIO' : 'AGUARDANDO DADOS';

  const ageSeconds = Math.max(0, Math.floor((now - timestamp) / 1000));
  if (ageSeconds <= 1) return 'ATUALIZADO AGORA';
  return `ATUALIZADO HÁ ${ageSeconds}S`;
}

function timeLabel(driver: LiveTimingDriver | undefined): string {
  return driver?.time?.trim() || '--:--.---';
}

function displayKart(driver: LiveTimingDriver | undefined): string {
  return driver?.kart?.trim() ? `KART ${driver.kart.trim()}` : 'KART --';
}

function LivePodiumCard({ rank, driver }: { rank: number; driver: LiveTimingDriver | undefined }) {
  const asset = driver ? resolveTeamAsset(driver.team, driver.name) : null;
  // The API's short name is the actual entry identifier (FA1, FA2, ZE2).
  // The full team name is only used to resolve the supplied artwork.
  const label = driver ? teamCodeForDriver(driver) : 'AGUARDANDO EQUIPE';
  const image = asset ? teamAssetSrc(asset, rank) : null;
  const normalizedLabelLength = Array.from(label).length;
  const teamClassName = normalizedLabelLength >= 18 ? 'is-long' : normalizedLabelLength >= 12 ? 'is-medium' : '';

  return (
    <article
      className={`live-podium-card live-podium-card-rank-${rank} ${driver ? 'is-filled' : 'is-empty'}`}
      data-rank={rank}
      data-kart={driver?.kart || ''}
      data-team={driver?.team || ''}
      aria-label={`${rank}º lugar: ${label}${driver?.team ? ` — ${driver.team}` : ''}`}
    >
      {image ? (
        <img className="live-podium-art" src={image} alt={`${label}, ${rank}º lugar`} />
      ) : (
        <div className="live-podium-placeholder" aria-hidden="true">
          <strong>AGUARDANDO</strong>
          <span>Equipe aguardando</span>
        </div>
      )}
      <div className="live-podium-meta">
        <div className="live-podium-team-line">
          <strong className={teamClassName} title={label}>{label}</strong>
        </div>
        <span className="live-podium-kart">{displayKart(driver)}</span>
        <em className="live-podium-time">{timeLabel(driver)}</em>
      </div>
    </article>
  );
}

export function LivePodiumClient({ uid, demo, initialSnapshot }: LivePodiumClientProps) {
  const [snapshot, setSnapshot] = useState<LiveTimingSnapshot | null>(initialSnapshot);
  const [pollError, setPollError] = useState(false);
  // Keep the first render deterministic. The server can send a live snapshot,
  // so using Date.now() here would make the freshness label differ during
  // hydration by one or more seconds. The clock starts after hydration.
  const [now, setNow] = useState(0);
  const scale = useScale();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const motionRef = useRef<HTMLImageElement | null>(null);
  const drivers = useMemo(() => selectLivePodiumDrivers(snapshot), [snapshot]);
  const displayStatus = getLivePodiumDisplayStatus(snapshot, pollError, now);
  const freshness = formatLivePodiumFreshness(snapshot, now);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let disposed = false;
    let retryTimer: number | undefined;
    let playInFlight = false;
    let videoFrameRequestId: number | undefined;
    let lastRenderedFrameAt = 0;
    let lastVideoTime = 0;
    let lastVideoProgressAt = 0;
    const hasPresentedFrameCallback = typeof video.requestVideoFrameCallback === 'function';

    const clearRetry = () => {
      if (retryTimer !== undefined) window.clearTimeout(retryTimer);
      retryTimer = undefined;
    };

    const setVideoRenderState = (active: boolean) => {
      if (active) {
        video.setAttribute('data-render', 'active');
        motionRef.current?.setAttribute('data-motion', 'hidden');
      } else {
        video.removeAttribute('data-render');
        motionRef.current?.removeAttribute('data-motion');
      }
    };

    const watchPresentedVideoFrame = () => {
      if (disposed || !hasPresentedFrameCallback || videoFrameRequestId !== undefined) return;

      videoFrameRequestId = video.requestVideoFrameCallback(() => {
        videoFrameRequestId = undefined;
        if (disposed) return;

        lastRenderedFrameAt = Date.now();
        setVideoRenderState(true);
        watchPresentedVideoFrame();
      });
    };

    const scheduleRetry = (delayMs = 1200) => {
      clearRetry();
      if (disposed) return;
      retryTimer = window.setTimeout(playVideo, delayMs);
    };

    const playVideo = () => {
      if (disposed || playInFlight) return;

      video.muted = true;
      video.defaultMuted = true;
      video.setAttribute('muted', '');
      playInFlight = true;
      const result = video.play();
      Promise.resolve(result)
        .then(() => {
          playInFlight = false;
          clearRetry();
          if (disposed || video.paused || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
          setVideoRenderState(true);
          lastVideoTime = video.currentTime;
          lastVideoProgressAt = Date.now();
          window.requestAnimationFrame(() => {
            if (!disposed && !video.paused && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
              video.setAttribute('data-playback', 'playing');
            }
          });
        })
        .catch(() => {
          playInFlight = false;
          setVideoRenderState(false);
          video.setAttribute('data-playback', 'error');
          scheduleRetry();
        });
    };

    const markPlaying = () => {
      video.setAttribute('data-playback', 'playing');
      // Make the decoded MP4 visible before requesting a presented-frame callback.
      // Some WebViews do not present callbacks while the video is transparent,
      // which otherwise leaves the animated fallback visible forever.
      setVideoRenderState(true);
      lastVideoTime = video.currentTime;
      lastVideoProgressAt = Date.now();
      lastRenderedFrameAt = 0;
      watchPresentedVideoFrame();
      clearRetry();
    };

    const markReadyAndPlay = () => playVideo();
    const markErrorAndRetry = () => {
      setVideoRenderState(false);
      video.setAttribute('data-playback', 'error');
      scheduleRetry();
    };
    const handlePause = () => {
      setVideoRenderState(false);
      scheduleRetry(350);
    };
    const monitorVideoFrames = () => {
      if (disposed || !hasPresentedFrameCallback || video.paused) return;

      if (Math.abs(video.currentTime - lastVideoTime) > 0.01) {
        lastVideoTime = video.currentTime;
        lastVideoProgressAt = Date.now();
      }

      if (lastVideoProgressAt > 0 && Date.now() - lastVideoProgressAt > 1800) {
        setVideoRenderState(false);
        scheduleRetry(350);
        return;
      }

      if (lastRenderedFrameAt > 0 && Date.now() - lastRenderedFrameAt > 1800) {
        setVideoRenderState(false);
        scheduleRetry(350);
      }
    };

    video.addEventListener('loadeddata', markReadyAndPlay);
    video.addEventListener('canplay', markReadyAndPlay);
    video.addEventListener('playing', markPlaying);
    video.addEventListener('pause', handlePause);
    video.addEventListener('error', markErrorAndRetry);
    document.addEventListener('visibilitychange', playVideo);
    const playbackMonitor = window.setInterval(monitorVideoFrames, 350);
    playVideo();

    return () => {
      disposed = true;
      clearRetry();
      window.clearInterval(playbackMonitor);
      if (videoFrameRequestId !== undefined && typeof video.cancelVideoFrameCallback === 'function') {
        video.cancelVideoFrameCallback(videoFrameRequestId);
      }
      video.removeEventListener('loadeddata', markReadyAndPlay);
      video.removeEventListener('canplay', markReadyAndPlay);
      video.removeEventListener('playing', markPlaying);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('error', markErrorAndRetry);
      document.removeEventListener('visibilitychange', playVideo);
    };
  }, []);

  useEffect(() => {
    const clock = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(clock);
  }, []);

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
          setSnapshot(data);
          setPollError(data.status === 'error' || data.source === 'cache');
        }
      } catch {
        if (!cancelled) setPollError(true);
      }
    }

    void loadSnapshot();
    const timer = window.setInterval(loadSnapshot, LIVE_PODIUM_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [demo, uid]);

  return (
    <main className="live-podium-viewport">
      <div className="live-podium-frame" style={{ '--live-scale': scale } as CSSProperties}>
        <section
          className="live-podium-screen"
          data-state={displayStatus}
          style={{ transform: `scale(${scale})` }}
          aria-label={`Placar ao vivo, status ${STATUS_LABELS[displayStatus]}`}
        >
          <div className="live-podium-video-fallback" aria-hidden="true" />
          <img
            ref={motionRef}
            className="live-podium-motion"
            src={LIVE_PODIUM_MOTION_SRC}
            alt=""
            aria-hidden="true"
            decoding="async"
          />
          <video
            ref={videoRef}
            className="live-podium-video"
            src={LIVE_PODIUM_VIDEO_SRC}
            poster={LIVE_PODIUM_VIDEO_POSTER}
            data-playback="loading"
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            disablePictureInPicture
            aria-hidden="true"
          />
          <div className="live-podium-overlay" aria-hidden="true" />

          <section className="live-podium-grid" aria-label="Primeiro, segundo e terceiro lugares">
            {PODIUM_RANKS.map((rank, index) => <LivePodiumCard driver={drivers[index]} key={rank} rank={rank} />)}
          </section>

          <div className="live-podium-sr-status" aria-live="polite" aria-atomic="true">
            {STATUS_LABELS[displayStatus]}. {freshness}.
          </div>
        </section>
      </div>
    </main>
  );
}
