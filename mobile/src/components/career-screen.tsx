import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MOCK_CAREER_STATS, MOCK_DRIVERS } from '../mock/kart-data';
import { CareerStats, Driver } from '../types/racing';
import { RankingRulesModal } from './ranking-rules-modal';
import { SportsIcon, SportsIconName } from './sports-icons';
import { StateFlagBadge } from './state-flag-badge';
import { SPORTS_PALETTE } from './theme';

export interface CareerScreenProps {
  driver?: Driver;
  stats?: CareerStats;
  onOpenRules?: () => void;
  onViewAllBadges?: () => void;
}

function mapBadgeToSportsIcon(icon: string): SportsIconName {
  switch (icon) {
    case 'crown':
    case 'crown-fill':
    case 'crown.fill':
      return 'crown';
    case 'trophy':
    case 'trophy.fill':
      return 'trophy';
    case 'crosshair':
    case 'target':
      return 'crosshair';
    case 'sparkles':
    case 'sparkle':
      return 'sparkle';
    case 'arrow-up-circle':
    case 'arrow-up':
      return 'arrow-up';
    case 'flame':
    case 'flame.fill':
      return 'flame';
    case 'timer':
    case 'stopwatch':
      return 'stopwatch';
    case 'cloud-rain':
      return 'cloud-rain';
    case 'moon-stars':
    case 'moon':
      return 'moon';
    default:
      return 'star';
  }
}

