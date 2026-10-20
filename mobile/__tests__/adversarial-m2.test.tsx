/**
 * Adversarial Stress Tests for Milestone 2:
 * - Driver Ranking Screen (`src/app/ranking.tsx`)
 * - Home Screen (`src/components/home-screen.tsx`)
 * - Rules Modal (`src/components/ranking-rules-modal.tsx`)
 */

import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { fireEvent, render, waitFor, act } from '@testing-library/react-native';

import RankingScreen from '../src/app/ranking';
import HomeScreen from '../src/components/home-screen';
import { RankingRulesModal } from '../src/components/ranking-rules-modal';
import { MOCK_DRIVERS } from '../src/mock/kart-data';
import { Driver, PilotCategory } from '../src/types/racing';

const mockPush = jest.fn();
const mockBack = jest.fn();
const mockReplace = jest.fn();
let mockParams: Record<string, string> = {};

jest.mock('expo-router', () => {
  const React = require('react');
  return {
    useRouter: () => ({
      push: mockPush,
      back: mockBack,
      replace: mockReplace,
      canGoBack: () => true,
    }),
    useLocalSearchParams: () => mockParams,
    Link: ({ children, href, asChild }: any) => {
      if (asChild && React.isValidElement(children)) {
        return React.cloneElement(children, {
          onPress: (e: any) => {
            if (children.props.onPress) children.props.onPress(e);
            mockPush(href);
          },
        });
      }
      return children;
    },
  };
});

jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    SafeAreaView: ({ children, ...props }: any) => <View {...props}>{children}</View>,
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
  };
});

