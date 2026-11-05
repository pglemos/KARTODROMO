import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, Pressable, ScrollView, Text, View } from 'react-native';

import { Brand, Icon } from './brand';
import { Caixa, Desenho, Foto, LARGO, SetaCirculo, T, Toque, cor, fonte, fundos, useK, useTopo } from './design-kit';
import { tap } from './motion';
import { useLiveStatus } from '../features/live/api';
import { formatarVolta, rankingApi, type CarreiraPiloto } from '../features/ranking/api';
import { xpDe } from '../features/ranking/gamificacao';
import { useSession } from '../session/provider';
import { SPORTS_PALETTE } from './theme';
import { useFloatingTabBarClearance } from './floating-tab-bar';

/** política do app (página do domínio das reservas; o site principal não tem /privacidade) */
const PRIVACIDADE = 'https://reservas.kartodromodebetim.com.br/privacidade';

/** topo do desenho (abaixo da barra de status da imagem): as medidas abaixo são y do desenho menos isto */
const Y0 = 70;
const ALTURA = 1640 - Y0;

type NomeIcone = Parameters<typeof Icon>[0]['name'];
const ATALHOS: { x: number; w: number; titulo: string; texto: string; icone: NomeIcone; href: Href }[] = [
  { x: 28, w: 118, titulo: 'Agenda', texto: 'Horários livres\nda pista', icone: 'calendar', href: '/(tabs)/agenda' },
  { x: 160, w: 124, titulo: 'Reservas', texto: 'Suas baterias\ne cupons', icone: 'helmet', href: '/(tabs)/reservas' },
  { x: 298, w: 123, titulo: 'Ao vivo', texto: 'Tempos volta\na volta', icone: 'signal', href: '/(tabs)/livetime' },
  { x: 435, w: 122, titulo: 'Resultados', texto: 'Seu histórico\nna pista', icone: 'flag', href: '/(tabs)/resultados' },
  { x: 571, w: 121, titulo: 'Ranking', texto: 'Os mais rápidos\nda pista', icone: 'chart', href: '/ranking' },
  { x: 706, w: 120, titulo: 'Minha carreira', texto: 'XP, conquistas\ne evolução', icone: 'trophy', href: '/(tabs)/carreira' as Href },
];

const TEMPOS_X = [{ x: 28, w: 260 }, { x: 305, w: 243 }, { x: 565, w: 260 }];
const TEMPOS_ICONE: NomeIcone[] = ['route', 'trophy', 'gauge'];

function y(n: number) {
  return n - Y0;
}

