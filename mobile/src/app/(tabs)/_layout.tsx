import { Tabs } from 'expo-router/js-tabs';
import { Text, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../../components/brand';
import { useUi } from '../../components/theme';

export default function CustomerTabs() {
  const { palette } = useUi();
  const { fontScale } = useWindowDimensions();
  const { bottom } = useSafeAreaInsets();
  return <Tabs screenOptions={{
    headerShown: false,
    tabBarLabelPosition: 'below-icon',
    tabBarActiveTintColor: palette.accent,
    tabBarInactiveTintColor: palette.muted,
    tabBarStyle: { backgroundColor: palette.surface, borderTopColor: palette.border, paddingTop: 6, height: Math.max(64, 32 + 28 * fontScale) + bottom },
    tabBarLabel: ({ children, color }) => <Text style={{ color, fontSize: 11, lineHeight: 14, fontWeight: '600', textAlign: 'center' }}>{children}</Text>,
    tabBarHideOnKeyboard: true,
  }}>
    <Tabs.Screen name="index" options={{ title: 'Início', tabBarIcon: ({ color }) => <Icon name="home" color={color} /> }} />
    <Tabs.Screen name="agenda" options={{ title: 'Agenda', tabBarIcon: ({ color }) => <Icon name="calendar" color={color} /> }} />
    <Tabs.Screen name="reservas" options={{ title: 'Reservas', tabBarIcon: ({ color }) => <Icon name="ticket" color={color} /> }} />
    <Tabs.Screen name="resultados" options={{ title: 'Resultados', tabBarIcon: ({ color }) => <Icon name="results" color={color} /> }} />
    <Tabs.Screen name="gps" options={{ title: 'GPS', tabBarIcon: ({ color }) => <Icon name="gps" color={color} /> }} />
  </Tabs>;
}
