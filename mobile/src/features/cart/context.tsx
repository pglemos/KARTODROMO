import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { useSessionSafe } from '../../session/provider';
import { AgendaSlot, CartItem, CartState } from '../../types/racing';

export function formatCentavosToReais(centavos: number): string {
  const safe = Number.isSafeInteger(centavos) ? Math.max(0, centavos) : 0;
  const reais = safe / 100;
  return `R$ ${reais.toFixed(2).replace('.', ',')}`;
}

const CartContext = createContext<CartState | null>(null);

export interface CartProviderProps {
  children: React.ReactNode;
  initialItems?: CartItem[];
}

export function CartProvider({ children, initialItems = [] }: CartProviderProps) {
  const [items, setItems] = useState<CartItem[]>(initialItems);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const { session } = useSessionSafe();
  const [owner, setOwner] = useState(session);
  // shortcut: a renovação de tokens também limpa o carrinho; usar accountId quando existir.
  if (owner !== session) {
    setOwner(session);
    setItems([]);
    setIsCartOpen(false);
  }

  const addItem = useCallback(
    (itemOrSlot: Omit<CartItem, 'totalPriceCentavos'> | AgendaSlot, quantityParam?: number) => {
      const slot = 'availableSlots' in itemOrSlot ? itemOrSlot : null;
      const item: Omit<CartItem, 'totalPriceCentavos'> = slot ? {
        sessionId: slot.id, sessionTitle: slot.title, trackName: 'KARTÓDROMO DE BETIM',
        date: slot.date, time: slot.time, quantity: quantityParam ?? 1,
        unitPriceCentavos: slot.priceCentavos,
        maxQuantity: Math.min(slot.availableSlots, slot.maxSlots),
      } : itemOrSlot as Omit<CartItem, 'totalPriceCentavos'>;
      if (!Number.isSafeInteger(item.quantity) || item.quantity < 1 ||
          !Number.isSafeInteger(item.unitPriceCentavos) || item.unitPriceCentavos < 0) return;
      setItems((prev) => {
        const existing = prev.find((value) => String(value.sessionId) === String(item.sessionId));
        const quantity = (existing?.quantity ?? 0) + item.quantity;
        const maxQuantity = item.maxQuantity ?? existing?.maxQuantity;
        const totalPriceCentavos = item.unitPriceCentavos * quantity;
        if (!Number.isSafeInteger(quantity) || !Number.isSafeInteger(totalPriceCentavos) ||
            (maxQuantity !== undefined && (!Number.isSafeInteger(maxQuantity) || quantity > maxQuantity))) return prev;
        const updated = { ...item, maxQuantity, quantity, totalPriceCentavos };
        const next = existing
          ? prev.map((value) => value === existing ? updated : value)
          : [...prev, updated];
        return Number.isSafeInteger(next.reduce((sum, value) => sum + value.totalPriceCentavos, 0)) ? next : prev;
      });
    },
    []
  );

  const removeItem = useCallback((sessionId: number | string) => {
    setItems((prev) => prev.filter((i) => String(i.sessionId) !== String(sessionId)));
  }, []);

  const updateQuantity = useCallback((sessionId: number | string, quantity: number) => {
    if (!Number.isSafeInteger(quantity)) return;
    setItems((prev) => {
      if (quantity <= 0) {
        return prev.filter((i) => String(i.sessionId) !== String(sessionId));
      }
      const current = prev.find((item) => String(item.sessionId) === String(sessionId));
      if (!current || (current.maxQuantity !== undefined && quantity > current.maxQuantity) ||
          !Number.isSafeInteger(current.unitPriceCentavos * quantity)) return prev;
      const next = prev.map((item) => {
        if (String(item.sessionId) === String(sessionId)) {
          return {
            ...item,
            quantity,
            totalPriceCentavos: item.unitPriceCentavos * quantity,
          };
        }
        return item;
      });
      return Number.isSafeInteger(next.reduce((sum, item) => sum + item.totalPriceCentavos, 0)) ? next : prev;
    });
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  const openCart = useCallback(() => {
    setIsCartOpen(true);
  }, []);

  const closeCart = useCallback(() => {
    setIsCartOpen(false);
  }, []);

  const totalQuantity = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity, 0),
    [items]
  );

  const totalPriceCentavos = useMemo(
    () => items.reduce((sum, item) => sum + item.totalPriceCentavos, 0),
    [items]
  );

  const totalPriceFormatted = useMemo(
    () => formatCentavosToReais(totalPriceCentavos),
    [totalPriceCentavos]
  );

  const contextValue: CartState = useMemo(
    () => ({
      items,
      totalQuantity,
      totalPriceCentavos,
      totalPriceFormatted,
      isCartOpen,
      addItem,
      removeItem,
      updateQuantity,
      clearCart,
      openCart,
      closeCart,
    }),
    [
      items,
      totalQuantity,
      totalPriceCentavos,
      totalPriceFormatted,
      isCartOpen,
      addItem,
      removeItem,
      updateQuantity,
      clearCart,
      openCart,
      closeCart,
    ]
  );

  return <CartContext.Provider value={contextValue}>{children}</CartContext.Provider>;
}

export function useCartSafe(): CartState | null {
  return useContext(CartContext);
}

export function useCart(): CartState {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
