import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { resultsApi } from '../../features/results/api';
import type { PersonalResult, PersonalResultsResponse, PublicSessionResults, ResultLine } from '../../features/results/types';
import { ordenarBaterias, resumoCarreira } from '../../features/results/resumo';
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

const PAGINA = 15;

function ResultRow({ result, showEvent = false }: { result: PersonalResult; showEvent?: boolean }) {
  const { palette, styles } = useUi();
  return <View style={{ paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: palette.border }}>
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

function Numero({ valor, rotulo }: { valor: string; rotulo: string }) {
  const { palette, styles } = useUi();
  return <View style={{ flexBasis: '45%', flexGrow: 1, paddingVertical: 10 }}>
    <Text style={{ color: palette.text, fontSize: 24, fontWeight: '800', fontVariant: ['tabular-nums'] }}>{valor}</Text>
    <Text style={styles.rowDetail}>{rotulo}</Text>
  </View>;
}

/** Bateria fechada: nome, data e pódio; tocar abre a classificação inteira. */
function EventCard({ event, open, onToggle }: { event: PublicSessionResults; open: boolean; onToggle: () => void }) {
  const { palette, styles } = useUi();
  const podio = event.results.slice(0, 3);
  return <View style={{ borderBottomWidth: 1, borderBottomColor: palette.border }}>
    <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} accessibilityLabel={`${event.eventName}, ${formatDate(event.eventDate)}`}
      onPress={onToggle} style={{ paddingVertical: 16, minHeight: 48 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Text style={styles.rowTitle}>{event.eventName}</Text>
          <Text style={styles.rowDetail}>{formatDate(event.eventDate)} · {event.results.length} {event.results.length === 1 ? 'piloto' : 'pilotos'}</Text>
        </View>
        <Text style={{ color: palette.accent, fontSize: 14, fontWeight: '700' }}>{open ? 'Fechar' : 'Ver tudo'}</Text>
      </View>
      {!open ? podio.map((r) => (
        <Text key={`${r.position}-${r.kart}`} style={[styles.rowDetail, { marginTop: 4 }]} numberOfLines={1}>
          {r.position}º {r.displayName} · Kart {r.kart} · {formatLap(r.bestLapMs)}
        </Text>
      )) : null}
    </Pressable>
    {open ? event.results.map((result: ResultLine, index) => (
      <ResultRow key={`${event.sessionId}-${index}`} result={{ ...result, sessionId: event.sessionId, eventName: event.eventName, eventDate: event.eventDate }} />
    )) : null}
  </View>;
}

type ResultItem =
  | { key: string; kind: 'event'; event: PublicSessionResults }
  | { key: string; kind: 'personal'; result: PersonalResult }
  | { key: string; kind: 'more' };

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
  const [aberta, setAberta] = useState<string | null>(null);
  const [mostrar, setMostrar] = useState(PAGINA);
  const [historicoTodo, setHistoricoTodo] = useState(false);

  const load = useCallback(async () => {
    const accessToken = session?.accessToken ?? null;
    setPublicLoading(true);
    setPublicError('');
    setPublicResults([]);
    setPersonalResults(null);
    setHistoryAccessToken(accessToken);
    const publicLoad = resultsApi.public()
      .then((list) => setPublicResults(ordenarBaterias(list)))
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

  const meus = useMemo(
    () => (session && historyAccessToken === session.accessToken && personalResults?.vinculo === 'validado' ? personalResults.results : []),
    [session, historyAccessToken, personalResults],
  );
  const resumo = useMemo(() => resumoCarreira(meus), [meus]);

  const items: ResultItem[] = [
    ...(historicoTodo ? meus : meus.slice(0, 5)).map((result, index) => ({ key: `mine-${result.sessionId}-${index}`, kind: 'personal' as const, result })),
    ...publicResults.slice(0, mostrar).map((event) => ({ key: `event-${event.sessionId}`, kind: 'event' as const, event })),
    ...(publicResults.length > mostrar ? [{ key: 'more', kind: 'more' as const }] : []),
  ];

  function history() {
    return <View style={{ marginBottom: 8 }}>
      <Text accessibilityRole="header" style={styles.sectionTitle}>Meu histórico</Text>
      <Text style={[styles.muted, { marginTop: 8, marginBottom: 12 }]}>Resultados oficiais associados à sua identidade validada.</Text>
      {!session ? <Panel style={{ gap: 12 }}>
        <Text style={styles.muted}>Entre para consultar seu histórico de resultados.</Text>
        <ActionButton label="Entrar" onPress={() => router.push('/(auth)/login')} secondary />
      </Panel> : null}
      {session && personalLoading && !personalResults ? <LoadingMessage label="Buscando seu histórico…" /> : null}
      {session && personalError ? <View style={{ gap: 12 }}><InlineError message={personalError} /><ActionButton label="Tentar novamente" onPress={() => void load()} secondary /></View> : null}
      {session && historyAccessToken === session.accessToken && personalResults?.vinculo === 'pendente' ? <Panel><Text style={styles.muted}>{personalResults.mensagem}</Text></Panel> : null}
      {session && historyAccessToken === session.accessToken && personalResults?.vinculo === 'validado' && !personalResults.results.length ? <Panel><Text style={styles.muted}>Nenhum resultado oficial vinculado à sua conta ainda.</Text></Panel> : null}
      {meus.length ? <Panel style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 4 }}>
        <Numero valor={String(resumo.baterias)} rotulo={resumo.baterias === 1 ? 'bateria' : 'baterias'} />
        <Numero valor={String(resumo.vitorias)} rotulo={resumo.vitorias === 1 ? 'vitória' : 'vitórias'} />
        <Numero valor={String(resumo.podios)} rotulo={resumo.podios === 1 ? 'pódio' : 'pódios'} />
        <Numero valor={formatLap(resumo.melhorVolta)} rotulo="melhor volta" />
      </Panel> : null}
    </View>;
  }

  return <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
    <FlatList data={items} keyExtractor={(item) => item.key} contentContainerStyle={styles.content} refreshing={publicLoading || personalLoading} onRefresh={() => void load()}
      ListHeaderComponent={<>
        <PageHeader title="Resultados" description="Classificações oficiais da pista de Betim." />
        {history()}
      </>}
      renderItem={({ item, index }) => {
        if (item.kind === 'personal') {
          const ultimoMeu = index === Math.min(meus.length, historicoTodo ? meus.length : 5) - 1;
          return <>
            <ResultRow result={item.result} showEvent />
            {ultimoMeu && meus.length > 5 ? <View style={{ marginTop: 12 }}>
              <ActionButton label={historicoTodo ? 'Mostrar só os últimos' : `Ver as ${meus.length} baterias`} onPress={() => setHistoricoTodo(!historicoTodo)} secondary />
            </View> : null}
            {ultimoMeu ? publicoTopo() : null}
          </>;
        }
        if (item.kind === 'more') return <View style={{ marginTop: 16 }}><ActionButton label="Ver mais baterias" onPress={() => setMostrar(mostrar + PAGINA)} secondary /></View>;
        return <>
          {index === 0 && !meus.length ? publicoTopo() : null}
          <EventCard event={item.event} open={aberta === item.event.sessionId} onToggle={() => setAberta(aberta === item.event.sessionId ? null : item.event.sessionId)} />
        </>;
      }}
      ListFooterComponent={!items.some((i) => i.kind === 'event') ? publicoTopo() : null} />
  </SafeAreaView>;

  function publicoTopo() {
    return <View style={{ marginTop: 28 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginBottom: 4 }}>
        <Text style={[styles.sectionTitle, { flex: 1, minWidth: 170 }]}>Resultados publicados</Text>
        <ActionButton label="Atualizar" onPress={() => void load()} disabled={publicLoading} secondary />
      </View>
      {publicLoading && !publicResults.length ? <LoadingMessage label="Buscando resultados oficiais…" /> : null}
      {publicError ? <View style={{ gap: 12 }}><InlineError message={publicError} /><ActionButton label="Tentar novamente" onPress={() => void load()} secondary /></View> : null}
      {!publicLoading && !publicError && !publicResults.length ? <Panel><Text style={styles.muted}>Ainda não há resultados oficiais publicados.</Text></Panel> : null}
      {publicResults.length ? <Text style={[styles.muted, { color: palette.muted }]}>Toque numa bateria para ver a classificação inteira.</Text> : null}
    </View>;
  }
}

export default function ResultsScreen() {
  return <SessionBoundary><ResultsContent /></SessionBoundary>;
}
