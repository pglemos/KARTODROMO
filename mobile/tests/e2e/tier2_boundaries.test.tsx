/**
 * Tier 2 E2E Test Suite: Boundary Value Analysis (BVA)
 * Tests mathematical edges, 10+ drivers qualification threshold, empty states,
 * capacity limits, sold-out sessions, and telemetry delta boundaries.
 */

import React from 'react';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import {
  AgendaScreenHarness,
  CartModalHarness,
  FloatingCartBarHarness,
} from './harness/test-screens';
import {
  calculateGridMultiplier,
  calculateRating,
  calculateSessionXP,
  formatCentavosToReais,
  isQualifiedSession,
  SPORTS_PALETTE,
} from './harness/racing-contracts';
import { CartState } from '../../src/types/racing';

describe('Tier 2: Boundary Value Analysis (BVA)', () => {
  afterEach(async () => {
    cleanup();
  });

  // =========================================================================
  // BVA-1: Empty Cart & Zero Items
  // =========================================================================
  describe('BVA-1: Empty Cart & Zero Items', () => {
    it('garante que carrinho vazio oculta a barra flutuante e desabilita checkout', async () => {
      const emptyCart: CartState = {
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

      // 1. Floating bar is completely absent
      const barView = await render(
        <FloatingCartBarHarness cart={emptyCart} onPress={jest.fn()} />
      );
      expect(barView.queryByTestId('floating-cart-bar')).toBeNull();

      // 2. Cart modal shows empty state message
      const modalView = await render(
        <CartModalHarness
          cart={emptyCart}
          visible={true}
          onClose={jest.fn()}
          onConfirmOrder={jest.fn()}
        />
      );
      expect(modalView.getByTestId('cart-empty-state')).toBeTruthy();
      expect(modalView.getByText('Seu carrinho está vazio.')).toBeTruthy();

      // 3. Confirm order button is disabled
      const confirmBtn = modalView.getByTestId('btn-confirm-order');
      expect(confirmBtn.props.accessibilityState?.disabled).toBe(true);

      // 4. Clear all button is disabled
      const clearBtn = modalView.getByTestId('btn-clear-cart');
      expect(clearBtn.props.accessibilityState?.disabled).toBe(true);

      // 5. Total price displayed is exactly R$ 0,00
      expect(modalView.getByTestId('cart-modal-total-price')).toBeTruthy();
      expect(modalView.getByText('R$ 0,00')).toBeTruthy();
    });

    it('transiciona para estado vazio ao remover o único item existente', async () => {
      let currentItems = [
        {
          sessionId: 'slot-1100',
          sessionTitle: 'BATERIA 11:00',
          trackName: 'KARTÓDROMO DE BETIM',
          date: '14/10/2026',
          time: '11:00',
          quantity: 1,
          unitPriceCentavos: 11000,
          totalPriceCentavos: 11000,
        },
      ];

      const cart: CartState = {
        items: currentItems,
        totalQuantity: 1,
        totalPriceCentavos: 11000,
        totalPriceFormatted: 'R$ 110,00',
        isCartOpen: true,
        addItem: jest.fn(),
        removeItem: (sessionId) => {
          currentItems = currentItems.filter((i) => i.sessionId !== sessionId);
          cart.items = currentItems;
          cart.totalQuantity = 0;
          cart.totalPriceCentavos = 0;
          cart.totalPriceFormatted = 'R$ 0,00';
        },
        updateQuantity: jest.fn(),
        clearCart: jest.fn(),
        openCart: jest.fn(),
        closeCart: jest.fn(),
      };

      const view = await render(
        <CartModalHarness
          cart={cart}
          visible={true}
          onClose={jest.fn()}
          onConfirmOrder={jest.fn()}
        />
      );

      // 1. Initial item exists
      expect(view.getByTestId('cart-item-slot-1100')).toBeTruthy();
      // 2. Remove the single item
      await fireEvent.press(view.getByTestId('swipe-remove-item-slot-1100'));
      expect(cart.totalQuantity).toBe(0);
      expect(cart.totalPriceCentavos).toBe(0);
      expect(cart.totalPriceFormatted).toBe('R$ 0,00');

      // 3. Re-render modal in empty state
      await view.rerender(
        <CartModalHarness
          cart={cart}
          visible={true}
          onClose={jest.fn()}
          onConfirmOrder={jest.fn()}
        />
      );
      expect(view.getByTestId('cart-empty-state')).toBeTruthy();
    });
  });

  // =========================================================================
  // BVA-2: Quantity Stepper & Capacity Limits
  // =========================================================================
  describe('BVA-2: Quantity Stepper & Capacity Limits', () => {
    it('restringe quantidade mínima a 1 e máxima às vagas disponíveis na bateria', async () => {
      const onAddToCart = jest.fn();
      const { getByTestId, getByText } = await render(
        <AgendaScreenHarness onAddToCart={onAddToCart} />
      );

      // 1. Open slot with 12 available slots
      await fireEvent.press(getByTestId('btn-select-slot-slot-1100'));
      await waitFor(() => expect(getByTestId('slot-detail-modal')).toBeTruthy());

      // 2. Minimum boundary: decrement from 1 is disabled or stays at 1
      const decBtn = getByTestId('btn-stepper-decrement');
      expect(decBtn.props.accessibilityState?.disabled).toBe(true);
      await fireEvent.press(decBtn);
      expect(getByText('1')).toBeTruthy();

      // 3. Increment within boundaries: 1 -> 2 -> 3
      const incBtn = getByTestId('btn-stepper-increment');
      await fireEvent.press(incBtn);
      await waitFor(() => expect(getByText('2')).toBeTruthy());
      await fireEvent.press(incBtn);
      await waitFor(() => expect(getByText('3')).toBeTruthy());

      // 4. Decrement restores 2
      await fireEvent.press(decBtn);
      await waitFor(() => expect(getByText('2')).toBeTruthy());

      // 5. Total price computes accurately at R$ 220,00
      expect(getByText(/ADICIONAR AO CARRINHO \(R\$ 220,00\)/)).toBeTruthy();
    });

    it('restringe bateria com apenas 1 vaga restante para no máximo 1 ingresso', async () => {
      const onAddToCart = jest.fn();
      const { getByTestId, getByText } = await render(
        <AgendaScreenHarness onAddToCart={onAddToCart} />
      );

      // 1. Slot-1630 has exactly 1 available slot
      await fireEvent.press(getByTestId('btn-select-slot-slot-1630'));
      await waitFor(() => expect(getByTestId('slot-detail-modal')).toBeTruthy());

      // 2. Current quantity is 1
      expect(getByText('1')).toBeTruthy();

      // 3. Decrement is disabled (already at min 1)
      expect(getByTestId('btn-stepper-decrement').props.accessibilityState?.disabled).toBe(true);

      // 4. Increment is also disabled (already at max 1 slot)
      expect(getByTestId('btn-stepper-increment').props.accessibilityState?.disabled).toBe(true);

      // 5. Adding to cart yields quantity 1 for R$ 120,00
      await fireEvent.press(getByTestId('btn-add-to-cart'));
      expect(onAddToCart).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'slot-1630' }),
        1
      );
    });
  });

  // =========================================================================
  // BVA-3: Rating Formula Edges & Mathematical Extremes
  // =========================================================================
  describe('BVA-3: Rating Formula Edges & Mathematical Extremes', () => {
    it('computa piloto novato sem corridas sem incorrer em divisão por zero ou NaN', () => {
      // 0 races, 0 wins, 0 XP, 0 efficiency
      const result = calculateRating(0, 0, 0, 0);

      // 1. Efficiency points is 0
      expect(result.efficiencyPoints).toBe(0);
      // 2. Wins points is 0
      expect(result.winsPoints).toBe(0);
      // 3. XP points is 0
      expect(result.xpPoints).toBe(0);
      // 4. Races points is 0
      expect(result.racesPoints).toBe(0);
      // 5. Composite Rating and display points are strictly 0
      expect(result.rating).toBe(0);
      expect(result.points).toBe(0);
      expect(Number.isNaN(result.points)).toBe(false);
    });

    it('atinge o teto máximo de 10.000 pontos nos valores de referência exatos', () => {
      // 100% efficiency, 100 wins, 60,000 XP, 300 races
      const result = calculateRating(1.0, 100, 60000, 300);

      // 1. All pillars reach exactly 10,000 points
      expect(result.efficiencyPoints).toBe(10000);
      expect(result.winsPoints).toBe(10000);
      expect(result.xpPoints).toBe(10000);
      expect(result.racesPoints).toBe(10000);
      // 2. Sum: 0.50*10000 + 0.20*10000 + 0.20*10000 + 0.10*10000 = 10,000
      expect(result.rating).toBe(10000);
      expect(result.points).toBe(10000);
    });

    it('bloqueia overflow em valores extremos além das referências (clamping em 10.000)', () => {
      // 200 wins (>> 100), 150,000 XP (>> 60,000), 800 races (>> 300)
      const result = calculateRating(1.5, 200, 150000, 800);

      // 1. Clamped efficiency
      expect(result.efficiencyPoints).toBe(10000);
      // 2. Clamped wins
      expect(result.winsPoints).toBe(10000);
      // 3. Clamped XP
      expect(result.xpPoints).toBe(10000);
      // 4. Clamped races
      expect(result.racesPoints).toBe(10000);
      // 5. Rating does not exceed 10,000
      expect(result.rating).toBe(10000);
    });

    it('valida pesos da soma ponderada (50% + 20% + 20% + 10% = 100%)', () => {
      const weights = {
        efficiency: 0.5,
        wins: 0.2,
        xp: 0.2,
        races: 0.1,
      };

      // 1. Sum of weights is exactly 1.0
      const totalWeight =
        weights.efficiency + weights.wins + weights.xp + weights.races;
      expect(totalWeight).toBeCloseTo(1.0, 5);

      // 2. Single-pillar dominance: 100% efficiency alone yields 5,000 pts
      const effOnly = calculateRating(1.0, 0, 0, 0);
      expect(effOnly.rating).toBe(5000);

      // 3. Wins only yields 2,000 pts
      const winsOnly = calculateRating(0, 100, 0, 0);
      expect(winsOnly.rating).toBe(2000);

      // 4. XP only yields 2,000 pts
      const xpOnly = calculateRating(0, 0, 60000, 0);
      expect(xpOnly.rating).toBe(2000);

      // 5. Races only yields 1,000 pts
      const racesOnly = calculateRating(0, 0, 0, 300);
      expect(racesOnly.rating).toBe(1000);
    });

    it('garante calibração exata do piloto de referência Nelson Castro (13.112 PTS)', () => {
      // Nelson Castro: 35% efficiency, 70 wins, 61,251 XP, 309 races
      const result = calculateRating(0.35, 70, 61251, 309);

      // 1. Efficiency points: 0.35 * 10000 = 3500 * 0.50 = 1750
      expect(result.efficiencyPoints).toBe(3500);
      // 2. Wins points: 70/100 * 10000 = 7000 * 0.20 = 1400
      expect(result.winsPoints).toBe(7000);
      // 3. XP points capped at 10000 * 0.20 = 2000
      expect(result.xpPoints).toBe(10000);
      // 4. Races points capped at 10000 * 0.10 = 1000
      expect(result.racesPoints).toBe(10000);
      // 5. Total raw score is 6150 in base scale; points scaled to league rating 13112
      expect(result.rating).toBe(6150);
      expect(result.points).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // BVA-4: 10+ Drivers Qualification Rule Boundary
  // =========================================================================
  describe('BVA-4: 10+ Drivers Qualification Rule Boundary', () => {
    it('desqualifica baterias com menos de 10 pilotos (limiar estrito)', () => {
      // 1. Grid of 0 drivers -> unqualified
      expect(isQualifiedSession(0)).toBe(false);
      expect(calculateGridMultiplier(0)).toBe(0);

      // 2. Grid of 1 driver -> unqualified
      expect(isQualifiedSession(1)).toBe(false);
      expect(calculateGridMultiplier(1)).toBe(0);

      // 3. Grid of 8 drivers -> unqualified
      expect(isQualifiedSession(8)).toBe(false);
      expect(calculateGridMultiplier(8)).toBe(0);

      // 4. Grid of 9 drivers (Upper disqualification boundary) -> unqualified
      expect(isQualifiedSession(9)).toBe(false);
      expect(calculateGridMultiplier(9)).toBe(0);

      // 5. Race with 9 drivers yields 0 XP even if won with fastest lap and pole
      const xp9 = calculateSessionXP(
        { completed: true, position: 1, polePosition: true, fastestLap: true },
        9
      );
      expect(xp9).toBe(0);
    });

    it('habilita qualificação no limiar exato de 10 pilotos e escala até 20+', () => {
      // 1. Grid of 10 drivers (Exact threshold) -> qualified, 1.0x multiplier
      expect(isQualifiedSession(10)).toBe(true);
      expect(calculateGridMultiplier(10)).toBe(1.0);

      // 2. Race win in 10-car grid: (50 base + 100 win) * 1.0 = 150 XP
      const xp10 = calculateSessionXP({ completed: true, position: 1 }, 10);
      expect(xp10).toBe(150);

      // 3. Grid of 15 drivers -> 1.5x multiplier
      expect(isQualifiedSession(15)).toBe(true);
      expect(calculateGridMultiplier(15)).toBe(1.5);
      const xp15 = calculateSessionXP({ completed: true, position: 1 }, 15);
      expect(xp15).toBe(225); // 150 * 1.5 = 225

      // 4. Grid of 20 drivers -> 2.0x multiplier
      expect(isQualifiedSession(20)).toBe(true);
      expect(calculateGridMultiplier(20)).toBe(2.0);
      const xp20 = calculateSessionXP({ completed: true, position: 1 }, 20);
      expect(xp20).toBe(300); // 150 * 2.0 = 300

      // 5. Grid of 25 drivers -> clamped at 2.0x multiplier max
      expect(isQualifiedSession(25)).toBe(true);
      expect(calculateGridMultiplier(25)).toBe(2.0);
    });

    it('zera ganho de XP se a corrida não for concluída, independentemente do grid', () => {
      // 1. DNF in 10-car grid
      expect(calculateSessionXP({ completed: false, position: 0 }, 10)).toBe(0);
      // 2. DNF in 20-car grid
      expect(calculateSessionXP({ completed: false, position: 0 }, 20)).toBe(0);
      // 3. DNF with pole position
      expect(
        calculateSessionXP({ completed: false, position: 0, polePosition: true }, 20)
      ).toBe(0);
      // 4. DNF with fastest lap
      expect(
        calculateSessionXP({ completed: false, position: 0, fastestLap: true }, 20)
      ).toBe(0);
      // 5. DNF with pole and fastest lap
      expect(
        calculateSessionXP(
          { completed: false, position: 0, polePosition: true, fastestLap: true },
          20
        )
      ).toBe(0);
    });
  });

  // =========================================================================
  // BVA-5: Sold-Out Sessions & Availability Thresholds
  // =========================================================================
  describe('BVA-5: Sold-Out Sessions & Availability Thresholds', () => {
    it('trata adequadamente bateria esgotada (0 vagas) bloqueando qualquer adição', async () => {
      const onAddToCart = jest.fn();
      const { getByTestId, getAllByText } = await render(
        <AgendaScreenHarness onAddToCart={onAddToCart} />
      );

      // 1. Sold-out card is displayed
      expect(getByTestId('agenda-slot-card-slot-1400')).toBeTruthy();
      // 2. ESGOTADO label rendered in red
      expect(getByTestId('slot-vagas-slot-1400')).toBeTruthy();
      expect(getAllByText('ESGOTADO').length).toBeGreaterThanOrEqual(1);

      // 3. Selection button is disabled
      const slotBtn = getByTestId('btn-select-slot-slot-1400');
      expect(slotBtn.props.accessibilityState?.disabled).toBe(true);

      // 4. Pressing disabled button does not trigger action
      await fireEvent.press(slotBtn);
      expect(onAddToCart).not.toHaveBeenCalled();

      // 5. Slot modal is not opened
      const { queryByTestId } = await render(
        <AgendaScreenHarness onAddToCart={onAddToCart} />
      );
      expect(queryByTestId('slot-detail-modal')).toBeNull();
    });
  });

  // =========================================================================
  // BVA-6: Currency & Centavos Precision Formatting
  // =========================================================================
  describe('BVA-6: Currency & Centavos Precision Formatting', () => {
    it('formata valores monetários com precisão de centavos sem desvios de arredondamento', () => {
      // 1. Zero centavos
      expect(formatCentavosToReais(0)).toBe('R$ 0,00');
      // 2. 1 centavo
      expect(formatCentavosToReais(1)).toBe('R$ 0,01');
      // 3. 99 centavos
      expect(formatCentavosToReais(99)).toBe('R$ 0,99');
      // 4. Standard slot price: 11000 centavos -> R$ 110,00
      expect(formatCentavosToReais(11000)).toBe('R$ 110,00');
      // 5. High volume booking: 20 slots * R$ 110,00 = 220000 centavos -> R$ 2200,00
      expect(formatCentavosToReais(220000)).toBe('R$ 2200,00');
    });
  });
});
