import React from 'react';
import { View, StyleSheet, type ColorValue, type StyleProp, type ViewStyle } from 'react-native';
import { SymbolView, type AndroidSymbol, type SFSymbol } from 'expo-symbols';

export type SportsIconName =
  | 'home'
  | 'map-pin'
  | 'track'
  | 'stopwatch'
  | 'timer'
  | 'calendar'
  | 'helmet'
  | 'trophy'
  | 'crosshair'
  | 'target'
  | 'flame'
  | 'star'
  | 'crown'
  | 'cart'
  | 'flag'
  | 'sparkle'
  | 'moon'
  | 'arrow-up'
  | 'cloud-rain'
  | 'chevron-right'
  | 'chevron-left'
  | 'back'
  | 'check'
  | 'info'
  | 'close'
  | 'search'
  | 'refresh'
  | 'heart'
  | 'share'
  | 'diamond'
  | 'steeringwheel'
  | 'phone'
  | 'ticket';

export interface MultiPlatformSymbol {
  ios: SFSymbol;
  android: AndroidSymbol;
  web: AndroidSymbol;
}

export const SPORTS_SYMBOLS_MAP: Record<SportsIconName, MultiPlatformSymbol> = {
  home: { ios: 'house.fill', android: 'home', web: 'home' },
  'map-pin': { ios: 'mappin.and.ellipse', android: 'location_on', web: 'location_on' },
  track: { ios: 'mappin.and.ellipse', android: 'location_on', web: 'location_on' },
  stopwatch: { ios: 'stopwatch.fill', android: 'timer', web: 'timer' },
  timer: { ios: 'stopwatch.fill', android: 'timer', web: 'timer' },
  calendar: { ios: 'calendar', android: 'calendar_month', web: 'calendar_month' },
  helmet: { ios: 'helmet.fill', android: 'sports_motorsports', web: 'sports_motorsports' },
  trophy: { ios: 'trophy.fill', android: 'trophy', web: 'trophy' },
  crosshair: { ios: 'target', android: 'target', web: 'target' },
  target: { ios: 'target', android: 'target', web: 'target' },
  flame: { ios: 'flame.fill', android: 'local_fire_department', web: 'local_fire_department' },
  star: { ios: 'star.fill', android: 'star', web: 'star' },
  crown: { ios: 'crown.fill', android: 'crown', web: 'crown' },
  cart: { ios: 'cart.fill', android: 'shopping_cart', web: 'shopping_cart' },
  flag: { ios: 'flag.checkered', android: 'sports_score', web: 'sports_score' },
  sparkle: { ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' },
  moon: { ios: 'moon.stars.fill', android: 'bedtime', web: 'bedtime' },
  'arrow-up': { ios: 'arrow.up.right', android: 'trending_up', web: 'trending_up' },
  'cloud-rain': { ios: 'cloud.rain.fill', android: 'rainy', web: 'rainy' },
  'chevron-right': { ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' },
  'chevron-left': { ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' },
  back: { ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' },
  check: { ios: 'checkmark', android: 'check', web: 'check' },
  info: { ios: 'info.circle', android: 'info', web: 'info' },
  close: { ios: 'xmark', android: 'close', web: 'close' },
  search: { ios: 'magnifyingglass', android: 'search', web: 'search' },
  refresh: { ios: 'arrow.clockwise', android: 'refresh', web: 'refresh' },
  heart: { ios: 'heart.fill', android: 'favorite', web: 'favorite' },
  share: { ios: 'square.and.arrow.up', android: 'share', web: 'share' },
  diamond: { ios: 'diamond.fill', android: 'diamond', web: 'diamond' },
  steeringwheel: { ios: 'steeringwheel', android: 'sports_motorsports', web: 'sports_motorsports' },
  phone: { ios: 'phone.fill', android: 'phone', web: 'phone' },
  ticket: { ios: 'ticket.fill', android: 'confirmation_number', web: 'confirmation_number' },
};

export interface SportsIconProps {
  name: SportsIconName;
  color?: ColorValue;
  size?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  accessibilityLabel?: string;
}

export function SportsIcon({
  name,
  color = '#FFFFFF',
  size = 20,
  style,
  testID,
  accessibilityLabel,
}: SportsIconProps) {
  const symbol = SPORTS_SYMBOLS_MAP[name] ?? SPORTS_SYMBOLS_MAP.home;

  return (
    <View
      testID={testID ?? `sports-icon-${name}`}
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel ?? name}
      style={[styles.container, { width: size, height: size }, style]}
    >
      <SymbolView
        name={symbol}
        tintColor={color}
        size={size}
        style={{ width: size, height: size }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
