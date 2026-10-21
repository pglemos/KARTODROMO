import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  Alert,
  FlatList,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DEMO_MODE } from '../config/features';
import { formatCentavosToReais, useCartSafe } from '../features/cart/context';
import { reservationsApi } from '../features/reservations/api';
import { formatDateTime } from '../features/reservations/components';
import { useSession } from '../session/provider';
import { AgendaSlot } from '../types/racing';
import { Brand } from './brand';
import { Entrada, tap } from './motion';
import { CartModal } from './cart-modal';
import { FloatingCartBar } from './floating-cart-bar';
import { SportsIcon } from './sports-icons';
import { SPORTS_PALETTE } from './theme';

export interface AgendaScreenProps {
  onAddToCart?: (slot: AgendaSlot, quantity: number) => void;
  slots?: AgendaSlot[];
}

const DIAS = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
/** "21/10/2026" → "TER" (ou "HOJE"/"AMANHÃ") */
function diaDaSemana(data: string) {
  const [d, m, a] = data.split('/').map(Number);
  const dia = new Date(a, m - 1, d);
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const diff = Math.round((dia.getTime() - hoje.getTime()) / 86_400_000);
  return diff === 0 ? 'HOJE' : diff === 1 ? 'AMANHÃ' : DIAS[dia.getDay()] ?? '';
}
/** "21/10/2026" → "21 out" */
function diaMes(data: string) {
  const [d, m] = data.split('/').map(Number);
  return `${d} ${MESES[m - 1] ?? ''}`;
}

