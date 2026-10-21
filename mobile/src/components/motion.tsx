import * as Haptics from 'expo-haptics';
import type { PropsWithChildren } from 'react';
import { Platform } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

/** toque leve de confirmação nos botões principais (silencioso na web) */
export function tap() {
  if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
}

/** entrada em cascata: cada item sobe e aparece um pouco depois do anterior */
export function Entrada({ index = 0, children, style }: PropsWithChildren<{ index?: number; style?: object }>) {
  return (
    <Animated.View entering={FadeInDown.duration(380).delay(Math.min(index, 10) * 45).springify().damping(18)} style={style}>
      {children}
    </Animated.View>
  );
}
