/**
 * Ranking de pilotos do app de loja: melhor volta de cada piloto por traçado, na semana, no mês ou no geral
 * (dados reais da cronometragem e do LapTime antigo, publicados pelo SRVKART). Pódio em destaque, busca por nome,
 * troca de traçado e toque no piloto abre a carreira dele.
 */
import { router, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, FlatList, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon } from './brand';
import { FotoPiloto } from './foto-piloto';
import { Entrada, tap, ListaEsqueleto } from './motion';
import { useUi } from './theme';
import { formatarDia, formatarVolta, rankingApi, type LinhaRanking, type PeriodoRanking, type RankingResponse } from '../features/ranking/api';
import { nomeBonito } from '../features/ranking/gamificacao';
import { RegrasRanking } from './ranking-regras';

const PERIODOS: { id: PeriodoRanking; nome: string }[] = [
  { id: 'semana', nome: 'Semana' },
  { id: 'mes', nome: 'Mês' },
  { id: 'geral', nome: 'Geral' },
];
const COR_PODIO = ['#F59E0B', '#C0C7D1', '#CD7F32'];

/** seletor de período com a pílula dourada deslizando até a opção escolhida */
function SeletorPeriodo({ valor, onChange }: { valor: PeriodoRanking; onChange(p: PeriodoRanking): void }) {
  const { palette } = useUi();
  const [largura, setLargura] = useState(0);
  const indice = PERIODOS.findIndex((p) => p.id === valor);
  const [x] = useState(() => new Animated.Value(indice));
  useEffect(() => { Animated.spring(x, { toValue: indice, useNativeDriver: true, damping: 18, stiffness: 180 }).start(); }, [indice, x]);
  const w = largura / PERIODOS.length;
  return (
    <View onLayout={(e) => setLargura(e.nativeEvent.layout.width - 8)} style={{ flexDirection: 'row', backgroundColor: palette.surface, borderRadius: 999, padding: 4, borderWidth: 1, borderColor: palette.border }}>
      {largura > 0 ? (
        <Animated.View pointerEvents="none" style={{ position: 'absolute', top: 4, bottom: 4, left: 4, width: w, borderRadius: 999, backgroundColor: palette.accent, transform: [{ translateX: x.interpolate({ inputRange: [0, 1], outputRange: [0, w] }) }] }} />
      ) : null}
      {PERIODOS.map((p) => (
        <Pressable key={p.id} accessibilityRole="tab" accessibilityState={{ selected: p.id === valor }} onPress={() => { tap(); onChange(p.id); }}
          style={{ flex: 1, paddingVertical: 10, alignItems: 'center' }}>
          <Text style={{ color: p.id === valor ? palette.onAccent : palette.textSecondary, fontWeight: '800', fontSize: 15 }}>{p.nome}</Text>
        </Pressable>
      ))}
    </View>
  );
}

