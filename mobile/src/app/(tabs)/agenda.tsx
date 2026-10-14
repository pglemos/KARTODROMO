import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Text, View } from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import { reservationsApi } from '../../features/reservations/api';
import type { AgendaResponse } from '../../features/reservations/schemas';
import { ActionButton, formatBrl, formatDateTime, InlineError, LoadingMessage, PageHeader, Panel, useUi } from '../../features/reservations/components';
import { useSession } from '../../session/provider';

function messageOf(error: unknown) {
  return error instanceof Error ? error.message : 'Não foi possível carregar a agenda. Tente novamente.';
}

export default function AgendaScreen() {
  const { palette, styles } = useUi();
  const { session } = useSession();
  const [agenda, setAgenda] = useState<AgendaResponse | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const next = await reservationsApi.agenda();
      setAgenda(next);
      setError('');
    } catch (reason) {
      setError(messageOf(reason));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  function retry() {
    setLoading(true);
    setError('');
    void load();
  }

  function reserve(bateriaId: number) {
    router.push(session
      ? { pathname: '/(tabs)/reservas', params: { bateriaId: String(bateriaId) } }
      : { pathname: '/(auth)/login', params: { bateriaId: String(bateriaId) } });
  }

  return <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
    <FlatList data={agenda?.horarios ?? []} keyExtractor={(slot) => String(slot.id)} contentContainerStyle={styles.content} refreshing={loading} onRefresh={retry}
      ListHeaderComponent={<>
        <PageHeader title="Agenda da pista" description="Escolha o horário da sua próxima bateria." />
        {loading && !agenda ? <LoadingMessage label="Buscando horários disponíveis…" /> : null}
        {error ? <View style={{ gap: 12, marginBottom: 16 }}><InlineError message={error} /><ActionButton label="Tentar novamente" onPress={retry} secondary /></View> : null}
        {agenda && !loading && !error && !agenda.horarios.length ? <Panel><Text style={styles.muted}>Não há baterias abertas para reserva neste momento.</Text></Panel> : null}
      </>}
      renderItem={({ item: slot }) => <View style={{ paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: palette.border }}>
        <Text style={[styles.rowTitle, { color: palette.accent, fontVariant: ['tabular-nums'] }]}>{formatDateTime(slot.inicio)}</Text>
        <Text style={[styles.rowTitle, { marginTop: 6 }]}>{slot.nome}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8, marginTop: 8, marginBottom: 16 }}>
          <Text style={styles.muted}>{slot.livres} {slot.livres === 1 ? 'vaga disponível' : 'vagas disponíveis'}</Text>
          <Text style={[styles.muted, { color: palette.text }]}>{formatBrl(agenda!.precoCentavos)} / piloto</Text>
        </View>
        <ActionButton label={!agenda!.pagamentoOnline ? 'Reserva online indisponível' : slot.livres < 1 ? 'Esgotado' : 'Reservar bateria'}
          onPress={() => reserve(slot.id)} disabled={!agenda!.pagamentoOnline || slot.livres < 1} />
      </View>}
      ListFooterComponent={<Text style={[styles.muted, { marginTop: 20 }]}>Horários de Brasília.</Text>} />
  </SafeAreaView>;
}
