/**
 * Cockpit do piloto: a bateria ao vivo vista do SEU kart, em letras enormes para ler de relance (no box, no
 * suporte do capacete ou na mão de quem está assistindo). Acha o kart pelo nome da conta; se não achar, o
 * piloto escolhe na lista. Atualiza a cada 2 s, vibra a cada volta nova e brilha roxo no recorde pessoal.
 * A tela não apaga enquanto o cockpit está aberto.
 */
import { router } from 'expo-router';
import { useKeepAwake } from 'expo-keep-awake';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { Icon } from './brand';
import { tap } from './motion';
import { useUi } from './theme';
import { lapMs, liveApi, type LiveSnapshot } from '../features/live/api';
import { rankingApi } from '../features/ranking/api';
import { nomeBonito } from '../features/ranking/gamificacao';
import { useSession } from '../session/provider';

const normal = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
// +0.000 fora do líder é passagem lançada à mão: sem diferença confiável
const gapMs = (g: string) => { const m = /^\+?(\d+)\.(\d{1,3})$/.exec(g.trim()); const ms = m ? Number(m[1]) * 1000 + Number(m[2].padEnd(3, '0')) : null; return ms ? ms : null; };
const seg = (ms: number) => `${(ms / 1000).toFixed(3)}`;

/** número grande que pulsa quando muda */
function Pulso({ valor, estilo }: { valor: string; estilo: object }) {
  const [esc] = useState(() => new Animated.Value(1));
  const anterior = useRef(valor);
  useEffect(() => {
    if (anterior.current === valor) return;
    anterior.current = valor;
    esc.setValue(1.18);
    Animated.spring(esc, { toValue: 1, useNativeDriver: true, damping: 9, stiffness: 160 }).start();
  }, [esc, valor]);
  // uma linha só: o número encolhe em vez de quebrar
  return <Animated.Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5} style={[estilo, { transform: [{ scale: esc }] }]}>{valor}</Animated.Text>;
}

function Bloco({ rotulo, valor, cor, grande = false }: { rotulo: string; valor: string; cor: string; grande?: boolean }) {
  const { palette } = useUi();
  return (
    <View style={{ flex: 1, backgroundColor: palette.surface, borderRadius: 22, padding: 16, borderWidth: 1, borderColor: palette.border, justifyContent: 'space-between', minHeight: grande ? 150 : 112 }}>
      <Text style={{ color: palette.textMuted, fontSize: 12, fontWeight: '800', letterSpacing: 1.5 }}>{rotulo}</Text>
      <Pulso valor={valor} estilo={{ color: cor, fontSize: grande ? 46 : 32, fontWeight: '900', fontVariant: ['tabular-nums'], letterSpacing: -1 }} />
    </View>
  );
}