/** os três primeiros lado a lado, o 1º mais alto, com subida animada */
function Podio({ linhas }: { linhas: LinhaRanking[] }) {
  const { palette } = useUi();
  const ordem = [linhas[1], linhas[0], linhas[2]].filter(Boolean) as LinhaRanking[];
  const [sobe] = useState(() => new Animated.Value(0));
  useEffect(() => { sobe.setValue(0); Animated.timing(sobe, { toValue: 1, duration: 650, easing: Easing.out(Easing.back(1.4)), useNativeDriver: true }).start(); }, [linhas, sobe]);
  if (linhas.length < 3) return null;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 10, marginTop: 18, marginBottom: 8 }}>
      {ordem.map((l) => {
        const alto = l.pos === 1 ? 128 : l.pos === 2 ? 104 : 88;
        return (
          <Pressable key={l.pos} disabled={!l.id} onPress={() => { tap(); router.push(`/piloto/${l.id}` as Href); }} style={{ flex: 1, alignItems: 'center' }}
            accessibilityRole="button" accessibilityLabel={`${l.pos}º lugar, ${nomeBonito(l.nome)}, ${formatarVolta(l.ms)}`}>
            <FotoPiloto id={l.id} nome={l.nome} tamanho={l.pos === 1 ? 58 : 48} cor={COR_PODIO[l.pos - 1]} />
            <Text numberOfLines={2} style={{ color: palette.text, fontWeight: '800', fontSize: 13, textAlign: 'center', marginTop: 6, minHeight: 34 }}>{nomeBonito(l.nome)}</Text>
            <Text style={{ color: palette.textSecondary, fontSize: 13, fontVariant: ['tabular-nums'], marginBottom: 6 }}>{formatarVolta(l.ms)}</Text>
            <Animated.View style={{ width: '100%', height: alto, borderTopLeftRadius: 14, borderTopRightRadius: 14, backgroundColor: palette.surface, borderWidth: 1, borderColor: COR_PODIO[l.pos - 1], alignItems: 'center', paddingTop: 10,
              transform: [{ translateY: sobe.interpolate({ inputRange: [0, 1], outputRange: [alto, 0] }) }], opacity: sobe }}>
              <Text style={{ color: COR_PODIO[l.pos - 1], fontSize: 30, fontWeight: '900' }}>{l.pos}º</Text>
            </Animated.View>
          </Pressable>
        );
      })}
    </View>
  );
}

function Linha({ l, index }: { l: LinhaRanking; index: number }) {
  const { palette } = useUi();
  return (
    <Entrada index={index}>
      <Pressable disabled={!l.id} onPress={() => { tap(); router.push(`/piloto/${l.id}` as Href); }} accessibilityRole="button"
        accessibilityLabel={`${l.pos}º, ${nomeBonito(l.nome)}, ${formatarVolta(l.ms)}`}
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14, marginBottom: 8, borderRadius: 16, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.borderSubtle, transform: [{ scale: pressed ? 0.98 : 1 }] })}>
        <Text style={{ color: COR_PODIO[l.pos - 1] ?? palette.textMuted, fontWeight: '900', fontSize: 17, width: 38, fontVariant: ['tabular-nums'] }}>{l.pos}º</Text>
        <FotoPiloto id={l.id} nome={l.nome} tamanho={40} cor={COR_PODIO[l.pos - 1] ?? palette.surfaceElevated} claro={l.pos <= 3} />
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={{ color: palette.text, fontWeight: '700', fontSize: 15 }}>{nomeBonito(l.nome)}</Text>
          <Text style={{ color: palette.textMuted, fontSize: 12, marginTop: 2 }}>{formatarDia(l.dia)}{l.kart ? ` · Kart ${l.kart}` : ''}</Text>
        </View>
        <Text style={{ color: palette.text, fontWeight: '800', fontSize: 16, fontVariant: ['tabular-nums'] }}>{formatarVolta(l.ms)}</Text>
      </Pressable>
    </Entrada>
  );
}

