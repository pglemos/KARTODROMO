import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SessionProvider } from '../session/provider';
import { useUi } from '../components/theme';

export default function RootLayout() {
  const { dark, palette } = useUi();
  return <SessionProvider>
    <StatusBar style={dark ? 'light' : 'dark'} />
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: palette.background },
      headerStyle: { backgroundColor: palette.background }, headerTintColor: palette.accent,
      headerShadowVisible: false, headerBackButtonDisplayMode: 'minimal', title: '' }}>
      <Stack.Screen name="(auth)/login" options={{ headerShown: true }} />
      <Stack.Screen name="(auth)/cadastro" options={{ headerShown: true }} />
      <Stack.Screen name="(auth)/recuperar-senha" options={{ headerShown: true }} />
      <Stack.Screen name="(auth)/redefinir-senha" options={{ headerShown: true }} />
      <Stack.Screen name="(auth)/verificar-email" options={{ headerShown: true }} />
      <Stack.Screen name="reservations/[id]" options={{ headerShown: true }} />
    </Stack>
  </SessionProvider>;
}
