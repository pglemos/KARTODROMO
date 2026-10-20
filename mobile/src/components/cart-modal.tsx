import React from 'react';
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useCartSafe } from '../features/cart/context';
import { CartState } from '../types/racing';
import { SportsIcon } from './sports-icons';
import { SPORTS_PALETTE } from './theme';

export interface CartModalProps {
  cart?: CartState;
  visible?: boolean;
  onClose?: () => void;
  onConfirmOrder?: () => void;
}

const condensedFont = Platform.select({
  android: 'sans-serif-condensed',
  ios: 'System',
  default: 'sans-serif-condensed',
});

export function CartModal({
  cart: customCart,
  visible: customVisible,
  onClose: customOnClose,
  onConfirmOrder: customOnConfirmOrder,
}: CartModalProps) {
  const hookCart = useCartSafe();
  const activeCart = customCart || hookCart;

  const isVisible =
    customVisible !== undefined
      ? customVisible
      : activeCart?.isCartOpen ?? false;

  const handleClose = () => {
    if (customOnClose) {
      customOnClose();
    } else if (activeCart?.closeCart) {
      activeCart.closeCart();
    }
  };

  const handleConfirm = () => {
    if (customOnConfirmOrder) {
      customOnConfirmOrder();
    } else {
      Alert.alert('Pedido não enviado', 'O carrinho é uma prévia. Para reservar de verdade, escolha um horário disponível na agenda.');
    }
  };

  if (!activeCart) {
    return null;
  }

  const { items, totalQuantity, totalPriceFormatted, removeItem, clearCart } =
    activeCart;

  const formatPrice = (centavos: number) => {
    const reais = Math.max(0, centavos) / 100;
    return `R$ ${reais.toFixed(2).replace('.', ',')}`;
  };

  return (
    <Modal
      testID="cart-modal"
      visible={isVisible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={styles.modalOverlay}>
        <View testID="cart-sheet" style={styles.modalCard}>
          {/* 1. Top Dark Header Bar (Matches IMG_3796.PNG) */}
          <View style={styles.modalHeader}>
            <View style={styles.headerLeftRow}>
              <SportsIcon name="cart" size={22} color="#D4D8DF" />
              <Text style={styles.modalTitle}>CARRINHO</Text>
            </View>

            <View style={styles.headerRightRow}>
              <Text style={styles.headerItemsCountText}>
                {totalQuantity} ITENS -{' '}
              </Text>
              <Text
                testID="cart-modal-total-price"
                style={styles.headerSummaryText}
              >
                {totalPriceFormatted}
              </Text>
              <Pressable
                testID="close-cart-btn"
                accessibilityRole="button"
                accessibilityLabel="Fechar carrinho"
                onPress={handleClose}
                style={styles.removeButton}
              >
                <Text style={{ color: '#FFFFFF' }}>✕</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.sheetBody}>
            {/* 2. Subheader Hint Pill (ITENS | TOQUE EM REMOVER) */}
            <View style={styles.hintBar}>
              <Text style={styles.hintLeftText}>ITENS</Text>
              <Text style={styles.hintRightText}>TOQUE EM REMOVER</Text>
            </View>

            {/* 3. Items List or Empty State */}
            {items.length === 0 ? (
              <View testID="cart-empty-state" style={styles.emptyCartBox}>
                <Text style={styles.emptyCartIcon}>🏎️</Text>
                <Text style={styles.emptyCartTitle}>
                  Seu carrinho está vazio.
                </Text>
                <Text style={styles.emptyCartSubtitle}>
                  Escolha uma bateria na agenda ou no kartódromo para reservar
                  seu lugar na pista!
                </Text>
              </View>
            ) : (
              <ScrollView
                testID="cart-items-list"
                style={styles.cartItemsList}
                contentContainerStyle={{ paddingBottom: 16 }}
                showsVerticalScrollIndicator={false}
              >
                {items.map((item) => (
                  <View
                    key={String(item.sessionId)}
                    testID={`cart-item-${item.sessionId}`}
                    style={styles.cartItemCard}
                  >
                    <View style={{ flex: 1, paddingRight: 10 }}>
                      <Text style={styles.itemTrackName}>
                        {item.trackName}
                      </Text>
                      <Text style={styles.srOnly}>{item.trackName}</Text>
                      <Text style={styles.itemTitle}>{item.sessionTitle}</Text>
                      <Text style={styles.itemDateText}>
                        {item.date} - {item.time}
                      </Text>
                    </View>

                    <View style={styles.itemRightCol}>
                      <Text style={styles.itemTotalPrice}>
                        {formatPrice(item.totalPriceCentavos)}
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

            {/* 4. Bottom Action Card (Matches IMG_3796.PNG) */}
            <View style={styles.bottomActionsCard}>
              <Pressable
                testID="btn-confirm-order"
                accessibilityRole="button"
                disabled={totalQuantity === 0}
                onPress={handleConfirm}
                style={[
                  styles.confirmSilverBtn,
                  totalQuantity === 0 && styles.disabledBtn,
                ]}
              >
                <Text style={styles.confirmSilverBtnText}>
                  {totalQuantity === 0 ? 'CARRINHO VAZIO' : 'CONFIRMAR PEDIDO'}
                </Text>
              </Pressable>

              <View style={styles.secondaryActionsRow}>
                <Pressable
                  testID="btn-clear-cart"
                  accessibilityRole="button"
                  disabled={totalQuantity === 0}
                  onPress={clearCart}
                  style={[
                    styles.secondaryOutlinePill,
                    { flex: 1 },
                    totalQuantity === 0 && styles.disabledSecondaryBtn,
                  ]}
                >
                  <Text style={styles.secondaryOutlineText}>REMOVER TODOS</Text>
                </Pressable>

                <Pressable
                  testID="btn-continue-shopping"
                  accessibilityRole="button"
                  onPress={handleClose}
                  style={[styles.secondaryOutlinePill, { flex: 1 }]}
                >
                  <Text style={styles.secondaryOutlineText}>
                    CONTINUAR COMPRANDO
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(200, 200, 200, 0.65)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: SPORTS_PALETTE.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
    minHeight: '68%',
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1A1D21',
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  headerLeftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  modalTitle: {
    fontFamily: condensedFont,
    color: '#D4D8DF',
    fontSize: 18,
    fontWeight: '400',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  headerRightRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerItemsCountText: {
    fontFamily: condensedFont,
    color: '#D4D8DF',
    fontSize: 18,
    fontWeight: '400',
  },
  headerSummaryText: {
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
    paddingBottom: Platform.OS === 'ios' ? 110 : 100,
    justifyContent: 'space-between',
  },
  hintBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1A1D21',
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 14,
    marginBottom: 14,
  },
  hintLeftText: {
    fontFamily: condensedFont,
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  hintRightText: {
    fontFamily: condensedFont,
    color: '#D4D8DF',
    fontSize: 13.5,
    fontWeight: '400',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  emptyCartBox: {
    paddingVertical: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1A1D21',
    borderRadius: 14,
    marginBottom: 14,
  },
  emptyCartIcon: {
    fontSize: 40,
    marginBottom: 10,
  },
  emptyCartTitle: {
    fontFamily: condensedFont,
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  emptyCartSubtitle: {
    fontFamily: condensedFont,
    color: SPORTS_PALETTE.textMuted,
    fontSize: 12,
    textAlign: 'center',
    paddingHorizontal: 20,
    lineHeight: 17,
  },
  cartItemsList: {
    flex: 1,
    marginBottom: 14,
  },
  cartItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1D21',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 10,
  },
  itemTrackName: {
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
  itemDateText: {
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
  itemTotalPrice: {
    fontFamily: condensedFont,
    color: '#D4D8DF',
    fontSize: 16,
    fontWeight: '400',
    fontVariant: ['tabular-nums'],
  },
  bottomActionsCard: {
    backgroundColor: '#1A1D21',
    borderRadius: 18,
    padding: 16,
    gap: 12,
  },
  confirmSilverBtn: {
    backgroundColor: '#B2B6BC',
    borderRadius: 9999,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmSilverBtnText: {
    fontFamily: condensedFont,
    color: '#000000',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  disabledBtn: {
    backgroundColor: '#373A40',
    opacity: 0.6,
  },
  secondaryActionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  secondaryOutlinePill: {
    backgroundColor: '#14171A',
    borderWidth: 1,
    borderColor: '#6B7280',
    borderRadius: 9999,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledSecondaryBtn: {
    opacity: 0.4,
  },
  secondaryOutlineText: {
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

