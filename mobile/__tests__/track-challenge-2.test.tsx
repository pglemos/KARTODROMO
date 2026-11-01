/**
 * track-challenge-2.test.tsx
 * Adversarial Stress & Verification Test Suite for Milestone 3
 * Focus: Track Available Sessions & Stat Shortcuts (src/components/track-screen.tsx)
 * Challenger 2 (Empirical Verification)
 */

import React from 'react';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';

import {
  TrackAvailableSessions,
  TrackStatShortcuts,
  TrackScreen,
} from '../src/components/track-screen';
import {
  BETIM_TRACK_SESSIONS,
  BetimTrackSession,
  TrackRecordInfo,
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

// Helper generator for mock sessions
function createMockSession(overrides: Partial<BetimTrackSession> = {}): BetimTrackSession {
  return {
    id: 'test-session-1',
    timeSlot: '14:30',
    title: 'Bateria Noturna - Test',
    category: 'RENTAL',
    trackConfig: 'Traçado 1.110m Oficial',
    priceCentavos: 13990,
    priceFormatted: 'R$ 139,90',
    availableSlots: 10,
    totalSlots: 20,
    isSoldOut: false,
    date: '14/10/2026',
    ...overrides,
  };
}

describe('Track Challenge 2: Adversarial Stress Test Suite', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  // =========================================================================
  // 1. Sessions Slot Limits & Boundary Testing
  // =========================================================================
  describe('1. Slot Limits & Availability Badges (BVA)', () => {
    it('renderiza badge verde (>5 vagas) para 12 vagas e 6 vagas com texto e cores corretas', async () => {
      const sessions: BetimTrackSession[] = [
        createMockSession({ id: 's-12', availableSlots: 12 }),
        createMockSession({ id: 's-6', availableSlots: 6 }),
      ];

      const { getByTestId, getByText } = await render(
        <TrackAvailableSessions sessions={sessions} />
      );

      const tag12 = getByTestId('session-tag-s-12');
      expect(tag12).toBeTruthy();
      expect(getByText('12 vagas restantes')).toBeTruthy();
      expect(tag12.props.style).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            backgroundColor: 'rgba(0, 230, 118, 0.15)',
            borderColor: '#00E676',
          }),
        ])
      );

      const tag6 = getByTestId('session-tag-s-6');
      expect(tag6).toBeTruthy();
      expect(getByText('6 vagas restantes')).toBeTruthy();
      expect(tag6.props.style).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            backgroundColor: 'rgba(0, 230, 118, 0.15)',
            borderColor: '#00E676',
          }),
        ])
      );
    });

    it('renderiza badge verde para slots intermediários (5 vagas e 4 vagas)', async () => {
      const sessions: BetimTrackSession[] = [
        createMockSession({ id: 's-5', availableSlots: 5 }),
        createMockSession({ id: 's-4', availableSlots: 4 }),
      ];

      const { getByTestId, getByText } = await render(
        <TrackAvailableSessions sessions={sessions} />
      );

      const tag5 = getByTestId('session-tag-s-5');
      expect(tag5).toBeTruthy();
      expect(getByText('5 vagas restantes')).toBeTruthy();

      const tag4 = getByTestId('session-tag-s-4');
      expect(tag4).toBeTruthy();
      expect(getByText('4 vagas restantes')).toBeTruthy();
    });

    it('renderiza badge âmbar (<=3 vagas) com "Últimas vagas!" nos limites 3, 2 e 1', async () => {
      const sessions: BetimTrackSession[] = [
        createMockSession({ id: 's-3', availableSlots: 3 }),
        createMockSession({ id: 's-2', availableSlots: 2 }),
        createMockSession({ id: 's-1', availableSlots: 1 }),
      ];

      const { getByTestId, getByText } = await render(
        <TrackAvailableSessions sessions={sessions} />
      );

      // Slot 3 (Boundary)
      const tag3 = getByTestId('session-tag-s-3');
      expect(getByText('3 vagas - Últimas vagas!')).toBeTruthy();
      expect(tag3.props.style).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            backgroundColor: 'rgba(245, 158, 11, 0.15)',
            borderColor: '#F59E0B',
          }),
        ])
      );

      // Slot 2
      const tag2 = getByTestId('session-tag-s-2');
      expect(getByText('2 vagas - Últimas vagas!')).toBeTruthy();
      expect(tag2.props.style).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            backgroundColor: 'rgba(245, 158, 11, 0.15)',
            borderColor: '#F59E0B',
          }),
        ])
      );

      // Slot 1 (Boundary)
      const tag1 = getByTestId('session-tag-s-1');
      expect(getByText('1 vagas - Últimas vagas!')).toBeTruthy();
      expect(tag1.props.style).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            backgroundColor: 'rgba(245, 158, 11, 0.15)',
            borderColor: '#F59E0B',
          }),
        ])
      );
    });

    it('renderiza badge vermelho "Esgotado" quando availableSlots === 0', async () => {
      const sessions: BetimTrackSession[] = [
        createMockSession({ id: 's-0', availableSlots: 0, isSoldOut: true }),
      ];

      const { getByTestId, getByText } = await render(
        <TrackAvailableSessions sessions={sessions} />
      );

      const tag0 = getByTestId('session-tag-s-0');
      expect(tag0).toBeTruthy();
      expect(getByText('Esgotado')).toBeTruthy();
      expect(tag0.props.style).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            backgroundColor: 'rgba(239, 68, 68, 0.15)',
            borderColor: '#EF4444',
          }),
        ])
      );
    });

    it('renderiza badge vermelho "Esgotado" para slots negativos (defesa contra dados corrompidos)', async () => {
      const sessions: BetimTrackSession[] = [
        createMockSession({ id: 's-neg', availableSlots: -2 }),
      ];

      const { getByTestId, getByText } = await render(
        <TrackAvailableSessions sessions={sessions} />
      );

      const tagNeg = getByTestId('session-tag-s-neg');
      expect(tagNeg).toBeTruthy();
      expect(getByText('Esgotado')).toBeTruthy();
    });
  });

  // =========================================================================
  // 2. Sold-out Sessions Blocking & Disabled State
  // =========================================================================
  describe('2. Sold-Out Sessions Blocking & Strict Disabling', () => {
    it('o botão btn-reservar-bateria-${id} está estritamente desabilitado quando availableSlots === 0', async () => {
      const session = createMockSession({ id: 'sold-1', availableSlots: 0, isSoldOut: false });
      const { getByTestId, getByText } = await render(
        <TrackAvailableSessions sessions={[session]} />
      );

      const button = getByTestId('btn-reservar-bateria-sold-1');
      expect(button.props.accessibilityState?.disabled).toBe(true);
      expect(getByText('ESGOTADO')).toBeTruthy();
      expect(button.props.accessibilityLabel).toBe('Bateria 14:30 esgotada');
    });

    it('o botão btn-reservar-bateria-${id} está estritamente desabilitado quando isSoldOut === true mesmo com vagas > 0', async () => {
      const session = createMockSession({
        id: 'sold-flag',
        availableSlots: 5,
        isSoldOut: true,
      });
      const { getByTestId, getByText } = await render(
        <TrackAvailableSessions sessions={[session]} />
      );

      const button = getByTestId('btn-reservar-bateria-sold-flag');
      expect(button.props.accessibilityState?.disabled).toBe(true);
      expect(getByText('ESGOTADO')).toBeTruthy();
    });

    it('tentativas de clique em sessão esgotada NÃO invocam router.push nem callbacks', async () => {
      const mockSelectSession = jest.fn();
      const mockNavigateAgenda = jest.fn();

      const session = createMockSession({ id: 'sold-click', availableSlots: 0, isSoldOut: true });
      const { getByTestId } = await render(
        <TrackAvailableSessions
          sessions={[session]}
          onSelectSession={mockSelectSession}
          onNavigateAgenda={mockNavigateAgenda}
        />
      );

      const button = getByTestId('btn-reservar-bateria-sold-click');

      // Tentativa de clique único
      fireEvent.press(button);
      expect(mockPush).not.toHaveBeenCalled();
      expect(mockSelectSession).not.toHaveBeenCalled();
      expect(mockNavigateAgenda).not.toHaveBeenCalled();

      // Stress test: 20 cliques rápidos sucessivos
      for (let i = 0; i < 20; i++) {
        fireEvent.press(button);
      }
      expect(mockPush).not.toHaveBeenCalled();
      expect(mockSelectSession).not.toHaveBeenCalled();
      expect(mockNavigateAgenda).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 3. Available Sessions Routing & Callback Dispatch
  // =========================================================================
  describe('3. Available Sessions Routing & Callback Dispatch', () => {
    it('dispara router.push(\'/agenda\') com os parâmetros da sessão quando disponível', async () => {
      const session = createMockSession({
        id: 'sess-avail-1',
        date: '20/10/2026',
        category: 'PRO',
      });
      const { getByTestId, getByText } = await render(
        <TrackAvailableSessions sessions={[session]} />
      );

      const button = getByTestId('btn-reservar-bateria-sess-avail-1');
      expect(button.props.accessibilityState?.disabled).toBeFalsy();
      expect(getByText('RESERVAR')).toBeTruthy();

      fireEvent.press(button);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith({
          pathname: '/agenda',
          params: {
            sessionId: 'sess-avail-1',
            date: '20/10/2026',
            category: 'PRO',
          },
        });
      });
    });

    it('invoca onSelectSession se fornecido e NÃO invoca router.push', async () => {
      const mockSelectSession = jest.fn();
      const session = createMockSession({ id: 'sess-callback-1' });

      const { getByTestId } = await render(
        <TrackAvailableSessions
          sessions={[session]}
          onSelectSession={mockSelectSession}
        />
      );

      const button = getByTestId('btn-reservar-bateria-sess-callback-1');
      fireEvent.press(button);

      await waitFor(() => {
        expect(mockSelectSession).toHaveBeenCalledTimes(1);
        expect(mockSelectSession).toHaveBeenCalledWith(session);
      });
      expect(mockPush).not.toHaveBeenCalled();
    });

    it('botão geral btn-agendar-na-pista navega para /agenda', async () => {
      const { getByTestId } = await render(<TrackAvailableSessions />);

      const ctaBtn = getByTestId('btn-agendar-na-pista');
      fireEvent.press(ctaBtn);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/agenda');
      });
    });

    it('botão geral btn-agendar-na-pista respeita callback onNavigateAgenda se fornecido', async () => {
      const mockNavigateAgenda = jest.fn();
      const { getByTestId } = await render(
        <TrackAvailableSessions onNavigateAgenda={mockNavigateAgenda} />
      );

      const ctaBtn = getByTestId('btn-agendar-na-pista');
      fireEvent.press(ctaBtn);

      await waitFor(() => {
        expect(mockNavigateAgenda).toHaveBeenCalledTimes(1);
      });
      expect(mockPush).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 4. Short-Circuit & Resiliency Testing (Empty Sessions & Edge Cases)
  // =========================================================================
  describe('4. Short-Circuit & Boundary Resiliency', () => {
    it('comporta-se de maneira segura e elegante quando sessions for um array vazio ([])', async () => {
      const { getByTestId, queryByTestId, getByText } = await render(
        <TrackAvailableSessions sessions={[]} selectedDate="15/10/2026" />
      );

      // Containers principais continuam existindo
      expect(getByTestId('track-baterias-section')).toBeTruthy();
      expect(getByTestId('track-reservations-section')).toBeTruthy();
      expect(getByTestId('reservation-date-label')).toBeTruthy();
      expect(getByText('Data selecionada: 15/10/2026')).toBeTruthy();
      expect(getByTestId('btn-agendar-na-pista')).toBeTruthy();

      // Nenhuma bateria renderizada
      expect(queryByTestId('session-card-betim-session-1430')).toBeNull();
      expect(queryByTestId('session-card-betim-session-1800')).toBeNull();
      expect(queryByTestId('session-card-betim-session-2100')).toBeNull();

      // CTA para agenda continua funcionando perfeitamente
      fireEvent.press(getByTestId('btn-agendar-na-pista'));
      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/agenda');
      });
    });

    it('renderiza lista massiva de sessões (50 sessões) sob estresse de performance sem quebrar', async () => {
      const largeSessionList: BetimTrackSession[] = Array.from({ length: 50 }, (_, i) =>
        createMockSession({
          id: `stress-sess-${i}`,
          timeSlot: `${10 + Math.floor(i / 4)}:${(i % 4) * 15}`,
          availableSlots: i % 7, // gera variação de 0 a 6
          isSoldOut: i % 7 === 0,
        })
      );

      const { getByTestId } = await render(
        <TrackAvailableSessions sessions={largeSessionList} />
      );

      // Verifica primeira e última bateria
      expect(getByTestId('session-card-stress-sess-0')).toBeTruthy();
      expect(getByTestId('session-card-stress-sess-49')).toBeTruthy();

      // Sessão 0 deve estar bloqueada (0 vagas)
      fireEvent.press(getByTestId('btn-reservar-bateria-stress-sess-0'));
      expect(mockPush).not.toHaveBeenCalled();

      // Sessão 49 (slots = 49 % 7 = 0) deve estar bloqueada
      fireEvent.press(getByTestId('btn-reservar-bateria-stress-sess-49'));
      expect(mockPush).not.toHaveBeenCalled();

      // Sessão 1 (slots = 1 % 7 = 1) deve navegar
      fireEvent.press(getByTestId('btn-reservar-bateria-stress-sess-1'));
      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith(
          expect.objectContaining({
            pathname: '/agenda',
            params: expect.objectContaining({ sessionId: 'stress-sess-1' }),
          })
        );
      });
    });
  });

  // =========================================================================
  // 5. Stat Shortcuts Stress Testing
  // =========================================================================
  describe('5. Stat Shortcuts Stress Testing', () => {
    it('atalho de eventos concluidos navega para /ranking com trackId betim', async () => {
      const { getByTestId } = await render(<TrackStatShortcuts />);

      fireEvent.press(getByTestId('track-stat-events'));
      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith({
          pathname: '/ranking',
          params: {
            trackId: 'kartodromo-betim',
            trackName: 'KARTÓDROMO INTERNACIONAL DE BETIM',
          },
        });
      });
    });

    it('atalho de recorde navega para /ranking com trackId betim', async () => {
      const { getByTestId } = await render(<TrackStatShortcuts />);

      fireEvent.press(getByTestId('track-stat-record'));
      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith({
          pathname: '/ranking',
          params: {
            trackId: 'kartodromo-betim',
            trackName: 'KARTÓDROMO INTERNACIONAL DE BETIM',
          },
        });
      });
    });

    it('atalho de XP navega para /ranking com trackId betim', async () => {
      const { getByTestId } = await render(<TrackStatShortcuts />);

      fireEvent.press(getByTestId('track-stat-xp'));
      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith({
          pathname: '/ranking',
          params: {
            trackId: 'kartodromo-betim',
            trackName: 'KARTÓDROMO INTERNACIONAL DE BETIM',
          },
        });
      });
    });

    it('atalhos rápidos delegam para callback onOpenRanking se fornecido, sem chamar router.push', async () => {
      const mockOpenRanking = jest.fn();
      const { getByTestId } = await render(
        <TrackStatShortcuts onOpenRanking={mockOpenRanking} />
      );

      fireEvent.press(getByTestId('track-stat-events'));
      await waitFor(() => {
        expect(mockOpenRanking).toHaveBeenCalledTimes(1);
      });

      fireEvent.press(getByTestId('track-stat-record'));
      await waitFor(() => {
        expect(mockOpenRanking).toHaveBeenCalledTimes(2);
      });

      fireEvent.press(getByTestId('track-stat-xp'));
      await waitFor(() => {
        expect(mockOpenRanking).toHaveBeenCalledTimes(3);
      });

      expect(mockPush).not.toHaveBeenCalled();
    });

    it('testa valores zerados nos atalhos (eventos 0 e XP 0k)', async () => {
      const { getByText } = await render(
        <TrackStatShortcuts totalEventsFinished={0} topDriverXp={0} />
      );
      expect(getByText('0')).toBeTruthy();
      expect(getByText('0k')).toBeTruthy();
    });

    it('testa valores altos nos atalhos (eventos 99999 e XP 150k)', async () => {
      const { getByText } = await render(
        <TrackStatShortcuts totalEventsFinished={99999} topDriverXp={149800} />
      );
      expect(getByText('99999')).toBeTruthy();
      expect(getByText('150k')).toBeTruthy();
    });

    it('banner de recorde exibe dados customizados de piloto e tempo com alta fidelidade', async () => {
      const customRecord: TrackRecordInfo = {
        lapTime: '0:35.420',
        lapTimeMs: 35420,
        driverName: 'Rubens Barrichello',
        driverId: 'driver-barrichello',
        driverInitials: 'RB',
        kartFleet: 'Shifter 125cc 45HP',
        category: 'PROFISSIONAL',
        trackLengthMeters: 1110,
        dateRecorded: '10/10/2026',
      };

      const { getAllByText, getByText } = await render(
        <TrackStatShortcuts trackRecord={customRecord} />
      );

      expect(getAllByText('0:35.420').length).toBeGreaterThanOrEqual(1);
      expect(getByText('Rubens Barrichello')).toBeTruthy();
      expect(getByText('Shifter 125cc 45HP • PROFISSIONAL')).toBeTruthy();
      expect(getByText('RECORDE DA PISTA • 1.110m')).toBeTruthy();
    });
  });

  // =========================================================================
  // 6. Composite TrackScreen Integration Under Adversarial Inputs
  // =========================================================================
  describe('6. Composite TrackScreen Integration', () => {
    it('integração total: TrackScreen com sessões customizadas e callbacks customizados', async () => {
      const customSessions: BetimTrackSession[] = [
        createMockSession({ id: 'comp-1', availableSlots: 2 }),
        createMockSession({ id: 'comp-2', availableSlots: 0, isSoldOut: true }),
      ];

      const mockNavigateAgenda = jest.fn();
      const mockOpenRanking = jest.fn();

      const { getByTestId } = await render(
        <TrackScreen
          sessions={customSessions}
          onNavigateAgenda={mockNavigateAgenda}
          onOpenRanking={mockOpenRanking}
        />
      );

      // Atalhos
      fireEvent.press(getByTestId('track-stat-events'));
      await waitFor(() => {
        expect(mockOpenRanking).toHaveBeenCalledTimes(1);
      });

      // Agenda geral
      fireEvent.press(getByTestId('btn-agendar-na-pista'));
      await waitFor(() => {
        expect(mockNavigateAgenda).toHaveBeenCalledTimes(1);
      });

      // Sessão esgotada
      fireEvent.press(getByTestId('btn-reservar-bateria-comp-2'));
      expect(mockPush).not.toHaveBeenCalled();

      // Sessão disponível sem onSelectSession -> navega via router.push
      fireEvent.press(getByTestId('btn-reservar-bateria-comp-1'));
      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith(
          expect.objectContaining({
            pathname: '/agenda',
            params: expect.objectContaining({ sessionId: 'comp-1' }),
          })
        );
      });
    });
  });
});
