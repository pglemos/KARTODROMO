import React from 'react';
import { Alert, Linking } from 'react-native';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';

import ParceirosScreen from '../src/app/(tabs)/parceiros';
import { TrackScreen } from '../src/components/track-screen';
import {
  BETIM_LOCAL_STANDINGS_DATA,
  BETIM_TRACK_PARTNER,
  BETIM_TRACK_SESSIONS,
  getBetimLocalStandings,
  getBetimTrackPartner,
  getBetimTrackSessions,
} from '../src/mock/kart-data';

// --- Router Mocks ---
const mockPush = jest.fn();
const mockBack = jest.fn();
const mockReplace = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    back: mockBack,
    replace: mockReplace,
    canGoBack: () => true,
  }),
  useLocalSearchParams: () => ({}),
}));

jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    SafeAreaView: ({ children, ...props }: any) => <View {...props}>{children}</View>,
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
  };
});

describe('ParceirosScreen & Track Profile (Milestone 3)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Linking, 'openURL').mockResolvedValue(true as any);
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  // =========================================================================
  // 1. Track Header, Hero Banner & Visual Identity
  // =========================================================================
  describe('Track Profile Header & Official Identity', () => {
    it('renderiza banner de destaque, badge oficial e título da pista', async () => {
      const { getByTestId, getAllByText, getByText } = await render(<ParceirosScreen />);

      expect(getByTestId('parceiros-screen')).toBeTruthy();
      expect(getByTestId('track-header-banner')).toBeTruthy();
      expect(getByTestId('track-title')).toBeTruthy();
      expect(getByTestId('track-name')).toBeTruthy();
      expect(getAllByText('KARTÓDROMO INTERNACIONAL DE BETIM').length).toBeGreaterThan(0);
      expect(getByText('PARCEIRO OFICIAL HOMOLOGADO')).toBeTruthy();
    });

    it('exibe badge de status da pista e horários de funcionamento', async () => {
      const { getByTestId, getByText } = await render(<ParceirosScreen />);

      expect(getByTestId('track-status-pill')).toBeTruthy();
      expect(getByText('PISTA ABERTA')).toBeTruthy();
      expect(getByText(/Terça a Domingo: 08:00 às 22:00/i)).toBeTruthy();
    });

    it('exibe especificações da pista: 1110m, 1420 eventos e frota Honda 13HP', async () => {
      const { getByText } = await render(<ParceirosScreen />);

      expect(getByText(/1110m de pista/)).toBeTruthy();
      expect(getByText(/1420 eventos/)).toBeTruthy();
      expect(getByText(/Frota Honda 13HP/)).toBeTruthy();
    });

    it('permite favoritar e desfavoritar o kartódromo', async () => {
      const { getByTestId, getByText } = await render(<ParceirosScreen />);

      const favBtn = getByTestId('btn-favorite-track');
      expect(favBtn).toBeTruthy();
      expect(getByText('★')).toBeTruthy();

      // Toggle off
      fireEvent.press(favBtn);
      await waitFor(() => {
        expect(getByText('☆')).toBeTruthy();
      });

      // Toggle on
      fireEvent.press(favBtn);
      await waitFor(() => {
        expect(getByText('★')).toBeTruthy();
      });
    });
  });

  // =========================================================================
  // 2. Quick Action Buttons (Call, WhatsApp, Instagram, Maps)
  // =========================================================================
  describe('Quick Contact & External Actions', () => {
    it('aciona chamada telefônica ao tocar em btn-call-track', async () => {
      const { getByTestId } = await render(<ParceirosScreen />);

      const callBtn = getByTestId('btn-call-track');
      fireEvent.press(callBtn);

      expect(Linking.openURL).toHaveBeenCalledWith(expect.stringContaining('tel:'));
      expect(Linking.openURL).toHaveBeenCalledWith(expect.stringContaining('998842898'));
    });

    it('abre conversa no WhatsApp ao tocar em btn-whatsapp-track', async () => {
      const { getByTestId } = await render(<ParceirosScreen />);

      const waBtn = getByTestId('btn-whatsapp-track');
      fireEvent.press(waBtn);

      expect(Linking.openURL).toHaveBeenCalledWith(expect.stringContaining('wa.me'));
      expect(Linking.openURL).toHaveBeenCalledWith(expect.stringContaining('5531998842898'));
    });

    it('abre perfil do Instagram ao tocar em btn-instagram-track', async () => {
      const { getByTestId } = await render(<ParceirosScreen />);

      const instaBtn = getByTestId('btn-instagram-track');
      fireEvent.press(instaBtn);

      expect(Linking.openURL).toHaveBeenCalledWith(expect.stringContaining('instagram.com'));
      expect(Linking.openURL).toHaveBeenCalledWith(expect.stringContaining('kartbetim'));
    });

    it('abre mapa ao tocar em btn-maps-track', async () => {
      const { getByTestId } = await render(<ParceirosScreen />);

      const mapsBtn = getByTestId('btn-maps-track');
      fireEvent.press(mapsBtn);

      expect(Linking.openURL).toHaveBeenCalledWith(expect.stringMatching(/maps|geo/));
    });

    it('lida com falha de Linking exibindo Alerta amigável', async () => {
      jest.spyOn(Linking, 'openURL').mockRejectedValueOnce(new Error('App not installed'));

      const { getByTestId } = await render(<ParceirosScreen />);
      fireEvent.press(getByTestId('btn-call-track'));

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          expect.any(String),
          expect.stringContaining('Não foi possível')
        );
      });
    });
  });

  // =========================================================================
  // 3. Fast Stats & Metrics Shortcuts
  // =========================================================================
  describe('Fast Stats Shortcuts', () => {
    it('renderiza atalhos de eventos concluídos, recorde da pista e XP', async () => {
      const { getByTestId, getAllByText, getByText } = await render(<ParceirosScreen />);

      expect(getByTestId('track-quick-shortcuts')).toBeTruthy();
      expect(getByTestId('track-stat-events')).toBeTruthy();
      expect(getByTestId('shortcut-eventos')).toBeTruthy();
      expect(getByText(/148/)).toBeTruthy();
      expect(getByText(/EVENTOS/)).toBeTruthy();
      expect(getByText(/Concluídos/)).toBeTruthy();

      expect(getByTestId('track-stat-record')).toBeTruthy();
      expect(getByTestId('shortcut-ranking-pista')).toBeTruthy();
      expect(getByText('RANKING')).toBeTruthy();
      expect(getByText('Recorde da pista')).toBeTruthy();
      expect(getAllByText(/0:38.775/).length).toBeGreaterThan(0);

      expect(getByTestId('track-stat-xp')).toBeTruthy();
      expect(getByTestId('shortcut-ranking-xp')).toBeTruthy();
      expect(getAllByText('XP TOTAL').length).toBeGreaterThan(0);
      expect(getByText('Leaderboard Betim')).toBeTruthy();
    });

    it('navega para /ranking com trackId ao tocar no atalho de XP', async () => {
      const { getByTestId } = await render(<ParceirosScreen />);

      fireEvent.press(getByTestId('track-stat-xp'));
      expect(mockPush).toHaveBeenCalledWith(
        expect.objectContaining({
          pathname: '/ranking',
          params: expect.objectContaining({
            trackId: 'kartodromo-betim',
          }),
        })
      );
    });

    it('navega para /ranking ao tocar no atalho de recorde', async () => {
      const { getByTestId } = await render(<ParceirosScreen />);

      fireEvent.press(getByTestId('track-stat-record'));
      expect(mockPush).toHaveBeenCalledWith(
        expect.objectContaining({
          pathname: '/ranking',
        })
      );
    });
  });

  // =========================================================================
  // 4. Hall da Fama / Local Standings
  // =========================================================================
  describe('Hall da Fama - Top Pilotos Betim', () => {
    it('renderiza os líderes locais com iniciais, bandeiras MG e pontos tabulares', async () => {
      const { getByTestId, getAllByText } = await render(<ParceirosScreen />);

      expect(getByTestId('track-hall-fama')).toBeTruthy();
      expect(getByTestId('track-local-top-pilotos')).toBeTruthy();
      expect(getAllByText('MG').length).toBeGreaterThan(0);
      expect(getAllByText(/PTS/).length).toBeGreaterThan(0);
    });

    it('exibe medalhas de pódio para os 3 primeiros colocados', async () => {
      const { getByText } = await render(<ParceirosScreen />);

      expect(getByText('🥇')).toBeTruthy();
      expect(getByText('🥈')).toBeTruthy();
      expect(getByText('🥉')).toBeTruthy();
    });

    it('permite recarregar o ranking pelo botão de refresh', async () => {
      const { getByTestId } = await render(<ParceirosScreen />);

      const refreshBtn = getByTestId('btn-refresh-local-ranking');
      expect(refreshBtn).toBeTruthy();
      fireEvent.press(refreshBtn);
      await waitFor(() => {
        expect(getByTestId('btn-refresh-local-ranking')).toBeTruthy();
      });
    });

    it('permite ordenar por PONTOS, MELHOR VOLTA e XP TOTAL', async () => {
      const { getByTestId } = await render(<ParceirosScreen />);

      fireEvent.press(getByTestId('local-sort-melhor-volta'));
      await waitFor(() => {
        expect(getByTestId('local-sort-melhor-volta')).toBeTruthy();
      });

      fireEvent.press(getByTestId('local-sort-xp-total'));
      await waitFor(() => {
        expect(getByTestId('local-sort-xp-total')).toBeTruthy();
      });

      fireEvent.press(getByTestId('local-sort-pontos'));
      await waitFor(() => {
        expect(getByTestId('local-sort-pontos')).toBeTruthy();
      });
    });

    it('permite filtrar por categorias (TODOS, LENDA, SEMI-PRO, etc.)', async () => {
      const { getByTestId } = await render(<ParceirosScreen />);

      fireEvent.press(getByTestId('local-filter-semi-pro'));
      await waitFor(() => {
        expect(getByTestId('local-filter-semi-pro')).toBeTruthy();
      });

      fireEvent.press(getByTestId('local-filter-todos'));
      await waitFor(() => {
        expect(getByTestId('local-filter-todos')).toBeTruthy();
      });
    });

    it('navega para o ranking completo ao tocar em "VER MAIS ›"', async () => {
      const { getByTestId } = await render(<ParceirosScreen />);

      const btnVerMais = getByTestId('btn-ver-mais-ranking-local');
      fireEvent.press(btnVerMais);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith(
          expect.objectContaining({
            pathname: '/ranking',
            params: expect.objectContaining({
              trackId: 'kartodromo-betim',
              trackName: 'KARTÓDROMO INTERNACIONAL DE BETIM',
            }),
          })
        );
      });
    });
  });

  // =========================================================================
  // 5. Available Track Sessions / Baterias em Aberto
  // =========================================================================
  describe('Available Sessions (Baterias em Aberto)', () => {
    it('renderiza a seção de baterias com cards individuais', async () => {
      const { getByTestId, getAllByText } = await render(<ParceirosScreen />);

      expect(getByTestId('track-baterias-section')).toBeTruthy();
      expect(getByTestId('session-card-betim-session-1430')).toBeTruthy();
      expect(getAllByText(/R\$ 139,90/).length).toBeGreaterThan(0);
    });

    it('exibe tag verde quando vagas > 5', async () => {
      const { getByTestId, getByText } = await render(<ParceirosScreen />);

      const tagGreen = getByTestId('session-tag-betim-session-1430');
      expect(tagGreen).toBeTruthy();
      expect(getByText(/12 vagas restantes/i)).toBeTruthy();
    });

    it('exibe tag âmbar com "Últimas vagas!" quando vagas <= 3', async () => {
      const { getByTestId, getAllByText } = await render(<ParceirosScreen />);

      const tagAmber = getByTestId('session-tag-betim-session-1800');
      expect(tagAmber).toBeTruthy();
      expect(getAllByText(/Últimas vagas!/i).length).toBeGreaterThan(0);
    });

    it('exibe tag vermelha e desativa botão quando esgotado (vagas = 0)', async () => {
      const { getByTestId, getAllByText } = await render(<ParceirosScreen />);

      const tagRed = getByTestId('session-tag-betim-session-2100');
      expect(tagRed).toBeTruthy();
      expect(getAllByText(/Esgotado/i).length).toBeGreaterThan(0);

      const btnReserve = getByTestId('btn-reservar-bateria-betim-session-2100');
      fireEvent.press(btnReserve);
      // Não deve navegar se esgotado
      expect(mockPush).not.toHaveBeenCalledWith(
        expect.objectContaining({
          params: expect.objectContaining({ sessionId: 'betim-session-2100' }),
        })
      );
    });

    it('navega para /agenda ao tocar em "Reservar Bateria" em sessão disponível', async () => {
      const { getByTestId } = await render(<ParceirosScreen />);

      const btnReserve = getByTestId('btn-reservar-bateria-betim-session-1430');
      fireEvent.press(btnReserve);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith(
          expect.objectContaining({
            pathname: '/agenda',
            params: expect.objectContaining({
              sessionId: 'betim-session-1430',
            }),
          })
        );
      });
    });

    it('navega para /agenda através do CTA "VER HORÁRIOS NA AGENDA ›"', async () => {
      const { getByTestId } = await render(<ParceirosScreen />);

      const btnAgenda = getByTestId('btn-agendar-na-pista');
      fireEvent.press(btnAgenda);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/agenda');
      });
    });
  });

  // =========================================================================
  // 6. Backwards Compatibility with E2E Harness
  // =========================================================================
  describe('E2E Harness Backwards Compatibility', () => {
    it('garante presença de todos os testIDs exigidos pelos Tiers 1-4 de E2E', async () => {
      const { getByTestId } = await render(<ParceirosScreen />);

      expect(getByTestId('screen-parceiro')).toBeTruthy();
      expect(getByTestId('track-header')).toBeTruthy();
      expect(getByTestId('track-name')).toBeTruthy();
      expect(getByTestId('track-phone')).toBeTruthy();
      expect(getByTestId('track-quick-shortcuts')).toBeTruthy();
      expect(getByTestId('shortcut-eventos')).toBeTruthy();
      expect(getByTestId('shortcut-ranking-pista')).toBeTruthy();
      expect(getByTestId('shortcut-ranking-xp')).toBeTruthy();
      expect(getByTestId('track-local-top-pilotos')).toBeTruthy();
      expect(getByTestId('track-reservations-section')).toBeTruthy();
      expect(getByTestId('reservation-date-label')).toBeTruthy();
      expect(getByTestId('btn-agendar-na-pista')).toBeTruthy();
    });
  });

  // =========================================================================
  // 7. Data Layer Helper Functions
  // =========================================================================
  describe('Betim Data Helpers', () => {
    it('getBetimTrackPartner retorna BETIM_TRACK_PARTNER válido', () => {
      const partner = getBetimTrackPartner();
      expect(partner.id).toBe('kartodromo-betim');
      expect(partner.name).toBe('KARTÓDROMO INTERNACIONAL DE BETIM');
      expect(partner.stats.trackLengthMeters).toBe(1110);
      expect(partner.stats.totalEventsFinished).toBe(148);
    });

    it('getBetimTrackSessions retorna lista de sessões com preços e vagas', () => {
      const sessions = getBetimTrackSessions();
      expect(sessions.length).toBeGreaterThanOrEqual(4);
      expect(sessions[0].priceFormatted).toBe('R$ 139,90');
    });

    it('getBetimLocalStandings retorna lista dos top pilotos locais com volta mais rápida', () => {
      const standings = getBetimLocalStandings();
      expect(standings.length).toBeGreaterThanOrEqual(5);
      expect(standings[0].bestLap).toBeDefined();
    });
  });

  // =========================================================================
  // 8. Custom Props & Edge Cases
  // =========================================================================
  describe('Custom Props & Component Flexibility', () => {
    it('executa callback onNavigateAgenda personalizado se fornecido', async () => {
      const onNavigateAgenda = jest.fn();
      const { getByTestId } = await render(<TrackScreen onNavigateAgenda={onNavigateAgenda} />);

      fireEvent.press(getByTestId('btn-agendar-na-pista'));
      await waitFor(() => {
        expect(onNavigateAgenda).toHaveBeenCalledTimes(1);
      });
    });

    it('executa callback onOpenRanking personalizado se fornecido', async () => {
      const onOpenRanking = jest.fn();
      const { getByTestId } = await render(<TrackScreen onOpenRanking={onOpenRanking} />);

      fireEvent.press(getByTestId('track-stat-xp'));
      await waitFor(() => {
        expect(onOpenRanking).toHaveBeenCalledTimes(1);
      });
    });
  });
});
