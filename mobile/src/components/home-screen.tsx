/**
 * HomeScreen Component — High Performance Sports Dark/OLED Home View
 * Features:
 * - Kartódromo de Betim header branding, live track status, quick booking & account actions.
 * - Top Pilotos section with dynamic category header, scrollable filter pills, top 5 ranked driver rows.
 * - Driver row with rank number, colored initials avatar, state flag badge, XP, gold PTS and mini badges.
 * - "VER MAIS ›" pill button linking to full ranking.
 * - Integrated News Carousel section.
 * - Tab bar clearance padding (120px).
 * Conforms to F05, F06, F08 acceptance criteria and Tier 1-4 test harnesses.
 */

import React, { useMemo, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Link, useRouter } from 'expo-router';

import { MOCK_DRIVERS, MOCK_NEWS_ARTICLES } from '../mock/kart-data';
import { Driver, NewsArticle, PilotCategory } from '../types/racing';
import { Brand } from './brand';
import { NewsCarousel } from './news-carousel';
import { SportsIcon, SportsIconName } from './sports-icons';
import { StateFlagBadge } from './state-flag-badge';
import { useUi } from './theme';

export interface HomeScreenProps {
  drivers?: Driver[];
  news?: NewsArticle[];
  initialCategory?: PilotCategory;
  onOpenRanking?: () => void;
  onSelectDriver?: (driver: Driver) => void;
  onOpenNews?: (article: NewsArticle) => void;
}

const CATEGORIES: PilotCategory[] = [
  'TODOS',
  'LENDA',
  'PROFISSIONAL',
  'SEMI-PRO',
  'AMADOR',
  'NOVATO',
];

const CATEGORY_COLORS: Record<PilotCategory, string> = {
  TODOS: '#4D80EE',
  LENDA: '#F59E0B',
  PROFISSIONAL: '#8B5CF6',
  'SEMI-PRO': '#3B82F6',
  AMADOR: '#22C55E',
  NOVATO: '#9CA3AF',
};

const CATEGORY_AVATAR_TEXT_COLORS: Record<PilotCategory, string> = {
  TODOS: '#FFFFFF',
  LENDA: '#FFFFFF',
  PROFISSIONAL: '#FFFFFF',
  'SEMI-PRO': '#FFFFFF',
  AMADOR: '#FFFFFF',
  NOVATO: '#FFFFFF',
};

