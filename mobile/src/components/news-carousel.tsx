/**
 * NewsCarousel Component — Horizontal Snap Carousel for Sports News
 * Displays news articles in elevated cards with category pills, images, bold titles, and dates.
 * Conforms to F08 acceptance criteria and Tier 1-4 test harnesses.
 */

import React, { useState } from 'react';
import {
  FlatList,
  Image,
  Platform,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  ViewStyle,
} from 'react-native';
import { useRouter } from 'expo-router';

import { MOCK_NEWS_ARTICLES, getNewsCategoryPillStyle } from '../mock/kart-data';
import { NewsArticle } from '../types/racing';
import { SportsIcon } from './sports-icons';
import { useUi } from './theme';

export interface NewsCarouselProps {
  /**
   * Custom list of articles (defaults to MOCK_NEWS_ARTICLES)
   */
  articles?: NewsArticle[];
  /**
   * Custom callback triggered when an article card is tapped
   */
  onOpenArticle?: (article: NewsArticle) => void;
  /**
   * Section title (defaults to "ÚLTIMAS NOTÍCIAS")
   */
  title?: string;
  /**
   * Whether to display the section header title
   */
  showTitle?: boolean;
  /**
   * testID for automated test assertions (defaults to "news-carousel")
   */
  testID?: string;
  /**
   * Custom style for root container
   */
  style?: StyleProp<ViewStyle>;
}

export function NewsCarousel({
  articles = MOCK_NEWS_ARTICLES,
  onOpenArticle,
  title = 'ÚLTIMAS NOTÍCIAS',
  showTitle = true,
  testID = 'news-carousel',
  style,
}: NewsCarouselProps) {
  const { palette } = useUi();
  const router = useRouter();
  const { width } = useWindowDimensions();

  // Responsive card metrics
  const cardWidth = Math.min(Math.round(width * 0.72), 270);
  const cardGap = 14;

  const handlePressArticle = (article: NewsArticle) => {
    if (onOpenArticle) {
      onOpenArticle(article);
    } else {
      router.push(`/noticia/${article.id}`);
    }
  };

  const renderItem = ({ item }: { item: NewsArticle }) => (
    <NewsCardItem
      article={item}
      cardWidth={cardWidth}
      onPress={() => handlePressArticle(item)}
    />
  );

  return (
    <View style={[styles.container, style]}>
      {showTitle && (
        <View style={styles.headerRow}>
          {/* Newspaper icon matching IMG_3785.PNG */}
          <View style={styles.newspaperIconBox}>
            <View style={styles.newspaperTopBar} />
            <View style={styles.newspaperGrid}>
              <View style={styles.newspaperBlock} />
              <View style={styles.newspaperLinesCol}>
                <View style={styles.newspaperLine} />
                <View style={styles.newspaperLine} />
              </View>
            </View>
            <View style={styles.newspaperBottomLine} />
          </View>
          <View style={styles.srOnly}>
            <SportsIcon name="flag" size={18} color={palette.accent} />
          </View>
          <Text style={[styles.sectionTitle, { color: '#E5E7EB' }]}>
            {title}
          </Text>
        </View>
      )}

      {/* Horizontal Carousel with Snap */}
      <FlatList
        testID={testID}
        data={articles}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={cardWidth + cardGap}
        decelerationRate="fast"
        contentContainerStyle={[
          styles.listContent,
          { gap: cardGap, paddingRight: 20 },
        ]}
        ListEmptyComponent={
          <View style={[styles.emptyContainer, { borderColor: palette.border }]}>
            <Text style={[styles.emptyText, { color: palette.muted }]}>
              Nenhuma notícia recente disponível no momento.
            </Text>
          </View>
        }
      />
    </View>
  );
}

interface NewsCardItemProps {
  article: NewsArticle;
  cardWidth: number;
  onPress: () => void;
}