function dataHora(value?: string | null) {
  const date = value ? new Date(value) : null;
  return date && Number.isFinite(date.getTime())
    ? `${date.toLocaleDateString('pt-BR')} · ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
    : 'horário não informado';
}

export function rotuloStatusPista(status: 'live' | 'finished' | 'empty' | null, indisponivel = false) {
  if (indisponivel) return 'INDISPONÍVEL';
  if (status === 'live') return 'AO VIVO';
  if (status === 'finished') return 'ENCERRADA';
  return 'SEM BATERIA';
}

function Inicio() {
  const k = useK();
  const insets = { top: useTopo() };
  const { session } = useSession();
  const scrollRef = useRef<ScrollView>(null);
  const bottomClearance = useFloatingTabBarClearance();
  const { snapshot, error: liveError } = useLiveStatus(10_000);
  const bateriaAoVivo = snapshot?.status === 'live';
  const aoVivo = bateriaAoVivo && snapshot.drivers.length > 0;
  const statusPista = rotuloStatusPista(snapshot?.status ?? null, Boolean(liveError && !snapshot));
  const corStatusPista = statusPista === 'AO VIVO' ? '#FF6B6B' : statusPista === 'INDISPONÍVEL' ? SPORTS_PALETTE.warning : '#B4BCB8';
  const [eu, setEu] = useState<CarreiraPiloto | null>(null);
  const [carreiraErro, setCarreiraErro] = useState('');

  useFocusEffect(useCallback(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, []));

  useEffect(() => {
    let vivo = true;
    void Promise.resolve().then(() => {
      if (!vivo) return;
      setEu(null);
      setCarreiraErro('');
      if (!session) return;
      return rankingApi.minha(session.accessToken).then((d) => { if (vivo) { setEu(d); setCarreiraErro(''); } }).catch((e: unknown) => {
        if (vivo) setCarreiraErro(e instanceof Error ? e.message : 'Não foi possível carregar a carreira.');
      });
    });
    return () => { vivo = false; };
  }, [session]);

  const xp = session && eu ? xpDe(eu) : 0;
  const nivel = Math.floor(xp / 500) + 1;
  const xpNivel = xp % 500;
  const tempos = (session ? eu?.recentes ?? [] : []).filter((r) => r.melhor).slice(0, 3);
  const ordenados = [...tempos].map((t) => t.melhor ?? Infinity).sort((a, b) => a - b);
  const ir = (h: Href) => () => { tap(); router.push(h); };

  return (
    <ScrollView ref={scrollRef} style={{ flex: 1, backgroundColor: cor.fundo }} contentContainerStyle={{ paddingTop: insets.top, paddingBottom: bottomClearance }} showsVerticalScrollIndicator accessibilityLabel="Conteúdo inicial rolável">
      {/* a foto do topo continua por trás da barra de status */}
      <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, height: insets.top + 10, backgroundColor: '#0A0C0B' }} />
      <View style={{ width: 852 * k, height: ALTURA * k, alignSelf: 'center' }}>
        <Caixa x={0} y={y(64)} w={852} h={548} pointerEvents="none"><Foto fonte={fundos.inicioTopo} /></Caixa>

        {/* cabeçalho */}
        <Caixa x={35} y={y(80)} pointerEvents="none"><Brand width={340 * k} /></Caixa>
        <Toque x={522} y={y(88)} w={66} h={66} rotulo="Avisos" onPress={ir(session ? '/(tabs)/reservas' : '/(auth)/login')}
          style={{ borderRadius: 18 * k, backgroundColor: 'rgba(14,17,16,0.92)', borderWidth: 1, borderColor: '#2A302D', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="bell" color="#FFFFFF" size={34 * k} />
          <View style={{ position: 'absolute', top: 8 * k, right: 9 * k, width: 15 * k, height: 15 * k, borderRadius: 8 * k, backgroundColor: cor.verde, borderWidth: 2 * k, borderColor: '#0E1110' }} />
        </Toque>
        <Toque x={605} y={y(86)} w={218} h={68} rotulo={session ? carreiraErro ? 'Carreira indisponível' : eu ? `Nível ${nivel}` : 'Carreira carregando' : 'Entrar'} onPress={ir(session ? ('/(tabs)/carreira' as Href) : '/(auth)/login')}
          style={{ borderRadius: 34 * k, backgroundColor: 'rgba(14,17,16,0.92)', borderWidth: 1, borderColor: '#2A302D', flexDirection: 'row', alignItems: 'center', paddingLeft: 2 * k }}>
          <View style={{ width: 66 * k, height: 66 * k, borderRadius: 33 * k, borderWidth: 3 * k, borderColor: cor.verde, backgroundColor: '#0B1A10', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="helmet" color={cor.verde} size={38 * k} />
          </View>
          <Text numberOfLines={1} adjustsFontSizeToFit style={{ marginLeft: 14 * k, flex: 1, color: '#FFFFFF', fontSize: session && (!eu || carreiraErro) ? 16 * k : 24 * k, fontWeight: '500' }}>
            {!session ? 'Entrar' : carreiraErro ? 'Carreira indisponível' : !eu ? 'Carregando…' : <>Nível <Text style={{ color: cor.verde, fontWeight: '700' }}>{nivel}</Text></>}
          </Text>
          <View style={{ marginRight: 20 * k }}><Icon name="chevron" color="#FFFFFF" size={24 * k} /></View>
        </Toque>

        {/* título */}
        <Caixa x={45} y={y(222)} pointerEvents="none" style={{ flexDirection: 'row', alignItems: 'center' }}>
          <T s={18} c="#D3D8D5" p="500" style={{ letterSpacing: 7.5 * k }}>ADRENALINA REAL</T>
          <View style={{ width: 60 * k, height: 3 * k, backgroundColor: cor.verde, marginLeft: 8 * k }} />
        </Caixa>
        <Caixa x={36} y={y(244)} pointerEvents="none">
          <T s={72} f={fonte.display} largo={LARGO} lh={57} style={{ letterSpacing: -1 * k }}>BORA PRA</T>
          <T s={72} f={fonte.display} largo={LARGO} lh={57} c={cor.verde} style={{ letterSpacing: -1 * k }}>PISTA?</T>
        </Caixa>
        <Caixa x={41} y={y(378)} w={328} pointerEvents="none">
          <T s={21.5} lh={26.5} c="#DCE1DE">Reserve sua bateria, acompanhe a corrida ao vivo e veja seus tempos em tempo real.</T>
        </Caixa>
        <Toque x={40} y={y(487)} w={357} h={76} rotulo="Reservar agora" onPress={ir('/(tabs)/agenda')}
          style={{ borderRadius: 20 * k, backgroundColor: '#1ED760', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 26 * k, shadowColor: cor.verde, shadowOpacity: 0.55, shadowRadius: 16 * k, shadowOffset: { width: 0, height: 0 }, elevation: 10, borderWidth: 1.5 * k, borderColor: SPORTS_PALETTE.neonGreen }}>
          <Icon name="bolt" color="#04230F" size={34 * k} />
          <T s={23} c="#04230F" p="800" style={{ marginLeft: 22 * k, flex: 1, letterSpacing: 0.3 * k }}>RESERVAR AGORA</T>
          <Icon name="chevron" color="#04230F" size={28 * k} />
        </Toque>

        {/* pista */}
        <Toque x={482} y={y(432)} w={343} h={163} rotulo={bateriaAoVivo ? aoVivo ? 'Corrida ao vivo agora' : 'Bateria ao vivo, aguardando a primeira passagem' : snapshot?.status === 'finished' ? 'Última bateria encerrada' : liveError && !snapshot ? 'Status da pista indisponível' : 'Sem bateria no momento'} onPress={ir(aoVivo ? ('/cockpit' as Href) : '/(tabs)/livetime')}
          style={{ borderRadius: 22 * k, backgroundColor: 'rgba(11,14,13,0.9)', borderWidth: 1, borderColor: '#2A302D', paddingLeft: 22 * k, paddingTop: 15 * k }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ width: 18 * k, height: 18 * k, borderRadius: 9 * k, backgroundColor: bateriaAoVivo ? SPORTS_PALETTE.neonRed : statusPista === 'INDISPONÍVEL' ? SPORTS_PALETTE.warning : '#8A928E' }} />
            <T s={21} p="500" style={{ marginLeft: 16 * k, letterSpacing: 2 * k }}>PISTA</T>
            <View style={{ marginLeft: 22 * k, height: 40 * k, paddingHorizontal: 22 * k, borderRadius: 20 * k, backgroundColor: bateriaAoVivo ? SPORTS_PALETTE.dangerSurface : statusPista === 'SEM BATERIA' ? '#19211C' : statusPista === 'INDISPONÍVEL' ? SPORTS_PALETTE.warningSurface : SPORTS_PALETTE.surfaceElevated, justifyContent: 'center' }}>
              <T s={20} p="700" c={corStatusPista} style={{ letterSpacing: 1 * k }}>{statusPista}</T>
            </View>
            <View style={{ position: 'absolute', right: 22 * k }}><Icon name="chevron" color="#FFFFFF" size={26 * k} /></View>
          </View>
          {liveError && !snapshot ? (
            <>
              <T s={19.5} p="700" linhas={2} style={{ marginTop: 13 * k, marginRight: 18 * k }}>Não foi possível carregar o status da pista.</T>
              <T s={16} c="#B4BCB8" lh={21} style={{ marginTop: 4 * k, marginRight: 30 * k }}>Abra Ao vivo e tente atualizar novamente.</T>
            </>
          ) : bateriaAoVivo ? (
            <>
              <T s={20} p="700" linhas={1} style={{ marginTop: 12 * k, marginRight: 18 * k }}>{snapshot.eventName || 'Bateria ao vivo'}</T>
              {!snapshot.drivers.length ? <T s={16} c="#B9C1BD" linhas={1} style={{ marginTop: 5 * k, marginRight: 18 * k }}>Aguardando a primeira passagem do kart.</T> : null}
              {snapshot.drivers.slice(0, 2).map((d) => (
                <T key={d.position} s={18} c="#B9C1BD" linhas={1} style={{ marginTop: 3 * k, marginRight: 18 * k }}>{d.position}º {d.name} · {d.best || '—'}</T>
              ))}
            </>
          ) : snapshot?.status === 'finished' ? (
            <>
              <T s={19} p="700" linhas={2} style={{ marginTop: 12 * k, marginRight: 18 * k }}>{snapshot.eventName || 'Última bateria'}</T>
              <T s={16} c="#B4BCB8" linhas={1} style={{ marginTop: 5 * k, marginRight: 18 * k }}>Encerrada em {dataHora(snapshot.startedAt)}</T>
            </>
          ) : (
            <>
              <T s={19.5} p="700" linhas={1} style={{ marginTop: 13 * k, marginRight: 14 * k, letterSpacing: -0.3 * k }}>Nenhuma bateria rodando agora.</T>
              <T s={19.5} c="#B4BCB8" lh={23} style={{ marginTop: 4 * k, marginRight: 30 * k }}>Quando começar, os tempos aparecem aqui na hora.</T>
            </>
          )}
        </Toque>

        {/* atalhos */}
        {ATALHOS.map((a) => (
          <Toque key={a.titulo} x={a.x} y={y(625)} w={a.w} h={180} rotulo={a.titulo} testID={`btn-atalho-${a.titulo.toLowerCase().replace(/ /g, '-')}`} onPress={ir(a.href)}
            style={{ borderRadius: 18 * k, backgroundColor: cor.cartao, borderWidth: 1, borderColor: cor.borda, alignItems: 'center', paddingTop: 30 * k }}>
            <Icon name={a.icone} color={cor.verde} size={42 * k} />
            <T s={a.titulo.length > 10 ? 17.5 : 20.5} p="700" linhas={a.titulo.length > 10 ? 2 : 1} style={{ marginTop: 18 * k, letterSpacing: -0.3 * k }}>{a.titulo}</T>
            <T s={15.5} c="#A3ABA7" lh={20} style={{ marginTop: 6 * k, textAlign: 'center' }}>{a.texto}</T>
          </Toque>
        ))}

        {/* próximo evento */}
        <Toque x={28} y={y(822)} w={798} h={286} rotulo="Consultar eventos e baterias na agenda" onPress={ir('/(tabs)/agenda')}
          style={{ borderRadius: 22 * k, overflow: 'hidden', borderWidth: 1.5 * k, borderColor: SPORTS_PALETTE.border }}>
          <Foto fonte={fundos.inicioEvento} />
          <Caixa x={32} y={34} pointerEvents="none" style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ width: 36 * k, height: 3 * k, backgroundColor: cor.verde }} />
            <T s={17} c="#D0D5D2" p="500" style={{ marginLeft: 12 * k, letterSpacing: 7 * k }}>AGENDA DA PISTA</T>
          </Caixa>
          <Caixa x={24} y={44} pointerEvents="none">
            <T s={68} f={fonte.display} largo={LARGO} style={{ letterSpacing: -2 * k }}>EVENTOS<Text style={{ color: cor.verde }}> E</Text></T>
          </Caixa>
          <Caixa x={27} y={116} pointerEvents="none"><T s={27} f={fonte.display} largo={LARGO} style={{ letterSpacing: 1.5 * k }}>BATERIAS NA PISTA</T></Caixa>
          <Caixa x={27} y={144} pointerEvents="none" style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Icon name="calendar" color="#FFFFFF" size={24 * k} />
            <T s={20.5} style={{ marginLeft: 16 * k }}>Horários atualizados na agenda</T>
          </Caixa>
          <Caixa x={27} y={179} pointerEvents="none" style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Icon name="route" color="#FFFFFF" size={24 * k} />
            <T s={20.5} style={{ marginLeft: 16 * k }}>KARTÓDROMO DE BETIM</T>
          </Caixa>
          <Caixa x={24} y={218} w={193} h={48} pointerEvents="none" style={{ borderRadius: 24 * k, borderWidth: 2 * k, borderColor: cor.verde, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.35)' }}>
            <T s={17.5} p="800" c={cor.verde} style={{ letterSpacing: 0.5 * k }}>VER A AGENDA</T>
            <View style={{ marginLeft: 12 * k }}><Icon name="chevron" color={cor.verde} size={22 * k} /></View>
          </Caixa>
        </Toque>

        {/* meus últimos tempos */}
        <Caixa x={30} y={y(1130)} pointerEvents="none" style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ width: 35 * k, height: 3 * k, backgroundColor: cor.verde }} />
          <T s={17} c="#D0D5D2" p="500" style={{ marginLeft: 14 * k, letterSpacing: 7 * k }}>MEUS ÚLTIMOS TEMPOS</T>
        </Caixa>
        <Toque x={660} y={y(1124)} w={167} h={36} rotulo="Ver todos os tempos" onPress={ir(session ? '/(tabs)/resultados' : '/(auth)/login')} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' }}>
          <T s={19} c="#D0D5D2" style={{ textDecorationLine: 'underline' }}>Ver todos</T>
          <View style={{ marginLeft: 10 * k }}><Icon name="chevron" color="#D0D5D2" size={22 * k} /></View>
        </Toque>
        {TEMPOS_X.map((c, i) => {
          const t = tempos[i];
          const rank = t ? ordenados.indexOf(t.melhor ?? Infinity) : -1;
          return (
            <Toque key={i} x={c.x} y={y(1165)} w={c.w} h={132} rotulo={t ? `${t.bateria || t.tipo}, ${formatarVolta(t.melhor!)}` : 'Sem tempo ainda'}
              onPress={ir(session ? '/(tabs)/resultados' : '/(auth)/login')}
              style={{ borderRadius: 16 * k, backgroundColor: cor.cartao, borderWidth: 1, borderColor: cor.borda }}>
              <Caixa x={i === 0 ? 24 : 22} y={20} pointerEvents="none"><Icon name={TEMPOS_ICONE[i]} color={i === 0 ? '#FFFFFF' : cor.verde} size={40 * k} /></Caixa>
              <Caixa x={i === 0 ? 85 : 82} y={16} w={c.w - 95} pointerEvents="none">
                <T s={17} p="700" linhas={1}>{t ? (t.bateria || t.tipo) : session && carreiraErro ? 'Histórico indisponível' : i === 0 ? 'Sem baterias' : '—'}</T>
                <T s={16} c="#A7AFAB" linhas={1} style={{ marginTop: 6 * k }}>{t ? t.dia.split('-').reverse().join('/') : session && carreiraErro ? 'Toque para abrir Carreira' : session ? 'Corra para aparecer' : 'Entre na sua conta'}</T>
              </Caixa>
              <Caixa x={i === 0 ? 24 : 22} y={74} pointerEvents="none" style={{ flexDirection: 'row', alignItems: 'center' }}>
                <T s={33} p="700" style={{ fontVariant: ['tabular-nums'], letterSpacing: -0.5 * k }}>{t ? formatarVolta(t.melhor!) : session && carreiraErro ? '—' : '--.---'}</T>
                {t && rank <= 1 ? (
                  <View style={{ marginLeft: 14 * k, height: 34 * k, paddingHorizontal: 12 * k, borderRadius: 12 * k, backgroundColor: rank === 0 ? '#0E4A27' : SPORTS_PALETTE.border, justifyContent: 'center' }}>
                    <T s={12.5} p="800" c={rank === 0 ? cor.verde : '#E6E9E7'}>{rank === 0 ? 'MELHOR TEMPO' : '2º MELHOR'}</T>
                  </View>
                ) : null}
              </Caixa>
              {i === 2 ? <SetaCirculo x={c.w - 58} y={77} d={40}><Icon name="chevron" color="#FFFFFF" size={20 * k} /></SetaCirculo> : null}
            </Toque>
          );
        })}

        {/* carreira e cupons */}
        <Toque x={28} y={y(1315)} w={437} h={142} rotulo="Minha carreira" onPress={ir(session ? ('/(tabs)/carreira' as Href) : '/(auth)/login')}
          style={{ borderRadius: 18 * k, overflow: 'hidden', borderWidth: 1, borderColor: cor.borda }}>
          <Foto fonte={fundos.inicioCarreira} />
          <Caixa x={31} y={16} pointerEvents="none"><T s={22} f={fonte.display} largo={LARGO} lh={27}>{'MINHA\nCARREIRA'}</T></Caixa>
          <Caixa x={31} y={80} w={210} pointerEvents="none"><T s={19} c="#D3D8D5" linhas={1}>{!session ? 'Entre para ver' : carreiraErro ? 'Carreira indisponível' : !eu ? 'Carregando carreira…' : `Nível ${nivel}`}</T></Caixa>
          {eu ? <>
            <Caixa x={31} y={104} w={219} h={7} pointerEvents="none" style={{ borderRadius: 4 * k, backgroundColor: '#3A403D', overflow: 'hidden' }}>
              <View style={{ width: `${Math.round((xpNivel / 500) * 100)}%`, height: '100%', backgroundColor: cor.verde }} />
            </Caixa>
            <Caixa x={31} y={119} pointerEvents="none"><T s={13} c="#A9B0AC">{xpNivel} / 500 XP</T></Caixa>
          </> : null}
          <SetaCirculo x={275} y={85}><Icon name="chevron" color="#FFFFFF" size={20 * k} /></SetaCirculo>
        </Toque>
        <Toque x={480} y={y(1315)} w={346} h={142} rotulo="Cupons e benefícios" onPress={ir(session ? ('/carteira' as Href) : '/(auth)/login')}
          style={{ borderRadius: 18 * k, overflow: 'hidden', borderWidth: 1, borderColor: SPORTS_PALETTE.border }}>
          <Foto fonte={fundos.inicioCupons} />
          <Caixa x={18} y={24} pointerEvents="none" style={{ transform: [{ rotate: '-20deg' }] }}><Icon name="ticket" color={cor.verde} size={56 * k} /></Caixa>
          <Caixa x={102} y={27} w={236} pointerEvents="none">
            <T s={19} p="700" linhas={1} style={{ letterSpacing: -0.2 * k }}>CUPONS E BENEFÍCIOS</T>
            <T s={18} c="#C9CFCC" lh={23} style={{ marginTop: 8 * k, width: 186 * k }}>Descontos exclusivos para baterias, eventos e produtos.</T>
          </Caixa>
          <SetaCirculo x={295} y={85}><Icon name="chevron" color="#FFFFFF" size={20 * k} /></SetaCirculo>
        </Toque>

        {/* karts e como pilotar */}
        <Toque x={28} y={y(1472)} w={395} h={148} rotulo="Nossos karts" onPress={ir('/karts' as Href)}
          style={{ borderRadius: 18 * k, overflow: 'hidden', borderWidth: 1, borderColor: cor.borda }}>
          <Foto fonte={fundos.inicioKarts} />
          <Caixa x={30} y={26} pointerEvents="none"><T s={21} f={fonte.display} largo={LARGO} lh={25}>{'NOSSOS\nKARTS'}</T></Caixa>
          <Caixa x={30} y={82} w={200} pointerEvents="none"><T s={17} c="#D3D8D5" lh={22}>Seus melhores tempos por kart.</T></Caixa>
          <SetaCirculo x={256} y={92} d={38}><Icon name="chevron" color="#FFFFFF" size={20 * k} /></SetaCirculo>
        </Toque>
        <Toque x={437} y={y(1472)} w={389} h={148} rotulo="Ranking e regras" onPress={ir('/ranking' as Href)}
          style={{ borderRadius: 18 * k, overflow: 'hidden', borderWidth: 1, borderColor: cor.borda }}>
          <Foto fonte={fundos.inicioPilotar} />
          <Caixa x={24} y={32} pointerEvents="none"><Icon name="helmet" color="#FFFFFF" size={46 * k} /></Caixa>
          <Caixa x={96} y={26} w={250} pointerEvents="none">
            <T s={19} p="700">RANKING E REGRAS</T>
            <T s={17} c="#C9CFCC" lh={23} style={{ marginTop: 8 * k }}>Os mais rápidos da pista e como funciona o XP.</T>
          </Caixa>
          <SetaCirculo x={323} y={92} d={38}><Icon name="chevron" color="#FFFFFF" size={20 * k} /></SetaCirculo>
        </Toque>
      </View>

      <Pressable onPress={() => void Linking.openURL(PRIVACIDADE)} accessibilityRole="link" style={{ alignSelf: 'center', paddingVertical: 12 }}>
        <Text style={{ color: cor.texto3, fontSize: 13, textDecorationLine: 'underline' }}>Política de privacidade</Text>
      </Pressable>
    </ScrollView>
  );
}

/** Início do app de loja, no desenho aprovado (medidas da imagem de 852 px, escaladas à largura do celular). */
export default function StartScreen() {
  return <Desenho><Inicio /></Desenho>;
}
