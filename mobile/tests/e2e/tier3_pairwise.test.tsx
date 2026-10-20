/**
 * Tier 2 & 3 E2E Test Suite: Pairwise Combinations & Cross-Feature Integration
 * Tests multi-tab transitions, cart persistence across tabs, category filter + text search,
 * Cockpit HUD landscape activation, news reading transitions, and slot booking.
 */

import React from 'react';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import {
  E2EAppShellHarness,
  RankingScreenHarness,
} from './harness/test-screens';
import { SPORTS_PALETTE } from './harness/racing-contracts';

describe('Tier 3: Pairwise Combinations & Cross-Feature Transitions', () => {
  afterEach(async () => {
    cleanup();
  });

  // =========================================================================
  // Pairwise 1: Multi-Tab Navigation & Global Cart Persistence
  // =========================================================================
  describe('Pairwise 1: Multi-Tab Navigation & Global Cart Persistence', () => {
    it('persiste itens e total monetário do carrinho flutuante ao navegar entre todas as 5 abas', async () => {
      const { getByTestId, getByText } = await render(<E2EAppShellHarness />);

      // 1. Initial tab is Home
      expect(getByTestId('screen-home')).toBeTruthy();

      // 2. Navigate to Agenda tab
      await fireEvent.press(getByTestId('tab-agenda'));
      await waitFor(() => expect(getByTestId('screen-agenda')).toBeTruthy());

      // 3. Select session and add 2 tickets (R$ 220,00)
      await fireEvent.press(getByTestId('btn-select-slot-slot-1100'));
      await waitFor(() => expect(getByTestId('slot-detail-modal')).toBeTruthy());
      await fireEvent.press(getByTestId('btn-stepper-increment'));
      await waitFor(() => expect(getByText('2')).toBeTruthy());
      await fireEvent.press(getByTestId('btn-add-to-cart'));

      // 4. Floating cart bar appears with 2 items
      await waitFor(() => expect(getByTestId('floating-cart-bar')).toBeTruthy());
      expect(getByText(/🛒 CARRINHO \| 2 ITENS - R\$ 220,00/)).toBeTruthy();

      // 5. Navigate to 'Parceiros' -> cart bar persists
      await fireEvent.press(getByTestId('tab-parceiros'));
      await waitFor(() => expect(getByTestId('screen-parceiro')).toBeTruthy());
      expect(getByTestId('floating-cart-bar')).toBeTruthy();
      expect(getByText(/🛒 CARRINHO \| 2 ITENS - R\$ 220,00/)).toBeTruthy();

      // 6. Navigate to 'LiveTime' -> cart bar persists
      await fireEvent.press(getByTestId('tab-livetime'));
      await waitFor(() => expect(getByTestId('screen-livetime')).toBeTruthy());
      expect(getByTestId('floating-cart-bar')).toBeTruthy();
      expect(getByText(/🛒 CARRINHO \| 2 ITENS - R\$ 220,00/)).toBeTruthy();

      // 7. Navigate to 'Carreira' -> cart bar persists
      await fireEvent.press(getByTestId('tab-carreira'));
      await waitFor(() => expect(getByTestId('screen-carreira')).toBeTruthy());
      expect(getByTestId('floating-cart-bar')).toBeTruthy();
      expect(getByText(/🛒 CARRINHO \| 2 ITENS - R\$ 220,00/)).toBeTruthy();

      // 8. Return to 'Home' -> cart bar persists
      await fireEvent.press(getByTestId('tab-home'));
      await waitFor(() => expect(getByTestId('screen-home')).toBeTruthy());
      expect(getByTestId('floating-cart-bar')).toBeTruthy();
      expect(getByText(/🛒 CARRINHO \| 2 ITENS - R\$ 220,00/)).toBeTruthy();
    });
  });

  // =========================================================================
  // Pairwise 2: Category Filter + Search Query in Ranking
  // =========================================================================
  describe('Pairwise 2: Category Filter + Search Query in Ranking', () => {
    it('combina filtro de categoria e busca textual com interseção determinística', async () => {
      const { getByPlaceholderText, getByTestId, queryByText, getByText } = await render(
        <RankingScreenHarness onClose={jest.fn()} onOpenRules={jest.fn()} />
      );

      const searchInput = getByPlaceholderText('Buscar piloto por nome...');

      // Combination A: Category LENDA + Query "Nelson" -> 1 match
      await fireEvent.press(getByTestId('ranking-filter-lenda'));
      await fireEvent.changeText(searchInput, 'Nelson');
      await waitFor(() => expect(getByText('Nelson Castro')).toBeTruthy());
      expect(queryByText('Tiago Santos')).toBeNull();
      expect(queryByText('Gerson Barros')).toBeNull();

      // Combination B: Category LENDA + Query "Tiago" (Tiago is PROFISSIONAL) -> 0 matches
      await fireEvent.changeText(searchInput, 'Tiago');
      await waitFor(() => expect(queryByText('Nelson Castro')).toBeNull());
      expect(queryByText('Tiago Santos')).toBeNull();
      expect(getByText('Nenhum piloto encontrado.')).toBeTruthy();

      // Combination C: Category PROFISSIONAL + Query "Tiago" -> 1 match
      await fireEvent.press(getByTestId('ranking-filter-profissional'));
      await waitFor(() => expect(getByText('Tiago Santos')).toBeTruthy());

      // Combination D: Category TODOS + Query "Barros" -> 2 matches (Gerson and Guilherme)
      await fireEvent.press(getByTestId('ranking-filter-todos'));
      await fireEvent.changeText(searchInput, 'Barros');
      await waitFor(() =>
        expect(getByText('Gerson Barros Neto dos Anjos')).toBeTruthy()
      );
      expect(getByText('Guilherme Barros')).toBeTruthy();

      // Combination E: Category AMADOR + Query "" -> André Lima
      await fireEvent.changeText(searchInput, '');
      await fireEvent.press(getByTestId('ranking-filter-amador'));
      await waitFor(() => expect(getByText('André Lima')).toBeTruthy());
      expect(queryByText('Gerson Barros')).toBeNull();
    });
  });

  // =========================================================================
  // Pairwise 3: Cockpit HUD Landscape Activation & Safe Exit
  // =========================================================================
  describe('Pairwise 3: Cockpit HUD Landscape Activation & Safe Exit', () => {
    it('alterna da aba LiveTime para o Cockpit HUD em paisagem e retorna limpo', async () => {
      const { getByTestId, queryByTestId, getByText } = await render(
        <E2EAppShellHarness />
      );

      // 1. Navigate to LiveTime
      await fireEvent.press(getByTestId('tab-livetime'));
      await waitFor(() => expect(getByTestId('screen-livetime')).toBeTruthy());

      // 2. Tap MODO COCKPIT HUD
      await fireEvent.press(getByTestId('btn-open-cockpit-hud'));
      await waitFor(() => expect(getByTestId('screen-cockpit-hud')).toBeTruthy());

      // 3. Verify Cockpit HUD telemetry elements
      expect(getByText('P1')).toBeTruthy();
      expect(getByText('0:05.8')).toBeTruthy();
      expect(getByText('+0:30.121 ⬆')).toBeTruthy();

      // 4. Tap close '✕' button
      await fireEvent.press(getByTestId('btn-close-cockpit'));
      await waitFor(() => expect(queryByTestId('screen-cockpit-hud')).toBeNull());

      // 5. Restores LiveTime screen cleanly
      expect(getByTestId('screen-livetime')).toBeTruthy();
      expect(getByText('BATERIAS 14/10/2026')).toBeTruthy();
    });
  });

  // =========================================================================
  // Pairwise 4: News Carousel Selection -> Reader Modal -> Dismissal
  // =========================================================================
  describe('Pairwise 4: News Carousel Selection -> Reader Modal -> Dismissal', () => {
    it('abre leitor completo para qualquer notícia selecionada e fecha com segurança', async () => {
      const { getByTestId, queryByTestId, getByText } = await render(
        <E2EAppShellHarness />
      );

      // 1. Initial tab is Home
      expect(getByTestId('screen-home')).toBeTruthy();

      // 2. Click News Card 1
      await fireEvent.press(getByTestId('news-card-news-1'));
      await waitFor(() => expect(getByTestId('news-reader-modal')).toBeTruthy());
      expect(getByTestId('news-reader-title')).toBeTruthy();
      expect(getByText(/Assessoria KIB/)).toBeTruthy();

      // 3. Close News Reader
      await fireEvent.press(getByTestId('btn-close-news-reader'));
      await waitFor(() => expect(queryByTestId('news-reader-modal')).toBeNull());

      // 4. Click News Card 2
      await fireEvent.press(getByTestId('news-card-news-2'));
      await waitFor(() => expect(getByTestId('news-reader-modal')).toBeTruthy());
      expect(getByTestId('news-reader-title')).toBeTruthy();
      expect(getByText(/Engenharia de Pista/)).toBeTruthy();

      // 5. Close News Reader
      await fireEvent.press(getByTestId('btn-close-news-reader'));
      await waitFor(() => expect(queryByTestId('news-reader-modal')).toBeNull());
      expect(getByTestId('screen-home')).toBeTruthy();
    });
  });

  // =========================================================================
  // Pairwise 5: Partner Track Shortcuts & Navigation to Agenda
  // =========================================================================
  describe('Pairwise 5: Partner Track Shortcuts & Navigation to Agenda', () => {
    it('navega de Parceiros para a Agenda via CTA de agendamento', async () => {
      const { getByTestId, getByText } = await render(<E2EAppShellHarness />);

      // 1. Go to Parceiros
      await fireEvent.press(getByTestId('tab-parceiros'));
      await waitFor(() => expect(getByTestId('screen-parceiro')).toBeTruthy());

      // 2. Click 'VER HORÁRIOS NA AGENDA ›'
      await fireEvent.press(getByTestId('btn-agendar-na-pista'));
      await waitFor(() => expect(getByTestId('screen-agenda')).toBeTruthy());

      // 3. Agenda displays slots with matching date
      expect(getByText('AGENDA DE BATERIAS')).toBeTruthy();
      expect(getByText('Data: 14/10/2026')).toBeTruthy();
    });
  });

  // =========================================================================
  // Pairwise 6: Cart Modification & Instant Recalculation
  // =========================================================================
  describe('Pairwise 6: Cart Modification & Instant Recalculation', () => {
    it('adiciona múltiplos ingressos, abre drawer e remove item recalculando o total', async () => {
      const { getByTestId, queryByTestId, getByText } = await render(
        <E2EAppShellHarness />
      );

      // 1. Navigate to Agenda
      await fireEvent.press(getByTestId('tab-agenda'));
      await waitFor(() => expect(getByTestId('screen-agenda')).toBeTruthy());

      // 2. Add slot-1100 (1 item)
      await fireEvent.press(getByTestId('btn-select-slot-slot-1100'));
      await waitFor(() => expect(getByTestId('slot-detail-modal')).toBeTruthy());
      await fireEvent.press(getByTestId('btn-add-to-cart'));

      // 3. Floating bar shows 1 item - R$ 110,00
      await waitFor(() => expect(getByTestId('floating-cart-bar')).toBeTruthy());
      expect(getByText(/🛒 CARRINHO \| 1 ITEM - R\$ 110,00/)).toBeTruthy();

      // 4. Open cart drawer by clicking floating bar
      await fireEvent.press(getByTestId('floating-cart-bar'));
      await waitFor(() => expect(getByTestId('cart-modal')).toBeTruthy());

      // 5. Remove item from drawer
      await fireEvent.press(getByTestId('swipe-remove-item-slot-1100'));

      // 6. Modal displays empty state
      await waitFor(() => expect(getByTestId('cart-empty-state')).toBeTruthy());
      expect(getByText('Seu carrinho está vazio.')).toBeTruthy();

      // 7. Close modal and verify floating bar has vanished
      await fireEvent.press(getByTestId('close-cart-btn'));
      await waitFor(() => expect(queryByTestId('floating-cart-bar')).toBeNull());
    });
  });

  // =========================================================================
  // Pairwise 7: Career Stats & Ranking Formula Modal Inspection
  // =========================================================================
  describe('Pairwise 7: Career Stats & Ranking Formula Modal Inspection', () => {
    it('consulta tela de Carreira, abre modal explicativo de regras e fecha com segurança', async () => {
      const { getByTestId, queryByTestId, getByText } = await render(
        <E2EAppShellHarness />
      );

      // 1. Navigate to Carreira
      await fireEvent.press(getByTestId('tab-carreira'));
      await waitFor(() => expect(getByTestId('screen-carreira')).toBeTruthy());

      // 2. Pilot details rendered
      expect(getByText('Nelson Castro')).toBeTruthy();
      expect(getByText('LENDA')).toBeTruthy();
      expect(getByText('61.251 XP')).toBeTruthy();

      // 3. Open rules modal from efficiency card
      await fireEvent.press(getByTestId('btn-career-ranking-rules'));
      await waitFor(() => expect(getByTestId('ranking-rules-modal')).toBeTruthy());

      // 4. Inspect rule items
      expect(getByText(/50% Eficiência/)).toBeTruthy();
      expect(getByText(/20% Vitórias/)).toBeTruthy();
      expect(getByText(/20% XP/)).toBeTruthy();
      expect(getByText(/10% Assiduidade/)).toBeTruthy();

      // 5. Tap 'ENTENDI' to close modal
      await fireEvent.press(getByTestId('btn-understand-rules'));
      await waitFor(() => expect(queryByTestId('ranking-rules-modal')).toBeNull());
      expect(getByTestId('screen-carreira')).toBeTruthy();
    });
  });
});
