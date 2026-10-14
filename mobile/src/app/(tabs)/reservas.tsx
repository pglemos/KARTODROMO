import { Link, router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, FlatList, Pressable, TouchableOpacity, Text, TextInput, View } from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon } from '../../components/brand';
import type { SessionTokens } from '../../api/contracts';

import { reservationsApi } from '../../features/reservations/api';
import type { AgendaResponse, CreateReservationInput, ReservationOrder } from '../../features/reservations/schemas';
import { ActionButton, Field, formatBrl, formatDateTime, InlineError, LoadingMessage, Page, PageHeader, Panel, Notice, useUi } from '../../features/reservations/components';
import { useSession } from '../../session/provider';
import { SessionBoundary } from '../../session/boundary';

function messageOf(error: unknown) {
  return error instanceof Error ? error.message : 'Não foi possível concluir. Tente novamente.';
}

function dateForServer(value: string) {
  const match = value.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const [, day, month, year] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (date.getUTCFullYear() !== Number(year) || date.getUTCMonth() !== Number(month) - 1 || date.getUTCDate() !== Number(day)) return null;
  return `${year}-${month}-${day}`;
}

function idempotencyKey() {
  return `mobile-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function LoginPrompt({ batteryId }: { batteryId: number | null }) {
  const booking = batteryId !== null;
  const { styles } = useUi();
  return (
    <Page>
      <PageHeader title={booking ? 'Entre para reservar' : 'Minhas reservas'} />
      <Panel style={{ gap: 14 }}>
        <Text style={styles.muted}>{booking ? 'Entre na sua conta para confirmar participantes, aplicar cupom e pagar com segurança.' : 'Entre para ver suas reservas e acompanhar o pagamento.'}</Text>
        <Link href={batteryId ? { pathname: '/(auth)/login', params: { bateriaId: String(batteryId) } } : '/(auth)/login'} asChild>
          <Pressable accessibilityRole="button" style={styles.action}><Text style={styles.actionText}>Entrar na conta</Text></Pressable>
        </Link>
      </Panel>
    </Page>
  );
}

function LogoutButton() {
  const { logout } = useSession();
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    try { await logout(); }
    catch {
      Alert.alert('Não foi possível sair', 'Não foi possível apagar a sessão salva neste aparelho.', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Tentar novamente', onPress: () => void submit() },
      ]);
    }
    finally { setBusy(false); }
  }

  return <View style={{ alignSelf: 'flex-end', marginBottom: 18 }}><ActionButton label={busy ? 'Encerrando sessão…' : 'Sair da conta'} onPress={() => void submit()} disabled={busy} secondary /></View>;
}

function ReservationList({ orders, loading, error, retry }: {
  orders: ReservationOrder[] | null;
  loading: boolean;
  error: string;
  retry: () => void;
}) {
  const { palette, styles } = useUi();
  return <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
    <FlatList data={orders ?? []} keyExtractor={(order) => order.id} contentContainerStyle={styles.content} refreshing={loading} onRefresh={retry}
      ListHeaderComponent={<>
        <PageHeader title="Minhas reservas" description="Seus próximos encontros com a pista." />
        <LogoutButton />
        {loading && !orders ? <LoadingMessage label="Buscando suas reservas…" /> : null}
        {error ? <View style={{ gap: 12 }}><InlineError message={error} /><ActionButton label="Tentar novamente" onPress={retry} secondary /></View> : null}
        {!loading && !error && orders?.length === 0 ? <Panel style={{ gap: 14 }}>
          <Text style={styles.muted}>Você ainda não tem reservas.</Text>
          <Link href="/(tabs)/agenda" asChild><Pressable accessibilityRole="button" style={styles.action}><Text style={styles.actionText}>Ver agenda</Text></Pressable></Link>
        </Panel> : null}
      </>}
      renderItem={({ item: order }) => <Link href={{ pathname: '/reservations/[id]', params: { id: order.id } }} asChild>
        <TouchableOpacity activeOpacity={0.65} accessibilityRole="link" style={styles.row}>
          <Icon name="ticket" color={palette.accent} />
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>{order.descricao ?? 'Reserva em processamento'}</Text>
            <Text style={styles.rowDetail}>{formatDateTime(order.inicio)}</Text>
            <Text style={styles.rowDetail}>{order.codigo}</Text>
            <Text style={[styles.rowDetail, { color: palette.text }]}>{order.valorCentavos === null ? 'Valor em confirmação' : formatBrl(order.valorCentavos)}</Text>
            <Text style={[styles.rowDetail, { color: palette.accent, fontWeight: '600' }]}>{statusLabel(order.status)}</Text>
          </View>
          <Icon name="chevron" color={palette.muted} size={18} />
        </TouchableOpacity>
      </Link>} />
  </SafeAreaView>;
}

function BookingForm({ agenda, batteryId, accessToken }: { agenda: AgendaResponse; batteryId: number; accessToken: string }) {
  const { palette, styles } = useUi();
  const slot = agenda.horarios.find((item) => item.id === batteryId);
  const [quantity, setQuantity] = useState('1');
  const [pilots, setPilots] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [policyAccepted, setPolicyAccepted] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'pix' | 'cartao'>('pix');
  const [coupon, setCoupon] = useState('');
  const [quote, setQuote] = useState<{ totalCentavos: number; descontoCentavos: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [couponBusy, setCouponBusy] = useState(false);
  const [error, setError] = useState('');
  const [couponError, setCouponError] = useState('');
  const key = useRef<string | null>(null);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);
  const count = Number(quantity);

  function changed() {
    key.current = null;
    setError('');
  }

  async function validateCoupon() {
    const code = coupon.trim().toUpperCase();
    if (!code || !slot || !Number.isSafeInteger(count) || count < 1 || count > slot.livres) {
      setCouponError('Informe um cupom e uma quantidade de vagas disponível.');
      return;
    }
    setCouponBusy(true);
    setCouponError('');
    setQuote(null);
    try {
      const result = await reservationsApi.previewCoupon({ codigo: code, bateriaId: batteryId, quantidade: count }, accessToken);
      if (result.status === 'completed') {
        if ('erro' in result) setCouponError(result.erro);
        else setQuote({ totalCentavos: result.totalCentavos, descontoCentavos: result.descontoCentavos });
      } else setCouponError('A validação do cupom ainda está em andamento. Tente novamente.');
    } catch (reason) {
      setCouponError(messageOf(reason));
    } finally {
      setCouponBusy(false);
    }
  }

  async function submit() {
    if (!slot || !agenda.pagamentoOnline) return;
    const nascimento = dateForServer(birthDate);
    if (!Number.isSafeInteger(count) || count < 1 || count > Math.min(slot.livres, agenda.maxPilotos)) {
      setError(`Escolha entre 1 e ${Math.min(slot.livres, agenda.maxPilotos)} vagas.`);
      return;
    }
    if (!nascimento) {
      setError('Informe uma data de nascimento válida no formato DD/MM/AAAA.');
      return;
    }
    if (!policyAccepted) {
      setError('Aceite a política de cancelamento para continuar.');
      return;
    }
    setBusy(true);
    setError('');
    const input: CreateReservationInput = {
      bateriaId: batteryId,
      quantidade: count,
      pilotos: pilots.split('\n').map((name) => name.trim()).filter(Boolean),
      forma: paymentMethod,
      nascimento,
      politica: true,
      ...(coupon.trim() ? { cupom: coupon.trim().toUpperCase() } : {}),
    };
    key.current ??= idempotencyKey();
    try {
      const created = await reservationsApi.create(input, accessToken, key.current);
      if (active.current) router.push({ pathname: '/reservations/[id]', params: { id: created.id } });
    } catch (reason) {
      setError(messageOf(reason));
    } finally {
      setBusy(false);
    }
  }

  if (!slot) {
    return <View style={{ gap: 12 }}><InlineError message="Este horário não aparece mais na agenda. Volte e escolha outro." /><Link href="/(tabs)/agenda" asChild><Pressable accessibilityRole="button" style={styles.action}><Text style={styles.actionText}>Voltar à agenda</Text></Pressable></Link></View>;
  }

  return (
    <View style={{ gap: 14 }}>
      <Panel>
        <Text style={{ color: palette.accent, fontSize: 14, fontWeight: '800' }}>{formatDateTime(slot.inicio)}</Text>
        <Text style={{ color: palette.text, fontSize: 19, fontWeight: '800', marginTop: 7 }}>{slot.nome}</Text>
        <Text style={[styles.muted, { marginTop: 8 }]}>{slot.livres} vagas disponíveis · {formatBrl(agenda.precoCentavos)} por piloto</Text>
      </Panel>

      <Text accessibilityRole="header" style={[styles.sectionTitle, { marginTop: 12 }]}>Participantes</Text>
      <Field label="Quantidade de vagas">
        <TextInput
          accessibilityLabel="Quantidade de vagas"
          value={quantity}
          onChangeText={(value) => { setQuantity(value.replace(/\D/g, '')); setQuote(null); changed(); }}
          keyboardType="number-pad"
          style={styles.input}
        />
      </Field>
      <Field label="Pilotos (um nome por linha)" hint={<Text style={styles.muted}>Opcional. O nome da conta é usado como responsável pela reserva.</Text>}>
        <TextInput
          accessibilityLabel="Pilotos, um nome por linha"
          value={pilots}
          onChangeText={(value) => { setPilots(value); changed(); }}
          multiline
          style={[styles.input, { minHeight: 78, paddingTop: 12, textAlignVertical: 'top' }]}
        />
      </Field>
      <Field label="Data de nascimento do responsável">
        <TextInput
          accessibilityLabel="Data de nascimento do responsável"
          placeholder="DD/MM/AAAA"
          placeholderTextColor={palette.muted}
          value={birthDate}
          onChangeText={(value) => {
            const digits = value.replace(/\D/g, '').slice(0, 8);
            setBirthDate([digits.slice(0, 2), digits.slice(2, 4), digits.slice(4)].filter(Boolean).join('/'));
            changed();
          }}
          keyboardType="number-pad"
          maxLength={10}
          style={styles.input}
        />
      </Field>
      <Text accessibilityRole="header" style={[styles.sectionTitle, { marginTop: 20 }]}>Pagamento</Text>
      <Field label="Cupom de desconto">
        <TextInput
          accessibilityLabel="Cupom de desconto"
          autoCapitalize="characters"
          autoCorrect={false}
          value={coupon}
          onChangeText={(value) => { setCoupon(value); setQuote(null); setCouponError(''); changed(); }}
          style={styles.input}
        />
        <View style={{ marginTop: 9 }}><ActionButton label={couponBusy ? 'Validando cupom…' : 'Validar cupom'} onPress={() => void validateCoupon()} disabled={couponBusy} secondary /></View>
        {couponError ? <View style={{ marginTop: 9 }}><InlineError message={couponError} /></View> : null}
        {quote ? <Text accessibilityLiveRegion="polite" style={{ color: palette.accent, fontSize: 15, fontWeight: '800', marginTop: 10 }}>Total com desconto: {formatBrl(quote.totalCentavos)}</Text> : null}
      </Field>

      <Field label="Forma de pagamento">
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {(['pix', 'cartao'] as const).map((method) => (
            <Pressable
              key={method}
              accessibilityRole="radio"
              accessibilityState={{ checked: paymentMethod === method }}
              onPress={() => { setPaymentMethod(method); changed(); }}
              style={[styles.panel, { flex: 1, padding: 13, borderColor: paymentMethod === method ? palette.accent : palette.border }]}
            >
              <Text style={{ color: palette.text, fontSize: 15, fontWeight: '700', textAlign: 'center' }}>{method === 'pix' ? 'Pix' : 'Cartão'}</Text>
            </Pressable>
          ))}
        </View>
      </Field>

      <Pressable
        accessibilityRole="checkbox"
        accessibilityLabel="Aceito a política de cancelamento"
        accessibilityState={{ checked: policyAccepted }}
        onPress={() => { setPolicyAccepted(!policyAccepted); changed(); }}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48, paddingVertical: 12 }}
      >
        <View style={{ width: 23, height: 23, borderRadius: 6, borderWidth: 1, borderColor: policyAccepted ? palette.accent : palette.border, alignItems: 'center', justifyContent: 'center', backgroundColor: policyAccepted ? palette.accent : 'transparent' }}>
          {policyAccepted ? <Icon name="check" color={palette.onAccent} size={16} /> : null}
        </View>
        <Text style={[styles.muted, { flex: 1, color: palette.text }]}>Aceito a política de cancelamento da reserva.</Text>
      </Pressable>

      <Text style={styles.muted}>A reserva será confirmada após o pagamento e a confirmação das vagas.</Text>
      {error ? <InlineError message={error} /> : null}
      {!agenda.pagamentoOnline ? <Notice message="O pagamento online está indisponível. Fale com a recepção para reservar." /> : null}
      <ActionButton label={busy ? 'Enviando reserva…' : 'Enviar reserva'} onPress={() => void submit()} disabled={busy || !agenda.pagamentoOnline} />
    </View>
  );
}

function AuthenticatedReservations({ session, batteryId }: { session: SessionTokens; batteryId: number | null }) {
  const [agenda, setAgenda] = useState<AgendaResponse | null>(null);
  const [orders, setOrders] = useState<ReservationOrder[] | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const loadAgenda = useCallback(async () => {
    try {
      const next = await reservationsApi.agenda();
      setAgenda(next);
      setError('');
    }
    catch (reason) { setError(messageOf(reason)); }
    finally { setLoading(false); }
  }, []);

  const loadOrders = useCallback(async () => {
    if (!session) return;
    try {
      const next = await reservationsApi.list(session.accessToken);
      setOrders(next);
      setError('');
    }
    catch (reason) { setError(messageOf(reason)); }
    finally { setLoading(false); }
  }, [session]);

  function retryAgenda() {
    setLoading(true);
    setError('');
    void loadAgenda();
  }

  function retryOrders() {
    setLoading(true);
    setError('');
    void loadOrders();
  }

  useEffect(() => {
    if (!session) return;
    void Promise.resolve().then(() => batteryId !== null ? loadAgenda() : loadOrders());
  }, [batteryId, loadAgenda, loadOrders, session]);

  if (batteryId !== null) {
    return (
      <Page>
        <PageHeader title="Confirmar reserva" description="Informe os dados do responsável e revise o pedido antes de pagar." />
        <LogoutButton />
        {loading && !agenda ? <LoadingMessage label="Carregando horário…" /> : null}
        {error ? <View style={{ gap: 12 }}><InlineError message={error} /><ActionButton label="Tentar novamente" onPress={retryAgenda} secondary /></View> : null}
        {agenda ? <BookingForm key={batteryId} agenda={agenda} batteryId={batteryId} accessToken={session.accessToken} /> : null}
      </Page>
    );
  }
  return <ReservationList orders={orders} loading={loading} error={error} retry={retryOrders} />;
}

function ReservationsContent() {
  const { session, isLoading } = useSession();
  const params = useLocalSearchParams<{ bateriaId?: string | string[] }>();
  const rawBatteryId = Array.isArray(params.bateriaId) ? params.bateriaId[0] : params.bateriaId;
  const batteryId = rawBatteryId && /^\d+$/.test(rawBatteryId) && Number.isSafeInteger(Number(rawBatteryId)) && Number(rawBatteryId) > 0 ? Number(rawBatteryId) : null;
  if (isLoading) return <Page><LoadingMessage label="Carregando sua conta…" /></Page>;
  if (!session) return <LoginPrompt batteryId={batteryId} />;
  return <AuthenticatedReservations session={session} batteryId={batteryId} />;
}

export default function ReservationsScreen() {
  return <SessionBoundary><ReservationsContent /></SessionBoundary>;
}

function statusLabel(status: ReservationOrder['status']) {
  return {
    novo: 'Recebida',
    aguardando_pagamento: 'Aguardando pagamento',
    pago: 'Pagamento recebido',
    confirmado: 'Confirmada',
    recusado: 'Recusada',
    expirado: 'Expirada',
    pago_sem_vaga: 'Precisa de atendimento',
    erro_pagamento: 'Pagamento não concluído',
  }[status];
}
