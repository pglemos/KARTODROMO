import React from 'react';
import { router, type Href } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { Icon } from '../../components/brand';
import { tap } from '../../components/motion';

import { LiveTimeScreen, LiveTimeScreenProps } from '../../components/livetime-screen';
import { DEMO_MODE } from '../../config/features';
import { useLiveSession } from '../../features/live/api';
import { ActionButton, InlineError, LoadingMessage, Page, PageHeader, Panel, useUi } from '../../features/reservations/components';

/** Demonstração: telemetria ilustrativa (src/mock). */
function DemoLiveTime(props: LiveTimeScreenProps) {
  return <LiveTimeScreen {...props} />;
}

/** Loja: a bateria que está na pista agora (ou a última que terminou), direto da cronometragem. */
function RealLiveTime() {
  const { session, error, loading, refresh } = useLiveSession();
  const { styles } = useUi();
  if (session) return (
    <View style={{ flex: 1 }}>
      <LiveTimeScreen session={session} onRefresh={refresh} hudEnabled={false} />
      {/* cockpit: a bateria vista do seu kart, em tela cheia */}
      <Pressable accessibilityRole="button" accessibilityLabel="Abrir cockpit" onPress={() => { tap(); router.push('/cockpit' as Href); }}
        style={({ pressed }) => ({ position: 'absolute', right: 18, bottom: 128, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F59E0B', paddingHorizontal: 18, paddingVertical: 14, borderRadius: 999,
          shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 8, transform: [{ scale: pressed ? 0.94 : 1 }] })}>
        <Icon name="timer" color="#000000" size={20} />
        <Text style={{ color: '#000000', fontWeight: '900', fontSize: 15 }}>Cockpit</Text>
      </Pressable>
    </View>
  );
  return (
    <Page>
      <PageHeader title="Ao vivo" description="Posições, voltas e tempos da bateria que está na pista, direto da cronometragem." />
      {loading ? <LoadingMessage label="Conectando à cronometragem…" /> : null}
      {!loading && error ? <View style={{ gap: 12 }}><InlineError message={error} /><ActionButton label="Tentar novamente" onPress={() => void refresh()} secondary /></View> : null}
      {!loading && !error ? (
        <Panel>
          <Text style={styles.muted}>Nenhuma bateria na pista agora. Quando a próxima largar, ela aparece aqui sozinha.</Text>
        </Panel>
      ) : null}
    </Page>
  );
}

export default DEMO_MODE ? DemoLiveTime : RealLiveTime;
