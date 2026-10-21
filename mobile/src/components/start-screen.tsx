import { router, type Href } from 'expo-router';
import { ImageBackground, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Brand, Icon } from './brand';
import { Entrada, tap } from './motion';
import { ProximaReserva } from './proxima-reserva';
import { useUi } from './theme';
import { useLiveSession } from '../features/live/api';
import { useSession } from '../session/provider';

/** política do app (página do domínio das reservas; o site principal não tem /privacidade) */
const PRIVACIDADE = 'https://reservas.kartodromodebetim.com.br/privacidade';

type Atalho = { titulo: string; texto: string; icone: 'calendar' | 'ticket' | 'timer' | 'results' | 'trophy' | 'podium'; href: Href; cor: string };

/** Início do app de loja: capa da pista, corrida ao vivo e atalhos para as funções ligadas a dados reais. */
export default function StartScreen() {
  const { palette } = useUi();
  const { session } = useSession();
  const { snapshot } = useLiveSession(10_000);
  const insets = useSafeAreaInsets();
  const aoVivo = snapshot?.status === 'live' && snapshot.drivers.length > 0;

  const atalhos: Atalho[] = [
    { titulo: 'Agenda', texto: 'Horários livres da pista', icone: 'calendar', href: '/(tabs)/agenda', cor: palette.accent },
    { titulo: 'Reservas', texto: 'Suas baterias e cupons', icone: 'ticket', href: '/(tabs)/reservas', cor: palette.blue },
    { titulo: 'Ao vivo', texto: 'Tempos volta a volta', icone: 'timer', href: '/(tabs)/livetime', cor: palette.neonRed },
    { titulo: 'Resultados', texto: 'Seu histórico na pista', icone: 'results', href: '/(tabs)/resultados', cor: palette.neonGreen },
    { titulo: 'Ranking', texto: 'Os mais rápidos da pista', icone: 'podium', href: '/ranking', cor: palette.purpleNeon },
    { titulo: 'Minha carreira', texto: 'XP, conquistas e tempos', icone: 'trophy', href: (session ? '/piloto/eu' : '/(auth)/login') as Href, cor: palette.gold },
  ];

  return (
    <ScrollView style={{ flex: 1, backgroundColor: palette.background }} contentContainerStyle={{ paddingBottom: 120 }}>
      <ImageBackground source={require('../../assets/betim-track.jpg')} resizeMode="cover" style={{ paddingTop: insets.top + 28, paddingBottom: 36, paddingHorizontal: 20 }}>
        <View pointerEvents="none" style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.55)' }} />
        {/* escurece em degraus até o preto da página, sem linha de corte */}
        {[0.15, 0.3, 0.45, 0.6, 0.75].map((a, i) => <View key={a} pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 120 - i * 24, backgroundColor: `rgba(0,0,0,${a / 2})` }} />)}
        <Brand width={260} />
        <Text accessibilityRole="header" style={{ color: palette.text, fontSize: 30, fontWeight: '900', marginTop: 26, letterSpacing: -0.5 }}>
          {session ? 'Bora pra pista?' : 'Acelere com a gente'}
        </Text>
        <Text style={{ color: palette.textSecondary, fontSize: 16, marginTop: 6, lineHeight: 22 }}>
          Reserve sua bateria, acompanhe a corrida ao vivo e veja seus tempos.
        </Text>
      </ImageBackground>

      <View style={{ paddingHorizontal: 20, marginTop: -14, gap: 14, width: '100%', maxWidth: 600, alignSelf: 'center' }}>
        <ProximaReserva />
        <Entrada index={0}>
        <Pressable onPress={() => { tap(); router.push('/(tabs)/livetime'); }} accessibilityRole="button"
          style={({ pressed }) => ({ backgroundColor: palette.surface, borderRadius: 20, borderWidth: 1, borderColor: aoVivo ? palette.neonRed : palette.border, padding: 18, opacity: pressed ? 0.85 : 1 })}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: aoVivo ? palette.neonRed : palette.textMuted }} />
            <Text style={{ color: aoVivo ? palette.neonRed : palette.textMuted, fontWeight: '800', fontSize: 13, letterSpacing: 1 }}>
              {aoVivo ? 'AO VIVO AGORA' : 'PISTA'}
            </Text>
            <View style={{ flex: 1 }} />
            <Icon name="chevron" color={palette.textMuted} size={18} />
          </View>
          {aoVivo ? (
            <>
              <Text style={{ color: palette.text, fontSize: 18, fontWeight: '800', marginTop: 10 }} numberOfLines={1}>{snapshot.eventName}</Text>
              {snapshot.drivers.slice(0, 3).map((d) => (
                <View key={d.position} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 12 }}>
                  <Text style={{ color: d.position === 1 ? palette.gold : palette.textSecondary, fontWeight: '900', fontSize: 16, width: 22 }}>{d.position}</Text>
                  <Text style={{ color: palette.text, fontSize: 15, flex: 1 }} numberOfLines={1}>{d.name}</Text>
                  <Text style={{ color: palette.textSecondary, fontSize: 15, fontVariant: ['tabular-nums'] }}>{d.best || '—'}</Text>
                </View>
              ))}
              <Pressable onPress={() => { tap(); router.push('/cockpit' as Href); }} accessibilityRole="button" style={({ pressed }) => ({ marginTop: 14, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: palette.neonRed, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, transform: [{ scale: pressed ? 0.95 : 1 }] })}>
                <Icon name="timer" color="#FFFFFF" size={16} />
                <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 13 }}>Abrir meu cockpit</Text>
              </Pressable>
            </>
          ) : (
            <Text style={{ color: palette.textSecondary, fontSize: 15, marginTop: 8 }}>
              Nenhuma bateria rodando agora. Quando começar, os tempos aparecem aqui na hora.
            </Text>
          )}
        </Pressable>
        </Entrada>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
          {atalhos.map((a, i) => (
            <Entrada key={a.titulo} index={i + 1} style={{ flexGrow: 1, flexBasis: '45%' }}>
            <Pressable onPress={() => { tap(); router.push(a.href); }} accessibilityRole="button" accessibilityLabel={a.titulo}
              style={({ pressed }) => ({ backgroundColor: palette.surface, borderRadius: 20, borderWidth: 1, borderColor: palette.border, padding: 16, minHeight: 132, transform: [{ scale: pressed ? 0.97 : 1 }] })}>
              <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: palette.surfaceElevated, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={a.icone} color={a.cor} size={24} />
              </View>
              <Text style={{ color: palette.text, fontSize: 17, fontWeight: '800', marginTop: 14 }}>{a.titulo}</Text>
              <Text style={{ color: palette.textMuted, fontSize: 13, marginTop: 4 }}>{a.texto}</Text>
            </Pressable>
            </Entrada>
          ))}
        </View>

        <Entrada index={7}>
        <Pressable onPress={() => { tap(); router.push(session ? '/(tabs)/reservas' : '/(auth)/login'); }} accessibilityRole="button"
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: session ? palette.surface : palette.accent, borderRadius: 20, padding: 18, opacity: pressed ? 0.85 : 1 })}>
          <Icon name="account" color={session ? palette.accent : palette.onAccent} size={28} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: session ? palette.text : palette.onAccent, fontSize: 17, fontWeight: '800' }}>
              {session ? 'Minha conta' : 'Entrar ou criar conta'}
            </Text>
            <Text style={{ color: session ? palette.textMuted : palette.onAccent, fontSize: 13, marginTop: 2, opacity: session ? 1 : 0.8 }}>
              {session ? 'Reservas, cupons e resultados' : 'Para reservar e ver seus resultados'}
            </Text>
          </View>
          <Icon name="chevron" color={session ? palette.textMuted : palette.onAccent} size={20} />
        </Pressable>
        </Entrada>

        <Pressable onPress={() => void Linking.openURL(PRIVACIDADE)} accessibilityRole="link" style={{ alignSelf: 'center', paddingVertical: 12 }}>
          <Text style={{ color: palette.textMuted, fontSize: 13, textDecorationLine: 'underline' }}>Política de privacidade</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