describe('M2 Adversarial Challenge Suite', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockParams = {};
  });

  // =========================================================================
  // SECTION 1: Extreme Search Inputs in RankingScreen
  // =========================================================================
  describe('Extreme Search Inputs in RankingScreen', () => {
    it('handles case-insensitivity: "Nelson", "nelson", "NELSON"', async () => {
      const { getByTestId, getByText, queryByText } = await render(<RankingScreen />);
      const input = getByTestId('ranking-search-input');

      for (const variant of ['Nelson', 'nelson', 'NELSON']) {
        fireEvent.changeText(input, variant);
        await waitFor(() => {
          expect(getByText('NELSON CASTRO')).toBeTruthy();
          expect(queryByText('TONI SIQUEIRA')).toBeNull();
        });
      }
    });

    it('handles accent variations: "Brandão" vs "Brandao", "André" vs "Andre", "Júnior" vs "Junior"', async () => {
      const { getByTestId, getByText, queryByText } = await render(<RankingScreen />);
      const input = getByTestId('ranking-search-input');

      // 1. Brandão vs Brandao -> YAGO BRANDÃO
      fireEvent.changeText(input, 'Brandao');
      await waitFor(() => {
        expect(getByText('YAGO BRANDÃO')).toBeTruthy();
        expect(queryByText('NELSON CASTRO')).toBeNull();
      });

      fireEvent.changeText(input, 'Brandão');
      await waitFor(() => {
        expect(getByText('YAGO BRANDÃO')).toBeTruthy();
        expect(queryByText('NELSON CASTRO')).toBeNull();
      });

      // 2. André vs Andre -> ANDRÉ FELISBERTO
      fireEvent.changeText(input, 'andre');
      await waitFor(() => {
        expect(getByText('ANDRÉ FELISBERTO')).toBeTruthy();
      });

      fireEvent.changeText(input, 'ANDRÉ');
      await waitFor(() => {
        expect(getByText('ANDRÉ FELISBERTO')).toBeTruthy();
      });

      // 3. Câmara vs Camara -> FLAVIO VICTOR CÂMARA
      fireEvent.changeText(input, 'camara');
      await waitFor(() => {
        expect(getByText('FLAVIO VICTOR CÂMARA')).toBeTruthy();
      });

      fireEvent.changeText(input, 'CÂMARA');
      await waitFor(() => {
        expect(getByText('FLAVIO VICTOR CÂMARA')).toBeTruthy();
      });

      // 4. Perly -> MURILO PERLY
      fireEvent.changeText(input, 'Perly');
      await waitFor(() => {
        expect(getByText('MURILO PERLY')).toBeTruthy();
      });
    });

    it('handles initials matching: "NC", "nc", "MP", "YB", "TS" (matches multiple)', async () => {
      const { getByTestId, getByText, queryByText } = await render(<RankingScreen />);
      const input = getByTestId('ranking-search-input');

      // "NC" matches Nelson Castro
      fireEvent.changeText(input, 'NC');
      await waitFor(() => {
        expect(getByText('NELSON CASTRO')).toBeTruthy();
        expect(queryByText('MURILO PERLY')).toBeNull();
      });

      // "nc" (lowercase) matches Nelson Castro
      fireEvent.changeText(input, 'nc');
      await waitFor(() => {
        expect(getByText('NELSON CASTRO')).toBeTruthy();
      });

      // "MP" matches Murilo Perly
      fireEvent.changeText(input, 'MP');
      await waitFor(() => {
        expect(getByText('MURILO PERLY')).toBeTruthy();
      });

      // "TS" matches TONI SIQUEIRA (TS) and THIAGO SANTORO (TS)
      fireEvent.changeText(input, 'TS');
      await waitFor(() => {
        expect(getByText('TONI SIQUEIRA')).toBeTruthy();
        expect(getByText('THIAGO SANTORO')).toBeTruthy();
      });
    });

    it('safely handles regex meta-characters without throwing SyntaxError: *, +, (, ), [, ], $, ^, ?, \\, |', async () => {
      const { getByTestId, getByText } = await render(<RankingScreen />);
      const input = getByTestId('ranking-search-input');

      const hostileStrings = [
        '.',
        '*',
        '+',
        '?',
        '(',
        ')',
        '[',
        ']',
        '{',
        '}',
        '\\',
        '^',
        '$',
        '|',
        '[a-z]+',
        '(.*)',
        '\\d+',
        '${7*7}',
        '"><script>alert(1)</script>',
      ];

      for (const dangerousQuery of hostileStrings) {
        expect(() => {
          fireEvent.changeText(input, dangerousQuery);
        }).not.toThrow();

        // Should render empty state without crash
        await waitFor(() => {
          expect(getByTestId('ranking-empty-state')).toBeTruthy();
          expect(getByText('Nenhum piloto encontrado.')).toBeTruthy();
        });
      }
    });

    it('handles numbers and strings with no matching drivers, verifying empty state and filter reset', async () => {
      const { getByTestId, getByText, queryByText } = await render(<RankingScreen />);
      const input = getByTestId('ranking-search-input');

      // Test numeric query "9999"
      fireEvent.changeText(input, '9999');
      await waitFor(() => {
        expect(getByTestId('ranking-empty-state')).toBeTruthy();
        expect(getByTestId('no-drivers-found')).toBeTruthy();
        expect(getByText('Nenhum piloto encontrado.')).toBeTruthy();
        expect(
          getByText('Não encontramos resultados para "9999" nesta categoria.')
        ).toBeTruthy();
        expect(getByText('LIMPAR FILTROS')).toBeTruthy();
      });

      // Clicking LIMPAR FILTROS resets input and category
      fireEvent.press(getByText('LIMPAR FILTROS'));
      await waitFor(() => {
        expect(getByText('NELSON CASTRO')).toBeTruthy();
        expect(getByText('TONI SIQUEIRA')).toBeTruthy();
        expect(queryByText('Nenhum piloto encontrado.')).toBeNull();
      });
    });

    it('tests clear search button in TextInput', async () => {
      const { getByTestId, getByLabelText, getByText, queryByLabelText } = await render(
        <RankingScreen />
      );
      const input = getByTestId('ranking-search-input');

      // Initially no clear button
      expect(queryByLabelText('Limpar busca')).toBeNull();

      // Type search
      fireEvent.changeText(input, 'Nelson');
      await waitFor(() => {
        expect(getByLabelText('Limpar busca')).toBeTruthy();
      });

      // Press clear button
      fireEvent.press(getByLabelText('Limpar busca'));
      await waitFor(() => {
        expect(queryByLabelText('Limpar busca')).toBeNull();
        expect(getByText('TONI SIQUEIRA')).toBeTruthy();
      });
    });

    it('handles search query within filtered category: matches inside category vs misses in other category', async () => {
      const { getByTestId, getByText, queryByText } = await render(<RankingScreen />);
      const input = getByTestId('ranking-search-input');

      // Filter by PROFISSIONAL
      fireEvent.press(getByTestId('ranking-filter-profissional'));
      await waitFor(() => {
        expect(getByText('AGENOR JÚNIOR')).toBeTruthy();
      });

      // Search for "Nelson" (who is LENDA, not PROFISSIONAL)
      fireEvent.changeText(input, 'Nelson');
      await waitFor(() => {
        expect(getByTestId('ranking-empty-state')).toBeTruthy();
        expect(
          getByText('Não encontramos resultados para "Nelson" nesta categoria.')
        ).toBeTruthy();
      });

      // Now search for "Agenor"
      fireEvent.changeText(input, 'Agenor');
      await waitFor(() => {
        expect(getByText('AGENOR JÚNIOR')).toBeTruthy();
        expect(queryByText('Nenhum piloto encontrado.')).toBeNull();
      });
    });
  });

  // =========================================================================
  // SECTION 2: Category Filtering Across All 6 Pills
  // =========================================================================
  describe('Category Filtering Across All 6 Pills', () => {
    const CATEGORY_COUNTS: Record<PilotCategory, number> = {
      TODOS: 18,
      LENDA: 5,
      PROFISSIONAL: 3,
      'SEMI-PRO': 3,
      AMADOR: 3,
      NOVATO: 4,
    };

    it('verifies driver counts and points sorting in RankingScreen for all 6 categories', async () => {
      const { getByTestId, getAllByTestId, queryByTestId } = await render(<RankingScreen />);

      const categories: PilotCategory[] = [
        'LENDA',
        'PROFISSIONAL',
        'SEMI-PRO',
        'AMADOR',
        'NOVATO',
        'TODOS',
      ];

      for (const cat of categories) {
        const pillId = `ranking-filter-${cat.toLowerCase()}`;
        fireEvent.press(getByTestId(pillId));

        await waitFor(() => {
          const expectedTotalCount = CATEGORY_COUNTS[cat];
          const expectedRendered = Math.min(expectedTotalCount, 10);

          const rows = getAllByTestId(/^full-ranking-item-/);
          expect(rows.length).toBe(expectedRendered);

          const expectedDrivers =
            cat === 'TODOS'
              ? MOCK_DRIVERS.slice(0, 10)
              : MOCK_DRIVERS.filter((d) => d.category === cat);

          for (const driver of expectedDrivers) {
            expect(getByTestId(`full-ranking-item-${driver.id}`)).toBeTruthy();
          }

          // Verify non-category drivers are absent
          if (cat !== 'TODOS') {
            const otherDrivers = MOCK_DRIVERS.filter((d) => d.category !== cat);
            for (const other of otherDrivers.slice(0, 3)) {
              expect(queryByTestId(`full-ranking-item-${other.id}`)).toBeNull();
            }
          }
        });
      }
    });

    it('verifies HomeScreen dynamic title and top-5 slice limit across all categories', async () => {
      const { getByTestId, getByText, getAllByTestId } = await render(<HomeScreen />);

      const testCases: { category: PilotCategory; expectedTitle: string; expectedRows: number }[] = [
        { category: 'TODOS', expectedTitle: 'TOP PILOTOS', expectedRows: 5 },
        { category: 'LENDA', expectedTitle: 'TOP PILOTOS (LENDA)', expectedRows: 5 },
        { category: 'PROFISSIONAL', expectedTitle: 'TOP PILOTOS (PROFISSIONAL)', expectedRows: 3 },
        { category: 'SEMI-PRO', expectedTitle: 'TOP PILOTOS (SEMI-PRO)', expectedRows: 3 },
        { category: 'AMADOR', expectedTitle: 'TOP PILOTOS (AMADOR)', expectedRows: 3 },
        { category: 'NOVATO', expectedTitle: 'TOP PILOTOS (NOVATO)', expectedRows: 4 },
      ];

      for (const tc of testCases) {
        fireEvent.press(getByTestId(`filter-pill-${tc.category.toLowerCase()}`));

        await waitFor(() => {
          expect(getByText(tc.expectedTitle)).toBeTruthy();
          const rows = getAllByTestId(/^top-pilot-row-/);
          expect(rows.length).toBe(tc.expectedRows);
        });
      }
    });

    it('verifies HomeScreen enforces max 5 limit even when category has more than 5 drivers', async () => {
      // Create a dataset with 8 NOVATO drivers
      const extraNovatos: Driver[] = Array.from({ length: 8 }, (_, i) => ({
        id: `driver-extra-novato-${i}`,
        name: `EXTRA NOVATO ${i + 1}`,
        initials: `N${i}`,
        avatarUrl: null,
        category: 'NOVATO',
        xp: 1000 - i * 50,
        points: 500 - i * 20,
        rating: 400 - i * 10,
        flag: 'MG',
        rankPosition: i + 1,
        badges: [],
      }));

      const { getByTestId, getAllByTestId } = await render(
        <HomeScreen drivers={extraNovatos} initialCategory="NOVATO" />
      );

      const rows = getAllByTestId(/^top-pilot-row-/);
      expect(rows.length).toBe(5); // Strictly capped at 5
    });
  });

  // =========================================================================
  // SECTION 3: Stress Testing RankingRulesModal
  // =========================================================================
  describe('RankingRulesModal Stress Testing', () => {
    it('verifies all calculation formula weights and cutoff rule are present in modal', async () => {
      const onClose = jest.fn();
      const { getByTestId, getByText } = await render(
        <RankingRulesModal visible={true} onClose={onClose} />
      );

      // Verify Title & Subtitle
      expect(getByText('COMO FUNCIONA O RANKING?')).toBeTruthy();
      expect(
        getByText('ENTENDA COMO SUA POSIÇÃO É CALCULADA E POR QUE SEU XP É VALIOSO.')
      ).toBeTruthy();

      // Verify 50/20/20/10 Breakdown
      expect(getByTestId('rule-weight-efficiency')).toBeTruthy();
      expect(getByText(/50% EFICIÊNCIA/)).toBeTruthy();

      expect(getByTestId('rule-weight-wins')).toBeTruthy();
      expect(getByText(/20% VITÓRIAS ABSOLUTAS/)).toBeTruthy();

      expect(getByTestId('rule-weight-xp')).toBeTruthy();
      expect(getByText(/20% XP ACUMULADO/)).toBeTruthy();

      expect(getByTestId('rule-weight-races')).toBeTruthy();
      expect(getByText(/10% ASSIDUIDADE \/ CORRIDAS/)).toBeTruthy();

      // Verify 10 Drivers Cutoff Rule
      expect(getByTestId('rule-10-drivers-cutoff')).toBeTruthy();
      expect(getByText(/Apenas baterias com 10 ou mais pilotos contam/)).toBeTruthy();
    });

    it('handles consecutive open/close toggle cycles via state harness (toggle, ENTENDI, close X, backdrop)', async () => {
      function TestModalHarness() {
        const [open, setOpen] = React.useState(false);
        return (
          <View>
            <TouchableOpacity testID="btn-harness-toggle" onPress={() => setOpen((prev) => !prev)}>
              <Text>Toggle</Text>
            </TouchableOpacity>
            <RankingRulesModal visible={open} onClose={() => setOpen(false)} />
          </View>
        );
      }

      const { getByTestId, getByLabelText, queryByTestId } = await render(<TestModalHarness />);
      const toggleBtn = getByTestId('btn-harness-toggle');

      expect(queryByTestId('ranking-rules-card')).toBeNull();

      // Cycle 1: Open -> Close via toggle button
      fireEvent.press(toggleBtn);
      await waitFor(() => {
        expect(getByTestId('ranking-rules-card')).toBeTruthy();
      });
      fireEvent.press(toggleBtn);
      await waitFor(() => {
        expect(queryByTestId('ranking-rules-card')).toBeNull();
      });

      // Cycle 2: Open -> Close via "ENTENDI" action button
      fireEvent.press(toggleBtn);
      await waitFor(() => {
        expect(getByTestId('ranking-rules-card')).toBeTruthy();
      });
      fireEvent.press(getByTestId('btn-understand-rules'));
      await waitFor(() => {
        expect(queryByTestId('ranking-rules-card')).toBeNull();
      });

      // Cycle 3: Open -> Close via header "X" button
      fireEvent.press(toggleBtn);
      await waitFor(() => {
        expect(getByTestId('ranking-rules-card')).toBeTruthy();
      });
      fireEvent.press(getByTestId('btn-close-ranking-rules'));
      await waitFor(() => {
        expect(queryByTestId('ranking-rules-card')).toBeNull();
      });

      // Cycle 4: Open -> Close via backdrop overlay click
      fireEvent.press(toggleBtn);
      await waitFor(() => {
        expect(getByTestId('ranking-rules-card')).toBeTruthy();
      });
      fireEvent.press(getByLabelText('Fechar modal'));
      await waitFor(() => {
        expect(queryByTestId('ranking-rules-card')).toBeNull();
      });
    });

    it('verifies Modal onRequestClose callback is triggered for Android back gesture', async () => {
      const onClose = jest.fn();
      const { getByTestId } = await render(
        <RankingRulesModal visible={true} onClose={onClose} />
      );

      await waitFor(() => {
        expect(getByTestId('ranking-rules-card')).toBeTruthy();
      });

      const modal = getByTestId('ranking-rules-modal');
      fireEvent(modal, 'requestClose');
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
});
