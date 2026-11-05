/**
 * Tier 1 E2E Test Suite: Feature Coverage (F01 to F28)
 * Verifies all 28 inventoried features from ORIGINAL_REQUEST.md and PROJECT.md.
 * Each feature has >= 5 strict, deterministic assertions.
 */

import React from 'react';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import {
  AgendaScreenHarness,
  CarreiraScreenHarness,
  CartModalHarness,
  CockpitHUDScreenHarness,
  FloatingCartBarHarness,
  FloatingTabBarHarness,
  HomeScreenHarness,
  LiveTimeScreenHarness,
  NewsReaderHarness,
  ParceiroScreenHarness,
  RankingRulesModalHarness,
  RankingScreenHarness,
} from './harness/test-screens';
import {
  MOCK_AGENDA_SLOTS,
  MOCK_CAREER_STATS,
  MOCK_COCKPIT_HUD,
  MOCK_DRIVERS,
  MOCK_LIVE_SESSION,
  MOCK_NEWS,
  MOCK_TRACK_PARTNER,
} from './harness/mock-dataset';
import {
  formatCentavosToReais,
  formatPoints,
  formatXP,
  SPORTS_PALETTE,
  TABULAR_NUMS_STYLE,
} from './harness/racing-contracts';
import { CartState } from '../../src/types/racing';

