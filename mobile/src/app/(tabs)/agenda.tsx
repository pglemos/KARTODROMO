import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { reservationsApi } from '../../features/reservations/api';
import type { AgendaResponse } from '../../features/reservations/schemas';
import { ActionButton, formatBrl, formatDateTime, InlineError, LoadingMessage, Page, PageHeader, Panel, palette, styles } from '../../features/reservations/components';
import { useSession } from '../../session/provider';

function messageOf(error: unknown) {
  return error instanceof Error ? error.message : 'Não foi possível carregar a agenda. Tente novamente.';
}

export default function AgendaScreen() {
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
      : '/(auth)/login');
  }

  return (
    <Page>
      <PageHeader
        eyebrow="Kartódromo de Betim"
        title="Agenda da pista"
        description="Escolha o horário da sua próxima bateria. A disponibilidade e o preço vêm do servidor do kartódromo."
      />
      {loading && !agenda ? <LoadingMessage label="Buscando horários disponíveis…" /> : null}
      {error ? (
        <View style={{ gap: 12 }}>
          <InlineError message={error} />
          <ActionButton label="Tentar novamente" onPress={retry} secondary />
        </View>
      ) : null}
      {agenda && !agenda.horarios.length ? (
        <Panel><Text style={styles.muted}>Não há baterias abertas para reserva neste momento.</Text></Panel>
      ) : null}
      {agenda?.horarios.map((slot) => (
        <Panel key={slot.id} style={{ marginBottom: 12 }}>
          <Text style={{ color: palette.accent, fontSize: 11, fontWeight: '800', letterSpacing: 1.1 }}>
            {formatDateTime(slot.inicio)}
          </Text>
          <Text style={{ color: palette.text, fontSize: 19, fontWeight: '800', marginTop: 7 }}>{slot.nome}</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 13 }}>
            <Text style={styles.muted}>{slot.livres} {slot.livres === 1 ? 'vaga disponível' : 'vagas disponíveis'}</Text>
            <Text style={{ color: palette.text, fontSize: 13, fontWeight: '700' }}>{formatBrl(agenda.precoCentavos)} / piloto</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityHint="Entre na sua conta para informar os participantes e pagar a reserva."
            onPress={() => reserve(slot.id)}
            disabled={!agenda.pagamentoOnline || slot.livres < 1}
            style={({ pressed }) => [styles.action, { marginTop: 17 }, (!agenda.pagamentoOnline || slot.livres < 1) && styles.disabledAction, pressed && styles.pressedAction]}
          >
            <Text style={styles.actionText}>{agenda.pagamentoOnline ? 'Reservar bateria' : 'Reserva online indisponível'}</Text>
          </Pressable>
        </Panel>
      ))}
      <Text style={[styles.muted, { marginTop: 4 }]}>Os horários são exibidos no horário de Brasília.</Text>
    </Page>
  );
}
