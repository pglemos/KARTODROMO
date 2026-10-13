import { AppState } from 'react-native';
import * as Location from 'expo-location';

export async function requestForegroundLocationPermission(consented: boolean) {
  if (!consented) throw new Error('Dê seu consentimento antes de solicitar localização.');
  const permission = await Location.requestForegroundPermissionsAsync();
  if (permission.status !== 'granted') throw new Error('Permissão de localização negada.');
}

export async function watchForegroundLocation(
  consented: boolean,
  onPoint: (location: Location.LocationObject) => void,
  onPause: () => void,
  onError: (message: string) => void,
) {
  if (!consented) throw new Error('Dê seu consentimento antes de iniciar o treino.');
  const permission = await Location.getForegroundPermissionsAsync();
  if (permission.status !== 'granted') throw new Error('Permissão de localização negada.');
  if (AppState.currentState !== 'active') throw new Error('Abra o app para iniciar o treino GPS.');

  let locationSubscription: Location.LocationSubscription | null = null;
  let appStateSubscription: ReturnType<typeof AppState.addEventListener> | null = null;
  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    locationSubscription?.remove();
    appStateSubscription?.remove();
  };

  appStateSubscription = AppState.addEventListener('change', (state) => {
    if (state !== 'active' && !stopped) {
      stop();
      onPause();
    }
  });

  try {
    const next = await Location.watchPositionAsync({
      accuracy: Location.Accuracy.BestForNavigation,
      timeInterval: 1_000,
      distanceInterval: 1,
    }, onPoint, (message) => {
      if (stopped) return;
      stop();
      onError(message);
      onPause();
    });
    if (stopped) next.remove();
    else locationSubscription = next;
    return stop;
  } catch (error) {
    stop();
    throw error;
  }
}
