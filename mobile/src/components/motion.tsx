import * as Haptics from 'expo-haptics';
import { useEffect, useRef, type PropsWithChildren } from 'react';
import { Animated, Easing, Platform } from 'react-native';

/** toque leve de confirmação nos botões principais (silencioso na web) */
export function tap() {
  if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
}

/** entrada em cascata: cada item sobe e aparece um pouco depois do anterior */
export function Entrada({ index = 0, children, style }: PropsWithChildren<{ index?: number; style?: object }>) {
  const progresso = useRef(new Animated.Value(0)).current;
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
