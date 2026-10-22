/**
 * Ao vivo do app de loja: a bateria que está na pista (ou a última que terminou), direto da cronometragem.
 * Ponto vermelho pulsando enquanto está ao vivo, faixa da volta mais rápida, classificação compacta com cores de
 * pódio e seta verde/vermelha quando o piloto ganha ou perde posição. Tocar no piloto abre o cockpit no kart dele.
 */
import { router, type Href } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, FlatList, Platform, Pressable, RefreshControl, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Brand, Icon } from './brand';
import { HeroFoto, fotos } from './hero-foto';
import { Entrada, tap } from './motion';
import { useUi } from './theme';
import { useAgoraCrono } from '../features/live/api';
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

const MONO = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' });

/** tempo de prova com milésimos, no relógio da cronometragem */
function RelogioMs({ inicio, reserva }: { inicio: number; reserva: string }) {
  const agora = useAgoraCrono(50);
  if (!Number.isFinite(inicio)) return <>{reserva}</>;
  const ms = Math.max(0, agora - inicio);
  return <>{Math.floor(ms / 3600000)}:{String(Math.floor((ms % 3600000) / 60000)).padStart(2, '0')}:{String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')}.{String(ms % 1000).padStart(3, '0')}</>;
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
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 8, marginBottom: 6, borderRadius: 14,
          backgroundColor: '#0D1411', borderWidth: 1, borderColor: c.position === 1 ? 'rgba(245,184,46,0.7)' : '#1C2621', transform: [{ scale: pressed ? 0.98 : 1 }] })}>
        <View style={{ width: 32, height: 32, borderRadius: 9, backgroundColor: medalha ?? '#24302A', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: medalha ? '#000000' : palette.text, fontSize: 15, fontWeight: '900', fontVariant: ['tabular-nums'] }}>{c.position}</Text>
          <Movimento ganhou={ganhou} />
        </View>
        <View style={{ width: 3, height: 30, borderRadius: 2, backgroundColor: medalha ?? (ganhou > 0 ? palette.neonGreen : '#3A4640') }} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: '#E6EBE8', fontSize: 12, fontWeight: '800', fontFamily: MONO }}>#{c.kartNumber}</Text>
          <Text numberOfLines={2} style={{ color: palette.text, fontSize: 12, lineHeight: 14, fontWeight: '900' }}>{/^karts*d+$/i.test(c.name.trim()) ? `KART ${c.kartNumber}` : c.name.toUpperCase()}</Text>
        </View>
        <Text style={{ width: 58, textAlign: 'right', color: palette.neonGreen, fontSize: 12, fontWeight: '700', fontFamily: MONO, fontVariant: ['tabular-nums'] }}>{c.lastLapTime}</Text>
        <View style={{ width: 64, alignItems: 'center', paddingVertical: 4, borderRadius: 999, backgroundColor: maisRapida ? '#7B4DFF' : 'transparent' }}>
          <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '700', fontFamily: MONO, fontVariant: ['tabular-nums'] }}>{c.bestLapTime}</Text>
        </View>
        <Text style={{ width: 44, textAlign: 'right', color: '#C9D2CD', fontSize: 11.5, fontFamily: MONO, fontVariant: ['tabular-nums'] }}>{c.position === 1 ? '-' : c.diffLeader}</Text>
        <Text style={{ width: 24, textAlign: 'right', color: palette.text, fontSize: 13, fontWeight: '800', fontVariant: ['tabular-nums'] }}>{c.currentLap}</Text>
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
    <SafeAreaView edges={['left', 'right']} style={styles.safeArea}>
      <FlatList
        data={session.competitors}
        keyExtractor={(c) => c.kartNumber}
        renderItem={({ item, index }) => <Linha c={item} index={index} ganhou={movimentos[item.kartNumber] ?? 0} maisRapida={item.isFastestLap} />}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 200, width: '100%', maxWidth: 640, alignSelf: 'center' }}
        refreshControl={<RefreshControl refreshing={atualizando} tintColor={palette.accent} onRefresh={() => { setAtualizando(true); void Promise.resolve(onRefresh()).finally(() => setAtualizando(false)); }} />}
        ListHeaderComponent={
          <View style={{ paddingTop: 12, paddingBottom: 6, gap: 12 }}>
            <View style={{ marginHorizontal: -16, marginTop: -12 }}>
              <HeroFoto foto={fotos.aovivo} rotulo={aoVivo ? 'AO VIVO' : 'ÚLTIMA BATERIA'} linha1={(() => { const t = session.title.trim().split(/s+/); return t.length > 1 ? [t.slice(0, -1).join(' '), t[t.length - 1]] : [t[0] ?? 'Bateria', '']; })()[0].toUpperCase()} linha2={(() => { const t = session.title.trim().split(/s+/); return t.length > 1 ? [t.slice(0, -1).join(' '), t[t.length - 1]] : [t[0] ?? 'Bateria', '']; })()[1].toUpperCase() || undefined} altura={300}
                topo={
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <View style={{ flex: 1 }}><Brand width={150} /></View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, height: 40, borderRadius: 20, borderWidth: 1, borderColor: '#1C2621', backgroundColor: aoVivo ? 'rgba(239,68,68,0.18)' : 'rgba(17,24,21,0.9)' }}>
                      {aoVivo ? <PontoAoVivo cor={palette.neonRed} /> : <Icon name="flag" color="#FFFFFF" size={14} />}
                      <Text style={{ color: aoVivo ? palette.neonRed : '#FFFFFF', fontWeight: '800', fontSize: 14, fontVariant: ['tabular-nums'] }}>{aoVivo ? <RelogioMs inicio={Date.parse(session.id)} reserva={session.elapsedTime} /> : 'Encerrada'}</Text>
                    </View>
                  </View>
                }>
                <Text style={{ color: '#A8B3AD', fontSize: 13, letterSpacing: 1 }}>{session.subtitle.toUpperCase()} · {session.competitors.length} PILOTOS</Text>
              </HeroFoto>
            </View>
            {session.fastestLap ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 20, backgroundColor: '#24124F', borderWidth: 1.5, borderColor: '#8B5CF6', shadowColor: '#8B5CF6', shadowOpacity: 0.45, shadowRadius: 16, elevation: 6 }}>
                <Icon name="bolt" color="#FFFFFF" size={22} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '800', letterSpacing: 1, fontFamily: MONO }}>VOLTA MAIS RÁPIDA</Text>
                  <Text numberOfLines={1} style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '800', marginTop: 2, fontFamily: MONO }}>#{session.fastestLap.competitorNumber} {/^kart\s*\d+$/i.test(session.fastestLap.name.trim()) ? '' : session.fastestLap.name.toUpperCase()}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ color: '#FFFFFF', fontSize: 20, fontWeight: '900', fontFamily: MONO, fontVariant: ['tabular-nums'] }}>{session.fastestLap.time}</Text>
                  <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 11, fontFamily: MONO }}>NA VOLTA {session.fastestLap.lapNumber}</Text>
                </View>
              </View>
            ) : null}
            {aoVivo ? <Text style={{ color: palette.textMuted, fontSize: 12 }}>Toque num piloto para acompanhar pelo cockpit. Última volta e, embaixo, a melhor.</Text>
              : <Text style={{ color: palette.textSecondary, fontSize: 13, lineHeight: 19 }}>Nenhuma bateria na pista agora — este é o resultado da última que terminou. A próxima aparece aqui sozinha assim que o primeiro kart cruzar a linha.</Text>}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8 }}>
              {[['#', 32], ['', 3]].map(([t, w]) => <Text key={String(w)} style={{ width: w as number, color: '#8C9892', fontSize: 10, fontWeight: '700', textAlign: 'center' }}>{t}</Text>)}
              <Text style={{ flex: 1, color: '#8C9892', fontSize: 10, fontWeight: '700', letterSpacing: 0.5 }}>PILOTO</Text>
              <Text style={{ width: 58, textAlign: 'right', color: '#8C9892', fontSize: 10, fontWeight: '700' }}>ÚLTIMA</Text>
              <Text style={{ width: 64, textAlign: 'center', color: '#8C9892', fontSize: 10, fontWeight: '700' }}>MELHOR</Text>
              <Text style={{ width: 44, textAlign: 'right', color: '#8C9892', fontSize: 10, fontWeight: '700' }}>DIFF</Text>
              <Text style={{ width: 24, textAlign: 'right', color: '#8C9892', fontSize: 10, fontWeight: '700' }}>V</Text>
            </View>
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
