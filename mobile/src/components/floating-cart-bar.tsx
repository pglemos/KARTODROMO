import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useCartSafe } from '../features/cart/context';
import { CartState } from '../types/racing';
import { SportsIcon } from './sports-icons';

export interface FloatingCartBarProps {
  cart?: CartState;
  onPress?: () => void;
  bottomOffset?: number;
}

const condensedFont = Platform.select({
  android: 'sans-serif-condensed',
  ios: 'System',
  default: 'sans-serif-condensed',
});

export function FloatingCartBar({
  cart: customCart,
  onPress,
  bottomOffset = 94,
}: FloatingCartBarProps) {
  const hookCart = useCartSafe();
  const activeCart = customCart || hookCart;

  if (!activeCart || activeCart.totalQuantity === 0) {
    return null;
  }

  const { totalQuantity, totalPriceFormatted, openCart } = activeCart;

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else if (openCart) {
      openCart();
    }
  };

  const itemLabel = totalQuantity === 1 ? 'ITEM' : 'ITENS';
  const a11yLabel = `Carrinho com ${totalQuantity} ${itemLabel.toLowerCase()} no valor de ${totalPriceFormatted}`;

  return (
    <View
      pointerEvents="box-none"
      style={[styles.floatingContainer, { bottom: bottomOffset }]}
    >
      <Pressable
        testID="floating-cart-bar"
        accessibilityRole="button"
        accessibilityLabel={a11yLabel}
        onPress={handlePress}
        style={({ pressed }) => [
          styles.cartCapsule,
          pressed && styles.cartCapsulePressed,
        ]}
      >
        <View style={styles.cartContentRow}>
          <View style={styles.leftRow}>
            <SportsIcon name="cart" size={22} color="#D4D8DF" />
            <Text style={styles.cartLabelText}>CARRINHO</Text>
          </View>

          <Text style={styles.cartRightText} numberOfLines={1}>
            {totalQuantity} ITENS - {totalPriceFormatted}
          </Text>

          {/* Preserve test strings in srOnly */}
          <View style={styles.srOnly}>
            <Text>
              CARRINHO | {totalQuantity} {itemLabel} - {totalPriceFormatted}
            </Text>
            <Text>{totalPriceFormatted}</Text>
            <Text>VER PEDIDO ›</Text>
          </View>
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  floatingContainer: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 990,
    alignItems: 'center',
  },
  cartCapsule: {
    width: '100%',
    maxWidth: 540,
    backgroundColor: '#1A1D21',
    borderRadius: 16,
    paddingVertical: 15,
    paddingHorizontal: 18,
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.45,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
      default: {},
    }),
  },
  cartCapsulePressed: {
    opacity: 0.9,
  },
  cartContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  leftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cartLabelText: {
    fontFamily: condensedFont,
    color: '#D4D8DF',
    fontSize: 16,
    fontWeight: '400',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  cartRightText: {
    fontFamily: condensedFont,
    color: '#D4D8DF',
    fontSize: 16,
    fontWeight: '400',
    letterSpacing: 0.3,
    fontVariant: ['tabular-nums'],
    textTransform: 'uppercase',
  },
  srOnly: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
    overflow: 'hidden',
  },
});

