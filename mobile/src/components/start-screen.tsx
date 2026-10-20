import { router } from 'expo-router';
import { Linking, Text } from 'react-native';

import { ActionButton, Page, PageHeader, Panel, useUi } from '../features/reservations/components';
import { useSession } from '../session/provider';

/** política do app (página do domínio das reservas; o site principal não tem /privacidade) */
const PRIVACIDADE = 'https://reservas.kartodromodebetim.com.br/privacidade';

/** Início do app de loja: só atalhos para funções ligadas a dados reais. */
export default function StartScreen() {
  const { styles } = useUi();
  const { session } = useSession();
  return (
    <Page>
      <PageHeader
        title="Kartódromo de Betim"
        description="Veja os horários da pista, reserve sua bateria, acompanhe a corrida ao vivo e seus resultados."
      />
      <Panel style={{ gap: 12 }}>
        <ActionButton label="Ver agenda" onPress={() => router.push('/(tabs)/agenda')} />
        <ActionButton label="Minhas reservas" onPress={() => router.push('/(tabs)/reservas')} secondary />
        <ActionButton label="Ao vivo na pista" onPress={() => router.push('/(tabs)/livetime')} secondary />
        <ActionButton label="Resultados" onPress={() => router.push('/(tabs)/resultados')} secondary />
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
        <ActionButton label="Política de privacidade" onPress={() => void Linking.openURL(PRIVACIDADE)} secondary />
      </Panel>
    </Page>
  );
}
