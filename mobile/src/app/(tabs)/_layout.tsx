import React from 'react';
import { Tabs } from 'expo-router/js-tabs';
import { FloatingTabBar } from '../../components/floating-tab-bar';
import { DEMO_MODE } from '../../config/features';

export default function CustomerTabs() {
  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
        animation: 'fade',
        sceneStyle: { backgroundColor: '#000000' },
      }}
    >
      {/* 5 Abas Oficiais do Redesenho Esportivo */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarLabel: 'Home',
        }}
      />
      <Tabs.Screen
        name="parceiros"
        options={{
          ...(DEMO_MODE ? {} : { href: null }),
          title: 'Parceiros',
          tabBarLabel: 'Parceiros',
        }}
      />
      <Tabs.Screen
        name="livetime"
        options={{
          title: DEMO_MODE ? 'LiveTime' : 'Ao vivo',
          tabBarLabel: DEMO_MODE ? 'LiveTime' : 'Ao vivo',
        }}
      />
      <Tabs.Screen
        name="agenda"
        options={{
          title: 'Agenda',
          tabBarLabel: 'Agenda',
        }}
      />
      <Tabs.Screen
        name="carreira"
        options={{
          title: 'Carreira',
          tabBarLabel: 'Carreira',
        }}
      />

      {/* Rotas Auxiliares / Legadas Ocultadas da Tab Bar */}
      <Tabs.Screen
        name="reservas"
        options={{
          ...(DEMO_MODE ? { href: null } : {}),
          title: 'Reservas',
        }}
      />
      <Tabs.Screen
        name="resultados"
        options={{
          href: null,
          title: 'Resultados',
        }}
      />
      {/* GPS fica fora das abas até a linha de chegada medida ser aprovada (features/gps/track-config.ts) */}
      <Tabs.Screen
        name="gps"
        options={{
          href: null,
          title: 'GPS',
        }}
      />
    </Tabs>
  );
}
