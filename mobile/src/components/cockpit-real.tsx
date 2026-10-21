/**
 * Cockpit do piloto: a bateria ao vivo vista do SEU kart, com a tela deitada (paisagem) e letras enormes para ler
 * de relance no suporte do kart ou na mão de quem assiste. No centro corre o cronômetro da volta em andamento;
 * em volta ficam posição, volta, quem está à frente e atrás, última/melhor volta e o delta para a melhor.
 * Acha o kart pelo nome da conta; se não achar, o piloto escolhe. Atualiza a cada 1 s, vibra a cada volta nova,
 * pisca roxo no recorde pessoal e tem o modo "sol" (fundo branco) para ler no sol. A tela não apaga.
 */
import { router } from 'expo-router';
import { useKeepAwake } from 'expo-keep-awake';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
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
const MONO = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' });

/** 65432 → "1:05.4" (décimos, para o cronômetro que corre) */
const relogio = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')}.${Math.floor((ms % 1000) / 100)}`;
/** tempo de prova "0:16:34" */
const prova = (ms: number) => `${Math.floor(ms / 3600000)}:${String(Math.floor((ms % 3600000) / 60000)).padStart(2, '0')}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')}`;

const TEMAS = {
  escuro: { fundo: '#000000', texto: '#FFFFFF', apagado: '#8A8F98', verde: '#22E06B', vermelho: '#FF3B30', roxo: '#B07CFF', ouro: '#F59E0B' },
  sol: { fundo: '#FFFFFF', texto: '#000000', apagado: '#4B5058', verde: '#0A8F3C', vermelho: '#D70015', roxo: '#6E2BD9', ouro: '#B26A00' },
};

/** número grande que pulsa quando muda */
function Pulso({ valor, estilo }: { valor: string; estilo: object }) {
  const [esc] = useState(() => new Animated.Value(1));
  const anterior = useRef(valor);
  useEffect(() => {
    if (anterior.current === valor) return;
    anterior.current = valor;
    esc.setValue(1.15);
    Animated.spring(esc, { toValue: 1, useNativeDriver: true, damping: 9, stiffness: 160 }).start();
  }, [esc, valor]);
  // uma linha só: o número encolhe em vez de quebrar
  return <Animated.Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.4} style={[estilo, { transform: [{ scale: esc }] }]}>{valor}</Animated.Text>;
}

/** cronômetro da volta em andamento, redesenhado a cada décimo */
function VoltaCorrendo({ inicio, cor, tamanho, fim = false }: { inicio: number | null; cor: string; tamanho: number; fim?: boolean }) {
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setAgora(Date.now()), 100); return () => clearInterval(t); }, []);
  const ms = inicio ? Math.max(0, agora - inicio) : null;
  return (
    <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.4} accessibilityLabel="Tempo da volta atual"
      style={{ color: cor, fontFamily: MONO, fontSize: tamanho, lineHeight: tamanho * 1.05, fontWeight: '900', fontVariant: ['tabular-nums'], letterSpacing: -tamanho / 30, textAlign: 'center' }}>
      {fim ? 'FIM' : ms === null || ms > 10 * 60000 ? '-:--.-' : relogio(ms)}
    </Text>
  );
}

/** tempo de prova correndo (desde a largada) */
function RelogioProva({ inicio }: { inicio: number }) {
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setAgora(Date.now()), 1000); return () => clearInterval(t); }, []);
  return <>{prova(Math.max(0, agora - inicio))}</>;
}

function Rotulo({ texto, cor, tamanho = 13 }: { texto: string; cor: string; tamanho?: number }) {
  return <Text numberOfLines={1} style={{ color: cor, fontFamily: MONO, fontSize: tamanho, fontWeight: '700', letterSpacing: 1.5 }}>{texto}</Text>;
}

