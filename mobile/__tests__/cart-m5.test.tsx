import { cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';
import { Button, Text, View } from 'react-native';
import { AgendaScreen } from '../src/components/agenda-screen';
import { CartModal } from '../src/components/cart-modal';
import { FloatingCartBar } from '../src/components/floating-cart-bar';
import { CartProvider, useCart } from '../src/features/cart/context';
import { MOCK_AGENDA_SLOTS } from '../src/mock/kart-data';
import { CartItem, CartState } from '../src/types/racing';

afterEach(() => {
  cleanup();
});

// Test consumer helper for useCart hook
function CartTestConsumer() {
  const {
    items,
    totalQuantity,
    totalPriceFormatted,
    addItem,
    removeItem,
    clearCart,
  } = useCart();

  return (
    <View testID="cart-consumer">
      <Text testID="cart-qty">{totalQuantity}</Text>
      <Text testID="cart-price">{totalPriceFormatted}</Text>
      <Text testID="cart-items-count">{items.length}</Text>
      <Button
        testID="btn-add-test-item"
        title="Add"
        onPress={() =>
          addItem({
            sessionId: 'test-1',
            sessionTitle: 'Bateria Teste',
            trackName: 'Kartódromo de Betim',
            date: '14/10/2026',
            time: '14:00',
            quantity: 1,
            unitPriceCentavos: 11000,
          })
        }
      />
      <Button
        testID="btn-remove-test-item"
        title="Remove"
        onPress={() => removeItem('test-1')}
      />
      <Button testID="btn-clear-test" title="Clear" onPress={clearCart} />
    </View>
  );
}

describe('Milestone 5 — Cart & Agenda Component Suite', () => {
  describe('CartProvider & useCart Context', () => {
    it('manages cart items, recalculates quantities and prices accurately', async () => {
      const { getByTestId } = await render(
        <CartProvider>
          <CartTestConsumer />
        </CartProvider>
      );

      // 1. Initial State
      expect(getByTestId('cart-qty').props.children).toBe(0);
      expect(getByTestId('cart-price').props.children).toBe('R$ 0,00');
      expect(getByTestId('cart-items-count').props.children).toBe(0);

      // 2. Add Item
      fireEvent.press(getByTestId('btn-add-test-item'));
      await waitFor(() => {
        expect(getByTestId('cart-qty').props.children).toBe(1);
      });
      expect(getByTestId('cart-price').props.children).toBe('R$ 110,00');
      expect(getByTestId('cart-items-count').props.children).toBe(1);

      // 3. Add same item (increments quantity)
      fireEvent.press(getByTestId('btn-add-test-item'));
      await waitFor(() => {
        expect(getByTestId('cart-qty').props.children).toBe(2);
      });
      expect(getByTestId('cart-price').props.children).toBe('R$ 220,00');

      // 4. Remove item
      fireEvent.press(getByTestId('btn-remove-test-item'));
      await waitFor(() => {
        expect(getByTestId('cart-qty').props.children).toBe(0);
      });
      expect(getByTestId('cart-price').props.children).toBe('R$ 0,00');
    });
  });

  describe('FloatingCartBar', () => {
    it('returns null when cart is empty', async () => {
      const mockEmptyCart: CartState = {
        items: [],
        totalQuantity: 0,
        totalPriceCentavos: 0,
        totalPriceFormatted: 'R$ 0,00',
        isCartOpen: false,
        addItem: jest.fn(),
        removeItem: jest.fn(),
        updateQuantity: jest.fn(),
        clearCart: jest.fn(),
        openCart: jest.fn(),
        closeCart: jest.fn(),
      };

      const { queryByTestId } = await render(
        <FloatingCartBar cart={mockEmptyCart} />
      );
      expect(queryByTestId('floating-cart-bar')).toBeNull();
    });

    it('renders capsule bar with items and handles press', async () => {
      const onPress = jest.fn();
      const mockCart: CartState = {
        items: [
          {
            sessionId: 'slot-1',
            sessionTitle: 'BATERIA 11:00',
            trackName: 'KARTÓDROMO DE BETIM',
            date: '14/10/2026',
            time: '11:00',
            quantity: 2,
            unitPriceCentavos: 11000,
            totalPriceCentavos: 22000,
          },
        ],
        totalQuantity: 2,
        totalPriceCentavos: 22000,
        totalPriceFormatted: 'R$ 220,00',
        isCartOpen: false,
        addItem: jest.fn(),
        removeItem: jest.fn(),
        updateQuantity: jest.fn(),
        clearCart: jest.fn(),
        openCart: jest.fn(),
        closeCart: jest.fn(),
      };

      const { getByTestId, getByText } = await render(
        <FloatingCartBar cart={mockCart} onPress={onPress} />
      );

      const cartBar = getByTestId('floating-cart-bar');
      expect(cartBar).toBeTruthy();
      expect(getByText(/CARRINHO \| 2 ITENS/)).toBeTruthy();
      expect(getByText('R$ 220,00')).toBeTruthy();
      expect(getByText('VER PEDIDO ›')).toBeTruthy();

      fireEvent.press(cartBar);
      expect(onPress).toHaveBeenCalled();
    });
  });

  describe('CartModal', () => {
    const mockItem: CartItem = {
      sessionId: 'slot-1100',
      sessionTitle: 'BATERIA 11:00',
      trackName: 'KARTÓDROMO DE BETIM',
      date: '14/10/2026',
      time: '11:00',
      quantity: 1,
      unitPriceCentavos: 11000,
      totalPriceCentavos: 11000,
    };

    it('renders items list, handles removal and confirmation', async () => {
      const onClose = jest.fn();
      const onConfirm = jest.fn();
      const onRemove = jest.fn();
      const onClear = jest.fn();

      const mockCart: CartState = {
        items: [mockItem],
        totalQuantity: 1,
        totalPriceCentavos: 11000,
        totalPriceFormatted: 'R$ 110,00',
        isCartOpen: true,
        addItem: jest.fn(),
        removeItem: onRemove,
        updateQuantity: jest.fn(),
        clearCart: onClear,
        openCart: jest.fn(),
        closeCart: onClose,
      };

      const { getByTestId, getByText, getAllByText } = await render(
        <CartModal
          cart={mockCart}
          visible={true}
          onClose={onClose}
          onConfirmOrder={onConfirm}
        />
      );

      expect(getByTestId('cart-modal')).toBeTruthy();
      expect(getByTestId('cart-sheet')).toBeTruthy();
      expect(getByTestId('cart-item-slot-1100')).toBeTruthy();
      expect(getByText('BATERIA 11:00')).toBeTruthy();
      expect(getByTestId('cart-modal-total-price')).toBeTruthy();
      expect(getAllByText('R$ 110,00').length).toBeGreaterThanOrEqual(1);

      // Remove item
      const removeBtn = getByTestId('swipe-remove-item-slot-1100');
      expect(removeBtn).toHaveStyle({ minHeight: 48, minWidth: 48 });
      expect(getByTestId('close-cart-btn')).toHaveStyle({ minHeight: 48 });
      expect(getAllByText('KARTÓDROMO DE BETIM').length).toBeGreaterThan(0);
      fireEvent.press(removeBtn);
      await waitFor(() => {
        expect(onRemove).toHaveBeenCalledWith('slot-1100');
      });

      // Clear all
      const clearBtn = getByTestId('btn-clear-cart');
      fireEvent.press(clearBtn);
      await waitFor(() => {
        expect(onClear).toHaveBeenCalled();
      });

      // Confirm order
      const confirmBtn = getByTestId('btn-confirm-order');
      fireEvent.press(confirmBtn);
      await waitFor(() => {
        expect(onConfirm).toHaveBeenCalled();
      });

      // Close modal
      const closeBtn = getByTestId('close-cart-btn');
      fireEvent.press(closeBtn);
      await waitFor(() => {
        expect(onClose).toHaveBeenCalled();
      });
    });

    it('renders empty state when cart has no items', async () => {
      const mockEmptyCart: CartState = {
        items: [],
        totalQuantity: 0,
        totalPriceCentavos: 0,
        totalPriceFormatted: 'R$ 0,00',
        isCartOpen: true,
        addItem: jest.fn(),
        removeItem: jest.fn(),
        updateQuantity: jest.fn(),
        clearCart: jest.fn(),
        openCart: jest.fn(),
        closeCart: jest.fn(),
      };

      const { getByTestId, getByText } = await render(
        <CartModal cart={mockEmptyCart} visible={true} />
      );

      expect(getByTestId('cart-empty-state')).toBeTruthy();
      expect(getByText('Seu carrinho está vazio.')).toBeTruthy();
    });
  });

  describe('AgendaScreen', () => {
    it('filtra a data sem exibir vagas de outro dia', async () => {
      const first = { ...MOCK_AGENDA_SLOTS[0], id: 'first', title: 'BATERIA PRIMEIRO DIA' };
      const second = { ...first, id: 'second', title: 'BATERIA OUTRO DIA', date: '22/10/2026' };
      const view = await render(<AgendaScreen slots={[first, second]} />);
      expect(view.getByText(first.title)).toBeTruthy();
      expect(view.queryByText(second.title)).toBeNull();
      fireEvent.press(view.getByTestId('date-pill-22/10/2026'));
      await waitFor(() => {
        expect(view.getByText(second.title)).toBeTruthy();
        expect(view.queryByText(first.title)).toBeNull();
      });
    });

    it('renders date selector, battery slots, stepper and handles add to cart', async () => {
      const onAddToCart = jest.fn();

      const { getByTestId, getByText, queryByTestId } = await render(
        <CartProvider>
          <AgendaScreen onAddToCart={onAddToCart} slots={MOCK_AGENDA_SLOTS} />
        </CartProvider>
      );

      // 1. Root and Header
      expect(getByTestId('screen-agenda')).toBeTruthy();
      expect(getByTestId('agenda-selected-date')).toBeTruthy();
      expect(getByTestId('agenda-selected-date').props.children).toBe('14/10/2026');

      // 2. Slots list
      expect(getByTestId('agenda-slots-list')).toBeTruthy();
      expect(getByTestId('agenda-slot-card-agenda-slot-1100')).toBeTruthy();
      expect(getByTestId('slot-vagas-agenda-slot-1100')).toBeTruthy();
      expect(getByText('12 VAGAS')).toBeTruthy();

      // 3. Select slot to open detail stepper
      const selectBtn = getByTestId('btn-select-slot-agenda-slot-1100');
      fireEvent.press(selectBtn);

      await waitFor(() => {
        expect(getByTestId('slot-detail-modal')).toBeTruthy();
      });
      expect(getByTestId('slot-detail-sheet')).toBeTruthy();
      expect(getByTestId('slot-detail-title')).toBeTruthy();
      expect(getByTestId('slot-detail-price')).toBeTruthy();

      // 4. Quantity Stepper
      const stepperVal = getByTestId('stepper-value-text');
      expect(stepperVal.props.children).toBe(1);

      const incrementBtn = getByTestId('btn-stepper-increment');
      fireEvent.press(incrementBtn);
      await waitFor(() => {
        expect(getByTestId('stepper-value-text').props.children).toBe(2);
      });

      const decrementBtn = getByTestId('btn-stepper-decrement');
      fireEvent.press(decrementBtn);
      await waitFor(() => {
        expect(getByTestId('stepper-value-text').props.children).toBe(1);
      });

      // 5. Add to Cart action
      const addToCartBtn = getByTestId('btn-add-to-cart');
      fireEvent.press(addToCartBtn);

      expect(onAddToCart).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'agenda-slot-1100' }),
        1
      );

      // Modal closed
      await waitFor(() => {
        expect(queryByTestId('slot-detail-modal')).toBeNull();
      });

      // 6. Floating cart bar becomes visible with added item
      await waitFor(() => {
        expect(getByTestId('floating-cart-bar')).toBeTruthy();
      });
    });
  });
});
