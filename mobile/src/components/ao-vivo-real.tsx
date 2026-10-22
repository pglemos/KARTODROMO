/**
 * Ao vivo do app de loja: a bateria que está na pista (ou a última que terminou), direto da cronometragem.
 * Segue o desenho aprovado (medidas da imagem de 852 px escaladas à largura do celular): foto no topo, faixa roxa da
 * volta mais rápida, abas e a tabela de classificação. Tocar no piloto abre o cockpit no kart dele.
 */
import { router, type Href } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, FlatList, Pressable, RefreshControl, Text, View } from 'react-native';

import { Brand, Icon } from './brand';
import { Caixa, Desenho, Foto, LARGO, T, Toque, cor, fonte, fundos, useK, useTopo } from './design-kit';
import { tap } from './motion';
import { useAgoraCrono } from '../features/live/api';
import type { LiveCompetitor, LiveSession } from '../types/racing';

const MEDALHA = ['#F5B729', '#D9DEE2', '#E89A3C'];
const ROXO = '#8B5CF6';
type Aba = 'classificacao' | 'tempos' | 'setores' | 'pilotos';

/** ponto que pulsa (anel crescendo e sumindo), como o "ao vivo" das transmissões */
function PontoAoVivo({ c, d }: { c: string; d: number }) {
  const [anel] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(anel, { toValue: 1, duration: 1400, easing: Easing.out(Easing.quad), useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [anel]);
  return (
    <View style={{ width: d, height: d, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={{ position: 'absolute', width: d, height: d, borderRadius: d / 2, backgroundColor: c,
        opacity: anel.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] }), transform: [{ scale: anel.interpolate({ inputRange: [0, 1], outputRange: [1, 2.4] }) }] }} />
      <View style={{ width: d, height: d, borderRadius: d / 2, backgroundColor: c }} />
    </View>
  );
}

