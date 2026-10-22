import { router, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Linking, Pressable, ScrollView, Text, View } from 'react-native';

import { Brand, Icon } from './brand';
import { Esmaecer, HeroFoto, fotos } from './hero-foto';
import { Entrada, tap } from './motion';
import { ProximaReserva } from './proxima-reserva';
import { useUi } from './theme';
import { useLiveStatus } from '../features/live/api';
import { formatarVolta, rankingApi, type CarreiraPiloto } from '../features/ranking/api';
import { categoriaDe, xpDe } from '../features/ranking/gamificacao';
import { useSession } from '../session/provider';

/** política do app (página do domínio das reservas; o site principal não tem /privacidade) */
const PRIVACIDADE = 'https://reservas.kartodromodebetim.com.br/privacidade';

const VERDE = '#2BF27A';
const CARTAO = '#0D1411';
const BORDA = '#1C2621';

type Atalho = { titulo: string; texto: string; icone: 'calendar' | 'ticket' | 'timer' | 'results' | 'trophy' | 'podium'; href: Href };

const atalhos: Atalho[] = [
  { titulo: 'Agenda', texto: 'Horários livres da pista', icone: 'calendar', href: '/(tabs)/agenda' },
  { titulo: 'Reservas', texto: 'Suas baterias e cupons', icone: 'ticket', href: '/(tabs)/reservas' },
  { titulo: 'Ao vivo', texto: 'Tempos volta a volta', icone: 'timer', href: '/(tabs)/livetime' },
  { titulo: 'Resultados', texto: 'Seu histórico na pista', icone: 'results', href: '/(tabs)/resultados' },
  { titulo: 'Ranking', texto: 'Os mais rápidos da pista', icone: 'podium', href: '/ranking' },
  { titulo: 'Minha carreira', texto: 'XP, conquistas e evolução', icone: 'trophy', href: '/(tabs)/carreira' as Href },
];

