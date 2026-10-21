import { Stack, useSegments } from 'expo-router';
import { Platform, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useUi } from '../components/theme';
import { DEMO_MODE } from '../config/features';
import { CartProvider } from '../features/cart/context';
import * as ScreenOrientation from 'expo-screen-orientation';

import { SessionProvider } from '../session/provider';

// o app é em pé; só o cockpit deita a tela (ele trava em paisagem ao abrir e devolve ao sair)
if (Platform.OS !== 'web') void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => undefined);

export default function RootLayout() {
  const { palette } = useUi();
  const segments = useSegments() as string[];
  const realDataRoute = segments.includes('(auth)') || segments.includes('reservations') || segments.some((segment) => ['agenda', 'reservas', 'resultados', 'gps'].includes(segment));
  return (
    <SessionProvider>
      <CartProvider>
        <StatusBar style="light" />
        <View style={{ flex: 1 }}>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: palette.background },
            headerStyle: { backgroundColor: palette.background },
            headerTintColor: palette.accent,
            headerShadowVisible: false,
            headerBackButtonDisplayMode: 'minimal',
            title: '',
          }}
        >
          <Stack.Screen name="(auth)/login" options={{ headerShown: true }} />
          <Stack.Screen name="(auth)/cadastro" options={{ headerShown: true }} />
          <Stack.Screen name="(auth)/recuperar-senha" options={{ headerShown: true }} />
          <Stack.Screen name="(auth)/redefinir-senha" options={{ headerShown: true }} />
          <Stack.Screen name="(auth)/verificar-email" options={{ headerShown: true }} />
          <Stack.Screen name="reservations/[id]" options={{ headerShown: true }} />
          <Stack.Screen name="carrinho" options={{ headerShown: false }} />
          <Stack.Screen name="conquistas" options={{ headerShown: false }} />
          <Stack.Screen name="ranking" options={{ headerShown: false }} />
          <Stack.Screen name="piloto/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="cockpit" options={{ headerShown: false, animation: 'slide_from_bottom' }} />
        </Stack>
        </View>
        {DEMO_MODE && !realDataRoute && (
          <SafeAreaView edges={['bottom']} style={{ backgroundColor: '#252A30' }}>
            <Text style={{ color: '#FFFFFF', fontSize: 13, padding: 12 }}>
              Prévia com dados demonstrativos. Ranking, notícias, carreira e telemetria ainda não estão conectados à operação.
            </Text>
          </SafeAreaView>
        )}
      </CartProvider>
    </SessionProvider>
  );
}