export default function RankingReal() {
  const { palette, styles } = useUi();
  const [periodo, setPeriodo] = useState<PeriodoRanking>('semana');
  const [tracado, setTracado] = useState<string | null>(null);
  const [dados, setDados] = useState<RankingResponse | null>(null);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState('');
  const [regras, setRegras] = useState(false);
  const pedido = useRef(0);

  const carregar = useCallback(async () => {
    const id = ++pedido.current;
    setCarregando(true);
    try {
      const r = await rankingApi.ranking(periodo, tracado);
      if (id !== pedido.current) return;
      setDados(r); setErro('');
    } catch (e) {
      if (id !== pedido.current) return;
      setErro(e instanceof Error ? e.message : 'Não foi possível carregar o ranking.');
    } finally {
      if (id === pedido.current) setCarregando(false);
    }
  }, [periodo, tracado]);
  useEffect(() => { void Promise.resolve().then(carregar); }, [carregar]);

  const filtro = busca.trim().toLowerCase();
  const linhas = useMemo(() => (dados?.linhas ?? []).filter((l) => !filtro || l.nome.toLowerCase().includes(filtro)), [dados, filtro]);
  const mostrarPodio = !filtro && linhas.length >= 3;

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <FlatList
        data={mostrarPodio ? linhas.slice(3) : linhas}
        keyExtractor={(l) => `${l.pos}-${l.id ?? l.nome}`}
        renderItem={({ item, index }) => <Linha l={item} index={index} />}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 140, width: '100%', maxWidth: 640, alignSelf: 'center' }}
        refreshControl={<RefreshControl refreshing={carregando && !!dados} onRefresh={() => void carregar()} tintColor={palette.accent} />}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 12, paddingBottom: 14, gap: 10 }}>
              <Pressable accessibilityRole="button" accessibilityLabel="Voltar" onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))} style={{ padding: 6, marginLeft: -6 }}>
                <Icon name="back" color={palette.text} size={24} />
              </Pressable>
              <Text accessibilityRole="header" style={{ color: palette.text, fontSize: 30, fontWeight: '900', flex: 1, letterSpacing: -0.5 }}>Ranking</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Como funciona o ranking" onPress={() => { tap(); setRegras(true); }}
                style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: palette.surface, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="info" color={palette.text} size={22} />
              </Pressable>
            </View>
            <SeletorPeriodo valor={periodo} onChange={(p) => setPeriodo(p)} />
            {dados?.tracados.length ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 14 }}>
                {dados.tracados.map((t) => {
                  const ativo = t.nome === dados.tracado;
                  return (
                    <Pressable key={t.nome} accessibilityRole="button" accessibilityState={{ selected: ativo }} onPress={() => { tap(); setTracado(t.nome); }}
                      style={({ pressed }) => ({ paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, backgroundColor: ativo ? palette.text : palette.surface, borderWidth: 1, borderColor: ativo ? palette.text : palette.border, transform: [{ scale: pressed ? 0.95 : 1 }] })}>
                      <Text style={{ color: ativo ? '#000000' : palette.textSecondary, fontWeight: '700', fontSize: 13 }}>{t.nome} · {t.pilotos}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            ) : null}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: palette.surface, borderRadius: 14, paddingHorizontal: 14, borderWidth: 1, borderColor: palette.border }}>
              <Icon name="search" color={palette.textMuted} size={18} />
              <TextInput value={busca} onChangeText={setBusca} placeholder="Buscar piloto" placeholderTextColor={palette.textMuted} accessibilityLabel="Buscar piloto"
                autoCorrect={false} style={{ flex: 1, color: palette.text, fontSize: 16, paddingVertical: 12 }} />
              {busca ? <Pressable accessibilityLabel="Limpar busca" onPress={() => setBusca('')}><Icon name="close" color={palette.textMuted} size={18} /></Pressable> : null}
            </View>
            {dados?.de ? (
              <Text style={{ color: palette.textMuted, fontSize: 12, marginTop: 10 }}>
                {periodo === 'geral' ? 'Todos os tempos' : `${formatarDia(dados.de)} a ${formatarDia(dados.ate ?? dados.de)}`} · {dados.linhas.length} melhores tempos
              </Text>
            ) : null}
            {carregando && !dados ? <ListaEsqueleto itens={8} altura={60} rotulo="Carregando ranking" /> : null}
            {erro && !dados ? (
              <View style={{ marginTop: 24, gap: 12 }}>
                <Text style={{ color: palette.danger }}>{erro}</Text>
                <Pressable onPress={() => void carregar()} style={styles.action}><Text style={styles.actionText}>Tentar novamente</Text></Pressable>
              </View>
            ) : null}
            {dados && !linhas.length ? <Text style={{ color: palette.textMuted, marginTop: 24 }}>{filtro ? 'Nenhum piloto com esse nome neste ranking.' : 'Ainda não há tempos neste período.'}</Text> : null}
            {mostrarPodio ? <Podio linhas={linhas.slice(0, 3)} /> : null}
          </View>
        }
      />
      <RegrasRanking visivel={regras} onFechar={() => setRegras(false)} />
    </SafeAreaView>
  );
}
