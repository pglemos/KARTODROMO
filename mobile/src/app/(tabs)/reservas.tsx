import { Link, router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Alert, FlatList, Pressable, ScrollView, TouchableOpacity, Text, TextInput, View } from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import { Brand, Icon } from '../../components/brand';
import { Caixa, Desenho, Foto, LARGO, T, Toque, cor, fonte, fundos, useK, useTopo } from '../../components/design-kit';
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

function maskDate(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4)].filter(Boolean).join('/');
}

function maskCpf(value: string) {
  const d = value.replace(/\D/g, '').slice(0, 11);
  return d.replace(/^(\d{3})(\d)/, '$1.$2').replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d{1,2})$/, '.$1-$2');
}

/** Mesma conta do site e do servidor da recepção. */
export function cpfValido(value: string) {
  const d = value.replace(/\D/g, '');
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const dv = (n: number) => {
    let soma = 0;
    for (let i = 0; i < n; i++) soma += Number(d[i]) * (n + 1 - i);
    const r = (soma * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dv(9) === Number(d[9]) && dv(10) === Number(d[10]);
}

/** @usuário do Instagram como o site aceita (com ou sem @, ou o link do perfil). '' = não informado; null = inválido. */
export function instagramNormalizado(value: string): string | null {
  const u = value.trim().replace(/^(?:https?:\/\/)?(?:www\.)?instagram\.com\//i, '').replace(/[/?#].*$/, '').replace(/^@/, '').toLowerCase();
  if (!u) return '';
  if (!/^[a-z0-9_](?:[a-z0-9_.]{0,28}[a-z0-9_])?$/.test(u) || u.includes('..')) return null;
  return `@${u}`;
}

type OtherPilot = { nome: string; cpf: string; nascimento: string; instagram: string };
const emptyPilot: OtherPilot = { nome: '', cpf: '', nascimento: '', instagram: '' };

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
  const { logout, deleteAccount } = useSession();
  const { palette } = useUi();
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

  function promptDeleteAccount() {
    Alert.alert(
      'Excluir conta definitivamente',
      'Tem certeza de que deseja excluir sua conta? Seus dados de cadastro serão apagados permanentemente.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir minha conta',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              await deleteAccount();
              Alert.alert('Conta excluída', 'Sua conta e seus dados foram excluídos com sucesso.');
            } catch {
              Alert.alert('Aviso', 'Sua sessão foi encerrada.');
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  }

  return (
    // fica no fim da lista, longe do fluxo de reserva, para ninguém excluir a conta por engano
    <View style={{ marginTop: 32, gap: 4 }}>
      <ActionButton label={busy ? 'Encerrando…' : 'Sair da conta'} onPress={() => void submit()} disabled={busy} secondary />
      <Pressable accessibilityRole="button" onPress={promptDeleteAccount} disabled={busy} style={{ paddingVertical: 14, alignSelf: 'center' }}>
        <Text style={{ color: palette.danger, fontSize: 14, fontWeight: '600' }}>Excluir minha conta</Text>
      </Pressable>
    </View>
  );
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
      ListFooterComponent={<LogoutButton />}
      ListHeaderComponent={<>
        <PageHeader title="Minhas reservas" description="Seus próximos encontros com a pista." />
        {loading && !orders ? <LoadingMessage label="Buscando suas reservas…" /> : null}
        {error ? <View style={{ gap: 12 }}><InlineError message={error} /><ActionButton label="Tentar novamente" onPress={retry} secondary /></View> : null}
        {!loading && !error && orders?.length === 0 ? <Panel style={{ gap: 14 }}>
          <Text style={styles.muted}>Você ainda não tem reservas.</Text>
          <Link href="/(tabs)/agenda" asChild><Pressable accessibilityRole="button" style={styles.action}><Text style={styles.actionText}>Ver agenda</Text></Pressable></Link>
        </Panel> : null}
      </>}
      renderItem={({ item: order }) => <Link href={{ pathname: '/reservations/[id]', params: { id: order.id } }} asChild>
        <TouchableOpacity activeOpacity={0.75} accessibilityRole="link" accessibilityLabel={`${order.descricao ?? 'Reserva'}, ${formatDateTime(order.inicio)}, ${statusLabel(order.status)}`}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, marginBottom: 10, borderRadius: 20, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border }}>
          {/* data em destaque, como um bilhete */}
          <View style={{ width: 58, borderRadius: 14, backgroundColor: palette.surfaceElevated, alignItems: 'center', paddingVertical: 8 }}>
            <Text style={{ color: palette.accent, fontSize: 11, fontWeight: '800', letterSpacing: 1 }}>{formatDateTime(order.inicio).slice(3, 5) ? ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'][Number(formatDateTime(order.inicio).slice(3, 5)) - 1] ?? '' : ''}</Text>
            <Text style={{ color: palette.text, fontSize: 24, fontWeight: '900', lineHeight: 28 }}>{formatDateTime(order.inicio).slice(0, 2)}</Text>
            <Text style={{ color: palette.textMuted, fontSize: 12, fontVariant: ['tabular-nums'] }}>{formatDateTime(order.inicio).split(' · ')[1] ?? ''}</Text>
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Text numberOfLines={1} style={{ color: palette.text, fontSize: 16, fontWeight: '800' }}>{order.descricao ?? 'Reserva em processamento'}</Text>
            <View style={{ flexDirection: 'row', gap: 6 }}><Text style={{ color: palette.textMuted, fontSize: 13 }}>{order.codigo}</Text><Text style={{ color: palette.textMuted, fontSize: 13 }}>· {order.valorCentavos === null ? 'valor em confirmação' : formatBrl(order.valorCentavos)}</Text></View>
            <View style={{ alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: corStatus(order.status) + '26' }}>
              <Text style={{ color: corStatus(order.status), fontSize: 12, fontWeight: '800' }}>{statusLabel(order.status)}</Text>
            </View>
          </View>
          <Icon name="chevron" color={palette.muted} size={18} />
        </TouchableOpacity>
      </Link>} />
  </SafeAreaView>;
}

function BookingForm({ agenda, batteryId, accessToken }: { agenda: AgendaResponse; batteryId: number; accessToken: string }) {
  const { palette, styles } = useUi();
  const k = useK();
  const slot = agenda.horarios.find((item) => item.id === batteryId);
  const [quantity, setQuantity] = useState('1');
  const [birthDate, setBirthDate] = useState('');
  const [instagram, setInstagram] = useState('');
  const [buyerRides, setBuyerRides] = useState(true);
  const [others, setOthers] = useState<OtherPilot[]>([]);
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
  // cada vaga é de uma pessoa: quem reserva ocupa uma (se for pilotar) e cada outra precisa do cadastro de quem vai correr
  const needed = Number.isSafeInteger(count) && count > 0 ? Math.max(0, Math.min(count, 10) - (buyerRides ? 1 : 0)) : 0;

  function changed() {
    key.current = null;
    setError('');
  }

  function updatePilot(index: number, field: keyof OtherPilot, value: string) {
    setOthers((list) => {
      const next = [...list];
      while (next.length <= index) next.push({ ...emptyPilot });
      next[index] = { ...next[index], [field]: value };
      return next;
    });
    changed();
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
    const insta = instagramNormalizado(instagram);
    if (!insta) {
      setError(insta === '' ? 'Informe seu Instagram (o @usuário). Ele sai junto com seu nome no resultado da bateria.' : 'Instagram inválido. Informe o @usuário (ex.: @andre.silva).');
      return;
    }
    const acompanhantes: CreateReservationInput['acompanhantes'] = [];
    for (let i = 0; i < needed; i++) {
      const p = others[i] ?? emptyPilot;
      const n = i + (buyerRides ? 2 : 1);
      const nome = p.nome.replace(/\s+/g, ' ').trim();
      if (nome.split(' ').length < 2) { setError(`Informe o nome completo do piloto ${n}.`); return; }
      if (!cpfValido(p.cpf)) { setError(`CPF inválido do piloto ${n} (${nome}).`); return; }
      const data = dateForServer(p.nascimento);
      if (!data) { setError(`Data de nascimento inválida do piloto ${n} (${nome}).`); return; }
      const ig = instagramNormalizado(p.instagram);
      if (ig === null) { setError(`Instagram inválido do piloto ${n} (${nome}). Informe o @usuário ou deixe em branco.`); return; }
      acompanhantes.push({ nome, documento: p.cpf, nascimento: data, ...(ig ? { instagram: ig } : {}) });
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
      pilotos: acompanhantes.map((p) => p.nome),
      forma: paymentMethod,
      nascimento,
      politica: true,
      instagram: insta,
      compradorPilota: buyerRides,
      acompanhantes,
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

  const atual = Number(quantity) || 1;
  const limite = Math.max(slot.livres, 1);
  const total = quote ? quote.totalCentavos : atual * agenda.precoCentavos;
  const passo = (delta: number) => {
    const proximo = Math.min(Math.max(atual + delta, 1), limite);
    return (
      <Pressable accessibilityRole="button" accessibilityLabel={delta < 0 ? 'Menos uma vaga' : 'Mais uma vaga'} disabled={proximo === atual}
        onPress={() => { setQuantity(String(proximo)); setQuote(null); changed(); }}
        style={({ pressed }) => ({ width: 75 * k, height: 75 * k, borderRadius: 38 * k, borderWidth: 1.5, borderColor: '#3A403D', alignItems: 'center', justifyContent: 'center', opacity: proximo === atual ? 0.4 : 1, transform: [{ scale: pressed ? 0.92 : 1 }] })}>
        <Icon name={delta < 0 ? 'minus' : 'plus'} color="#FFFFFF" size={30 * k} />
      </Pressable>
    );
  };
  const caixaMarcar = (marcado: boolean) => (
    <View style={{ width: 35 * k, height: 35 * k, borderRadius: 7 * k, backgroundColor: marcado ? '#1ED760' : 'transparent', borderWidth: marcado ? 0 : 1.5, borderColor: '#5A605D', alignItems: 'center', justifyContent: 'center' }}>
      {marcado ? <Icon name="check" color="#04230F" size={24 * k} /> : null}
    </View>
  );
  const entrada = { height: '100%' as const, flex: 1, color: '#FFFFFF', fontSize: 19 * k, paddingHorizontal: 0 };
  const caixaEntrada = { borderRadius: 12 * k, backgroundColor: '#121716', borderWidth: 1, borderColor: '#2B302E', flexDirection: 'row' as const, alignItems: 'center' as const, paddingLeft: 22 * k, gap: 22 * k };

  return (
    <View style={{ width: 852 * k, alignSelf: 'center' }}>
      {/* topo, data e participantes (y 70–815 do desenho) */}
      <View style={{ height: (815 - 70) * k }}>
        <Caixa x={0} y={2} w={852} h={343} pointerEvents="none"><Foto fonte={fundos.reservaTopo} /></Caixa>
        <Toque x={38} y={8} w={70} h={70} rotulo="Voltar" onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/agenda'))}
          style={{ borderRadius: 35 * k, borderWidth: 1.5, borderColor: '#3A403D', backgroundColor: 'rgba(10,12,11,0.7)', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="back" color="#FFFFFF" size={30 * k} />
        </Toque>
        <Caixa x={122} y={12} pointerEvents="none"><Brand width={303 * k} /></Caixa>
        <Caixa x={43} y={112} pointerEvents="none" style={{ flexDirection: 'row', alignItems: 'center' }}>
          <T s={17} c="#D3D8D5" p="500" style={{ letterSpacing: 7 * k }}>RESERVA DE BATERIA</T>
          <View style={{ width: 50 * k, height: 3 * k, backgroundColor: cor.verde, marginLeft: 6 * k }} />
        </Caixa>
        <Caixa x={41} y={140} pointerEvents="none">
          <Text accessibilityRole="header" accessibilityLabel="Confirmar reserva" style={{ color: '#FFFFFF', fontFamily: fonte.display, fontSize: 74 * k, lineHeight: 57 * k, transform: [{ scaleX: LARGO }], transformOrigin: 'left top', letterSpacing: -1 * k }}>
            CONFIRMAR{'\n'}<Text style={{ color: cor.verde }}>RESERVA</Text>
          </Text>
        </Caixa>
        <Caixa x={43} y={268} w={450} pointerEvents="none"><T s={21} lh={28} c="#DCE1DE">Revise os detalhes e preencha suas informações para garantir sua vaga na pista.</T></Caixa>

        <Caixa x={25} y={345} w={801} h={222} style={{ borderRadius: 22 * k, overflow: 'hidden', borderWidth: 1, borderColor: '#2B302E' }}>
          <Foto fonte={fundos.reservaData} />
          <Caixa x={20} y={25} w={75} h={72} pointerEvents="none" style={{ borderRadius: 16 * k, backgroundColor: '#10261A', alignItems: 'center', justifyContent: 'center' }}><Icon name="calendar" color={cor.verde} size={40 * k} /></Caixa>
          <Caixa x={116} y={22} pointerEvents="none">
            <T s={16} c="#C9CFCC" style={{ letterSpacing: 1 * k }}>DATA E HORÁRIO</T>
            <T s={32} p="700" style={{ marginTop: 6 * k, fontVariant: ['tabular-nums'] }}>{formatDateTime(slot.inicio)}</T>
            <View style={{ alignSelf: 'flex-start', marginTop: 8 * k, height: 24 * k, paddingHorizontal: 14 * k, borderRadius: 7 * k, backgroundColor: '#0E5A2B', justifyContent: 'center' }}>
              <T s={14} p="700" c="#3BF07F" style={{ letterSpacing: 2 * k }}>{slot.nome.toUpperCase()}</T>
            </View>
          </Caixa>
          <Toque x={648} y={23} w={129} h={48} rotulo="Alterar horário" onPress={() => router.replace('/(tabs)/agenda')}
            style={{ borderRadius: 14 * k, borderWidth: 1.5, borderColor: '#5A605D', backgroundColor: 'rgba(0,0,0,0.6)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 * k }}>
            <Icon name="pencil" color="#FFFFFF" size={20 * k} />
            <T s={15} p="700" style={{ letterSpacing: 1 * k }}>ALTERAR</T>
          </Toque>
          {([[18, 262, 'people', '#FFFFFF', 'VAGAS DISPONÍVEIS', `${slot.livres} vagas`], [294, 247, 'clock', cor.verde, 'DURAÇÃO', '20 minutos'], [556, 228, 'money', cor.verde, 'VALOR POR PILOTO', formatBrl(agenda.precoCentavos)]] as const).map(([x, w, ic, c, r, v]) => (
            <Caixa key={r} x={x} y={125} w={w} h={78} pointerEvents="none" style={{ borderRadius: 14 * k, backgroundColor: 'rgba(18,23,22,0.95)', borderWidth: 1, borderColor: '#262B29', flexDirection: 'row', alignItems: 'center', paddingLeft: 22 * k, gap: 20 * k }}>
              <Icon name={ic} color={c} size={34 * k} />
              <View>
                <T s={14} c="#C9CFCC" style={{ letterSpacing: 0.5 * k }}>{r}</T>
                <T s={21} p="700" style={{ marginTop: 4 * k }}>{v}</T>
              </View>
            </Caixa>
          ))}
        </Caixa>

        <Caixa x={45} y={595} pointerEvents="none" style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Icon name="people" color="#FFFFFF" size={32 * k} />
          <T s={24} p="800" style={{ marginLeft: 16 * k, letterSpacing: 0.5 * k }}>PARTICIPANTES</T>
        </Caixa>
        <Caixa x={560} y={603} w={242} pointerEvents="none" style={{ alignItems: 'flex-end' }}><T s={17} c="#C9CFCC" style={{ letterSpacing: 1.5 * k }}>QUANTIDADE DE VAGAS</T></Caixa>
        <Caixa x={41} y={635} w={436} h={103} style={{ borderRadius: 14 * k, backgroundColor: '#121716', borderWidth: 1, borderColor: '#262B29', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 40 * k }}>
          {passo(-1)}
          <T s={46} p="700" style={{ fontVariant: ['tabular-nums'] }}>{atual}</T>
          {passo(1)}
        </Caixa>
        <Caixa x={497} y={635} w={313} h={103} pointerEvents="none" style={{ borderRadius: 14 * k, backgroundColor: '#0B2A17', borderWidth: 2 * k, borderColor: '#22D865', flexDirection: 'row', alignItems: 'center', paddingLeft: 18 * k, gap: 22 * k, shadowColor: cor.verde, shadowOpacity: 0.5, shadowRadius: 14 * k }}>
          <View style={{ width: 68 * k, height: 65 * k, borderRadius: 14 * k, backgroundColor: '#134A2A', alignItems: 'center', justifyContent: 'center' }}><Icon name="wallet" color={cor.verde} size={36 * k} /></View>
          <View>
            <T s={17} c="#D3D8D5" style={{ letterSpacing: 1 * k }}>TOTAL</T>
            <T s={34} p="700" style={{ fontVariant: ['tabular-nums'] }}>{formatBrl(total)}</T>
          </View>
        </Caixa>
      </View>

      {/* informações do piloto (y 830–1120) */}
      <View style={{ height: (1125 - 830) * k }}>
        <Caixa x={45} y={10} pointerEvents="none" style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Icon name="helmet" color="#FFFFFF" size={34 * k} />
          <T s={24} p="800" style={{ marginLeft: 20 * k, letterSpacing: 0.5 * k }}>INFORMAÇÕES DO PILOTO</T>
        </Caixa>
        <Caixa x={45} y={73} pointerEvents="none" style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Icon name="camera" color="#FFFFFF" size={26 * k} />
          <T s={19} style={{ marginLeft: 20 * k }}>Instagram</T>
        </Caixa>
        <Caixa x={303} y={53} w={506} h={62} style={caixaEntrada}>
          <Icon name="camera" color="#C9CFCC" size={24 * k} />
          <TextInput accessibilityLabel="Seu Instagram" placeholder="@seuusuario" placeholderTextColor="#8E9692" autoCapitalize="none" autoCorrect={false}
            value={instagram} onChangeText={(value) => { setInstagram(value); changed(); }} maxLength={80} style={entrada} />
        </Caixa>
        <Caixa x={303} y={122} pointerEvents="none"><T s={17} c="#B9C0BC">Sai junto com seu nome no resultado da bateria.</T></Caixa>
        <Caixa x={45} y={178} pointerEvents="none" style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Icon name="calendar" color="#FFFFFF" size={26 * k} />
          <T s={19} style={{ marginLeft: 20 * k }}>Data de nascimento</T>
        </Caixa>
        <Caixa x={303} y={160} w={506} h={64} style={caixaEntrada}>
          <Icon name="calendar" color="#C9CFCC" size={24 * k} />
          <TextInput accessibilityLabel="Sua data de nascimento" placeholder="DD/MM/AAAA" placeholderTextColor="#8E9692" value={birthDate}
            onChangeText={(value) => { setBirthDate(maskDate(value)); changed(); }} keyboardType="number-pad" maxLength={10} style={entrada} />
        </Caixa>
        <Toque x={43} y={240} w={766} h={50} rotulo="Eu também vou pilotar" onPress={() => { setBuyerRides(!buyerRides); changed(); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 18 * k }}>
          {caixaMarcar(buyerRides)}
          <T s={20}>Eu também vou pilotar (uso uma das vagas)</T>
        </Toque>
      </View>

      <View style={{ paddingHorizontal: 43 * k, gap: 12 }}>
        {needed > 0 ? <Text style={styles.muted}>Cada vaga é de uma pessoa diferente. Cadastre {needed === 1 ? (buyerRides ? 'o outro piloto' : 'quem vai pilotar') : `os ${needed} pilotos`} (14 anos ou mais).</Text> : null}
        {Array.from({ length: needed }, (_, i) => {
          const p = others[i] ?? emptyPilot;
          const n = i + (buyerRides ? 2 : 1);
          return (
            <Panel key={i} style={{ gap: 10 }}>
              <Text style={{ color: palette.text, fontSize: 15, fontWeight: '800' }}>Piloto {n}</Text>
              <Field label="Nome completo">
                <TextInput accessibilityLabel={`Nome completo do piloto ${n}`} value={p.nome} autoCapitalize="words" maxLength={120}
                  onChangeText={(value) => updatePilot(i, 'nome', value)} style={styles.input} />
              </Field>
              <Field label="CPF">
                <TextInput accessibilityLabel={`CPF do piloto ${n}`} value={p.cpf} keyboardType="number-pad" maxLength={14}
                  onChangeText={(value) => updatePilot(i, 'cpf', maskCpf(value))} style={styles.input} />
              </Field>
              <Field label="Data de nascimento">
                <TextInput accessibilityLabel={`Data de nascimento do piloto ${n}`} placeholder="DD/MM/AAAA" placeholderTextColor={palette.muted}
                  value={p.nascimento} keyboardType="number-pad" maxLength={10}
                  onChangeText={(value) => updatePilot(i, 'nascimento', maskDate(value))} style={styles.input} />
              </Field>
              <Field label="Instagram (opcional)">
                <TextInput accessibilityLabel={`Instagram do piloto ${n}`} placeholder="@usuario" placeholderTextColor={palette.muted}
                  value={p.instagram} autoCapitalize="none" autoCorrect={false} maxLength={80}
                  onChangeText={(value) => updatePilot(i, 'instagram', value)} style={styles.input} />
              </Field>
            </Panel>
          );
        })}
      </View>

      {/* pagamento: cupom (y 1137–1270) */}
      <View style={{ height: (1270 - 1137) * k }}>
        <Caixa x={30} y={0} w={792} h={1} pointerEvents="none" style={{ backgroundColor: '#262B29' }} />
        <Caixa x={45} y={18} pointerEvents="none" style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Icon name="card" color="#FFFFFF" size={36 * k} />
          <T s={24} p="800" style={{ marginLeft: 20 * k, letterSpacing: 0.5 * k }}>PAGAMENTO</T>
        </Caixa>
        <Caixa x={45} y={88} pointerEvents="none" style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Icon name="tag" color="#FFFFFF" size={28 * k} />
          <T s={19} style={{ marginLeft: 18 * k }}>Cupom de desconto</T>
        </Caixa>
        <Caixa x={283} y={71} w={334} h={57} style={caixaEntrada}>
          <Icon name="ticket" color="#8E9692" size={24 * k} />
          <TextInput accessibilityLabel="Cupom de desconto" placeholder="Digite seu cupom" placeholderTextColor="#8E9692" autoCapitalize="characters" autoCorrect={false}
            value={coupon} onChangeText={(value) => { setCoupon(value); setQuote(null); setCouponError(''); changed(); }} style={[entrada, { fontSize: 17 * k }]} />
        </Caixa>
        <Toque x={632} y={73} w={177} h={55} rotulo="Validar cupom" onPress={() => { if (!couponBusy) void validateCoupon(); }}
          style={{ borderRadius: 12 * k, borderWidth: 2 * k, borderColor: cor.verde, alignItems: 'center', justifyContent: 'center' }}>
          <T s={19} p="800" c={cor.verde} style={{ letterSpacing: 1 * k }}>{couponBusy ? '...' : 'VALIDAR'}</T>
        </Toque>
      </View>
      <View style={{ paddingHorizontal: 45 * k }}>
        {couponError ? <View style={{ marginTop: 6 }}><InlineError message={couponError} /></View> : null}
        {quote ? <Text accessibilityLiveRegion="polite" style={{ color: cor.verde, fontSize: 15, fontWeight: '800', marginTop: 6 }}>Total com desconto: {formatBrl(quote.totalCentavos)}</Text> : null}
      </View>

      {/* forma de pagamento, política e total (y 1275–1560) */}
      <View style={{ height: (1562 - 1275) * k }}>
        <Caixa x={47} y={8} pointerEvents="none"><T s={19}>Forma de pagamento</T></Caixa>
        {(['pix', 'cartao'] as const).map((m) => {
          const sel = paymentMethod === m;
          return (
            <Pressable key={m} accessibilityRole="radio" accessibilityState={{ checked: sel }} accessibilityLabel={m === 'pix' ? 'Pix' : 'Cartão de crédito'}
              onPress={() => { setPaymentMethod(m); changed(); }}
              style={{ position: 'absolute', left: (m === 'pix' ? 45 : 435) * k, top: 42 * k, width: 371 * k, height: 86 * k, borderRadius: 14 * k, borderWidth: sel ? 2 * k : 1, borderColor: sel ? '#22D865' : '#2B302E', backgroundColor: sel ? '#0C1F14' : '#0E1211', flexDirection: 'row', alignItems: 'center', paddingLeft: 22 * k, gap: 34 * k }}>
              {m === 'pix'
                ? <View style={{ width: 46 * k, alignItems: 'center' }}><Icon name="pix" color="#33E6A0" size={44 * k} /></View>
                : <View style={{ width: 64 * k, height: 56 * k, borderRadius: 12 * k, backgroundColor: '#1A1F1D', alignItems: 'center', justifyContent: 'center' }}><Icon name="card" color="#FFFFFF" size={32 * k} /></View>}
              <View style={{ flex: 1 }}>
                <T s={21} p="700">{m === 'pix' ? 'Pix' : 'Cartão de crédito'}</T>
                <T s={17} c="#C9CFCC" style={{ marginTop: 4 * k }}>{m === 'pix' ? 'Aprovação imediata' : 'Em até 12x'}</T>
              </View>
              <View style={{ marginRight: 14 * k, width: 30 * k, height: 30 * k, borderRadius: 15 * k, backgroundColor: sel ? '#22D865' : 'transparent', borderWidth: sel ? 0 : 1.5, borderColor: '#8E9692', alignItems: 'center', justifyContent: 'center' }}>
                {sel ? <Icon name="check" color="#04230F" size={20 * k} /> : null}
              </View>
            </Pressable>
          );
        })}
        <Toque x={45} y={140} w={764} h={40} rotulo="Aceito a política de cancelamento" onPress={() => { setPolicyAccepted(!policyAccepted); changed(); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 18 * k }}>
          {caixaMarcar(policyAccepted)}
          <T s={19}>Aceito a <Text style={{ textDecorationLine: 'underline' }}>política de cancelamento da reserva</Text>.</T>
        </Toque>
        <Caixa x={30} y={188} w={791} h={64} pointerEvents="none" style={{ borderRadius: 14 * k, backgroundColor: '#0E1211', borderWidth: 1, borderColor: '#262B29', flexDirection: 'row', alignItems: 'center', paddingLeft: 35 * k }}>
          <Icon name="wallet" color="#FFFFFF" size={32 * k} />
          <View style={{ width: 1.5 * k, height: 40 * k, backgroundColor: '#3A403D', marginHorizontal: 18 * k }} />
          <T s={19} c="#E3E7E5" style={{ flex: 1, letterSpacing: 0.5 * k }}>TOTAL DA RESERVA</T>
          <T s={31} p="700" c="#22E06B" style={{ marginRight: 24 * k, fontVariant: ['tabular-nums'] }}>{formatBrl(total)}</T>
        </Caixa>
        <Caixa x={70} y={262} pointerEvents="none" style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Icon name="lock" color="#B9C0BC" size={18 * k} />
          <T s={17} c="#B9C0BC" style={{ marginLeft: 10 * k }}>A reserva será confirmada após o pagamento e a confirmação das vagas.</T>
        </Caixa>
      </View>

      <View style={{ paddingHorizontal: 38 * k, gap: 8 }}>
        {error ? <InlineError message={error} /> : null}
        {!agenda.pagamentoOnline ? <Notice message="O pagamento online está indisponível. Fale com a recepção para reservar." /> : null}
      </View>

      <View style={{ height: 100 * k, marginTop: 8 * k }}>
        <Toque x={38} y={10} w={777} h={77} rotulo="Ir para o pagamento" onPress={() => { if (!busy && agenda.pagamentoOnline) void submit(); }}
          style={{ borderRadius: 18 * k, backgroundColor: busy || !agenda.pagamentoOnline ? '#1A6B3A' : '#1ED760', borderWidth: 1.5 * k, borderColor: '#5BF594', flexDirection: 'row', alignItems: 'center', paddingLeft: 66 * k, shadowColor: cor.verde, shadowOpacity: 0.6, shadowRadius: 18 * k, elevation: 10 }}>
          <Icon name="lock" color="#04230F" size={30 * k} />
          <T s={23} p="800" c="#04230F" style={{ marginLeft: 28 * k, letterSpacing: 2 * k }}>{busy ? 'ENVIANDO RESERVA…' : 'IR PARA O PAGAMENTO'}</T>
          <View style={{ marginLeft: 44 * k }}><Icon name="chevron" color="#04230F" size={28 * k} /></View>
        </Toque>
      </View>
    </View>
  );
}

/** fundo e rolagem da tela de confirmar reserva (o desenho já traz o título) */
function TelaReserva({ children }: { children: ReactNode }) {
  const topo = useTopo();
  return (
    <Desenho>
      <ScrollView style={{ flex: 1, backgroundColor: cor.fundo }} contentContainerStyle={{ paddingTop: topo, paddingBottom: 150 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {children}
      </ScrollView>
    </Desenho>
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
      <TelaReserva>
        {loading && !agenda ? <View style={{ padding: 20 }}><LoadingMessage label="Carregando horário…" /></View> : null}
        {error ? <View style={{ gap: 12, padding: 20 }}><InlineError message={error} /><ActionButton label="Tentar novamente" onPress={retryAgenda} secondary /></View> : null}
        {agenda ? <BookingForm key={batteryId} agenda={agenda} batteryId={batteryId} accessToken={session.accessToken} /> : null}
      </TelaReserva>
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

/** cor da etiqueta do status (verde = garantida, amarelo = falta algo, vermelho = não vale mais) */
function corStatus(status: ReservationOrder['status']) {
  return ({ confirmado: '#00E676', pago: '#00E676', novo: '#F59E0B', aguardando_pagamento: '#F59E0B', pago_sem_vaga: '#F59E0B', recusado: '#EF4444', expirado: '#EF4444', erro_pagamento: '#EF4444' } as Record<string, string>)[status] ?? '#9CA3AF';
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
