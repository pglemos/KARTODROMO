/**
 * Test Harness Screens and Components for Kartódromo de Betim E2E tests.
 * Provides accessible, requirement-driven opaque-box UI harnesses matching
 * ORIGINAL_REQUEST.md, PROJECT.md, and TEST_INFRA.md.
 */

import React, { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  AgendaSlot,
  CartItem,
  CartState,
  Driver,
  NewsArticle,
  PilotCategory,
} from '../../../src/types/racing';
import {
  MOCK_AGENDA_SLOTS,
  MOCK_CAREER_STATS,
  MOCK_COCKPIT_HUD,
  MOCK_DRIVERS,
  MOCK_LIVE_SESSION,
  MOCK_NEWS,
  MOCK_TRACK_PARTNER,
} from './mock-dataset';
import {
  formatCentavosToReais,
  SPORTS_PALETTE,
  TABULAR_NUMS_STYLE,
} from './racing-contracts';

// ==========================================
// 1. Floating Bottom Tab Bar
// ==========================================
export type TabName = 'Home' | 'Parceiros' | 'LiveTime' | 'Agenda' | 'Carreira';

export interface FloatingTabBarProps {
  activeTab: TabName;
  onTabPress: (tab: TabName) => void;
}

export function FloatingTabBarHarness({ activeTab, onTabPress }: FloatingTabBarProps) {
  const tabs: TabName[] = ['Home', 'Parceiros', 'LiveTime', 'Agenda', 'Carreira'];
  return (
    <View testID="floating-bottom-tabs" style={styles.tabBarContainer}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab;
        return (
          <Pressable
            key={tab}
            testID={`tab-${tab.toLowerCase()}`}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            onPress={() => onTabPress(tab)}
            style={[styles.tabButton, isActive && styles.activeTabPill]}
          >
            <Text
              style={[
                styles.tabLabel,
                isActive ? styles.activeTabLabel : styles.inactiveTabLabel,
              ]}
            >
              {tab.toUpperCase()}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ==========================================
// 2. Floating Cart Bar
// ==========================================
export interface FloatingCartBarProps {
  cart: CartState;
  onPress: () => void;
}

export function FloatingCartBarHarness({ cart, onPress }: FloatingCartBarProps) {
  if (cart.totalQuantity === 0) {
    return null;
  }

  return (
    <Pressable
      testID="floating-cart-bar"
      accessibilityRole="button"
      accessibilityLabel={`Carrinho com ${cart.totalQuantity} itens no valor de ${cart.totalPriceFormatted}`}
      onPress={onPress}
      style={styles.floatingCartBar}
    >
      <View style={styles.cartBarContent}>
        <Text style={styles.cartBarText}>
          🛒 CARRINHO | {cart.totalQuantity} {cart.totalQuantity === 1 ? 'ITEM' : 'ITENS'} - {cart.totalPriceFormatted}
        </Text>
        <Text style={styles.cartBarCta}>VER PEDIDO ›</Text>
      </View>
    </Pressable>
  );
}

// ==========================================
// 3. Cart Modal / Drawer
// ==========================================
export interface CartModalProps {
  cart: CartState;
  visible: boolean;
  onClose: () => void;
  onConfirmOrder: () => void;
}

export function CartModalHarness({
  cart,
  visible,
  onClose,
  onConfirmOrder,
}: CartModalProps) {
  return (
    <Modal
      testID="cart-modal"
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View testID="cart-sheet" style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>CARRINHO DE COMPRAS</Text>
            <Pressable
              testID="close-cart-btn"
              accessibilityRole="button"
              onPress={onClose}
            >
              <Text style={styles.closeBtnText}>✕</Text>
            </Pressable>
          </View>

          {cart.items.length === 0 ? (
            <View testID="cart-empty-state" style={styles.emptyCartBox}>
              <Text style={styles.emptyCartText}>Seu carrinho está vazio.</Text>
            </View>
          ) : (
            <ScrollView style={styles.cartItemsList}>
              {cart.items.map((item) => (
                <View
                  key={item.sessionId}
                  testID={`cart-item-${item.sessionId}`}
                  style={styles.cartItemRow}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemTitle}>{item.sessionTitle}</Text>
                    <Text style={styles.itemSubtitle}>
                      {item.trackName} • {item.date} às {item.time}
                    </Text>
                    <Text style={[styles.itemPrice, TABULAR_NUMS_STYLE]}>
                      {item.quantity}x {formatCentavosToReais(item.unitPriceCentavos)} = {formatCentavosToReais(item.totalPriceCentavos)}
                    </Text>
                  </View>

                  <Pressable
                    testID={`swipe-remove-item-${item.sessionId}`}
                    accessibilityLabel="Deslize para remover"
                    onPress={() => cart.removeItem(item.sessionId)}
                    style={styles.removeBtn}
                  >
                    <Text style={styles.removeBtnText}>REMOVER</Text>
                  </Pressable>
                </View>
              ))}
            </ScrollView>
          )}

          <View style={styles.cartFooter}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>TOTAL GERAL:</Text>
              <Text testID="cart-modal-total-price" style={[styles.totalValue, TABULAR_NUMS_STYLE]}>
                {cart.totalPriceFormatted}
              </Text>
            </View>

            <View style={styles.cartActionButtons}>
              <Pressable
                testID="btn-confirm-order"
                accessibilityRole="button"
                disabled={cart.totalQuantity === 0}
                onPress={onConfirmOrder}
                style={[
                  styles.primaryActionBtn,
                  cart.totalQuantity === 0 && styles.disabledBtn,
                ]}
              >
                <Text style={styles.primaryActionText}>CONFIRMAR PEDIDO</Text>
              </Pressable>

              <View style={styles.secondaryActionsRow}>
                <Pressable
                  testID="btn-clear-cart"
                  accessibilityRole="button"
                  disabled={cart.totalQuantity === 0}
                  onPress={cart.clearCart}
                  style={[styles.secondaryActionBtn, { flex: 1 }]}
                >
                  <Text style={styles.secondaryActionText}>REMOVER TODOS</Text>
                </Pressable>

                <Pressable
                  testID="btn-continue-shopping"
                  accessibilityRole="button"
                  onPress={onClose}
                  style={[styles.secondaryActionBtn, { flex: 1 }]}
                >
                  <Text style={styles.secondaryActionText}>CONTINUAR</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ==========================================
// 4. Home Screen Harness
// ==========================================
export interface HomeScreenProps {
  onOpenRanking: () => void;
  onOpenNews: (news: NewsArticle) => void;
}

export function HomeScreenHarness({
  onOpenRanking,
  onOpenNews,
}: HomeScreenProps) {
  const [selectedCategory, setSelectedCategory] = useState<PilotCategory>('TODOS');
  const categories: PilotCategory[] = [
    'TODOS',
    'LENDA',
    'PROFISSIONAL',
    'SEMI-PRO',
    'AMADOR',
    'NOVATO',
  ];

  const filteredDrivers = useMemo(() => {
    if (selectedCategory === 'TODOS') return MOCK_DRIVERS.slice(0, 5);
    return MOCK_DRIVERS.filter((d) => d.category === selectedCategory).slice(0, 5);
  }, [selectedCategory]);

  return (
    <ScrollView testID="screen-home" style={styles.screenContainer}>
      {/* Top Pilotos Section */}
      <View testID="home-top-pilotos-section" style={styles.cardContainer}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeaderTitle}>TOP PILOTOS</Text>
          <Pressable
            testID="btn-ver-mais-ranking"
            accessibilityRole="button"
            onPress={onOpenRanking}
          >
            <Text style={styles.verMaisText}>VER MAIS ›</Text>
          </Pressable>
        </View>

        {/* Category Pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          testID="category-filter-pills"
          style={styles.pillsScroll}
        >
          {categories.map((cat) => (
            <Pressable
              key={cat}
              testID={`filter-pill-${cat.toLowerCase()}`}
              accessibilityRole="button"
              accessibilityState={{ selected: selectedCategory === cat }}
              onPress={() => setSelectedCategory(cat)}
              style={[
                styles.categoryPill,
                selectedCategory === cat && styles.activePill,
              ]}
            >
              <Text
                style={[
                  styles.pillText,
                  selectedCategory === cat && styles.activePillText,
                ]}
              >
                {cat}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Drivers List */}
        <View testID="top-pilotos-list" style={{ marginTop: 12 }}>
          {filteredDrivers.length === 0 ? (
            <Text testID="empty-pilotos-text" style={styles.emptyText}>
              Nenhum piloto nesta categoria.
            </Text>
          ) : (
            filteredDrivers.map((driver, index) => (
              <View
                key={driver.id}
                testID={`driver-row-${driver.id}`}
                style={styles.driverRow}
              >
                <View style={styles.driverPosition}>
                  <Text style={[styles.driverPosText, TABULAR_NUMS_STYLE]}>
                    {index + 1}º
                  </Text>
                </View>

                <View
                  testID={`driver-avatar-circle-${driver.id}`}
                  style={[
                    styles.driverAvatarCircle,
                    {
                      borderColor:
                        driver.category === 'LENDA'
                          ? SPORTS_PALETTE.gold
                          : SPORTS_PALETTE.border,
                    },
                  ]}
                >
                  <Text style={styles.driverInitials}>{driver.initials}</Text>
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.driverName}>{driver.name}</Text>
                  <Text style={styles.driverCategoryText}>
                    {driver.category} • {driver.xp.toLocaleString('pt-BR')} XP
                  </Text>
                </View>

                <View style={styles.pointsBadge}>
                  <Text
                    testID={`driver-points-${driver.id}`}
                    style={[styles.pointsText, TABULAR_NUMS_STYLE]}
                  >
                    {driver.points.toLocaleString('pt-BR')} PTS
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>
      </View>

      {/* News Carousel */}
      <View testID="home-news-section" style={[styles.cardContainer, { marginTop: 16 }]}>
        <Text style={styles.sectionHeaderTitle}>ÚLTIMAS NOTÍCIAS</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          testID="news-carousel"
          style={{ marginTop: 12 }}
        >
          {MOCK_NEWS.map((news) => (
            <Pressable
              key={news.id}
              testID={`news-card-${news.id}`}
              accessibilityRole="button"
              onPress={() => onOpenNews(news)}
              style={styles.newsCard}
            >
              <View style={styles.newsImagePlaceholder}>
                <Text style={styles.newsTag}>{news.category}</Text>
              </View>
              <Text numberOfLines={2} style={styles.newsTitle}>
                {news.title}
              </Text>
              <Text style={styles.newsDate}>{news.date}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
    </ScrollView>
  );
}

// ==========================================
// 5. Full Ranking Screen
// ==========================================
export interface RankingScreenProps {
  onClose: () => void;
  onOpenRules: () => void;
}

export function RankingScreenHarness({ onClose, onOpenRules }: RankingScreenProps) {
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<PilotCategory>('TODOS');

  const filtered = useMemo(() => {
    return MOCK_DRIVERS.filter((d) => {
      const matchCat =
        selectedCategory === 'TODOS' || d.category === selectedCategory;
      const matchQuery =
        !query || d.name.toLowerCase().includes(query.toLowerCase());
      return matchCat && matchQuery;
    });
  }, [query, selectedCategory]);

  return (
    <View testID="screen-ranking" style={styles.screenContainer}>
      <View style={styles.screenHeader}>
        <Pressable
          testID="btn-back-ranking"
          accessibilityRole="button"
          onPress={onClose}
        >
          <Text style={styles.backBtnText}>‹ VOLTAR</Text>
        </Pressable>
        <Text style={styles.screenHeaderTitle}>RANKING DE PILOTOS</Text>
        <Pressable
          testID="btn-ranking-rules-info"
          accessibilityLabel="Como funciona o ranking"
          onPress={onOpenRules}
        >
          <Text style={styles.infoIconText}>ⓘ</Text>
        </Pressable>
      </View>

      <TextInput
        testID="ranking-search-input"
        placeholder="Buscar piloto por nome..."
        placeholderTextColor={SPORTS_PALETTE.textMuted}
        value={query}
        onChangeText={setQuery}
        style={styles.searchInput}
      />

      <ScrollView horizontal style={styles.pillsScroll}>
        {(['TODOS', 'LENDA', 'PROFISSIONAL', 'SEMI-PRO', 'AMADOR', 'NOVATO'] as PilotCategory[]).map(
          (cat) => (
            <Pressable
              key={cat}
              testID={`ranking-filter-${cat.toLowerCase()}`}
              onPress={() => setSelectedCategory(cat)}
              style={[
                styles.categoryPill,
                selectedCategory === cat && styles.activePill,
              ]}
            >
              <Text
                style={[
                  styles.pillText,
                  selectedCategory === cat && styles.activePillText,
                ]}
              >
                {cat}
              </Text>
            </Pressable>
          )
        )}
      </ScrollView>

      <ScrollView style={{ marginTop: 12 }}>
        {filtered.length === 0 ? (
          <View testID="no-drivers-found" style={{ padding: 24, alignItems: 'center' }}>
            <Text style={styles.emptyText}>Nenhum piloto encontrado.</Text>
          </View>
        ) : (
          filtered.map((driver, index) => (
            <View
              key={driver.id}
              testID={`full-ranking-item-${driver.id}`}
              style={styles.driverRow}
            >
              <Text style={[styles.driverPosText, TABULAR_NUMS_STYLE]}>
                {index + 1}º
              </Text>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.driverName}>{driver.name}</Text>
                <Text style={styles.driverCategoryText}>
                  {driver.category} • {driver.xp.toLocaleString('pt-BR')} XP
                </Text>
              </View>
              <Text style={[styles.pointsText, TABULAR_NUMS_STYLE]}>
                {driver.points.toLocaleString('pt-BR')} PTS
              </Text>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

// ==========================================
// 6. News Reader Harness
// ==========================================
export interface NewsReaderProps {
  article: NewsArticle | null;
  onClose: () => void;
  onShare?: () => void;
}

export function NewsReaderHarness({ article, onClose, onShare }: NewsReaderProps) {
  if (!article) return null;

  return (
    <Modal
      testID="news-reader-modal"
      visible={!!article}
      animationType="slide"
      onRequestClose={onClose}
    >
      <ScrollView testID="news-reader-content" style={styles.newsReaderContainer}>
        <View style={styles.readerHeader}>
          <Pressable
            testID="btn-close-news-reader"
            accessibilityRole="button"
            onPress={onClose}
          >
            <Text style={styles.backBtnText}>✕ FECHAR</Text>
          </Pressable>
          <Pressable
            testID="btn-share-news"
            accessibilityRole="button"
            onPress={onShare}
          >
            <Text style={styles.shareBtnText}>COMPARTILHAR</Text>
          </Pressable>
        </View>

        <Text testID="news-reader-tag" style={styles.newsTagLarge}>
          {article.category}
        </Text>
        <Text testID="news-reader-title" style={styles.newsReaderTitle}>
          {article.title}
        </Text>
        <Text style={styles.newsReaderMeta}>
          Por {article.author} • {article.date} • {article.readTime}
        </Text>
        <Text testID="news-reader-body" style={styles.newsReaderBody}>
          {article.content}
        </Text>
      </ScrollView>
    </Modal>
  );
}

// ==========================================
// 7. Parceiro Screen Harness
// ==========================================
export interface ParceiroScreenProps {
  onNavigateAgenda: () => void;
}

export function ParceiroScreenHarness({ onNavigateAgenda }: ParceiroScreenProps) {
  const [isFavorite, setIsFavorite] = useState(MOCK_TRACK_PARTNER.isFavorite);
  const [selectedDate, setSelectedDate] = useState('14/10/2026');

  return (
    <ScrollView testID="screen-parceiro" style={styles.screenContainer}>
      {/* Track Header */}
      <View testID="track-header" style={styles.cardContainer}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text testID="track-name" style={styles.trackTitle}>
            {MOCK_TRACK_PARTNER.name}
          </Text>
          <Pressable
            testID="btn-favorite-track"
            accessibilityLabel="Favoritar kartódromo"
            onPress={() => setIsFavorite(!isFavorite)}
          >
            <Text style={[styles.favoriteIcon, isFavorite && { color: SPORTS_PALETTE.gold }]}>
              {isFavorite ? '★' : '☆'}
            </Text>
          </Pressable>
        </View>

        <Text testID="track-phone" style={styles.trackContact}>
          Telefone / WhatsApp: {MOCK_TRACK_PARTNER.phone}
        </Text>
        <Text style={styles.trackAddress}>{MOCK_TRACK_PARTNER.address}</Text>

        <View style={styles.trackStatsRow}>
          <Text style={[styles.trackStatItem, TABULAR_NUMS_STYLE]}>
            {MOCK_TRACK_PARTNER.stats.trackLengthMeters}m de pista
          </Text>
          <Text style={[styles.trackStatItem, TABULAR_NUMS_STYLE]}>
            {MOCK_TRACK_PARTNER.stats.totalEventsFinished} eventos
          </Text>
        </View>
      </View>

      {/* Quick Shortcuts */}
      <View testID="track-quick-shortcuts" style={styles.shortcutsRow}>
        <View testID="shortcut-eventos" style={styles.shortcutCard}>
          <Text style={styles.shortcutTitle}>EVENTOS</Text>
          <Text style={styles.shortcutSubtitle}>Concluídos</Text>
        </View>
        <View testID="shortcut-ranking-pista" style={styles.shortcutCard}>
          <Text style={styles.shortcutTitle}>RANKING</Text>
          <Text style={styles.shortcutSubtitle}>Da Pista</Text>
        </View>
        <View testID="shortcut-ranking-xp" style={styles.shortcutCard}>
          <Text style={styles.shortcutTitle}>XP TOTAL</Text>
          <Text style={styles.shortcutSubtitle}>Líderes</Text>
        </View>
      </View>

      {/* Local Top Drivers */}
      <View testID="track-local-top-pilotos" style={[styles.cardContainer, { marginTop: 16 }]}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeaderTitle}>TOP PILOTOS BETIM</Text>
          <Text testID="btn-refresh-local-ranking" style={styles.refreshIcon}>⟳</Text>
        </View>
        {MOCK_DRIVERS.slice(0, 3).map((driver) => (
          <View key={driver.id} style={styles.driverRow}>
            <Text style={styles.mgFlagBadge}>MG</Text>
            <Text style={[styles.driverName, { marginLeft: 8 }]}>{driver.name}</Text>
            <Text style={[styles.pointsText, TABULAR_NUMS_STYLE]}>
              {driver.points.toLocaleString('pt-BR')} PTS
            </Text>
          </View>
        ))}
      </View>

      {/* Track Available Reservations */}
      <View testID="track-reservations-section" style={[styles.cardContainer, { marginTop: 16 }]}>
        <Text style={styles.sectionHeaderTitle}>RESERVAS DISPONÍVEIS</Text>
        <Text testID="reservation-date-label" style={styles.dateLabel}>
          Data selecionada: {selectedDate}
        </Text>
        <Pressable
          testID="btn-agendar-na-pista"
          accessibilityRole="button"
          onPress={onNavigateAgenda}
          style={styles.primaryActionBtn}
        >
          <Text style={styles.primaryActionText}>VER HORÁRIOS NA AGENDA ›</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

// ==========================================
// 8. LiveTime Screen Harness
// ==========================================
export interface LiveTimeScreenProps {
  onOpenCockpitHUD: () => void;
}

export function LiveTimeScreenHarness({ onOpenCockpitHUD }: LiveTimeScreenProps) {
  const session = MOCK_LIVE_SESSION;

  return (
    <ScrollView testID="screen-livetime" style={styles.screenContainer}>
      {/* Session Header */}
      <View testID="livetime-session-header" style={styles.liveHeader}>
        <Text testID="livetime-title" style={styles.sessionTitle}>
          {session.title}
        </Text>
        <Text testID="livetime-subtitle" style={styles.sessionSubtitle}>
          {session.subtitle} • {session.trackName}
        </Text>
      </View>

      {/* Fastest Lap Banner */}
      {session.fastestLap && (
        <View testID="fastest-lap-banner" style={styles.fastestLapBanner}>
          <Text style={styles.fastestLapTag}>VOLTA MAIS RÁPIDA</Text>
          <Text testID="fastest-lap-info" style={[styles.fastestLapText, TABULAR_NUMS_STYLE]}>
            {session.fastestLap.competitorNumber} {session.fastestLap.name} - {session.fastestLap.time} NA VOLTA {session.fastestLap.lapNumber}
          </Text>
        </View>
      )}

      {/* Session Flag & Elapsed Timer */}
      <View testID="flag-status-card" style={styles.flagCard}>
        <View style={styles.flagBadge}>
          <Text testID="flag-status-label" style={styles.flagText}>
            BANDEIRA VERDE
          </Text>
        </View>
        <Text testID="elapsed-session-timer" style={[styles.elapsedTimerText, TABULAR_NUMS_STYLE]}>
          {session.elapsedTime}
        </Text>
      </View>

      {/* Action to Cockpit HUD */}
      <Pressable
        testID="btn-open-cockpit-hud"
        accessibilityRole="button"
        onPress={onOpenCockpitHUD}
        style={styles.cockpitHudBtn}
      >
        <Text style={styles.cockpitHudBtnText}>⛶ MODO COCKPIT HUD (PAISAGEM)</Text>
      </Pressable>

      {/* Telemetry Grid */}
      <View testID="telemetry-table" style={[styles.cardContainer, { marginTop: 16 }]}>
        <Text style={styles.sectionHeaderTitle}>TABELA DE COMPETIDORES</Text>
        {session.competitors.map((comp) => (
          <View
            key={comp.kartNumber}
            testID={`telemetry-row-${comp.kartNumber}`}
            style={styles.telemetryRow}
          >
            <Text style={[styles.compPos, TABULAR_NUMS_STYLE]}>{comp.position}º</Text>
            <View style={{ flex: 1, marginHorizontal: 8 }}>
              <Text style={styles.compName}>
                {comp.kartNumber} {comp.name}
              </Text>
              <Text style={styles.compCategory}>{comp.category} • L{comp.currentLap}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <View
                style={[
                  styles.bestLapPill,
                  comp.isFastestLap && styles.fastestLapPurplePill,
                ]}
              >
                <Text style={[styles.bestLapText, TABULAR_NUMS_STYLE]}>
                  {comp.bestLapTime}
                </Text>
              </View>
              <Text style={[styles.diffText, TABULAR_NUMS_STYLE]}>
                {comp.diffLeader}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

// ==========================================
// 9. Cockpit HUD Screen Harness (Landscape)
// ==========================================
export interface CockpitHUDScreenProps {
  onClose: () => void;
}

export function CockpitHUDScreenHarness({ onClose }: CockpitHUDScreenProps) {
  const hud = MOCK_COCKPIT_HUD;

  return (
    <View testID="screen-cockpit-hud" style={styles.cockpitContainer}>
      <View style={styles.cockpitTopBar}>
        <Text testID="cockpit-driver-info" style={styles.cockpitDriverText}>
          {hud.driverInfo.kartNumber} {hud.driverInfo.name}
        </Text>
        <Pressable
          testID="btn-close-cockpit"
          accessibilityLabel="Fechar Cockpit HUD"
          onPress={onClose}
          style={styles.closeHudBtn}
        >
          <Text style={styles.closeHudText}>✕</Text>
        </Pressable>
      </View>

      <View style={styles.cockpitMainRow}>
        <View testID="cockpit-position-card" style={styles.cockpitPosBox}>
          <Text style={styles.cockpitLabel}>POSIÇÃO</Text>
          <Text testID="cockpit-current-position" style={[styles.cockpitBigPos, TABULAR_NUMS_STYLE]}>
            {hud.currentPosition}
          </Text>
        </View>

        <View testID="cockpit-timer-box" style={styles.cockpitTimerBox}>
          <Text style={styles.cockpitLabel}>TEMPO DE VOLTA</Text>
          <Text testID="cockpit-giant-timer" style={[styles.cockpitGiantTime, TABULAR_NUMS_STYLE]}>
            {hud.currentLapTime}
          </Text>
        </View>

        <View testID="cockpit-delta-card" style={styles.cockpitDeltaBox}>
          <Text style={styles.cockpitLabel}>DELTA REALTIME</Text>
          <Text
            testID="cockpit-delta-value"
            style={[
              styles.cockpitDeltaText,
              TABULAR_NUMS_STYLE,
              {
                color:
                  hud.realtimeDelta.trend === 'faster'
                    ? SPORTS_PALETTE.neonGreen
                    : SPORTS_PALETTE.neonRed,
              },
            ]}
          >
            {hud.realtimeDelta.value} ⬆
          </Text>
        </View>
      </View>

      <View style={styles.cockpitFooter}>
        <Text style={[styles.cockpitFooterItem, TABULAR_NUMS_STYLE]}>
          Última: {hud.lastLap.time}
        </Text>
        <Text style={[styles.cockpitFooterItem, TABULAR_NUMS_STYLE]}>
          Melhor: {hud.bestLap.time}
        </Text>
        <Text
          testID="cockpit-delta-best"
          style={[
            styles.cockpitFooterItem,
            TABULAR_NUMS_STYLE,
            { color: hud.deltaBest.isImprovement ? SPORTS_PALETTE.neonGreen : SPORTS_PALETTE.neonRed },
          ]}
        >
          Dif Melhor: {hud.deltaBest.value}
        </Text>
      </View>
    </View>
  );
}

// ==========================================
// 10. Agenda Screen Harness
// ==========================================
export interface AgendaScreenProps {
  onAddToCart: (slot: AgendaSlot, quantity: number) => void;
}

export function AgendaScreenHarness({ onAddToCart }: AgendaScreenProps) {
  const [selectedSlot, setSelectedSlot] = useState<AgendaSlot | null>(null);
  const [quantity, setQuantity] = useState(1);
  const slots = MOCK_AGENDA_SLOTS;

  function handleOpenSlot(slot: AgendaSlot) {
    if (slot.isSoldOut) return;
    setSelectedSlot(slot);
    setQuantity(1);
  }

  function handleAdd() {
    if (!selectedSlot) return;
    onAddToCart(selectedSlot, quantity);
    setSelectedSlot(null);
  }

  return (
    <View testID="screen-agenda" style={styles.screenContainer}>
      <Text style={styles.screenHeaderTitle}>AGENDA DE BATERIAS</Text>
      <Text testID="agenda-selected-date" style={styles.dateLabel}>
        Data: 14/10/2026
      </Text>

      <ScrollView testID="agenda-slots-list" style={{ marginTop: 12 }}>
        {slots.map((slot) => (
          <View
            key={slot.id}
            testID={`agenda-slot-card-${slot.id}`}
            style={styles.slotCard}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.slotTitle}>{slot.title}</Text>
              <Text style={styles.slotCategory}>{slot.category}</Text>
              <Text
                testID={`slot-vagas-${slot.id}`}
                style={[
                  styles.slotVagas,
                  slot.isSoldOut && { color: SPORTS_PALETTE.neonRed },
                ]}
              >
                {slot.isSoldOut ? 'ESGOTADO' : `${slot.availableSlots} VAGAS`}
              </Text>
            </View>

            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[styles.slotPrice, TABULAR_NUMS_STYLE]}>
                {slot.priceFormatted}
              </Text>
              <Pressable
                testID={`btn-select-slot-${slot.id}`}
                accessibilityRole="button"
                disabled={slot.isSoldOut}
                onPress={() => handleOpenSlot(slot)}
                style={[
                  styles.slotActionBtn,
                  slot.isSoldOut && styles.disabledBtn,
                ]}
              >
                <Text style={styles.slotActionBtnText}>
                  {slot.isSoldOut ? 'ESGOTADO' : 'SELECIONAR'}
                </Text>
              </Pressable>
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Battery Detail Drawer / Modal */}
      {selectedSlot && (
        <Modal
          testID="slot-detail-modal"
          visible={!!selectedSlot}
          transparent
          animationType="fade"
          onRequestClose={() => setSelectedSlot(null)}
        >
          <View style={styles.modalOverlay}>
            <View testID="slot-detail-sheet" style={styles.modalCard}>
              <Text testID="slot-detail-title" style={styles.modalTitle}>
                {selectedSlot.title}
              </Text>
              <Text style={styles.modalSubtitle}>{selectedSlot.category}</Text>
              <Text testID="slot-detail-price" style={[styles.modalPriceText, TABULAR_NUMS_STYLE]}>
                {selectedSlot.priceFormatted} por pessoa
              </Text>

              {/* Quantity Stepper */}
              <View style={styles.stepperRow}>
                <Text style={styles.stepperLabel}>QUANTIDADE:</Text>
                <View style={styles.stepperControls}>
                  <Pressable
                    testID="btn-stepper-decrement"
                    accessibilityRole="button"
                    disabled={quantity <= 1}
                    onPress={() => setQuantity(Math.max(1, quantity - 1))}
                    style={styles.stepperBtn}
                  >
                    <Text style={styles.stepperBtnText}>-</Text>
                  </Pressable>
                  <Text testID="stepper-value-text" style={[styles.stepperValue, TABULAR_NUMS_STYLE]}>
                    {quantity}
                  </Text>
                  <Pressable
                    testID="btn-stepper-increment"
                    accessibilityRole="button"
                    disabled={quantity >= selectedSlot.availableSlots}
                    onPress={() =>
                      setQuantity(
                        Math.min(selectedSlot.availableSlots, quantity + 1)
                      )
                    }
                    style={styles.stepperBtn}
                  >
                    <Text style={styles.stepperBtnText}>+</Text>
                  </Pressable>
                </View>
              </View>

              <Pressable
                testID="btn-add-to-cart"
                accessibilityRole="button"
                onPress={handleAdd}
                style={styles.primaryActionBtn}
              >
                <Text style={styles.primaryActionText}>
                  ADICIONAR AO CARRINHO ({formatCentavosToReais(selectedSlot.priceCentavos * quantity)})
                </Text>
              </Pressable>

              <Pressable
                testID="btn-cancel-slot"
                onPress={() => setSelectedSlot(null)}
                style={{ marginTop: 12, alignItems: 'center' }}
              >
                <Text style={styles.cancelText}>CANCELAR</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

// ==========================================
// 11. Carreira Screen Harness
// ==========================================
export interface CarreiraScreenProps {
  onOpenRules: () => void;
}

export function CarreiraScreenHarness({ onOpenRules }: CarreiraScreenProps) {
  const driver = MOCK_DRIVERS[0]; // Nelson Castro
  const stats = MOCK_CAREER_STATS;

  return (
    <ScrollView testID="screen-carreira" style={styles.screenContainer}>
      {/* Driver Header */}
      <View testID="career-driver-header" style={styles.cardContainer}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View testID="career-avatar-circle" style={styles.careerAvatar}>
            <Text style={styles.careerInitials}>{driver.initials}</Text>
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text testID="career-driver-name" style={styles.careerName}>
              {driver.name}
            </Text>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
              <View style={styles.lendaBadge}>
                <Text style={styles.lendaBadgeText}>{driver.category}</Text>
              </View>
              <Text testID="career-xp-text" style={[styles.careerXpText, TABULAR_NUMS_STYLE]}>
                {driver.xp.toLocaleString('pt-BR')} XP
              </Text>
            </View>
          </View>
          <Text testID="career-points-text" style={[styles.careerPointsText, TABULAR_NUMS_STYLE]}>
            {driver.points.toLocaleString('pt-BR')} PTS
          </Text>
        </View>
      </View>

      {/* Efficiency Matrix Card */}
      <View testID="efficiency-card" style={[styles.cardContainer, { marginTop: 16 }]}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeaderTitle}>EFICIÊNCIA</Text>
          <Pressable
            testID="btn-career-ranking-rules"
            accessibilityLabel="Informações do ranking"
            onPress={onOpenRules}
          >
            <Text style={styles.infoIconText}>ⓘ</Text>
          </Pressable>
        </View>

        <View style={styles.matrixGrid}>
          <View style={styles.matrixCell}>
            <Text style={styles.matrixLabel}>TAXA DE VITÓRIA</Text>
            <Text testID="stat-win-rate" style={[styles.matrixVal, TABULAR_NUMS_STYLE]}>
              {stats.efficiency.winRate}%
            </Text>
          </View>
          <View style={styles.matrixCell}>
            <Text style={styles.matrixLabel}>TAXA DE PÓDIO</Text>
            <Text testID="stat-podium-rate" style={[styles.matrixVal, TABULAR_NUMS_STYLE]}>
              {stats.efficiency.podiumRate}%
            </Text>
          </View>
          <View style={styles.matrixCell}>
            <Text style={styles.matrixLabel}>EFICIÊNCIA GERAL</Text>
            <Text testID="stat-overall-efficiency" style={[styles.matrixVal, TABULAR_NUMS_STYLE]}>
              {stats.efficiency.overallEfficiency}%
            </Text>
          </View>
          <View style={styles.matrixCell}>
            <Text style={styles.matrixLabel}>POLES</Text>
            <Text testID="stat-poles-rate" style={[styles.matrixVal, TABULAR_NUMS_STYLE]}>
              {stats.efficiency.polesRate}%
            </Text>
          </View>
          <View style={styles.matrixCell}>
            <Text style={styles.matrixLabel}>MELHORES VOLTAS</Text>
            <Text testID="stat-best-laps-rate" style={[styles.matrixVal, TABULAR_NUMS_STYLE]}>
              {stats.efficiency.bestLapsRate}%
            </Text>
          </View>
          <View style={styles.matrixCell}>
            <Text style={styles.matrixLabel}>CORRIDAS VÁLIDAS</Text>
            <Text testID="stat-valid-races-rate" style={[styles.matrixVal, TABULAR_NUMS_STYLE]}>
              {stats.efficiency.validRacesRate}%
            </Text>
          </View>
        </View>
      </View>

      {/* Qualified Stats Card (10+ Drivers) */}
      <View testID="qualified-stats-card" style={[styles.qualifiedCard, { marginTop: 16 }]}>
        <Text style={styles.qualifiedTitle}>ESTATÍSTICAS QUALIFICADAS (10+ PILOTOS)</Text>
        <View style={styles.qualifiedRow}>
          <Text style={styles.qualifiedLabel}>Corridas Concluídas:</Text>
          <Text testID="stat-qualified-races" style={[styles.qualifiedValue, TABULAR_NUMS_STYLE]}>
            {stats.qualifiedStats.completedRaces}
          </Text>
        </View>
        <View style={styles.qualifiedRow}>
          <Text style={styles.qualifiedLabel}>Vitórias Qualificadas:</Text>
          <Text testID="stat-qualified-wins" style={[styles.qualifiedValue, TABULAR_NUMS_STYLE]}>
            {stats.qualifiedStats.wins}
          </Text>
        </View>
        <View style={styles.qualifiedRow}>
          <Text style={styles.qualifiedLabel}>Pódios Qualificados:</Text>
          <Text testID="stat-qualified-podiums" style={[styles.qualifiedValue, TABULAR_NUMS_STYLE]}>
            {stats.qualifiedStats.podiums}
          </Text>
        </View>
      </View>

      {/* Badges Grid */}
      <View testID="career-badges-section" style={[styles.cardContainer, { marginTop: 16 }]}>
        <Text style={styles.sectionHeaderTitle}>CONQUISTAS E BADGES</Text>
        <View testID="badges-grid" style={styles.badgesGrid}>
          {stats.badges.experience.map((badge) => (
            <View
              key={badge.id}
              testID={`badge-item-${badge.id}`}
              style={styles.badgeItem}
            >
              <View
                style={[
                  styles.badgeIconBox,
                  { borderColor: badge.badgeColor || SPORTS_PALETTE.border },
                ]}
              >
                <Text style={{ color: badge.badgeColor || SPORTS_PALETTE.text }}>🏅</Text>
              </View>
              <Text style={styles.badgeName}>{badge.name}</Text>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

// ==========================================
// 12. Ranking Rules Modal
// ==========================================
export interface RankingRulesModalProps {
  visible: boolean;
  onClose: () => void;
}

export function RankingRulesModalHarness({
  visible,
  onClose,
}: RankingRulesModalProps) {
  return (
    <Modal
      testID="ranking-rules-modal"
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View testID="ranking-rules-card" style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>COMO FUNCIONA O RANKING?</Text>
            <Pressable
              testID="btn-close-ranking-rules"
              accessibilityRole="button"
              onPress={onClose}
            >
              <Text style={styles.closeBtnText}>✕</Text>
            </Pressable>
          </View>

          <Text style={styles.rulesIntro}>
            O Rating de performance é composto por 4 pilares ponderados:
          </Text>

          <View style={styles.rulesList}>
            <Text testID="rule-weight-efficiency" style={styles.ruleItem}>
              • 50% Eficiência (Vitórias e pódios ponderados por corrida)
            </Text>
            <Text testID="rule-weight-wins" style={styles.ruleItem}>
              • 20% Vitórias Absolutas (Escala de referência de 100 vitórias)
            </Text>
            <Text testID="rule-weight-xp" style={styles.ruleItem}>
              • 20% XP Acumulado (Escala Lenda de 60.000 XP)
            </Text>
            <Text testID="rule-weight-races" style={styles.ruleItem}>
              • 10% Assiduidade / Corridas (Escala de 300 corridas)
            </Text>
          </View>

          <View style={styles.cutoffBox}>
            <Text testID="rule-10-drivers-cutoff" style={styles.cutoffText}>
              Regra de Corte: Apenas baterias com 10 ou mais pilotos contam para Vitórias, Pódios Qualificados e ganho de XP.
            </Text>
          </View>

          <Pressable
            testID="btn-understand-rules"
            accessibilityRole="button"
            onPress={onClose}
            style={[styles.primaryActionBtn, { marginTop: 16 }]}
          >
            <Text style={styles.primaryActionText}>ENTENDI</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

// ==========================================
// 13. Complete E2E App Shell Harness
// ==========================================
export function E2EAppShellHarness() {
  const [activeTab, setActiveTab] = useState<TabName>('Home');
  const [isRankingOpen, setIsRankingOpen] = useState(false);
  const [activeNews, setActiveNews] = useState<NewsArticle | null>(null);
  const [isCockpitOpen, setIsCockpitOpen] = useState(false);
  const [isRulesOpen, setIsRulesOpen] = useState(false);

  // Cart State
  const [items, setItems] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);

  const totalQuantity = useMemo(
    () => items.reduce((acc, curr) => acc + curr.quantity, 0),
    [items]
  );
  const totalPriceCentavos = useMemo(
    () => items.reduce((acc, curr) => acc + curr.totalPriceCentavos, 0),
    [items]
  );
  const totalPriceFormatted = useMemo(
    () => formatCentavosToReais(totalPriceCentavos),
    [totalPriceCentavos]
  );

  const cart: CartState = {
    items,
    totalQuantity,
    totalPriceCentavos,
    totalPriceFormatted,
    isCartOpen,
    addItem: (item) => {
      setItems((prev) => {
        const existing = prev.find((i) => i.sessionId === item.sessionId);
        if (existing) {
          const updatedQty = existing.quantity + item.quantity;
          return prev.map((i) =>
            i.sessionId === item.sessionId
              ? {
                  ...i,
                  quantity: updatedQty,
                  totalPriceCentavos: updatedQty * i.unitPriceCentavos,
                }
              : i
          );
        }
        return [
          ...prev,
          {
            ...item,
            totalPriceCentavos: item.quantity * item.unitPriceCentavos,
          },
        ];
      });
    },
    removeItem: (sessionId) => {
      setItems((prev) => prev.filter((i) => i.sessionId !== sessionId));
    },
    updateQuantity: (sessionId, quantity) => {
      if (quantity <= 0) {
        setItems((prev) => prev.filter((i) => i.sessionId !== sessionId));
      } else {
        setItems((prev) =>
          prev.map((i) =>
            i.sessionId === sessionId
              ? {
                  ...i,
                  quantity,
                  totalPriceCentavos: quantity * i.unitPriceCentavos,
                }
              : i
          )
        );
      }
    },
    clearCart: () => setItems([]),
    openCart: () => setIsCartOpen(true),
    closeCart: () => setIsCartOpen(false),
  };

  return (
    <View testID="app-root-shell" style={styles.rootShell}>
      {/* Active Tab Screen */}
      <View style={{ flex: 1 }}>
        {activeTab === 'Home' && (
          <HomeScreenHarness
            onOpenRanking={() => setIsRankingOpen(true)}
            onOpenNews={(n) => setActiveNews(n)}
          />
        )}
        {activeTab === 'Parceiros' && (
          <ParceiroScreenHarness onNavigateAgenda={() => setActiveTab('Agenda')} />
        )}
        {activeTab === 'LiveTime' && (
          <LiveTimeScreenHarness onOpenCockpitHUD={() => setIsCockpitOpen(true)} />
        )}
        {activeTab === 'Agenda' && (
          <AgendaScreenHarness
            onAddToCart={(slot, qty) =>
              cart.addItem({
                sessionId: slot.id,
                sessionTitle: slot.title,
                trackName: 'KARTÓDROMO DE BETIM',
                date: slot.date,
                time: slot.time,
                quantity: qty,
                unitPriceCentavos: slot.priceCentavos,
              })
            }
          />
        )}
        {activeTab === 'Carreira' && (
          <CarreiraScreenHarness onOpenRules={() => setIsRulesOpen(true)} />
        )}
      </View>

      {/* Floating Cart Bar (Above Tabs) */}
      <FloatingCartBarHarness
        cart={cart}
        onPress={() => cart.openCart()}
      />

      {/* Bottom Floating Navigation Tabs */}
      <FloatingTabBarHarness
        activeTab={activeTab}
        onTabPress={(tab) => setActiveTab(tab)}
      />

      {/* Modals & Overlays */}
      <CartModalHarness
        cart={cart}
        visible={cart.isCartOpen}
        onClose={() => cart.closeCart()}
        onConfirmOrder={() => {
          cart.clearCart();
          cart.closeCart();
        }}
      />

      <NewsReaderHarness
        article={activeNews}
        onClose={() => setActiveNews(null)}
      />

      {isRankingOpen && (
        <RankingScreenHarness
          onClose={() => setIsRankingOpen(false)}
          onOpenRules={() => setIsRulesOpen(true)}
        />
      )}

      {isCockpitOpen && (
        <CockpitHUDScreenHarness onClose={() => setIsCockpitOpen(false)} />
      )}

      <RankingRulesModalHarness
        visible={isRulesOpen}
        onClose={() => setIsRulesOpen(false)}
      />
    </View>
  );
}

// ==========================================
// Styles
// ==========================================
const styles = StyleSheet.create({
  rootShell: {
    flex: 1,
    backgroundColor: SPORTS_PALETTE.background,
  },
  screenContainer: {
    flex: 1,
    backgroundColor: SPORTS_PALETTE.background,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 130,
  },
  tabBarContainer: {
    position: 'absolute',
    bottom: 20,
    left: 16,
    right: 16,
    height: 60,
    backgroundColor: '#121214',
    borderRadius: 30,
    borderWidth: 1,
    borderColor: SPORTS_PALETTE.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
  },
  tabButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  activeTabPill: {
    backgroundColor: '#343434',
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  activeTabLabel: {
    color: SPORTS_PALETTE.gold,
  },
  inactiveTabLabel: {
    color: SPORTS_PALETTE.textMuted,
  },
  floatingCartBar: {
    position: 'absolute',
    bottom: 90,
    left: 16,
    right: 16,
    height: 48,
    backgroundColor: SPORTS_PALETTE.gold,
    borderRadius: 24,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  cartBarContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cartBarText: {
    color: '#000000',
    fontWeight: '800',
    fontSize: 13,
  },
  cartBarCta: {
    color: '#000000',
    fontWeight: '800',
    fontSize: 12,
  },
  cardContainer: {
    backgroundColor: SPORTS_PALETTE.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: SPORTS_PALETTE.border,
    padding: 16,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionHeaderTitle: {
    color: SPORTS_PALETTE.text,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  verMaisText: {
    color: SPORTS_PALETTE.gold,
    fontWeight: '700',
    fontSize: 13,
  },
  pillsScroll: {
    flexDirection: 'row',
    marginVertical: 4,
  },
  categoryPill: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: SPORTS_PALETTE.surfaceElevated,
    marginRight: 8,
    borderWidth: 1,
    borderColor: SPORTS_PALETTE.border,
  },
  activePill: {
    backgroundColor: SPORTS_PALETTE.gold,
    borderColor: SPORTS_PALETTE.gold,
  },
  pillText: {
    color: SPORTS_PALETTE.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  activePillText: {
    color: '#000000',
  },
  driverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: SPORTS_PALETTE.border,
  },
  driverPosition: {
    width: 28,
  },
  driverPosText: {
    color: SPORTS_PALETTE.textMuted,
    fontSize: 14,
    fontWeight: '700',
  },
  driverAvatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: SPORTS_PALETTE.surfaceElevated,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  driverInitials: {
    color: SPORTS_PALETTE.gold,
    fontWeight: '800',
    fontSize: 14,
  },
  driverName: {
    color: SPORTS_PALETTE.text,
    fontSize: 14,
    fontWeight: '700',
  },
  driverCategoryText: {
    color: SPORTS_PALETTE.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  pointsBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: SPORTS_PALETTE.gold,
  },
  pointsText: {
    color: SPORTS_PALETTE.gold,
    fontSize: 13,
    fontWeight: '800',
  },
  newsCard: {
    width: 220,
    backgroundColor: SPORTS_PALETTE.surfaceElevated,
    borderRadius: 10,
    padding: 10,
    marginRight: 12,
    borderWidth: 1,
    borderColor: SPORTS_PALETTE.border,
  },
  newsImagePlaceholder: {
    height: 100,
    backgroundColor: '#2A2E35',
    borderRadius: 8,
    justifyContent: 'flex-start',
    padding: 6,
  },
  newsTag: {
    backgroundColor: SPORTS_PALETTE.purple,
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  newsTitle: {
    color: SPORTS_PALETTE.text,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 8,
  },
  newsDate: {
    color: SPORTS_PALETTE.textMuted,
    fontSize: 11,
    marginTop: 4,
  },
  emptyText: {
    color: SPORTS_PALETTE.textMuted,
    fontSize: 14,
    textAlign: 'center',
    marginVertical: 12,
  },
  screenHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  screenHeaderTitle: {
    color: SPORTS_PALETTE.text,
    fontSize: 18,
    fontWeight: '800',
  },
  backBtnText: {
    color: SPORTS_PALETTE.gold,
    fontWeight: '700',
    fontSize: 14,
  },
  infoIconText: {
    color: SPORTS_PALETTE.blue,
    fontSize: 20,
    fontWeight: '800',
  },
  searchInput: {
    height: 44,
    backgroundColor: SPORTS_PALETTE.surface,
    borderWidth: 1,
    borderColor: SPORTS_PALETTE.border,
    borderRadius: 8,
    color: SPORTS_PALETTE.text,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  newsReaderContainer: {
    flex: 1,
    backgroundColor: SPORTS_PALETTE.background,
    padding: 20,
  },
  readerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  shareBtnText: {
    color: SPORTS_PALETTE.gold,
    fontWeight: '700',
  },
  newsTagLarge: {
    color: SPORTS_PALETTE.purpleNeon,
    fontSize: 12,
    fontWeight: '800',
  },
  newsReaderTitle: {
    color: SPORTS_PALETTE.text,
    fontSize: 22,
    fontWeight: '800',
    marginVertical: 10,
  },
  newsReaderMeta: {
    color: SPORTS_PALETTE.textMuted,
    fontSize: 12,
    marginBottom: 16,
  },
  newsReaderBody: {
    color: '#D1D5DB',
    fontSize: 15,
    lineHeight: 24,
  },
  trackTitle: {
    color: SPORTS_PALETTE.text,
    fontSize: 16,
    fontWeight: '800',
  },
  favoriteIcon: {
    fontSize: 22,
    color: SPORTS_PALETTE.textMuted,
  },
  trackContact: {
    color: SPORTS_PALETTE.textMuted,
    fontSize: 13,
    marginTop: 6,
  },
  trackAddress: {
    color: SPORTS_PALETTE.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  trackStatsRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 12,
  },
  trackStatItem: {
    color: SPORTS_PALETTE.gold,
    fontWeight: '700',
    fontSize: 13,
  },
  shortcutsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  shortcutCard: {
    flex: 1,
    backgroundColor: SPORTS_PALETTE.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: SPORTS_PALETTE.border,
    padding: 12,
    alignItems: 'center',
  },
  shortcutTitle: {
    color: SPORTS_PALETTE.text,
    fontSize: 12,
    fontWeight: '800',
  },
  shortcutSubtitle: {
    color: SPORTS_PALETTE.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  refreshIcon: {
    color: SPORTS_PALETTE.gold,
    fontSize: 16,
  },
  mgFlagBadge: {
    backgroundColor: SPORTS_PALETTE.surfaceElevated,
    color: SPORTS_PALETTE.text,
    fontSize: 11,
    fontWeight: '800',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: SPORTS_PALETTE.border,
  },
  dateLabel: {
    color: SPORTS_PALETTE.textMuted,
    fontSize: 13,
    marginVertical: 8,
  },
  liveHeader: {
    marginBottom: 12,
  },
  sessionTitle: {
    color: SPORTS_PALETTE.text,
    fontSize: 18,
    fontWeight: '800',
  },
  sessionSubtitle: {
    color: SPORTS_PALETTE.textMuted,
    fontSize: 12,
    marginTop: 4,
  },
  fastestLapBanner: {
    backgroundColor: SPORTS_PALETTE.purple,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  fastestLapTag: {
    color: '#E9D5FF',
    fontSize: 11,
    fontWeight: '800',
  },
  fastestLapText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    marginTop: 4,
  },
  flagCard: {
    backgroundColor: SPORTS_PALETTE.surface,
    borderRadius: 10,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: SPORTS_PALETTE.border,
    marginBottom: 12,
  },
  flagBadge: {
    backgroundColor: 'rgba(0, 230, 118, 0.15)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: SPORTS_PALETTE.neonGreen,
  },
  flagText: {
    color: SPORTS_PALETTE.neonGreen,
    fontWeight: '800',
    fontSize: 12,
  },
  elapsedTimerText: {
    color: SPORTS_PALETTE.text,
    fontSize: 18,
    fontWeight: '800',
  },
  cockpitHudBtn: {
    backgroundColor: '#000000',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: SPORTS_PALETTE.gold,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cockpitHudBtnText: {
    color: SPORTS_PALETTE.gold,
    fontSize: 13,
    fontWeight: '800',
  },
  telemetryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: SPORTS_PALETTE.border,
  },
  compPos: {
    color: SPORTS_PALETTE.textMuted,
    fontSize: 13,
    fontWeight: '700',
    width: 24,
  },
  compName: {
    color: SPORTS_PALETTE.text,
    fontSize: 13,
    fontWeight: '700',
  },
  compCategory: {
    color: SPORTS_PALETTE.textMuted,
    fontSize: 11,
  },
  bestLapPill: {
    backgroundColor: SPORTS_PALETTE.surfaceElevated,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  fastestLapPurplePill: {
    backgroundColor: SPORTS_PALETTE.purple,
  },
  bestLapText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  diffText: {
    color: SPORTS_PALETTE.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  cockpitContainer: {
    flex: 1,
    backgroundColor: '#000000',
    padding: 16,
    justifyContent: 'space-between',
  },
  cockpitTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cockpitDriverText: {
    color: SPORTS_PALETTE.gold,
    fontSize: 14,
    fontWeight: '800',
  },
  closeHudBtn: {
    padding: 8,
  },
  closeHudText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
  },
  cockpitMainRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 24,
  },
  cockpitPosBox: {
    alignItems: 'center',
    flex: 1,
  },
  cockpitLabel: {
    color: SPORTS_PALETTE.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  cockpitBigPos: {
    color: SPORTS_PALETTE.gold,
    fontSize: 48,
    fontWeight: '900',
  },
  cockpitTimerBox: {
    alignItems: 'center',
    flex: 2,
  },
  cockpitGiantTime: {
    color: '#FFFFFF',
    fontSize: 56,
    fontWeight: '900',
  },
  cockpitDeltaBox: {
    alignItems: 'center',
    flex: 1,
  },
  cockpitDeltaText: {
    fontSize: 20,
    fontWeight: '800',
    marginTop: 8,
  },
  cockpitFooter: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderTopColor: '#222222',
    paddingTop: 12,
  },
  cockpitFooterItem: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  slotCard: {
    backgroundColor: SPORTS_PALETTE.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: SPORTS_PALETTE.border,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  slotTitle: {
    color: SPORTS_PALETTE.text,
    fontSize: 15,
    fontWeight: '800',
  },
  slotCategory: {
    color: SPORTS_PALETTE.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  slotVagas: {
    color: SPORTS_PALETTE.neonGreen,
    fontSize: 12,
    fontWeight: '800',
    marginTop: 4,
  },
  slotPrice: {
    color: SPORTS_PALETTE.gold,
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 6,
  },
  slotActionBtn: {
    backgroundColor: SPORTS_PALETTE.gold,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  slotActionBtnText: {
    color: '#000000',
    fontSize: 11,
    fontWeight: '800',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: SPORTS_PALETTE.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: SPORTS_PALETTE.border,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    color: SPORTS_PALETTE.text,
    fontSize: 18,
    fontWeight: '800',
  },
  modalSubtitle: {
    color: SPORTS_PALETTE.textMuted,
    fontSize: 13,
    marginBottom: 12,
  },
  modalPriceText: {
    color: SPORTS_PALETTE.gold,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 16,
  },
  closeBtnText: {
    color: SPORTS_PALETTE.textMuted,
    fontSize: 18,
    fontWeight: '800',
  },
  stepperRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 16,
  },
  stepperLabel: {
    color: SPORTS_PALETTE.text,
    fontSize: 14,
    fontWeight: '700',
  },
  stepperControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepperBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: SPORTS_PALETTE.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: SPORTS_PALETTE.border,
  },
  stepperBtnText: {
    color: SPORTS_PALETTE.text,
    fontSize: 18,
    fontWeight: '800',
  },
  stepperValue: {
    color: SPORTS_PALETTE.text,
    fontSize: 16,
    fontWeight: '800',
    marginHorizontal: 16,
  },
  primaryActionBtn: {
    backgroundColor: SPORTS_PALETTE.gold,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryActionText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '800',
  },
  secondaryActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  secondaryActionBtn: {
    backgroundColor: SPORTS_PALETTE.surfaceElevated,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: SPORTS_PALETTE.border,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryActionText: {
    color: SPORTS_PALETTE.text,
    fontSize: 12,
    fontWeight: '700',
  },
  disabledBtn: {
    opacity: 0.4,
  },
  cancelText: {
    color: SPORTS_PALETTE.textMuted,
    fontSize: 13,
  },
  emptyCartBox: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyCartText: {
    color: SPORTS_PALETTE.textMuted,
    fontSize: 14,
  },
  cartItemsList: {
    maxHeight: 220,
    marginBottom: 16,
  },
  cartItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: SPORTS_PALETTE.border,
  },
  itemTitle: {
    color: SPORTS_PALETTE.text,
    fontSize: 14,
    fontWeight: '700',
  },
  itemSubtitle: {
    color: SPORTS_PALETTE.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  itemPrice: {
    color: SPORTS_PALETTE.gold,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  removeBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: SPORTS_PALETTE.neonRed,
  },
  removeBtnText: {
    color: SPORTS_PALETTE.neonRed,
    fontSize: 10,
    fontWeight: '800',
  },
  cartFooter: {
    borderTopWidth: 1,
    borderTopColor: SPORTS_PALETTE.border,
    paddingTop: 12,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  totalLabel: {
    color: SPORTS_PALETTE.text,
    fontSize: 15,
    fontWeight: '800',
  },
  totalValue: {
    color: SPORTS_PALETTE.gold,
    fontSize: 16,
    fontWeight: '800',
  },
  cartActionButtons: {
    gap: 8,
  },
  careerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: SPORTS_PALETTE.surfaceElevated,
    borderWidth: 2,
    borderColor: SPORTS_PALETTE.gold,
    justifyContent: 'center',
    alignItems: 'center',
  },
  careerInitials: {
    color: SPORTS_PALETTE.gold,
    fontSize: 18,
    fontWeight: '800',
  },
  careerName: {
    color: SPORTS_PALETTE.text,
    fontSize: 16,
    fontWeight: '800',
  },
  lendaBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: SPORTS_PALETTE.gold,
  },
  lendaBadgeText: {
    color: SPORTS_PALETTE.gold,
    fontSize: 10,
    fontWeight: '800',
  },
  careerXpText: {
    color: SPORTS_PALETTE.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  careerPointsText: {
    color: SPORTS_PALETTE.gold,
    fontSize: 16,
    fontWeight: '800',
  },
  matrixGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  matrixCell: {
    width: '31%',
    backgroundColor: SPORTS_PALETTE.surfaceElevated,
    borderRadius: 8,
    padding: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: SPORTS_PALETTE.border,
  },
  matrixLabel: {
    color: SPORTS_PALETTE.textMuted,
    fontSize: 9,
    fontWeight: '700',
    textAlign: 'center',
  },
  matrixVal: {
    color: SPORTS_PALETTE.neonGreen,
    fontSize: 14,
    fontWeight: '800',
    marginTop: 4,
  },
  qualifiedCard: {
    backgroundColor: '#0F2338',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: SPORTS_PALETTE.blue,
    padding: 16,
  },
  qualifiedTitle: {
    color: SPORTS_PALETTE.blue,
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 10,
  },
  qualifiedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  qualifiedLabel: {
    color: '#D1D5DB',
    fontSize: 13,
  },
  qualifiedValue: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
  badgesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 8,
  },
  badgeItem: {
    alignItems: 'center',
    width: 68,
  },
  badgeIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: SPORTS_PALETTE.surfaceElevated,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeName: {
    color: SPORTS_PALETTE.text,
    fontSize: 10,
    fontWeight: '700',
    marginTop: 4,
    textAlign: 'center',
  },
  rulesIntro: {
    color: SPORTS_PALETTE.text,
    fontSize: 14,
    marginBottom: 12,
  },
  rulesList: {
    gap: 8,
  },
  ruleItem: {
    color: '#D1D5DB',
    fontSize: 13,
    lineHeight: 18,
  },
  cutoffBox: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: SPORTS_PALETTE.blue,
    padding: 10,
    marginTop: 14,
  },
  cutoffText: {
    color: SPORTS_PALETTE.blue,
    fontSize: 12,
    lineHeight: 17,
  },
});
