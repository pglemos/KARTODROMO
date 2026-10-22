import { useContext, type ReactNode } from 'react';
import { Image, Text, View, type ImageSourcePropType } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

export const fotos = {
  inicio: require('../../assets/fotos/inicio.jpg'),
  agenda: require('../../assets/fotos/agenda.jpg'),
  reserva: require('../../assets/fotos/reserva.jpg'),
  aovivo: require('../../assets/fotos/aovivo.jpg'),
  carreira: require('../../assets/fotos/carreira.jpg'),
  evento: require('../../assets/fotos/evento.jpg'),
};

const FUNDO = '#050807';
const VERDE = '#2BF27A';

/** Esmaece a foto até o fundo da página, em faixas (sem biblioteca de degradê). */
export function Esmaecer({ lado, tamanho = 120 }: { lado: 'left' | 'bottom' | 'top'; tamanho?: number }) {
  const passos = 10;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', ...(lado === 'left' ? { left: 0, top: 0, bottom: 0, width: tamanho, flexDirection: 'row' } : lado === 'top' ? { left: 0, right: 0, top: 0, height: tamanho } : { left: 0, right: 0, bottom: 0, height: tamanho, flexDirection: 'column-reverse' }) }}>
      {Array.from({ length: passos }, (_, i) => (
        <View key={i} style={{ flex: 1, backgroundColor: FUNDO, opacity: lado === 'top' ? 1 - (i + 1) / passos : 1 - i / passos }} />
      ))}
    </View>
  );
}

/** Topo das telas no estilo das fotos: piloto à direita, rótulo espaçado, título itálico em duas cores. */
export function HeroFoto({ foto, rotulo, linha1, linha2, texto, altura = 360, topo, children }: {
  foto: ImageSourcePropType; rotulo: string; linha1: string; linha2?: string; texto?: string; altura?: number; topo?: ReactNode; children?: ReactNode;
}) {
  const insets = useContext(SafeAreaInsetsContext) ?? { top: 0 };
  return (
    <View style={{ minHeight: altura + insets.top, backgroundColor: FUNDO, overflow: 'hidden' }}>
      <View pointerEvents="none" style={{ position: 'absolute', right: 0, top: insets.top + 64, width: '100%', height: Math.min(300, altura - 40) }}>
        <Image source={foto} resizeMode="cover" style={{ width: '100%', height: '100%' }} accessibilityIgnoresInvertColors />
        <Esmaecer lado="left" tamanho={150} />
        <Esmaecer lado="bottom" tamanho={110} />
        <Esmaecer lado="top" tamanho={40} />
      </View>
      <View style={{ paddingTop: insets.top + 12, paddingHorizontal: 20, paddingBottom: 18, gap: 8 }}>
        {topo}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 22 }}>
          <Text style={{ color: '#C9D2CD', fontSize: 11, letterSpacing: 5, fontWeight: '600' }}>{rotulo}</Text>
          <View style={{ width: 44, height: 2, backgroundColor: VERDE }} />
        </View>
        <Text accessibilityRole="header" style={{ color: '#FFFFFF', fontSize: 50, lineHeight: 50, fontWeight: '900', fontStyle: 'italic', letterSpacing: -1, textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 12 }}>
          {linha1}{linha2 ? '\n' : ''}{linha2 ? <Text style={{ color: VERDE }}>{linha2}</Text> : null}
        </Text>
        {texto ? <Text style={{ color: '#D4DBD7', fontSize: 15, lineHeight: 21, maxWidth: 260, textShadowColor: 'rgba(0,0,0,0.8)', textShadowRadius: 8 }}>{texto}</Text> : null}
        {children}
      </View>
    </View>
  );
}
