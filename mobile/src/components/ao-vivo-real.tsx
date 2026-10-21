/**
 * Ao vivo do app de loja: a bateria que está na pista (ou a última que terminou), direto da cronometragem.
 * Ponto vermelho pulsando enquanto está ao vivo, faixa da volta mais rápida, classificação compacta com cores de
 * pódio e seta verde/vermelha quando o piloto ganha ou perde posição. Tocar no piloto abre o cockpit no kart dele.
 */
import { router, type Href } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon } from './brand';
import { Entrada, tap } from './motion';
import { useUi } from './theme';
import type { LiveCompetitor, LiveSession } from '../types/racing';

const MEDALHA = ['#F59E0B', '#C0C7D1', '#CD7F32'];

/** ponto que pulsa (anel crescendo e sumindo), como o "ao vivo" das transmissões */
function PontoAoVivo({ cor }: { cor: string }) {
  const [anel] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(anel, { toValue: 1, duration: 1400, easing: Easing.out(Easing.quad), useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [anel]);
  return (
    <View style={{ width: 12, height: 12, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={{ position: 'absolute', width: 12, height: 12, borderRadius: 6, backgroundColor: cor,
        opacity: anel.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] }), transform: [{ scale: anel.interpolate({ inputRange: [0, 1], outputRange: [1, 2.6] }) }] }} />
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: cor }} />
    </View>
  );
}

/** seta que aparece por 4 s quando a posição muda */
function Movimento({ ganhou }: { ganhou: number }) {
  const { palette } = useUi();
  const [vis] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (!ganhou) return;
    vis.setValue(1);
    Animated.timing(vis, { toValue: 0, duration: 4000, delay: 600, useNativeDriver: true }).start();
  }, [ganhou, vis]);
  if (!ganhou) return null;
  return (
    <Animated.Text style={{ position: 'absolute', left: 6, top: 4, opacity: vis, color: ganhou > 0 ? palette.neonGreen : palette.neonRed, fontSize: 11, fontWeight: '900' }}>
      {ganhou > 0 ? `▲${ganhou}` : `▼${-ganhou}`}
    </Animated.Text>
  );
}

function Linha({ c, ganhou, index, maisRapida }: { c: LiveCompetitor; ganhou: number; index: number; maisRapida: boolean }) {
  const { palette } = useUi();
  const medalha = MEDALHA[c.position - 1];
  return (
    <Entrada index={index}>
      <Pressable onPress={() => { tap(); router.push(`/cockpit?kart=${encodeURIComponent(c.kartNumber)}` as Href); }} accessibilityRole="button"
        accessibilityLabel={`${c.position}º, ${c.name}, kart ${c.kartNumber}, melhor volta ${c.bestLapTime}. Toque para abrir o cockpit.`}
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 12, marginBottom: 8, borderRadius: 18,
          backgroundColor: palette.surface, borderWidth: 1, borderColor: c.position === 1 ? 'rgba(245,158,11,0.45)' : palette.borderSubtle, transform: [{ scale: pressed ? 0.98 : 1 }] })}>
        <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: medalha ?? palette.surfaceElevated, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: medalha ? '#000000' : palette.text, fontSize: 18, fontWeight: '900', fontVariant: ['tabular-nums'] }}>{c.position}</Text>
          <Movimento ganhou={ganhou} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text numberOfLines={1} style={{ color: palette.text, fontSize: 16, fontWeight: '800' }}>{c.name}</Text>
          <Text style={{ color: palette.textMuted, fontSize: 12 }}>Kart {c.kartNumber} · volta {c.currentLap}{c.position > 1 && c.diffLeader !== '—' ? ` · ${c.diffLeader}` : ''}</Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 3 }}>
          <Text style={{ color: palette.text, fontSize: 16, fontWeight: '800', fontVariant: ['tabular-nums'] }}>{c.lastLapTime}</Text>
          <View style={{ paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, backgroundColor: maisRapida ? palette.purpleNeon : palette.surfaceElevated }}>
            <Text style={{ color: maisRapida ? '#FFFFFF' : palette.textSecondary, fontSize: 12, fontWeight: '700', fontVariant: ['tabular-nums'] }}>{c.bestLapTime}</Text>
          </View>
        </View>
      </Pressable>
    </Entrada>
  );
}

