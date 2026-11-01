/**
 * Cartão da carreira para compartilhar (stories do Instagram / status do WhatsApp): desenhado fora da tela em 9:16,
 * vira imagem com react-native-view-shot e abre a folha de compartilhar do sistema.
 */
import * as Sharing from 'expo-sharing';
import { useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, Text, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

import { Icon } from './brand';
import { FotoPiloto } from './foto-piloto';
import { tap } from './motion';
import { useUi } from './theme';
import { formatarVolta, type CarreiraPiloto } from '../features/ranking/api';
import { nomeBonito } from '../features/ranking/gamificacao';

type Categoria = { nome: string; cor: string };

function Cartao({ dados, xp, cat, versaoFoto }: { dados: CarreiraPiloto; xp: number; cat: Categoria; versaoFoto: number }) {
  const melhores = [...dados.tracados].sort((a, b) => b.corridas - a.corridas).slice(0, 2);
  // quem só correu no LapTime antigo não tem baterias detalhadas: mostra as semanas no top 10
  const numeros = dados.baterias === 0 && (dados.semanasTop10 || dados.mesesTop10)
    ? [['Semanas no top 10', dados.semanasTop10 ?? 0], ['Meses no top 10', dados.mesesTop10 ?? 0]] as const
    : [['Vitórias', dados.vitorias], ['Pódios', dados.podios], ['Baterias', dados.baterias]] as const;
  return (
    <View style={{ width: 360, height: 640, backgroundColor: '#050505', padding: 28, justifyContent: 'space-between', overflow: 'hidden' }}>
      {/* faixas diagonais de fundo, na cor da categoria */}
      <View style={{ position: 'absolute', top: -120, right: -160, width: 420, height: 160, backgroundColor: cat.cor, opacity: 0.18, transform: [{ rotate: '-28deg' }] }} />
      <View style={{ position: 'absolute', bottom: -60, left: -140, width: 420, height: 90, backgroundColor: cat.cor, opacity: 0.12, transform: [{ rotate: '-28deg' }] }} />
      <Image source={require('../../assets/brand-logo-dark.png')} resizeMode="contain" style={{ width: 200, height: 56 }} />
      <View style={{ alignItems: 'center', gap: 10 }}>
        <View style={{ padding: 4, borderRadius: 70, backgroundColor: cat.cor }}>
          <FotoPiloto id={dados.id} versao={versaoFoto} nome={dados.nome} tamanho={120} cor={cat.cor} />
        </View>
        <Text style={{ color: '#FFFFFF', fontSize: 28, fontWeight: '900', textAlign: 'center' }} numberOfLines={2}>{nomeBonito(dados.nome)}</Text>
        <View style={{ backgroundColor: cat.cor, paddingHorizontal: 16, paddingVertical: 6, borderRadius: 999 }}>
          <Text style={{ color: '#000000', fontWeight: '900', letterSpacing: 2 }}>{cat.nome} · {xp.toLocaleString('pt-BR')} XP</Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row' }}>
        {numeros.map(([rot, v]) => (
          <View key={rot} style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ color: '#FFFFFF', fontSize: 36, fontWeight: '900' }}>{v}</Text>
            <Text style={{ color: '#9CA3AF', fontSize: 13 }}>{rot}</Text>
          </View>
        ))}
      </View>
      <View style={{ gap: 8 }}>
        {melhores.map((t) => (
          <View key={t.nome} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 14, padding: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#9CA3AF', fontSize: 11, fontWeight: '800', letterSpacing: 1 }}>MELHOR VOLTA</Text>
              <Text numberOfLines={1} style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '700' }}>{t.nome}</Text>
              {t.geral ? <Text style={{ color: '#F59E0B', fontSize: 12, fontWeight: '800', marginTop: 2 }}>{t.geral.pos}º de {t.geral.de.toLocaleString('pt-BR')} no ranking geral</Text> : null}
            </View>
            <Text style={{ color: '#F59E0B', fontSize: 24, fontWeight: '900', fontVariant: ['tabular-nums'] }}>{formatarVolta(t.ms)}</Text>
          </View>
        ))}
      </View>
      <Text style={{ color: '#6B7280', fontSize: 12, textAlign: 'center' }}>Kartódromo Internacional de Betim · app do piloto</Text>
    </View>
  );
}

export function BotaoCompartilhar({ dados, xp, cat, versaoFoto }: { dados: CarreiraPiloto; xp: number; cat: Categoria; versaoFoto: number }) {
  const { palette } = useUi();
  const alvo = useRef<View>(null);
  const [gerando, setGerando] = useState(false);

  async function compartilhar() {
    tap();
    setGerando(true);
    try {
      const arquivo = await captureRef(alvo, { format: 'png', quality: 1, width: 1080, height: 1920 });
      if (!(await Sharing.isAvailableAsync())) throw new Error('Compartilhar não está disponível neste aparelho.');
      await Sharing.shareAsync(arquivo, { mimeType: 'image/png', dialogTitle: 'Compartilhar minha carreira', UTI: 'public.png' });
    } catch (e) {
      Alert.alert('Não foi possível compartilhar', e instanceof Error ? e.message : 'Tente novamente.');
    } finally {
      setGerando(false);
    }
  }

  return (
    <>
      {/* o cartão fica fora da área visível; só existe para virar imagem */}
      <View pointerEvents="none" style={{ position: 'absolute', left: -10000, top: 0 }}>
        <View ref={alvo} collapsable={false}><Cartao dados={dados} xp={xp} cat={cat} versaoFoto={versaoFoto} /></View>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Compartilhar carreira" disabled={gerando} onPress={() => void compartilhar()}
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, transform: [{ scale: pressed ? 0.95 : 1 }] })}>
        {gerando ? <ActivityIndicator size="small" color={palette.accent} /> : <Icon name="star" color={palette.accent} size={16} />}
        <Text style={{ color: palette.text, fontWeight: '800', fontSize: 14 }}>Compartilhar no story</Text>
      </Pressable>
    </>
  );
}