export function AgendaScreen({
  onAddToCart,
  slots: customSlots,
}: AgendaScreenProps) {
  const hookCart = useCartSafe();
  const { session } = useSession();

  const [apiSlots, setApiSlots] = useState<AgendaSlot[] | null>(null);
  const [apiError, setApiError] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState(customSlots?.[0]?.date ?? new Date().toLocaleDateString('pt-BR'));
  const [selectedSlot, setSelectedSlot] = useState<AgendaSlot | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [isCartModalVisible, setIsCartModalVisible] = useState(false);
  const [bookingOnSite, setBookingOnSite] = useState(false);
  const requestVersion = useRef({ version: 0 });

  const loadBackendAgenda = useCallback(async () => {
    if (customSlots) return;
    const requestId = ++requestVersion.current.version;
    setApiSlots(null);
    setApiError('');
    try {
      const data = await reservationsApi.agenda();
      if (requestVersion.current.version !== requestId) return;
      if (data && Array.isArray(data.horarios)) {
        setApiError('');
        // horário que já largou não aparece para reservar
        const agora = Date.now();
        const mapped: AgendaSlot[] = data.horarios.filter((h) => Date.parse(h.inicio) > agora).map((h) => {
          const dt = formatDateTime(h.inicio);
          const [dPart, tPart] = dt.split(' · ');
          return {
            id: h.id,
            title: h.nome,
            date: dPart,
            time: tPart,
            availableSlots: h.livres,
            maxSlots: data.maxPilotos,
            priceCentavos: data.precoCentavos,
            priceFormatted: formatCentavosToReais(data.precoCentavos),
            category: 'LOCAÇÃO',
            sportType: 'KARTING',
            trackConfig: '',
            isSoldOut: h.livres < 1,
            formattedDateTime: dt,
            isBackendSlot: true,
          };
        });
        setApiSlots(mapped);
        setBookingOnSite(data.bookingChannel === 'site');
        if (mapped.length > 0 && mapped[0].date) {
          setSelectedDate(mapped[0].date);
        }
      } else {
        throw new Error('Agenda indisponível. Tente novamente.');
      }
    } catch (err) {
      if (requestVersion.current.version !== requestId) return;
      const msg =
        err instanceof Error
          ? err.message
          : 'Sem conexão. Confira a internet e tente novamente.';
      setApiError(msg);
    }
  }, [customSlots]);

  useEffect(() => {
    let active = true;
    const requests = requestVersion.current;
    if (!customSlots) {
      void Promise.resolve().then(() => { if (active) return loadBackendAgenda(); });
    }
    return () => { active = false; requests.version++; };
  }, [customSlots, loadBackendAgenda]);

  const slots = useMemo(() => customSlots ?? apiSlots ?? [], [customSlots, apiSlots]);
  const dates = [...new Set(slots.map((slot) => slot.date))];

  const filteredSlots = useMemo(() => {
    return slots.filter((s) => s.date === selectedDate);
  }, [slots, selectedDate]);

  const activeSlots = filteredSlots;

  const handleOpenSlot = (slot: AgendaSlot) => {
    if (slot.isSoldOut) return;
    setSelectedSlot(slot);
    setQuantity(1);
  };

  const handleConfirmAddToCart = () => {
    if (!selectedSlot) return;

    if (onAddToCart) {
      onAddToCart(selectedSlot, quantity);
    }

    if (hookCart) {
      hookCart.addItem({
        sessionId: selectedSlot.id,
        sessionTitle: selectedSlot.title,
        trackName: 'KARTÓDROMO DE BETIM',
        date: selectedSlot.date,
        time: selectedSlot.time,
        quantity,
        unitPriceCentavos: selectedSlot.priceCentavos,
        maxQuantity: Math.min(selectedSlot.availableSlots, selectedSlot.maxSlots),
      });
    }

    setSelectedSlot(null);
  };

  const formatPrice = (centavos: number) => {
    const reais = Math.max(0, centavos) / 100;
    return `R$ ${reais.toFixed(2).replace('.', ',')}`;
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <View testID="screen-agenda" style={styles.screenContainer}>
        {/* 1. Header Block (Matches IMG_3793.PNG) */}
        <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 }}>
          <Text accessibilityRole="header" style={{ color: '#FFFFFF', fontSize: 32, fontWeight: '900', letterSpacing: -0.5 }}>Agenda</Text>
          <Text testID="agenda-selected-date" style={{ color: '#9CA3AF', fontSize: 15, marginTop: 2 }}>Escolha o dia e o horário da sua bateria</Text>
        </View>

        <FlatList
          testID="agenda-slots-list"
          style={styles.slotsList}
          contentContainerStyle={styles.slotsListContent}
          showsVerticalScrollIndicator={false}
          data={activeSlots}
          keyExtractor={(slot) => String(slot.id)}
          ListHeaderComponent={<>
          {bookingOnSite && <Text style={styles.statusText}>Horários oficiais. A reserva será concluída no site do kartódromo.</Text>}

          {/* Falhas da API nunca viram vagas demonstrativas. */}
          <View style={styles.agendaStatus}>
            <ScrollView horizontal contentContainerStyle={{ gap: 8 }}>
              {dates.map((date) => {
                const isSelected = selectedDate === date;
                return (
                  <Pressable
                    key={date}
                    testID={`date-pill-${date}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    onPress={() => { tap(); setSelectedDate(date); }}
                    style={[styles.datePill, isSelected && styles.datePillSelected]}
                  >
                    <Text style={[styles.dayName, isSelected && { color: '#000000' }]}>{diaDaSemana(date)}</Text>
                    <Text style={[styles.dayNumber, isSelected && { color: '#000000' }]}>{diaMes(date)}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {apiError ? (
              <View>
                <Text accessibilityRole="alert" style={styles.statusText}>{apiError}</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Tentar novamente"
                  style={styles.datePill}
                  onPress={loadBackendAgenda}
                >
                  <Text style={styles.statusText}>Tentar novamente</Text>
                </Pressable>
              </View>
            ) : null}
          </View>

          {!customSlots && apiSlots === null && !apiError && <Text style={styles.statusText}>Carregando horários…</Text>}
          {!apiError && apiSlots !== null && activeSlots.length === 0 && <Text style={styles.statusText}>Nenhum horário disponível nesta data.</Text>}

          {/* 5. Battery Slots Cards (Matches IMG_3793.PNG) */}
          </>}
          renderItem={({ item: slot, index }) => {
            const isSoldOut = slot.isSoldOut || slot.availableSlots <= 0;
            const isBackend = slot.isBackendSlot;

            const handlePressSlot = () => {
              if (isSoldOut) return;
              tap();
              if (isBackend) {
                if (bookingOnSite) {
                  void Linking.openURL('https://reservas.kartodromodebetim.com.br').catch(() =>
                    Alert.alert('Não foi possível abrir o site', 'Confira a conexão e tente novamente.'));
                  return;
                }
                router.push(
                  session
                    ? {
                        pathname: '/(tabs)/reservas',
                        params: { bateriaId: String(slot.id) },
                      }
                    : {
                        pathname: '/(auth)/login',
                        params: { bateriaId: String(slot.id) },
                      }
                );
              } else {
                handleOpenSlot(slot);
              }
            };

            return (
              <Entrada index={index}>
              <Pressable
                testID={`agenda-slot-card-${slot.id}`}
                accessibilityRole="button"
                accessibilityLabel={isSoldOut ? `${slot.time}, esgotado` : `Reservar bateria das ${slot.time}, ${slot.availableSlots} vagas`}
                disabled={isSoldOut}
                onPress={handlePressSlot}
                style={({ pressed }) => [styles.slotCard, isSoldOut && styles.slotCardSoldOut, { transform: [{ scale: pressed ? 0.98 : 1 }], opacity: pressed ? 0.9 : 1 }]}
              >
                <View style={{ width: 92 }}>
                  <Text style={[styles.slotHora, styles.tabularNums]}>{slot.time}</Text>
                  <Text style={styles.slotRotulo}>BATERIA</Text>
                </View>
                <View style={{ flex: 1, paddingRight: 12 }}>
                  <Text testID={`slot-vagas-${slot.id}`} style={[styles.slotVagas, isSoldOut ? styles.vagasSoldOut : styles.vagasAvailable]}>
                    {isSoldOut ? 'Esgotado' : slot.availableSlots === 1 ? '1 vaga' : `${slot.availableSlots} vagas`}
                  </Text>
                  <View style={styles.vagasTrilho}>
                    <View style={[styles.vagasBarra, { width: `${Math.min(100, Math.max(6, (slot.availableSlots / 30) * 100))}%`, backgroundColor: isSoldOut ? '#EF4444' : slot.availableSlots <= 5 ? '#F59E0B' : '#00E676' }]} />
                  </View>
                </View>
                {isSoldOut ? null : (
                  <View style={styles.reservarPill}>
                    <Text style={styles.reservarTexto}>{isBackend ? (bookingOnSite ? 'No site' : 'Reservar') : 'Escolher'}</Text>
                  </View>
                )}
              </Pressable>
              </Entrada>
            );
          }}
        />

        {/* 6. Battery Detail / Carrinho Stepper Modal (Matches IMG_3794.PNG & IMG_3795.PNG) */}
        {selectedSlot && (
          <Modal
            testID="slot-detail-modal"
            visible={!!selectedSlot}
            transparent
            animationType="fade"
            onRequestClose={() => setSelectedSlot(null)}
          >
            <View style={styles.modalOverlay}>
              {/* Header Bar matching IMG_3794.PNG */}
              <View style={styles.detailTopBar}>
                <Pressable
                  testID="btn-cancel-slot-top"
                  accessibilityLabel="Fechar seleção"
                  onPress={() => setSelectedSlot(null)}
                  style={styles.headerBackBtn}
                >
                  <SportsIcon name="back" size={22} color="#FFFFFF" />
                </Pressable>
                <Text style={styles.detailTopBarTitle}>CARRINHO</Text>
                <View style={{ width: 38 }} />
              </View>

              <View style={styles.detailBody}>
                {/* Partner Card */}
                <View style={styles.partnerCard}>
                  <Brand width={90} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.partnerCardTitle}>KARTÓDROMO DE BETIM</Text>
                  </View>
                </View>

                {/* Battery Detail Sheet Card (Matches IMG_3794.PNG) */}
                <View testID="slot-detail-sheet" style={styles.modalCard}>
                  <Text testID="slot-detail-title" style={styles.modalTitle}>
                    {selectedSlot.title}
                  </Text>

                  {/* 2x2 Info Grid: PREÇO | TIPO | ESPORTES | DATA */}
                  <View style={styles.infoGridRow}>
                    <View style={styles.infoGridCol}>
                      <Text style={styles.infoLabel}>PREÇO</Text>
                      <Text
                        testID="slot-detail-price"
                        style={[styles.infoValue, styles.tabularNums]}
                      >
                        {selectedSlot.priceFormatted}
                      </Text>
                      <Text style={styles.srOnly}>
                        {`${selectedSlot.priceFormatted} por pessoa`}
                      </Text>
                    </View>

                    <View style={styles.infoGridCol}>
                      <Text style={styles.infoLabel}>TIPO</Text>
                      <Text style={styles.infoValue}>
                        {selectedSlot.category}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.infoGridRow}>
                    <View style={styles.infoGridCol}>
                      <Text style={styles.infoLabel}>ESPORTES</Text>
                      <Text style={styles.infoValue}>
                        {selectedSlot.sportType || 'KARTING'}
                      </Text>
                    </View>

                    <View style={styles.infoGridCol}>
                      <Text style={styles.infoLabel}>DATA</Text>
                      <Text style={[styles.infoValue, styles.tabularNums]}>
                        {selectedSlot.date} {selectedSlot.time}
                      </Text>
                    </View>
                  </View>

                  {/* Quantity & Add to Cart Row (Matches IMG_3794.PNG) */}
                  <Text style={styles.infoLabel}>QUANTIDADE</Text>
                  <View style={styles.quantityAndActionRow}>
                    <View style={styles.stepperControls}>
                      <Pressable
                        testID="btn-stepper-decrement"
                        accessibilityLabel="Diminuir quantidade"
                        accessibilityRole="button"
                        disabled={quantity <= 1}
                        onPress={() => setQuantity(Math.max(1, quantity - 1))}
                        style={[
                          styles.stepperBtn,
                          quantity <= 1 && styles.stepperBtnDisabled,
                        ]}
                      >
                        <Text style={styles.stepperBtnText}>-</Text>
                      </Pressable>
                      <Text
                        testID="stepper-value-text"
                        style={[styles.stepperValue, styles.tabularNums]}
                      >
                        {quantity}
                      </Text>
                      <Pressable
                        testID="btn-stepper-increment"
                        accessibilityLabel="Aumentar quantidade"
                        accessibilityRole="button"
                        disabled={quantity >= selectedSlot.availableSlots}
                        onPress={() =>
                          setQuantity(
                            Math.min(selectedSlot.availableSlots, quantity + 1)
                          )
                        }
                        style={[
                          styles.stepperBtn,
                          quantity >= selectedSlot.availableSlots &&
                            styles.stepperBtnDisabled,
                        ]}
                      >
                        <Text style={styles.stepperBtnText}>+</Text>
                      </Pressable>
                    </View>

                    {/* Wide Silver Pill CTA */}
                    <Pressable
                      testID="btn-add-to-cart"
                      accessibilityRole="button"
                      onPress={handleConfirmAddToCart}
                      style={styles.silverAddToCartBtn}
                    >
                      <Text style={styles.silverAddToCartText}>
                        ADICIONAR AO CARRINHO
                      </Text>
                      <Text style={styles.srOnly}>
                        {`ADICIONAR AO CARRINHO (${formatPrice(selectedSlot.priceCentavos * quantity)})`}
                      </Text>
                    </Pressable>
                  </View>

                  <Pressable
                    testID="btn-cancel-slot"
                    accessibilityRole="button"
                    onPress={() => setSelectedSlot(null)}
                    style={styles.srOnly}
                  >
                    <Text>CANCELAR</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </Modal>
        )}

        {/* Carrinho é prévia sem backend: só no modo demonstração. */}
        {DEMO_MODE && (
          <>
            <FloatingCartBar
              onPress={() => setIsCartModalVisible(true)}
              bottomOffset={Platform.OS === 'ios' ? 96 : 94}
            />
            <CartModal
              visible={isCartModalVisible}
              onClose={() => setIsCartModalVisible(false)}
            />
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const condensedFont = Platform.select({
  ios: 'System',
  android: 'sans-serif-condensed',
  default: 'sans-serif',
});

const styles = StyleSheet.create({
  agendaStatus: { gap: 12, marginBottom: 16 },
  statusText: { color: '#FFFFFF', fontSize: 15 },
  datePill: { minHeight: 64, minWidth: 72, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 16, backgroundColor: '#1E2228', justifyContent: 'center' },
  datePillSelected: { backgroundColor: '#F59E0B' },
  dayName: { color: '#9CA3AF', fontSize: 12, fontWeight: '800', letterSpacing: 1, textAlign: 'center' },
  dayNumber: { color: '#FFFFFF', fontSize: 17, fontWeight: '800', textAlign: 'center', marginTop: 2 },
  slotHora: { color: '#FFFFFF', fontSize: 28, fontWeight: '900', letterSpacing: -0.5 },
  slotRotulo: { color: '#9CA3AF', fontSize: 11, fontWeight: '800', letterSpacing: 1.5, marginTop: 2 },
  vagasTrilho: { height: 6, borderRadius: 3, backgroundColor: '#2A2E35', marginTop: 8, overflow: 'hidden' },
  vagasBarra: { height: 6, borderRadius: 3 },
  reservarPill: { backgroundColor: '#F59E0B', borderRadius: 999, paddingHorizontal: 16, paddingVertical: 10 },
  reservarTexto: { color: '#000000', fontWeight: '800', fontSize: 14 },
  safeArea: {
    flex: 1,
    backgroundColor: '#000000',
  },
  screenContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  srOnly: {
    position: 'absolute',
    opacity: 0,
    width: 1,
    height: 1,
    overflow: 'hidden',
  },
  headerBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1D21',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  headerBackBtn: {
    width: 48,
    height: 48,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  screenHeaderTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
    fontFamily: condensedFont,
    letterSpacing: 0.5,
  },
  dateLabel: {
    color: '#D1D5DB',
    fontSize: 13,
    fontWeight: '700',
    fontFamily: condensedFont,
    marginTop: 2,
    letterSpacing: 0.3,
  },
  slotsList: {
    flex: 1,
  },
  slotsListContent: {
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 140,
  },
  partnerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#181C20',
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    gap: 14,
  },
  partnerCardTitle: {
    color: '#E5E7EB',
    fontSize: 14,
    fontWeight: '700',
    fontFamily: condensedFont,
    letterSpacing: 0.3,
  },
  reservasHeaderBar: {
    backgroundColor: '#181C20',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  reservasHeaderText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    fontFamily: condensedFont,
    letterSpacing: 0.4,
  },
  slotCard: {
    flexDirection: 'row',
    backgroundColor: '#181C20',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 10,
    alignItems: 'center',
  },
  slotCardSoldOut: {
    opacity: 0.55,
  },
  slotTitle: {
    color: '#E5E7EB',
    fontSize: 15,
    fontWeight: '700',
    fontFamily: condensedFont,
    letterSpacing: 0.3,
  },
  slotTimeSub: {
    color: '#9CA3AF',
    fontSize: 13,
    fontFamily: condensedFont,
    marginTop: 4,
  },
  slotRightCol: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  vagasChevronRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  slotVagas: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: condensedFont,
    letterSpacing: 0.3,
  },
  vagasAvailable: {
    color: '#D1D5DB',
  },
  vagasSoldOut: {
    color: SPORTS_PALETTE.neonRed,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: '#000000',
  },
  detailTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1A1D21',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 54 : 44,
    paddingBottom: 18,
  },
  detailTopBarTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
    fontFamily: condensedFont,
    letterSpacing: 0.5,
  },
  detailBody: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  modalCard: {
    backgroundColor: '#181C20',
    borderRadius: 16,
    padding: 18,
  },
  modalTitle: {
    color: '#E5E7EB',
    fontSize: 16,
    fontWeight: '700',
    fontFamily: condensedFont,
    textAlign: 'center',
    marginBottom: 18,
    letterSpacing: 0.4,
  },
  infoGridRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  infoGridCol: {
    flex: 1,
  },
  infoLabel: {
    color: '#9CA3AF',
    fontSize: 12,
    fontWeight: '700',
    fontFamily: condensedFont,
    letterSpacing: 0.3,
    marginBottom: 4,
  },
  infoValue: {
    color: '#E5E7EB',
    fontSize: 15,
    fontWeight: '700',
    fontFamily: condensedFont,
  },
  quantityAndActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 6,
  },
  stepperControls: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#14171A',
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: '#252A30',
  },
  stepperBtn: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperBtnDisabled: {
    opacity: 0.35,
  },
  stepperBtnText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  stepperValue: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    minWidth: 28,
    textAlign: 'center',
  },
  silverAddToCartBtn: {
    flex: 1,
    backgroundColor: '#B0B3B8',
    borderRadius: 9999,
    paddingVertical: 13,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  silverAddToCartText: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '800',
    fontFamily: condensedFont,
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  tabularNums: {
    fontVariant: ['tabular-nums'],
    fontFamily: condensedFont,
  },
});