export default function CockpitReal({ kartInicial = null }: { kartInicial?: string | null }) {
  useKeepAwake();
  const { palette } = useUi();
  const tela = useWindowDimensions();
  const { session } = useSession();
  const [snap, setSnap] = useState<LiveSnapshot | null>(null);
  const [erro, setErro] = useState('');
  const [meuNome, setMeuNome] = useState<string | null>(null);
  const [kart, setKart] = useState<string | null>(kartInicial);
  const [tema, setTema] = useState<keyof typeof TEMAS>('escuro');
  const [brilho] = useState(() => new Animated.Value(0));
  const ultimaVolta = useRef<number | null>(null);
  const melhorAnterior = useRef<number | null>(null);
  const ultimoLast = useRef<string | null>(null);
  // início da volta atual (hora da passagem) e a volta anterior, para a seta da última volta
  const [inicioVolta, setInicioVolta] = useState<number | null>(null);
  const [penultima, setPenultima] = useState<number | null>(null);

  // cockpit deitado; ao sair, o app volta a ficar em pé
  useEffect(() => {
    if (Platform.OS === 'web') return;
    void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => undefined);
    return () => { void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => undefined); };
  }, []);

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
    const t = setInterval(() => void buscar(), 1000);
    return () => { ativo = false; clearInterval(t); };
  }, []);

  const pilotos = useMemo(() => snap?.drivers ?? [], [snap]);
  const automatico = useMemo(() => (meuNome ? pilotos.find((p) => normal(p.name) === normal(meuNome))?.kart ?? null : null), [meuNome, pilotos]);
  const escolhido = kart ?? automatico;
  const eu = pilotos.find((p) => p.kart === escolhido) ?? null;
  const ao = snap?.status === 'live';

  // volta nova: marca o início da próxima e vibra; recorde pessoal: brilho roxo
  useEffect(() => {
    if (!eu || eu.laps === null) return;
    const melhor = lapMs(eu.best);
    if (ultimaVolta.current !== null && eu.laps > ultimaVolta.current) {
      // o retrato da crono é gerado na passagem: a hora dele é o começo da volta nova
      const passagem = snap ? Date.parse(snap.updatedAt) : NaN;
      const inicio = Number.isFinite(passagem) && Math.abs(Date.now() - passagem) < 15000 ? passagem : Date.now();
      void Promise.resolve().then(() => setInicioVolta(inicio));
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
      if (melhor !== null && melhorAnterior.current !== null && melhor < melhorAnterior.current) {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
        brilho.setValue(1);
        Animated.timing(brilho, { toValue: 0, duration: 2200, easing: Easing.out(Easing.quad), useNativeDriver: false }).start();
      }
    }
    if (ultimoLast.current !== null && eu.last !== ultimoLast.current) {
      const antes = lapMs(ultimoLast.current);
      void Promise.resolve().then(() => setPenultima(antes));
    }
    ultimaVolta.current = eu.laps;
    melhorAnterior.current = melhor;
    ultimoLast.current = eu.last;
  }, [eu, brilho, snap]);

  const voltar = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)'));

  if (!eu) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: palette.background }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8, gap: 10 }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Fechar cockpit" onPress={voltar} style={{ padding: 6 }}><Icon name="close" color={palette.text} size={26} /></Pressable>
          <Text accessibilityRole="header" style={{ color: palette.text, fontSize: 26, fontWeight: '900' }}>Cockpit</Text>
          {pilotos.length ? <Text style={{ color: palette.textSecondary, fontSize: 16, marginLeft: 8 }}>Qual é o seu kart?</Text> : null}
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}>
          {erro ? <Text style={{ color: palette.danger }}>{erro}</Text> : null}
          {!snap ? <Text style={{ color: palette.textMuted }}>Conectando à cronometragem…</Text> : null}
          {snap && !pilotos.length ? <Text style={{ color: palette.textSecondary, fontSize: 16, lineHeight: 23 }}>Nenhuma bateria na pista agora. Abra o cockpit quando a sua largar.</Text> : null}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {pilotos.map((p) => (
              <Pressable key={p.kart} onPress={() => { tap(); setKart(p.kart); }} accessibilityRole="button" accessibilityLabel={`Kart ${p.kart}, ${p.name}`}
                style={({ pressed }) => ({ width: 120, height: 110, borderRadius: 20, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, alignItems: 'center', justifyContent: 'center', padding: 8, transform: [{ scale: pressed ? 0.94 : 1 }] })}>
                <Text style={{ color: palette.text, fontSize: 34, fontWeight: '900' }}>{p.kart}</Text>
                <Text numberOfLines={1} style={{ color: palette.textMuted, fontSize: 12 }}>{nomeBonito(p.name)}</Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const c = TEMAS[tema];
  const i = pilotos.indexOf(eu);
  const frente = i > 0 ? pilotos[i - 1] : null;
  const atras = i < pilotos.length - 1 ? pilotos[i + 1] : null;
  const meuGap = i === 0 ? 0 : gapMs(eu.gap);
  const difFrente = frente && meuGap !== null ? meuGap - (i - 1 === 0 ? 0 : gapMs(frente.gap) ?? NaN) : NaN;
  const difAtras = atras && meuGap !== null ? (gapMs(atras.gap) ?? NaN) - meuGap : NaN;
  const ultima = lapMs(eu.last), melhor = lapMs(eu.best);
  const delta = ultima !== null && melhor !== null ? ultima - melhor : null;
  const corDelta = delta === null ? c.texto : delta <= 0 ? c.roxo : delta < 500 ? c.verde : c.vermelho;
  const melhorou = ultima !== null && penultima !== null && ultima !== penultima ? ultima < penultima : null;
  const inicioProva = snap?.startedAt ? Date.parse(snap.startedAt) : NaN;
  // tudo proporcional à tela deitada: a altura manda (celular baixo), a largura limita (tablet)
  const alt = Math.min(tela.height, tela.width), larg = Math.max(tela.height, tela.width);
  const t = { relogio: Math.min(alt * 0.3, larg * 0.13), pos: alt * 0.1, valor: Math.min(alt * 0.11, larg * 0.045), lado: Math.min(alt * 0.085, larg * 0.035), rotulo: Math.max(11, alt * 0.033), topo: Math.max(14, alt * 0.05), nome: Math.max(12, alt * 0.038) };
  const grande = { color: c.texto, fontFamily: MONO, fontSize: t.valor, fontWeight: '800' as const, fontVariant: ['tabular-nums' as const] };

  return (
    <SafeAreaView edges={['left', 'right', 'top', 'bottom']} style={{ flex: 1, backgroundColor: c.fundo }}>
      <Animated.View pointerEvents="none" style={{ position: 'absolute', inset: 0, backgroundColor: c.roxo, opacity: brilho.interpolate({ inputRange: [0, 1], outputRange: [0, 0.4] }) }} />
      <View style={{ flex: 1, paddingHorizontal: 20, paddingVertical: 8 }}>
        {/* topo: tempo de prova · volta · ações */}
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: ao ? c.vermelho : c.apagado }} />
            <Text style={{ color: c.texto, fontFamily: MONO, fontSize: t.topo, fontVariant: ['tabular-nums'] }}>
              {!ao ? 'ENCERRADA' : Number.isFinite(inicioProva) ? <RelogioProva inicio={inicioProva} /> : 'AO VIVO'}
            </Text>
          </View>
          <Text style={{ flex: 1, textAlign: 'center', color: c.texto, fontFamily: MONO, fontSize: t.topo * 1.1, fontWeight: '700' }}>VOLTA {eu.laps ?? 0}</Text>
          <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 20 }}>
            <Pressable accessibilityRole="button" accessibilityLabel={tema === 'escuro' ? 'Modo sol' : 'Modo escuro'} hitSlop={10} onPress={() => { tap(); setTema(tema === 'escuro' ? 'sol' : 'escuro'); }}>
              <Text style={{ fontSize: 24 }}>{tema === 'escuro' ? '☀️' : '🌙'}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Trocar kart" hitSlop={10} onPress={() => { tap(); setKart(null); if (automatico) setMeuNome(null); }}>
              <Icon name="flag" color={c.texto} size={26} />
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Fechar cockpit" hitSlop={10} onPress={voltar}>
              <Icon name="close" color={c.texto} size={28} />
            </Pressable>
          </View>
        </View>

        {/* meio: atrás · posição + volta correndo · à frente */}
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1, alignItems: 'flex-start', gap: 4 }}>
            <Rotulo texto={atras ? `ATRÁS #${atras.kart}` : 'ATRÁS'} cor={c.apagado} tamanho={t.rotulo} />
            <Text numberOfLines={1} style={{ color: c.texto, fontFamily: MONO, fontSize: t.nome }}>{atras ? nomeBonito(atras.name).toUpperCase() : '—'}</Text>
            <Pulso valor={atras ? (Number.isFinite(difAtras) && difAtras > 0 ? `+${seg(difAtras)}` : /volta/.test(atras.gap) ? atras.gap : '—') : '—'} estilo={{ ...grande, fontSize: t.lado, color: c.verde }} />
          </View>
          <View style={{ flex: 2, alignItems: 'center' }}>
            <Pulso valor={`P${eu.position}`} estilo={{ color: eu.position === 1 ? c.ouro : c.texto, fontFamily: MONO, fontSize: t.pos, lineHeight: t.pos * 1.1, fontWeight: '900' }} />
            <VoltaCorrendo inicio={ao ? inicioVolta : null} cor={c.texto} tamanho={t.relogio} fim={!ao} />
          </View>
          <View style={{ flex: 1, alignItems: 'flex-end', gap: 4 }}>
            <Rotulo texto={frente ? `À FRENTE #${frente.kart}` : 'LÍDER'} cor={c.apagado} tamanho={t.rotulo} />
            <Text numberOfLines={1} style={{ color: c.texto, fontFamily: MONO, fontSize: t.nome }}>{frente ? nomeBonito(frente.name).toUpperCase() : 'VOCÊ'}</Text>
            <Pulso valor={frente ? (Number.isFinite(difFrente) && difFrente > 0 ? `-${seg(difFrente)}` : '—') : '★'} estilo={{ ...grande, fontSize: t.lado, color: frente ? c.vermelho : c.ouro }} />
          </View>
        </View>

        {/* base: última · melhor · delta */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Rotulo texto="ÚLTIMA VOLTA" cor={c.apagado} tamanho={t.rotulo} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              {melhorou !== null ? <Text style={{ color: melhorou ? c.verde : c.vermelho, fontSize: t.valor * 0.6, fontWeight: '900' }}>{melhorou ? '▲' : '▼'}</Text> : null}
              <Pulso valor={eu.last || '—'} estilo={grande} />
            </View>
          </View>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Rotulo texto="MELHOR VOLTA" cor={c.apagado} tamanho={t.rotulo} />
            <Pulso valor={eu.best || '—'} estilo={{ ...grande, color: c.roxo }} />
          </View>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Rotulo texto="DELTA P/ MELHOR" cor={c.apagado} tamanho={t.rotulo} />
            <Pulso valor={delta === null ? '—' : delta <= 0 ? 'RECORDE' : `+${seg(delta)}`} estilo={{ ...grande, color: corDelta }} />
          </View>
        </View>
        <Text numberOfLines={1} style={{ textAlign: 'center', color: c.texto, fontFamily: MONO, fontSize: t.nome * 1.1, marginTop: 4 }}>#{eu.kart} {eu.name.toUpperCase()}</Text>
      </View>
    </SafeAreaView>
  );
}
