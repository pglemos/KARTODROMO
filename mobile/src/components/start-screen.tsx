import { router } from 'expo-router';
import { Linking, Text } from 'react-native';

import { ActionButton, Page, PageHeader, Panel, useUi } from '../features/reservations/components';
import { useSession } from '../session/provider';

const SITE = 'https://www.kartodromodebetim.com.br';

/** Início do app de loja: só atalhos para funções ligadas a dados reais. */
export default function StartScreen() {
  const { styles } = useUi();
  const { session } = useSession();
  return (
    <Page>
      <PageHeader
        title="Kartódromo de Betim"
        description="Veja os horários da pista, reserve sua bateria e acompanhe seus resultados."
      />
      <Panel style={{ gap: 12 }}>
        <ActionButton label="Ver agenda" onPress={() => router.push('/(tabs)/agenda')} />
        <ActionButton label="Minhas reservas" onPress={() => router.push('/(tabs)/reservas')} secondary />
        <ActionButton label="Resultados" onPress={() => router.push('/(tabs)/resultados')} secondary />
        <ActionButton label="Treino com GPS" onPress={() => router.push('/(tabs)/gps')} secondary />
      </Panel>
      <Panel style={{ gap: 12 }}>
        <Text style={styles.muted}>
          {session ? 'Você está conectado.' : 'Entre ou crie sua conta para reservar e ver seus resultados.'}
        </Text>
        <ActionButton
          label={session ? 'Minha conta' : 'Entrar ou criar conta'}
          onPress={() => router.push(session ? '/(tabs)/reservas' : '/(auth)/login')}
          secondary
        />
        <ActionButton label="Política de privacidade" onPress={() => void Linking.openURL(`${SITE}/privacidade`)} secondary />
      </Panel>
    </Page>
  );
}
