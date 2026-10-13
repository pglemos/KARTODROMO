import { AppState, type AppStateStatus } from 'react-native';
import * as Location from 'expo-location';
import { render } from '@testing-library/react-native';
import { createElement } from 'react';

import GpsScreen from '../src/app/(tabs)/gps';
import { findLineCrossingAt } from '../src/features/gps/lap-detector';
import { requestForegroundLocationPermission, watchForegroundLocation } from '../src/features/gps/location';
import * as repository from '../src/features/gps/repository';
import type { FinishLine, GpsPoint } from '../src/features/gps/lap-detector';

jest.mock('expo-location', () => ({
  Accuracy: { BestForNavigation: 6 },
  getForegroundPermissionsAsync: jest.fn(),
  requestForegroundPermissionsAsync: jest.fn(),
  watchPositionAsync: jest.fn(),
}));
jest.mock('../src/features/gps/repository', () => ({
  listGpsSessions: jest.fn(),
}));

const finishLine: FinishLine = {
  start: { latitude: 0, longitude: -0.0001 },
  end: { latitude: 0, longitude: 0.0001 },
  direction: 'positive',
};

function point(latitude: number, timestamp: number, accuracy = 5): GpsPoint {
  return { latitude, longitude: 0, timestamp, accuracy };
}

const permission = (status: 'granted' | 'denied') => ({
  status,
  granted: status === 'granted',
  canAskAgain: true,
  expires: 'never',
});

describe('treino GPS pessoal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    AppState.currentState = 'active';
    jest.mocked(repository.listGpsSessions).mockResolvedValue([]);
    jest.mocked(Location.getForegroundPermissionsAsync).mockResolvedValue(permission('granted') as never);
    jest.mocked(Location.requestForegroundPermissionsAsync).mockResolvedValue(permission('granted') as never);
  });

  afterEach(() => jest.restoreAllMocks());

  it('detecta a passagem no sentido configurado e calcula o instante da linha', () => {
    expect(findLineCrossingAt(point(-0.0001, 1_000), point(0.0001, 2_000), finishLine, 10)).toBe(1_500);
  });

  it('ignora uma passagem com precisão acima do limite', () => {
    expect(findLineCrossingAt(point(-0.0001, 1_000), point(0.0001, 2_000, 11), finishLine, 10)).toBeNull();
  });

  it('ignora pontos fora de ordem', () => {
    expect(findLineCrossingAt(point(-0.0001, 2_000), point(0.0001, 1_000), finishLine, 10)).toBeNull();
  });

  it('não inicia o GPS sem consentimento nem com permissão negada', async () => {
    await expect(requestForegroundLocationPermission(false)).rejects.toThrow(/consentimento/i);
    expect(Location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();

    jest.mocked(Location.requestForegroundPermissionsAsync).mockResolvedValue(permission('denied') as never);
    await expect(requestForegroundLocationPermission(true)).rejects.toThrow(/permissão/i);
    expect(Location.watchPositionAsync).not.toHaveBeenCalled();
  });

  it('remove a assinatura e pausa quando o app sai de active', async () => {
    const locationSubscription = { remove: jest.fn() };
    const appStateSubscription = { remove: jest.fn() };
    let onStateChange: ((state: AppStateStatus) => void) | undefined;
    jest.spyOn(AppState, 'addEventListener').mockImplementation((event, listener) => {
      if (event === 'change') onStateChange = listener;
      return appStateSubscription;
    });
    jest.mocked(Location.watchPositionAsync).mockResolvedValue(locationSubscription as never);
    const onPause = jest.fn();

    const stop = await watchForegroundLocation(true, jest.fn(), onPause, jest.fn());
    onStateChange?.('background');

    expect(Location.getForegroundPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(Location.watchPositionAsync).toHaveBeenCalledTimes(1);
    expect(locationSubscription.remove).toHaveBeenCalledTimes(1);
    expect(appStateSubscription.remove).toHaveBeenCalledTimes(1);
    expect(onPause).toHaveBeenCalledTimes(1);
    stop();
    expect(locationSubscription.remove).toHaveBeenCalledTimes(1);
  });

  it('mantém o cronômetro desabilitado até a geometria validada existir', async () => {
    const view = await render(createElement(GpsScreen));
    const startButton = view.getByRole('button', { name: 'Iniciar treino' });

    expect(startButton.props.accessibilityState.disabled).toBe(true);
    expect(view.getByText(/medição aprovada/i)).toBeTruthy();
    expect(Location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
  });
});
