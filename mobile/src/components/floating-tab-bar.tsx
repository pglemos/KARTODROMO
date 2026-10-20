import React, { useEffect, useState } from 'react';
import {
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from 'expo-router/build/react-navigation/bottom-tabs/types';
import { DEMO_MODE, isDemoMode } from '../config/features';
import { SportsIcon, type SportsIconName } from './sports-icons';

export interface TabItemConfig {
  name: string;
  label: string;
  icon: SportsIconName;
}

const DEMO_TAB_ITEMS: readonly TabItemConfig[] = [
  { name: 'index', label: 'Home', icon: 'home' },
  { name: 'parceiros', label: 'Parceiros', icon: 'map-pin' },
  { name: 'livetime', label: 'LiveTime', icon: 'timer' },
  { name: 'agenda', label: 'Agenda', icon: 'calendar' },
  { name: 'carreira', label: 'Carreira', icon: 'helmet' },
] as const;

// Build de loja: só abas ligadas a dados reais (agenda, reservas, resultados, treino GPS).
const LIVE_TAB_ITEMS: readonly TabItemConfig[] = [
  { name: 'index', label: 'Início', icon: 'home' },
  { name: 'agenda', label: 'Agenda', icon: 'calendar' },
  { name: 'reservas', label: 'Reservas', icon: 'ticket' },
  { name: 'livetime', label: 'Ao vivo', icon: 'timer' },
  { name: 'resultados', label: 'Resultados', icon: 'trophy' },
] as const;

export function getTabBarItems(demo = isDemoMode()): readonly TabItemConfig[] {
  return demo ? DEMO_TAB_ITEMS : LIVE_TAB_ITEMS;
}

export const TAB_BAR_ITEMS: readonly TabItemConfig[] = DEMO_MODE ? DEMO_TAB_ITEMS : LIVE_TAB_ITEMS;

export const FLOATING_BAR_HEIGHT = 64;
export const FLOATING_CONTENT_PADDING = 120;
export const FLOATING_CONTENT_PADDING_WITH_CART = 170;

export interface FloatingTabBarCustomProps {
  activeTab?: string;
  onTabPress?: (tab: string) => void;
  testID?: string;
}

export type FloatingTabBarProps = Partial<BottomTabBarProps> & FloatingTabBarCustomProps;

export function FloatingTabBar(props: FloatingTabBarProps) {
  const { state, navigation, insets, activeTab, onTabPress, testID } = props;
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);
  const { width: windowWidth } = useWindowDimensions();
  const safeInsets = useSafeAreaInsets();

  const bottomInset = insets?.bottom ?? safeInsets.bottom ?? 0;

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false));

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  if (isKeyboardVisible) {
    return null;
  }

  const currentRoute =
    state?.routes && typeof state.index === 'number' ? state.routes[state.index] : undefined;
  const focusedRouteName = currentRoute?.name;

  const isLargeScreen = windowWidth > 512;
  const bottomPosition = Math.max(16, bottomInset) + 8;

  return (
    <>
      <View
        pointerEvents="none"
        style={[
          styles.bottomBackdrop,
          { height: bottomPosition + Math.round(FLOATING_BAR_HEIGHT * 0.55) },
        ]}
      />
      <View
        accessibilityRole="tablist"
        style={[
          styles.container,
          isLargeScreen
            ? { width: 480, alignSelf: 'center', bottom: bottomPosition }
            : { left: 16, right: 16, bottom: bottomPosition },
        ]}
        testID={testID ?? 'floating-bottom-tabs'}
      >
        {getTabBarItems().map((item) => {
          const isFocused =
            focusedRouteName === item.name ||
            (focusedRouteName === undefined &&
              activeTab !== undefined &&
              (activeTab.toLowerCase() === item.label.toLowerCase() ||
                activeTab.toLowerCase() === item.name.toLowerCase())) ||
            (activeTab !== undefined &&
              (activeTab.toLowerCase() === item.label.toLowerCase() ||
                activeTab.toLowerCase() === item.name.toLowerCase()));

          const route = state?.routes?.find((r) => r.name === item.name);

          const handlePress = () => {
            if (onTabPress) {
              onTabPress(item.label);
            }

            if (navigation && route) {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });

              if (!isFocused && !event.defaultPrevented) {
                navigation.navigate(route.name);
              }
            } else if (navigation) {
              // Fallback navigation
              (navigation as any).navigate(item.name);
            }
          };

          const handleLongPress = () => {
            if (navigation && route) {
              navigation.emit({
                type: 'tabLongPress',
                target: route.key,
              });
            }
          };

          return (
            <Pressable
              key={item.name}
              accessibilityRole="tab"
              accessibilityState={{ selected: !!isFocused }}
              accessibilityLabel={item.label}
              accessibilityHint={`Navega para a aba ${item.label}`}
              testID={`tab-${item.label.toLowerCase()}`}
              onPress={handlePress}
              onLongPress={handleLongPress}
              hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
              style={({ pressed }) => [
                styles.tabItem,
                isFocused && styles.tabItemActive,
                pressed && styles.tabItemPressed,
              ]}
            >
              {isFocused && (
                <View
                  testID="tab-active-indicator"
                  style={StyleSheet.absoluteFill}
                  pointerEvents="none"
                />
              )}
              <SportsIcon
                name={item.icon}
                size={22}
                color={isFocused ? '#FFFFFF' : '#A1A1AA'}
              />
              <Text
                style={[
                  styles.tabLabel,
                  isFocused ? styles.tabLabelActive : styles.tabLabelInactive,
                ]}
                numberOfLines={1}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  bottomBackdrop: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000000',
    zIndex: 95,
  },
  container: {
    position: 'absolute',
    height: FLOATING_BAR_HEIGHT,
    backgroundColor: '#16181B',
    borderRadius: 40,
    borderWidth: 1,
    borderColor: '#2B2E33',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
    paddingVertical: 4,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 12,
    zIndex: 100,
  },
  tabItem: {
    flex: 1,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 27,
    paddingVertical: 4,
    paddingHorizontal: 4,
    position: 'relative',
  },
  tabItemActive: {
    backgroundColor: '#35383E',
  },
  tabItemPressed: {
    opacity: 0.75,
  },
  tabLabel: {
    fontSize: 11,
    marginTop: 2,
    textAlign: 'center',
  },
  tabLabelActive: {
    color: '#FFFFFF',
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  tabLabelInactive: {
    color: '#D4D4D8',
    fontWeight: '400',
    letterSpacing: 0.2,
  },
});
