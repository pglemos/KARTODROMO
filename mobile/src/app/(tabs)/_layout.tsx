import { Tabs } from 'expo-router/js-tabs';

export default function CustomerTabs() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#c9f36a',
        tabBarInactiveTintColor: '#a5b2a8',
        tabBarStyle: {
          backgroundColor: '#0d1915',
          borderTopColor: '#273b32',
          height: 62,
          paddingTop: 6,
          paddingBottom: 8,
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '700' },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Início' }} />
      <Tabs.Screen name="agenda" options={{ title: 'Agenda' }} />
      <Tabs.Screen name="reservas" options={{ title: 'Reservas' }} />
      <Tabs.Screen name="resultados" options={{ title: 'Resultados' }} />
      <Tabs.Screen name="gps" options={{ title: 'GPS' }} />
    </Tabs>
  );
}
