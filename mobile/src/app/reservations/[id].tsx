import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Image, Linking, Platform, Pressable, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';

import { reservationsApi } from '../../features/reservations/api';
import type { ReservationOrder, ReservationStatus } from '../../features/reservations/schemas';
import { ActionButton, formatBrl, formatDateTime, InlineError, LoadingMessage, Page, PageHeader, Panel, useUi } from '../../features/reservations/components';
import { useSession } from '../../session/provider';
import { SessionBoundary } from '../../session/boundary';
import { Icon } from '../../components/brand';
import { tap } from '../../components/motion';

const PAGO: ReservationStatus[] = ['pago', 'confirmado'];
const RUIM: ReservationStatus[] = ['recusado', 'expirado', 'erro_pagamento', 'pago_sem_vaga'];

/** selo do status: círculo colorido que entra com mola a cada mudança de status */
function SeloStatus({ status }: { status: ReservationStatus }) {
  const { palette } = useUi();
  const [escala] = useState(() => new Animated.Value(0.6));
  useEffect(() => {
    escala.setValue(0.6);
    Animated.spring(escala, { toValue: 1, friction: 4, tension: 120, useNativeDriver: Platform.OS !== 'web' }).start();
  }, [escala, status]);
  const pago = PAGO.includes(status), ruim = RUIM.includes(status);
  const cor = pago ? palette.neonGreen : ruim ? palette.neonRed : palette.accent;
  return (
    <Animated.View style={{ alignSelf: 'center', width: 84, height: 84, borderRadius: 42, alignItems: 'center', justifyContent: 'center', backgroundColor: cor + '26', borderWidth: 2, borderColor: cor, transform: [{ scale: escala }], marginBottom: 14 }}>
      <Icon name={pago ? 'check' : ruim ? 'close' : 'timer'} color={cor} size={40} />
    </Animated.View>
  );
}

/** contagem regressiva até o Pix expirar */
function Contagem({ ate }: { ate: string }) {
  const { palette } = useUi();
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setAgora(Date.now()), 1000); return () => clearInterval(t); }, []);
  const resta = Math.max(0, new Date(ate).getTime() - agora);
  const min = Math.floor(resta / 60000), seg = Math.floor((resta % 60000) / 1000);
  const urgente = resta < 5 * 60000;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: urgente ? 'rgba(239,68,68,0.15)' : palette.surfaceElevated }}>
      <Icon name="timer" color={urgente ? palette.neonRed : palette.textSecondary} size={16} />
      <Text style={{ color: urgente ? palette.neonRed : palette.text, fontWeight: '800', fontVariant: ['tabular-nums'] }}>{resta ? `Pague em ${min}:${String(seg).padStart(2, '0')}` : 'Prazo encerrado'}</Text>
    </View>
  );
}

function statusLabel(status: ReservationStatus) {
  return {
    novo: 'Reserva recebida',
    aguardando_pagamento: 'Aguardando pagamento',
    pago: 'Pagamento recebido',
    confirmado: 'Reserva confirmada',
    recusado: 'Reserva recusada',
    expirado: 'Reserva expirada',
    pago_sem_vaga: 'Pagamento precisa de atendimento',
    erro_pagamento: 'Pagamento não concluído',
  }[status];
}

function imageUri(value: string) {
  return value.startsWith('data:image/') ? value : `data:image/png;base64,${value}`;
}