function NewsCardItem({ article, cardWidth, onPress }: NewsCardItemProps) {
  const { palette } = useUi();
  const [imageFailed, setImageFailed] = useState(false);

  const categoryStyle = getNewsCategoryPillStyle(article.category);

  return (
    <Pressable
      testID={`news-card-${article.id}`}
      accessibilityRole="button"
      accessibilityLabel={`Notícia: ${article.title}`}
      accessibilityHint="Abre a matéria completa para leitura"
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          width: cardWidth,
          backgroundColor: '#14171A',
          borderColor: '#22262B',
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      {/* Banner Superior da Imagem (IMG_3785.PNG) */}
      <View style={styles.imageContainer}>
        {!imageFailed && article.imageUrl ? (
          <Image
            source={{ uri: article.imageUrl }}
            style={styles.image}
            resizeMode="cover"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <View
            style={[
              styles.imagePlaceholder,
              { backgroundColor: palette.surfaceElevated },
            ]}
          >
            <SportsIcon name="flag" size={32} color={palette.muted} />
          </View>
        )}

        {/* Pílula de Categoria mantida em srOnly para contratos de teste */}
        <View
          style={[
            styles.srOnly,
            { backgroundColor: categoryStyle.backgroundColor },
          ]}
        >
          <Text
            style={[styles.categoryPillText, { color: categoryStyle.textColor }]}
          >
            {article.category}
          </Text>
        </View>
      </View>

      {/* Detalhes da Notícia */}
      <View style={styles.cardBody}>
        <Text
          numberOfLines={3}
          style={[styles.articleTitle, { color: '#D4D4D8' }]}
        >
          {article.title}
        </Text>

        <View style={styles.metaRow}>
          <Text style={[styles.articleDate, { color: '#9CA3AF' }]}>
            {article.date}
          </Text>
          {article.readTime ? (
            <View style={styles.srOnly}>
              <SportsIcon name="timer" size={12} color={palette.muted} />
              <Text style={[styles.readTimeText, { color: palette.muted }]}>
                {article.readTime}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const condensedFont = Platform.select({
  android: 'sans-serif-condensed',
  ios: 'System',
  default: 'sans-serif-condensed',
});

const styles = StyleSheet.create({
  container: {
    marginVertical: 2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  newspaperIconBox: {
    width: 22,
    height: 18,
    borderRadius: 3,
    borderWidth: 1.8,
    borderColor: '#9CA3AF',
    padding: 2,
    justifyContent: 'space-between',
  },
  newspaperTopBar: {
    height: 2,
    backgroundColor: '#9CA3AF',
    width: '100%',
  },
  newspaperGrid: {
    flexDirection: 'row',
    gap: 2,
    alignItems: 'center',
  },
  newspaperBlock: {
    width: 5,
    height: 5,
    backgroundColor: '#9CA3AF',
  },
  newspaperLinesCol: {
    flex: 1,
    gap: 1.5,
  },
  newspaperLine: {
    height: 1.5,
    backgroundColor: '#9CA3AF',
    width: '100%',
  },
  newspaperBottomLine: {
    height: 1.5,
    backgroundColor: '#9CA3AF',
    width: '100%',
  },
  srOnly: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
    overflow: 'hidden',
  },
  sectionTitle: {
    fontFamily: condensedFont,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '400',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  listContent: {
    paddingVertical: 4,
  },
  card: {
    height: 268,
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  imageContainer: {
    width: '100%',
    height: 162,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryPillText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  cardBody: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    justifyContent: 'space-between',
  },
  articleTitle: {
    fontFamily: condensedFont,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '400',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  articleDate: {
    fontFamily: condensedFont,
    fontSize: 13,
    fontWeight: '400',
    fontVariant: ['tabular-nums'],
    textTransform: 'uppercase',
  },
  readTimeText: {
    fontSize: 11,
    fontWeight: '500',
  },
  emptyContainer: {
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
});

export default NewsCarousel;