/** tempo de prova com milésimos, no relógio da cronometragem */
function RelogioMs({ inicio, reserva }: { inicio: number; reserva: string }) {
  const agora = useAgoraCrono(50);
  // sem largada o id é o nome do evento, e Date.parse("... 2") dá o ano 2001: só vale horário das últimas 24 h
  if (!Number.isFinite(inicio) || inicio > agora + 60_000 || agora - inicio > 86_400_000) return <>{reserva}</>;
  const ms = Math.max(0, agora - inicio);
  return <>{Math.floor(ms / 3600000)}:{String(Math.floor((ms % 3600000) / 60000)).padStart(2, '0')}:{String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')}.{String(ms % 1000).padStart(3, '0')}</>;
}

/** "0:38.775" → "38.775"; "1:06.087" fica igual (o desenho não mostra o 0: na frente) */
function tempo(t: string) {
  return (t || '—').replace(/^0:(\d\d\.)/, '$1');
}

function nomeDe(c: LiveCompetitor) {
  return /^kart\s*\d+$/i.test(c.name.trim()) ? `KART ${c.kartNumber}` : c.name.toUpperCase();
}

/** linha da classificação (75 px de altura no desenho) */
function Linha({ c, ganhou, rapida }: { c: LiveCompetitor; ganhou: number; rapida: boolean }) {
  const k = useK();
  const medalha = MEDALHA[c.position - 1];
  const lider = c.position === 1;
  // última volta em verde quando ficou a menos de meio segundo da melhor dele (volta boa)
  const boa = !lider && c.lastLapMs > 0 && c.bestLapMs > 0 && c.lastLapMs - c.bestLapMs <= 500;
  const barra = medalha ?? (ganhou > 0 ? '#22E06B' : ganhou < 0 ? '#FF5A5A' : '#5A605D');
  return (
    <Pressable onPress={() => { tap(); router.push(`/cockpit?kart=${encodeURIComponent(c.kartNumber)}` as Href); }} accessibilityRole="button"
      accessibilityLabel={`${c.position}º, ${c.name}, kart ${c.kartNumber}, melhor volta ${c.bestLapTime}. Toque para abrir o cockpit.`}
      style={({ pressed }) => ({ width: 808 * k, height: 70 * k, marginLeft: 22 * k, marginBottom: 6.5 * k, borderRadius: 12 * k, flexDirection: 'row', alignItems: 'center',
        backgroundColor: lider ? '#15180F' : '#111615', borderWidth: lider ? 1.5 * k : 1, borderColor: lider ? '#A3A82B' : '#1F2422', opacity: pressed ? 0.85 : 1 })}>
      <View style={{ marginLeft: 16 * k, width: 45 * k, height: 43 * k, borderRadius: 8 * k, backgroundColor: medalha ?? '#2A302D', alignItems: 'center', justifyContent: 'center' }}>
        <T s={21} p="800" c={medalha ? '#111111' : '#FFFFFF'}>{c.position}</T>
      </View>
      <View style={{ marginLeft: 15 * k, width: 6 * k, height: 40 * k, borderRadius: 3 * k, backgroundColor: barra }} />
      <View style={{ marginLeft: 17 * k, width: 230 * k }}>
        <T s={18} f={fonte.tempoBold} c={lider ? '#F5B729' : '#FFFFFF'}>#{c.kartNumber}</T>
        <T s={18} f={fonte.tempoBold} linhas={1} style={{ marginTop: 2 * k }}>{nomeDe(c)}</T>
      </View>
      <View style={{ width: 115 * k, alignItems: 'center' }}>
        <T s={21} f={fonte.tempo} c={boa ? '#3BF07F' : '#FFFFFF'} style={{ fontVariant: ['tabular-nums'] }}>{tempo(c.lastLapTime)}</T>
      </View>
      <View style={{ width: 130 * k, height: 45 * k, marginLeft: 8 * k, borderRadius: rapida ? 23 * k : 10 * k, backgroundColor: rapida ? '#7C4DFF' : '#181D1B', alignItems: 'center', justifyContent: 'center' }}>
        <T s={21} f={fonte.tempo} style={{ fontVariant: ['tabular-nums'] }}>{tempo(c.bestLapTime)}</T>
      </View>
      <View style={{ width: 92 * k, alignItems: 'center' }}>
        <T s={19} f={fonte.tempo} c="#C9CFCC" style={{ fontVariant: ['tabular-nums'] }}>{lider ? '-' : (c.diffLeader || '-').replace(/^\+0:/, '+')}</T>
      </View>
      <View style={{ flex: 1, alignItems: 'center' }}>
        <T s={21} f={fonte.tempoBold}>{c.currentLap}</T>
      </View>
    </Pressable>
  );
}

function Topo({ session, aba, setAba }: { session: LiveSession; aba: Aba; setAba: (a: Aba) => void }) {
  const k = useK();
  const topo = useTopo();
  const aoVivo = session.status !== 'CHECKERED';
  const palavras = session.title.trim().split(/\s+/);
  const ultima = palavras.length > 1 ? palavras[palavras.length - 1] : '';
  const inicio = palavras.length > 1 ? palavras.slice(0, -1).join(' ') : session.title;
  const r = session.fastestLap;
  const nomeRapida = r ? (/^kart\s*\d+$/i.test(r.name.trim()) ? '' : r.name.toUpperCase()) : '';
  const voltar = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)'));
  const abas: { id: Aba; nome: string; icone: 'chart' | 'timer' | 'sector' | 'helmet'; x: number; w: number }[] = [
    { id: 'classificacao', nome: 'CLASSIFICAÇÃO', icone: 'chart', x: 0, w: 243 },
    { id: 'tempos', nome: 'TEMPOS', icone: 'timer', x: 243, w: 188 },
    { id: 'setores', nome: 'SETORES', icone: 'sector', x: 431, w: 190 },
    { id: 'pilotos', nome: 'PILOTOS', icone: 'helmet', x: 621, w: 189 },
  ];
  return (
    <View style={{ paddingTop: topo }}>
      <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, height: topo + 6, backgroundColor: '#0A0C0B' }} />
      <View style={{ width: 852 * k, height: (720 - 76) * k }}>
        <Caixa x={0} y={0} w={851} h={336} pointerEvents="none"><Foto fonte={fundos.aovivoTopo} /></Caixa>
        <Toque x={30} y={19} w={70} h={70} rotulo="Voltar" onPress={voltar}
          style={{ borderRadius: 35 * k, borderWidth: 1.5, borderColor: '#3A403D', backgroundColor: 'rgba(10,12,11,0.7)', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="back" color="#FFFFFF" size={30 * k} />
        </Toque>
        <Caixa x={125} y={14} pointerEvents="none"><Brand width={305 * k} /></Caixa>
        <Caixa x={580} y={19} w={240} h={67} pointerEvents="none" style={{ borderRadius: 34 * k, borderWidth: 1, borderColor: '#2E3431', backgroundColor: aoVivo ? 'rgba(70,12,12,0.85)' : 'rgba(15,18,17,0.9)', flexDirection: 'row', alignItems: 'center', paddingLeft: 26 * k, gap: 16 * k }}>
          {aoVivo ? <PontoAoVivo c="#FF4D4D" d={14 * k} /> : <Icon name="flag" color="#FFFFFF" size={26 * k} />}
          <T s={21} p="500" c={aoVivo ? '#FF8A8A' : '#FFFFFF'} style={{ fontVariant: ['tabular-nums'] }}>{aoVivo ? <RelogioMs inicio={Date.parse(session.id)} reserva={session.elapsedTime} /> : 'Encerrada'}</T>
        </Caixa>

        <Caixa x={40} y={130} pointerEvents="none" style={{ flexDirection: 'row', alignItems: 'center', gap: 18 * k }}>
          {aoVivo ? <PontoAoVivo c={cor.verde} d={16 * k} /> : <View style={{ width: 16 * k, height: 16 * k, borderRadius: 8 * k, backgroundColor: '#8E9692' }} />}
          <T s={22} p="800" c={aoVivo ? cor.verde : '#C9CFCC'} style={{ letterSpacing: 1 * k }}>{aoVivo ? 'AO VIVO' : 'ÚLTIMA BATERIA'}</T>
        </Caixa>
        <Caixa x={38} y={160} w={640} pointerEvents="none">
          <T s={70} f={fonte.display} largo={LARGO} linhas={1} style={{ letterSpacing: -1 * k }}>
            {inicio.toUpperCase()}{ultima ? <Text style={{ color: cor.verde }}> {ultima.toUpperCase()}</Text> : null}
          </T>
        </Caixa>
        <Caixa x={38} y={242} w={780} pointerEvents="none">
          <T s={19} c="#9AA39F" linhas={1} style={{ letterSpacing: 1 * k }}>{[session.subtitle.toUpperCase(), /ENCERRADA|AO VIVO/.test(session.subtitle.toUpperCase()) ? '' : aoVivo ? 'AO VIVO' : 'ENCERRADA', `${session.competitors.length} PILOTOS`].filter(Boolean).join('  ·  ')}</T>
        </Caixa>

        {r ? (
          <Caixa x={30} y={339} w={792} h={141} pointerEvents="none" style={{ borderRadius: 20 * k, overflow: 'hidden', borderWidth: 2 * k, borderColor: ROXO, shadowColor: ROXO, shadowOpacity: 0.5, shadowRadius: 16 * k }}>
            <Foto fonte={fundos.aovivoRapida} />
            <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 400 * k, backgroundColor: 'rgba(36,16,90,0.55)' }} />
            <Caixa x={35} y={42} pointerEvents="none"><Icon name="bolt" color={ROXO} size={56 * k} /></Caixa>
            <Caixa x={113} y={17} pointerEvents="none">
              <T s={20} p="600" c="#B794FF" style={{ letterSpacing: 1 * k }}>VOLTA MAIS RÁPIDA</T>
              <T s={50} f={fonte.tempoItalic} style={{ marginTop: 2 * k, fontVariant: ['tabular-nums'] }}>{tempo(r.time)}</T>
              <T s={20} f={fonte.tempoBold} style={{ marginTop: 2 * k, letterSpacing: 0.5 * k }}>#{r.competitorNumber}  {nomeRapida}</T>
            </Caixa>
            <View style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 189 * k, backgroundColor: 'rgba(12,10,26,0.82)', paddingLeft: 26 * k, justifyContent: 'center' }}>
              <T s={19} c="#D9DEDB" style={{ letterSpacing: 1 * k }}>NA VOLTA</T>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 * k, marginTop: 4 * k }}>
                <T s={44} f={fonte.tempoItalic}>{r.lapNumber}</T>
                <Icon name="timer" color="#8E9692" size={26 * k} />
              </View>
            </View>
          </Caixa>
        ) : null}

        <Caixa x={20} y={509} w={810} h={68} style={{ borderRadius: 34 * k, borderWidth: 1, borderColor: '#2B302E', backgroundColor: '#0D1110' }}>
          {abas.map((a) => {
            const sel = a.id === aba;
            return (
              <Pressable key={a.id} onPress={() => { tap(); setAba(a.id); }} accessibilityRole="tab" accessibilityState={{ selected: sel }} accessibilityLabel={a.nome.toLowerCase()}
                style={{ position: 'absolute', left: a.x * k, top: 0, width: a.w * k, height: 66 * k, borderRadius: 33 * k, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 * k,
                  backgroundColor: sel ? '#0D3A1E' : 'transparent', borderWidth: sel ? 1.5 * k : 0, borderColor: '#2BD96A' }}>
                <Icon name={a.icone} color={sel ? cor.verde : '#D9DEDB'} size={28 * k} />
                <T s={15} p="700" c={sel ? cor.verde : '#D9DEDB'} style={{ letterSpacing: 0.5 * k }}>{a.nome}</T>
              </Pressable>
            );
          })}
        </Caixa>

        {aba === 'classificacao' || aba === 'tempos' ? (
          <Caixa x={0} y={612} w={852} pointerEvents="none" style={{ flexDirection: 'row' }}>
            <View style={{ marginLeft: 52 * k, width: 60 * k }}><T s={14} c="#A9B0AC">#</T></View>
            <View style={{ marginLeft: 15 * k, width: 230 * k }}><T s={14} c="#A9B0AC" style={{ letterSpacing: 0.5 * k }}>PILOTO</T></View>
            <View style={{ width: 115 * k, alignItems: 'center' }}><T s={14} c="#A9B0AC">ÚLTIMA VOLTA</T></View>
            <View style={{ width: 138 * k, alignItems: 'center' }}><T s={14} c="#A9B0AC">MELHOR VOLTA</T></View>
            <View style={{ width: 92 * k, alignItems: 'center' }}><T s={14} c="#A9B0AC">DIFF</T></View>
            <View style={{ width: 80 * k, alignItems: 'center' }}><T s={14} c="#A9B0AC">VOLTAS</T></View>
          </Caixa>
        ) : null}
      </View>
    </View>
  );
}

