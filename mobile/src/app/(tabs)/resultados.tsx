import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';

import { resultsApi } from '../../features/results/api';
import type { PersonalResultsResponse, PublicSessionResults } from '../../features/results/types';
import { ActionButton, InlineError, LoadingMessage, Page, PageHeader, Panel, palette, styles } from '../../features/reservations/components';
import { useSession } from '../../session/provider';
import { SessionBoundary } from '../../session/boundary';

function messageOf(error: unknown) {
  return error instanceof Error ? error.message : 'Não foi possível carregar os resultados. Tente novamente.';
}

function formatDate(value: string) {
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('pt-BR');
}

function formatLap(milliseconds: number | null) {
  if (milliseconds === null) return '—';
  const minutes = Math.floor(milliseconds / 60_000);
  const seconds = ((milliseconds % 60_000) / 1_000).toFixed(3).padStart(6, '0');
  return `${minutes}:${seconds}`;
}

function ResultCard({ eventName, eventDate, displayName, position, kart, laps, bestLapMs }: {
  eventName: string;
  eventDate: string;
  displayName: string;
  position: number;
  kart: string;
  laps: number;
  bestLapMs: number | null;
}) {
  return (
    <Panel style={{ marginBottom: 12, gap: 7 }}>
      <Text style={{ color: palette.accent, fontSize: 11, fontWeight: '800', letterSpacing: 1.1 }}>{formatDate(eventDate)}</Text>
      <Text style={{ color: palette.text, fontSize: 16, fontWeight: '800' }}>{eventName}</Text>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
        <Text style={{ color: palette.text, fontSize: 14, fontWeight: '700' }}>{position}º lugar · {displayName}</Text>
        <Text style={styles.muted}>Kart {kart}</Text>
      </View>
      <Text style={styles.muted}>{laps} voltas · melhor {formatLap(bestLapMs)}</Text>
    </Panel>
  );
}

function ResultsContent() {
  const { session } = useSession();
  const [publicResults, setPublicResults] = useState<PublicSessionResults[]>([]);
  const [personalResults, setPersonalResults] = useState<PersonalResultsResponse | null>(null);
  const [publicError, setPublicError] = useState('');
  const [personalError, setPersonalError] = useState('');
  const [publicLoading, setPublicLoading] = useState(true);
  const [personalLoading, setPersonalLoading] = useState(false);
  const [historyAccessToken, setHistoryAccessToken] = useState<string | null>(null);

  const load = useCallback(async () => {
    const accessToken = session?.accessToken ?? null;
    setPublicLoading(true);
    setPublicError('');
    setPublicResults([]);
    setPersonalResults(null);
    setHistoryAccessToken(accessToken);
    const publicLoad = resultsApi.public()
      .then(setPublicResults)
      .catch((error: unknown) => setPublicError(messageOf(error)))
      .finally(() => setPublicLoading(false));

    if (!accessToken) {
      setPersonalError('');
      setPersonalLoading(false);
      await publicLoad;
      return;
    }

    setPersonalLoading(true);
    setPersonalError('');
    const personalLoad = resultsApi.mine(accessToken)
      .then(setPersonalResults)
      .catch((error: unknown) => setPersonalError(messageOf(error)))
      .finally(() => setPersonalLoading(false));
    await Promise.all([publicLoad, personalLoad]);
  }, [session?.accessToken]);

  useFocusEffect(useCallback(() => {
    void load();
  }, [load]));

  return (
    <Page>
      <PageHeader eyebrow="Cronometragem oficial" title="Resultados" description="Classificações oficiais publicadas pela operação do kartódromo." />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Text style={{ color: palette.text, fontSize: 18, fontWeight: '800' }}>Resultados publicados</Text>
        <ActionButton label="Atualizar" onPress={() => void load()} secondary />
      </View>
      {publicLoading && !publicResults.length ? <LoadingMessage label="Buscando resultados oficiais…" /> : null}
      {publicError ? <View style={{ gap: 12, marginBottom: 14 }}>
        <InlineError message={publicError} />
        <ActionButton label="Tentar novamente" onPress={() => void load()} secondary />
      </View> : null}
      {!publicLoading && !publicError && !publicResults.length ? (
        <Panel><Text style={styles.muted}>Ainda não há resultados oficiais publicados.</Text></Panel>
      ) : null}
      {publicResults.map((event) => (
        <View key={event.sessionId}>
          {event.results.map((result, index) => (
            <ResultCard key={`${event.sessionId}-${result.position}-${index}`} eventName={event.eventName} eventDate={event.eventDate} {...result} />
          ))}
        </View>
      ))}

      <View style={{ marginTop: 20 }}>
        <PageHeader eyebrow="Sua conta" title="Meu histórico" description="Resultados oficiais associados à sua identidade validada." />
      </View>
      {!session ? (
        <Panel style={{ gap: 12 }}>
          <Text style={styles.muted}>Entre para consultar seu histórico de resultados.</Text>
          <ActionButton label="Entrar" onPress={() => router.push('/(auth)/login')} secondary />
        </Panel>
      ) : null}
      {session && personalLoading && !personalResults ? <LoadingMessage label="Buscando seu histórico…" /> : null}
      {session && personalError ? <View style={{ gap: 12, marginBottom: 14 }}>
        <InlineError message={personalError} />
        <ActionButton label="Tentar novamente" onPress={() => void load()} secondary />
      </View> : null}
      {session && historyAccessToken === session.accessToken && personalResults?.vinculo === 'pendente' ? (
        <Panel><Text style={styles.muted}>{personalResults.mensagem}</Text></Panel>
      ) : null}
      {session && historyAccessToken === session.accessToken && personalResults?.vinculo === 'validado' && !personalResults.results.length ? (
        <Panel><Text style={styles.muted}>Nenhum resultado oficial vinculado à sua conta ainda.</Text></Panel>
      ) : null}
      {session && historyAccessToken === session.accessToken && personalResults?.vinculo === 'validado' ? personalResults.results.map((result, index) => (
        <ResultCard key={`${result.sessionId}-${result.position}-${index}`} {...result} />
      )) : null}
    </Page>
  );
}

export default function ResultsScreen() {
  return <SessionBoundary><ResultsContent /></SessionBoundary>;
}
