import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Text, View } from 'react-native';

import { resultsApi } from '../../features/results/api';
import type { PersonalResult, PersonalResultsResponse, PublicSessionResults, ResultLine } from '../../features/results/types';
import { ActionButton, InlineError, LoadingMessage, PageHeader, Panel, useUi } from '../../features/reservations/components';
import { useSession } from '../../session/provider';
import { SafeAreaView } from 'react-native-safe-area-context';
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

function ResultRow({ result, showEvent = false }: { result: PersonalResult; showEvent?: boolean }) {
  const { palette, styles } = useUi();
  return <View style={{ paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: palette.border }}>
    {showEvent ? <Text style={[styles.rowTitle, { marginBottom: 8 }]}>{result.eventName}</Text> : null}
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
      <Text style={{ color: palette.accent, fontSize: 20, fontWeight: '700', minWidth: 30 }}>{result.position}º</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{result.displayName}</Text>
        <Text style={styles.rowDetail}>{result.position}º lugar · Kart {result.kart} · {result.laps} voltas</Text>
        <Text style={[styles.rowDetail, { color: palette.text, fontVariant: ['tabular-nums'] }]}>Melhor volta {formatLap(result.bestLapMs)}</Text>
        {showEvent ? <Text style={styles.rowDetail}>{formatDate(result.eventDate)}</Text> : null}
      </View>
    </View>
  </View>;
}

type ResultItem =
  | { key: string; kind: 'event'; event: PublicSessionResults }
  | { key: string; kind: 'result' | 'personal'; result: PersonalResult }
  | { key: string; kind: 'history' };

function ResultsContent() {
  const { palette, styles } = useUi();
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

  const items: ResultItem[] = publicResults.flatMap((event) => [
    { key: `event-${event.sessionId}`, kind: 'event' as const, event },
    ...event.results.map((result: ResultLine, index) => ({ key: `${event.sessionId}-${index}`, kind: 'result' as const,
      result: { ...result, sessionId: event.sessionId, eventName: event.eventName, eventDate: event.eventDate } })),
  ]);
  items.push({ key: 'history', kind: 'history' });
  if (session && historyAccessToken === session.accessToken && personalResults?.vinculo === 'validado') {
    items.push(...personalResults.results.map((result, index) => ({ key: `mine-${result.sessionId}-${index}`, kind: 'personal' as const, result })));
  }

  function history() {
    return <View style={{ marginTop: 32, marginBottom: 16 }}>
      <Text accessibilityRole="header" style={styles.sectionTitle}>Meu histórico</Text>
      <Text style={[styles.muted, { marginTop: 8, marginBottom: 16 }]}>Resultados oficiais associados à sua identidade validada.</Text>
      {!session ? <Panel style={{ gap: 12 }}>
        <Text style={styles.muted}>Entre para consultar seu histórico de resultados.</Text>
        <ActionButton label="Entrar" onPress={() => router.push('/(auth)/login')} secondary />
      </Panel> : null}
      {session && personalLoading && !personalResults ? <LoadingMessage label="Buscando seu histórico…" /> : null}
      {session && personalError ? <View style={{ gap: 12 }}><InlineError message={personalError} /><ActionButton label="Tentar novamente" onPress={() => void load()} secondary /></View> : null}
      {session && historyAccessToken === session.accessToken && personalResults?.vinculo === 'pendente' ? <Panel><Text style={styles.muted}>{personalResults.mensagem}</Text></Panel> : null}
      {session && historyAccessToken === session.accessToken && personalResults?.vinculo === 'validado' && !personalResults.results.length ? <Panel><Text style={styles.muted}>Nenhum resultado oficial vinculado à sua conta ainda.</Text></Panel> : null}
    </View>;
  }

  return <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
    <FlatList data={items} keyExtractor={(item) => item.key} contentContainerStyle={styles.content} refreshing={publicLoading || personalLoading} onRefresh={() => void load()}
      ListHeaderComponent={<>
        <PageHeader title="Resultados" description="Classificações oficiais da pista de Betim." />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <Text style={[styles.sectionTitle, { flex: 1, minWidth: 170 }]}>Resultados publicados</Text>
          <ActionButton label="Atualizar" onPress={() => void load()} disabled={publicLoading} secondary />
        </View>
        {publicLoading && !publicResults.length ? <LoadingMessage label="Buscando resultados oficiais…" /> : null}
        {publicError ? <View style={{ gap: 12 }}><InlineError message={publicError} /><ActionButton label="Tentar novamente" onPress={() => void load()} secondary /></View> : null}
        {!publicLoading && !publicError && !publicResults.length ? <Panel><Text style={styles.muted}>Ainda não há resultados oficiais publicados.</Text></Panel> : null}
      </>}
      renderItem={({ item }) => {
        if (item.kind === 'history') return history();
        if (item.kind === 'event') return <View style={{ paddingTop: 24, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: palette.border }}>
          <Text style={styles.rowTitle}>{item.event.eventName}</Text><Text style={styles.rowDetail}>{formatDate(item.event.eventDate)}</Text>
        </View>;
        return <ResultRow result={item.result} showEvent={item.kind === 'personal'} />;
      }} />
  </SafeAreaView>;
}

export default function ResultsScreen() {
  return <SessionBoundary><ResultsContent /></SessionBoundary>;
}
