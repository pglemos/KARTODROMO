/** Carteira: reservas (com quantas estão ativas), perfil e dados, programa de fidelidade (XP e categoria) e conquistas. */
import { router, type Href } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Icon } from '../components/brand';
import { TelaCarreira, useMinhaCarreira } from '../components/carreira-kit';
import { tap } from '../components/motion';
import { useUi } from '../components/theme';
import { reservationsApi } from '../features/reservations/api';
import { categoriaDe, conquistasDe, xpDe } from '../features/ranking/gamificacao';
import { useSession } from '../session/provider';

export default function Carteira() {
  const { palette } = useUi();
  const { session } = useSession();
  const { dados } = useMinhaCarreira();
  const [reservas, setReservas] = useState<number | null>(null);
  const carregar = useCallback(async () => {
    if (!session) return;
    try { setReservas((await reservationsApi.list(session.accessToken)).length); } catch { setReservas(null); }
  }, [session]);
  useEffect(() => { void Promise.resolve().then(carregar); }, [carregar]);

  const xp = dados ? xpDe(dados) : null;
  const itens: { titulo: string; texto: string; icone: 'calendar' | 'account' | 'crown' | 'trophy'; cor: string; rota: string; contador?: string }[] = [
    { titulo: 'Minhas reservas', texto: 'Baterias reservadas e pagamentos', icone: 'calendar', cor: '#2563EB', rota: '/(tabs)/reservas', contador: reservas === null ? undefined : String(reservas) },
    { titulo: 'Meu perfil', texto: 'Telefone, peso, nascimento e endereço', icone: 'account', cor: '#16A34A', rota: '/perfil' },
    { titulo: 'Programa de fidelidade', texto: xp !== null ? `${categoriaDe(xp).nome} · ${xp.toLocaleString('pt-BR')} XP` : 'XP e categorias de Novato a Lenda', icone: 'crown', cor: '#7C3AED', rota: '/progresso' },
    { titulo: 'Conquistas', texto: dados ? `${conquistasDe(dados).filter((c) => c.liberada).length} de ${conquistasDe(dados).length} conquistadas` : 'Medalhas da sua carreira', icone: 'trophy', cor: '#F59E0B', rota: '/minhas-conquistas' },
  ];
  return (
    <TelaCarreira titulo="Minha carteira" onRefresh={carregar}>
      {itens.map((i) => (
        <Pressable key={i.titulo} onPress={() => { tap(); router.push(i.rota as Href); }} accessibilityRole="button" accessibilityLabel={`${i.titulo}. ${i.texto}`}
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: palette.surface, borderRadius: 20, borderWidth: 1, borderColor: palette.borderSubtle, padding: 16, transform: [{ scale: pressed ? 0.98 : 1 }] })}>
          <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: i.cor, alignItems: 'center', justifyContent: 'center' }}><Icon name={i.icone} color="#FFFFFF" size={26} /></View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: palette.text, fontSize: 17, fontWeight: '900' }}>{i.titulo}</Text>
            <Text style={{ color: palette.textMuted, fontSize: 13 }}>{i.texto}</Text>
          </View>
          {i.contador ? <View style={{ minWidth: 26, height: 26, borderRadius: 13, backgroundColor: i.cor, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 }}><Text style={{ color: '#FFFFFF', fontWeight: '900' }}>{i.contador}</Text></View> : null}
          <Icon name="chevron" color={palette.textMuted} size={18} />
        </Pressable>
      ))}
    </TelaCarreira>
  );
}