function ReservationDetailContent() {
  const { palette, styles } = useUi();
  const { session, isLoading: sessionLoading } = useSession();
  const params = useLocalSearchParams<{ id: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const [order, setOrder] = useState<ReservationOrder | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    if (!session || !id) return;
    try {
      const next = await reservationsApi.get(id, session.accessToken);
      setOrder(next);
      setError('');
    }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível carregar esta reserva.'); }
    finally { setLoading(false); }
  }, [id, session]);

  useEffect(() => {
    if (session) void Promise.resolve().then(load);
  }, [load, session]);

  // enquanto espera o pagamento, confere sozinho a cada 5 s; quando o Pix cai, vibra de sucesso
  const aguardando = order?.status === 'aguardando_pagamento' || Boolean(order?.preparandoPagamento);
  useEffect(() => {
    if (!aguardando) return;
    const t = setInterval(() => void load(), 5000);
    return () => clearInterval(t);
  }, [aguardando, load]);
  const statusAntes = useRef<ReservationStatus | null>(null);
  useEffect(() => {
    const st = order?.status ?? null;
    if (statusAntes.current === 'aguardando_pagamento' && st && PAGO.includes(st) && Platform.OS !== 'web') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    statusAntes.current = st;
  }, [order?.status]);

  function refresh() {
    setLoading(true);
    setError('');
    void load();
  }

  async function copyPix() {
    if (!order?.pix?.payload) return;
    try {
      await Clipboard.setStringAsync(order.pix.payload);
      tap();
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setError('Não foi possível copiar o código Pix. Você pode selecioná-lo e copiar manualmente.');
    }
  }

  async function openInvoice() {
    if (!order?.invoiceUrl) return;
    try {
      const url = new URL(order.invoiceUrl);
      if (url.protocol !== 'https:') throw new Error('invalid protocol');
      await Linking.openURL(url.toString());
    } catch {
      setError('Não foi possível abrir o pagamento. Atualize o pedido e tente novamente.');
    }
  }

  if (sessionLoading) return <Page top={false}><LoadingMessage label="Carregando sua reserva…" /></Page>;
  if (!session) {
    return (
      <Page top={false}>
        <PageHeader title="Entre para continuar" />
        <Panel style={{ gap: 14 }}>
          <Text style={styles.muted}>Entre para consultar os detalhes e o pagamento da sua reserva.</Text>
          <ActionButton label="Entrar na conta" onPress={() => router.push('/(auth)/login')} />
        </Panel>
      </Page>
    );
  }
  if (loading && !order && !error) return <Page top={false}><LoadingMessage label="Carregando sua reserva…" /></Page>;
  if (error && !order) {
    return <Page top={false}><PageHeader title="Não foi possível carregar" /><View style={{ gap: 12 }}><InlineError message={error} /><ActionButton label="Tentar novamente" onPress={refresh} secondary /></View></Page>;
  }
  if (!order) return <Page top={false}><LoadingMessage /></Page>;

  const attention = order.status === 'pago_sem_vaga';
  const pix = order.status === 'aguardando_pagamento' ? order.pix : null;
  return (
    <Page top={false}>
      <SeloStatus status={order.status} />
      <Text style={[styles.muted, { marginBottom: 8 }]}>Pedido {order.codigo}</Text>
      <PageHeader title={statusLabel(order.status)} description={order.descricao ?? 'Sua reserva está sendo preparada pelo servidor do kartódromo.'} />
      <Panel style={{ gap: 9, marginBottom: 14 }}>
        <Text style={styles.muted}>{formatDateTime(order.inicio)}</Text>
        <Text style={styles.muted}>{order.quantidade} {order.quantidade === 1 ? 'vaga' : 'vagas'} · {order.forma === 'pix' ? 'Pix' : 'Cartão'}</Text>
        <Text style={{ color: palette.text, fontSize: 24, fontWeight: '900', marginTop: 5 }}>
          {order.valorCentavos === null ? 'Valor em confirmação' : formatBrl(order.valorCentavos)}
        </Text>
        {order.expiraEm && order.status === 'aguardando_pagamento' ? <View style={{ marginTop: 6 }}><Contagem ate={order.expiraEm} /></View> : null}
      </Panel>

      {order.preparandoPagamento ? <Panel style={{ marginBottom: 14 }}><Text style={styles.muted}>Estamos preparando as instruções de pagamento. Atualize o pedido em alguns instantes.</Text></Panel> : null}
      {attention ? <InlineError message={order.erro ?? 'A recepção precisa conferir este pagamento e combinar a solução com você.'} /> : null}
      {order.erro && !attention ? <InlineError message={order.erro} /> : null}
      {pix ? (
        <Panel style={{ alignItems: 'center', gap: 13, marginTop: 14 }}>
          <Text style={{ color: palette.text, fontSize: 16, fontWeight: '800' }}>Pague com Pix</Text>
          {pix.imagem ? <Image accessibilityLabel="QR Code Pix" source={{ uri: imageUri(pix.imagem) }} resizeMode="contain" style={{ width: 220, height: 220, backgroundColor: '#FFFFFF', borderRadius: 16 }} /> : null}
          <Text style={[styles.muted, { textAlign: 'center' }]}>Abra o app do seu banco, escolha Pix e leia o QR Code — ou copie o código abaixo. A confirmação aparece aqui sozinha.</Text>
          <Text style={[styles.muted, { alignSelf: 'stretch' }]}>Pix copia e cola</Text>
          <Text selectable numberOfLines={3} style={{ color: palette.textSecondary, fontSize: 13, lineHeight: 18, alignSelf: 'stretch', padding: 10, borderRadius: 12, backgroundColor: palette.surfaceElevated }}>{pix.payload}</Text>
          <ActionButton label={copied ? '✓ Código copiado' : 'Copiar código Pix'} onPress={() => void copyPix()} />
        </Panel>
      ) : null}
      {order.status === 'aguardando_pagamento' && order.forma === 'cartao' && order.invoiceUrl ? (
        <View style={{ marginTop: 14 }}><ActionButton label="Abrir pagamento seguro" onPress={() => void openInvoice()} /></View>
      ) : null}
      {error && order ? <View style={{ marginTop: 14 }}><InlineError message={error} /></View> : null}
      <View style={{ marginTop: 14 }}><ActionButton label={loading ? 'Atualizando…' : 'Atualizar status'} onPress={refresh} disabled={loading} secondary /></View>
      <Pressable accessibilityRole="link" onPress={() => router.replace('/(tabs)/reservas')} style={{ paddingVertical: 18 }}>
        <Text style={{ color: palette.accent, fontSize: 15, fontWeight: '800', textAlign: 'center' }}>Voltar para minhas reservas</Text>
      </Pressable>
    </Page>
  );
}

export default function ReservationDetailScreen() {
  const params = useLocalSearchParams<{ id: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  return <SessionBoundary><ReservationDetailContent key={id} /></SessionBoundary>;
}
