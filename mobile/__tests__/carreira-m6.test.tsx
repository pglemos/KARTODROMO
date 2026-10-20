import { cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';
import ConquistasScreen from '../src/app/conquistas';
import { CareerScreen } from '../src/components/career-screen';
import { MOCK_CAREER_STATS, MOCK_DRIVERS } from '../src/mock/kart-data';

afterEach(() => {
  cleanup();
});

describe('Milestone 6 — Career Screen & Badges Component Suite', () => {
  describe('CareerScreen', () => {
    it('renders driver profile header, efficiency matrix, qualified stats and badges grid', async () => {
      const onOpenRules = jest.fn();
      const onViewAllBadges = jest.fn();

      const { getByTestId, getByText, getAllByText } = await render(
        <CareerScreen
          driver={MOCK_DRIVERS[0]}
          stats={MOCK_CAREER_STATS}
          onOpenRules={onOpenRules}
          onViewAllBadges={onViewAllBadges}
        />
      );

      // 1. Root Screen
      expect(getByTestId('screen-carreira')).toBeTruthy();
      expect(getByText('CARREIRA')).toBeTruthy();

      // 2. Driver Header
      expect(getByTestId('career-driver-header')).toBeTruthy();
      expect(getByTestId('career-avatar-circle')).toBeTruthy();
      expect(getByText('NC')).toBeTruthy();
      expect(getByTestId('career-driver-name')).toBeTruthy();
      expect(getByText('NELSON CASTRO')).toBeTruthy();
      expect(getByText('LENDA')).toBeTruthy();
      expect(getByTestId('career-xp-text')).toBeTruthy();
      expect(getByText('61.251 XP')).toBeTruthy();
      expect(getByTestId('career-points-text')).toBeTruthy();
      expect(getByText('13.112 PTS')).toBeTruthy();

      // 3. Efficiency Matrix (2x3)
      expect(getByTestId('efficiency-card')).toBeTruthy();
      expect(getByTestId('stat-win-rate')).toBeTruthy();
      expect(getByText('22%')).toBeTruthy();
      expect(getByTestId('stat-podium-rate')).toBeTruthy();
      expect(getByText('43%')).toBeTruthy();
      expect(getByTestId('stat-overall-efficiency')).toBeTruthy();
      expect(getByText('35%')).toBeTruthy();
      expect(getByTestId('stat-poles-rate')).toBeTruthy();
      expect(getByText('0%')).toBeTruthy();
      expect(getByTestId('stat-best-laps-rate')).toBeTruthy();
      expect(getByText('25%')).toBeTruthy();
      expect(getByTestId('stat-valid-races-rate')).toBeTruthy();
      expect(getByText('92%')).toBeTruthy();

      // 4. Qualified Stats Card (10+ Pilots)
      expect(getByTestId('qualified-stats-card')).toBeTruthy();
      expect(getByText('ESTATÍSTICAS QUALIFICADAS')).toBeTruthy();
      expect(getByTestId('stat-qualified-races')).toBeTruthy();
      expect(getByText('309')).toBeTruthy();
      expect(getByTestId('stat-qualified-wins')).toBeTruthy();
      expect(getByText('70')).toBeTruthy();
      expect(getByTestId('stat-qualified-podiums')).toBeTruthy();
      expect(getByText('133')).toBeTruthy();

      // 5. Badges Grid
      expect(getByTestId('career-badges-section')).toBeTruthy();
      expect(getByTestId('badges-grid')).toBeTruthy();
      expect(getByTestId('badge-item-badge-exp-1')).toBeTruthy();
      expect(getByText('Estreante')).toBeTruthy();
      expect(getByTestId('badge-item-badge-exp-4')).toBeTruthy();
      expect(getAllByText('Lenda').length).toBeGreaterThanOrEqual(1);

      // 6. Action Handlers
      const rulesBtn = getByTestId('btn-career-ranking-rules');
      fireEvent.press(rulesBtn);
      await waitFor(() => {
        expect(onOpenRules).toHaveBeenCalled();
      });

      const verTodasBtn = getByTestId('btn-ver-todas-conquistas');
      fireEvent.press(verTodasBtn);
      await waitFor(() => {
        expect(onViewAllBadges).toHaveBeenCalled();
      });
    });

    it('opens internal RankingRulesModal when no onOpenRules prop is provided', async () => {
      const { getByTestId, queryByTestId } = await render(
        <CareerScreen
          driver={MOCK_DRIVERS[0]}
          stats={MOCK_CAREER_STATS}
        />
      );

      const rulesBtn = getByTestId('btn-career-ranking-rules');
      fireEvent.press(rulesBtn);

      await waitFor(() => {
        expect(getByTestId('ranking-rules-modal')).toBeTruthy();
        expect(getByTestId('ranking-rules-card')).toBeTruthy();
      });

      const closeRulesBtn = getByTestId('btn-close-ranking-rules');
      fireEvent.press(closeRulesBtn);

      await waitFor(() => {
        expect(queryByTestId('ranking-rules-card')).toBeNull();
      });
    });
  });

  describe('ConquistasScreen', () => {
    it('renders full catalog, filter pills and handles category filtering', async () => {
      const { getByTestId, getByText, queryByTestId } = await render(
        <ConquistasScreen />
      );

      // 1. Root Screen
      expect(getByTestId('screen-conquistas')).toBeTruthy();
      expect(getByText('CONQUISTAS & BADGES')).toBeTruthy();

      // 2. Filter Pills
      expect(getByTestId('badge-filter-todas')).toBeTruthy();
      expect(getByTestId('badge-filter-experiencia')).toBeTruthy();
      expect(getByTestId('badge-filter-desafio')).toBeTruthy();
      expect(getByTestId('badge-filter-especial')).toBeTruthy();

      // 3. Badges List
      expect(getByTestId('badges-full-list')).toBeTruthy();
      expect(getByTestId('full-badge-card-badge-exp-1')).toBeTruthy();
      expect(getByText('Estreante')).toBeTruthy();
      expect(getByTestId('full-badge-card-badge-desafio-1')).toBeTruthy();
      expect(getByText('Vitória de Corrida')).toBeTruthy();

      // 4. Filter by Desafio
      fireEvent.press(getByTestId('badge-filter-desafio'));

      await waitFor(() => {
        expect(getByTestId('full-badge-card-badge-desafio-1')).toBeTruthy();
        expect(queryByTestId('full-badge-card-badge-exp-1')).toBeNull();
      });

      // 5. Back button
      expect(getByTestId('btn-back-conquistas')).toBeTruthy();
    });
  });
});
