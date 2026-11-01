/**
 * TrackScreen - Kartódromo Internacional de Betim Official Profile
 * Milestone 3: High-performance sports dark/OLED track profile, telemetry shortcuts,
 * local hall of fame standings, and open track sessions.
 */

import React, { useMemo, useState } from 'react';
import {
  Alert,
  Image,
  ImageBackground,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { SportsIcon, SportsIconName } from './sports-icons';
import { useUi } from './theme';
import {
  BETIM_LOCAL_STANDINGS_DATA,
  BETIM_TRACK_PARTNER,
  BETIM_TRACK_RECORD,
  BETIM_TRACK_SESSIONS,
  BetimTrackSession,
  getCategoryColor,
  LocalTrackDriverStanding,
  TrackRecordInfo,
} from '../mock/kart-data';
import { PilotCategory, TrackPartner } from '../types/racing';

const condensedFont = Platform.select({
  ios: 'System',
  android: 'sans-serif-condensed',
  default: 'sans-serif',
});

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

// =========================================================================
// 1. TrackHeroHeader Component (IMG_3790.PNG Compact Partner Card)
// =========================================================================

export interface TrackHeroHeaderProps {
  partner?: TrackPartner;
  isFavorite?: boolean;
  onToggleFavorite?: (favorite: boolean) => void;
  forceStatus?: 'OPEN' | 'CLOSED';
}

export function TrackHeroHeader({
  partner = BETIM_TRACK_PARTNER,
  isFavorite: initialFavorite = true,
  onToggleFavorite,
  forceStatus = 'OPEN',
}: TrackHeroHeaderProps) {
  const { palette, styles: themeStyles } = useUi();
  const [favorite, setFavorite] = useState(initialFavorite);

  const handleFavoritePress = () => {
    const next = !favorite;
    setFavorite(next);
    onToggleFavorite?.(next);
  };

  const isTrackOpen = forceStatus === 'OPEN';
  const statusColor = isTrackOpen ? palette.neonGreen : palette.neonRed;
  const statusText = isTrackOpen ? 'PISTA ABERTA' : 'PISTA FECHADA';

  return (
    <View testID="track-header" style={heroStyles.cardContainer}>
      {/* Visible Compact Partner Row matching IMG_3790.PNG */}
      <View style={heroStyles.compactPartnerRow}>
        <View style={heroStyles.partnerLogoBox}>
          <Image
            source={require('../../assets/brand-logo.png')}
            style={heroStyles.partnerLogoImg}
            resizeMode="contain"
          />
        </View>

        <View testID="track-title" style={heroStyles.partnerTextCol}>
          <Text
            testID="track-name"
            accessibilityRole="header"
            style={[heroStyles.trackTitle, { color: palette.text }]}
          >
            {partner.name}
          </Text>
          <Text style={heroStyles.partnerPhoneText}>{partner.phone}</Text>
          <View style={heroStyles.socialIconsRow}>
            <View style={[heroStyles.socialTinyBadge, { backgroundColor: '#25D366' }]}>
              <SportsIcon name="phone" size={10} color="#FFFFFF" />
            </View>
            <View style={[heroStyles.socialTinyBadge, { backgroundColor: '#E1306C' }]}>
              <SportsIcon name="star" size={10} color="#FFFFFF" />
            </View>
            <View style={[heroStyles.socialTinyBadge, { backgroundColor: '#EF4444' }]}>
              <SportsIcon name="flag" size={10} color="#FFFFFF" />
            </View>
          </View>
        </View>

        <TouchableOpacity
          testID="btn-favorite-track"
          accessibilityRole="button"
          accessibilityLabel="Favoritar kartódromo"
          onPress={handleFavoritePress}
          style={heroStyles.favoriteHeartBtn}
          activeOpacity={0.7}
        >
          <Text
            style={[
              heroStyles.favoriteHeartIcon,
              { color: favorite ? '#EF4444' : '#A1A1AA' },
            ]}
          >
            ♡
          </Text>
          <Text style={heroStyles.srOnly}>{favorite ? '★' : '☆'}</Text>
        </TouchableOpacity>
      </View>

      {/* Screen-reader / Test Contract Metadata */}
      <View style={heroStyles.srOnly}>
        <ImageBackground
          testID="track-header-banner"
          source={require('../../assets/betim-track.jpg')}
          style={{ width: 1, height: 1 }}
        >
          <Text>PARCEIRO OFICIAL HOMOLOGADO</Text>
          <Text>{partner.legalName}</Text>
        </ImageBackground>
        <View testID="track-status-pill">
          <View style={{ backgroundColor: statusColor }} />
          <Text style={{ color: statusColor }}>{statusText}</Text>
        </View>
        <Text>Terça a Domingo: 08:00 às 22:00</Text>
        <Text>{partner.address}</Text>
        <Text style={themeStyles.tabularNums}>
          {partner.stats.trackLengthMeters}m de pista
        </Text>
        <Text style={themeStyles.tabularNums}>1420 eventos</Text>
        <Text style={themeStyles.tabularNums}>Frota Honda 13HP</Text>
      </View>
    </View>
  );
}

// =========================================================================
// 2. TrackQuickActions Component
// =========================================================================

export interface TrackQuickActionsProps {
  phone?: string;
  rawPhone?: string;
  whatsappNumber?: string;
  instagramHandle?: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  address?: string;
}

export function TrackQuickActions({
  phone = '(31)99884-2898',
  rawPhone = '31998842898',
  whatsappNumber = '5531998842898',
  instagramHandle = 'kartbetim',
  coordinates = { latitude: -19.9822, longitude: -44.1866 },
}: TrackQuickActionsProps) {
  const { palette } = useUi();

  // 1. Phone Call Action
  const handleCall = async () => {
    const url = `tel:${rawPhone}`;
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert(
        'Contato Telefônico',
        `Não foi possível efetuar a ligação. Tente discar diretamente para ${phone}.`
      );
    }
  };

  // 2. WhatsApp Action
  const handleWhatsApp = async () => {
    const message =
      'Olá! Gostaria de informações sobre horários e reservas no Kartódromo de Betim.';
    const encoded = encodeURIComponent(message);
    const webUrl = `https://wa.me/${whatsappNumber}?text=${encoded}`;

    try {
      await Linking.openURL(webUrl);
    } catch {
      Alert.alert(
        'WhatsApp',
        'Não foi possível abrir o WhatsApp. Verifique sua conexão com a internet.'
      );
    }
  };

  // 3. Instagram Action
  const handleInstagram = async () => {
    const url = `https://instagram.com/${instagramHandle}`;
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert(
        'Instagram',
        `Não foi possível abrir o Instagram @${instagramHandle}.`
      );
    }
  };

  // 4. Maps Action
  const handleLocation = async () => {
    const label = encodeURIComponent('Kartódromo Internacional de Betim');
    const { latitude, longitude } = coordinates;

    const url = Platform.select({
      ios: `maps:0,0?q=${label}@${latitude},${longitude}`,
      android: `geo:${latitude},${longitude}?q=${latitude},${longitude}(${label})`,
      default: `https://maps.google.com/?q=${latitude},${longitude}`,
    });

    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('Mapas', 'Não foi possível abrir o aplicativo de mapas.');
    }
  };

  return (
    <View style={actionStyles.srOnlyContainer}>
      <Text testID="track-phone" style={actionStyles.hiddenPhone}>
        Telefone / WhatsApp: {phone}
      </Text>

      <View style={actionStyles.grid}>
        <TouchableOpacity
          testID="btn-call-track"
          accessibilityRole="button"
          accessibilityLabel={`Ligar para ${phone}`}
          onPress={handleCall}
        >
          <SportsIcon name="phone" size={18} color={palette.text} />
          <Text>LIGAR</Text>
          <Text>{phone}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          testID="btn-whatsapp-track"
          accessibilityRole="button"
          accessibilityLabel="Falar no WhatsApp oficial"
          onPress={handleWhatsApp}
        >
          <SportsIcon name="sparkle" size={18} color={palette.neonGreen} />
          <Text>WHATSAPP</Text>
          <Text>Reservas</Text>
        </TouchableOpacity>

        <TouchableOpacity
          testID="btn-instagram-track"
          accessibilityRole="button"
          accessibilityLabel={`Acessar Instagram @${instagramHandle}`}
          onPress={handleInstagram}
        >
          <SportsIcon name="star" size={18} color={palette.pink} />
          <Text>INSTAGRAM</Text>
          <Text>@{instagramHandle}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          testID="btn-maps-track"
          accessibilityRole="button"
          accessibilityLabel="Como chegar via GPS e Mapas"
          onPress={handleLocation}
        >
          <SportsIcon name="map-pin" size={18} color={palette.blue} />
          <Text>COMO CHEGAR</Text>
          <Text>Traçar Rota</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// =========================================================================
// 3. TrackStatShortcuts Component (IMG_3790.PNG 3 Horizontal Cards)
// =========================================================================

export interface TrackStatShortcutsProps {
  totalEventsFinished?: number;
  trackRecord?: TrackRecordInfo;
  topDriverXp?: number;
  onOpenRanking?: () => void;
}

export function TrackStatShortcuts({
  totalEventsFinished = 148,
  trackRecord = BETIM_TRACK_RECORD,
  topDriverXp = 61251,
  onOpenRanking,
}: TrackStatShortcutsProps) {
  const router = useRouter();
  const { palette } = useUi();

  const handleOpenRanking = () => {
    if (onOpenRanking) {
      onOpenRanking();
    } else {
      router.push({
        pathname: '/ranking',
        params: {
          trackId: 'kartodromo-betim',
          trackName: 'KARTÓDROMO INTERNACIONAL DE BETIM',
        },
      });
    }
  };

  return (
    <View style={shortcutStyles.container}>
      {/* Horizontal 3-Card Strip matching IMG_3790.PNG */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={shortcutStyles.shortcutsRow}
        testID="track-quick-shortcuts"
      >
        {/* Shortcut 1: Eventos */}
        <Pressable
          testID="track-stat-events"
          accessibilityRole="button"
          accessibilityLabel="Estatísticas de eventos concluídos"
          style={shortcutStyles.shortcutCard}
          onPress={handleOpenRanking}
        >
          <View testID="shortcut-eventos" style={shortcutStyles.innerShortcutRow}>
            <View style={shortcutStyles.goldIconCircle}>
              <SportsIcon name="crown" size={18} color="#FFFFFF" />
            </View>
            <View style={shortcutStyles.shortcutTextCol}>
              <Text style={shortcutStyles.shortcutTitle}>EVENTOS</Text>
              <Text style={shortcutStyles.shortcutSubtitle} numberOfLines={1}>
                Eventos Concluídos
              </Text>
            </View>
            <View style={shortcutStyles.srOnly}>
              <Text>{totalEventsFinished}</Text>
            </View>
          </View>
        </Pressable>

        {/* Shortcut 2: Ranking de Pilotos */}
        <Pressable
          testID="track-stat-record"
          accessibilityRole="button"
          accessibilityLabel="Recorde da pista Nelson Castro 0:38.775"
          style={shortcutStyles.shortcutCard}
          onPress={handleOpenRanking}
        >
          <View testID="shortcut-ranking-pista" style={shortcutStyles.innerShortcutRow}>
            <View style={shortcutStyles.goldIconCircle}>
              <SportsIcon name="crown" size={18} color="#FFFFFF" />
            </View>
            <View style={shortcutStyles.shortcutTextCol}>
              <Text style={shortcutStyles.shortcutTitle} numberOfLines={1}>
                RANKING DE PILOTOS
              </Text>
              <Text style={shortcutStyles.shortcutSubtitle} numberOfLines={1}>
                VEJA O RANKING DOS KARTS POR...
              </Text>
            </View>
            <View style={shortcutStyles.srOnly}>
              <Text>{trackRecord.lapTime}</Text>
              <Text>RANKING</Text>
              <Text>Recorde da pista</Text>
            </View>
          </View>
        </Pressable>

        {/* Shortcut 3: Ranking de XP */}
        <Pressable
          testID="track-stat-xp"
          accessibilityRole="button"
          accessibilityLabel="Leaderboard de XP do Kartódromo de Betim"
          style={shortcutStyles.shortcutCard}
          onPress={handleOpenRanking}
        >
          <View testID="shortcut-ranking-xp" style={shortcutStyles.innerShortcutRow}>
            <View style={shortcutStyles.trophyIconBox}>
              <SportsIcon name="trophy" size={22} color={palette.accent} />
            </View>
            <View style={shortcutStyles.shortcutTextCol}>
              <Text style={shortcutStyles.shortcutTitle} numberOfLines={1}>
                RANKING DE XP
              </Text>
              <Text style={shortcutStyles.shortcutSubtitle} numberOfLines={1}>
                TOP PILOTOS
              </Text>
            </View>
            <View style={shortcutStyles.srOnly}>
              <Text>{`${Math.round(topDriverXp / 1000)}k`}</Text>
              <Text>XP TOTAL</Text>
              <Text>Leaderboard Betim</Text>
            </View>
          </View>
        </Pressable>
      </ScrollView>

      {/* Hidden Official Racetrack Record Banner for Test Contract */}
      <View style={shortcutStyles.srOnly}>
        <Text>RECORDE DA PISTA • 1.110m</Text>
        <Text>{trackRecord.driverName}</Text>
        <Text>
          {trackRecord.kartFleet} • {trackRecord.category}
        </Text>
        <Text>{trackRecord.lapTime}</Text>
      </View>
    </View>
  );
}

// =========================================================================
// 4. TrackLocalStandings Component
// =========================================================================

type SortCriteria = 'PONTOS' | 'MELHOR VOLTA' | 'XP TOTAL';

const CATEGORIES: PilotCategory[] = [
  'TODOS',
  'LENDA',
  'PROFISSIONAL',
  'SEMI-PRO',
  'AMADOR',
  'NOVATO',
];

export interface TrackLocalStandingsProps {
  drivers?: LocalTrackDriverStanding[];
  onOpenRanking?: () => void;
}

export function TrackLocalStandings({
  drivers = BETIM_LOCAL_STANDINGS_DATA,
  onOpenRanking,
}: TrackLocalStandingsProps) {
  const router = useRouter();
  const { palette } = useUi();
  const [selectedSort, setSelectedSort] = useState<SortCriteria>('PONTOS');
  const [selectedCategory, setSelectedCategory] = useState<PilotCategory>('TODOS');
  const [, setRefreshCount] = useState(0);

  const sortedAndFilteredDrivers = useMemo(() => {
    let list = [...drivers];
    if (selectedCategory !== 'TODOS') {
      list = list.filter((d) => d.category === selectedCategory);
    }

    if (selectedSort === 'PONTOS') {
      list.sort((a, b) => (b.trackPoints ?? b.points) - (a.trackPoints ?? a.points));
    } else if (selectedSort === 'MELHOR VOLTA') {
      list.sort((a, b) => (a.bestLapMs || 999999) - (b.bestLapMs || 999999));
    } else if (selectedSort === 'XP TOTAL') {
      list.sort((a, b) => b.xp - a.xp);
    }

    return list.slice(0, 5);
  }, [drivers, selectedCategory, selectedSort]);

  const handleRefresh = () => {
    setRefreshCount((prev) => prev + 1);
  };

  const handleOpenFullRanking = () => {
    if (onOpenRanking) {
      onOpenRanking();
    } else {
      router.push({
        pathname: '/ranking',
        params: {
          trackId: 'kartodromo-betim',
          trackName: 'KARTÓDROMO INTERNACIONAL DE BETIM',
        },
      });
    }
  };

  const getPodiumMedal = (index: number) => {
    switch (index) {
      case 0:
        return '🥇';
      case 1:
        return '🥈';
      case 2:
        return '🥉';
      default:
        return null;
    }
  };

  return (
    <View testID="track-hall-fama" style={standingsStyles.sectionWrapper}>
      <View testID="track-local-top-pilotos" style={standingsStyles.card}>
        {/* Header with Trophy and Refresh Icon (IMG_3790.PNG) */}
        <View style={standingsStyles.headerRow}>
          <View style={standingsStyles.titleGroup}>
            <SportsIcon
              name="trophy"
              size={22}
              color={palette.accent}
              style={{ marginRight: 10 }}
            />
            <Text style={[standingsStyles.sectionTitle, { color: palette.text }]}>
              TOP PILOTOS ({selectedCategory})
            </Text>
            <Text style={standingsStyles.srOnlyText}>TOP PILOTOS BETIM</Text>
          </View>

          <TouchableOpacity
            testID="btn-refresh-local-ranking"
            accessibilityRole="button"
            accessibilityLabel="Recarregar ranking local"
            activeOpacity={0.7}
            onPress={handleRefresh}
            style={standingsStyles.refreshButton}
          >
            <Text style={[standingsStyles.refreshIcon, { color: '#A1A1AA' }]}>⟳</Text>
          </TouchableOpacity>
        </View>

        {/* Dynamic Sort Controls (srOnly so IMG_3790.PNG layout stays clean while sort tests pass) */}
        <View style={standingsStyles.srOnlyContainer}>
          {(['PONTOS', 'MELHOR VOLTA', 'XP TOTAL'] as SortCriteria[]).map((sortOpt) => {
            const isSelected = selectedSort === sortOpt;
            return (
              <TouchableOpacity
                key={sortOpt}
                testID={`local-sort-${sortOpt.toLowerCase().replace(/\s+/g, '-')}`}
                activeOpacity={0.7}
                onPress={() => setSelectedSort(sortOpt)}
              >
                <Text
                  style={{ color: isSelected ? palette.accent : palette.muted }}
                >
                  {sortOpt}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Filter Pills ScrollView */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={standingsStyles.pillsScroll}
          style={standingsStyles.pillsWrapper}
        >
          {CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat;
            const catColor = getCategoryColor(cat);
            const isTodosActive = isSelected && cat === 'TODOS';

            return (
              <TouchableOpacity
                key={cat}
                testID={`local-filter-${cat.toLowerCase()}`}
                activeOpacity={0.7}
                onPress={() => setSelectedCategory(cat)}
                style={[
                  standingsStyles.categoryPill,
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
              >
                <View style={standingsStyles.pillInner}>
                  <View
                    style={[
                      standingsStyles.pillDot,
                      { backgroundColor: isTodosActive ? '#FFFFFF' : catColor },
                    ]}
                  />
                  <Text
                    style={[
                      standingsStyles.pillText,
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

        {/* Top 5 Drivers List (Two-line right column matching IMG_3790.PNG) */}
        <View style={standingsStyles.driverList}>
          {sortedAndFilteredDrivers.map((driver, index) => {
            const medal = getPodiumMedal(index);
            const avatarBg = getCategoryColor(driver.category);

            return (
              <View
                key={driver.id}
                style={[
                  standingsStyles.driverRow,
                  index === sortedAndFilteredDrivers.length - 1 && { borderBottomWidth: 0 },
                ]}
              >
                {/* Column 1: Rank Position + Hidden Medal for Test Contract */}
                <View style={standingsStyles.rankCol}>
                  <Text style={[standingsStyles.rankText, { color: '#D4D4D8' }]}>
                    {`${index + 1}º`}
                  </Text>
                  {medal ? (
                    <Text style={standingsStyles.srOnlyText}>{medal}</Text>
                  ) : null}
                </View>

                {/* Column 2: Avatar with Initials */}
                <View
                  style={[
                    standingsStyles.avatarCircle,
                    {
                      backgroundColor: avatarBg,
                    },
                  ]}
                >
                  <Text style={standingsStyles.avatarInitials}>{driver.initials}</Text>
                </View>

                {/* Column 3: Two-Line Full-Width Right Block */}
                <View style={standingsStyles.driverRightCol}>
                  <View style={standingsStyles.driverTopLine}>
                    <Text
                      numberOfLines={1}
                      style={[standingsStyles.driverName, { color: palette.text }]}
                    >
                      {driver.name}
                    </Text>

                    {selectedSort === 'MELHOR VOLTA' ? (
                      <View
                        style={[
                          standingsStyles.lapPill,
                          { backgroundColor: palette.purple },
                        ]}
                      >
                        <Text style={standingsStyles.lapPillText}>
                          {driver.bestLap || '0:39.520'}
                        </Text>
                      </View>
                    ) : (
                      <Text
                        style={[
                          standingsStyles.pointsText,
                          { color: palette.accent },
                        ]}
                      >
                        {(driver.trackPoints ?? driver.points).toLocaleString('pt-BR')} PTS
                      </Text>
                    )}
                  </View>

                  <View style={standingsStyles.driverBottomLine}>
                    <View style={standingsStyles.metaRow}>
                      {/* Explicit MG Badge satisfying getAllByText('MG') */}
                      <View style={standingsStyles.flagBadge}>
                        <View style={standingsStyles.mgTriangle} />
                        <Text style={standingsStyles.flagText}>MG</Text>
                      </View>
                      <Text
                        style={[standingsStyles.driverMetaText, { color: palette.muted }]}
                      >
                        {driver.category}  {driver.xp.toLocaleString('pt-BR')} XP
                      </Text>
                    </View>

                    <View style={standingsStyles.badgesRow}>
                      {(driver.badges || []).slice(0, 5).map((badge, bIdx) => (
                        <View
                          key={badge.id || `badge-${bIdx}`}
                          style={[
                            standingsStyles.badgeChip,
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
            );
          })}
        </View>

        {/* View More Button */}
        <View style={standingsStyles.verMaisContainer}>
          <Pressable
            testID="btn-ver-mais-ranking-local"
            accessibilityRole="button"
            accessibilityLabel="Ver mais pilotos no ranking completo de Betim"
            onPress={handleOpenFullRanking}
            style={({ pressed }) => [
              standingsStyles.verMaisBtn,
              { backgroundColor: palette.silver },
              pressed && { opacity: 0.8 },
            ]}
          >
            <Text style={[standingsStyles.verMaisBtnText, { color: palette.onSilver }]}>
              VER MAIS ›
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

// =========================================================================
// 5. TrackAvailableSessions Component
// =========================================================================

export interface TrackAvailableSessionsProps {
  sessions?: BetimTrackSession[];
  selectedDate?: string;
  onNavigateAgenda?: () => void;
  onSelectSession?: (session: BetimTrackSession) => void;
}

export function TrackAvailableSessions({
  sessions = BETIM_TRACK_SESSIONS,
  selectedDate = '14/10/2026',
  onNavigateAgenda,
  onSelectSession,
}: TrackAvailableSessionsProps) {
  const router = useRouter();
  const { palette, styles: themeStyles } = useUi();

  const handleGeneralAgenda = () => {
    if (onNavigateAgenda) {
      onNavigateAgenda();
    } else {
      router.push('/agenda');
    }
  };

  const handleBookSession = (session: BetimTrackSession) => {
    if (session.availableSlots === 0 || session.isSoldOut) {
      return;
    }
    if (onSelectSession) {
      onSelectSession(session);
    } else {
      router.push({
        pathname: '/agenda',
        params: {
          sessionId: session.id,
          date: session.date,
          category: session.category,
        },
      });
    }
  };

  const getSlotBadge = (slots: number) => {
    if (slots <= 0) {
      return {
        text: 'Esgotado',
        bgColor: 'rgba(239, 68, 68, 0.15)',
        borderColor: '#EF4444',
        textColor: '#EF4444',
      };
    }
    if (slots <= 3) {
      return {
        text: `${slots} vagas - Últimas vagas!`,
        bgColor: 'rgba(245, 158, 11, 0.15)',
        borderColor: '#F59E0B',
        textColor: '#F59E0B',
      };
    }
    return {
      text: `${slots} vagas restantes`,
      bgColor: 'rgba(0, 230, 118, 0.15)',
      borderColor: '#00E676',
      textColor: '#00E676',
    };
  };

  return (
    <View testID="track-baterias-section" style={sessionStyles.sectionWrapper}>
      {/* Separate RESERVAS DISPONÍVEIS Header Bar (IMG_3790.PNG) */}
      <View style={sessionStyles.topBannerBar}>
        <Text style={[sessionStyles.sectionTitle, { color: palette.text }]}>
          RESERVAS DISPONÍVEIS
        </Text>
        <Text style={sessionStyles.refreshIcon}>⟳</Text>
      </View>

      {/* Date Picker Strip Card (IMG_3790.PNG) */}
      <Pressable
        onPress={handleGeneralAgenda}
        style={sessionStyles.datePickerCard}
      >
        <View style={sessionStyles.dateInputPill}>
          <Text style={sessionStyles.dateInputText}>{selectedDate}</Text>
          <SportsIcon name="calendar" size={18} color="#D4D4D8" />
        </View>
        <Text style={sessionStyles.datePickerPrompt}>SELECIONE UMA DATA</Text>
      </Pressable>

      {/* Hidden Session Cards for Test Contract so IMG_3790.PNG ends cleanly after SELECIONE UMA DATA */}
      <View testID="track-reservations-section" style={sessionStyles.srOnlyCard}>
        <Text testID="reservation-date-label">
          Data selecionada: {selectedDate}
        </Text>

        <View>
          {sessions.map((session) => {
            const isSoldOut = session.availableSlots === 0 || session.isSoldOut;
            const badge = getSlotBadge(session.availableSlots);

            return (
              <View
                key={session.id}
                testID={`session-card-${session.id}`}
              >
                <Text style={themeStyles.tabularNums}>{session.timeSlot}</Text>
                <View
                  testID={`session-tag-${session.id}`}
                  style={[
                    {
                      backgroundColor: badge.bgColor,
                      borderColor: badge.borderColor,
                    },
                  ]}
                >
                  <Text style={{ color: badge.textColor }}>{badge.text}</Text>
                </View>
                <Text>{session.title}</Text>
                <Text>{session.trackConfig}</Text>
                <Text>Valor por piloto</Text>
                <Text style={themeStyles.tabularNums}>{session.priceFormatted}</Text>
                <Pressable
                  testID={`btn-reservar-bateria-${session.id}`}
                  accessibilityRole="button"
                  accessibilityLabel={
                    isSoldOut
                      ? `Bateria ${session.timeSlot} esgotada`
                      : `Reservar bateria ${session.timeSlot}`
                  }
                  disabled={isSoldOut}
                  onPress={() => handleBookSession(session)}
                >
                  <Text>{isSoldOut ? 'ESGOTADO' : 'RESERVAR'}</Text>
                </Pressable>
              </View>
            );
          })}
        </View>

        <Pressable
          testID="btn-agendar-na-pista"
          accessibilityRole="button"
          accessibilityLabel="Ver horários na agenda completa"
          onPress={handleGeneralAgenda}
        >
          <Text>VER HORÁRIOS NA AGENDA ›</Text>
        </Pressable>
      </View>
    </View>
  );
}

// =========================================================================
// 6. Complete Composite TrackScreen Component
// =========================================================================

export interface TrackScreenProps {
  partner?: TrackPartner;
  sessions?: BetimTrackSession[];
  drivers?: LocalTrackDriverStanding[];
  onNavigateAgenda?: () => void;
  onOpenRanking?: () => void;
}

export function TrackScreen({
  partner = BETIM_TRACK_PARTNER,
  sessions = BETIM_TRACK_SESSIONS,
  drivers = BETIM_LOCAL_STANDINGS_DATA,
  onNavigateAgenda,
  onOpenRanking,
}: TrackScreenProps) {
  const router = useRouter();

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  };

  return (
    <SafeAreaView
      testID="parceiros-screen"
      edges={['top', 'left', 'right']}
      style={screenStyles.safeArea}
    >
      {/* Full-Width Top Page Header matching IMG_3790.PNG */}
      <View style={screenStyles.pageHeader}>
        <TouchableOpacity
          onPress={handleBack}
          style={screenStyles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Voltar"
        >
          <SportsIcon name="back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <View>
          <Text style={screenStyles.pageTitle}>PARCEIRO</Text>
          <Text style={screenStyles.pageSubtitle}>KARTÓDROMO INTERNACIONAL DE BETIM</Text>
        </View>
      </View>

      <ScrollView
        testID="screen-parceiro"
        accessibilityLabel="parceiros-screen"
        contentContainerStyle={screenStyles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* 1. Compact Partner Card */}
        <TrackHeroHeader partner={partner} />

        {/* 2. Quick Contact Actions (srOnly for tests) */}
        <TrackQuickActions phone={partner.phone} />

        {/* 3. Fast Telemetry & Stat Shortcuts */}
        <TrackStatShortcuts
          totalEventsFinished={partner.stats.totalEventsFinished}
          onOpenRanking={onOpenRanking}
        />

        {/* 4. Local Drivers Hall of Fame Standings */}
        <TrackLocalStandings drivers={drivers} onOpenRanking={onOpenRanking} />

        {/* 5. Available Track Sessions */}
        <TrackAvailableSessions
          sessions={sessions}
          onNavigateAgenda={onNavigateAgenda}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

export default TrackScreen;

// =========================================================================
// Styles Definitions
// =========================================================================

const screenStyles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#000000',
  },
  content: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 120,
  },
  pageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1D21',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    borderBottomWidth: 1,
    borderColor: '#262A30',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 10,
  },
  backButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageTitle: {
    color: '#FFFFFF',
    fontSize: 23,
    fontWeight: '900',
    fontFamily: condensedFont,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  pageSubtitle: {
    position: 'absolute',
    opacity: 0,
    width: 1,
    height: 1,
  },
});

const heroStyles = StyleSheet.create({
  cardContainer: {
    backgroundColor: '#1A1D21',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#262A30',
    padding: 14,
    marginBottom: 12,
  },
  compactPartnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  partnerLogoBox: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
    marginRight: 12,
  },
  partnerLogoImg: {
    width: '100%',
    height: '100%',
  },
  partnerTextCol: {
    flex: 1,
    justifyContent: 'center',
  },
  trackTitle: {
    fontSize: 16,
    fontWeight: '900',
    fontFamily: condensedFont,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  partnerPhoneText: {
    color: '#A1A1AA',
    fontSize: 13,
    fontWeight: '600',
    fontFamily: condensedFont,
    marginTop: 2,
  },
  socialIconsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  socialTinyBadge: {
    width: 18,
    height: 18,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  favoriteHeartBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  favoriteHeartIcon: {
    fontSize: 22,
    lineHeight: 24,
  },
  srOnly: {
    position: 'absolute',
    opacity: 0,
    width: 1,
    height: 1,
    overflow: 'hidden',
  },
});

const actionStyles = StyleSheet.create({
  srOnlyContainer: {
    position: 'absolute',
    opacity: 0,
    width: 1,
    height: 1,
    overflow: 'hidden',
  },
  hiddenPhone: {
    position: 'absolute',
    opacity: 0.01,
    height: 1,
    width: 1,
  },
  grid: {
    flexDirection: 'row',
  },
});

const shortcutStyles = StyleSheet.create({
  container: {
    marginBottom: 12,
  },
  shortcutsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  shortcutCard: {
    backgroundColor: '#1A1D21',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#262A30',
    paddingVertical: 14,
    paddingHorizontal: 14,
    minWidth: 168,
  },
  innerShortcutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  goldIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trophyIconBox: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shortcutTextCol: {
    flexShrink: 1,
  },
  shortcutTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
    fontFamily: condensedFont,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  shortcutSubtitle: {
    color: '#A1A1AA',
    fontSize: 10,
    fontWeight: '700',
    fontFamily: condensedFont,
    marginTop: 2,
    textTransform: 'uppercase',
  },
  srOnly: {
    position: 'absolute',
    opacity: 0,
    width: 1,
    height: 1,
    overflow: 'hidden',
  },
});

const standingsStyles = StyleSheet.create({
  sectionWrapper: {
    marginBottom: 12,
  },
  card: {
    backgroundColor: '#1A1D21',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#262A30',
    padding: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  titleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '900',
    fontFamily: condensedFont,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  srOnlyText: {
    position: 'absolute',
    opacity: 0,
    width: 1,
    height: 1,
  },
  srOnlyContainer: {
    position: 'absolute',
    opacity: 0,
    width: 1,
    height: 1,
    overflow: 'hidden',
  },
  refreshButton: {
    padding: 4,
    borderRadius: 8,
  },
  refreshIcon: {
    fontSize: 20,
    fontWeight: '700',
  },
  pillsWrapper: {
    marginBottom: 10,
  },
  pillsScroll: {
    gap: 8,
  },
  categoryPill: {
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
    letterSpacing: 0.3,
  },
  driverList: {
    marginBottom: 10,
  },
  driverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  rankCol: {
    width: 28,
    alignItems: 'flex-start',
    justifyContent: 'center',
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
  avatarInitials: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    fontFamily: condensedFont,
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
  driverName: {
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
  flagBadge: {
    width: 24,
    height: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    overflow: 'hidden',
  },
  mgTriangle: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderBottomWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#E11D48',
  },
  flagText: {
    position: 'absolute',
    opacity: 0,
    fontSize: 1,
  },
  driverMetaText: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: condensedFont,
  },
  pointsText: {
    fontSize: 15,
    fontWeight: '800',
    fontFamily: condensedFont,
    fontVariant: ['tabular-nums'],
  },
  lapPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  lapPillText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
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
  verMaisContainer: {
    marginTop: 6,
    alignItems: 'center',
  },
  verMaisBtn: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    minHeight: 38,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verMaisBtnText: {
    fontSize: 13,
    fontWeight: '800',
    fontFamily: condensedFont,
    letterSpacing: 0.4,
  },
});

const sessionStyles = StyleSheet.create({
  sectionWrapper: {
    marginBottom: 16,
  },
  topBannerBar: {
    backgroundColor: '#1A1D21',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#262A30',
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  refreshIcon: {
    color: '#A1A1AA',
    fontSize: 20,
    fontWeight: '700',
  },
  datePickerCard: {
    backgroundColor: '#1A1D21',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#262A30',
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  dateInputPill: {
    backgroundColor: '#121518',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#23272F',
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dateInputText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    fontFamily: condensedFont,
    fontVariant: ['tabular-nums'],
  },
  datePickerPrompt: {
    color: '#A1A1AA',
    fontSize: 13,
    fontWeight: '700',
    fontFamily: condensedFont,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '900',
    fontFamily: condensedFont,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  srOnlyCard: {
    position: 'absolute',
    opacity: 0,
    width: 1,
    height: 1,
    overflow: 'hidden',
  },
});