function Rodape({ session }: { session: LiveSession }) {
  const k = useK();
  const aoVivo = session.status !== 'CHECKERED';
  const r = session.fastestLap;
  const completaram = session.competitors.filter((c) => c.currentLap > 0).length;
  const card = { borderRadius: 14 * k, backgroundColor: '#0E1211', borderWidth: 1, borderColor: '#1F2422', height: 120 * k, flexDirection: 'row' as const, paddingTop: 22 * k, paddingLeft: 22 * k };
  return (
    <View style={{ flexDirection: 'row', marginLeft: 24 * k, marginTop: 14 * k, gap: 17 * k }}>
      <View style={[card, { width: 284 * k }]}>
        <Icon name="sector" color={ROXO} size={40 * k} />
        <View style={{ marginLeft: 20 * k }}>
          <T s={14} c="#C9CFCC" style={{ letterSpacing: 0.5 * k }}>MELHOR VOLTA</T>
          <T s={26} f={fonte.tempoBold} style={{ marginTop: 4 * k }}>{r ? tempo(r.time) : '—'}</T>
          <T s={14} c="#C9CFCC" linhas={1} style={{ marginTop: 4 * k, width: 190 * k }}>{r ? `#${r.competitorNumber}  ${r.name.toUpperCase()}` : 'ainda sem volta'}</T>
        </View>
      </View>
      <View style={[card, { width: 276 * k }]}>
        <Icon name="clock" color="#C9CFCC" size={36 * k} />
        <View style={{ marginLeft: 20 * k }}>
          <T s={14} c="#C9CFCC" style={{ letterSpacing: 0.5 * k }}>{aoVivo ? 'TEMPO DE PROVA' : 'TEMPO RESTANTE'}</T>
          <T s={26} p="700" style={{ marginTop: 4 * k, fontVariant: ['tabular-nums'] }}>{aoVivo ? <RelogioMs inicio={Date.parse(session.id)} reserva={session.elapsedTime} /> : 'Encerrada'}</T>
          <T s={14} c="#C9CFCC" style={{ marginTop: 4 * k }}>{aoVivo ? 'Bateria em andamento' : 'Bateria finalizada'}</T>
        </View>
      </View>
      <View style={[card, { width: 209 * k }]}>
        <Icon name="people" color={ROXO} size={36 * k} />
        <View style={{ marginLeft: 18 * k }}>
          <T s={26} p="700">{session.competitors.length}</T>
          <T s={14} c="#C9CFCC" style={{ marginTop: 2 * k, letterSpacing: 0.5 * k }}>PILOTOS</T>
          <T s={13} c="#C9CFCC" style={{ marginTop: 4 * k }}>{completaram === session.competitors.length ? 'Todos na pista' : `${completaram} com volta`}</T>
        </View>
      </View>
    </View>
  );
}