function Rotulo({ texto, acao, onAcao }: { texto: string; acao?: string; onAcao?: () => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 }}>
      <View style={{ width: 24, height: 2, backgroundColor: VERDE }} />
      <Text style={{ color: '#C9D2CD', fontSize: 11, letterSpacing: 4, fontWeight: '600', flex: 1 }}>{texto}</Text>
      {acao ? (
        <Pressable onPress={onAcao} accessibilityRole="link" hitSlop={10}>
          <Text style={{ color: '#C9D2CD', fontSize: 13, textDecorationLine: 'underline' }}>{acao} ›</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** Início do app de loja: capa com piloto, pista ao vivo, atalhos, próximo evento, últimos tempos e carreira. */
export default function StartScreen() {
  const { palette } = useUi();
  const { session } = useSession();
  const { snapshot } = useLiveStatus(10_000);
  const aoVivo = snapshot?.status === 'live' && snapshot.drivers.length > 0;
  const [eu, setEu] = useState<CarreiraPiloto | null>(null);

  useEffect(() => {
    if (!session) { setEu(null); return; }
    let vivo = true;
    rankingApi.minha(session.accessToken).then((d) => { if (vivo) setEu(d); }).catch(() => undefined);
    return () => { vivo = false; };
  }, [session]);

  const xp = eu ? xpDe(eu) : 0;
  const cat = categoriaDe(xp);
  const nivel = Math.floor(xp / 500) + 1;
  const tempos = (eu?.recentes ?? []).filter((r) => r.melhor).slice(0, 3);
  const melhorDeTodos = tempos.length ? Math.min(...tempos.map((t) => t.melhor ?? Infinity)) : null;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#050807' }} contentContainerStyle={{ paddingBottom: 130 }}>
      <HeroFoto
        foto={fotos.inicio}
        rotulo="ADRENALINA REAL"
        linha1="BORA PRA"
        linha2="PISTA?"
        texto="Reserve sua bateria, acompanhe a corrida ao vivo e veja seus tempos em tempo real."
        altura={380}
        topo={
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ flex: 1 }}><Brand width={170} /></View>
            <Pressable onPress={() => { tap(); router.push(session ? '/(tabs)/reservas' : '/(auth)/login'); }} accessibilityRole="button" accessibilityLabel="Avisos e reservas"
              style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: 'rgba(17,24,21,0.9)', borderWidth: 1, borderColor: BORDA, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="ticket" color="#FFFFFF" size={20} />
              <View style={{ position: 'absolute', top: 9, right: 9, width: 8, height: 8, borderRadius: 4, backgroundColor: VERDE }} />
            </Pressable>
            <Pressable onPress={() => { tap(); router.push(session ? ('/(tabs)/carreira' as Href) : '/(auth)/login'); }} accessibilityRole="button" accessibilityLabel={session ? `Nível ${nivel}` : 'Entrar'}
              style={{ height: 46, borderRadius: 23, paddingLeft: 4, paddingRight: 12, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(17,24,21,0.9)', borderWidth: 1, borderColor: BORDA }}>
              <View style={{ width: 38, height: 38, borderRadius: 19, borderWidth: 2, borderColor: VERDE, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0B110E' }}>
                <Icon name="account" color={VERDE} size={22} />
              </View>
              <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 14 }}>
                {session ? <>Nível <Text style={{ color: VERDE }}>{nivel}</Text></> : 'Entrar'}
              </Text>
              <Icon name="chevron" color="#FFFFFF" size={14} />
            </Pressable>
          </View>
        }
      >
        <Pressable onPress={() => { tap(); router.push('/(tabs)/agenda'); }} accessibilityRole="button" accessibilityLabel="Reservar agora"
          style={({ pressed }) => ({ marginTop: 12, height: 58, borderRadius: 16, backgroundColor: VERDE, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, gap: 12, maxWidth: 300, shadowColor: VERDE, shadowOpacity: 0.5, shadowRadius: 18, elevation: 8, transform: [{ scale: pressed ? 0.97 : 1 }] })}>
          <Icon name="bolt" color="#04170B" size={22} />
          <Text style={{ color: '#04170B', fontWeight: '900', fontSize: 16, letterSpacing: 0.5, flex: 1 }}>RESERVAR AGORA</Text>
          <Icon name="chevron" color="#04170B" size={18} />
        </Pressable>
      </HeroFoto>

      <View style={{ paddingHorizontal: 16, gap: 14, width: '100%', maxWidth: 640, alignSelf: 'center' }}>
        <Entrada index={0}>
          <Pressable onPress={() => { tap(); router.push('/(tabs)/livetime'); }} accessibilityRole="button"
            style={({ pressed }) => ({ backgroundColor: 'rgba(13,20,17,0.95)', borderRadius: 18, borderWidth: 1, borderColor: aoVivo ? palette.neonRed : BORDA, padding: 16, opacity: pressed ? 0.85 : 1 })}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: aoVivo ? palette.neonRed : VERDE }} />
              <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 14, letterSpacing: 2 }}>PISTA</Text>
              <View style={{ backgroundColor: aoVivo ? 'rgba(239,68,68,0.18)' : '#12361F', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999 }}>
                <Text style={{ color: aoVivo ? palette.neonRed : VERDE, fontWeight: '800', fontSize: 13, letterSpacing: 1 }}>{aoVivo ? 'AO VIVO' : 'ABERTA'}</Text>
              </View>
              <View style={{ flex: 1 }} />
              <Icon name="chevron" color="#FFFFFF" size={16} />
            </View>
            {aoVivo ? (
              <>
                <Text style={{ color: '#FFFFFF', fontSize: 17, fontWeight: '800', marginTop: 10 }} numberOfLines={1}>{snapshot.eventName}</Text>
                {snapshot.drivers.slice(0, 3).map((d) => (
                  <View key={d.position} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 12 }}>
                    <Text style={{ color: d.position === 1 ? palette.gold : '#C9D2CD', fontWeight: '900', fontSize: 16, width: 22 }}>{d.position}</Text>
                    <Text style={{ color: '#FFFFFF', fontSize: 15, flex: 1 }} numberOfLines={1}>{d.name}</Text>
                    <Text style={{ color: '#C9D2CD', fontSize: 15, fontVariant: ['tabular-nums'] }}>{d.best || '—'}</Text>
                  </View>
                ))}
                <Pressable onPress={() => { tap(); router.push('/cockpit' as Href); }} accessibilityRole="button" style={({ pressed }) => ({ marginTop: 12, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: VERDE, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999, transform: [{ scale: pressed ? 0.95 : 1 }] })}>
                  <Icon name="timer" color="#04170B" size={16} />
                  <Text style={{ color: '#04170B', fontWeight: '800', fontSize: 13 }}>Abrir meu cockpit</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '700', marginTop: 10 }}>Nenhuma bateria rodando agora.</Text>
                <Text style={{ color: '#A8B3AD', fontSize: 14, marginTop: 4 }}>Quando começar, os tempos aparecem aqui na hora.</Text>
              </>
            )}
          </Pressable>
        </Entrada>

        <ProximaReserva />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {atalhos.map((a, i) => (
            <Entrada key={a.titulo} index={i + 1}>
              <Pressable onPress={() => { tap(); router.push(a.href); }} accessibilityRole="button" accessibilityLabel={a.titulo}
                style={({ pressed }) => ({ width: 104, minHeight: 142, backgroundColor: CARTAO, borderRadius: 16, borderWidth: 1, borderColor: BORDA, paddingVertical: 14, paddingHorizontal: 8, alignItems: 'center', gap: 6, transform: [{ scale: pressed ? 0.96 : 1 }] })}>
                <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: '#0F2418', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name={a.icone} color={VERDE} size={26} />
                </View>
                <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '800', textAlign: 'center' }} numberOfLines={1}>{a.titulo}</Text>
                <Text style={{ color: '#A8B3AD', fontSize: 11.5, textAlign: 'center', lineHeight: 15 }}>{a.texto}</Text>
              </Pressable>
            </Entrada>
          ))}
        </ScrollView>

        <Pressable onPress={() => { tap(); router.push('/(tabs)/agenda'); }} accessibilityRole="button" accessibilityLabel="Próximo evento: 100 Milhas Light de Betim"
          style={{ borderRadius: 18, borderWidth: 1, borderColor: '#1F5A36', overflow: 'hidden', backgroundColor: '#07100B', minHeight: 196 }}>
          <View pointerEvents="none" style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '62%' }}>
            <Image source={fotos.evento} resizeMode="cover" style={{ width: '100%', height: '100%' }} />
            <Esmaecer lado="left" tamanho={110} />
          </View>
          <View style={{ padding: 18, gap: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ width: 22, height: 2, backgroundColor: VERDE }} />
              <Text style={{ color: '#C9D2CD', fontSize: 11, letterSpacing: 4, fontWeight: '600' }}>PRÓXIMO EVENTO</Text>
            </View>
            <Text style={{ color: '#FFFFFF', fontSize: 44, lineHeight: 44, fontWeight: '900', fontStyle: 'italic', letterSpacing: -1.5 }}>100<Text style={{ color: VERDE }}>MILHAS</Text></Text>
            <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '900', fontStyle: 'italic', letterSpacing: 1 }}>LIGHT DE BETIM</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
              <Icon name="calendar" color="#FFFFFF" size={16} />
              <Text style={{ color: '#FFFFFF', fontSize: 14 }}>25 OUT 2026 · LARGADA 10:00</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Icon name="flag" color="#FFFFFF" size={16} />
              <Text style={{ color: '#FFFFFF', fontSize: 14 }}>KARTÓDROMO DE BETIM</Text>
            </View>
            <View style={{ marginTop: 8, alignSelf: 'flex-start', height: 40, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1.5, borderColor: VERDE, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={{ color: VERDE, fontWeight: '800', fontSize: 13 }}>VER DETALHES</Text>
              <Icon name="chevron" color={VERDE} size={14} />
            </View>
          </View>
        </Pressable>

        {session ? (
          <>
            <Rotulo texto="MEUS ÚLTIMOS TEMPOS" acao="Ver todos" onAcao={() => router.push('/(tabs)/resultados')} />
            {tempos.length ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {tempos.map((t, i) => (
                  <View key={`${t.dia}-${i}`} style={{ width: 168, backgroundColor: CARTAO, borderRadius: 16, borderWidth: 1, borderColor: BORDA, padding: 12, gap: 4 }}>
                    <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 13 }} numberOfLines={1}>{t.bateria || t.tipo}</Text>
                    <Text style={{ color: '#A8B3AD', fontSize: 12 }}>{t.dia.split('-').reverse().join('/')}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 }}>
                      <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 22, fontVariant: ['tabular-nums'] }}>{formatarVolta(t.melhor!)}</Text>
                      {t.melhor === melhorDeTodos ? <View style={{ backgroundColor: '#12361F', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 3 }}><Text style={{ color: VERDE, fontSize: 9, fontWeight: '800' }}>MELHOR</Text></View> : null}
                    </View>
                  </View>
                ))}
              </ScrollView>
            ) : (
              <Text style={{ color: '#A8B3AD', fontSize: 14 }}>Seus tempos aparecem aqui depois da primeira bateria.</Text>
            )}
          </>
        ) : null}

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Pressable onPress={() => { tap(); router.push(session ? ('/(tabs)/carreira' as Href) : '/(auth)/login'); }} accessibilityRole="button" accessibilityLabel="Minha carreira"
            style={{ flex: 1.15, minHeight: 130, borderRadius: 18, borderWidth: 1, borderColor: BORDA, backgroundColor: CARTAO, overflow: 'hidden', padding: 14, justifyContent: 'space-between' }}>
            <View pointerEvents="none" style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '55%' }}>
              <Image source={fotos.carreira} resizeMode="cover" style={{ width: '100%', height: '100%', opacity: 0.85 }} />
              <Esmaecer lado="left" tamanho={70} />
            </View>
            <Text style={{ color: '#FFFFFF', fontSize: 22, lineHeight: 22, fontWeight: '900', fontStyle: 'italic' }}>MINHA{'\n'}CARREIRA</Text>
            <View style={{ gap: 6 }}>
              <Text style={{ color: '#D4DBD7', fontSize: 13 }}>{session ? `Nível ${nivel} · ${cat.nome}` : 'Entre para ver seu XP'}</Text>
              <View style={{ height: 6, borderRadius: 3, backgroundColor: '#24302A', overflow: 'hidden', width: '80%' }}>
                <View style={{ width: `${Math.round(((xp % 500) / 500) * 100)}%`, height: 6, backgroundColor: VERDE }} />
              </View>
              {session ? <Text style={{ color: '#A8B3AD', fontSize: 11 }}>{xp % 500} / 500 XP</Text> : null}
            </View>
          </Pressable>
          <Pressable onPress={() => { tap(); router.push(session ? ('/carteira' as Href) : '/(auth)/login'); }} accessibilityRole="button" accessibilityLabel="Cupons e benefícios"
            style={{ flex: 1, minHeight: 130, borderRadius: 18, borderWidth: 1, borderColor: '#1F5A36', backgroundColor: '#0C2416', padding: 14, gap: 6 }}>
            <Icon name="ticket" color={VERDE} size={30} />
            <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '800' }}>CUPONS E BENEFÍCIOS</Text>
            <Text style={{ color: '#C9D2CD', fontSize: 12, lineHeight: 16 }}>Descontos em baterias, eventos e produtos.</Text>
          </Pressable>
        </View>

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Pressable onPress={() => { tap(); router.push('/karts' as Href); }} accessibilityRole="button" accessibilityLabel="Nossos karts"
            style={{ flex: 1, minHeight: 110, borderRadius: 18, borderWidth: 1, borderColor: BORDA, backgroundColor: CARTAO, overflow: 'hidden', padding: 14, gap: 4 }}>
            <View pointerEvents="none" style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '55%' }}>
              <Image source={fotos.agenda} resizeMode="cover" style={{ width: '100%', height: '100%', opacity: 0.8 }} />
              <Esmaecer lado="left" tamanho={70} />
            </View>
            <Text style={{ color: '#FFFFFF', fontSize: 20, lineHeight: 20, fontWeight: '900', fontStyle: 'italic' }}>NOSSOS{'\n'}KARTS</Text>
            <Text style={{ color: '#C9D2CD', fontSize: 12, maxWidth: 110 }}>Seus tempos por kart</Text>
          </Pressable>
          <Pressable onPress={() => { tap(); router.push('/ranking' as Href); }} accessibilityRole="button" accessibilityLabel="Ranking e regras"
            style={{ flex: 1, minHeight: 110, borderRadius: 18, borderWidth: 1, borderColor: BORDA, backgroundColor: CARTAO, padding: 14, gap: 4 }}>
            <Icon name="flag" color="#FFFFFF" size={26} />
            <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '800' }}>RANKING E REGRAS</Text>
            <Text style={{ color: '#C9D2CD', fontSize: 12, lineHeight: 16 }}>Os mais rápidos e como funciona o XP.</Text>
          </Pressable>
        </View>

        <Pressable onPress={() => void Linking.openURL(PRIVACIDADE)} accessibilityRole="link" style={{ alignSelf: 'center', paddingVertical: 12 }}>
          <Text style={{ color: '#A8B3AD', fontSize: 13, textDecorationLine: 'underline' }}>Política de privacidade</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
