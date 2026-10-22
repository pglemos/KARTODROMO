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
  bell: { ios: 'bell', android: 'notifications', web: 'notifications' },
  signal: { ios: 'dot.radiowaves.left.and.right', android: 'sensors', web: 'sensors' },
  people: { ios: 'person.2.fill', android: 'group', web: 'group' },
  clock: { ios: 'clock', android: 'schedule', web: 'schedule' },
  money: { ios: 'dollarsign.circle.fill', android: 'paid', web: 'paid' },
  pencil: { ios: 'pencil', android: 'edit', web: 'edit' },
  gear: { ios: 'gearshape', android: 'settings', web: 'settings' },
  card: { ios: 'creditcard', android: 'credit_card', web: 'credit_card' },
  tag: { ios: 'tag', android: 'sell', web: 'sell' },
  camera: { ios: 'camera.fill', android: 'photo_camera', web: 'photo_camera' },
  wallet: { ios: 'wallet.pass', android: 'account_balance_wallet', web: 'account_balance_wallet' },
  sun: { ios: 'sun.max.fill', android: 'wb_sunny', web: 'wb_sunny' },
  route: { ios: 'point.topleft.down.curvedto.point.bottomright.up', android: 'route', web: 'route' },
  gauge: { ios: 'gauge.with.needle', android: 'speed', web: 'speed' },
  send: { ios: 'paperplane', android: 'send', web: 'send' },
  helmet: { ios: 'helmet', android: 'sports_motorsports', web: 'sports_motorsports' },
  minus: { ios: 'minus', android: 'remove', web: 'remove' },
  plus: { ios: 'plus', android: 'add', web: 'add' },
  checkbox: { ios: 'checkmark.square.fill', android: 'check_box', web: 'check_box' },
  pin: { ios: 'mappin.and.ellipse', android: 'place', web: 'place' },
  chart: { ios: 'chart.bar.fill', android: 'bar_chart', web: 'bar_chart' },
  check2: { ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' },
  person: { ios: 'person.crop.circle', android: 'account_circle', web: 'account_circle' },
  pix: { ios: 'diamond.fill', android: 'pix', web: 'pix' },
  sector: { ios: 'scribble.variable', android: 'gesture', web: 'gesture' },
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
