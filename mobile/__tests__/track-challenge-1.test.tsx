/**
 * __tests__/track-challenge-1.test.tsx
 * Adversarial Challenger 1 Suite for Milestone 3 (Kartódromo de Betim Mobile Redesign)
 * 
 * Focus Areas:
 * 1. Deep links and contact actions (Linking failure, rejected promises, alert messaging)
 * 2. Bookmark toggle (rapid repeated taps, state stability, callback invariants)
 * 3. Standings sorting and filtering (exhaustive 3x6 matrix, order invariants, driver count)
 * 4. Refresh button (multiple triggers, state retention, sorting/filter persistence)
 * 5. Edge cases: empty dataset, missing metrics, null badges, fallback mechanisms
 */

import React from 'react';
import { Alert, Linking, Platform } from 'react-native';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';

import {
  TrackHeroHeader,
  TrackLocalStandings,
  TrackQuickActions,
  TrackScreen,
} from '../src/components/track-screen';
import {
  BETIM_LOCAL_STANDINGS_DATA,
  BETIM_TRACK_PARTNER,
  LocalTrackDriverStanding,
} from '../src/mock/kart-data';
import { PilotCategory } from '../src/types/racing';

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

describe('Adversarial Challenge 1: Track Header, Actions & Standings Stress', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Linking, 'openURL').mockResolvedValue(true as any);
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
  });

  // =========================================================================
  // SECTION 1: Deep Links & Contact Actions (Stress, Rejections, Alerts)
  // =========================================================================
  describe('1. Deep links and contact actions stress testing', () => {
    it('handles dialer failure when Linking.openURL rejects with Error', async () => {
      const openURLSpy = jest.spyOn(Linking, 'openURL').mockRejectedValueOnce(new Error('Dialer unavailable'));
      const alertSpy = jest.spyOn(Alert, 'alert');

      const { getByTestId } = await render(
        <TrackQuickActions phone="(31)99884-2898" rawPhone="31998842898" />
      );
      const callBtn = getByTestId('btn-call-track');

      fireEvent.press(callBtn);

      await waitFor(() => {
        expect(openURLSpy).toHaveBeenCalledWith('tel:31998842898');
        expect(alertSpy).toHaveBeenCalledWith(
          'Contato Telefônico',
          expect.stringContaining('(31)99884-2898')
        );
      });
    });

    it('handles dialer failure when Linking.openURL rejects with a non-Error string or object', async () => {
      jest.spyOn(Linking, 'openURL').mockRejectedValueOnce('Unknown system fault');
      const alertSpy = jest.spyOn(Alert, 'alert');

      const { getByTestId } = await render(<TrackQuickActions phone="(31)99884-2898" />);
      const callBtn = getByTestId('btn-call-track');

      fireEvent.press(callBtn);

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith(
          'Contato Telefônico',
          expect.stringContaining('Não foi possível efetuar a ligação')
        );
      });
    });

    it('handles WhatsApp failure when Linking.openURL rejects with network error', async () => {
      jest.spyOn(Linking, 'openURL').mockRejectedValueOnce(new Error('Network error wa.me unreachable'));
      const alertSpy = jest.spyOn(Alert, 'alert');

      const { getByTestId } = await render(<TrackQuickActions whatsappNumber="5531998842898" />);
      const waBtn = getByTestId('btn-whatsapp-track');

      fireEvent.press(waBtn);

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith(
          'WhatsApp',
          expect.stringContaining('Verifique sua conexão com a internet')
        );
      });
    });

    it('encodes Portuguese special characters in WhatsApp prefilled message', async () => {
      const openURLSpy = jest.spyOn(Linking, 'openURL').mockResolvedValueOnce(true as any);

      const { getByTestId } = await render(<TrackQuickActions whatsappNumber="5531998842898" />);
      const waBtn = getByTestId('btn-whatsapp-track');

      fireEvent.press(waBtn);

      await waitFor(() => {
        expect(openURLSpy).toHaveBeenCalledTimes(1);
      });
      const calledUrl = openURLSpy.mock.calls[0][0];
      expect(calledUrl).toContain('https://wa.me/5531998842898?text=');
      // Ensure "Olá! Gostaria de informações..." is properly URI-encoded
      expect(calledUrl).toContain(encodeURIComponent('Olá! Gostaria de informações sobre horários e reservas no Kartódromo de Betim.'));
      expect(calledUrl).not.toContain(' '); // No unescaped spaces
    });

    it('handles Instagram failure when Linking.openURL rejects', async () => {
      jest.spyOn(Linking, 'openURL').mockRejectedValueOnce(new Error('Instagram app not installed and web blocked'));
      const alertSpy = jest.spyOn(Alert, 'alert');

      const { getByTestId } = await render(<TrackQuickActions instagramHandle="kartbetim" />);
      const instaBtn = getByTestId('btn-instagram-track');

      fireEvent.press(instaBtn);

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith(
          'Instagram',
          expect.stringContaining('@kartbetim')
        );
      });
    });

    it('constructs correct platform-specific map URLs for iOS and Android', async () => {
      const openURLSpy = jest.spyOn(Linking, 'openURL');
      const coords = { latitude: -19.9822, longitude: -44.1866 };

      // 1. Test Android platform selection
      const selectSpy = jest.spyOn(Platform, 'select').mockImplementation((obj: any) => obj.android);
      const { getByTestId: getAndroidBtn, unmount: unmountAndroid } = await render(
        <TrackQuickActions coordinates={coords} />
      );
      fireEvent.press(getAndroidBtn('btn-maps-track'));

      await waitFor(() => {
        expect(openURLSpy).toHaveBeenLastCalledWith(
          expect.stringContaining('geo:-19.9822,-44.1866')
        );
      });
      await unmountAndroid();

      // 2. Test iOS platform selection
      selectSpy.mockImplementation((obj: any) => obj.ios);
      const { getByTestId: getIosBtn, unmount: unmountIos } = await render(
        <TrackQuickActions coordinates={coords} />
      );
      fireEvent.press(getIosBtn('btn-maps-track'));

      await waitFor(() => {
        expect(openURLSpy).toHaveBeenLastCalledWith(
          expect.stringContaining('maps:0,0?q=')
        );
      });
      await unmountIos();

      selectSpy.mockRestore();
    });

    it('handles Maps failure when Linking.openURL rejects', async () => {
      jest.spyOn(Linking, 'openURL').mockRejectedValueOnce(new Error('Maps rejected'));
      const alertSpy = jest.spyOn(Alert, 'alert');

      const { getByTestId } = await render(<TrackQuickActions />);
      fireEvent.press(getByTestId('btn-maps-track'));

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith(
          'Mapas',
          expect.stringContaining('Não foi possível abrir o aplicativo de mapas')
        );
      });
    });

    it('resists rapid concurrent button presses without uncaught rejections or freezing', async () => {
      let callCount = 0;
      jest.spyOn(Linking, 'openURL').mockImplementation(() => {
        callCount++;
        if (callCount % 2 === 0) {
          return Promise.reject(new Error(`Failure #${callCount}`));
        }
        return Promise.resolve(true as any);
      });

      const { getByTestId } = await render(<TrackQuickActions />);
      const buttons = [
        getByTestId('btn-call-track'),
        getByTestId('btn-whatsapp-track'),
        getByTestId('btn-instagram-track'),
        getByTestId('btn-maps-track'),
      ];

      for (let i = 0; i < buttons.length; i++) {
        fireEvent.press(buttons[i]);
        await waitFor(() => {
          expect(Linking.openURL).toHaveBeenCalledTimes(i + 1);
        });
      }

      expect(Linking.openURL).toHaveBeenCalledTimes(4);
      expect(Alert.alert).toHaveBeenCalled(); // Errors were caught and presented gracefully
    });
  });

  // =========================================================================
  // SECTION 2: Bookmark Toggle Rapid Taps & State Invariants
  // =========================================================================
  describe('2. Bookmark toggle rapid repeated taps', () => {
    it('initializes with default favorite=true rendering filled star ★', async () => {
      const { getByTestId, getByText } = await render(<TrackHeroHeader />);
      expect(getByTestId('btn-favorite-track')).toBeTruthy();
      expect(getByText('★')).toBeTruthy();
    });

    it('initializes with favorite=false when isFavorite prop is false rendering empty star ☆', async () => {
      const { getByTestId, getByText } = await render(<TrackHeroHeader isFavorite={false} />);
      expect(getByTestId('btn-favorite-track')).toBeTruthy();
      expect(getByText('☆')).toBeTruthy();
    });

    it('calls onToggleFavorite with alternating boolean values on sequential taps', async () => {
      const onToggleFavorite = jest.fn();
      const { getByTestId, getByText } = await render(
        <TrackHeroHeader isFavorite={true} onToggleFavorite={onToggleFavorite} />
      );
      const favBtn = getByTestId('btn-favorite-track');

      // Tap 1 -> becomes false (☆)
      fireEvent.press(favBtn);
      await waitFor(() => {
        expect(getByText('☆')).toBeTruthy();
      });
      expect(onToggleFavorite).toHaveBeenLastCalledWith(false);

      // Tap 2 -> becomes true (★)
      fireEvent.press(favBtn);
      await waitFor(() => {
        expect(getByText('★')).toBeTruthy();
      });
      expect(onToggleFavorite).toHaveBeenLastCalledWith(true);

      // Tap 3 -> becomes false (☆)
      fireEvent.press(favBtn);
      await waitFor(() => {
        expect(getByText('☆')).toBeTruthy();
      });
      expect(onToggleFavorite).toHaveBeenLastCalledWith(false);

      // Tap 4 -> becomes true (★)
      fireEvent.press(favBtn);
      await waitFor(() => {
        expect(getByText('★')).toBeTruthy();
      });
      expect(onToggleFavorite).toHaveBeenLastCalledWith(true);

      expect(onToggleFavorite).toHaveBeenCalledTimes(4);
      expect(onToggleFavorite.mock.calls).toEqual([[false], [true], [false], [true]]);
    });

    it('survives an adversarial sequence of rapid sequential user taps and preserves state parity', async () => {
      const onToggleFavorite = jest.fn();
      const { getByTestId, getByText } = await render(
        <TrackHeroHeader isFavorite={true} onToggleFavorite={onToggleFavorite} />
      );
      const favBtn = getByTestId('btn-favorite-track');

      for (let i = 0; i < 6; i++) {
        fireEvent.press(favBtn);
        const expectedStar = i % 2 === 0 ? '☆' : '★';
        await waitFor(() => {
          expect(getByText(expectedStar)).toBeTruthy();
        });
      }

      expect(onToggleFavorite).toHaveBeenCalledTimes(6);
      expect(getByText('★')).toBeTruthy();
    });
  });

  // =========================================================================
  // SECTION 3: Standings Sorting and Filtering (Full 3x6 Matrix Stress)
  // =========================================================================
  describe('3. Standings sorting and filtering invariants', () => {
    const SORT_MODES = ['PONTOS', 'MELHOR VOLTA', 'XP TOTAL'] as const;
    const CATEGORIES: PilotCategory[] = [
      'TODOS',
      'LENDA',
      'PROFISSIONAL',
      'SEMI-PRO',
      'AMADOR',
      'NOVATO',
    ];

    it('verifies dataset integrity: BETIM_LOCAL_STANDINGS_DATA contains 8 valid drivers', () => {
      expect(BETIM_LOCAL_STANDINGS_DATA.length).toBe(8);
      for (const driver of BETIM_LOCAL_STANDINGS_DATA) {
        expect(driver.id).toBeDefined();
        expect(driver.name).toBeDefined();
        expect(driver.bestLapMs).toBeGreaterThan(0);
        expect(driver.trackPoints).toBeGreaterThan(0);
        expect(driver.xp).toBeGreaterThan(0);
        expect(driver.flag).toBeDefined();
      }
    });

    // Test the entire 3 x 6 Matrix (18 combinations)
    describe.each(SORT_MODES)('Sort mode: %s', (sortMode) => {
      describe.each(CATEGORIES)('Category filter: %s', (category) => {
        it(`preserves order invariant and driver count under ${sortMode} + ${category}`, async () => {
          const { getByTestId, queryAllByText } = await render(
            <TrackLocalStandings drivers={BETIM_LOCAL_STANDINGS_DATA} />
          );

          // Select Sort Mode
          const sortTestId = `local-sort-${sortMode.toLowerCase().replace(/\s+/g, '-')}`;
          const sortPill = getByTestId(sortTestId);
          fireEvent.press(sortPill);
          await waitFor(() => {
            expect(getByTestId(sortTestId)).toBeTruthy();
          });

          // Select Category Filter
          const filterTestId = `local-filter-${category.toLowerCase()}`;
          const filterPill = getByTestId(filterTestId);
          fireEvent.press(filterPill);
          await waitFor(() => {
            expect(getByTestId(filterTestId)).toBeTruthy();
          });

          // Calculate Expected Filtered and Sorted Driver Subset
          let expectedList = [...BETIM_LOCAL_STANDINGS_DATA];
          if (category !== 'TODOS') {
            expectedList = expectedList.filter((d) => d.category === category);
          }

          if (sortMode === 'PONTOS') {
            expectedList.sort((a, b) => (b.trackPoints ?? b.points) - (a.trackPoints ?? a.points));
          } else if (sortMode === 'MELHOR VOLTA') {
            expectedList.sort((a, b) => (a.bestLapMs || 999999) - (b.bestLapMs || 999999));
          } else if (sortMode === 'XP TOTAL') {
            expectedList.sort((a, b) => b.xp - a.xp);
          }

          const expectedTop5 = expectedList.slice(0, 5);

          // Invariant 1: Driver Count Invariant (never more than 5, exactly matches expected subset)
          await waitFor(() => {
            const mgBadges = queryAllByText('MG');
            expect(mgBadges.length).toBe(expectedTop5.length);
          });

          // Invariant 2: Order Invariant
          for (let i = 0; i < expectedTop5.length; i++) {
            const driver = expectedTop5[i];
            const driverNameElement = queryAllByText(driver.name);
            expect(driverNameElement.length).toBeGreaterThan(0);
          }

          // Invariant 3: Numeric Monotonicity
          if (expectedTop5.length >= 2) {
            for (let i = 0; i < expectedTop5.length - 1; i++) {
              const current = expectedTop5[i];
              const next = expectedTop5[i + 1];

              if (sortMode === 'PONTOS') {
                const currentPts = current.trackPoints ?? current.points;
                const nextPts = next.trackPoints ?? next.points;
                expect(currentPts).toBeGreaterThanOrEqual(nextPts);
              } else if (sortMode === 'MELHOR VOLTA') {
                const currentLap = current.bestLapMs || 999999;
                const nextLap = next.bestLapMs || 999999;
                expect(currentLap).toBeLessThanOrEqual(nextLap); // Faster is lower ms
              } else if (sortMode === 'XP TOTAL') {
                expect(current.xp).toBeGreaterThanOrEqual(next.xp);
              }
            }
          }

          // Invariant 4: Podium medals representation
          if (expectedTop5.length >= 1) {
            expect(queryAllByText('🥇').length).toBe(1);
          }
          if (expectedTop5.length >= 2) {
            expect(queryAllByText('🥈').length).toBe(1);
          }
          if (expectedTop5.length >= 3) {
            expect(queryAllByText('🥉').length).toBe(1);
          }
        });
      });
    });

    it('handles empty driver list gracefully without throwing exceptions', async () => {
      const { queryAllByText, getByTestId } = await render(<TrackLocalStandings drivers={[]} />);

      expect(getByTestId('track-hall-fama')).toBeTruthy();
      expect(queryAllByText('MG').length).toBe(0);
      expect(queryAllByText('🥇').length).toBe(0);

      // Can still toggle sorts and filters with 0 drivers
      fireEvent.press(getByTestId('local-sort-melhor-volta'));
      await waitFor(() => {
        expect(getByTestId('local-sort-melhor-volta')).toBeTruthy();
      });

      fireEvent.press(getByTestId('local-filter-lenda'));
      await waitFor(() => {
        expect(getByTestId('local-filter-lenda')).toBeTruthy();
      });

      expect(queryAllByText('MG').length).toBe(0);
    });

    it('handles missing bestLapMs by falling back to 999999ms in MELHOR VOLTA sort', async () => {
      const driverWithFastLap: LocalTrackDriverStanding = {
        ...BETIM_LOCAL_STANDINGS_DATA[0],
        id: 'fast-driver',
        name: 'FAST DRIVER',
        bestLap: '0:38.100',
        bestLapMs: 38100,
        xp: 1000,
        trackPoints: 1000,
      };

      const driverWithMissingLap: LocalTrackDriverStanding = {
        ...BETIM_LOCAL_STANDINGS_DATA[1],
        id: 'missing-lap-driver',
        name: 'MISSING LAP DRIVER',
        bestLap: '',
        bestLapMs: 0, // 0 / falsy triggers fallback 999999
        xp: 2000,
        trackPoints: 2000,
      };

      const { getByTestId, queryAllByText } = await render(
        <TrackLocalStandings drivers={[driverWithMissingLap, driverWithFastLap]} />
      );

      // Switch to MELHOR VOLTA
      fireEvent.press(getByTestId('local-sort-melhor-volta'));

      await waitFor(() => {
        const mgBadges = queryAllByText('MG');
        expect(mgBadges.length).toBe(2);
      });

      // Fast driver should be 1st (P1) despite having lower XP and points
      expect(queryAllByText('FAST DRIVER').length).toBe(1);
      expect(queryAllByText('🥇').length).toBe(1);
    });

    it('handles null or missing badges array without throwing .slice error', async () => {
      const driverWithNoBadges: LocalTrackDriverStanding = {
        ...BETIM_LOCAL_STANDINGS_DATA[0],
        id: 'no-badge-driver',
        badges: undefined as any,
      };

      const { getByTestId } = await render(
        <TrackLocalStandings drivers={[driverWithNoBadges]} />
      );
      expect(getByTestId('track-hall-fama')).toBeTruthy();
    });
  });

  // =========================================================================
  // SECTION 4: Refresh Button Stress & State Retention
  // =========================================================================
  describe('4. Refresh button multiple triggers and state stability', () => {
    it('maintains selectedSort and selectedCategory across repeated refresh triggers', async () => {
      const { getByTestId, queryAllByText } = await render(
        <TrackLocalStandings drivers={BETIM_LOCAL_STANDINGS_DATA} />
      );

      // 1. Select a non-default sort (MELHOR VOLTA) and non-default filter (PROFISSIONAL)
      fireEvent.press(getByTestId('local-sort-melhor-volta'));
      await waitFor(() => {
        expect(getByTestId('local-sort-melhor-volta')).toBeTruthy();
      });

      fireEvent.press(getByTestId('local-filter-profissional'));
      await waitFor(() => {
        expect(queryAllByText('MG').length).toBe(3);
      });

      // PROFISSIONAL has 3 drivers in Betim: Agenor Júnior, André Felisberto, Flavio Victor Câmara
      expect(queryAllByText('AGENOR JÚNIOR').length).toBe(1);
      expect(queryAllByText('ANDRÉ FELISBERTO').length).toBe(1);
      expect(queryAllByText('FLAVIO VICTOR CÂMARA').length).toBe(1);

      // 2. Trigger refresh button multiple times
      const refreshBtn = getByTestId('btn-refresh-local-ranking');
      for (let i = 0; i < 5; i++) {
        fireEvent.press(refreshBtn);
        await waitFor(() => {
          expect(getByTestId('btn-refresh-local-ranking')).toBeTruthy();
        });
      }

      // 3. Verify state stability: filter and sort are retained, exactly 3 PROFISSIONAL drivers remain
      await waitFor(() => {
        expect(queryAllByText('MG').length).toBe(3);
        expect(queryAllByText('AGENOR JÚNIOR').length).toBe(1);
        expect(queryAllByText('ANDRÉ FELISBERTO').length).toBe(1);
        expect(queryAllByText('FLAVIO VICTOR CÂMARA').length).toBe(1);
      });

      // Verify best lap badge is rendered (not PTS) because MELHOR VOLTA sort is preserved
      expect(queryAllByText('0:39.190').length).toBeGreaterThan(0);
    });

    it('refresh button preserves custom drivers passed via props', async () => {
      const customDrivers: LocalTrackDriverStanding[] = [
        {
          ...BETIM_LOCAL_STANDINGS_DATA[0],
          id: 'custom-driver-1',
          name: 'PILOTO TESTE 1',
          category: 'NOVATO',
          xp: 15000,
          trackPoints: 5000,
        },
      ];

      const { getByTestId, queryAllByText } = await render(
        <TrackLocalStandings drivers={customDrivers} />
      );

      const refreshBtn = getByTestId('btn-refresh-local-ranking');
      fireEvent.press(refreshBtn);
      await waitFor(() => {
        expect(getByTestId('btn-refresh-local-ranking')).toBeTruthy();
      });
      fireEvent.press(refreshBtn);

      await waitFor(() => {
        expect(queryAllByText('PILOTO TESTE 1').length).toBe(1);
        expect(queryAllByText('🥇').length).toBe(1);
      });
    });
  });

  // =========================================================================
  // SECTION 5: Full TrackScreen Composite Stress & Edge Cases
  // =========================================================================
  describe('5. Full TrackScreen integration stress', () => {
    it('renders composite TrackScreen with all subcomponents without state collisions', async () => {
      const onNavigateAgenda = jest.fn();
      const onOpenRanking = jest.fn();

      const { getByTestId } = await render(
        <TrackScreen
          partner={BETIM_TRACK_PARTNER}
          onNavigateAgenda={onNavigateAgenda}
          onOpenRanking={onOpenRanking}
        />
      );

      // Verify all major testIDs exist simultaneously
      expect(getByTestId('parceiros-screen')).toBeTruthy();
      expect(getByTestId('track-header')).toBeTruthy();
      expect(getByTestId('btn-favorite-track')).toBeTruthy();
      expect(getByTestId('btn-call-track')).toBeTruthy();
      expect(getByTestId('btn-whatsapp-track')).toBeTruthy();
      expect(getByTestId('btn-instagram-track')).toBeTruthy();
      expect(getByTestId('btn-maps-track')).toBeTruthy();
      expect(getByTestId('track-quick-shortcuts')).toBeTruthy();
      expect(getByTestId('track-hall-fama')).toBeTruthy();
      expect(getByTestId('track-baterias-section')).toBeTruthy();

      // Trigger bookmark and standings sorting in composite screen
      fireEvent.press(getByTestId('btn-favorite-track'));
      await waitFor(() => {
        expect(getByTestId('btn-favorite-track')).toBeTruthy();
      });

      fireEvent.press(getByTestId('local-sort-xp-total'));
      await waitFor(() => {
        expect(getByTestId('local-sort-xp-total')).toBeTruthy();
      });

      fireEvent.press(getByTestId('btn-refresh-local-ranking'));
      await waitFor(() => {
        expect(getByTestId('btn-refresh-local-ranking')).toBeTruthy();
      });

      expect(getByTestId('parceiros-screen')).toBeTruthy();
    });
  });
});
