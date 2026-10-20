import { Image, View, type ColorValue } from 'react-native';
import { SymbolView } from 'expo-symbols';

const symbols = {
  home: { ios: 'house', android: 'home', web: 'home' },
  calendar: { ios: 'calendar', android: 'calendar_month', web: 'calendar_month' },
  ticket: { ios: 'ticket', android: 'confirmation_number', web: 'confirmation_number' },
  results: { ios: 'flag.checkered', android: 'sports_score', web: 'sports_score' },
  gps: { ios: 'location', android: 'near_me', web: 'near_me' },
  account: { ios: 'person.crop.circle', android: 'account_circle', web: 'account_circle' },
  chevron: { ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' },
  back: { ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' },
  check: { ios: 'checkmark', android: 'check', web: 'check' },
  info: { ios: 'info.circle', android: 'info', web: 'info' },
  timer: { ios: 'stopwatch', android: 'timer', web: 'timer' },
} as const;

export function Icon({ name, color, size = 24 }: { name: keyof typeof symbols; color: ColorValue; size?: number }) {
  return <View accessible={false} importantForAccessibility="no-hide-descendants"><SymbolView name={symbols[name]} tintColor={color} size={size} style={{ width: size, height: size }} /></View>;
}

export function Brand({ width = 246 }: { width?: number }) {
  return (
    <View style={{ backgroundColor: '#FFFFFF', borderRadius: 6, padding: 6, alignSelf: 'flex-start', maxWidth: '100%', flexShrink: 1 }}>
      <Image accessibilityLabel="Kartódromo Internacional de Betim" source={require('../../assets/brand-logo.png')}
        resizeMode="contain" style={{ width, maxWidth: '100%', height: width * 420 / 1536 }} />
    </View>
  );
}
