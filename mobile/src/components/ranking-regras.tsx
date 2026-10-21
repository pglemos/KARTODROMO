import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon } from './brand';
import { useUi } from './theme';
import { CATEGORIAS, XP_REGRAS } from '../features/ranking/gamificacao';

function Bloco({ icone, cor, titulo, children }: { icone: 'flag' | 'star' | 'crown' | 'info'; cor: string; titulo: string; children: React.ReactNode }) {
  const { palette } = useUi();
  return (
    <View style={{ backgroundColor: palette.surface, borderRadius: 18, padding: 18, gap: 10, borderWidth: 1, borderColor: palette.border }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Icon name={icone} color={cor} size={22} />
        <Text style={{ color: palette.text, fontSize: 18, fontWeight: '800' }}>{titulo}</Text>
      </View>
      {children}
    </View>
  );
}

/** "Como funciona o ranking": as regras reais do ranking por tempo e do XP calculado no app */
export function RegrasRanking({ visivel, onFechar }: { visivel: boolean; onFechar(): void }) {
  const { palette, styles } = useUi();
  const t = { color: palette.textSecondary, fontSize: 15, lineHeight: 22 };
  return (
    <Modal visible={visivel} animationType="slide" presentationStyle="pageSheet" onRequestClose={onFechar}>
      <SafeAreaView style={{ flex: 1, backgroundColor: palette.background }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 }}>
          <Text accessibilityRole="header" style={{ color: palette.text, fontSize: 26, fontWeight: '900', flex: 1 }}>Como funciona</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Fechar" onPress={onFechar} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: palette.surface, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="close" color={palette.text} size={20} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }}>
          <Bloco icone="flag" cor={palette.accent} titulo="Ranking por tempo">
            <Text style={t}>Vale a sua melhor volta em cada traçado. Quem tem a volta mais rápida fica em 1º. Dá para ver a semana (domingo a sábado), o mês ou o geral.</Text>
            <Text style={t}>Indoor e Super Kart têm rankings separados, porque o kart é diferente. Não contam baterias com chuva, equalização, piloto desclassificado nem voltas impossíveis (erro de leitura do transponder).</Text>
            <Text style={t}>O geral inclui os tempos do sistema antigo (LapTime) desde 2025.</Text>
          </Bloco>
          <Bloco icone="star" cor={palette.blue} titulo="Seu XP">
            <Text style={t}>Cada bateria vale +{XP_REGRAS.bateria} XP. Pódio em corrida +{XP_REGRAS.podio}, vitória +{XP_REGRAS.vitoria}, pole na tomada de tempo +{XP_REGRAS.pole} e volta mais rápida da bateria +{XP_REGRAS.voltaMaisRapida}.</Text>
          </Bloco>
          <Bloco icone="crown" cor={palette.purpleNeon} titulo="Categorias">
            {CATEGORIAS.map((c) => (
              <View key={c.nome} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: c.cor }} />
                <Text style={{ color: palette.text, fontWeight: '700', flex: 1 }}>{c.nome}</Text>
                <Text style={{ color: palette.textMuted, fontVariant: ['tabular-nums'] }}>{c.desde ? `a partir de ${c.desde.toLocaleString('pt-BR')} XP` : 'início'}</Text>
              </View>
            ))}
          </Bloco>
          <Bloco icone="info" cor={palette.neonGreen} titulo="Seu nome no ranking">
            <Text style={t}>Sua carreira aparece quando a conta do app está ligada ao seu cadastro do kartódromo (mesmo CPF e o mesmo e-mail ou telefone). A atualização acontece a cada 10 minutos.</Text>
          </Bloco>
          <Pressable onPress={onFechar} style={({ pressed }) => [styles.action, pressed && styles.pressedAction]}><Text style={styles.actionText}>Entendi</Text></Pressable>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
