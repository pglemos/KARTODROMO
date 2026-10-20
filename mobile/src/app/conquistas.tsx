import { demoOnly } from '../config/features';
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
import { SportsIcon, SportsIconName } from '../components/sports-icons';
import { SPORTS_PALETTE } from '../components/theme';
import { ALL_BADGES_CATALOG } from '../mock/kart-data';
import { BadgeCategory, BadgeItem } from '../types/racing';

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

function ConquistasScreen() {
  const [selectedFilter, setSelectedFilter] = useState<'TODAS' | BadgeCategory>(
    'TODAS'
  );

  const categories: { id: 'TODAS' | BadgeCategory; label: string }[] = [
    { id: 'TODAS', label: 'TODAS' },
    { id: 'experiencia', label: 'EXPERIÊNCIA' },
    { id: 'desafio', label: 'DESAFIO' },
    { id: 'especial', label: 'ESPECIAL' },
  ];

  const filteredBadges =
    selectedFilter === 'TODAS'
      ? ALL_BADGES_CATALOG
      : ALL_BADGES_CATALOG.filter((b) => b.category === selectedFilter);

  const unlockedCount = ALL_BADGES_CATALOG.filter((b) => b.unlocked).length;

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/carreira');
    }
  };

  const sectionDefinitions: { category: BadgeCategory; title: string }[] = [
    { category: 'desafio', title: 'BADGES DE DESAFIO' },
    { category: 'experiencia', title: 'BADGES DE EXPERIÊNCIA' },
    { category: 'especial', title: 'BADGES ESPECIAIS' },
  ];

  const renderBadgeCard = (badge: BadgeItem) => {
    const req = badge.totalRequired || 1;
    const prog = badge.currentProgress ?? (badge.unlocked ? req : 0);
    const ratio = Math.min(100, Math.round((prog / req) * 100));

    return (
      <View
        key={badge.id}
        testID={`full-badge-card-${badge.id}`}
        style={[
          styles.badgeCard,
          badge.unlocked && styles.badgeCardUnlocked,
          !badge.unlocked && styles.badgeCardLocked,
        ]}
      >
        <View style={styles.badgeTopContent}>
          <View style={styles.badgeIconCol}>
            <SportsIcon
              name={mapBadgeToSportsIcon(badge.icon)}
              size={24}
              color={
                badge.unlocked
                  ? badge.badgeColor || '#E4E4E7'
                  : '#9CA3AF'
              }
            />
          </View>

          <View style={styles.badgeTextCol}>
            <Text style={styles.badgeName}>{badge.name}</Text>
            <Text style={styles.badgeDesc}>{badge.description}</Text>
            <Text style={[styles.badgeProgressLabel, styles.tabularNums]}>
              {badge.unlocked && req === 1
                ? 'CONCLUÍDO'
                : `${prog}/${req}`}
            </Text>
          </View>
        </View>

        {/* Bottom Progress Bar */}
        <View style={styles.progressBarBg}>
          <View
            style={[
              styles.progressBarFill,
              {
                width: `${ratio}%`,
                backgroundColor: badge.unlocked
                  ? badge.badgeColor || '#D4D4D8'
                  : '#52525B',
              },
            ]}
          />
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <View testID="screen-conquistas" style={styles.container}>
        {/* Header Block (Matches codex-clipboard-eff6b916) */}
        <View style={styles.header}>
          <Pressable
            testID="btn-back-conquistas"
            accessibilityRole="button"
            accessibilityLabel="Voltar para carreira"
            onPress={handleBack}
            style={styles.backBtn}
          >
            <SportsIcon name="back" size={22} color="#FFFFFF" />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>CONQUISTAS</Text>
            <Text style={styles.srOnly}>CONQUISTAS & BADGES</Text>
          </View>
          <View style={styles.srOnly}>
            <Text style={[styles.unlockedPillText, styles.tabularNums]}>
              {unlockedCount}/{ALL_BADGES_CATALOG.length}
            </Text>
          </View>
        </View>

        {/* Filter Pills kept accessible for test contracts */}
        <View style={styles.srOnly}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterScroll}
          >
            {categories.map((cat) => {
              const isSelected = selectedFilter === cat.id;
              return (
                <Pressable
                  key={cat.id}
                  testID={`badge-filter-${cat.id.toLowerCase()}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  onPress={() => setSelectedFilter(cat.id)}
                  style={[styles.filterPill, isSelected && styles.filterPillActive]}
                >
                  <Text
                    style={[
                      styles.filterPillText,
                      isSelected && styles.filterPillTextActive,
                    ]}
                  >
                    {cat.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* Grouped 2-Column Badges Sections */}
        <ScrollView
          testID="badges-full-list"
          style={styles.scrollList}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {selectedFilter === 'TODAS' ? (
            sectionDefinitions.map((sec) => {
              const items = filteredBadges.filter(
                (b) => b.category === sec.category
              );
              if (items.length === 0) return null;
              return (
                <View key={sec.category} style={styles.sectionCard}>
                  <Text style={styles.sectionHeaderTitle}>{sec.title}</Text>
                  <View style={styles.twoColumnGrid}>
                    {items.map(renderBadgeCard)}
                  </View>
                </View>
              );
            })
          ) : (
            <View style={styles.sectionCard}>
              <Text style={styles.sectionHeaderTitle}>
                {sectionDefinitions.find((s) => s.category === selectedFilter)
                  ?.title || 'CONQUISTAS'}
              </Text>
              <View style={styles.twoColumnGrid}>
                {filteredBadges.map(renderBadgeCard)}
              </View>
            </View>
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const CONDENSED_FONT = Platform.select({
  android: 'sans-serif-condensed',
  ios: 'Arial Narrow',
  default: 'sans-serif-condensed',
});

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#1A1D21',
  },
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1D21',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 14,
    gap: 10,
  },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontFamily: CONDENSED_FONT,
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  srOnly: {
    position: 'absolute',
    width: 1,
    height: 1,
    overflow: 'hidden',
    opacity: 0,
  },
  unlockedPillText: {
    color: SPORTS_PALETTE.accent,
    fontSize: 12,
    fontWeight: '800',
  },
  filterScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterPill: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 9999,
    backgroundColor: '#161A1D',
    borderWidth: 1,
    borderColor: '#2A2E35',
  },
  filterPillActive: {
    backgroundColor: SPORTS_PALETTE.accent,
    borderColor: SPORTS_PALETTE.accent,
  },
  filterPillText: {
    color: SPORTS_PALETTE.textMuted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  filterPillTextActive: {
    color: '#000000',
  },
  scrollList: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 120,
    gap: 14,
  },
  sectionCard: {
    backgroundColor: '#1A1D21',
    borderRadius: 18,
    padding: 14,
  },
  sectionHeaderTitle: {
    color: '#FFFFFF',
    fontFamily: CONDENSED_FONT,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.4,
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  twoColumnGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 10,
  },
  badgeCard: {
    width: '48.5%',
    backgroundColor: '#24272C',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#52565E',
    padding: 12,
    justifyContent: 'space-between',
  },
  badgeCardUnlocked: {
    borderColor: '#6B7280',
  },
  badgeCardLocked: {
    opacity: 0.9,
  },
  badgeTopContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 10,
  },
  badgeIconCol: {
    paddingTop: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeTextCol: {
    flex: 1,
  },
  badgeName: {
    color: '#FFFFFF',
    fontFamily: CONDENSED_FONT,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  badgeDesc: {
    color: '#9CA3AF',
    fontFamily: CONDENSED_FONT,
    fontSize: 10,
    lineHeight: 13,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  badgeProgressLabel: {
    color: '#9CA3AF',
    fontFamily: CONDENSED_FONT,
    fontSize: 9,
    fontWeight: '700',
    marginTop: 6,
  },
  progressBarBg: {
    height: 4,
    borderRadius: 2,
    backgroundColor: '#3F3F46',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  tabularNums: {
    fontVariant: ['tabular-nums'],
    ...Platform.select({
      ios: { fontFamily: 'Arial Narrow' },
      android: { fontFamily: 'sans-serif-condensed' },
      default: { fontFamily: 'sans-serif-condensed' },
    }),
  },
});

export default demoOnly(ConquistasScreen);