export default function CockpitReal() {
  useKeepAwake();
  const { palette } = useUi();
  const { session } = useSession();
  const [snap, setSnap] = useState<LiveSnapshot | null>(null);
  const [erro, setErro] = useState('');
  const [meuNome, setMeuNome] = useState<string | null>(null);
  const [kart, setKart] = useState<string | null>(null);
  const [brilho] = useState(() => new Animated.Value(0));
  const ultimaVolta = useRef<number | null>(null);
  const melhorAnterior = useRef<number | null>(null);

  // nome do piloto da conta (para achar o kart sozinho)
  useEffect(() => {
    if (!session) return;
    void rankingApi.minha(session.accessToken).then((c) => setMeuNome(c.nome)).catch(() => undefined);
  }, [session]);

  useEffect(() => {
    let ativo = true;
    const buscar = async () => {
      try { const s = await liveApi.snapshot(); if (ativo) { setSnap(s); setErro(''); } }
      catch (e) { if (ativo) setErro(e instanceof Error ? e.message : 'Sem conexão com a cronometragem.'); }
    };
    void buscar();
    const t = setInterval(() => void buscar(), 2000);
    return () => { ativo = false; clearInterval(t); };
  }, []);

  const pilotos = useMemo(() => snap?.drivers ?? [], [snap]);
  const automatico = useMemo(() => (meuNome ? pilotos.find((p) => normal(p.name) === normal(meuNome))?.kart ?? null : null), [meuNome, pilotos]);
  const escolhido = kart ?? automatico;
  const eu = pilotos.find((p) => p.kart === escolhido) ?? null;
  const ao = snap?.status === 'live';

  // volta nova: vibra; recorde pessoal: brilho roxo
  useEffect(() => {
    if (!eu || eu.laps === null) return;
    const melhor = lapMs(eu.best);
    if (ultimaVolta.current !== null && eu.laps > ultimaVolta.current) {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
      if (melhor !== null && melhorAnterior.current !== null && melhor < melhorAnterior.current) {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
        brilho.setValue(1);
        Animated.timing(brilho, { toValue: 0, duration: 2200, easing: Easing.out(Easing.quad), useNativeDriver: false }).start();
      }
    }
    ultimaVolta.current = eu.laps;
    melhorAnterior.current = melhor;
  }, [eu, brilho]);

  const voltar = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)'));

  if (!eu) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: palette.background }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, gap: 10 }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Voltar" onPress={voltar} style={{ padding: 6 }}><Icon name="back" color={palette.text} size={24} /></Pressable>
          <Text accessibilityRole="header" style={{ color: palette.text, fontSize: 28, fontWeight: '900' }}>Cockpit</Text>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 60 }}>
          {erro ? <Text style={{ color: palette.danger }}>{erro}</Text> : null}
          {!snap ? <Text style={{ color: palette.textMuted }}>Conectando à cronometragem…</Text> : null}
          {snap && !pilotos.length ? <Text style={{ color: palette.textSecondary, fontSize: 16, lineHeight: 23 }}>Nenhuma bateria na pista agora. Abra o cockpit quando a sua largar.</Text> : null}
          {pilotos.length ? <Text style={{ color: palette.textSecondary, fontSize: 16, marginBottom: 6 }}>Qual é o seu kart?</Text> : null}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {pilotos.map((p) => (
              <Pressable key={p.kart} onPress={() => { tap(); setKart(p.kart); }} accessibilityRole="button" accessibilityLabel={`Kart ${p.kart}, ${p.name}`}
                style={({ pressed }) => ({ width: '31%', aspectRatio: 1, borderRadius: 20, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, alignItems: 'center', justifyContent: 'center', padding: 8, transform: [{ scale: pressed ? 0.94 : 1 }] })}>
                <Text style={{ color: palette.text, fontSize: 34, fontWeight: '900' }}>{p.kart}</Text>
                <Text numberOfLines={1} style={{ color: palette.textMuted, fontSize: 12 }}>{nomeBonito(p.name)}</Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const i = pilotos.indexOf(eu);
  const frente = i > 0 ? pilotos[i - 1] : null;
  const atras = i < pilotos.length - 1 ? pilotos[i + 1] : null;
  const meuGap = i === 0 ? 0 : gapMs(eu.gap);
  const difFrente = frente && meuGap !== null ? meuGap - (i - 1 === 0 ? 0 : gapMs(frente.gap) ?? NaN) : NaN;
  const difAtras = atras && meuGap !== null ? (gapMs(atras.gap) ?? NaN) - meuGap : NaN;
  const ultima = lapMs(eu.last), melhor = lapMs(eu.best);
  const delta = ultima !== null && melhor !== null ? ultima - melhor : null;
  const corDelta = delta === null ? palette.text : delta <= 0 ? palette.purpleNeon : delta < 500 ? palette.neonGreen : palette.neonRed;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.background }}>
      <Animated.View pointerEvents="none" style={{ position: 'absolute', inset: 0, backgroundColor: palette.purpleNeon, opacity: brilho.interpolate({ inputRange: [0, 1], outputRange: [0, 0.35] }) }} />
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8, gap: 10 }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Voltar" onPress={voltar} style={{ padding: 6 }}><Icon name="back" color={palette.text} size={24} /></Pressable>
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={{ color: palette.text, fontSize: 17, fontWeight: '800' }}>{nomeBonito(eu.name)} · Kart {eu.kart}</Text>
          <Text numberOfLines={1} style={{ color: ao ? palette.neonRed : palette.textMuted, fontSize: 12, fontWeight: '800', letterSpacing: 1 }}>{ao ? '● AO VIVO' : 'ENCERRADA'} · {snap?.eventName}</Text>
        </View>
        <Pressable accessibilityRole="button" onPress={() => { tap(); setKart(null); if (automatico) setMeuNome(null); }} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: palette.surface }}>
          <Text style={{ color: palette.textSecondary, fontWeight: '700', fontSize: 13 }}>Trocar kart</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 1.2, backgroundColor: eu.position === 1 ? palette.accent : palette.surface, borderRadius: 26, padding: 18, justifyContent: 'space-between', minHeight: 190 }}>
            <Text style={{ color: eu.position === 1 ? '#000000' : palette.textMuted, fontSize: 12, fontWeight: '800', letterSpacing: 1.5 }}>POSIÇÃO</Text>
            <Pulso valor={`${eu.position}º`} estilo={{ color: eu.position === 1 ? '#000000' : palette.text, fontSize: 96, fontWeight: '900', letterSpacing: -4, lineHeight: 100 }} />
            <Text style={{ color: eu.position === 1 ? '#000000' : palette.textMuted, fontSize: 13 }}>de {pilotos.length}</Text>
          </View>
          <View style={{ flex: 1, gap: 12 }}>
            <Bloco rotulo="VOLTA" valor={String(eu.laps ?? 0)} cor={palette.text} />
            <Bloco rotulo="MELHOR" valor={eu.best || '—'} cor={palette.purpleNeon} />
          </View>
        </View>
        <View style={{ backgroundColor: palette.surface, borderRadius: 26, padding: 18, borderWidth: 1, borderColor: palette.border }}>
          <Text style={{ color: palette.textMuted, fontSize: 12, fontWeight: '800', letterSpacing: 1.5 }}>ÚLTIMA VOLTA</Text>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <Pulso valor={eu.last || '—'} estilo={{ color: palette.text, fontSize: 56, fontWeight: '900', fontVariant: ['tabular-nums'], letterSpacing: -2 }} />
            {delta !== null ? <Text style={{ color: corDelta, fontSize: 22, fontWeight: '900', fontVariant: ['tabular-nums'] }}>{delta <= 0 ? 'RECORDE' : `+${seg(delta)}`}</Text> : null}
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Bloco rotulo={frente ? `À FRENTE · ${frente.kart}` : 'À FRENTE'} valor={frente ? (Number.isFinite(difFrente) && difFrente > 0 ? `-${seg(difFrente)}` : '—') : 'LÍDER'} cor={frente ? palette.neonRed : palette.accent} />
          <Bloco rotulo={atras ? `ATRÁS · ${atras.kart}` : 'ATRÁS'} valor={atras ? (Number.isFinite(difAtras) && difAtras > 0 ? `+${seg(difAtras)}` : /volta/.test(atras.gap) ? atras.gap : '—') : '—'} cor={palette.neonGreen} />
        </View>
        <Text style={{ color: palette.textMuted, fontSize: 12, textAlign: 'center' }}>A tela fica acesa enquanto o cockpit está aberto. Atualiza a cada 2 segundos.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}
