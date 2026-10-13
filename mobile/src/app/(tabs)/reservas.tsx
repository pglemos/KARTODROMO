import { Link, router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';

import type { SessionTokens } from '../../api/contracts';

import { reservationsApi } from '../../features/reservations/api';
import type { AgendaResponse, CreateReservationInput, ReservationOrder } from '../../features/reservations/schemas';
import { ActionButton, Field, formatBrl, formatDateTime, InlineError, LoadingMessage, Page, PageHeader, Panel, palette, styles } from '../../features/reservations/components';
import { useSession } from '../../session/provider';
import { SessionBoundary } from '../../session/boundary';

const inputStyle = {
  minHeight: 48,
  borderRadius: 12,
  borderWidth: 1,
  borderColor: palette.border,
  backgroundColor: '#0a1511',
  color: palette.text,
  fontSize: 15,
  paddingHorizontal: 13,
};

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

function LoginPrompt({ booking }: { booking: boolean }) {
  return (
    <Page>
      <PageHeader eyebrow="Sua conta" title={booking ? 'Entre para reservar' : 'Minhas reservas'} />
      <Panel style={{ gap: 14 }}>
        <Text style={styles.muted}>{booking ? 'Entre na sua conta para confirmar participantes, aplicar cupom e pagar com segurança.' : 'Entre para ver suas reservas e acompanhar o pagamento.'}</Text>
        <Link href="/(auth)/login" asChild>
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

  return <View style={{ marginBottom: 18 }}><ActionButton label={busy ? 'Encerrando sessão…' : 'Sair da conta'} onPress={() => void submit()} disabled={busy} secondary /></View>;
}

function ReservationList({ orders, loading, error, retry }: {
  orders: ReservationOrder[] | null;
  loading: boolean;
  error: string;
  retry: () => void;
}) {
  return (
    <Page>
      <PageHeader eyebrow="Sua conta" title="Minhas reservas" description="Acompanhe somente os pedidos vinculados à sua conta." />
      <LogoutButton />
      {loading && !orders ? <LoadingMessage label="Buscando suas reservas…" /> : null}
      {error ? <View style={{ gap: 12 }}><InlineError message={error} /><ActionButton label="Tentar novamente" onPress={retry} secondary /></View> : null}
      {orders?.length === 0 ? (
        <Panel style={{ gap: 14 }}>
          <Text style={styles.muted}>Você ainda não tem reservas.</Text>
          <Link href="/(tabs)/agenda" asChild>
            <Pressable accessibilityRole="button" style={styles.action}><Text style={styles.actionText}>Ver agenda</Text></Pressable>
          </Link>
        </Panel>
      ) : null}
      {orders?.map((order) => (
        <Link key={order.id} href={{ pathname: '/reservations/[id]', params: { id: order.id } }} asChild>
          <Pressable accessibilityRole="link" style={[styles.panel, { marginBottom: 12 }]}>
            <Text style={{ color: palette.accent, fontSize: 11, fontWeight: '800', letterSpacing: 1 }}>{order.codigo}</Text>
            <Text style={{ color: palette.text, fontSize: 17, fontWeight: '800', marginTop: 7 }}>{order.descricao ?? 'Reserva em processamento'}</Text>
            <Text style={[styles.muted, { marginTop: 8 }]}>{formatDateTime(order.inicio)}</Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 }}>
              <Text style={{ color: palette.text, fontSize: 13, fontWeight: '700' }}>{order.valorCentavos === null ? 'Valor em confirmação' : formatBrl(order.valorCentavos)}</Text>
              <Text style={{ color: palette.accent, fontSize: 12, fontWeight: '800' }}>{statusLabel(order.status)}</Text>
            </View>
          </Pressable>
        </Link>
      ))}
    </Page>
  );
}

