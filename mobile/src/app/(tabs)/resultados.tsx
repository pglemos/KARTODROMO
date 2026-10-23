import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, LayoutAnimation, Pressable, Text, View } from 'react-native';
import { Icon } from '../../components/brand';
import { Entrada, tap } from '../../components/motion';
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
      <Text style={{ color: ({ 1: palette.gold, 2: '#C0C7D1', 3: '#CD7F32' } as Record<number, string>)[result.position] ?? palette.textMuted, fontSize: 22, fontWeight: '900', minWidth: 36, fontVariant: ['tabular-nums'] }}>{result.position}º</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{result.displayName}</Text>
        <Text style={styles.rowDetail}>Kart {result.kart} · {result.laps} voltas</Text>
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

const MEDALHA = ['#F59E0B', '#C0C7D1', '#CD7F32'];

/** Bateria fechada: cartão com o pódio em três colunas; tocar abre a classificação inteira (com animação). */
function EventCard({ event, open, onToggle, index }: { event: PublicSessionResults; open: boolean; onToggle: () => void; index: number }) {
  const { palette } = useUi();
  const podio = event.results.slice(0, 3);
  const corrida = /corrida/i.test(event.eventName);
  return <Entrada index={index} style={{ marginTop: 12 }}>
    <View style={{ backgroundColor: palette.surface, borderRadius: 20, borderWidth: 1, borderColor: palette.border, overflow: 'hidden' }}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} accessibilityLabel={`${event.eventName}, ${formatDate(event.eventDate)}`}
        onPress={() => { tap(); LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); onToggle(); }}
        style={({ pressed }) => ({ padding: 16, opacity: pressed ? 0.85 : 1 })}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: corrida ? 'rgba(245,158,11,0.15)' : 'rgba(139,92,246,0.15)', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={corrida ? 'flag' : 'timer'} color={corrida ? palette.accent : palette.purpleNeon} size={20} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: palette.text, fontSize: 16, fontWeight: '800' }} numberOfLines={1}>{event.eventName}</Text>
            <Text style={{ color: palette.textMuted, fontSize: 13, marginTop: 2 }}>{formatDate(event.eventDate)} · {event.results.length} {event.results.length === 1 ? 'piloto' : 'pilotos'}</Text>
          </View>
          <View style={{ transform: [{ rotate: open ? '90deg' : '0deg' }] }}><Icon name="chevron" color={palette.textMuted} size={18} /></View>
        </View>
        {!open && podio.length ? <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
          {podio.map((r) => (
            <View key={`${r.position}-${r.kart}`} style={{ flex: 1, backgroundColor: palette.surfaceElevated, borderRadius: 14, padding: 10, gap: 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: MEDALHA[r.position - 1] ?? palette.border, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: '#000000', fontWeight: '900', fontSize: 12 }}>{r.position}</Text>
                </View>
                <Text style={{ color: palette.textMuted, fontSize: 11 }}>Kart {r.kart}</Text>
              </View>
              <Text style={{ color: palette.text, fontWeight: '700', fontSize: 13 }} numberOfLines={1}>{r.displayName}</Text>
              <Text style={{ color: palette.textSecondary, fontSize: 12, fontVariant: ['tabular-nums'] }}>{formatLap(r.bestLapMs)}</Text>
            </View>
          ))}
        </View> : null}
      </Pressable>
      {open ? <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
        {event.results.map((result: ResultLine, i) => (
          <ResultRow key={`${event.sessionId}-${i}`} result={{ ...result, sessionId: event.sessionId, eventName: event.eventName, eventDate: event.eventDate }} />
        ))}
      </View> : null}
    </View>
  </Entrada>;
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
          <EventCard index={index} event={item.event} open={aberta === item.event.sessionId} onToggle={() => setAberta(aberta === item.event.sessionId ? null : item.event.sessionId)} />
        </>;
      }}
      ListFooterComponent={!items.some((i) => i.kind === 'event') ? publicoTopo() : null} />
  </SafeAreaView>;

  function publicoTopo() {
    return <View style={{ marginTop: 28 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginBottom: 4 }}>
        <Text style={[styles.sectionTitle, { flex: 1, minWidth: 170 }]}>Resultados publicados</Text>
        <Pressable accessibilityRole="button" onPress={() => { tap(); router.push('/ranking' as Href); }}
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, transform: [{ scale: pressed ? 0.95 : 1 }] })}>
          <Icon name="podium" color={palette.purpleNeon} size={16} />
          <Text style={{ color: palette.text, fontWeight: '700', fontSize: 14 }}>Ranking</Text>
        </Pressable>
      </View>
      {publicLoading && !publicResults.length ? <LoadingMessage label="Buscando resultados oficiais…" /> : null}
      {publicError ? <View style={{ gap: 12 }}><InlineError message={publicError} /><ActionButton label="Tentar novamente" onPress={() => void load()} secondary /></View> : null}
      {!publicLoading && !publicError && !publicResults.length ? <Panel><Text style={styles.muted}>Ainda não há resultados oficiais publicados.</Text></Panel> : null}
      {publicResults.length ? <Text style={[styles.muted, { color: palette.muted }]}>Toque numa bateria para ver a classificação inteira. Puxe para baixo para atualizar.</Text> : null}
    </View>;
  }
}

export default function ResultsScreen() {
  return <SessionBoundary><ResultsContent /></SessionBoundary>;
}
