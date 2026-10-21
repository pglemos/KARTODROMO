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
  trophy: { ios: 'trophy.fill', android: 'emoji_events', web: 'emoji_events' },
  medal: { ios: 'medal.fill', android: 'military_tech', web: 'military_tech' },
  bolt: { ios: 'bolt.fill', android: 'bolt', web: 'bolt' },
  target: { ios: 'scope', android: 'my_location', web: 'my_location' },
  fire: { ios: 'flame.fill', android: 'local_fire_department', web: 'local_fire_department' },
  crown: { ios: 'crown.fill', android: 'workspace_premium', web: 'workspace_premium' },
  star: { ios: 'star.fill', android: 'star', web: 'star' },
  flag: { ios: 'flag.checkered', android: 'sports_score', web: 'sports_score' },
  search: { ios: 'magnifyingglass', android: 'search', web: 'search' },
  close: { ios: 'xmark', android: 'close', web: 'close' },
  lock: { ios: 'lock.fill', android: 'lock', web: 'lock' },
  podium: { ios: 'chart.bar.fill', android: 'leaderboard', web: 'leaderboard' },
} as const;

export function Icon({ name, color, size = 24 }: { name: keyof typeof symbols; color: ColorValue; size?: number }) {
  return <View accessible={false} importantForAccessibility="no-hide-descendants"><SymbolView name={symbols[name]} tintColor={color} size={size} style={{ width: size, height: size }} /></View>;
}

export function Brand({ width = 246 }: { width?: number }) {
  return (
    <View style={{ alignSelf: 'flex-start', maxWidth: '100%', flexShrink: 1 }}>
      <Image accessibilityLabel="Kartódromo Internacional de Betim" source={require('../../assets/brand-logo-dark.png')}
        resizeMode="contain" style={{ width, maxWidth: '100%', height: width * 420 / 1536 }} />
    </View>
  );
}
