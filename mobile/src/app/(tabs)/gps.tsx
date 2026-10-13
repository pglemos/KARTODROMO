import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { LocationObject } from 'expo-location';

import { findLineCrossingAt, type GpsPoint } from '../../features/gps/lap-detector';
import { requestForegroundLocationPermission, watchForegroundLocation } from '../../features/gps/location';
import { trackConfig } from '../../features/gps/track-config';
import {
  createGpsSession,
  deleteGpsSession,
  listGpsSessions,
  pauseGpsSession,
  resumeGpsSession,
  saveGpsLap,
  saveGpsPoint,
  type GpsLap,
  type GpsSessionSummary,
} from '../../features/gps/repository';
import { ActionButton, InlineError, Page, PageHeader, Panel, palette, styles } from '../../features/reservations/components';

function messageOf(error: unknown) {
  return error instanceof Error ? error.message : 'Não foi possível salvar este treino GPS.';
}

function formatLap(milliseconds: number | null) {
  if (milliseconds === null) return '—';
  const minutes = Math.floor(milliseconds / 60_000);
  const seconds = ((milliseconds % 60_000) / 1_000).toFixed(3).padStart(6, '0');
  return `${minutes}:${seconds}`;
}

export default function GpsScreen() {
  const [sessions, setSessions] = useState<GpsSessionSummary[]>([]);
  const [consented, setConsented] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [tracking, setTracking] = useState(false);
  const [paused, setPaused] = useState(false);
  const [error, setError] = useState('');
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [lapCount, setLapCount] = useState(0);
  const [bestLapMs, setBestLapMs] = useState<number | null>(null);
  const sessionId = useRef<string | null>(null);
  const watcher = useRef<(() => void) | null>(null);
  const lastPoint = useRef<GpsPoint | null>(null);
  const lastCrossingAt = useRef<number | null>(null);
  const pausedDuringStart = useRef(false);

  const refreshSessions = useCallback(async () => {
    try { setSessions(await listGpsSessions()); }
    catch (reason) { setError(messageOf(reason)); }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(refreshSessions);
  }, [refreshSessions]);

  useEffect(() => () => {
    watcher.current?.();
    if (sessionId.current) void pauseGpsSession(sessionId.current, Date.now()).catch(() => undefined);
  }, []);

  async function authorizeLocation() {
    if (!trackConfig || !consented) return;
    setError('');
    try {
      await requestForegroundLocationPermission(consented);
      setPermissionGranted(true);
    } catch (reason) {
      setError(messageOf(reason));
    }
  }

  function receivePoint(location: LocationObject) {
    const id = sessionId.current;
    if (!id || !trackConfig) return;
    const horizontalAccuracy = location.coords.accuracy;
    if (horizontalAccuracy === null || !Number.isFinite(horizontalAccuracy)) {
      setAccuracy(null);
      setError('A precisão do GPS não está disponível; este ponto foi ignorado.');
      lastPoint.current = null;
      return;
    }
    const point: GpsPoint = {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      timestamp: location.timestamp,
      accuracy: horizontalAccuracy,
    };
    void saveGpsPoint(id, point).catch((reason) => setError(messageOf(reason)));
    setAccuracy(point.accuracy);

    if (point.accuracy > trackConfig.maxAccuracyMeters) {
      lastPoint.current = point;
      return;
    }

    const previous = lastPoint.current;
    if (previous) {
      const crossedAt = findLineCrossingAt(previous, point, trackConfig.finishLine, trackConfig.maxAccuracyMeters);
      if (crossedAt !== null) {
        const previousCrossing = lastCrossingAt.current;
        lastCrossingAt.current = crossedAt;
        if (previousCrossing !== null) {
          const durationMs = crossedAt - previousCrossing;
          void saveGpsLap(id, durationMs, crossedAt).then((lap: GpsLap) => {
            setLapCount(lap.number);
            setBestLapMs((current) => current === null ? lap.durationMs : Math.min(current, lap.durationMs));
          }).catch((reason) => setError(messageOf(reason)));
        }
      }
    }
    lastPoint.current = point;
  }

  async function startTraining() {
    if (!trackConfig || !consented || !permissionGranted || tracking) return;
    setError('');
    const existingId = sessionId.current;
    let id = existingId;
    try {
      if (!id) {
        id = await createGpsSession(Date.now());
        sessionId.current = id;
        setLapCount(0);
        setBestLapMs(null);
      } else {
        await resumeGpsSession(id);
      }
      lastPoint.current = null;
      lastCrossingAt.current = null;
      pausedDuringStart.current = false;
      const stop = await watchForegroundLocation(consented, receivePoint, () => {
        pausedDuringStart.current = true;
        watcher.current = null;
        lastPoint.current = null;
        lastCrossingAt.current = null;
        setTracking(false);
        setPaused(true);
        if (sessionId.current) void pauseGpsSession(sessionId.current, Date.now()).then(refreshSessions).catch((reason) => setError(messageOf(reason)));
      }, (message) => setError(message));
      if (pausedDuringStart.current) {
        stop();
        return;
      }
      watcher.current = stop;
      setTracking(true);
      setPaused(false);
    } catch (reason) {
      if (!existingId && id) {
        await deleteGpsSession(id).catch(() => undefined);
        sessionId.current = null;
      } else if (id) {
        await pauseGpsSession(id, Date.now()).catch(() => undefined);
        setPaused(true);
      }
      setError(messageOf(reason));
    }
  }

  async function stopTraining() {
    watcher.current?.();
    watcher.current = null;
    setTracking(false);
    setPaused(false);
    const id = sessionId.current;
    sessionId.current = null;
    lastPoint.current = null;
    lastCrossingAt.current = null;
    if (id) {
      try {
        await pauseGpsSession(id, Date.now());
        await refreshSessions();
      } catch (reason) {
        setError(messageOf(reason));
      }
    }
  }

  async function removeSession(id: string) {
    try {
      await deleteGpsSession(id);
      if (sessionId.current === id) {
        sessionId.current = null;
        setPaused(false);
        setTracking(false);
        setLapCount(0);
        setBestLapMs(null);
        lastPoint.current = null;
        lastCrossingAt.current = null;
      }
      await refreshSessions();
    } catch (reason) {
      setError(messageOf(reason));
    }
  }

  return (
    <Page>
      <PageHeader eyebrow="Treino pessoal" title="Cronometragem GPS" description="Os pontos e voltas ficam somente neste aparelho. Não são resultados oficiais." />
      <Panel style={{ gap: 10 }}>
        <Text style={{ color: palette.accent, fontSize: 12, fontWeight: '800' }}>TREINO PESSOAL</Text>
        <Text style={styles.muted}>A localização só será coletada durante um treino iniciado por você, com o app aberto. Você pode apagar cada sessão quando quiser.</Text>
        {!trackConfig ? <InlineError message="Cronometragem desabilitada: falta a medição aprovada da linha de largada/chegada." /> : null}
        <Pressable
          accessibilityRole="checkbox"
          accessibilityLabel="Concordo com a coleta de localização durante este treino GPS pessoal"
          accessibilityState={{ checked: consented, disabled: !trackConfig }}
          disabled={!trackConfig}
          onPress={() => setConsented((value) => !value)}
          style={{ paddingVertical: 8 }}
        >
          <Text style={styles.muted}>{consented ? '✓ ' : '□ '}Concordo com a coleta de localização somente durante este treino.</Text>
        </Pressable>
        <ActionButton label={permissionGranted ? 'Localização autorizada' : 'Autorizar localização'} onPress={() => void authorizeLocation()} disabled={!trackConfig || !consented || permissionGranted} secondary />
        <ActionButton label={tracking ? 'Encerrar treino' : paused ? 'Retomar treino' : 'Iniciar treino'} onPress={() => void (tracking ? stopTraining() : startTraining())} disabled={!trackConfig || !permissionGranted || (!tracking && !paused)} />
        {trackConfig && accuracy !== null ? <Text style={styles.muted}>Precisão atual: ±{accuracy.toFixed(0)} m · {accuracy > trackConfig.maxAccuracyMeters ? 'insuficiente para registrar volta' : 'adequada'}</Text> : null}
        {trackConfig ? <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={styles.muted}>{tracking ? 'Treino em andamento' : paused ? 'Treino pausado' : 'Aguardando início'}</Text>
          <Text style={{ color: palette.text, fontWeight: '800' }}>{lapCount} voltas · melhor {formatLap(bestLapMs)}</Text>
        </View> : null}
      </Panel>
      {error ? <View style={{ marginTop: 14 }}><InlineError message={error} /></View> : null}

      <View style={{ marginTop: 24 }}>
        <PageHeader eyebrow="Neste aparelho" title="Treinos salvos" description="Nenhuma sessão é enviada para a nuvem ou para a cronometragem oficial." />
      </View>
      {!sessions.length ? <Panel><Text style={styles.muted}>Nenhum treino salvo neste aparelho.</Text></Panel> : sessions.map((session) => (
        <Panel key={session.id} style={{ marginBottom: 12, gap: 8 }}>
          <Text style={{ color: palette.accent, fontSize: 11, fontWeight: '800' }}>TREINO PESSOAL</Text>
          <Text style={{ color: palette.text, fontSize: 15, fontWeight: '800' }}>{new Date(session.startedAt).toLocaleString('pt-BR')}</Text>
          <Text style={styles.muted}>{session.lapCount} voltas · melhor {formatLap(session.bestLapMs)}</Text>
          {session.endedAt === null ? <Text style={styles.muted}>Sessão pausada</Text> : null}
          <ActionButton label="Excluir treino" onPress={() => void removeSession(session.id)} secondary />
        </Panel>
      ))}
    </Page>
  );
}