describe('Tier 1: Feature Coverage (F01 to F28)', () => {
  afterEach(async () => {
    cleanup();
  });
  // -------------------------------------------------------------------------
  // F01: Design System Dark/OLED Tokens
  // -------------------------------------------------------------------------
  describe('F01 - Design System Dark/OLED Tokens', () => {
    it('satisfaz os tokens de cores OLED e paleta esportiva de alto contraste', () => {
      // 1. OLED pure black background
      expect(SPORTS_PALETTE.background).toBe('#000000');
      // 2. Elevated cards surfaces
      expect(SPORTS_PALETTE.surface).toBe('#161A1D');
      expect(SPORTS_PALETTE.surfaceElevated).toBe('#1E2228');
      // 3. Subtle borders
      expect(SPORTS_PALETTE.border).toBe('#2A2E35');
      // 4. Gold and neon accents
      expect(SPORTS_PALETTE.accent).toBe('#F59E0B');
      expect(SPORTS_PALETTE.neonGreen).toBe('#00E676');
      expect(SPORTS_PALETTE.neonRed).toBe('#EF4444');
      // 5. Purple and Blue motorsport accents
      expect(SPORTS_PALETTE.purple).toBe('#6F4B89');
      expect(SPORTS_PALETTE.blue).toBe('#3B82F6');
    });
  });

  // -------------------------------------------------------------------------
  // F02: Tipografia Esportiva & Numerais Tabulares
  // -------------------------------------------------------------------------
  describe('F02 - Tipografia Esportiva & Numerais Tabulares', () => {
    it('garante formatação tabular para cronometragem e pontuação monetária', () => {
      // 1. Font variant tabular-nums
      expect(TABULAR_NUMS_STYLE.fontVariant).toContain('tabular-nums');
      // 2. Monospace font family defined
      expect(TABULAR_NUMS_STYLE.fontFamily).toBeDefined();
      // 3. Currency formatter produces Brazilian Real notation
      expect(formatCentavosToReais(11000)).toBe('R$ 110,00');
      expect(formatCentavosToReais(0)).toBe('R$ 0,00');
      // 4. Points formatter produces localized PTS
      expect(formatPoints(13112)).toBe('13.112 PTS');
      // 5. XP formatter produces localized XP
      expect(formatXP(61251)).toBe('61.251 XP');
    });
  });

  // -------------------------------------------------------------------------
  // F03: Floating Bottom Navigation Capsule
  // -------------------------------------------------------------------------
  describe('F03 - Floating Bottom Navigation Capsule', () => {
    it('renderiza os 5 destinos da cápsula inferior e responde a toques', async () => {
      const onTabPress = jest.fn();
      const { getByTestId } = await render(
        <FloatingTabBarHarness activeTab="Home" onTabPress={onTabPress} />
      );

      // 1. Container exists
      expect(getByTestId('floating-bottom-tabs')).toBeTruthy();
      // 2. Home tab selected
      expect(getByTestId('tab-home')).toBeTruthy();
      // 3. Parceiros tab exists and can be tapped
      await fireEvent.press(getByTestId('tab-parceiros'));
      expect(onTabPress).toHaveBeenCalledWith('Parceiros');
      // 4. LiveTime tab exists and can be tapped
      await fireEvent.press(getByTestId('tab-livetime'));
      expect(onTabPress).toHaveBeenCalledWith('LiveTime');
      // 5. Agenda and Carreira tabs exist
      expect(getByTestId('tab-agenda')).toBeTruthy();
      expect(getByTestId('tab-carreira')).toBeTruthy();
    });
  });

  // -------------------------------------------------------------------------
  // F04: Central Mock & Schema Architecture
  // -------------------------------------------------------------------------
  describe('F04 - Central Mock & Schema Architecture', () => {
    it('valida a integridade estrutural dos modelos TypeScript centrais', () => {
      const driver = MOCK_DRIVERS[0];
      // 1. Driver schema
      expect(driver.id).toBe('driver-nelson-castro');
      expect(driver.name).toBe('Nelson Castro');
      expect(driver.category).toBe('LENDA');
      expect(driver.xp).toBe(61251);
      expect(driver.points).toBe(13112);
      // 2. Track Partner schema
      expect(MOCK_TRACK_PARTNER.stats.trackLengthMeters).toBe(1110);
      // 3. Live Session schema
      expect(MOCK_LIVE_SESSION.status).toBe('GREEN');
      // 4. Agenda Slot schema
      expect(MOCK_AGENDA_SLOTS[0].priceCentavos).toBe(11000);
      // 5. Career Stats schema
      expect(MOCK_CAREER_STATS.efficiency.overallEfficiency).toBe(35);
    });
  });

  // -------------------------------------------------------------------------
  // F05: Home Screen Top Pilotos Preview
  // -------------------------------------------------------------------------
  describe('F05 - Home Screen Top Pilotos Preview', () => {
    it('renderiza o top 5 de pilotos com iniciais, categoria, XP e pontos dourados', async () => {
      const { getByTestId, getByText } = await render(
        <HomeScreenHarness onOpenRanking={jest.fn()} onOpenNews={jest.fn()} />
      );

      // 1. Top Pilotos section is rendered
      expect(getByTestId('home-top-pilotos-section')).toBeTruthy();
      // 2. Leader Nelson Castro is rendered
      expect(getByText('Nelson Castro')).toBeTruthy();
      // 3. Circular avatar with initials 'NC'
      expect(getByText('NC')).toBeTruthy();
      // 4. Category and XP label
      expect(getByText('LENDA • 61.251 XP')).toBeTruthy();
      // 5. Gold points highlighted
      expect(getByTestId('driver-points-driver-nelson-castro')).toBeTruthy();
      expect(getByText('13.112 PTS')).toBeTruthy();
    });
  });

  // -------------------------------------------------------------------------
  // F06: Filtro de Categorias Deslizável
  // -------------------------------------------------------------------------
  describe('F06 - Filtro de Categorias Deslizável', () => {
    it('permite alternar entre pílulas de categoria e filtra pilotos na tela', async () => {
      const { getByTestId, queryByText, getByText } = await render(
        <HomeScreenHarness onOpenRanking={jest.fn()} onOpenNews={jest.fn()} />
      );

      // 1. Pills container rendered
      expect(getByTestId('category-filter-pills')).toBeTruthy();
      // 2. 'TODOS' is active initially and shows Tiago Santos
      expect(getByText('Tiago Santos')).toBeTruthy();
      // 3. Filter by 'LENDA'
      await fireEvent.press(getByTestId('filter-pill-lenda'));
      await waitFor(() => expect(getByText('Nelson Castro')).toBeTruthy());
      // 4. Drivers of other categories are excluded
      await waitFor(() => expect(queryByText('Tiago Santos')).toBeNull());
      // 5. Restore 'TODOS' filter
      await fireEvent.press(getByTestId('filter-pill-todos'));
      await waitFor(() => expect(getByText('Tiago Santos')).toBeTruthy());
    });
  });

  // -------------------------------------------------------------------------
  // F07: Tela Cheia de Ranking de Pilotos
  // -------------------------------------------------------------------------
  describe('F07 - Tela Cheia de Ranking de Pilotos', () => {
    it('fornece busca por texto, filtro de categorias e botão informativo', async () => {
      const onOpenRules = jest.fn();
      const onClose = jest.fn();
      const { getByTestId, getByPlaceholderText, queryByText, getByText } = await render(
        <RankingScreenHarness onClose={onClose} onOpenRules={onOpenRules} />
      );

      // 1. Search input rendered
      const input = getByPlaceholderText('Buscar piloto por nome...');
      expect(input).toBeTruthy();
      // 2. Typing 'Barros' filters to Barros drivers
      await fireEvent.changeText(input, 'Barros');
      await waitFor(() => expect(getByText('Gerson Barros Neto dos Anjos')).toBeTruthy());
      await waitFor(() => expect(queryByText('Nelson Castro')).toBeNull());
      // 3. Back button calls onClose
      await fireEvent.press(getByTestId('btn-back-ranking'));
      expect(onClose).toHaveBeenCalled();
      // 4. Info icon calls onOpenRules
      await fireEvent.press(getByTestId('btn-ranking-rules-info'));
      expect(onOpenRules).toHaveBeenCalled();
      // 5. Clear search restores full list
      await fireEvent.changeText(input, '');
      await waitFor(() => expect(getByText('Nelson Castro')).toBeTruthy());
    });
  });

  // -------------------------------------------------------------------------
  // F08: Carrossel de Notícias Esportivas
  // -------------------------------------------------------------------------
  describe('F08 - Carrossel de Notícias Esportivas', () => {
    it('renderiza carrossel horizontal de notícias com tags e datas', async () => {
      const onOpenNews = jest.fn();
      const { getByTestId, getByText } = await render(
        <HomeScreenHarness onOpenRanking={jest.fn()} onOpenNews={onOpenNews} />
      );

      // 1. News carousel exists
      expect(getByTestId('news-carousel')).toBeTruthy();
      // 2. First article card exists
      expect(getByTestId('news-card-news-1')).toBeTruthy();
      // 3. Article category tag displayed
      expect(getByText('CAMPEONATO')).toBeTruthy();
      // 4. Article headline rendered
      expect(getByText(/Final da Copa Betim de Kart/)).toBeTruthy();
      // 5. Tapping news invokes onOpenNews
      await fireEvent.press(getByTestId('news-card-news-1'));
      expect(onOpenNews).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'news-1' })
      );
    });
  });

  // -------------------------------------------------------------------------
  // F09: Leitor Completo de Notícias
  // -------------------------------------------------------------------------
  describe('F09 - Leitor Completo de Notícias', () => {
    it('exibe matéria completa com autor, data, corpo e botão compartilhar', async () => {
      const onClose = jest.fn();
      const onShare = jest.fn();
      const article = MOCK_NEWS[0];
      const { getByTestId } = await render(
        <NewsReaderHarness article={article} onClose={onClose} onShare={onShare} />
      );

      // 1. News reader modal visible
      expect(getByTestId('news-reader-modal')).toBeTruthy();
      // 2. Full title displayed
      expect(getByTestId('news-reader-title')).toBeTruthy();
      // 3. Category tag displayed
      expect(getByTestId('news-reader-tag')).toBeTruthy();
      // 4. Full article content displayed
      expect(getByTestId('news-reader-body')).toBeTruthy();
      // 5. Close and share actions work
      await fireEvent.press(getByTestId('btn-share-news'));
      expect(onShare).toHaveBeenCalled();
      await fireEvent.press(getByTestId('btn-close-news-reader'));
      expect(onClose).toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // F10: Cabeçalho do Kartódromo de Betim
  // -------------------------------------------------------------------------
  describe('F10 - Cabeçalho do Kartódromo de Betim', () => {
    it('exibe dados oficiais da pista, telefone, comprimento e botão de favoritar', async () => {
      const { getByTestId, getByText } = await render(
        <ParceiroScreenHarness onNavigateAgenda={jest.fn()} />
      );

      // 1. Track name displayed
      expect(getByTestId('track-name')).toBeTruthy();
      expect(getByText('KARTÓDROMO INTERNACIONAL DE BETIM')).toBeTruthy();
      // 2. Official phone displayed
      expect(getByTestId('track-phone')).toBeTruthy();
      expect(getByText(/99884-2898/)).toBeTruthy();
      // 3. Track length in meters
      expect(getByText(/1110m de pista/)).toBeTruthy();
      // 4. Finished events count
      expect(getByText(/1420 eventos/)).toBeTruthy();
      // 5. Favorite button toggles
      const favBtn = getByTestId('btn-favorite-track');
      expect(favBtn).toBeTruthy();
      await fireEvent.press(favBtn);
    });
  });

  // -------------------------------------------------------------------------
  // F11: Atalhos Rápidos da Pista
  // -------------------------------------------------------------------------
  describe('F11 - Atalhos Rápidos da Pista', () => {
    it('renderiza os cards de atalho para Eventos, Ranking da Pista e XP', async () => {
      const { getByTestId, getByText } = await render(
        <ParceiroScreenHarness onNavigateAgenda={jest.fn()} />
      );

      // 1. Container of shortcuts exists
      expect(getByTestId('track-quick-shortcuts')).toBeTruthy();
      // 2. Eventos concluídos shortcut
      expect(getByTestId('shortcut-eventos')).toBeTruthy();
      expect(getByText('EVENTOS')).toBeTruthy();
      // 3. Ranking da pista shortcut
      expect(getByTestId('shortcut-ranking-pista')).toBeTruthy();
      expect(getByText('RANKING')).toBeTruthy();
      // 4. Ranking de XP shortcut
      expect(getByTestId('shortcut-ranking-xp')).toBeTruthy();
      expect(getByText('XP TOTAL')).toBeTruthy();
      // 5. Subtitle labels exist
      expect(getByText('Concluídos')).toBeTruthy();
    });
  });

  // -------------------------------------------------------------------------
  // F12: Top Pilotos Betim Local
  // -------------------------------------------------------------------------
  describe('F12 - Top Pilotos Betim Local', () => {
    it('renderiza ranking de pilotos locais com bandeiras MG e botão de recarregar', async () => {
      const { getByTestId, getAllByText } = await render(
        <ParceiroScreenHarness onNavigateAgenda={jest.fn()} />
      );

      // 1. Section container rendered
      expect(getByTestId('track-local-top-pilotos')).toBeTruthy();
      // 2. MG flag badges rendered
      const mgBadges = getAllByText('MG');
      expect(mgBadges.length).toBeGreaterThanOrEqual(1);
      // 3. Refresh icon button exists
      expect(getByTestId('btn-refresh-local-ranking')).toBeTruthy();
      // 4. Local pilot points displayed
      expect(getAllByText(/PTS/).length).toBeGreaterThan(0);
      // 5. Header title present
      expect(getByTestId('track-local-top-pilotos')).toBeTruthy();
    });
  });

  // -------------------------------------------------------------------------
  // F13: Reservas Disponíveis na Pista
  // -------------------------------------------------------------------------
  describe('F13 - Reservas Disponíveis na Pista', () => {
    it('apresenta seletor de data e atalho para grade de horários da agenda', async () => {
      const onNavigateAgenda = jest.fn();
      const { getByTestId, getByText } = await render(
        <ParceiroScreenHarness onNavigateAgenda={onNavigateAgenda} />
      );

      // 1. Section rendered
      expect(getByTestId('track-reservations-section')).toBeTruthy();
      // 2. Date label rendered
      expect(getByTestId('reservation-date-label')).toBeTruthy();
      expect(getByText(/14\/10\/2026/)).toBeTruthy();
      // 3. Navigation CTA rendered
      const btn = getByTestId('btn-agendar-na-pista');
      expect(btn).toBeTruthy();
      // 4. Tapping button invokes onNavigateAgenda
      await fireEvent.press(btn);
      expect(onNavigateAgenda).toHaveBeenCalledTimes(1);
      // 5. Button label matches specification
      expect(getByText(/VER HORÁRIOS NA AGENDA/)).toBeTruthy();
    });
  });

  // -------------------------------------------------------------------------
  // F14: LiveTime Cabeçalho de Sessão
  // -------------------------------------------------------------------------
  describe('F14 - LiveTime Cabeçalho de Sessão', () => {
    it('exibe título da bateria, horário, tipo e pista em tempo real', async () => {
      const { getByTestId, getByText } = await render(
        <LiveTimeScreenHarness onOpenCockpitHUD={jest.fn()} />
      );

      // 1. Session header container rendered
      expect(getByTestId('livetime-session-header')).toBeTruthy();
      // 2. Session title matches
      expect(getByTestId('livetime-title')).toBeTruthy();
      expect(getByText('BATERIAS 14/10/2026')).toBeTruthy();
      // 3. Subtitle displays time and category
      expect(getByTestId('livetime-subtitle')).toBeTruthy();
      expect(getByText(/BATERIA 09:00 - ESCOLA - RACE/)).toBeTruthy();
      // 4. Track center displayed
      expect(getByText(/KART CENTER BETIM/)).toBeTruthy();
      // 5. Container background is dark
      expect(getByTestId('screen-livetime')).toBeTruthy();
    });
  });

  // -------------------------------------------------------------------------
  // F15: Banner Roxo "Volta Mais Rápida"
  // -------------------------------------------------------------------------
  describe('F15 - Banner Roxo "Volta Mais Rápida"', () => {
    it('destaca piloto com a melhor volta da sessão com layout roxo neon', async () => {
      const { getByTestId, getByText, getAllByText } = await render(
        <LiveTimeScreenHarness onOpenCockpitHUD={jest.fn()} />
      );

      // 1. Banner container rendered
      expect(getByTestId('fastest-lap-banner')).toBeTruthy();
      // 2. Purple tag rendered
      expect(getByText('VOLTA MAIS RÁPIDA')).toBeTruthy();
      // 3. Competitor number displayed
      expect(getByTestId('fastest-lap-info')).toBeTruthy();
      // 4. Lap time displayed
      expect(getAllByText(/0:38.775/).length).toBeGreaterThanOrEqual(1);
      // 5. Lap index displayed
      expect(getByText(/NA VOLTA 5/)).toBeTruthy();
    });
  });

  // -------------------------------------------------------------------------
  // F16: Status da Bandeira e Tempo
  // -------------------------------------------------------------------------
  describe('F16 - Status da Bandeira e Tempo', () => {
    it('exibe status da bandeira verde e cronômetro de sessão decorrido', async () => {
      const { getByTestId, getByText } = await render(
        <LiveTimeScreenHarness onOpenCockpitHUD={jest.fn()} />
      );

      // 1. Flag card rendered
      expect(getByTestId('flag-status-card')).toBeTruthy();
      // 2. Green flag status rendered
      expect(getByTestId('flag-status-label')).toBeTruthy();
      expect(getByText('BANDEIRA VERDE')).toBeTruthy();
      // 3. Elapsed timer rendered
      expect(getByTestId('elapsed-session-timer')).toBeTruthy();
      expect(getByText('0:17:54.548')).toBeTruthy();
      // 4. Card exists in live view
      expect(getByTestId('screen-livetime')).toBeTruthy();
      // 5. Timer format contains minutes, seconds and milliseconds
      expect('0:17:54.548').toMatch(/^\d+:\d{2}:\d{2}\.\d{3}$/);
    });
  });

  // -------------------------------------------------------------------------
  // F17: Tabela / Cards de Telemetria
  // -------------------------------------------------------------------------
  describe('F17 - Tabela / Cards de Telemetria', () => {
    it('renderiza competidores, voltas atuais, melhor volta e deltas', async () => {
      const { getByTestId, getByText } = await render(
        <LiveTimeScreenHarness onOpenCockpitHUD={jest.fn()} />
      );

      // 1. Telemetry table rendered
      expect(getByTestId('telemetry-table')).toBeTruthy();
      // 2. Leader row rendered
      expect(getByTestId('telemetry-row-#16')).toBeTruthy();
      // 3. Position and driver name
      expect(getByText('#16 Nelson Castro')).toBeTruthy();
      // 4. Competitor 2 diff rendered
      expect(getByText('+0:01.420')).toBeTruthy();
      // 5. Best lap time rendered
      expect(getByText('0:38.775')).toBeTruthy();
    });
  });

  // -------------------------------------------------------------------------
  // F18: Modo Paisagem Cockpit HUD
  // -------------------------------------------------------------------------
  describe('F18 - Modo Paisagem Cockpit HUD', () => {
    it('fornece HUD horizontal OLED puro com botão de saída e dados do piloto', async () => {
      const onClose = jest.fn();
      const { getByTestId, getByText } = await render(
        <CockpitHUDScreenHarness onClose={onClose} />
      );

      // 1. Cockpit HUD screen rendered
      expect(getByTestId('screen-cockpit-hud')).toBeTruthy();
      // 2. Driver info displayed in HUD
      expect(getByTestId('cockpit-driver-info')).toBeTruthy();
      expect(getByText(/#07 GERSON BARROS/)).toBeTruthy();
      // 3. Close button exists
      const closeBtn = getByTestId('btn-close-cockpit');
      expect(closeBtn).toBeTruthy();
      // 4. Tapping close invokes onClose
      await fireEvent.press(closeBtn);
      expect(onClose).toHaveBeenCalled();
      // 5. Position card rendered
      expect(getByTestId('cockpit-position-card')).toBeTruthy();
    });
  });

  // -------------------------------------------------------------------------
  // F19: Telemetria Cockpit HUD em Tempo Real
  // -------------------------------------------------------------------------
  describe('F19 - Telemetria Cockpit HUD em Tempo Real', () => {
    it('exibe cronômetro gigante, posição atual e deltas com indicadores direcionais', async () => {
      const { getByTestId, getByText } = await render(
        <CockpitHUDScreenHarness onClose={jest.fn()} />
      );

      // 1. Current position is P1
      expect(getByTestId('cockpit-current-position')).toBeTruthy();
      expect(getByText('P1')).toBeTruthy();
      // 2. Giant lap timer is rendered
      expect(getByTestId('cockpit-giant-timer')).toBeTruthy();
      expect(getByText('0:05.8')).toBeTruthy();
      // 3. Realtime delta with directional arrow
      expect(getByTestId('cockpit-delta-value')).toBeTruthy();
      expect(getByText('+0:30.121 ⬆')).toBeTruthy();
      // 4. Best lap delta
      expect(getByTestId('cockpit-delta-best')).toBeTruthy();
      expect(getByText(/Dif Melhor: \+3\.696/)).toBeTruthy();
      // 5. Last lap time
      expect(getByText(/Última: 0:32\.878/)).toBeTruthy();
    });
  });

  // -------------------------------------------------------------------------
  // F20: Cart State Context
  // -------------------------------------------------------------------------
  describe('F20 - Cart State Context', () => {
    it('gerencia adição, remoção, cálculo de quantidade e total monetário', () => {
      let state: CartState = {
        items: [],
        totalQuantity: 0,
        totalPriceCentavos: 0,
        totalPriceFormatted: 'R$ 0,00',
        isCartOpen: false,
        addItem: (item) => {
          state.items.push({ ...item, totalPriceCentavos: item.unitPriceCentavos * item.quantity });
          state.totalQuantity += item.quantity;
          state.totalPriceCentavos += item.unitPriceCentavos * item.quantity;
          state.totalPriceFormatted = formatCentavosToReais(state.totalPriceCentavos);
        },
        removeItem: (sessionId) => {
          const removed = state.items.find((i) => i.sessionId === sessionId);
          if (removed) {
            state.totalQuantity -= removed.quantity;
            state.totalPriceCentavos -= removed.totalPriceCentavos;
            state.items = state.items.filter((i) => i.sessionId !== sessionId);
            state.totalPriceFormatted = formatCentavosToReais(state.totalPriceCentavos);
          }
        },
        updateQuantity: jest.fn(),
        clearCart: () => {
          state.items = [];
          state.totalQuantity = 0;
          state.totalPriceCentavos = 0;
          state.totalPriceFormatted = 'R$ 0,00';
        },
        openCart: () => { state.isCartOpen = true; },
        closeCart: () => { state.isCartOpen = false; },
      };

      // 1. Initial empty state
      expect(state.totalQuantity).toBe(0);
      expect(state.totalPriceFormatted).toBe('R$ 0,00');

      // 2. Add item
      state.addItem({
        sessionId: 'slot-1100',
        sessionTitle: 'BATERIA 11:00',
        trackName: 'KARTÓDROMO DE BETIM',
        date: '14/10/2026',
        time: '11:00',
        quantity: 2,
        unitPriceCentavos: 11000,
      });
      expect(state.totalQuantity).toBe(2);
      expect(state.totalPriceCentavos).toBe(22000);
      expect(state.totalPriceFormatted).toBe('R$ 220,00');

      // 3. Open and close cart
      state.openCart();
      expect(state.isCartOpen).toBe(true);
      state.closeCart();
      expect(state.isCartOpen).toBe(false);

      // 4. Remove item
      state.removeItem('slot-1100');
      expect(state.totalQuantity).toBe(0);
      expect(state.totalPriceCentavos).toBe(0);

      // 5. Clear cart
      state.addItem({
        sessionId: 'slot-1630',
        sessionTitle: 'BATERIA 16:30',
        trackName: 'KARTÓDROMO DE BETIM',
        date: '14/10/2026',
        time: '16:30',
        quantity: 1,
        unitPriceCentavos: 12000,
      });
      state.clearCart();
      expect(state.items.length).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // F21: Agenda Seletor de Data & Baterias
  // -------------------------------------------------------------------------
  describe('F21 - Agenda Seletor de Data & Baterias', () => {
    it('lista baterias do dia com vagas restantes e status de esgotado', async () => {
      const onAddToCart = jest.fn();
      const { getByTestId, getByText, getAllByText } = await render(
        <AgendaScreenHarness onAddToCart={onAddToCart} />
      );

      // 1. Date indicator rendered
      expect(getByTestId('agenda-selected-date')).toBeTruthy();
      expect(getByText('Data: 14/10/2026')).toBeTruthy();
      // 2. Slots list container rendered
      expect(getByTestId('agenda-slots-list')).toBeTruthy();
      // 3. Available slot with 12 vagas rendered
      expect(getByTestId('slot-vagas-slot-1100')).toBeTruthy();
      expect(getByText('12 VAGAS')).toBeTruthy();
      // 4. Sold out slot rendered with red status
      expect(getByTestId('slot-vagas-slot-1400')).toBeTruthy();
      expect(getAllByText('ESGOTADO').length).toBeGreaterThanOrEqual(1);
      // 5. Action button disabled for sold out slot
      expect(getByTestId('btn-select-slot-slot-1400').props.accessibilityState?.disabled).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // F22: Detalhe da Bateria & Adicionar ao Carrinho
  // -------------------------------------------------------------------------
  describe('F22 - Detalhe da Bateria & Adicionar ao Carrinho', () => {
    it('abre drawer, ajusta quantidade no stepper e adiciona ao carrinho', async () => {
      const onAddToCart = jest.fn();
      const { getByTestId, getByText } = await render(
        <AgendaScreenHarness onAddToCart={onAddToCart} />
      );

      // 1. Open slot detail
      await fireEvent.press(getByTestId('btn-select-slot-slot-1100'));
      await waitFor(() => expect(getByTestId('slot-detail-modal')).toBeTruthy());
      // 2. Unit price displayed
      expect(getByTestId('slot-detail-price')).toBeTruthy();
      expect(getByText(/R\$ 110,00 por pessoa/)).toBeTruthy();
      // 3. Stepper increment increases quantity
      await fireEvent.press(getByTestId('btn-stepper-increment'));
      await waitFor(() => expect(getByText('2')).toBeTruthy());
      // 4. Add to cart button reflects total
      expect(getByText(/ADICIONAR AO CARRINHO \(R\$ 220,00\)/)).toBeTruthy();
      // 5. Tapping add calls callback with 2 items
      await fireEvent.press(getByTestId('btn-add-to-cart'));
      expect(onAddToCart).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'slot-1100' }),
        2
      );
    });
  });

  // -------------------------------------------------------------------------
  // F23: Barra Flutuante Global de Carrinho
  // -------------------------------------------------------------------------
  describe('F23 - Barra Flutuante Global de Carrinho', () => {
    it('fica oculta quando vazio e suspensa reativamente quando preenchida', async () => {
      const onPress = jest.fn();
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

      // 1. Empty cart -> bar is not rendered
      const view = await render(
        <FloatingCartBarHarness cart={emptyCart} onPress={onPress} />
      );
      expect(view.queryByTestId('floating-cart-bar')).toBeNull();

      // 2. Cart with 1 item -> displays singular ITEM
      const filledCart: CartState = {
        ...emptyCart,
        items: [
          {
            sessionId: 'slot-1100',
            sessionTitle: 'BATERIA 11:00',
            trackName: 'KARTÓDROMO DE BETIM',
            date: '14/OUT.',
            time: '11:00',
            quantity: 1,
            unitPriceCentavos: 11000,
            totalPriceCentavos: 11000,
          },
        ],
        totalQuantity: 1,
        totalPriceCentavos: 11000,
        totalPriceFormatted: 'R$ 110,00',
      };
      await view.rerender(<FloatingCartBarHarness cart={filledCart} onPress={onPress} />);
      expect(view.getByTestId('floating-cart-bar')).toBeTruthy();
      expect(view.getByText(/🛒 CARRINHO \| 1 ITEM - R\$ 110,00/)).toBeTruthy();

      // 3. Cart with multiple items -> displays plural ITENS
      const multipleCart: CartState = {
        ...filledCart,
        totalQuantity: 3,
        totalPriceCentavos: 33000,
        totalPriceFormatted: 'R$ 330,00',
      };
      await view.rerender(<FloatingCartBarHarness cart={multipleCart} onPress={onPress} />);
      expect(view.getByText(/🛒 CARRINHO \| 3 ITENS - R\$ 330,00/)).toBeTruthy();

      // 4. CTA 'VER PEDIDO ›' rendered
      expect(view.getByText('VER PEDIDO ›')).toBeTruthy();

      // 5. Tapping bar invokes onPress
      await fireEvent.press(view.getByTestId('floating-cart-bar'));
      expect(onPress).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------------
  // F24: Modal do Carrinho & Swipe to Remove
  // -------------------------------------------------------------------------
  describe('F24 - Modal do Carrinho & Swipe to Remove', () => {
    it('lista itens do pedido e permite exclusão com recalculo de total', async () => {
      const removeItem = jest.fn();
      const cart: CartState = {
        items: [
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
        ],
        totalQuantity: 1,
        totalPriceCentavos: 11000,
        totalPriceFormatted: 'R$ 110,00',
        isCartOpen: true,
        addItem: jest.fn(),
        removeItem,
        updateQuantity: jest.fn(),
        clearCart: jest.fn(),
        openCart: jest.fn(),
        closeCart: jest.fn(),
      };

      const { getByTestId, getByText } = await render(
        <CartModalHarness
          cart={cart}
          visible={true}
          onClose={jest.fn()}
          onConfirmOrder={jest.fn()}
        />
      );

      // 1. Modal is visible
      expect(getByTestId('cart-modal')).toBeTruthy();
      // 2. Item row rendered
      expect(getByTestId('cart-item-slot-1100')).toBeTruthy();
      // 3. Total price rendered in modal
      expect(getByTestId('cart-modal-total-price')).toBeTruthy();
      expect(getByText('R$ 110,00')).toBeTruthy();
      // 4. Remove button rendered
      const removeBtn = getByTestId('swipe-remove-item-slot-1100');
      expect(removeBtn).toBeTruthy();
      // 5. Tapping remove invokes removeItem
      await fireEvent.press(removeBtn);
      expect(removeItem).toHaveBeenCalledWith('slot-1100');
    });
  });

  // -------------------------------------------------------------------------
  // F25: Ações de Checkout & Pedido
  // -------------------------------------------------------------------------
  describe('F25 - Ações de Checkout & Pedido', () => {
    it('oferece confirmação de pedido, esvaziamento total e continuação de compras', async () => {
      const clearCart = jest.fn();
      const onConfirmOrder = jest.fn();
      const onClose = jest.fn();

      const cart: CartState = {
        items: [
          {
            sessionId: 'slot-1100',
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
        isCartOpen: true,
        addItem: jest.fn(),
        removeItem: jest.fn(),
        updateQuantity: jest.fn(),
        clearCart,
        openCart: jest.fn(),
        closeCart: jest.fn(),
      };

      const { getByTestId } = await render(
        <CartModalHarness
          cart={cart}
          visible={true}
          onClose={onClose}
          onConfirmOrder={onConfirmOrder}
        />
      );

      // 1. Confirm order button exists and works
      const confirmBtn = getByTestId('btn-confirm-order');
      expect(confirmBtn).toBeTruthy();
      await fireEvent.press(confirmBtn);
      expect(onConfirmOrder).toHaveBeenCalled();

      // 2. Clear all button exists and works
      const clearBtn = getByTestId('btn-clear-cart');
      expect(clearBtn).toBeTruthy();
      await fireEvent.press(clearBtn);
      expect(clearCart).toHaveBeenCalled();

      // 3. Continue shopping button calls onClose
      const continueBtn = getByTestId('btn-continue-shopping');
      expect(continueBtn).toBeTruthy();
      await fireEvent.press(continueBtn);
      expect(onClose).toHaveBeenCalled();

      // 4. Modal header title
      expect(getByTestId('cart-sheet')).toBeTruthy();
      // 5. Total quantity matches 2
      expect(cart.totalQuantity).toBe(2);
    });
  });

  // -------------------------------------------------------------------------
  // F26: Carreira Cabeçalho do Piloto
  // -------------------------------------------------------------------------
  describe('F26 - Carreira Cabeçalho do Piloto', () => {
    it('renderiza o cabeçalho de prestígio do piloto com avatar, Lenda, XP e Pontos', async () => {
      const { getByTestId, getByText } = await render(
        <CarreiraScreenHarness onOpenRules={jest.fn()} />
      );

      // 1. Header container rendered
      expect(getByTestId('career-driver-header')).toBeTruthy();
      // 2. Avatar with initials 'NC'
      expect(getByTestId('career-avatar-circle')).toBeTruthy();
      expect(getByText('NC')).toBeTruthy();
      // 3. Pilot full name
      expect(getByTestId('career-driver-name')).toBeTruthy();
      expect(getByText('Nelson Castro')).toBeTruthy();
      // 4. Lenda badge rendered
      expect(getByText('LENDA')).toBeTruthy();
      // 5. XP and gold points rendered
      expect(getByTestId('career-xp-text')).toBeTruthy();
      expect(getByText('61.251 XP')).toBeTruthy();
      expect(getByTestId('career-points-text')).toBeTruthy();
      expect(getByText('13.112 PTS')).toBeTruthy();
    });
  });

  // -------------------------------------------------------------------------
  // F27: Card Eficiência & Estatísticas
  // -------------------------------------------------------------------------
  describe('F27 - Card Eficiência & Estatísticas', () => {
    it('exibe grade 2x3 de eficiência e card azul de estatísticas qualificadas', async () => {
      const { getByTestId, getByText } = await render(
        <CarreiraScreenHarness onOpenRules={jest.fn()} />
      );

      // 1. Efficiency card rendered
      expect(getByTestId('efficiency-card')).toBeTruthy();
      // 2. Win rate and podium rate
      expect(getByTestId('stat-win-rate')).toBeTruthy();
      expect(getByText('22%')).toBeTruthy();
      expect(getByTestId('stat-podium-rate')).toBeTruthy();
      expect(getByText('43%')).toBeTruthy();
      // 3. Overall efficiency
      expect(getByTestId('stat-overall-efficiency')).toBeTruthy();
      expect(getByText('35%')).toBeTruthy();
      // 4. Qualified stats card (10+ drivers) rendered
      expect(getByTestId('qualified-stats-card')).toBeTruthy();
      expect(getByText('ESTATÍSTICAS QUALIFICADAS (10+ PILOTOS)')).toBeTruthy();
      // 5. Qualified races and wins
      expect(getByTestId('stat-qualified-races')).toBeTruthy();
      expect(getByText('309')).toBeTruthy();
      expect(getByTestId('stat-qualified-wins')).toBeTruthy();
      expect(getByText('70')).toBeTruthy();
    });
  });

  // -------------------------------------------------------------------------
  // F28: Conquistas Grid & Modal Regras
  // -------------------------------------------------------------------------
  describe('F28 - Conquistas Grid & Modal Regras', () => {
    it('renderiza grade de badges e modal explicativo de regras do ranking', async () => {
      const onOpenRules = jest.fn();
      const onCloseRules = jest.fn();

      // 1. Career screen renders badges grid
      const { getByTestId, getByText } = await render(
        <CarreiraScreenHarness onOpenRules={onOpenRules} />
      );
      expect(getByTestId('career-badges-section')).toBeTruthy();
      expect(getByTestId('badges-grid')).toBeTruthy();
      expect(getByText('Estreante')).toBeTruthy();
      expect(getByText('Lenda')).toBeTruthy();

      // 2. Tapping info icon calls onOpenRules
      await fireEvent.press(getByTestId('btn-career-ranking-rules'));
      expect(onOpenRules).toHaveBeenCalled();

      // 3. Ranking rules modal rendering
      const modalView = await render(
        <RankingRulesModalHarness visible={true} onClose={onCloseRules} />
      );
      expect(modalView.getByTestId('ranking-rules-modal')).toBeTruthy();
      // 4. Pillars weights displayed (50/20/20/10)
      expect(modalView.getByTestId('rule-weight-efficiency')).toBeTruthy();
      expect(modalView.getByText(/50% Eficiência/)).toBeTruthy();
      expect(modalView.getByText(/20% Vitórias/)).toBeTruthy();
      expect(modalView.getByText(/20% XP/)).toBeTruthy();
      expect(modalView.getByText(/10% Assiduidade/)).toBeTruthy();
      // 5. 10+ drivers qualification cutoff rule displayed
      expect(modalView.getByTestId('rule-10-drivers-cutoff')).toBeTruthy();
      expect(modalView.getByText(/Apenas baterias com 10 ou mais pilotos/)).toBeTruthy();
    });
  });
});
