/**
 * Tier 4 E2E Test Suite: Real-World Workloads & Complete User Journeys
 * Executes end-to-end user workflows defined in TEST_INFRA.md:
 * 1. Piloto Explora Home, Filtra por Categoria e Abre Notícia
 * 2. Usuário Navega em Parceiros, Verifica Pista e Agenda Bateria
 * 3. Fluxo Completo de Compra: Agenda -> Detalhe -> Carrinho Flutuante -> Swipe Delete -> Checkout
 * 4. Telemetria ao Vivo em Pista e Alternância para Cockpit HUD com Deltas
 * 5. Consulta de Carreira do Piloto, Métricas de Eficiência e Regras do Ranking
 */

import React from 'react';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import { E2EAppShellHarness } from './harness/test-screens';
import { SPORTS_PALETTE } from './harness/racing-contracts';

describe('Tier 4: End-to-End Real-World Workloads', () => {
  afterEach(async () => {
    cleanup();
  });

  // =========================================================================
  // Workload 1: Piloto Explora Home, Filtra por Categoria e Abre Notícia
  // =========================================================================
  it('Workload 1: Piloto explora Home, filtra por categoria e lê matéria completa de notícia', async () => {
    const { getByTestId, queryByTestId, getByText, queryByText, getAllByText } = await render(
      <E2EAppShellHarness />
    );

    // 1. Home tab active by default
    expect(getByTestId('screen-home')).toBeTruthy();
    expect(getByTestId('home-top-pilotos-section')).toBeTruthy();

    // 2. Initial top drivers preview shows Nelson Castro and Tiago Santos
    expect(getByText('Nelson Castro')).toBeTruthy();
    expect(getByText('NC')).toBeTruthy();
    expect(getByText('13.112 PTS')).toBeTruthy();
    expect(getByText('Tiago Santos')).toBeTruthy();

    // 3. Filter by 'LENDA'
    await fireEvent.press(getByTestId('filter-pill-lenda'));
    await waitFor(() => expect(getByText('Nelson Castro')).toBeTruthy());
    await waitFor(() => expect(queryByText('Tiago Santos')).toBeNull());

    // 4. Restore 'TODOS'
    await fireEvent.press(getByTestId('filter-pill-todos'));
    await waitFor(() => expect(getByText('Tiago Santos')).toBeTruthy());

    // 5. Scroll to news section and open first news card
    expect(getByTestId('home-news-section')).toBeTruthy();
    await fireEvent.press(getByTestId('news-card-news-1'));

    // 6. News reader modal opens with full metadata
    await waitFor(() => expect(getByTestId('news-reader-modal')).toBeTruthy());
    expect(getByTestId('news-reader-title')).toBeTruthy();
    expect(getAllByText('CAMPEONATO').length).toBeGreaterThanOrEqual(1);
    expect(getByText(/Assessoria KIB/)).toBeTruthy();
    expect(getByText(/3 min de leitura/)).toBeTruthy();
    expect(getByTestId('news-reader-body')).toBeTruthy();

    // 7. Share article action
    await fireEvent.press(getByTestId('btn-share-news'));

    // 8. Close reader and confirm return to Home
    await fireEvent.press(getByTestId('btn-close-news-reader'));
    await waitFor(() => expect(queryByTestId('news-reader-modal')).toBeNull());
    expect(getByTestId('screen-home')).toBeTruthy();
  });

  // =========================================================================
  // Workload 2: Usuário Navega em Parceiros, Verifica Pista e Agenda Bateria
  // =========================================================================
  it('Workload 2: Usuário navega em Parceiros, confere pista oficial e transiciona para Agenda', async () => {
    const { getByTestId, getByText } = await render(<E2EAppShellHarness />);

    // 1. Navigate to Parceiros via bottom tabs
    await fireEvent.press(getByTestId('tab-parceiros'));
    await waitFor(() => expect(getByTestId('screen-parceiro')).toBeTruthy());

    // 2. Verify track profile header
    expect(getByTestId('track-header')).toBeTruthy();
    expect(getByText('KARTÓDROMO INTERNACIONAL DE BETIM')).toBeTruthy();
    expect(getByText(/99884-2898/)).toBeTruthy();
    expect(getByText(/1110m de pista/)).toBeTruthy();
    expect(getByText(/1420 eventos/)).toBeTruthy();

    // 3. Toggle favorite
    await fireEvent.press(getByTestId('btn-favorite-track'));

    // 4. Verify quick shortcuts
    expect(getByTestId('shortcut-eventos')).toBeTruthy();
    expect(getByTestId('shortcut-ranking-pista')).toBeTruthy();
    expect(getByTestId('shortcut-ranking-xp')).toBeTruthy();

    // 5. Verify local top drivers
    expect(getByTestId('track-local-top-pilotos')).toBeTruthy();

    // 6. Click 'VER HORÁRIOS NA AGENDA ›' CTA
    await fireEvent.press(getByTestId('btn-agendar-na-pista'));
    await waitFor(() => expect(getByTestId('screen-agenda')).toBeTruthy());

    // 7. Confirm Agenda screen loaded with slots
    expect(getByText('AGENDA DE BATERIAS')).toBeTruthy();
    expect(getByText('Data: 14/10/2026')).toBeTruthy();
    expect(getByTestId('agenda-slots-list')).toBeTruthy();
  });

  // =========================================================================
  // Workload 3: Fluxo Completo de Compra e Checkout
  // =========================================================================
  it('Workload 3: Fluxo de compra completo: Agenda -> Stepper -> Carrinho Flutuante -> Swipe Delete -> Checkout', async () => {
    const { getByTestId, queryByTestId, getByText, getAllByText } = await render(
      <E2EAppShellHarness />
    );

    // 1. Navigate to Agenda tab
    await fireEvent.press(getByTestId('tab-agenda'));
    await waitFor(() => expect(getByTestId('screen-agenda')).toBeTruthy());

    // 2. Select slot 11:00 (12 available slots)
    await fireEvent.press(getByTestId('btn-select-slot-slot-1100'));
    await waitFor(() => expect(getByTestId('slot-detail-modal')).toBeTruthy());
    expect(getByText(/R\$ 110,00 por pessoa/)).toBeTruthy();

    // 3. Adjust quantity to 2 with stepper
    await fireEvent.press(getByTestId('btn-stepper-increment'));
    await waitFor(() => expect(getByText('2')).toBeTruthy());
    expect(getByText(/ADICIONAR AO CARRINHO \(R\$ 220,00\)/)).toBeTruthy();

    // 4. Add to cart
    await fireEvent.press(getByTestId('btn-add-to-cart'));
    await waitFor(() => expect(queryByTestId('slot-detail-modal')).toBeNull());

    // 5. Floating cart bar appears above navigation tabs
    await waitFor(() => expect(getByTestId('floating-cart-bar')).toBeTruthy());
    expect(getByText(/🛒 CARRINHO \| 2 ITENS - R\$ 220,00/)).toBeTruthy();

    // 6. Switch tabs to Parceiros -> cart bar remains visible
    await fireEvent.press(getByTestId('tab-parceiros'));
    await waitFor(() => expect(getByTestId('screen-parceiro')).toBeTruthy());
    expect(getByTestId('floating-cart-bar')).toBeTruthy();

    // 7. Return to Agenda and add slot 16:30 (1 available slot, R$ 120,00)
    await fireEvent.press(getByTestId('tab-agenda'));
    await waitFor(() => expect(getByTestId('screen-agenda')).toBeTruthy());
    await fireEvent.press(getByTestId('btn-select-slot-slot-1630'));
    await waitFor(() => expect(getByTestId('slot-detail-modal')).toBeTruthy());
    await fireEvent.press(getByTestId('btn-add-to-cart'));

    // 8. Floating cart bar dynamically recalculates: 3 items, R$ 340,00
    await waitFor(() => expect(getByText(/🛒 CARRINHO \| 3 ITENS - R\$ 340,00/)).toBeTruthy());

    // 9. Open cart drawer by tapping floating bar
    await fireEvent.press(getByTestId('floating-cart-bar'));
    await waitFor(() => expect(getByTestId('cart-modal')).toBeTruthy());
    expect(getByText('CARRINHO DE COMPRAS')).toBeTruthy();
    expect(getByTestId('cart-item-slot-1100')).toBeTruthy();
    expect(getByTestId('cart-item-slot-1630')).toBeTruthy();
    expect(getByText('R$ 340,00')).toBeTruthy();

    // 10. Swipe to remove slot 16:30
    await fireEvent.press(getByTestId('swipe-remove-item-slot-1630'));
    await waitFor(() => expect(queryByTestId('cart-item-slot-1630')).toBeNull());
    expect(getByText('R$ 220,00')).toBeTruthy();

    // 11. Confirm Order (Checkout flow)
    await fireEvent.press(getByTestId('btn-confirm-order'));

    // 12. Cart is cleared and floating bar vanishes
    await waitFor(() => expect(queryByTestId('cart-modal')).toBeNull());
    await waitFor(() => expect(queryByTestId('floating-cart-bar')).toBeNull());
  });

  // =========================================================================
  // Workload 4: Telemetria ao Vivo em Pista e Alternância para Cockpit HUD
  // =========================================================================
  it('Workload 4: Telemetria ao vivo na pista e alternância para o Cockpit HUD em paisagem', async () => {
    const { getByTestId, queryByTestId, getByText, getAllByText } = await render(
      <E2EAppShellHarness />
    );

    // 1. Navigate to LiveTime
    await fireEvent.press(getByTestId('tab-livetime'));
    await waitFor(() => expect(getByTestId('screen-livetime')).toBeTruthy());

    // 2. Session header inspection
    expect(getByTestId('livetime-session-header')).toBeTruthy();
    expect(getByText('BATERIAS 14/10/2026')).toBeTruthy();
    expect(getByText(/BATERIA 09:00 - ESCOLA - RACE/)).toBeTruthy();

    // 3. Fastest lap purple banner
    expect(getByTestId('fastest-lap-banner')).toBeTruthy();
    expect(getByText('VOLTA MAIS RÁPIDA')).toBeTruthy();
    expect(getByTestId('fastest-lap-info')).toBeTruthy();

    // 4. Flag status and elapsed time
    expect(getByTestId('flag-status-card')).toBeTruthy();
    expect(getByText('BANDEIRA VERDE')).toBeTruthy();
    expect(getByText('0:17:54.548')).toBeTruthy();

    // 5. Competitor telemetry table
    expect(getByTestId('telemetry-table')).toBeTruthy();
    expect(getByText('#16 Nelson Castro')).toBeTruthy();
    expect(getByText('#07 Gerson Barros')).toBeTruthy();
    expect(getByText('+0:01.420')).toBeTruthy();

    // 6. Enter Cockpit HUD mode
    await fireEvent.press(getByTestId('btn-open-cockpit-hud'));
    await waitFor(() => expect(getByTestId('screen-cockpit-hud')).toBeTruthy());

    // 7. Verify Cockpit HUD telemetry displays
    expect(getByText(/#07 GERSON BARROS/)).toBeTruthy();
    expect(getByText('P1')).toBeTruthy();
    expect(getByText('0:05.8')).toBeTruthy();
    expect(getByText('+0:30.121 ⬆')).toBeTruthy();
    expect(getByText(/Última: 0:32\.878/)).toBeTruthy();
    expect(getByText(/Melhor: 0:29\.182/)).toBeTruthy();
    expect(getByText(/Dif Melhor: \+3\.696/)).toBeTruthy();

    // 8. Exit Cockpit HUD back to LiveTime
    await fireEvent.press(getByTestId('btn-close-cockpit'));
    await waitFor(() => expect(queryByTestId('screen-cockpit-hud')).toBeNull());
    expect(getByTestId('screen-livetime')).toBeTruthy();
  });

  // =========================================================================
  // Workload 5: Consulta de Carreira do Piloto, Eficiência e Regras do Ranking
  // =========================================================================
  it('Workload 5: Consulta de carreira do piloto, métricas de eficiência e modal de regras', async () => {
    const { getByTestId, queryByTestId, getByText } = await render(
      <E2EAppShellHarness />
    );

    // 1. Navigate to Carreira
    await fireEvent.press(getByTestId('tab-carreira'));
    await waitFor(() => expect(getByTestId('screen-carreira')).toBeTruthy());

    // 2. Driver header
    expect(getByTestId('career-driver-header')).toBeTruthy();
    expect(getByText('Nelson Castro')).toBeTruthy();
    expect(getByText('NC')).toBeTruthy();
    expect(getByText('LENDA')).toBeTruthy();
    expect(getByText('61.251 XP')).toBeTruthy();
    expect(getByText('13.112 PTS')).toBeTruthy();

    // 3. Efficiency matrix card (2x3)
    expect(getByTestId('efficiency-card')).toBeTruthy();
    expect(getByText('TAXA DE VITÓRIA')).toBeTruthy();
    expect(getByText('22%')).toBeTruthy();
    expect(getByText('TAXA DE PÓDIO')).toBeTruthy();
    expect(getByText('43%')).toBeTruthy();
    expect(getByText('EFICIÊNCIA GERAL')).toBeTruthy();
    expect(getByText('35%')).toBeTruthy();
    expect(getByText('CORRIDAS VÁLIDAS')).toBeTruthy();
    expect(getByText('92%')).toBeTruthy();

    // 4. Qualified stats card (10+ drivers)
    expect(getByTestId('qualified-stats-card')).toBeTruthy();
    expect(getByText('ESTATÍSTICAS QUALIFICADAS (10+ PILOTOS)')).toBeTruthy();
    expect(getByText('309')).toBeTruthy();
    expect(getByText('70')).toBeTruthy();
    expect(getByText('133')).toBeTruthy();

    // 5. Badges grid
    expect(getByTestId('career-badges-section')).toBeTruthy();
    expect(getByTestId('badges-grid')).toBeTruthy();
    expect(getByText('Estreante')).toBeTruthy();
    expect(getByText('Lenda')).toBeTruthy();

    // 6. Open Ranking Rules modal from info button
    await fireEvent.press(getByTestId('btn-career-ranking-rules'));
    await waitFor(() => expect(getByTestId('ranking-rules-modal')).toBeTruthy());

    // 7. Verify formula weights and cutoff rule
    expect(getByText(/50% Eficiência/)).toBeTruthy();
    expect(getByText(/20% Vitórias/)).toBeTruthy();
    expect(getByText(/20% XP/)).toBeTruthy();
    expect(getByText(/10% Assiduidade/)).toBeTruthy();
    expect(getByText(/Apenas baterias com 10 ou mais pilotos/)).toBeTruthy();

    // 8. Close rules modal and verify return to Carreira
    await fireEvent.press(getByTestId('btn-understand-rules'));
    await waitFor(() => expect(queryByTestId('ranking-rules-modal')).toBeNull());
    expect(getByTestId('screen-carreira')).toBeTruthy();
  });
});
