import React, { useEffect, useState } from 'react';
import {
  Animated,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { tap } from './motion';
import type { BottomTabBarProps } from 'expo-router/build/react-navigation/bottom-tabs/types';
import { SportsIcon, type SportsIconName } from './sports-icons';
import { SPORTS_PALETTE } from './theme';

export interface TabItemConfig {
  name: string;
  label: string;
  icon: SportsIconName;
}

// Abas publicadas: todas apontam para telas ligadas à API/Worker real.
const LIVE_TAB_ITEMS: readonly TabItemConfig[] = [
  { name: 'index', label: 'Início', icon: 'home' },
  { name: 'agenda', label: 'Agenda', icon: 'calendar' },
  { name: 'reservas', label: 'Reservas', icon: 'ticket' },
  { name: 'livetime', label: 'Ao vivo', icon: 'timer' },
  { name: 'carreira', label: 'Carreira', icon: 'helmet' },
] as const;

export function getTabBarItems(_demo?: boolean): readonly TabItemConfig[] {
  return LIVE_TAB_ITEMS;
}

export const TAB_BAR_ITEMS: readonly TabItemConfig[] = LIVE_TAB_ITEMS;

export const FLOATING_BAR_HEIGHT = 64;
export const FLOATING_BAR_GAP = 16;
// Mantidos para consumidores/testes antigos; as telas usam o clearance dinâmico abaixo.
export const FLOATING_CONTENT_PADDING = 120;
export const FLOATING_CONTENT_PADDING_WITH_CART = 170;

function bottomPositionFor(bottomInset: number) {
  return Math.max(16, bottomInset) + 8;
}

/** Mantém folgas próprias de conteúdo sem duplicar a altura reservada pela barra. */
export function useFloatingTabBarClearance(extra = 0) {
  return Math.max(0, extra);
}

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
  const [larguraBarra, setLarguraBarra] = useState(0);
  const [pilula] = useState(() => new Animated.Value(0));
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

  const itens = getTabBarItems();
  const indiceAtivo = itens.findIndex((i) => i.name === focusedRouteName);
  const larguraItem = larguraBarra > 0 ? (larguraBarra - 12) / itens.length : 0;
  const isLargeScreen = windowWidth > 512;
  const bottomPosition = bottomPositionFor(bottomInset);

  return (
    <View testID="floating-tab-bar-reserved-area" pointerEvents="box-none" style={{ height: FLOATING_BAR_HEIGHT + bottomPosition + FLOATING_BAR_GAP }}>
      <View
        accessibilityRole="tablist"
        style={[
          styles.container,
          isLargeScreen
            ? { width: 480, alignSelf: 'center', bottom: bottomPosition }
            : { left: 16, right: 16, bottom: bottomPosition },
        ]}
        testID={testID ?? 'floating-bottom-tabs'}
        onLayout={(e) => setLarguraBarra(e.nativeEvent.layout.width)}
      >
        {/* vidro fosco no estilo do iOS */}
        <BlurView intensity={50} tint="dark" style={[StyleSheet.absoluteFill, { borderRadius: 40, overflow: 'hidden' }]} />
        {/* pílula da aba ativa que desliza até a aba tocada */}
        {indiceAtivo >= 0 ? <PilulaAtiva pilula={pilula} indice={indiceAtivo} largura={larguraItem} /> : null}
        {itens.map((item) => {
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
            tap();
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
                pressed && styles.tabItemPressed,
              ]}
            >
              <SportsIcon
                name={item.icon}
                size={22}
                color={isFocused ? SPORTS_PALETTE.accent : SPORTS_PALETTE.muted}
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
    </View>
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
    // no Android o desfoque não vale por padrão: fundo quase opaco para o texto não vazar
    backgroundColor: Platform.OS === 'ios' ? 'rgba(22, 24, 27, 0.72)' : 'rgba(22, 24, 27, 0.96)',
    borderRadius: 40,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
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
    color: SPORTS_PALETTE.accent,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  tabLabelInactive: {
    color: SPORTS_PALETTE.textSecondary,
    fontWeight: '400',
    letterSpacing: 0.2,
  },
});

/** pílula clara atrás da aba ativa; desliza com mola quando a aba muda */
function PilulaAtiva({ pilula, indice, largura }: { pilula: Animated.Value; indice: number; largura: number }) {
  useEffect(() => {
    Animated.spring(pilula, { toValue: indice * largura, useNativeDriver: true, damping: 18, stiffness: 190, mass: 0.8 }).start();
  }, [indice, largura, pilula]);
  return (
    <Animated.View pointerEvents="none" testID="tab-active-indicator"
      style={{ position: 'absolute', left: 6, top: 5, bottom: 5, width: largura, borderRadius: 27, backgroundColor: SPORTS_PALETTE.navActivePill, transform: [{ translateX: pilula }] }} />
  );
}
