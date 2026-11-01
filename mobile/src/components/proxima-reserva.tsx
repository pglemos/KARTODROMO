/**
 * Cartão do Início com a próxima bateria reservada pelo piloto: dia, hora e quanto falta, com a cor do status.
 * Some sozinho quando não há sessão ou reserva futura.
 */
import { router, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Icon } from './brand';
import { Entrada, tap } from './motion';
import { useUi } from './theme';
import { reservationsApi } from '../features/reservations/api';
import type { ReservationOrder } from '../features/reservations/schemas';
import { useSession } from '../session/provider';

const VALIDAS = ['novo', 'aguardando_pagamento', 'pago', 'confirmado'];

function quantoFalta(inicio: Date, agora: number) {
  const min = Math.round((inicio.getTime() - agora) / 60000);
  if (min < 60) return `em ${Math.max(min, 0)} min`;
  const hoje = new Date(agora).toDateString() === inicio.toDateString();
  if (hoje) return `hoje, em ${Math.floor(min / 60)}h${String(min % 60).padStart(2, '0')}`;
  const dias = Math.ceil((new Date(inicio.toDateString()).getTime() - new Date(new Date(agora).toDateString()).getTime()) / 86400000);
  return dias === 1 ? 'amanhã' : `em ${dias} dias`;
}

export function ProximaReserva() {
  const { palette } = useUi();
  const { session } = useSession();
  const [proxima, setProxima] = useState<ReservationOrder | null>(null);
  const [agora] = useState(() => Date.now());

  useEffect(() => {
    if (!session) return;
    let vivo = true;
    void reservationsApi.list(session.accessToken).then((lista) => {
      const futuras = lista
        .filter((o) => o.inicio && VALIDAS.includes(o.status) && new Date(o.inicio).getTime() > Date.now() - 40 * 60000)
        .sort((a, b) => new Date(a.inicio!).getTime() - new Date(b.inicio!).getTime());
      if (vivo) setProxima(futuras[0] ?? null);
    }).catch(() => undefined);
    return () => { vivo = false; };
  }, [session]);

  if (!session || !proxima?.inicio) return null;
  const inicio = new Date(proxima.inicio);
  const pendente = proxima.status === 'aguardando_pagamento' || proxima.status === 'novo';
  const cor = pendente ? palette.accent : palette.neonGreen;
  const hora = inicio.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const dia = inicio.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });

  return (
    <Entrada index={0}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Próxima bateria ${dia} às ${hora}`}
        onPress={() => { tap(); router.push(`/reservations/${proxima.id}` as Href); }}
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 20, backgroundColor: palette.surface, borderWidth: 1, borderColor: cor, transform: [{ scale: pressed ? 0.98 : 1 }] })}>
        <View style={{ width: 62, alignItems: 'center', paddingVertical: 8, borderRadius: 14, backgroundColor: cor + '22' }}>
          <Text style={{ color: cor, fontSize: 11, fontWeight: '800', textTransform: 'uppercase' }}>{inicio.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}</Text>
          <Text style={{ color: palette.text, fontSize: 24, fontWeight: '900' }}>{inicio.getDate()}</Text>
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={{ color: cor, fontSize: 12, fontWeight: '800', letterSpacing: 1 }}>{pendente ? 'FALTA PAGAR' : 'SUA PRÓXIMA BATERIA'}</Text>
          <Text style={{ color: palette.text, fontSize: 18, fontWeight: '800' }}>{hora} · {quantoFalta(inicio, agora)}</Text>
          <Text numberOfLines={1} style={{ color: palette.textMuted, fontSize: 13 }}>{dia} · {proxima.quantidade} {proxima.quantidade === 1 ? 'vaga' : 'vagas'}</Text>
        </View>
        <Icon name="chevron" color={palette.textMuted} size={18} />
      </Pressable>
    </Entrada>
  );
}
