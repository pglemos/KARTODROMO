import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { LiveTimeScreen } from '../src/components/livetime-screen';
import CockpitHUDScreen from '../src/app/cockpit-hud';
import { MOCK_LIVE_SESSION, MOCK_COCKPIT_HUD_STATE } from '../src/mock/kart-data';

describe('Milestone 4 — LiveTime Screen & Cockpit HUD Component Suite', () => {
  it('ajusta o HUD à área disponível sem cortar o botão fechar', async () => {
    const view = await render(<CockpitHUDScreen />);
    fireEvent(view.getByTestId('cockpit-viewport'), 'layout', { nativeEvent: { layout: { width: 400, height: 600 } } });
    await waitFor(() => expect(view.getByTestId('screen-cockpit-hud')).toHaveStyle({ width: 600, height: 400 }));
    expect(view.getByTestId('btn-close-cockpit')).toHaveStyle({ minWidth: 48, minHeight: 48 });
    expect(view.queryByLabelText('Alternar tema de cores')).toBeNull();
  });
  describe('LiveTimeScreen', () => {
    it('renders session header, fastest lap banner, flag status and competitor table', async () => {
      const onOpenCockpitHUD = jest.fn();
      const { getByTestId, getByText, getAllByText } = await render(
        <LiveTimeScreen onOpenCockpitHUD={onOpenCockpitHUD} session={MOCK_LIVE_SESSION} />
      );

      // 1. Session Header
      expect(getByTestId('livetime-session-header')).toBeTruthy();
      expect(getByTestId('livetime-title')).toBeTruthy();
      expect(getByText('BATERIAS 14/10/2026')).toBeTruthy();
      expect(getByTestId('livetime-subtitle')).toBeTruthy();

      // 2. Fastest Lap Banner
      expect(getByTestId('fastest-lap-banner')).toBeTruthy();
      expect(getByText('VOLTA MAIS RÁPIDA')).toBeTruthy();
      expect(getByTestId('fastest-lap-info')).toBeTruthy();
      expect(getAllByText(/0:38\.775/).length).toBeGreaterThanOrEqual(1);

      // 3. Flag Status & Session Timer
      expect(getByTestId('flag-status-card')).toBeTruthy();
      expect(getByTestId('flag-status-label')).toBeTruthy();
      expect(getByText('BANDEIRA VERDE')).toBeTruthy();
      expect(getByTestId('elapsed-session-timer')).toBeTruthy();
      expect(getByText('0:17:54.548')).toBeTruthy();

      // 4. Cockpit HUD Launcher
      const cockpitBtn = getByTestId('btn-open-cockpit-hud');
      expect(cockpitBtn).toBeTruthy();
      fireEvent.press(cockpitBtn);
      expect(onOpenCockpitHUD).toHaveBeenCalled();

      // 5. Telemetry Table
      expect(getByTestId('telemetry-table')).toBeTruthy();
      expect(getByTestId('telemetry-row-#16')).toBeTruthy();
      expect(getAllByText(/COMPETIDOR 16/).length).toBeGreaterThanOrEqual(1);
      expect(getByText(/GUILHERME BARROS/)).toBeTruthy();
    });
  });

  describe('CockpitHUDScreen', () => {
    it('renders giant digital timer, current position, deltas and handles close', async () => {
      const onClose = jest.fn();
      const { getByTestId, getByText } = await render(
        <CockpitHUDScreen onClose={onClose} initialState={MOCK_COCKPIT_HUD_STATE} />
      );

      // 1. Root Screen
      expect(getByTestId('screen-cockpit-hud')).toBeTruthy();

      // 2. Current Position
      expect(getByTestId('cockpit-position-card')).toBeTruthy();
      expect(getByTestId('cockpit-current-position')).toBeTruthy();
      expect(getByText('P1')).toBeTruthy();

      // 3. Giant Timer
      expect(getByTestId('cockpit-timer-box')).toBeTruthy();
      expect(getByTestId('cockpit-giant-timer')).toBeTruthy();
      expect(getByText('0:05.8')).toBeTruthy();

      // 4. Realtime Delta
      expect(getByTestId('cockpit-delta-card')).toBeTruthy();
      expect(getByTestId('cockpit-delta-value')).toBeTruthy();
      expect(getByText('+0:30.121 ⬆')).toBeTruthy();

      // 5. Deltas and Laps
      expect(getByText(/Última: 0:32\.878/)).toBeTruthy();
      expect(getByText(/Melhor: 0:29\.182/)).toBeTruthy();
      expect(getByTestId('cockpit-delta-best')).toBeTruthy();
      expect(getByText(/Dif Melhor: \+3\.696/)).toBeTruthy();

      // 6. Driver Info
      expect(getByTestId('cockpit-driver-info')).toBeTruthy();
      expect(getByText(/#07 GERSON BARROS/)).toBeTruthy();

      // 7. Close Action
      const closeBtn = getByTestId('btn-close-cockpit');
      expect(closeBtn).toBeTruthy();
      fireEvent.press(closeBtn);
      expect(onClose).toHaveBeenCalled();
    });
  });
});