export function AoVivoReal({ session, onRefresh }: { session: LiveSession; onRefresh: () => Promise<void> | void }) {
  const { palette, styles } = useUi();
  const aoVivo = session.status !== 'CHECKERED';
  const [atualizando, setAtualizando] = useState(false);
  // posição anterior de cada kart, para mostrar quem subiu ou desceu
  const anteriores = useRef(new Map<string, number>());
  const [movimentos, setMovimentos] = useState<Record<string, number>>({});
  useEffect(() => {
    const novos: Record<string, number> = {};
    for (const c of session.competitors) {
      const antes = anteriores.current.get(c.kartNumber);
      if (antes !== undefined && antes !== c.position) novos[c.kartNumber] = antes - c.position;
      anteriores.current.set(c.kartNumber, c.position);
    }
    if (Object.keys(novos).length) void Promise.resolve().then(() => setMovimentos((m) => ({ ...m, ...novos })));
  }, [session.competitors]);

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <FlatList
        data={session.competitors}
        keyExtractor={(c) => c.kartNumber}
        renderItem={({ item, index }) => <Linha c={item} index={index} ganhou={movimentos[item.kartNumber] ?? 0} maisRapida={item.isFastestLap} />}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 200, width: '100%', maxWidth: 640, alignSelf: 'center' }}
        refreshControl={<RefreshControl refreshing={atualizando} tintColor={palette.accent} onRefresh={() => { setAtualizando(true); void Promise.resolve(onRefresh()).finally(() => setAtualizando(false)); }} />}
        ListHeaderComponent={
          <View style={{ paddingTop: 12, paddingBottom: 6, gap: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Text accessibilityRole="header" style={[styles.title, { flex: 1 }]}>Ao vivo</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: aoVivo ? 'rgba(239,68,68,0.15)' : palette.surface }}>
                {aoVivo ? <PontoAoVivo cor={palette.neonRed} /> : <Icon name="flag" color={palette.textSecondary} size={14} />}
                <Text style={{ color: aoVivo ? palette.neonRed : palette.textSecondary, fontWeight: '800', fontSize: 13, fontVariant: ['tabular-nums'] }}>{aoVivo ? session.elapsedTime : 'Encerrada'}</Text>
              </View>
            </View>
            <View>
              <Text style={{ color: palette.text, fontSize: 18, fontWeight: '800' }}>{session.title}</Text>
              <Text style={{ color: palette.textMuted, fontSize: 13, marginTop: 2 }}>{session.subtitle} · {session.competitors.length} pilotos</Text>
            </View>
            {session.fastestLap ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 18, backgroundColor: 'rgba(139,92,246,0.18)', borderWidth: 1, borderColor: 'rgba(139,92,246,0.45)' }}>
                <Icon name="bolt" color={palette.purpleNeon} size={22} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: palette.purpleNeon, fontSize: 12, fontWeight: '800', letterSpacing: 1 }}>VOLTA MAIS RÁPIDA</Text>
                  <Text numberOfLines={1} style={{ color: palette.text, fontSize: 15, fontWeight: '700', marginTop: 2 }}>{session.fastestLap.name} · Kart {session.fastestLap.competitorNumber}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ color: palette.text, fontSize: 20, fontWeight: '900', fontVariant: ['tabular-nums'] }}>{session.fastestLap.time}</Text>
                  <Text style={{ color: palette.textMuted, fontSize: 11 }}>volta {session.fastestLap.lapNumber}</Text>
                </View>
              </View>
            ) : null}
            <Text style={{ color: palette.textMuted, fontSize: 12 }}>Toque num piloto para acompanhar pelo cockpit. Última volta e, embaixo, a melhor.</Text>
          </View>
        }
      />
      <Pressable accessibilityRole="button" accessibilityLabel="Abrir cockpit" onPress={() => { tap(); router.push('/cockpit' as Href); }}
        style={({ pressed }) => ({ position: 'absolute', right: 18, bottom: 128, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: palette.accent, paddingHorizontal: 18, paddingVertical: 14, borderRadius: 999,
          shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 8, transform: [{ scale: pressed ? 0.94 : 1 }] })}>
        <Icon name="timer" color="#000000" size={20} />
        <Text style={{ color: '#000000', fontWeight: '900', fontSize: 15 }}>Meu cockpit</Text>
      </Pressable>
    </SafeAreaView>
  );
}
