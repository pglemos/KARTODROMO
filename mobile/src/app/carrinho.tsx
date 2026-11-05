import { demoOnly } from '../config/features';
import { router } from 'expo-router';
import React from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SportsIcon } from '../components/sports-icons';
import { SPORTS_PALETTE } from '../components/theme';
import { formatCentavosToReais, useCart } from '../features/cart/context';

const condensedFont = Platform.select({
  android: 'sans-serif-condensed',
  ios: 'System',
  default: 'sans-serif-condensed',
});

function CarrinhoScreen() {
  const {
    items,
    totalQuantity,
    totalPriceFormatted,
    removeItem,
    clearCart,
  } = useCart();

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/agenda');
    }
  };

  const handleConfirmOrder = () => {
    Alert.alert('Pedido não enviado', 'O carrinho é uma prévia. Para reservar de verdade, escolha um horário disponível na agenda.');
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <View testID="screen-carrinho" style={styles.container}>
        {/* Top dimmed header matching IMG_3796.PNG background */}
        <View style={styles.topDimmedArea}>
          <View style={styles.header}>
            <Pressable
              testID="btn-back-carrinho"
              accessibilityRole="button"
              accessibilityLabel="Voltar"
              onPress={handleBack}
              style={styles.backBtn}
            >
              <SportsIcon name="back" size={22} color="#6B7280" />
              <Text style={styles.srOnly}>‹ VOLTAR</Text>
            </Pressable>
            <Text style={styles.headerTitle}>CARRINHO</Text>
            <View style={{ width: 36 }} />
          </View>
        </View>

        {/* Sheet Container matching IMG_3796.PNG */}
        <View style={styles.sheetContainer}>
          <View style={styles.sheetHeaderBar}>
            <View style={styles.sheetHeaderLeft}>
              <SportsIcon name="cart" size={22} color="#D4D8DF" />
              <Text style={styles.sheetHeaderTitle}>CARRINHO</Text>
            </View>
            <View style={styles.sheetHeaderRight}>
              <Text style={styles.sheetHeaderCount}>
                {totalQuantity} ITENS -{' '}
              </Text>
              <Text
                testID="cart-modal-total-price"
                style={styles.sheetHeaderPrice}
              >
                {totalPriceFormatted}
              </Text>
            </View>
          </View>

          <View style={styles.sheetBody}>
            <View style={styles.subHeader}>
              <Text style={styles.subHeaderLeft}>ITENS</Text>
              <Text style={styles.subHeaderRight}>
                TOQUE EM REMOVER
              </Text>
              <Text style={styles.srOnly}>
                ITENS SELECIONADOS • TOQUE EM REMOVER
              </Text>
            </View>

            {/* Content */}
            {items.length === 0 ? (
              <View testID="cart-empty-state" style={styles.emptyContainer}>
                <Text style={styles.emptyIcon}>🛒</Text>
                <Text style={styles.emptyTitle}>Seu carrinho está vazio.</Text>
                <Text style={styles.emptySubtitle}>
                  Selecione uma bateria na agenda ou na página do kartódromo para
                  continuar.
                </Text>
                <Pressable
                  testID="btn-ir-agenda"
                  accessibilityRole="button"
                  onPress={() => router.push('/(tabs)/agenda')}
                  style={styles.emptyActionBtn}
                >
                  <Text style={styles.emptyActionText}>
                    VER HORÁRIOS NA AGENDA ›
                  </Text>
                </Pressable>
              </View>
            ) : (
              <ScrollView
                testID="carrinho-scroll-list"
                style={styles.scrollList}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
              >
                {items.map((item) => (
                  <View
                    key={String(item.sessionId)}
                    testID={`cart-item-${item.sessionId}`}
                    style={styles.itemCard}
                  >
                    <View style={{ flex: 1, paddingRight: 10 }}>
                      <Text style={styles.itemTrack}>
                        {item.trackName}
                      </Text>
                      <Text style={styles.itemTitle}>{item.sessionTitle}</Text>
                      <Text style={styles.itemSubtitle}>
                        {item.date} - {item.time}
                      </Text>
                      <Text style={styles.srOnly}>
                        {`${item.trackName} • ${item.date} às ${item.time} ${item.quantity}x ${formatCentavosToReais(item.unitPriceCentavos)}`}
                      </Text>
                    </View>

                    <View style={styles.itemRightCol}>
                      <Text style={styles.itemTotal}>
                        {formatCentavosToReais(item.totalPriceCentavos)}
                      </Text>
                      <Pressable
                        testID={`swipe-remove-item-${item.sessionId}`}
                        accessibilityRole="button"
                        accessibilityLabel={`Remover ${item.sessionTitle}`}
                        onPress={() => removeItem(item.sessionId)}
                        style={styles.removeButton}
                      >
                        <Text style={{ color: '#FFFFFF' }}>REMOVER</Text>
                      </Pressable>
                    </View>
                  </View>
                ))}
              </ScrollView>
            )}

            {/* Footer (IMG_3796.PNG) */}
            {items.length > 0 && (
              <View style={styles.footer}>
                <View style={styles.srOnly}>
                  <Text>TOTAL DO PEDIDO:</Text>
                  <Text>
                    {totalQuantity} {totalQuantity === 1 ? 'vaga' : 'vagas'}{' '}
                    reservadas
                  </Text>
                </View>

                <View style={styles.actionsCol}>
                  <Pressable
                    testID="btn-confirm-order"
                    accessibilityRole="button"
                    onPress={handleConfirmOrder}
                    style={styles.confirmBtn}
                  >
                    <Text style={styles.confirmBtnText}>CONFIRMAR PEDIDO</Text>
                  </Pressable>

                  <View style={styles.secondaryRow}>
                    <Pressable
                      testID="btn-clear-cart"
                      accessibilityRole="button"
                      onPress={clearCart}
                      style={[styles.secondaryBtn, { flex: 1 }]}
                    >
                      <Text style={styles.secondaryBtnText}>REMOVER TODOS</Text>
                    </Pressable>

                    <Pressable
                      testID="btn-continue-shopping"
                      accessibilityRole="button"
                      onPress={handleBack}
                      style={[styles.secondaryBtn, { flex: 1 }]}
                    >
                      <Text style={styles.secondaryBtnText}>
                        CONTINUAR COMPRANDO
                      </Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            )}
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#1A1D21',
  },
  container: {
    flex: 1,
    backgroundColor: SPORTS_PALETTE.background,
  },
  topDimmedArea: {
    paddingBottom: 18,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: SPORTS_PALETTE.surface,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: condensedFont,
    color: '#D4D8DF',
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  sheetContainer: {
    flex: 1,
    backgroundColor: SPORTS_PALETTE.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  sheetHeaderBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1A1D21',
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  sheetHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sheetHeaderTitle: {
    fontFamily: condensedFont,
    color: '#D4D8DF',
    fontSize: 18,
    fontWeight: '400',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  sheetHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sheetHeaderCount: {
    fontFamily: condensedFont,
    color: '#D4D8DF',
    fontSize: 18,
    fontWeight: '400',
  },
  sheetHeaderPrice: {
    fontFamily: condensedFont,
    color: '#D4D8DF',
    fontSize: 18,
    fontWeight: '400',
    fontVariant: ['tabular-nums'],
  },
  sheetBody: {
    flex: 1,
    backgroundColor: SPORTS_PALETTE.background,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: Platform.OS === 'ios' ? 32 : 24,
    justifyContent: 'space-between',
  },
  subHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1A1D21',
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 14,
    marginBottom: 14,
  },
  subHeaderLeft: {
    fontFamily: condensedFont,
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  subHeaderRight: {
    fontFamily: condensedFont,
    color: '#D4D8DF',
    fontSize: 13.5,
    fontWeight: '400',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: '#1A1D21',
    borderRadius: 16,
    marginBottom: 14,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    fontFamily: condensedFont,
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontFamily: condensedFont,
    color: SPORTS_PALETTE.textMuted,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  emptyActionBtn: {
    backgroundColor: '#B2B6BC',
    borderRadius: 9999,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  emptyActionText: {
    fontFamily: condensedFont,
    color: '#000000',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  scrollList: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 16,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1D21',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 10,
  },
  itemTrack: {
    fontFamily: condensedFont,
    color: '#D4D8DF',
    fontSize: 16,
    fontWeight: '400',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  itemTitle: {
    fontFamily: condensedFont,
    color: '#C2C7D0',
    fontSize: 14,
    marginTop: 4,
    textTransform: 'uppercase',
  },
  itemSubtitle: {
    fontFamily: condensedFont,
    color: '#C2C7D0',
    fontSize: 13.5,
    marginTop: 4,
    fontVariant: ['tabular-nums'],
    textTransform: 'uppercase',
  },
  itemRightCol: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  itemTotal: {
    fontFamily: condensedFont,
    color: '#D4D8DF',
    fontSize: 16,
    fontWeight: '400',
    fontVariant: ['tabular-nums'],
  },
  footer: {
    backgroundColor: '#1A1D21',
    borderRadius: 18,
    padding: 16,
  },
  actionsCol: {
    gap: 12,
  },
  confirmBtn: {
    backgroundColor: '#B2B6BC',
    borderRadius: 9999,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnText: {
    fontFamily: condensedFont,
    color: '#000000',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  secondaryRow: {
    flexDirection: 'row',
    gap: 10,
  },
  secondaryBtn: {
    backgroundColor: '#14171A',
    borderWidth: 1,
    borderColor: '#6B7280',
    borderRadius: 9999,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: {
    fontFamily: condensedFont,
    color: '#E5E7EB',
    fontSize: 13,
    fontWeight: '400',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  removeButton: { minWidth: 48, minHeight: 48, padding: 8, justifyContent: 'center', alignItems: 'center' },
  srOnly: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
    overflow: 'hidden',
  },
});

export default demoOnly(CarrinhoScreen);