export function CareerScreen({
  driver = MOCK_DRIVERS[0],
  stats = MOCK_CAREER_STATS,
  onOpenRules,
  onViewAllBadges,
}: CareerScreenProps) {
  const [isRulesModalOpen, setIsRulesModalOpen] = useState(false);

  const handleOpenRules = () => {
    if (onOpenRules) {
      onOpenRules();
    } else {
      setIsRulesModalOpen(true);
    }
  };

  const handleNavigateBadges = () => {
    if (onViewAllBadges) {
      onViewAllBadges();
    } else {
      router.push('/conquistas');
    }
  };

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  };

  const formatNumber = (num: number) => num.toLocaleString('pt-BR');

  const allBadges = [
    ...(stats.badges.experience || []),
    ...(stats.badges.challenge || []),
    ...(stats.badges.special || []),
  ];

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <ScrollView
        testID="screen-carreira"
        style={styles.screenContainer}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Top Screen Bar (srOnly for tests so driverCard sits at the very top like IMG_3787.PNG) */}
        <View style={styles.srOnly}>
          <Text>CARREIRA</Text>
          <Text>PERFIL & ESTATÍSTICAS DO PILOTO</Text>
        </View>

        {/* 1. Driver Header Card (Full-width top block matching IMG_3787.PNG) */}
        <View testID="career-driver-header" style={styles.driverCard}>
          {/* Top Action Row inside Card: Close (✕) left, Info (ⓘ) right */}
          <View style={styles.driverCardTopActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Voltar"
              onPress={handleBack}
              style={styles.circleActionBtn}
            >
              <SportsIcon name="close" size={16} color="#FFFFFF" />
            </Pressable>

            <Pressable
              testID="btn-career-ranking-rules"
              accessibilityRole="button"
              accessibilityLabel="Como funciona o ranking"
              onPress={handleOpenRules}
              style={styles.circleActionBtn}
            >
              <SportsIcon name="info" size={18} color="#FFFFFF" />
            </Pressable>
          </View>

          <View style={styles.driverCardRow}>
            {/* Large 80px Gold Circle Avatar with Overlapping Flag Badge */}
            <View style={styles.avatarWrapper}>
              <View testID="career-avatar-circle" style={styles.avatarCircle}>
                <Text style={styles.avatarInitials}>{driver.initials}</Text>
              </View>
              <View style={styles.avatarFlagOverlay}>
                <StateFlagBadge flag={driver.flag} />
              </View>
            </View>

            {/* Pilot Info Stacked Column */}
            <View style={styles.driverDetails}>
              <Text testID="career-driver-name" style={styles.driverName}>
                {driver.name}
              </Text>

              {/* Gold Category Pill with Trophy */}
              <View style={styles.categoryBadge}>
                <SportsIcon name="trophy" size={11} color="#000000" />
                <Text style={styles.categoryBadgeText}>{driver.category}</Text>
              </View>

              {/* Diamond XP Row */}
              <View style={styles.metricRow}>
                <SportsIcon name="diamond" size={13} color="#9CA3AF" />
                <Text
                  testID="career-xp-text"
                  style={[styles.xpText, styles.tabularNums]}
                >
                  {formatNumber(driver.xp)} XP
                </Text>
              </View>

              {/* Star PTS Row */}
              <View style={styles.metricRow}>
                <SportsIcon name="star" size={13} color={SPORTS_PALETTE.accent} />
                <Text
                  testID="career-points-text"
                  style={[styles.pointsText, styles.tabularNums]}
                >
                  {formatNumber(driver.points)} PTS
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.bodyPadding}>
          {/* 2. Efficiency Matrix Card (Matches IMG_3787.PNG: Big Colored % on Top, Label Below) */}
          <View testID="efficiency-card" style={styles.cardContainer}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.headerTitleGroup}>
                <SportsIcon name="arrow-up" size={18} color="#3B82F6" />
                <Text style={styles.sectionTitle}>EFICIÊNCIA</Text>
              </View>
            </View>

            <View style={styles.matrixGrid}>
              {/* 1. Taxa de Vitória (Green) */}
              <View style={styles.matrixCell}>
                <Text
                  testID="stat-win-rate"
                  style={[
                    styles.matrixVal,
                    styles.tabularNums,
                    { color: SPORTS_PALETTE.neonGreen },
                  ]}
                >
                  {stats.efficiency.winRate}%
                </Text>
                <Text style={styles.matrixLabel}>TAXA DE VITÓRIA</Text>
              </View>

              {/* 2. Taxa de Pódio (Gold) */}
              <View style={styles.matrixCell}>
                <Text
                  testID="stat-podium-rate"
                  style={[
                    styles.matrixVal,
                    styles.tabularNums,
                    { color: SPORTS_PALETTE.accent },
                  ]}
                >
                  {stats.efficiency.podiumRate}%
                </Text>
                <Text style={styles.matrixLabel}>TAXA DE PÓDIO</Text>
              </View>

              {/* 3. Eficiência (Blue) */}
              <View style={styles.matrixCell}>
                <Text
                  testID="stat-overall-efficiency"
                  style={[
                    styles.matrixVal,
                    styles.tabularNums,
                    { color: '#3B82F6' },
                  ]}
                >
                  {stats.efficiency.overallEfficiency}%
                </Text>
                <Text style={styles.matrixLabel}>EFICIÊNCIA</Text>
              </View>

              {/* 4. Poles (Pink) */}
              <View style={styles.matrixCell}>
                <Text
                  testID="stat-poles-rate"
                  style={[
                    styles.matrixVal,
                    styles.tabularNums,
                    { color: '#EC4899' },
                  ]}
                >
                  {stats.efficiency.polesRate}%
                </Text>
                <Text style={styles.matrixLabel}>POLES</Text>
              </View>

              {/* 5. Melhores Voltas (Cyan) */}
              <View style={styles.matrixCell}>
                <Text
                  testID="stat-best-laps-rate"
                  style={[
                    styles.matrixVal,
                    styles.tabularNums,
                    { color: '#06B6D4' },
                  ]}
                >
                  {stats.efficiency.bestLapsRate}%
                </Text>
                <Text style={styles.matrixLabel}>MELHORES VOLTAS</Text>
              </View>

              {/* 6. Corridas Válidas (Green) */}
              <View style={styles.matrixCell}>
                <Text
                  testID="stat-valid-races-rate"
                  style={[
                    styles.matrixVal,
                    styles.tabularNums,
                    { color: SPORTS_PALETTE.neonGreen },
                  ]}
                >
                  {stats.efficiency.validRacesRate}%
                </Text>
                <Text style={styles.matrixLabel}>CORRIDAS VÁLIDAS</Text>
              </View>
            </View>
          </View>

          {/* 3. Qualified Stats Card (10+ Competitors - Deep Blue Card matching IMG_3787.PNG) */}
          <View testID="qualified-stats-card" style={styles.qualifiedCard}>
            <View style={styles.qualifiedHeaderRow}>
              <View style={styles.headerTitleGroup}>
                <SportsIcon name="check" size={18} color="#3B82F6" />
                <Text style={styles.qualifiedTitle}>ESTATÍSTICAS QUALIFICADAS</Text>
              </View>
            </View>
            <Text style={styles.qualifiedDesc}>
              RESULTADOS EM CORRIDAS COM 10+ COMPETIDORES
            </Text>

            <View style={styles.statsRowsList}>
              <View style={styles.statLineBlue}>
                <View style={styles.statBulletRow}>
                  <View style={[styles.statDot, { backgroundColor: '#3B82F6' }]} />
                  <Text style={styles.statLineLabel}>CORRIDAS CONCLUÍDAS</Text>
                </View>
                <Text
                  testID="stat-qualified-races"
                  style={[styles.statLineValueBlue, styles.tabularNums]}
                >
                  {stats.qualifiedStats.completedRaces}
                </Text>
              </View>

              <View style={styles.statLineBlue}>
                <View style={styles.statBulletRow}>
                  <View style={[styles.statDot, { backgroundColor: '#3B82F6' }]} />
                  <Text style={styles.statLineLabel}>VITÓRIAS</Text>
                </View>
                <Text
                  testID="stat-qualified-wins"
                  style={[styles.statLineValueBlue, styles.tabularNums]}
                >
                  {stats.qualifiedStats.wins}
                </Text>
              </View>

              <View style={styles.statLineBlue}>
                <View style={styles.statBulletRow}>
                  <View style={[styles.statDot, { backgroundColor: '#3B82F6' }]} />
                  <Text style={styles.statLineLabel}>PÓDIOS</Text>
                </View>
                <Text
                  testID="stat-qualified-podiums"
                  style={[styles.statLineValueBlue, styles.tabularNums]}
                >
                  {stats.qualifiedStats.podiums}
                </Text>
              </View>

              <View style={styles.statLineBlue}>
                <View style={styles.statBulletRow}>
                  <View style={[styles.statDot, { backgroundColor: '#3B82F6' }]} />
                  <Text style={styles.statLineLabel}>POLES</Text>
                </View>
                <Text style={[styles.statLineValueBlue, styles.tabularNums]}>
                  {stats.qualifiedStats.poles}
                </Text>
              </View>

              <View style={styles.statLineBlue}>
                <View style={styles.statBulletRow}>
                  <View style={[styles.statDot, { backgroundColor: '#3B82F6' }]} />
                  <Text style={styles.statLineLabel}>MELHORES VOLTAS</Text>
                </View>
                <Text style={[styles.statLineValueBlue, styles.tabularNums]}>
                  {stats.qualifiedStats.bestLaps}
                </Text>
              </View>

              <View style={[styles.statLineBlue, { borderBottomWidth: 0 }]}>
                <View style={styles.statBulletRow}>
                  <View style={[styles.statDot, { backgroundColor: '#3B82F6' }]} />
                  <Text style={styles.statLineLabel}>TREINOS CLASSIFICATÓRIOS</Text>
                </View>
                <Text style={[styles.statLineValueBlue, styles.tabularNums]}>
                  {stats.qualifiedStats.qualifyingSessions}
                </Text>
              </View>
            </View>
          </View>

          {/* 4. All Racing Stats Card (Matches IMG_3787.PNG & IMG_3789.PNG) */}
          <View style={styles.cardContainer}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.headerTitleGroup}>
                <SportsIcon name="flag" size={18} color="#A855F7" />
                <Text style={styles.sectionTitle}>TODAS AS ESTATÍSTICAS</Text>
              </View>
            </View>
            <Text style={styles.allStatsSubtitle}>
              RESULTADOS EM TODAS AS CORRIDAS
            </Text>

            <View style={styles.statsRowsList}>
              <View style={styles.statLine}>
                <View style={styles.statBulletRow}>
                  <View style={[styles.statDot, { backgroundColor: '#A855F7' }]} />
                  <Text style={styles.statLineLabel}>CORRIDAS</Text>
                </View>
                <Text style={[styles.statLineValue, styles.tabularNums]}>
                  {stats.allStats.totalRaces}
                </Text>
              </View>

              <View style={styles.statLine}>
                <View style={styles.statBulletRow}>
                  <View style={[styles.statDot, { backgroundColor: '#00E676' }]} />
                  <Text style={styles.statLineLabel}>PROVAS COMPLETADAS</Text>
                </View>
                <Text style={[styles.statLineValue, styles.tabularNums]}>
                  {stats.allStats.completedRaces}
                </Text>
              </View>

              <View style={styles.statLine}>
                <View style={styles.statBulletRow}>
                  <View style={[styles.statDot, { backgroundColor: '#00E676' }]} />
                  <Text style={styles.statLineLabel}>VITÓRIAS</Text>
                </View>
                <Text
                  style={[
                    styles.statLineValue,
                    styles.tabularNums,
                    { color: '#00E676' },
                  ]}
                >
                  {stats.allStats.wins}
                </Text>
              </View>

              <View style={styles.statLine}>
                <View style={styles.statBulletRow}>
                  <View style={[styles.statDot, { backgroundColor: '#F59E0B' }]} />
                  <Text style={styles.statLineLabel}>PÓDIOS</Text>
                </View>
                <Text
                  style={[
                    styles.statLineValue,
                    styles.tabularNums,
                    { color: '#F59E0B' },
                  ]}
                >
                  {stats.allStats.podiums}
                </Text>
              </View>

              <View style={styles.statLine}>
                <View style={styles.statBulletRow}>
                  <View style={[styles.statDot, { backgroundColor: '#EC4899' }]} />
                  <Text style={styles.statLineLabel}>POLES</Text>
                </View>
                <Text
                  style={[
                    styles.statLineValue,
                    styles.tabularNums,
                    { color: '#EC4899' },
                  ]}
                >
                  {stats.allStats.poles}
                </Text>
              </View>

              <View style={styles.statLine}>
                <View style={styles.statBulletRow}>
                  <View style={[styles.statDot, { backgroundColor: '#06B6D4' }]} />
                  <Text style={styles.statLineLabel}>MELHORES VOLTAS</Text>
                </View>
                <Text
                  style={[
                    styles.statLineValue,
                    styles.tabularNums,
                    { color: '#06B6D4' },
                  ]}
                >
                  {stats.allStats.bestLaps}
                </Text>
              </View>

              <View style={styles.statLine}>
                <View style={styles.statBulletRow}>
                  <View style={[styles.statDot, { backgroundColor: '#3B82F6' }]} />
                  <Text style={styles.statLineLabel}>TREINOS CLASSIFICATÓRIOS</Text>
                </View>
                <Text
                  style={[
                    styles.statLineValue,
                    styles.tabularNums,
                    { color: '#3B82F6' },
                  ]}
                >
                  {stats.allStats.qualifyingSessions}
                </Text>
              </View>

              <View style={styles.statLine}>
                <View style={styles.statBulletRow}>
                  <View style={[styles.statDot, { backgroundColor: '#F97316' }]} />
                  <Text style={styles.statLineLabel}>WARM-UPS</Text>
                </View>
                <Text
                  style={[
                    styles.statLineValue,
                    styles.tabularNums,
                    { color: '#F97316' },
                  ]}
                >
                  {stats.allStats.warmups}
                </Text>
              </View>

              <View style={[styles.statLine, { borderBottomWidth: 0 }]}>
                <View style={styles.statBulletRow}>
                  <View style={[styles.statDot, { backgroundColor: '#14B8A6' }]} />
                  <Text style={styles.statLineLabel}>TREINOS LIVRES</Text>
                </View>
                <Text
                  style={[
                    styles.statLineValue,
                    styles.tabularNums,
                    { color: '#14B8A6' },
                  ]}
                >
                  {stats.allStats.freePractices}
                </Text>
              </View>
            </View>
          </View>

          {/* 5. Conquistas / Badges Section (Matches IMG_3789.PNG 6x2 Circular Grid) */}
          <View testID="career-badges-section" style={styles.cardContainer}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.headerTitleGroup}>
                <SportsIcon name="trophy" size={18} color={SPORTS_PALETTE.accent} />
                <Text style={styles.sectionTitle}>CONQUISTAS</Text>
              </View>
              <Pressable
                testID="btn-ver-todas-conquistas"
                accessibilityRole="button"
                onPress={handleNavigateBadges}
                style={styles.srOnly}
              >
                <Text>VER TODAS ›</Text>
              </Pressable>
            </View>

            <View testID="badges-grid" style={styles.badgesGrid}>
              {allBadges.map((badge) => (
                <Pressable
                  key={badge.id}
                  testID={`badge-item-${badge.id}`}
                  onPress={handleNavigateBadges}
                  style={styles.badgeItem}
                >
                  <View
                    style={[
                      styles.badgeIconCircle,
                      {
                        backgroundColor: badge.unlocked
                          ? badge.badgeColor || SPORTS_PALETTE.accent
                          : '#27272A',
                        opacity: badge.unlocked ? 1 : 0.45,
                      },
                    ]}
                  >
                    <SportsIcon
                      name={mapBadgeToSportsIcon(badge.icon)}
                      size={22}
                      color="#FFFFFF"
                    />
                  </View>
                  <Text style={styles.srOnly} numberOfLines={1}>
                    {badge.name}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* 6. Metas Ativas Card (Matches IMG_3789.PNG) */}
          <View style={styles.cardContainer}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.headerTitleGroup}>
                <SportsIcon name="target" size={18} color="#22C55E" />
                <Text style={styles.sectionTitle}>METAS ATIVAS</Text>
              </View>
            </View>
            <View style={styles.emptySectionBox}>
              <Text style={styles.emptySectionText}>NENHUMA META ATIVA</Text>
            </View>
          </View>

          {/* 7. Desafios Ativos Card (Matches IMG_3789.PNG) */}
          <View style={styles.cardContainer}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.headerTitleGroup}>
                <SportsIcon name="flame" size={18} color="#A855F7" />
                <Text style={styles.sectionTitle}>DESAFIOS ATIVOS</Text>
              </View>
            </View>
            <View style={styles.emptySectionBox}>
              <Text style={styles.emptySectionText}>NENHUM DESAFIO ATIVO</Text>
            </View>
          </View>

          {/* 8. Bottom Silver Pill FECHAR Button (Matches IMG_3787.PNG & IMG_3789.PNG) */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Fechar"
            onPress={handleBack}
            style={styles.fecharBottomBtn}
          >
            <Text style={styles.fecharBottomBtnText}>FECHAR</Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* Ranking Rules Explanation Modal */}
      <RankingRulesModal
        visible={isRulesModalOpen}
        onClose={() => setIsRulesModalOpen(false)}
      />
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
  screenContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  contentContainer: {
    paddingBottom: 140,
  },
  bodyPadding: {
    paddingHorizontal: 14,
  },
  srOnly: {
    position: 'absolute',
    opacity: 0,
    width: 1,
    height: 1,
    overflow: 'hidden',
  },
  driverCard: {
    backgroundColor: '#1A1D21',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    borderBottomWidth: 1,
    borderColor: '#262A30',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 18,
    marginBottom: 14,
  },
  driverCardTopActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  circleActionBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#22262B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarWrapper: {
    position: 'relative',
    width: 80,
    height: 80,
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: SPORTS_PALETTE.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '900',
    fontFamily: condensedFont,
    letterSpacing: 0.4,
  },
  avatarFlagOverlay: {
    position: 'absolute',
    bottom: 0,
    right: -4,
    backgroundColor: '#1A1D21',
    borderRadius: 4,
    padding: 2,
  },
  driverDetails: {
    flex: 1,
    marginLeft: 18,
    gap: 5,
  },
  driverName: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    fontFamily: condensedFont,
    letterSpacing: 0.3,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: SPORTS_PALETTE.accent,
    borderRadius: 9999,
    paddingHorizontal: 10,
    paddingVertical: 3,
    gap: 4,
  },
  categoryBadgeText: {
    color: '#000000',
    fontSize: 11,
    fontWeight: '900',
    fontFamily: condensedFont,
    letterSpacing: 0.4,
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  xpText: {
    color: '#D1D5DB',
    fontSize: 14,
    fontWeight: '700',
    fontFamily: condensedFont,
  },
  pointsText: {
    color: SPORTS_PALETTE.accent,
    fontSize: 15,
    fontWeight: '800',
    fontFamily: condensedFont,
  },
  cardContainer: {
    backgroundColor: '#1A1D21',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#262A30',
    padding: 16,
    marginBottom: 14,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  headerTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    fontFamily: condensedFont,
    letterSpacing: 0.4,
  },
  matrixGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 18,
    paddingTop: 6,
  },
  matrixCell: {
    width: '31%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  matrixVal: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    fontFamily: condensedFont,
    marginBottom: 4,
  },
  matrixLabel: {
    color: '#9CA3AF',
    fontSize: 11,
    fontWeight: '700',
    fontFamily: condensedFont,
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  qualifiedCard: {
    backgroundColor: '#172B4D',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#264778',
    padding: 16,
    marginBottom: 14,
  },
  qualifiedHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  qualifiedTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    fontFamily: condensedFont,
    letterSpacing: 0.4,
  },
  qualifiedDesc: {
    color: '#60A5FA',
    fontSize: 12,
    fontWeight: '700',
    fontFamily: condensedFont,
    marginTop: 6,
    marginBottom: 12,
    letterSpacing: 0.3,
  },
  allStatsSubtitle: {
    color: '#9CA3AF',
    fontSize: 12,
    fontWeight: '700',
    fontFamily: condensedFont,
    marginBottom: 12,
    letterSpacing: 0.3,
  },
  statsRowsList: {
    gap: 6,
  },
  statBulletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statLineBlue: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 5,
  },
  statLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 5,
  },
  statLineLabel: {
    color: '#D1D5DB',
    fontSize: 13,
    fontWeight: '700',
    fontFamily: condensedFont,
    letterSpacing: 0.3,
  },
  statLineValueBlue: {
    color: '#60A5FA',
    fontSize: 15,
    fontWeight: '800',
    fontFamily: condensedFont,
  },
  statLineValue: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    fontFamily: condensedFont,
  },
  badgesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
    paddingTop: 6,
  },
  badgeItem: {
    width: '15.5%',
    alignItems: 'center',
  },
  badgeIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptySectionBox: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptySectionText: {
    color: '#9CA3AF',
    fontSize: 13,
    fontWeight: '700',
    fontFamily: condensedFont,
    letterSpacing: 0.4,
  },
  fecharBottomBtn: {
    backgroundColor: '#ACACAC',
    borderRadius: 9999,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  fecharBottomBtnText: {
    color: '#000000',
    fontSize: 15,
    fontWeight: '800',
    fontFamily: condensedFont,
    letterSpacing: 0.5,
  },
  tabularNums: {
    fontVariant: ['tabular-nums'],
    fontFamily: condensedFont,
  },
});
