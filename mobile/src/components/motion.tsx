import * as Haptics from 'expo-haptics';
import { useEffect, useState, type PropsWithChildren } from 'react';
import { Animated, Easing, Platform, View } from 'react-native';

/** toque leve de confirmação nos botões principais (silencioso na web) */
export function tap() {
  if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
}

/** entrada em cascata: cada item sobe e aparece um pouco depois do anterior */
export function Entrada({ index = 0, children, style }: PropsWithChildren<{ index?: number; style?: object }>) {
  const [progresso] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.timing(progresso, {
      toValue: 1,
      duration: 380,
      delay: Math.min(index, 10) * 45,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [index, progresso]);
  return (
    <Animated.View style={[style, { opacity: progresso, transform: [{ translateY: progresso.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }] }]}>
      {children}
    </Animated.View>
  );
}

/** bloco cinza que "respira" no lugar do conteúdo enquanto carrega (esqueleto) */
export function Esqueleto({ altura = 72, raio = 18, largura = '100%' as number | `${number}%` }: { altura?: number; raio?: number; largura?: number | `${number}%` }) {
  const [brilho] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(brilho, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(brilho, { toValue: 0, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: Platform.OS !== 'web' }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [brilho]);
  return <Animated.View style={{ width: largura, height: altura, borderRadius: raio, backgroundColor: 'rgba(255,255,255,0.08)', opacity: brilho.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1] }) }} />;
}

/** lista de esqueletos (cartões) para telas carregando */
export function ListaEsqueleto({ itens = 5, altura = 72, rotulo = 'Carregando' }: { itens?: number; altura?: number; rotulo?: string }) {
  return (
    <View accessibilityRole="progressbar" accessibilityLabel={rotulo} style={{ gap: 10, marginTop: 16 }}>
      {Array.from({ length: itens }, (_, i) => <Esqueleto key={i} altura={altura} />)}
    </View>
  );
}
