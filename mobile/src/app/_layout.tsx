import { useEffect } from 'react';
import { Stack, useSegments } from 'expo-router';
import { Platform, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useUi } from '../components/theme';
import { CartProvider } from '../features/cart/context';
import { useFonts } from 'expo-font';

import { SessionProvider } from '../session/provider';

export default function RootLayout() {
  const { palette } = useUi();
  const segments = useSegments() as string[];
  const emCockpit = segments.includes('cockpit');
  useEffect(() => {
    if (Platform.OS === 'web') return;
    void ScreenOrientation.lockAsync(emCockpit ? ScreenOrientation.OrientationLock.LANDSCAPE : ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => undefined);
  }, [emCockpit]);

  // fontes do design (títulos itálicos e números da cronometragem); sem elas o app usa a do sistema
  useFonts({
    Display: require('../../assets/fonts/Barlow-BlackItalic.ttf'),
    DisplayBold: require('../../assets/fonts/Barlow-ExtraBoldItalic.ttf'),
    Tempo: require('../../assets/fonts/BarlowSemiCondensed-SemiBold.ttf'),
    TempoBold: require('../../assets/fonts/BarlowSemiCondensed-Bold.ttf'),
    TempoItalic: require('../../assets/fonts/BarlowSemiCondensed-BoldItalic.ttf'),
  });
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
          <Stack.Screen name="progresso" options={{ headerShown: false }} />
          <Stack.Screen name="minhas-conquistas" options={{ headerShown: false }} />
          <Stack.Screen name="desafios" options={{ headerShown: false }} />
          <Stack.Screen name="metas" options={{ headerShown: false }} />
          <Stack.Screen name="karts" options={{ headerShown: false }} />
          <Stack.Screen name="perfil" options={{ headerShown: false }} />
          <Stack.Screen name="carteira" options={{ headerShown: false }} />
          <Stack.Screen name="ranking" options={{ headerShown: false }} />
          <Stack.Screen name="piloto/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="cockpit" options={{ headerShown: false, animation: 'slide_from_bottom' }} />
        </Stack>
        </View>
      </CartProvider>
    </SessionProvider>
  );
}