function BookingForm({ agenda, batteryId, accessToken }: { agenda: AgendaResponse; batteryId: number; accessToken: string }) {
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
        <Text style={{ color: palette.accent, fontSize: 11, fontWeight: '800', letterSpacing: 1 }}>{formatDateTime(slot.inicio)}</Text>
        <Text style={{ color: palette.text, fontSize: 19, fontWeight: '800', marginTop: 7 }}>{slot.nome}</Text>
        <Text style={[styles.muted, { marginTop: 8 }]}>{slot.livres} vagas no servidor · {formatBrl(agenda.precoCentavos)} por piloto</Text>
      </Panel>

      <Field label="Quantidade de vagas">
        <TextInput
          accessibilityLabel="Quantidade de vagas"
          value={quantity}
          onChangeText={(value) => { setQuantity(value.replace(/\D/g, '')); setQuote(null); changed(); }}
          keyboardType="number-pad"
          style={inputStyle}
        />
      </Field>
      <Field label="Pilotos (um nome por linha)" hint={<Text style={styles.muted}>Opcional. O nome da conta é usado como responsável pela reserva.</Text>}>
        <TextInput
          accessibilityLabel="Pilotos, um nome por linha"
          value={pilots}
          onChangeText={(value) => { setPilots(value); changed(); }}
          multiline
          style={[inputStyle, { minHeight: 78, paddingTop: 12, textAlignVertical: 'top' }]}
        />
      </Field>
      <Field label="Data de nascimento do responsável">
        <TextInput
          accessibilityLabel="Data de nascimento do responsável"
          placeholder="DD/MM/AAAA"
          placeholderTextColor={palette.muted}
          value={birthDate}
          onChangeText={(value) => { setBirthDate(value); changed(); }}
          keyboardType="number-pad"
          style={inputStyle}
        />
      </Field>
      <Field label="Cupom de desconto">
        <TextInput
          accessibilityLabel="Cupom de desconto"
          autoCapitalize="characters"
          autoCorrect={false}
          value={coupon}
          onChangeText={(value) => { setCoupon(value); setQuote(null); setCouponError(''); changed(); }}
          style={inputStyle}
        />
        <View style={{ marginTop: 9 }}><ActionButton label={couponBusy ? 'Validando cupom…' : 'Validar cupom'} onPress={() => void validateCoupon()} disabled={couponBusy} secondary /></View>
        {couponError ? <View style={{ marginTop: 9 }}><InlineError message={couponError} /></View> : null}
        {quote ? <Text accessibilityLiveRegion="polite" style={{ color: palette.accent, fontSize: 15, fontWeight: '800', marginTop: 10 }}>Total com desconto do servidor: {formatBrl(quote.totalCentavos)}</Text> : null}
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
              <Text style={{ color: palette.text, fontSize: 13, fontWeight: '700', textAlign: 'center' }}>{method === 'pix' ? 'Pix' : 'Cartão'}</Text>
            </Pressable>
          ))}
        </View>
      </Field>

      <Pressable
        accessibilityRole="checkbox"
        accessibilityLabel="Aceito a política de cancelamento"
        accessibilityState={{ checked: policyAccepted }}
        onPress={() => { setPolicyAccepted(!policyAccepted); changed(); }}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7 }}
      >
        <View style={{ width: 23, height: 23, borderRadius: 6, borderWidth: 1, borderColor: policyAccepted ? palette.accent : palette.border, alignItems: 'center', justifyContent: 'center', backgroundColor: policyAccepted ? palette.accent : 'transparent' }}>
          {policyAccepted ? <Text style={{ color: palette.background, fontWeight: '900' }}>✓</Text> : null}
        </View>
        <Text style={[styles.muted, { flex: 1, color: palette.text }]}>Aceito a política de cancelamento da reserva.</Text>
      </Pressable>

      <Text style={styles.muted}>O cupom será validado novamente ao reservar. O pedido só fica confirmado após a confirmação oficial do pagamento e das vagas.</Text>
      {error ? <InlineError message={error} /> : null}
      {!agenda.pagamentoOnline ? <InlineError message="O pagamento online está indisponível. Fale com a recepção para reservar." /> : null}
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
        <PageHeader eyebrow="Nova reserva" title="Confirmar reserva" description="Informe os dados do responsável e revise o pedido antes de pagar." />
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
  const batteryId = rawBatteryId && /^\d+$/.test(rawBatteryId) ? Number(rawBatteryId) : null;
  if (isLoading) return <Page><LoadingMessage label="Carregando sua conta…" /></Page>;
  if (!session) return <LoginPrompt booking={batteryId !== null} />;
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