function Lista({ session, onRefresh }: { session: LiveSession; onRefresh: () => Promise<void> | void }) {
  const k = useK();
  const [aba, setAba] = useState<Aba>('classificacao');
  const [atualizando, setAtualizando] = useState(false);
  // posição anterior de cada kart, para pintar a barrinha de quem subiu ou desceu
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

  const linhas = useMemo(() => {
    if (aba === 'tempos') return [...session.competitors].sort((a, b) => (a.bestLapMs || Infinity) - (b.bestLapMs || Infinity));
    return session.competitors;
  }, [aba, session.competitors]);

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: cor.fundo }}
      data={aba === 'setores' ? [] : linhas}
      keyExtractor={(c) => c.kartNumber}
      renderItem={({ item }) => aba === 'pilotos'
        ? (
          <Pressable onPress={() => { tap(); router.push(`/cockpit?kart=${encodeURIComponent(item.kartNumber)}` as Href); }} accessibilityRole="button" accessibilityLabel={`Abrir o cockpit de ${item.name}`}
            style={{ width: 808 * k, height: 70 * k, marginLeft: 22 * k, marginBottom: 6.5 * k, borderRadius: 12 * k, backgroundColor: '#111615', borderWidth: 1, borderColor: '#1F2422', flexDirection: 'row', alignItems: 'center', paddingLeft: 24 * k, gap: 20 * k }}>
            <Icon name="helmet" color={cor.verde} size={32 * k} />
            <View style={{ flex: 1 }}>
              <T s={18} f={fonte.tempoBold}>{nomeDe(item)}</T>
              <T s={15} c="#A9B0AC">Kart #{item.kartNumber} · {item.category}</T>
            </View>
            <T s={16} p="700" c={cor.verde} style={{ marginRight: 26 * k }}>COCKPIT ›</T>
          </Pressable>
        )
        : <Linha c={item} ganhou={movimentos[item.kartNumber] ?? 0} rapida={item.isFastestLap} />}
      contentContainerStyle={{ paddingBottom: 200 }}
      refreshControl={<RefreshControl refreshing={atualizando} tintColor={cor.verde} onRefresh={() => { setAtualizando(true); void Promise.resolve(onRefresh()).finally(() => setAtualizando(false)); }} />}
      ListHeaderComponent={<Topo session={session} aba={aba} setAba={setAba} />}
      ListEmptyComponent={aba === 'setores'
        ? <View style={{ paddingHorizontal: 40 * k, paddingTop: 10 }}><T s={19} c="#C9CFCC" lh={26}>Os tempos por setor aparecem aqui quando a pista tiver os pontos de cronometragem intermediários. Por enquanto, veja a volta completa em Classificação e Tempos.</T></View>
        : null}
      ListFooterComponent={<Rodape session={session} />}
    />
  );
}

export function AoVivoReal({ session, onRefresh }: { session: LiveSession; onRefresh: () => Promise<void> | void }) {
  return <Desenho><Lista session={session} onRefresh={onRefresh} /></Desenho>;
}
