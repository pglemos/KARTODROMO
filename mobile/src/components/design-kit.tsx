import { createContext, useContext, type ReactNode } from 'react';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { Image, Pressable, Text, View, useWindowDimensions, type ImageSourcePropType, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

/**
 * Medidas do design: as telas foram desenhadas com 852 px de largura. Toda medida aqui é em "px do desenho" e vira
 * pontos multiplicando por k = largura da tela / 852, então a tela fica igual ao desenho em qualquer celular.
 */
export const LARGURA_DESENHO = 852;
const Escala = createContext(390 / LARGURA_DESENHO);

/** margem do topo (barra de status); zero fora do provedor, como nos testes */
export function useTopo() {
  return useContext(SafeAreaInsetsContext)?.top ?? 0;
}

export function useK() {
  const { width } = useWindowDimensions();
  const padrao = useContext(Escala);
  const k = Math.min(width, 520) / LARGURA_DESENHO;
  return k > 0 ? k : padrao;
}

/** fornece a escala para os filhos (largura limitada em tablets para não esticar o desenho) */
export function Desenho({ children }: { children: ReactNode }) {
  const { width } = useWindowDimensions();
  return <Escala.Provider value={Math.min(width, 520) / LARGURA_DESENHO}>{children}</Escala.Provider>;
}

export const cor = {
  fundo: '#050706',
  cartao: '#0D1110',
  cartao2: '#121716',
  borda: '#252B28',
  verde: '#22E06B',
  verdeEscuro: '#0E4A27',
  texto: '#FFFFFF',
  texto2: '#C9CFCC',
  texto3: '#9DA5A1',
  roxo: '#7C4DFF',
  ouro: '#F5B729',
};

/** a letra dos títulos do desenho é mais larga que a Barlow: esticamos na horizontal */
export const LARGO = 1.25;

export const fonte = { display: 'Display', tempo: 'Tempo', tempoBold: 'TempoBold', tempoItalic: 'TempoItalic' };

/** caixa posicionada no desenho: x, y, largura e altura em px do desenho */
export function Caixa({ x, y, w, h, style, children, pointerEvents }: { x: number; y: number; w?: number; h?: number; style?: StyleProp<ViewStyle>; children?: ReactNode; pointerEvents?: 'none' | 'auto' | 'box-none' }) {
  const k = useK();
  return <View pointerEvents={pointerEvents} style={[{ position: 'absolute', left: x * k, top: y * k, width: w === undefined ? undefined : w * k, height: h === undefined ? undefined : h * k }, style]}>{children}</View>;
}

/** área tocável posicionada no desenho */
export function Toque({ x, y, w, h, onPress, rotulo, style, children }: { x: number; y: number; w: number; h: number; onPress: () => void; rotulo: string; style?: StyleProp<ViewStyle>; children?: ReactNode }) {
  const k = useK();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={rotulo}
      style={({ pressed }) => [{ position: 'absolute', left: x * k, top: y * k, width: w * k, height: h * k, opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] }, style]}>
      {children}
    </Pressable>
  );
}

/** texto com tamanho em px do desenho */
export function T({ s, c = cor.texto, f, p, style, children, linhas, lh, largo, testID }: { testID?: string; s: number; c?: string; f?: string; p?: TextStyle['fontWeight']; style?: StyleProp<TextStyle>; children: ReactNode; linhas?: number; lh?: number; largo?: number }) {
  const k = useK();
  return (
    <Text testID={testID} numberOfLines={linhas} style={[{ color: c, fontSize: s * k, fontFamily: f, fontWeight: f ? undefined : p, lineHeight: lh ? lh * k : undefined, includeFontPadding: false }, largo ? { transform: [{ scaleX: largo }], transformOrigin: 'left top' } : null, style]}>
      {children}
    </Text>
  );
}

/** foto de fundo recortada do desenho, ocupando a caixa inteira */
export function Foto({ fonte: src, raio = 0, opacidade = 1 }: { fonte: ImageSourcePropType; raio?: number; opacidade?: number }) {
  const k = useK();
  return <Image source={src} resizeMode="cover" accessibilityIgnoresInvertColors style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, width: '100%', height: '100%', borderRadius: raio * k, opacity: opacidade }} />;
}

export const fundos = {
  inicioTopo: require('../../assets/design/inicio-topo.jpg'),
  inicioEvento: require('../../assets/design/inicio-evento.jpg'),
  inicioCarreira: require('../../assets/design/inicio-carreira.jpg'),
  inicioCupons: require('../../assets/design/inicio-cupons.jpg'),
  inicioKarts: require('../../assets/design/inicio-karts.jpg'),
  inicioPilotar: require('../../assets/design/inicio-pilotar.jpg'),
  carreiraTopo: require('../../assets/design/carreira-topo.jpg'),
  tileProgresso: require('../../assets/design/tile-progresso.jpg'),
  tileConquistas: require('../../assets/design/tile-conquistas.jpg'),
  tileDesafios: require('../../assets/design/tile-desafios.jpg'),
  tileMetas: require('../../assets/design/tile-metas.jpg'),
  tileKarts: require('../../assets/design/tile-karts.jpg'),
  tileModo: require('../../assets/design/tile-modo.jpg'),
  ultimaAtividade: require('../../assets/design/ultima-atividade.jpg'),
  agendaTopo: require('../../assets/design/agenda-topo.jpg'),
  agendaCartao: require('../../assets/design/agenda-cartao.jpg'),
  reservaTopo: require('../../assets/design/reserva-topo.jpg'),
  reservaData: require('../../assets/design/reserva-data.jpg'),
  aovivoTopo: require('../../assets/design/aovivo-topo.jpg'),
  aovivoRapida: require('../../assets/design/aovivo-rapida.jpg'),
};

/** botão redondo com seta (">" dentro de um círculo com borda), usado nos cartões */
export function SetaCirculo({ x, y, d = 40, children }: { x: number; y: number; d?: number; children: ReactNode }) {
  return (
    <Caixa x={x} y={y} w={d} h={d} pointerEvents="none" style={{ borderRadius: 999, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.85)', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.35)' }}>
      {children}
    </Caixa>
  );
}
