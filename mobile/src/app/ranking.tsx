/**
 * Driver Ranking Screen — `src/app/ranking.tsx`
 * Full-screen OLED leaderboard for all registered drivers with real-time search,
 * category filtering, rules modal and driver profile routing.
 * Conforms to F07 acceptance criteria and Tier 1-4 test harnesses.
 */

import { DEMO_MODE } from '../config/features';
import RankingReal from '../components/ranking-real';
import React, { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FloatingTabBar } from '../components/floating-tab-bar';
import { RankingRulesModal } from '../components/ranking-rules-modal';
import { SportsIcon, SportsIconName } from '../components/sports-icons';
import { StateFlagBadge } from '../components/state-flag-badge';
import { useUi } from '../components/theme';
import {
  getCategoryColor,
  getDriversByCategory,
} from '../mock/kart-data';
import { Driver, PilotCategory } from '../types/racing';

const CATEGORIES: PilotCategory[] = [
  'TODOS',
  'LENDA',
  'PROFISSIONAL',
  'SEMI-PRO',
  'AMADOR',
  'NOVATO',
];

const CATEGORY_AVATAR_TEXT_COLORS: Record<PilotCategory, string> = {
  TODOS: '#FFFFFF',
  LENDA: '#FFFFFF',
  PROFISSIONAL: '#FFFFFF',
  'SEMI-PRO': '#FFFFFF',
  AMADOR: '#FFFFFF',
  NOVATO: '#FFFFFF',
};

