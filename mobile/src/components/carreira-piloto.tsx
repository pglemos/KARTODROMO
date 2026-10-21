/**
 * Carreira de um piloto (ou a sua, com id "eu"): categoria e XP, números da carreira, eficiência, melhor tempo e
 * posição em cada traçado, conquistas e últimas baterias. Tudo calculado da carreira real publicada pelo SRVKART.
 */
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { ActivityIndicator, Alert, Animated, Easing, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon } from './brand';
import { FotoPiloto } from './foto-piloto';
import { Entrada, tap, ListaEsqueleto } from './motion';
import { RegrasRanking } from './ranking-regras';
import { useUi } from './theme';
import { MobileApiError } from '../api/client';
import { formatarDia, formatarVolta, rankingApi, type CarreiraPiloto, type PosicaoRanking } from '../features/ranking/api';
import { categoriaDe, conquistasDe, nomeBonito, xpDe } from '../features/ranking/gamificacao';
import { useSession } from '../session/provider';

/** número que conta de 0 até o valor quando a tela abre */
function Contador({ valor, estilo, sufixo = '' }: { valor: number; estilo: object; sufixo?: string }) {
  const [anim] = useState(() => new Animated.Value(0));
  const [mostrado, setMostrado] = useState(0);
  useEffect(() => {
    anim.setValue(0);
    const id = anim.addListener(({ value }) => setMostrado(Math.round(value)));
    Animated.timing(anim, { toValue: valor, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    return () => anim.removeListener(id);
  }, [anim, valor]);
  return <Text style={estilo}>{mostrado.toLocaleString('pt-BR')}{sufixo}</Text>;
}

function BarraXp({ progresso, cor }: { progresso: number; cor: string }) {
  const { palette } = useUi();
  const [anim] = useState(() => new Animated.Value(0));
  useEffect(() => { Animated.timing(anim, { toValue: progresso, duration: 1000, delay: 200, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start(); }, [anim, progresso]);
  return (
    <View style={{ height: 8, borderRadius: 4, backgroundColor: palette.surfaceElevated, overflow: 'hidden' }}>
      <Animated.View style={{ height: 8, borderRadius: 4, backgroundColor: cor, width: anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }} />
    </View>
  );
}

function Cartao({ titulo, children, index = 0 }: { titulo?: string; children: React.ReactNode; index?: number }) {
  const { palette } = useUi();
  return (
    <Entrada index={index}>
      <View style={{ backgroundColor: palette.surface, borderRadius: 20, padding: 18, borderWidth: 1, borderColor: palette.border, gap: 14 }}>
        {titulo ? <Text style={{ color: palette.text, fontSize: 17, fontWeight: '800' }}>{titulo}</Text> : null}
        {children}
      </View>
    </Entrada>
  );
}

const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);
const posTexto = (p: PosicaoRanking | null) => (p ? `${p.pos}º de ${p.de}` : '—');

export default function CarreiraPilotoTela({ id }: { id: string }) {
  const { palette, styles } = useUi();
  const { session } = useSession();
  const eu = id === 'eu';
  const [dados, setDados] = useState<CarreiraPiloto | null>(null);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [regras, setRegras] = useState(false);
  const [versaoFoto, setVersaoFoto] = useState(0);
  const [enviandoFoto, setEnviandoFoto] = useState(false);

  /** escolhe (galeria ou câmera), recorta quadrado, reduz para 600 px e envia */
  async function trocarFoto(origem: 'galeria' | 'camera') {
    const perm = origem === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Sem permissão', origem === 'camera' ? 'Libere a câmera nos Ajustes para tirar a foto.' : 'Libere o acesso às fotos nos Ajustes para escolher uma.'); return; }
    const opcoes: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 1 };
    const r = origem === 'camera' ? await ImagePicker.launchCameraAsync(opcoes) : await ImagePicker.launchImageLibraryAsync(opcoes);
    if (r.canceled || !r.assets[0] || !session) return;
    setEnviandoFoto(true);
    try {
      const reduzida = await ImageManipulator.manipulateAsync(r.assets[0].uri, [{ resize: { width: 600 } }], { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG });
      setVersaoFoto(await rankingApi.enviarFoto(session.accessToken, reduzida.uri));
      tap();
    } catch (e) {
      Alert.alert('Foto não enviada', e instanceof Error ? e.message : 'Tente novamente.');
    } finally {
      setEnviandoFoto(false);
    }
  }

  function menuFoto() {
    tap();
    Alert.alert('Foto do piloto', 'Ela aparece no ranking e na sua carreira.', [
      { text: 'Escolher da galeria', onPress: () => void trocarFoto('galeria') },
      { text: 'Tirar foto', onPress: () => void trocarFoto('camera') },
      { text: 'Remover foto', style: 'destructive', onPress: () => { if (session) void rankingApi.removerFoto(session.accessToken).then(() => setVersaoFoto(Date.now())).catch(() => Alert.alert('Não foi possível remover a foto.')); } },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  }

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      if (eu && !session) { setErro('Entre na sua conta para ver sua carreira.'); return; }
      setDados(eu ? await rankingApi.minha(session!.accessToken) : await rankingApi.piloto(id));
      setErro('');
    } catch (e) {
      setErro(e instanceof MobileApiError || e instanceof Error ? e.message : 'Não foi possível carregar a carreira.');
    } finally {
      setCarregando(false);
    }
  }, [eu, id, session]);
  useEffect(() => { void Promise.resolve().then(carregar); }, [carregar]);

  const voltar = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)'));
  const topo = (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 12, paddingBottom: 8, gap: 10 }}>
      <Pressable accessibilityRole="button" accessibilityLabel="Voltar" onPress={voltar} style={{ padding: 6, marginLeft: -6 }}><Icon name="back" color={palette.text} size={24} /></Pressable>
      <View style={{ flex: 1 }} />
      <Pressable accessibilityRole="button" accessibilityLabel="Como funciona o ranking" onPress={() => { tap(); setRegras(true); }}
        style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: palette.surface, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="info" color={palette.text} size={22} />
      </Pressable>
    </View>
  );

  if (!dados) {
    return (
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
        <View style={{ paddingHorizontal: 16 }}>
          {topo}
          {carregando ? <ListaEsqueleto itens={4} altura={96} rotulo="Carregando carreira" /> : null}
          {!carregando && erro ? (
            <View style={{ marginTop: 24, gap: 14 }}>
              <Text style={{ color: palette.textSecondary, fontSize: 16, lineHeight: 23 }}>{erro}</Text>
              {eu && !session ? <Pressable onPress={() => router.push('/(auth)/login')} style={styles.action}><Text style={styles.actionText}>Entrar</Text></Pressable>
                : <Pressable onPress={() => void carregar()} style={styles.action}><Text style={styles.actionText}>Tentar novamente</Text></Pressable>}
            </View>
          ) : null}
        </View>
        <RegrasRanking visivel={regras} onFechar={() => setRegras(false)} />
      </SafeAreaView>
    );
  }

  const xp = xpDe(dados);
  const cat = categoriaDe(xp);
  const conquistas = conquistasDe(dados);
  const liberadas = conquistas.filter((c) => c.liberada).length;
  const numeros = [
    { rotulo: 'Baterias', valor: dados.baterias },
    { rotulo: 'Vitórias', valor: dados.vitorias },
    { rotulo: 'Pódios', valor: dados.podios },
    { rotulo: 'Poles', valor: dados.poles },
    { rotulo: 'Voltas + rápidas', valor: dados.voltasMaisRapidas },
    { rotulo: 'Voltas', valor: dados.voltas },
  ];
  const eficiencia = [
    { rotulo: 'Vitórias', valor: pct(dados.vitorias, dados.corridas), cor: palette.neonGreen },
    { rotulo: 'Pódios', valor: pct(dados.podios, dados.corridas), cor: palette.accent },
    { rotulo: 'Volta + rápida', valor: pct(dados.voltasMaisRapidas, dados.baterias), cor: palette.pink },
  ];

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 140, gap: 14, width: '100%', maxWidth: 640, alignSelf: 'center' }}
        refreshControl={<RefreshControl refreshing={carregando} onRefresh={() => void carregar()} tintColor={palette.accent} />}>
        {topo}
        <Entrada>
          <View style={{ alignItems: 'center', gap: 8 }}>
            <Pressable disabled={!eu || enviandoFoto} onPress={menuFoto} accessibilityRole={eu ? 'button' : undefined} accessibilityLabel={eu ? 'Trocar foto' : undefined}
              style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.95 : 1 }] })}>
              <View style={{ padding: 4, borderRadius: 60, backgroundColor: palette.surfaceElevated }}>
                <FotoPiloto key={versaoFoto} id={dados.id} versao={versaoFoto} nome={dados.nome} tamanho={104} cor={cat.cor} />
              </View>
              {eu ? (
                <View style={{ position: 'absolute', right: 0, bottom: 0, width: 34, height: 34, borderRadius: 17, backgroundColor: palette.accent, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: palette.background }}>
                  {enviandoFoto ? <ActivityIndicator size="small" color="#000000" /> : <Text style={{ color: '#000000', fontWeight: '900', fontSize: 18, lineHeight: 20 }}>+</Text>}
                </View>
              ) : null}
            </Pressable>
            <Text accessibilityRole="header" style={{ color: palette.text, fontSize: 24, fontWeight: '900', textAlign: 'center' }}>{nomeBonito(dados.nome)}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: cat.cor, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999 }}>
              <Icon name="star" color="#000000" size={14} />
              <Text style={{ color: '#000000', fontWeight: '900', fontSize: 13, letterSpacing: 1 }}>{cat.nome}</Text>
            </View>
            {dados.primeira ? <Text style={{ color: palette.textMuted, fontSize: 13 }}>Na pista desde {formatarDia(dados.primeira)}</Text> : null}
          </View>
        </Entrada>

        <Cartao index={1}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <Contador valor={xp} sufixo=" XP" estilo={{ color: palette.text, fontSize: 30, fontWeight: '900', fontVariant: ['tabular-nums'] }} />
            <Text style={{ color: palette.textMuted, fontSize: 13 }}>{cat.proxima ? `faltam ${(cat.proxima.desde - xp).toLocaleString('pt-BR')} para ${cat.proxima.nome}` : 'categoria máxima'}</Text>
          </View>
          <BarraXp progresso={cat.progresso} cor={cat.cor} />
        </Cartao>

        <Cartao titulo="Carreira" index={2}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 16 }}>
            {numeros.map((n) => (
              <View key={n.rotulo} style={{ width: '33.33%', alignItems: 'center' }}>
                <Contador valor={n.valor} estilo={{ color: palette.text, fontSize: 24, fontWeight: '900', fontVariant: ['tabular-nums'] }} />
                <Text style={{ color: palette.textMuted, fontSize: 12, marginTop: 2, textAlign: 'center' }}>{n.rotulo}</Text>
              </View>
            ))}
          </View>
        </Cartao>

        {dados.corridas > 0 ? (
          <Cartao titulo={`Eficiência em ${dados.corridas} corrida${dados.corridas === 1 ? '' : 's'}`} index={3}>
            <View style={{ flexDirection: 'row' }}>
              {eficiencia.map((e) => (
                <View key={e.rotulo} style={{ flex: 1, alignItems: 'center' }}>
                  <Contador valor={e.valor} sufixo="%" estilo={{ color: e.cor, fontSize: 26, fontWeight: '900' }} />
                  <Text style={{ color: palette.textMuted, fontSize: 12, marginTop: 2 }}>{e.rotulo}</Text>
                </View>
              ))}
            </View>
          </Cartao>
        ) : null}

        {dados.tracados.length ? (
          <Cartao titulo="Melhores tempos" index={4}>
            {dados.tracados.map((t, i) => (
              <View key={t.nome} style={{ gap: 6, paddingTop: i ? 12 : 0, borderTopWidth: i ? 1 : 0, borderTopColor: palette.borderSubtle }}>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
                  <Text style={{ color: palette.text, fontWeight: '800', fontSize: 15, flex: 1 }}>{t.nome}</Text>
                  <Text style={{ color: palette.accent, fontWeight: '900', fontSize: 18, fontVariant: ['tabular-nums'] }}>{formatarVolta(t.ms)}</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {([['Semana', t.semana], ['Mês', t.mes], ['Geral', t.geral]] as const).map(([rot, p]) => (
                    <View key={rot} style={{ flex: 1, backgroundColor: palette.surfaceElevated, borderRadius: 10, paddingVertical: 8, alignItems: 'center' }}>
                      <Text style={{ color: p && p.pos <= 3 ? palette.accent : palette.text, fontWeight: '800', fontSize: 14, fontVariant: ['tabular-nums'] }}>{posTexto(p)}</Text>
                      <Text style={{ color: palette.textMuted, fontSize: 11 }}>{rot}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </Cartao>
        ) : null}

        <Cartao titulo={`Conquistas · ${liberadas} de ${conquistas.length}`} index={5}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 16 }}>
            {conquistas.map((c) => (
              <View key={c.id} style={{ width: '33.33%', alignItems: 'center', gap: 6, opacity: c.liberada ? 1 : 0.45 }}
                accessibilityLabel={`${c.nome}: ${c.descricao}${c.liberada ? ', conquistada' : `, ${c.atual} de ${c.meta}`}`}>
                <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: c.liberada ? c.cor : palette.surfaceElevated, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name={c.liberada ? c.icone : 'lock'} color={c.liberada ? '#000000' : palette.textMuted} size={26} />
                </View>
                <Text style={{ color: palette.text, fontSize: 12, fontWeight: '700', textAlign: 'center' }}>{c.nome}</Text>
                {!c.liberada && c.meta > 1 ? <Text style={{ color: palette.textMuted, fontSize: 11 }}>{c.atual}/{c.meta}</Text> : null}
              </View>
            ))}
          </View>
        </Cartao>

        {dados.recentes.length ? (
          <Cartao titulo="Últimas baterias" index={6}>
            {dados.recentes.map((r, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: i ? 10 : 0, borderTopWidth: i ? 1 : 0, borderTopColor: palette.borderSubtle }}>
                <Text style={{ color: r.pos <= 3 ? ['#F59E0B', '#C0C7D1', '#CD7F32'][r.pos - 1] : palette.textMuted, fontWeight: '900', fontSize: 18, width: 40, fontVariant: ['tabular-nums'] }}>{r.pos}º</Text>
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={{ color: palette.text, fontWeight: '700' }}>{r.bateria}</Text>
                  <Text style={{ color: palette.textMuted, fontSize: 12 }}>{formatarDia(r.dia)} · {r.tipo === 'corrida' ? 'Corrida' : 'Tomada de tempo'} · {r.de} pilotos · Kart {r.kart}</Text>
                </View>
                {r.melhor ? <Text style={{ color: palette.textSecondary, fontVariant: ['tabular-nums'] }}>{formatarVolta(r.melhor)}</Text> : null}
              </View>
            ))}
          </Cartao>
        ) : null}
      </ScrollView>
      <RegrasRanking visivel={regras} onFechar={() => setRegras(false)} />
    </SafeAreaView>
  );
}
