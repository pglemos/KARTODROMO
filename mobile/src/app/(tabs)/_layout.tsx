import React from 'react';
import { Tabs } from 'expo-router/js-tabs';
import { FloatingTabBar } from '../../components/floating-tab-bar';

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
          href: null,
          title: 'Parceiros',
          tabBarLabel: 'Parceiros',
        }}
      />
      <Tabs.Screen
        name="livetime"
        options={{
          title: 'Ao vivo',
          tabBarLabel: 'Ao vivo',
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