function mapBadgeToIcon(iconName: string): SportsIconName {
  switch (iconName) {
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

export default function HomeScreen({
  drivers = MOCK_DRIVERS,
  news = MOCK_NEWS_ARTICLES,
  initialCategory = 'TODOS',
  onOpenRanking,
  onSelectDriver,
  onOpenNews,
}: HomeScreenProps = {}) {
  const router = useRouter();
  const { palette } = useUi();
  const [selectedCategory, setSelectedCategory] = useState<PilotCategory>(initialCategory);

  // Top 5 drivers based on selected category
  const topPilots = useMemo(() => {
    if (selectedCategory === 'TODOS') {
      return drivers.slice(0, 5);
    }
    return drivers.filter((d) => d.category === selectedCategory).slice(0, 5);
  }, [drivers, selectedCategory]);

  const handleOpenRanking = () => {
    if (onOpenRanking) {
      onOpenRanking();
    } else {
      router.push('/ranking');
    }
  };

  const handleSelectDriver = (driver: Driver) => {
    if (onSelectDriver) {
      onSelectDriver(driver);
    } else {
      router.push({
        pathname: '/(tabs)/carreira',
        params: { driverId: driver.id },
      });
    }
  };

  const handleOpenArticle = (article: NewsArticle) => {
    if (onOpenNews) {
      onOpenNews(article);
    } else {
      router.push(`/noticia/${article.id}`);
    }
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: palette.background }}>
    <ScrollView
      testID="screen-home"
      stickyHeaderIndices={[0]}
      style={[homeStyles.screen, { backgroundColor: palette.background }]}
      contentContainerStyle={homeStyles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      {/* 1. Header "HOME" estilo OLED (IMG_3785.PNG) */}
      <View
        testID="home-header"
        style={[
          homeStyles.headerCard,
          { backgroundColor: palette.surface, borderColor: palette.border },
        ]}
      >
        {/* Título de Tela "HOME" em Caixa Alta Condensada */}
        <View style={homeStyles.screenTitleRow}>
          <Text style={[homeStyles.screenTitleText, { color: palette.text }]}>
            HOME
          </Text>
        </View>

        {/* Atalhos visíveis também para quem não usa leitor de tela. */}
        <View style={homeStyles.srOnlyRow}>
          <Brand width={140} />
          <View style={homeStyles.liveIndicatorWrapper}>
            <View style={homeStyles.liveGreenDot} />
            <Text style={homeStyles.liveStatusText}>PRÉVIA DO APLICATIVO</Text>
          </View>
          <Link href="/(tabs)/agenda" asChild>
            <TouchableOpacity
              activeOpacity={0.7}
              accessibilityRole="link"
              accessibilityLabel="Agenda da pista"
              style={homeStyles.quickAction}
            >
              <Text style={{ color: palette.text }}>Agenda da pista</Text>
            </TouchableOpacity>
          </Link>
          <Link href="/(tabs)/agenda" asChild>
            <TouchableOpacity
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Reservar bateria"
              accessibilityHint="Abre os horários disponíveis para reserva."
              style={homeStyles.quickAction}
            >
              <Text style={{ color: palette.text }}>Reservar bateria</Text>
            </TouchableOpacity>
          </Link>
          <Link href="/(tabs)/reservas" asChild>
            <TouchableOpacity
              testID="btn-minha-conta"
              activeOpacity={0.7}
              accessibilityRole="link"
              accessibilityLabel="Minha conta"
              style={homeStyles.quickAction}
            >
              <SportsIcon name="helmet" size={18} color={palette.accent} />
            </TouchableOpacity>
          </Link>
        </View>
      </View>

      {/* 2. Card Elevado "TOP PILOTOS" */}
      <View
        testID="home-top-pilotos-section"
        style={[
          homeStyles.card,
          { backgroundColor: palette.surface, borderColor: palette.border },
        ]}
      >
        {/* Cabeçalho da Seção com Troféu */}
        <View style={homeStyles.sectionHeaderRow}>
          <View style={homeStyles.sectionTitleGroup}>
            <SportsIcon
              name="trophy"
              size={22}
              color="#9CA3AF"
              style={{ marginRight: 10 }}
            />
            <Text style={[homeStyles.sectionTitleText, { color: palette.text }]}>
              TOP PILOTOS {selectedCategory !== 'TODOS' ? `(${selectedCategory})` : ''}
            </Text>
          </View>
        </View>

        {/* Pílulas de Filtro de Categoria Deslizáveis (F06) */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          testID="category-filter-pills"
          contentContainerStyle={homeStyles.pillsContainer}
          style={homeStyles.pillsScrollView}
        >
          {CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat;
            const dotColor = CATEGORY_COLORS[cat];
            const isTodosActive = isSelected && cat === 'TODOS';

            return (
              <Pressable
                key={cat}
                testID={`filter-pill-${cat.toLowerCase()}`}
                accessibilityRole="button"
                accessibilityLabel={`Filtrar pilotos da categoria ${cat}`}
                accessibilityState={{ selected: isSelected }}
                onPress={() => setSelectedCategory(cat)}
                style={({ pressed }) => [
                  homeStyles.categoryPill,
                  isTodosActive && homeStyles.categoryPillTodosActive,
                  isSelected && !isTodosActive && {
                    borderColor: dotColor,
                    backgroundColor: '#22262B',
                  },
                  pressed && homeStyles.categoryPillPressed,
                ]}
              >
                <View
                  testID={`home-category-pill-${cat.toLowerCase()}`}
                  style={homeStyles.pillInnerRow}
                >
                  <View
                    style={[
                      homeStyles.categoryDot,
                      { backgroundColor: isTodosActive ? '#FFFFFF' : dotColor },
                    ]}
                  />
                  <Text
                    style={[
                      homeStyles.categoryPillText,
                      isSelected && homeStyles.categoryPillTextActive,
                      isTodosActive && homeStyles.categoryPillTodosTextActive,
                    ]}
                  >
                    {cat}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Lista do Top 5 de Pilotos (F05) */}
        <View testID="top-pilotos-list" style={homeStyles.pilotsListContainer}>
          {topPilots.length === 0 ? (
            <View style={homeStyles.emptyContainer}>
              <SportsIcon name="helmet" size={28} color={palette.muted} />
              <Text testID="empty-pilotos-text" style={[homeStyles.emptyText, { color: palette.muted }]}>
                Nenhum piloto nesta categoria.
              </Text>
            </View>
          ) : (
            topPilots.map((driver, index) => {
              const avatarBg = CATEGORY_COLORS[driver.category] ?? palette.accent;
              const avatarTextColor =
                CATEGORY_AVATAR_TEXT_COLORS[driver.category] ?? '#FFFFFF';
              const rankFormatted = `${index + 1}º`;
              const isFirst = index === 0;

              return (
                <TouchableOpacity
                  key={driver.id}
                  testID={`driver-row-${driver.id}`}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={`Piloto ${driver.name}, posição ${rankFormatted}, ${driver.points} pontos`}
                  onPress={() => handleSelectDriver(driver)}
                  style={[
                    homeStyles.driverRow,
                    index === topPilots.length - 1 && homeStyles.driverRowLast,
                  ]}
                >
                  <View
                    testID={`top-pilot-row-${driver.id}`}
                    style={homeStyles.driverRowContent}
                  >
                    {/* Posição Tabular */}
                    <View style={homeStyles.rankPositionBox}>
                      <Text
                        style={[
                          homeStyles.rankPositionText,
                          isFirst && homeStyles.rankPositionTextFirst,
                        ]}
                      >
                        {rankFormatted}
                      </Text>
                    </View>

                    {/* Avatar Circular com Iniciais */}
                    <View
                      testID={`driver-avatar-circle-${driver.id}`}
                      style={[
                        homeStyles.avatarCircle,
                        {
                          backgroundColor: avatarBg,
                        },
                      ]}
                    >
                      <Text style={[homeStyles.avatarInitials, { color: avatarTextColor }]}>
                        {driver.initials}
                      </Text>
                    </View>

                    {/* Dados do Piloto + Pontuação e Badges em 2 Linhas Horizontais (IMG_3785.PNG) */}
                    <View style={homeStyles.driverBodyCol}>
                      <View style={homeStyles.driverTopLine}>
                        <Text
                          numberOfLines={1}
                          style={[homeStyles.driverNameText, { color: '#E5E7EB' }]}
                        >
                          {driver.name}
                        </Text>

                        <Text
                          testID={`driver-points-${driver.id}`}
                          style={homeStyles.driverPointsText}
                        >
                          {driver.points.toLocaleString('pt-BR')} PTS
                        </Text>
                      </View>

                      <View style={homeStyles.driverBottomLine}>
                        <View style={homeStyles.driverSubRow}>
                          <StateFlagBadge flag={driver.flag} />
                          <Text style={[homeStyles.driverMetaText, { color: '#9CA3AF' }]}>
                            {driver.category}  {driver.xp.toLocaleString('pt-BR')} XP
                          </Text>
                        </View>

                        {/* Fileira de até 5 Mini Badges */}
                        <View style={homeStyles.miniBadgesRow}>
                          {(driver.badges || []).slice(0, 5).map((badge, bIdx) => (
                            <View
                              key={badge.id || `badge-${bIdx}`}
                              style={[
                                homeStyles.miniBadgeItem,
                                { backgroundColor: badge.badgeColor ?? palette.accent },
                              ]}
                            >
                              <SportsIcon
                                name={mapBadgeToIcon(badge.icon)}
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
            })
          )}
        </View>

        {/* Botão Centralizado "VER MAIS ›" para Ranking Completo */}
        <View style={homeStyles.verMaisButtonWrapper}>
          <Pressable
            testID="btn-ver-mais-ranking"
            accessibilityRole="button"
            accessibilityLabel="Ver mais pilotos no ranking completo"
            onPress={handleOpenRanking}
            style={({ pressed }) => [
              homeStyles.verMaisButton,
              { backgroundColor: palette.silver },
              pressed && homeStyles.verMaisButtonPressed,
            ]}
          >
            <View testID="btn-ver-mais-ranking-bottom" style={homeStyles.verMaisInnerRow}>
              <Text style={[homeStyles.verMaisButtonText, { color: palette.onSilver }]}>
                VER MAIS ›
              </Text>
            </View>
          </Pressable>
        </View>
      </View>

      {/* 3. Card Elevado "ÚLTIMAS NOTÍCIAS" (F08) */}
      <View
        testID="home-news-section"
        style={[
          homeStyles.card,
          { backgroundColor: palette.surface, borderColor: palette.border },
        ]}
      >
        <NewsCarousel
          articles={news}
          showTitle={true}
          title="ÚLTIMAS NOTÍCIAS"
          onOpenArticle={handleOpenArticle}
        />
      </View>
    </ScrollView>
    </SafeAreaView>
  );
}

const condensedFont = Platform.select({
  android: 'sans-serif-condensed',
  ios: 'System',
  default: 'sans-serif-condensed',
});

const homeStyles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 12,
    paddingTop: 0,
    paddingBottom: 120,
    maxWidth: 600,
    alignSelf: 'center',
    width: '100%',
  },

  // 1. Header do Kartódromo (Bloco superior escuro com cantos inferiores arredondados - IMG_3785.PNG)
  headerCard: {
    marginHorizontal: -12,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    borderWidth: 0,
    borderBottomWidth: 1,
    paddingVertical: 13,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  srOnlyRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 12,
  },
  quickAction: { minHeight: 48, minWidth: 48, justifyContent: 'center', alignItems: 'center' },
  liveIndicatorWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  liveGreenDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#00E676',
    marginRight: 6,
  },
  liveStatusText: {
    color: '#00E676',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  screenTitleRow: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  screenTitleText: {
    fontFamily: condensedFont,
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },

  // 2. Cards Principais Elevados
  card: {
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sectionTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  sectionTitleText: {
    fontFamily: condensedFont,
    fontSize: 18,
    fontWeight: '400',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },

  // 3. Pílulas de Filtro de Categorias
  pillsScrollView: {
    marginBottom: 6,
  },
  pillsContainer: {
    paddingVertical: 2,
    gap: 8,
  },
  categoryPill: {
    backgroundColor: '#2A2D32',
    borderRadius: 9999,
    paddingHorizontal: 13,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#343840',
  },
  pillInnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryPillTodosActive: {
    backgroundColor: '#4D80EE',
    borderColor: '#4D80EE',
  },
  categoryPillPressed: {
    opacity: 0.8,
  },
  categoryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  categoryPillText: {
    fontFamily: condensedFont,
    color: '#D4D4D8',
    fontSize: 13,
    fontWeight: '400',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  categoryPillTextActive: {
    color: '#FFFFFF',
  },
  categoryPillTodosTextActive: {
    color: '#FFFFFF',
  },

  // 4. Linhas de Pilotos
  pilotsListContainer: {
    marginTop: 2,
  },
  driverRow: {
    paddingVertical: 7,
  },
  driverRowLast: {
    borderBottomWidth: 0,
  },
  driverRowContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rankPositionBox: {
    width: 28,
    alignItems: 'flex-start',
  },
  rankPositionText: {
    fontFamily: condensedFont,
    color: '#D4D4D8',
    fontSize: 17,
    fontWeight: '400',
    fontVariant: ['tabular-nums'],
  },
  rankPositionTextFirst: {
    color: '#E5E7EB',
    fontWeight: '400',
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  avatarInitials: {
    fontFamily: condensedFont,
    fontSize: 17,
    fontWeight: '400',
    letterSpacing: 0.4,
  },
  driverBodyCol: {
    flex: 1,
    justifyContent: 'center',
  },
  driverTopLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  driverBottomLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
    gap: 6,
  },
  driverNameText: {
    flex: 1,
    fontFamily: condensedFont,
    fontSize: 15.5,
    fontWeight: '400',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  driverSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
  },
  driverMetaText: {
    fontFamily: condensedFont,
    fontSize: 12.5,
    fontWeight: '400',
    letterSpacing: 0.2,
  },
  driverPointsText: {
    fontFamily: condensedFont,
    color: '#F59E0B',
    fontSize: 15.5,
    fontWeight: '400',
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.3,
  },
  miniBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  miniBadgeItem: {
    width: 21,
    height: 21,
    borderRadius: 10.5,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // 5. Botão "VER MAIS ›"
  verMaisButtonWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    paddingTop: 2,
  },
  verMaisButton: {
    borderRadius: 9999,
    paddingHorizontal: 24,
    paddingVertical: 7,
    minHeight: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verMaisInnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  verMaisButtonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  verMaisButtonText: {
    fontFamily: condensedFont,
    fontSize: 14,
    fontWeight: '400',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },

  // 6. Estado Vazio
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    gap: 8,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
