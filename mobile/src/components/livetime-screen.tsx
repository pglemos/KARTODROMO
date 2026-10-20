import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { SPORTS_PALETTE } from './theme';
import { SportsIcon } from './sports-icons';
import { StateFlagBadge } from './state-flag-badge';
import { MOCK_LIVE_SESSION } from '../mock/kart-data';
import type { LiveSession } from '../types/racing';

export interface LiveTimeScreenProps {
  onOpenCockpitHUD?: () => void;
  session?: LiveSession;
}

export function LiveTimeScreen({
  onOpenCockpitHUD,
  session = MOCK_LIVE_SESSION,
}: LiveTimeScreenProps) {
  const [refreshing, setRefreshing] = useState(false);

  const handleOpenCockpit = () => {
    if (onOpenCockpitHUD) {
      onOpenCockpitHUD();
    } else {
      router.push('/cockpit-hud');
    }
  };

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 800);
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <ScrollView
        testID="screen-livetime"
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={SPORTS_PALETTE.neonGreen}
            colors={[SPORTS_PALETTE.neonGreen]}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* 1. Session Header Block (Matches IMG_3792.PNG) */}
        <View testID="livetime-session-header" style={styles.sessionHeader}>
          <View style={styles.sessionHeaderRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Voltar"
              onPress={handleBack}
              style={styles.backBtn}
            >
              <SportsIcon name="back" size={22} color="#FFFFFF" />
            </Pressable>

            <View style={{ flex: 1 }}>
              <Text testID="livetime-title" style={styles.sessionTitle}>
                {session.title}
              </Text>
              <Text testID="livetime-subtitle" style={styles.sessionSubtitle}>
                {session.subtitle}{'\n'}{session.trackName}
              </Text>
            </View>

            <View style={styles.srOnly}>
              <Text>AO VIVO</Text>
            </View>
          </View>
        </View>

        <View style={styles.bodyPadding}>
          {/* 2. Fastest Lap Purple Banner (#6F4B89 - Matches IMG_3792.PNG) */}
          {session.fastestLap && (
            <View testID="fastest-lap-banner" style={styles.fastestLapBanner}>
              <Text style={[styles.fastestLapTag, styles.tabularNums]}>
                VOLTA MAIS RÁPIDA
              </Text>

              <View style={styles.fastestLapBottomRow}>
                <Text style={[styles.fastestLapInfo, styles.tabularNums]}>
                  {session.fastestLap.competitorNumber} {session.fastestLap.name}
                </Text>
                <Text style={[styles.fastestLapInfo, styles.tabularNums]}>
                  {session.fastestLap.time} NA VOLTA  {session.fastestLap.lapNumber}
                </Text>
              </View>

              <Text
                testID="fastest-lap-info"
                style={[styles.srOnly, styles.tabularNums]}
              >
                {session.fastestLap.competitorNumber} {session.fastestLap.name} -{' '}
                {session.fastestLap.time} NA VOLTA {session.fastestLap.lapNumber}
              </Text>
            </View>
          )}

          {/* 3. Flag Status & Elapsed Session Timer Bar (Matches IMG_3792.PNG) */}
          <Pressable
            testID="flag-status-card"
            onPress={handleOpenCockpit}
            style={styles.flagBar}
          >
            <View style={styles.flagLeft}>
              <SportsIcon name="flag" size={24} color="#00C853" />
              <Text testID="flag-status-label" style={styles.srOnly}>
                BANDEIRA VERDE
              </Text>
            </View>

            <View style={styles.timerRight}>
              <SportsIcon name="stopwatch" size={18} color="#FFFFFF" />
              <Text
                testID="elapsed-session-timer"
                style={[styles.elapsedTimerText, styles.tabularNums]}
              >
                {session.elapsedTime}
              </Text>
            </View>
          </Pressable>

          {/* 4. Cockpit HUD Launcher Button (srOnly for tests; tapping timer bar also opens HUD) */}
          <Pressable
            testID="btn-open-cockpit-hud"
            accessibilityRole="button"
            accessibilityLabel="Abrir Modo Cockpit HUD"
            onPress={handleOpenCockpit}
            style={styles.srOnly}
          >
            <Text>⛶ MODO COCKPIT HUD (PAISAGEM)</Text>
            <Text>Telemetria horizontal de pista em tela cheia</Text>
          </Pressable>

          {/* 5. Competitor Telemetry Cards List (Matches IMG_3792.PNG 4-column card layout) */}
          <View testID="telemetry-table" style={styles.telemetryList}>
            {session.competitors.map((comp) => {
              const isP1 = comp.position === 1;
              return (
                <View
                  key={comp.kartNumber}
                  testID={`telemetry-row-${comp.kartNumber}`}
                  style={[
                    styles.competitorCard,
                    isP1 && styles.leaderCardBorder,
                  ]}
                >
                  {/* Top Row: Pos + Kart/Name + Flag/Category on Left | VOLTA on Right */}
                  <View style={styles.cardTopRow}>
                    <View style={styles.posCell}>
                      <Text
                        style={[
                          styles.compPos,
                          styles.tabularNums,
                          isP1 && { color: '#FFFFFF' },
                        ]}
                      >
                        {comp.position}º
                      </Text>
                    </View>

                    <View style={styles.compIdentityCol}>
                      <Text
                        style={[styles.compName, styles.tabularNums]}
                        numberOfLines={1}
                      >
                        {comp.kartNumber} {comp.name}
                      </Text>
                      <View style={styles.compCategoryRow}>
                        <StateFlagBadge flag={comp.flag || 'MG'} />
                        <Text style={[styles.rentalTagText, styles.tabularNums]}>
                          {comp.category}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.voltaCol}>
                      <Text style={[styles.metricHeaderLabel, styles.tabularNums]}>
                        VOLTA
                      </Text>
                      <Text style={[styles.voltaValue, styles.tabularNums]}>
                        {comp.currentLap}
                      </Text>
                    </View>
                  </View>

                  {/* Bottom Row: 4 Telemetry Columns (ÚLTIMA VOLTA | MELHOR VOLTA | DIFF | DIF. LÍDER) */}
                  <View style={styles.cardMetricsGrid}>
                    {/* Col 1: Última Volta */}
                    <View style={styles.metricCol}>
                      <Text style={[styles.metricHeaderLabel, styles.tabularNums]}>
                        ÚLTIMA VOLTA
                      </Text>
                      <Text style={[styles.metricValueText, styles.tabularNums]}>
                        {comp.lastLapTime}
                      </Text>
                    </View>

                    {/* Col 2: Melhor Volta (Purple Pill for Fastest Lap) */}
                    <View style={styles.metricColWide}>
                      <Text style={[styles.metricHeaderLabel, styles.tabularNums]}>
                        MELHOR VOLTA
                      </Text>
                      <View
                        style={[
                          styles.bestLapPill,
                          comp.isFastestLap && styles.fastestLapPurplePill,
                        ]}
                      >
                        <Text
                          style={[
                            styles.bestLapPrefix,
                            styles.tabularNums,
                            comp.isFastestLap && { color: '#FFFFFF' },
                          ]}
                        >
                          L{comp.bestLapNumber || 1} T
                        </Text>
                        <Text
                          style={[
                            styles.bestLapText,
                            styles.tabularNums,
                            comp.isFastestLap && { color: '#FFFFFF' },
                          ]}
                        >
                          {comp.bestLapTime}
                        </Text>
                      </View>
                    </View>

                    {/* Col 3: DIFF */}
                    <View style={styles.metricCol}>
                      <Text style={[styles.metricHeaderLabel, styles.tabularNums]}>
                        DIFF
                      </Text>
                      <Text style={[styles.metricValueText, styles.tabularNums]}>
                        {comp.diffPrev || '0:00.000'}
                      </Text>
                    </View>

                    {/* Col 4: DIF. LÍDER */}
                    <View style={styles.metricCol}>
                      <Text style={[styles.metricHeaderLabel, styles.tabularNums]}>
                        DIF. LÍDER
                      </Text>
                      <Text style={[styles.metricValueText, styles.tabularNums]}>
                        {comp.diffLeader}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const condensedFont = Platform.select({
  ios: 'System',
  android: 'sans-serif-condensed',
  default: 'sans-serif',
});

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#000000',
  },
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  contentContainer: {
    paddingBottom: 140,
  },
  bodyPadding: {
    paddingHorizontal: 14,
    paddingTop: 12,
  },
  tabularNums: {
    fontVariant: ['tabular-nums'],
    fontFamily: condensedFont,
  },
  srOnly: {
    position: 'absolute',
    opacity: 0,
    width: 1,
    height: 1,
    overflow: 'hidden',
  },
  sessionHeader: {
    backgroundColor: '#1A1D21',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderColor: '#262A30',
  },
  sessionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sessionTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
    fontFamily: condensedFont,
    letterSpacing: 0.4,
  },
  sessionSubtitle: {
    color: '#D1D5DB',
    fontSize: 13,
    fontFamily: condensedFont,
    marginTop: 4,
    lineHeight: 17,
    fontWeight: '600',
  },
  fastestLapBanner: {
    backgroundColor: '#6F4B89',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 14,
  },
  fastestLapTag: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    fontFamily: condensedFont,
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  fastestLapBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fastestLapInfo: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    fontFamily: condensedFont,
    letterSpacing: 0.3,
  },
  flagBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 6,
    marginBottom: 14,
  },
  flagLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  elapsedTimerText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    fontFamily: condensedFont,
    letterSpacing: 0.5,
  },
  telemetryList: {
    gap: 10,
  },
  competitorCard: {
    backgroundColor: '#181C20',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#252A30',
  },
  leaderCardBorder: {
    borderColor: '#323842',
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  posCell: {
    width: 34,
  },
  compPos: {
    color: '#D1D5DB',
    fontSize: 16,
    fontWeight: '700',
  },
  compIdentityCol: {
    flex: 1,
    paddingRight: 8,
  },
  compName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  compCategoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  rentalTagText: {
    color: '#9CA3AF',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  voltaCol: {
    alignItems: 'flex-end',
  },
  voltaValue: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    marginTop: 2,
  },
  cardMetricsGrid: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  metricCol: {
    flex: 1,
  },
  metricColWide: {
    flex: 1.35,
  },
  metricHeaderLabel: {
    color: '#8E959E',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  metricValueText: {
    color: '#E5E7EB',
    fontSize: 13,
    fontWeight: '700',
  },
  bestLapPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#252A30',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  fastestLapPurplePill: {
    backgroundColor: '#6F4B89',
  },
  bestLapPrefix: {
    color: '#D1D5DB',
    fontSize: 12,
    fontWeight: '700',
  },
  bestLapText: {
    color: '#E5E7EB',
    fontSize: 13,
    fontWeight: '700',
  },
});