function normalizeSearchText(str: string): string {
  return (str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function mapBadgeIcon(icon: string): SportsIconName {
  switch (icon) {
    case 'trophy':
    case 'trophy.fill':
      return 'trophy';
    case 'crosshair':
    case 'target':
      return 'crosshair';
    case 'flame':
    case 'flame.fill':
      return 'flame';
    case 'crown':
    case 'crown-fill':
    case 'crown.fill':
      return 'crown';
    case 'star':
    case 'star.fill':
    case 'star-half':
      return 'star';
    case 'sparkles':
    case 'sparkle':
      return 'sparkle';
    case 'moon':
    case 'moon.stars.fill':
      return 'moon';
    case 'arrow-up':
    case 'arrow.up.right':
      return 'arrow-up';
    case 'cloud-rain':
    case 'cloud.rain.fill':
      return 'cloud-rain';
    default:
      return 'star';
  }
}

function RankingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ trackId?: string; trackName?: string }>();
  const { palette } = useUi();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<PilotCategory>('TODOS');
  const [isRulesModalVisible, setIsRulesModalVisible] = useState(false);

  // Filter drivers based on category and query
  const filteredDrivers = useMemo(() => {
    let list = getDriversByCategory(selectedCategory);
    if (searchQuery.trim().length > 0) {
      const normalized = normalizeSearchText(searchQuery);
      list = list.filter((d) => {
        const nameNorm = normalizeSearchText(d.name);
        const initialsNorm = normalizeSearchText(d.initials);
        return nameNorm.includes(normalized) || initialsNorm.includes(normalized);
      });
    }
    return list;
  }, [selectedCategory, searchQuery]);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  };

  const handleDriverPress = useCallback((driver: Driver) => {
    router.push({
      pathname: '/(tabs)/carreira',
      params: { driverId: driver.id },
    });
  }, [router]);

  return (
    <SafeAreaView
      testID="ranking-screen"
      edges={['top', 'left', 'right']}
      style={[styles.safeArea, { backgroundColor: palette.background }]}
    >
      {/* 1. Unified Dark Header + Search Block (IMG_3786.PNG & IMG_3791.PNG) */}
      <View
        style={[
          styles.topPanel,
          {
            backgroundColor: palette.surface,
            borderBottomColor: palette.border,
          },
        ]}
      >
        <View style={styles.headerBar}>
          <TouchableOpacity
            testID="btn-back-ranking"
            onPress={handleBack}
            style={styles.headerIconButton}
            accessibilityLabel="Voltar"
            accessibilityRole="button"
          >
            <SportsIcon name="back" size={24} color="#FFFFFF" />
          </TouchableOpacity>

          <View style={styles.headerTitleCol}>
            <Text style={[styles.headerTitle, { color: palette.text }]}>
              RANKING DE PILOTOS
            </Text>
            {Boolean(params.trackName) && (
              <Text
                style={[styles.headerSubtitle, { color: palette.muted }]}
                numberOfLines={1}
              >
                {params.trackName}
              </Text>
            )}
          </View>

          <TouchableOpacity
            testID="btn-ranking-rules"
            onPress={() => setIsRulesModalVisible(true)}
            style={styles.headerIconButton}
            accessibilityLabel="Regras do ranking"
            accessibilityRole="button"
          >
            <View testID="btn-ranking-rules-info">
              <SportsIcon name="info" size={24} color="#FFFFFF" />
            </View>
          </TouchableOpacity>
        </View>

        {/* 2. Search Field inside Elevated Outer Frame */}
        <View style={styles.searchOuterBox}>
          <View style={styles.searchContainer}>
            <SportsIcon name="search" size={18} color="#FFFFFF" />
            <TextInput
              testID="ranking-search-input"
              style={[styles.searchInput, { color: palette.text }]}
              placeholder="Buscar piloto por nome..."
              placeholderTextColor="#A1A1AA"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              accessibilityLabel="Buscar piloto por nome"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => setSearchQuery('')}
                style={styles.clearSearchButton}
                accessibilityLabel="Limpar busca"
              >
                <SportsIcon name="close" size={16} color="#A1A1AA" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      {/* 3. Category Filter Pills */}
      <View style={styles.pillsWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.pillsScroll}
        >
          {CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat;
            const catColor = getCategoryColor(cat);
            const isTodosActive = isSelected && cat === 'TODOS';

            return (
              <TouchableOpacity
                key={cat}
                testID={`ranking-filter-${cat.toLowerCase()}`}
                activeOpacity={0.7}
                onPress={() => setSelectedCategory(cat)}
                style={[
                  styles.pill,
                  {
                    backgroundColor: isTodosActive
                      ? '#4D80EE'
                      : isSelected
                      ? '#22262B'
                      : '#2A2A2A',
                    borderColor: isTodosActive
                      ? '#4D80EE'
                      : isSelected
                      ? catColor
                      : '#343840',
                  },
                ]}
                accessibilityRole="tab"
                accessibilityState={{ selected: isSelected }}
              >
                <View testID={`filter-pill-${cat.toLowerCase()}`} style={styles.pillInner}>
                  <View
                    style={[
                      styles.pillDot,
                      { backgroundColor: isTodosActive ? '#FFFFFF' : catColor },
                    ]}
                  />
                  <Text
                    style={[
                      styles.pillText,
                      {
                        color: isSelected ? '#FFFFFF' : '#C1C1C1',
                        fontWeight: isSelected ? '800' : '700',
                      },
                    ]}
                  >
                    {cat}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* 4. Ranked Drivers List */}
      <FlatList
        data={filteredDrivers}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => {
          const rankFormatted = `${index + 1}º`;
          const avatarBg = getCategoryColor(item.category);
          const avatarTextColor = CATEGORY_AVATAR_TEXT_COLORS[item.category] ?? '#FFFFFF';

          return (
            <TouchableOpacity
              key={item.id}
              testID={`ranking-driver-row-${item.id}`}
              activeOpacity={0.7}
              onPress={() => handleDriverPress(item)}
              style={styles.driverRow}
              accessibilityRole="button"
              accessibilityLabel={`Piloto ${item.name}, posição ${rankFormatted}, ${item.points} pontos`}
            >
              <View
                testID={`full-ranking-item-${item.id}`}
                style={styles.driverRowContent}
              >
                {/* 1. Rank Position */}
                <View style={styles.rankCol}>
                  <Text style={[styles.rankText, { color: '#D4D4D8' }]}>
                    {rankFormatted}
                  </Text>
                </View>

                {/* 2. Avatar Circle */}
                <View
                  style={[
                    styles.avatarCircle,
                    {
                      backgroundColor: avatarBg,
                    },
                  ]}
                >
                  <Text style={[styles.avatarText, { color: avatarTextColor }]}>
                    {item.initials}
                  </Text>
                </View>

                {/* 3. Right Side: Top Line (Name + Points) + Bottom Line (Flag + Category/XP + Badges) */}
                <View style={styles.driverRightCol}>
                  <View style={styles.driverTopLine}>
                    <Text
                      style={[styles.nameText, { color: palette.text }]}
                      numberOfLines={1}
                    >
                      {item.name}
                    </Text>
                    <Text
                      testID={`driver-points-${item.id}`}
                      style={[styles.pointsText, { color: palette.accent }]}
                    >
                      {item.points.toLocaleString('pt-BR')} PTS
                    </Text>
                  </View>

                  <View style={styles.driverBottomLine}>
                    <View style={styles.metaRow}>
                      <StateFlagBadge flag={item.flag} />
                      <Text style={[styles.categoryText, { color: palette.muted }]}>
                        {item.category}  {item.xp.toLocaleString('pt-BR')} XP
                      </Text>
                    </View>

                    <View style={styles.badgesRow}>
                      {(item.badges || []).slice(0, 5).map((badge, bIdx) => (
                        <View
                          key={badge.id || `badge-${bIdx}`}
                          style={[
                            styles.badgeChip,
                            { backgroundColor: badge.badgeColor ?? palette.accent },
                          ]}
                        >
                          <SportsIcon
                            name={mapBadgeIcon(badge.icon)}
                            size={12}
                            color="#FFFFFF"
                          />
                        </View>
                      ))}
                    </View>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <View testID="ranking-empty-state" style={styles.emptyContainer}>
            <View testID="no-drivers-found" style={{ alignItems: 'center', gap: 8 }}>
              <SportsIcon name="helmet" size={40} color={palette.muted} />
              <Text style={[styles.emptyTitle, { color: palette.text }]}>
                Nenhum piloto encontrado.
              </Text>
              <Text style={[styles.emptySubtitle, { color: palette.muted }]}>
                {searchQuery
                  ? `Não encontramos resultados para "${searchQuery}" nesta categoria.`
                  : 'Nenhum competidor cadastrado nesta categoria.'}
              </Text>
              {(searchQuery.length > 0 || selectedCategory !== 'TODOS') && (
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => {
                    setSearchQuery('');
                    setSelectedCategory('TODOS');
                  }}
                  style={[styles.clearFiltersBtn, { backgroundColor: palette.surfaceElevated, borderColor: palette.border }]}
                >
                  <Text style={[styles.clearFiltersBtnText, { color: palette.text }]}>
                    LIMPAR FILTROS
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        }
      />

      {/* 5. Floating Bottom Tabs */}
      <FloatingTabBar
        activeTab={params.trackId ? 'Parceiros' : 'Home'}
        onTabPress={(tabLabel) => {
          const map: Record<string, string> = {
            Home: '/(tabs)',
            Parceiros: '/(tabs)/parceiros',
            LiveTime: '/(tabs)/livetime',
            Agenda: '/(tabs)/agenda',
            Carreira: '/(tabs)/carreira',
          };
          const dest = map[tabLabel];
          if (dest) router.push(dest as any);
        }}
      />

      {/* 6. Rules Calculation Modal */}
      <RankingRulesModal
        visible={isRulesModalVisible}
        onClose={() => setIsRulesModalVisible(false)}
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
  },
  topPanel: {
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    borderBottomWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 16,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  headerIconButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleCol: {
    flex: 1,
    paddingHorizontal: 8,
  },
  headerTitle: {
    fontSize: 23,
    fontWeight: '900',
    fontFamily: condensedFont,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  headerSubtitle: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: condensedFont,
    marginTop: 2,
    textTransform: 'uppercase',
  },
  searchOuterBox: {
    backgroundColor: '#35383F',
    borderRadius: 16,
    padding: 8,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E2024',
    borderRadius: 9999,
    paddingHorizontal: 14,
    height: 42,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    height: '100%',
  },
  clearSearchButton: {
    padding: 6,
  },
  pillsWrapper: {
    marginTop: 14,
    marginBottom: 8,
  },
  pillsScroll: {
    paddingHorizontal: 16,
    paddingVertical: 4,
    gap: 8,
  },
  pill: {
    borderRadius: 9999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
  },
  pillInner: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pillDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  pillText: {
    fontSize: 12,
    fontFamily: condensedFont,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 120,
  },
  driverRow: {
    paddingVertical: 10,
  },
  driverRowContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rankCol: {
    width: 28,
    alignItems: 'flex-start',
  },
  rankText: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: condensedFont,
    fontVariant: ['tabular-nums'],
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '800',
    fontFamily: condensedFont,
    letterSpacing: 0.4,
  },
  driverRightCol: {
    flex: 1,
    justifyContent: 'center',
  },
  driverTopLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  driverBottomLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
    gap: 6,
  },
  nameText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '800',
    fontFamily: condensedFont,
    textTransform: 'uppercase',
    letterSpacing: 0.2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: condensedFont,
  },
  pointsText: {
    fontSize: 15,
    fontWeight: '800',
    fontFamily: condensedFont,
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.2,
  },
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  badgeChip: {
    width: 21,
    height: 21,
    borderRadius: 10.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    paddingVertical: 48,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 12,
  },
  clearFiltersBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 6,
  },
  clearFiltersBtnText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
});

// loja: ranking real (melhor volta por traçado); demonstração: o ranking fictício de XP
export default DEMO_MODE ? RankingScreen : RankingReal;
