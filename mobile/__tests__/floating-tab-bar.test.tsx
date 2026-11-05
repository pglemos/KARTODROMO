import React from 'react';
import {
  Keyboard,
  Platform,
  useWindowDimensions,
  StyleSheet,
} from 'react-native';
import { render, fireEvent, act } from '@testing-library/react-native';
import {
  FloatingTabBar,
  TAB_BAR_ITEMS,
  FLOATING_BAR_HEIGHT,
  FLOATING_CONTENT_PADDING,
  FLOATING_CONTENT_PADDING_WITH_CART,
} from '../src/components/floating-tab-bar';

// Mock useSafeAreaInsets
const mockSafeAreaInsets = { top: 0, right: 0, bottom: 0, left: 0 };
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => mockSafeAreaInsets,
}));

// Helper to create mock react-navigation BottomTabBarProps
function createMockNavigationProps(initialRouteName = 'index', bottomInset = 0) {
  const routes = [
    { key: 'route-index', name: 'index', params: undefined },
    { key: 'route-parceiros', name: 'parceiros', params: undefined },
    { key: 'route-livetime', name: 'livetime', params: undefined },
    { key: 'route-agenda', name: 'agenda', params: undefined },
    { key: 'route-carreira', name: 'carreira', params: undefined },
    { key: 'route-reservas', name: 'reservas', params: undefined },
  ];

  const index = routes.findIndex((r) => r.name === initialRouteName);

  const navigation = {
    emit: jest.fn().mockReturnValue({ defaultPrevented: false }),
    navigate: jest.fn(),
    goBack: jest.fn(),
    dispatch: jest.fn(),
    reset: jest.fn(),
    isFocused: jest.fn().mockReturnValue(true),
    addListener: jest.fn(),
    removeListener: jest.fn(),
  };

  const descriptors = routes.reduce((acc, route) => {
    acc[route.key] = {
      options: { title: route.name },
      navigation: navigation as any,
      render: () => null,
      route,
    };
    return acc;
  }, {} as any);

  return {
    state: {
      index: index >= 0 ? index : 0,
      routes,
      key: 'tab-state-key',
      type: 'tab',
      stale: false,
      routeNames: routes.map((r) => r.name),
      history: [],
    } as any,
    descriptors,
    navigation: navigation as any,
    insets: { top: 0, right: 0, bottom: bottomInset, left: 0 },
  };
}

