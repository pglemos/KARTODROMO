import { demoOnly } from '../config/features';
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  StatusBar,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { SPORTS_PALETTE } from '../components/theme';
import { MOCK_COCKPIT_HUD_STATE } from '../mock/kart-data';
import type { CockpitHUDState } from '../types/racing';

export interface CockpitHUDScreenProps {
  onClose?: () => void;
  initialState?: CockpitHUDState;
}

function CockpitHUDScreen({
  onClose,
  initialState = MOCK_COCKPIT_HUD_STATE,
}: CockpitHUDScreenProps) {
  const [hud] = useState<CockpitHUDState>(initialState);
  const windowSize = useWindowDimensions();
  const [viewport, setViewport] = useState(windowSize);
  const { width, height } = viewport;
  const isPortrait = height > width && width > 0;
  const hudWidth = isPortrait ? height : width || 800;
  const hudHeight = isPortrait ? width : height || 380;

  const handleClose = () => {
    if (onClose) {
      onClose();
    } else if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/livetime');
    }
  };

  return (
    <SafeAreaView
      testID="cockpit-viewport"
      onLayout={({ nativeEvent: { layout } }) => setViewport((previous) =>
        previous.width === layout.width && previous.height === layout.height
          ? previous : { ...previous, width: layout.width, height: layout.height })}
      edges={isPortrait ? [] : ['top', 'bottom', 'left', 'right']}
      style={styles.safeArea}
    >
      <StatusBar barStyle="light-content" hidden />
      <View
        testID="screen-cockpit-hud"
        style={[
          styles.container,
          isPortrait && {
            position: 'absolute',
            flex: 0,
            width: hudWidth,
            height: hudHeight,
            left: (width - hudWidth) / 2,
            top: (height - hudHeight) / 2,
            transform: [{ rotate: '90deg' }],
          },
        ]}
      >
        {/* 1. Top Session Bar (Matches codex-clipboard-3341af7c) */}
        <View style={styles.topBar}>
          <Text style={[styles.sessionClock, styles.tabularNums]}>
            {hud.sessionElapsedTime}
          </Text>

          <Text style={[styles.lapBadgeText, styles.tabularNums]}>
            VOLTA {hud.currentLap}
          </Text>

          <View style={styles.topActions}>
            <Pressable
              testID="btn-close-cockpit"
              accessibilityRole="button"
              accessibilityLabel="Fechar Cockpit HUD"
              onPress={handleClose}
              style={({ pressed }) => [
                styles.closeBtn,
                pressed && { opacity: 0.7 },
              ]}
            >
              <Text style={styles.closeBtnText}>✕</Text>
            </Pressable>
          </View>
        </View>

        {/* 2. Upper-Middle Row: Position P1 in Center, Competitor Ahead on Right */}
        <View style={styles.upperMiddleRow}>
          <View style={styles.sideSpacer} />

          <View testID="cockpit-position-card" style={styles.posCard}>
            <Text
              testID="cockpit-current-position"
              style={[styles.posBigText, styles.tabularNums]}
            >
              {hud.currentPosition}
            </Text>
          </View>

          <View style={styles.aheadBox}>
            {hud.realtimeDelta.competitorAhead && (
              <>
                <Text style={[styles.aheadKartText, styles.tabularNums]}>
                  {hud.realtimeDelta.competitorAhead.kartNumber}
                </Text>
                <Text
                  style={[styles.aheadNameText, styles.tabularNums]}
                  numberOfLines={1}
                >
                  {hud.realtimeDelta.competitorAhead.name}
                </Text>
              </>
            )}
          </View>
        </View>

        {/* 3. Centerpiece Row: Giant Lap Timer (0:05.8) & Realtime Neon Delta (+0:30.121 ⬆) */}
        <View style={styles.centerTelemetryRow}>
          <View style={styles.sideSpacer} />

          <View testID="cockpit-timer-box" style={styles.timerCard}>
            <Text
              testID="cockpit-giant-timer"
              numberOfLines={1}
              adjustsFontSizeToFit
              style={[styles.giantTimerText, styles.tabularNums]}
            >
              {hud.currentLapTime}
            </Text>
          </View>

          <View testID="cockpit-delta-card" style={styles.deltaCard}>
            <Text
              testID="cockpit-delta-value"
              numberOfLines={1}
              style={[
                styles.deltaValueText,
                styles.tabularNums,
                {
                  color:
                    hud.realtimeDelta.trend === 'faster'
                      ? '#00FF00'
                      : SPORTS_PALETTE.neonRed,
                },
              ]}
            >
              {hud.realtimeDelta.value} ⬆
            </Text>
          </View>
        </View>

        {/* 4. Lower-Middle 3-Column Metrics Row: ÚLTIMA VOLTA | MELHOR VOLTA | DELTA P/ MELHOR */}
        <View style={styles.footerBar}>
          <View style={styles.footerMetric}>
            <Text style={[styles.footerColumnLabel, styles.tabularNums]}>
              ÚLTIMA VOLTA
            </Text>
            <View style={styles.lastLapValueRow}>
              <Text style={styles.redDownArrow}>⬇</Text>
              <Text style={[styles.footerMetricText, styles.tabularNums]}>
                {hud.lastLap.time}
              </Text>
              <Text style={styles.srOnly}>{`Última: ${hud.lastLap.time}`}</Text>
            </View>
          </View>

          <View style={styles.footerMetric}>
            <Text style={[styles.footerColumnLabel, styles.tabularNums]}>
              MELHOR VOLTA
            </Text>
            <Text style={[styles.footerMetricText, styles.tabularNums]}>
              {hud.bestLap.time}
            </Text>
            <Text style={styles.srOnly}>{`Melhor: ${hud.bestLap.time}`}</Text>
          </View>

          <View style={styles.footerMetric}>
            <Text style={[styles.footerColumnLabel, styles.tabularNums]}>
              DELTA P/ MELHOR
            </Text>
            <Text
              testID="cockpit-delta-best"
              style={[
                styles.footerMetricText,
                styles.tabularNums,
                {
                  color: hud.deltaBest.isImprovement
                    ? '#00FF00'
                    : '#FF1744',
                },
              ]}
            >
              {hud.deltaBest.value}
            </Text>
            <Text style={styles.srOnly}>{`Dif Melhor: ${hud.deltaBest.value}`}</Text>
          </View>
        </View>

        {/* 5. Bottom Driver Identification Footer */}
        <View style={styles.driverInfoFooter}>
          <Text
            testID="cockpit-driver-info"
            style={[styles.driverInfoText, styles.tabularNums]}
          >
            {hud.driverInfo.kartNumber} {hud.driverInfo.name}
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    flex: 1,
    width: '100%',
    backgroundColor: '#000000',
    paddingHorizontal: 32,
    paddingVertical: 18,
    justifyContent: 'space-between',
  },
  tabularNums: {
    fontVariant: ['tabular-nums'],
    fontFamily: Platform.select({
      ios: 'Menlo',
      android: 'monospace',
      default: 'monospace',
    }),
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sessionClock: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 1,
  },
  lapBadgeText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  topActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
  },
  iconBtn: {
    padding: 4,
  },
  closeBtn: {
    minWidth: 48,
    minHeight: 48,
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
  },
  upperMiddleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sideSpacer: {
    flex: 1,
  },
  posCard: {
    flex: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  posBigText: {
    color: '#FFFFFF',
    fontSize: 48,
    fontWeight: '900',
    letterSpacing: 1,
  },
  aheadBox: {
    flex: 1,
    alignItems: 'center',
  },
  aheadKartText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  aheadNameText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    marginTop: 2,
  },
  centerTelemetryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timerCard: {
    flex: 1.8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  giantTimerText: {
    color: '#FFFFFF',
    fontSize: 82,
    fontWeight: '900',
    letterSpacing: 2,
  },
  deltaCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deltaValueText: {
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  footerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  footerMetric: {
    flex: 1,
    alignItems: 'center',
  },
  footerColumnLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  lastLapValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  redDownArrow: {
    color: '#FF1744',
    fontSize: 20,
    fontWeight: '900',
  },
  footerMetricText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
  },
  driverInfoFooter: {
    alignItems: 'center',
    paddingTop: 2,
  },
  driverInfoText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  srOnly: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
  },
});

export default demoOnly(CockpitHUDScreen);