describe('FloatingTabBar - Milestone 1 Empirical Challenge Suite', () => {
  const originalPlatformOS = Platform.OS;

  afterEach(() => {
    jest.restoreAllMocks();
    mockSafeAreaInsets.bottom = 0;
    Platform.OS = originalPlatformOS;
  });

  // =========================================================================
  // Challenge 1: Route Rendering, Icons, and Labels (All 5 Destinations)
  // =========================================================================
  describe('1. Route Rendering, Icons and Labels', () => {
    it('declares exact 5 tabs with correct icons in TAB_BAR_ITEMS', () => {
      expect(TAB_BAR_ITEMS).toHaveLength(5);
      expect(TAB_BAR_ITEMS).toEqual([
        { name: 'index', label: 'Home', icon: 'home' },
        { name: 'parceiros', label: 'Parceiros', icon: 'map-pin' },
        { name: 'livetime', label: 'LiveTime', icon: 'timer' },
        { name: 'agenda', label: 'Agenda', icon: 'calendar' },
        { name: 'carreira', label: 'Carreira', icon: 'helmet' },
      ]);
    });

    it('renders all 5 tabs with their respective labels and sports icons', async () => {
      const navProps = createMockNavigationProps('index');
      const { getByTestId, getByText } = await render(<FloatingTabBar {...navProps} />);

      // Verify container
      expect(getByTestId('floating-bottom-tabs')).toBeTruthy();

      // Verify each of the 5 tabs
      for (const item of TAB_BAR_ITEMS) {
        const tabElement = getByTestId(`tab-${item.label.toLowerCase()}`);
        expect(tabElement).toBeTruthy();
        expect(getByText(item.label)).toBeTruthy();
        expect(getByTestId(`sports-icon-${item.icon}`)).toBeTruthy();
      }
    });

    it('renders active indicator ONLY on the focused tab', async () => {
      const navProps = createMockNavigationProps('livetime');
      const { getAllByTestId, getByTestId } = await render(<FloatingTabBar {...navProps} />);

      const activeIndicators = getAllByTestId('tab-active-indicator');
      expect(activeIndicators).toHaveLength(1);

      // Verify accessibilityState.selected
      const liveTab = getByTestId('tab-livetime');
      expect(liveTab.props.accessibilityState).toEqual({ selected: true });

      const homeTab = getByTestId('tab-home');
      expect(homeTab.props.accessibilityState).toEqual({ selected: false });
    });

    it('handles tab switching via navigation.navigate when pressing inactive tab', async () => {
      const navProps = createMockNavigationProps('index');
      const { getByTestId } = await render(<FloatingTabBar {...navProps} />);

      await fireEvent.press(getByTestId('tab-agenda'));

      expect(navProps.navigation.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'tabPress',
          target: 'route-agenda',
          canPreventDefault: true,
        })
      );
      expect(navProps.navigation.navigate).toHaveBeenCalledWith('agenda');
    });

    it('does NOT trigger navigation.navigate when pressing an ALREADY focused tab', async () => {
      const navProps = createMockNavigationProps('index');
      const { getByTestId } = await render(<FloatingTabBar {...navProps} />);

      await fireEvent.press(getByTestId('tab-home'));

      expect(navProps.navigation.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'tabPress',
          target: 'route-index',
          canPreventDefault: true,
        })
      );
      // Navigation.navigate should NOT be called to avoid redundant transitions
      expect(navProps.navigation.navigate).not.toHaveBeenCalled();
    });

    it('respects defaultPrevented when tabPress event is prevented by a listener', async () => {
      const navProps = createMockNavigationProps('index');
      navProps.navigation.emit.mockReturnValue({ defaultPrevented: true });

      const { getByTestId } = await render(<FloatingTabBar {...navProps} />);
      await fireEvent.press(getByTestId('tab-carreira'));

      expect(navProps.navigation.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'tabPress',
          target: 'route-carreira',
        })
      );
      expect(navProps.navigation.navigate).not.toHaveBeenCalled();
    });

    it('emits tabLongPress event on long press of a tab', async () => {
      const navProps = createMockNavigationProps('index');
      const { getByTestId } = await render(<FloatingTabBar {...navProps} />);

      await fireEvent(getByTestId('tab-parceiros'), 'onLongPress');

      expect(navProps.navigation.emit).toHaveBeenCalledWith({
        type: 'tabLongPress',
        target: 'route-parceiros',
      });
    });

    it('supports standalone mode with activeTab and onTabPress props', async () => {
      const onTabPress = jest.fn();
      const { getByTestId } = await render(
        <FloatingTabBar activeTab="Agenda" onTabPress={onTabPress} />
      );

      const agendaTab = getByTestId('tab-agenda');
      expect(agendaTab.props.accessibilityState).toEqual({ selected: true });

      await fireEvent.press(getByTestId('tab-carreira'));
      expect(onTabPress).toHaveBeenCalledWith('Carreira');
    });

    it('matches activeTab case-insensitively and by route name', async () => {
      const { getByTestId } = await render(<FloatingTabBar activeTab="index" />);
      expect(getByTestId('tab-home').props.accessibilityState).toEqual({ selected: true });

      const { getByTestId: getByTestId2 } = await render(<FloatingTabBar activeTab="LIVETIME" />);
      expect(getByTestId2('tab-livetime').props.accessibilityState).toEqual({ selected: true });
    });
  });

  // =========================================================================
  // Challenge 2: Responsive Layout Behavior & Clamping
  // =========================================================================
  describe('2. Responsive Layout Behavior & Screen Widths', () => {
    it('applies left: 16 and right: 16 on compact screens (320px)', async () => {
      const useDimensionsSpy = jest.spyOn(require('react-native'), 'useWindowDimensions');
      useDimensionsSpy.mockReturnValue({ width: 320, height: 568, scale: 2, fontScale: 1 });

      const navProps = createMockNavigationProps('index', 0);
      const { getByTestId } = await render(<FloatingTabBar {...navProps} />);

      const container = getByTestId('floating-bottom-tabs');
      const flattened = StyleSheet.flatten(container.props.style);

      expect(flattened.left).toBe(16);
      expect(flattened.right).toBe(16);
      expect(flattened.width).toBeUndefined(); // Stretches flexibly with margins
      expect(flattened.bottom).toBe(24); // Math.max(16, 0) + 8 = 24

      useDimensionsSpy.mockRestore();
    });

    it('applies left: 16 and right: 16 on standard mobile screen (390px)', async () => {
      const useDimensionsSpy = jest.spyOn(require('react-native'), 'useWindowDimensions');
      useDimensionsSpy.mockReturnValue({ width: 390, height: 844, scale: 3, fontScale: 1 });

      const navProps = createMockNavigationProps('index', 34);
      const { getByTestId } = await render(<FloatingTabBar {...navProps} />);

      const container = getByTestId('floating-bottom-tabs');
      const flattened = StyleSheet.flatten(container.props.style);

      expect(flattened.left).toBe(16);
      expect(flattened.right).toBe(16);
      expect(flattened.width).toBeUndefined();
      expect(flattened.bottom).toBe(42); // Math.max(16, 34) + 8 = 42

      useDimensionsSpy.mockRestore();
    });

    it('verifies boundary behavior at 512px and 513px', async () => {
      const useDimensionsSpy = jest.spyOn(require('react-native'), 'useWindowDimensions');

      // 512px: compact branch
      useDimensionsSpy.mockReturnValue({ width: 512, height: 800, scale: 2, fontScale: 1 });
      const { getByTestId: getAt512 } = await render(<FloatingTabBar activeTab="Home" />);
      const styleAt512 = StyleSheet.flatten(getAt512('floating-bottom-tabs').props.style);
      expect(styleAt512.left).toBe(16);
      expect(styleAt512.right).toBe(16);
      expect(styleAt512.width).toBeUndefined();

      // 513px: large screen clamped branch
      useDimensionsSpy.mockReturnValue({ width: 513, height: 800, scale: 2, fontScale: 1 });
      const { getByTestId: getAt513 } = await render(<FloatingTabBar activeTab="Home" />);
      const styleAt513 = StyleSheet.flatten(getAt513('floating-bottom-tabs').props.style);
      expect(styleAt513.width).toBe(480);
      expect(styleAt513.alignSelf).toBe('center');
      expect(styleAt513.left).toBeUndefined();
      expect(styleAt513.right).toBeUndefined();

      useDimensionsSpy.mockRestore();
    });

    it('clamps width to 480px on tablets and landscape screens (> 600px)', async () => {
      const useDimensionsSpy = jest.spyOn(require('react-native'), 'useWindowDimensions');

      const testWidths = [600, 768, 1024, 1280];
      for (const width of testWidths) {
        useDimensionsSpy.mockReturnValue({ width, height: 900, scale: 2, fontScale: 1 });

        const { getByTestId } = await render(<FloatingTabBar activeTab="Home" />);
        const container = getByTestId('floating-bottom-tabs');
        const flattened = StyleSheet.flatten(container.props.style);

        expect(flattened.width).toBe(480);
        expect(flattened.alignSelf).toBe('center');
        expect(flattened.left).toBeUndefined();
        expect(flattened.right).toBeUndefined();
      }

      useDimensionsSpy.mockRestore();
    });

    it('correctly adapts bottom position based on safe area insets', async () => {
      const testCases = [
        { inset: 0, expectedBottom: 24 }, // Math.max(16, 0) + 8 = 24
        { inset: 10, expectedBottom: 24 }, // Math.max(16, 10) + 8 = 24
        { inset: 16, expectedBottom: 24 }, // Math.max(16, 16) + 8 = 24
        { inset: 34, expectedBottom: 42 }, // Math.max(16, 34) + 8 = 42
        { inset: 50, expectedBottom: 58 }, // Math.max(16, 50) + 8 = 58
      ];

      for (const { inset, expectedBottom } of testCases) {
        const navProps = createMockNavigationProps('index', inset);
        const { getByTestId } = await render(<FloatingTabBar {...navProps} />);
        const style = StyleSheet.flatten(getByTestId('floating-bottom-tabs').props.style);
        expect(style.bottom).toBe(expectedBottom);
      }
    });

    it('exports proper layout constants matching design system specification', () => {
      expect(FLOATING_BAR_HEIGHT).toBe(64);
      expect(FLOATING_CONTENT_PADDING).toBe(120);
      expect(FLOATING_CONTENT_PADDING_WITH_CART).toBe(170);
    });
  });

  // =========================================================================
  // Challenge 3: Keyboard Event Listeners & Cleanup on Unmount
  // =========================================================================
  describe('3. Keyboard Event Listeners & Cleanup on Unmount', () => {
    it('subscribes to iOS keyboard events (keyboardWillShow / keyboardWillHide) on iOS', async () => {
      Platform.OS = 'ios';

      const addListenerSpy = jest.spyOn(Keyboard, 'addListener');
      const { unmount } = await render(<FloatingTabBar activeTab="Home" />);

      expect(addListenerSpy).toHaveBeenCalledWith('keyboardWillShow', expect.any(Function));
      expect(addListenerSpy).toHaveBeenCalledWith('keyboardWillHide', expect.any(Function));

      unmount();
      addListenerSpy.mockRestore();
    });

    it('subscribes to Android keyboard events (keyboardDidShow / keyboardDidHide) on Android', async () => {
      Platform.OS = 'android';

      const addListenerSpy = jest.spyOn(Keyboard, 'addListener');
      const { unmount } = await render(<FloatingTabBar activeTab="Home" />);

      expect(addListenerSpy).toHaveBeenCalledWith('keyboardDidShow', expect.any(Function));
      expect(addListenerSpy).toHaveBeenCalledWith('keyboardDidHide', expect.any(Function));

      unmount();
      addListenerSpy.mockRestore();
    });

    it('hides tab bar when keyboard appears and restores it when keyboard disappears', async () => {
      let showCallback: () => void = () => {};
      let hideCallback: () => void = () => {};

      jest.spyOn(Keyboard, 'addListener').mockImplementation((event: string, cb: any) => {
        if (event.includes('Show')) showCallback = cb;
        if (event.includes('Hide')) hideCallback = cb;
        return { remove: jest.fn() } as any;
      });

      const { queryByTestId } = await render(<FloatingTabBar activeTab="Home" />);

      // Initially visible
      expect(queryByTestId('floating-bottom-tabs')).toBeTruthy();

      // Keyboard shows -> tab bar hidden
      await act(async () => {
        showCallback();
      });
      expect(queryByTestId('floating-bottom-tabs')).toBeNull();

      // Keyboard hides -> tab bar restored
      await act(async () => {
        hideCallback();
      });
      expect(queryByTestId('floating-bottom-tabs')).toBeTruthy();
    });

    it('CLEANS UP event listeners properly on unmount (no memory leaks)', async () => {
      const showRemoveMock = jest.fn();
      const hideRemoveMock = jest.fn();

      jest.spyOn(Keyboard, 'addListener').mockImplementation((event: string) => {
        if (event.includes('Show')) {
          return { remove: showRemoveMock } as any;
        }
        return { remove: hideRemoveMock } as any;
      });

      const { unmount } = await render(<FloatingTabBar activeTab="Home" />);

      expect(showRemoveMock).not.toHaveBeenCalled();
      expect(hideRemoveMock).not.toHaveBeenCalled();

      // Trigger unmount
      await act(async () => {
        unmount();
      });

      expect(showRemoveMock).toHaveBeenCalledTimes(1);
      expect(hideRemoveMock).toHaveBeenCalledTimes(1);
    });

    it('keeps listeners active while hidden and properly cleans up if unmounted while keyboard is open', async () => {
      const showRemoveMock = jest.fn();
      const hideRemoveMock = jest.fn();
      let showCb: () => void = () => {};

      jest.spyOn(Keyboard, 'addListener').mockImplementation((event: string, cb: any) => {
        if (event.includes('Show')) {
          showCb = cb;
          return { remove: showRemoveMock } as any;
        }
        return { remove: hideRemoveMock } as any;
      });

      const { queryByTestId, unmount } = await render(<FloatingTabBar activeTab="Home" />);

      // Show keyboard -> component returns null
      await act(async () => {
        showCb();
      });
      expect(queryByTestId('floating-bottom-tabs')).toBeNull();

      // Ensure listeners have NOT been cleaned up prematurely
      expect(showRemoveMock).not.toHaveBeenCalled();
      expect(hideRemoveMock).not.toHaveBeenCalled();

      // Unmount while hidden
      await act(async () => {
        unmount();
      });

      // Cleanup MUST still occur even when unmounted while returning null
      expect(showRemoveMock).toHaveBeenCalledTimes(1);
      expect(hideRemoveMock).toHaveBeenCalledTimes(1);
    });
  });

  // =========================================================================
  // Challenge 4: Edge Cases, Resilience & Accessibility
  // =========================================================================
  describe('4. Edge Cases, Resilience & Accessibility', () => {
    it('handles undefined or malformed state gracefully without crashing', async () => {
      const { getByTestId } = await render(
        <FloatingTabBar state={undefined as any} navigation={undefined as any} />
      );
      expect(getByTestId('floating-bottom-tabs')).toBeTruthy();
    });

    it('handles active route that is not in the 5 main tabs (e.g. legacy reservas)', async () => {
      const navProps = createMockNavigationProps('reservas');
      const { getByTestId, queryByTestId } = await render(<FloatingTabBar {...navProps} />);

      // Bar renders all 5 main tabs
      expect(getByTestId('floating-bottom-tabs')).toBeTruthy();
      // But no tab is selected
      expect(queryByTestId('tab-active-indicator')).toBeNull();
      expect(getByTestId('tab-home').props.accessibilityState).toEqual({ selected: false });
    });

    it('renders accessibility attributes for screen readers correctly', async () => {
      const { getByTestId } = await render(<FloatingTabBar activeTab="LiveTime" />);

      const container = getByTestId('floating-bottom-tabs');
      expect(container.props.accessibilityRole).toBe('tablist');

      for (const item of TAB_BAR_ITEMS) {
        const tab = getByTestId(`tab-${item.label.toLowerCase()}`);
        expect(tab.props.accessibilityRole).toBe('tab');
        expect(tab.props.accessibilityLabel).toBe(item.label);
        expect(tab.props.accessibilityHint).toBe(`Navega para a aba ${item.label}`);
        expect(tab.props.hitSlop).toEqual({ top: 8, bottom: 8, left: 4, right: 4 });
      }
    });

    it('respects custom testID prop', async () => {
      const { getByTestId } = await render(
        <FloatingTabBar activeTab="Home" testID="custom-bottom-tabs" />
      );
      expect(getByTestId('custom-bottom-tabs')).toBeTruthy();
    });
  });
});
