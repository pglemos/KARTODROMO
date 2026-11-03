/**
 * Full News Article Reader Screen — `src/app/noticia/[id].tsx`
 * Route parameter: id (e.g. 'news-f1-russell-engine-penalty', 'news-1')
 * Conforms to F09 acceptance criteria and Tier 1-4 test harnesses.
 */

import { demoOnly } from '../../config/features';
import React, { useState } from 'react';
import {
  Image,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SportsIcon } from '../../components/sports-icons';
import { useUi } from '../../components/theme';
import {
  getNewsArticleById,
  getNewsCategoryPillStyle,
  getRelatedNewsArticles,
  MOCK_NEWS_ARTICLES,
} from '../../mock/kart-data';

const CONDENSED_FONT = Platform.select({
  android: 'sans-serif-condensed',
  ios: 'Arial Narrow',
  default: 'sans-serif-condensed',
});

function NoticiaScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const { palette } = useUi();

  // Active article retrieved via helper
  const article = getNewsArticleById(id ?? '') ?? MOCK_NEWS_ARTICLES[0];
  const isFound = Boolean(getNewsArticleById(id ?? ''));

  const [isBookmarked, setIsBookmarked] = useState(false);
  const [imageError, setImageError] = useState(false);

  // Related news
  const relatedNews = getRelatedNewsArticles(article?.id ?? '', 2);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  };

  const handleShare = async () => {
    if (!article) return;
    try {
      await Share.share({
        title: article.title,
        message: `${article.title}\n\n${article.summary}\n\nLeia no app oficial do Kartódromo de Betim: https://www.kartodromodebetim.com.br`,
        url: 'https://www.kartodromodebetim.com.br',
      });
    } catch {
      // Silent catch for share dismiss
    }
  };

  // Not Found State
  if (!article || !isFound) {
    return (
      <SafeAreaView
        testID="news-reader-modal"
        edges={['top', 'bottom', 'left', 'right']}
        style={[styles.safeArea, { backgroundColor: '#1A1D21' }]}
      >
        <View style={styles.notFoundContainer}>
          <SportsIcon name="helmet" size={56} color={palette.accent} />
          <Text style={[styles.notFoundTitle, { color: palette.text }]}>
            NOTÍCIA NÃO ENCONTRADA
          </Text>
          <Text style={[styles.notFoundSubtitle, { color: palette.muted }]}>
            A matéria solicitada não existe ou foi arquivada.
          </Text>
          <TouchableOpacity
            testID="btn-back-home"
            activeOpacity={0.7}
            onPress={handleBack}
            style={[styles.returnButton, { backgroundColor: palette.silver }]}
          >
            <Text style={[styles.returnButtonText, { color: palette.onSilver }]}>
              VOLTAR PARA O INÍCIO
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const categoryStyle = getNewsCategoryPillStyle(article.category);

  return (
    <SafeAreaView
      testID="news-reader-modal"
      edges={['top', 'bottom', 'left', 'right']}
      style={[styles.safeArea, { backgroundColor: '#1A1D21' }]}
    >
      {/* 1. Header Fixo com Botão Voltar, Título + Subtítulo e Compartilhar */}
      <View style={styles.headerBar}>
        <Pressable
          testID="btn-close-news-reader"
          accessibilityRole="button"
          accessibilityLabel="Voltar"
          onPress={handleBack}
          style={styles.headerIconButton}
        >
          <SportsIcon name="back" size={22} color="#FFFFFF" />
          <Text style={styles.srOnly}>VOLTAR</Text>
        </Pressable>

        <View style={styles.headerTitleBlock}>
          <Text style={styles.headerTitle}>NOTÍCIA</Text>
          <Text numberOfLines={1} style={styles.headerSubtitle}>
            {article.title}
          </Text>
        </View>

        <Pressable
          testID="btn-share-news"
          accessibilityRole="button"
          accessibilityLabel="Compartilhar notícia"
          onPress={handleShare}
          style={styles.headerIconButton}
        >
          <SportsIcon name="share" size={20} color="#FFFFFF" />
        </Pressable>
      </View>

      {/* 2. Conteúdo com Rolagem */}
      <ScrollView
        testID="news-reader-content"
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Motorsport Subheader Bar */}
        <View style={styles.motorsportTopBar}>
          <View style={styles.motorsportBrandRow}>
            <Text style={styles.motorsportMenuGlyph}>≡</Text>
            <Text style={styles.motorsportBrandText}>motorsport</Text>
            <View style={{ flex: 1 }} />
            <View style={styles.motorsportUserBadge}>
              <SportsIcon name="helmet" size={14} color="#FFFFFF" />
            </View>
          </View>
          <View style={styles.motorsportSubNavRow}>
            <Text style={styles.motorsportSubNavActive}>
              {article.category} ⌄
            </Text>
            <Text style={styles.motorsportSubNavItem}>HOME</Text>
            <Text style={styles.motorsportSubNavItem}>NOTÍCIAS</Text>
            <Text style={styles.motorsportSubNavItem}>RESULTADOS</Text>
          </View>
        </View>

        <View style={styles.articleContentPadding}>
          {/* Pílulas de Categoria */}
          <View style={styles.categoryRow}>
            <View style={styles.ultimasNoticiasPill}>
              <Text style={styles.ultimasNoticiasPillText}>
                ÚLTIMAS NOTÍCIAS
              </Text>
            </View>
            <View
              style={[
                styles.categoryLargePill,
                { backgroundColor: '#23272D' },
              ]}
            >
              <Text
                testID="news-reader-tag"
                style={[
                  styles.categoryLargePillText,
                  { color: '#FFFFFF' },
                ]}
              >
                {article.category}
              </Text>
            </View>
            <Text style={styles.srOnly}>KART BETIM OFICIAL</Text>
            <Text style={styles.srOnly}>{categoryStyle.backgroundColor}</Text>
          </View>

          {/* Título Principal */}
          <Text testID="news-reader-title" style={styles.articleMainTitle}>
            {article.title}
          </Text>

          {/* Subtítulo / Lead */}
          {article.summary ? (
            <Text style={styles.articleLead}>{article.summary}</Text>
          ) : null}

          {/* Metadados: Autor, Data e Leitura */}
          <View style={styles.metadataContainer}>
            <View style={styles.authorAccentBar} />
            <View>
              <Text style={styles.metaAuthorName}>{article.author}</Text>
              <Text style={styles.metaText}>
                Publicado: {article.date}
                {article.readTime ? ` • ${article.readTime}` : ''}
              </Text>
            </View>
          </View>

          {/* Barra Compacta de Ações (Bookmark & Comentários) */}
          <View style={styles.compactActionRow}>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setIsBookmarked(!isBookmarked)}
              style={styles.actionItem}
            >
              <SportsIcon
                name="star"
                size={18}
                color={isBookmarked ? palette.accent : '#FFFFFF'}
              />
              <Text style={styles.srOnly}>
                {isBookmarked ? 'Salvo' : 'Favoritar'}
              </Text>
            </TouchableOpacity>

            <View style={styles.actionItem}>
              <SportsIcon name="info" size={18} color="#FFFFFF" />
              <Text style={styles.compactActionCount}>
                {article.commentsCount ?? 2}
              </Text>
              <Text style={styles.srOnly}>Comentários</Text>
            </View>

            <TouchableOpacity
              activeOpacity={0.7}
              onPress={handleShare}
              style={styles.srOnly}
            >
              <Text>Compartilhar</Text>
            </TouchableOpacity>
          </View>

          {/* Imagem Hero do Artigo com borda superior amarela */}
          <View style={styles.heroImageContainer}>
            {!imageError && article.imageUrl ? (
              <Image
                source={{ uri: article.imageUrl }}
                style={styles.heroImage}
                resizeMode="cover"
                onError={() => setImageError(true)}
              />
            ) : (
              <View
                style={[
                  styles.heroPlaceholder,
                  { backgroundColor: palette.surfaceElevated },
                ]}
              >
                <SportsIcon name="flag" size={48} color={palette.muted} />
              </View>
            )}
          </View>

          {/* Corpo Completo da Matéria */}
          <View style={styles.bodyContainer}>
            <Text
              testID="news-reader-body"
              style={[styles.paragraphText, { color: '#E4E4E7' }]}
            >
              {article.content}
            </Text>
          </View>

          {/* Tags Relacionadas */}
          {article.tags && article.tags.length > 0 && (
            <View style={styles.tagsContainer}>
              <Text style={[styles.tagsLabel, { color: palette.muted }]}>
                TAGS:
              </Text>
              <View style={styles.tagsList}>
                {article.tags.map((tag) => (
                  <View
                    key={tag}
                    style={[
                      styles.tagBadge,
                      {
                        backgroundColor: palette.surfaceElevated,
                        borderColor: palette.border,
                      },
                    ]}
                  >
                    <Text style={[styles.tagBadgeText, { color: palette.text }]}>
                      #{tag}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Seção de Matérias Relacionadas */}
          {relatedNews.length > 0 && (
            <View style={styles.relatedSection}>
              <Text style={[styles.relatedTitle, { color: palette.text }]}>
                NOTÍCIAS RELACIONADAS
              </Text>
              <View style={styles.relatedList}>
                {relatedNews.map((rel) => (
                  <Pressable
                    key={rel.id}
                    onPress={() => router.push(`/noticia/${rel.id}`)}
                    style={[
                      styles.relatedCard,
                      {
                        backgroundColor: palette.surface,
                        borderColor: palette.border,
                      },
                    ]}
                  >
                    <Image
                      source={{ uri: rel.imageUrl }}
                      style={styles.relatedImage}
                      resizeMode="cover"
                    />
                    <View style={styles.relatedContent}>
                      <Text
                        numberOfLines={2}
                        style={[styles.relatedHeadline, { color: palette.text }]}
                      >
                        {rel.title}
                      </Text>
                      <Text style={[styles.relatedDate, { color: palette.muted }]}>
                        {rel.date} • {rel.readTime}
                      </Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {/* Botão de Retorno à Home */}
          <View style={styles.bottomCtaContainer}>
            <TouchableOpacity
              testID="btn-back-home"
              activeOpacity={0.7}
              onPress={handleBack}
              style={[styles.returnButton, { backgroundColor: palette.silver }]}
            >
              <Text
                style={[styles.returnButtonText, { color: palette.onSilver }]}
              >
                VOLTAR PARA O INÍCIO
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1A1D21',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  headerIconButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleBlock: {
    flex: 1,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontFamily: CONDENSED_FONT,
    fontSize: 21,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  headerSubtitle: {
    color: '#9CA3AF',
    fontFamily: CONDENSED_FONT,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    marginTop: 1,
  },
  srOnly: {
    position: 'absolute',
    width: 1,
    height: 1,
    overflow: 'hidden',
    opacity: 0,
  },
  scrollView: {
    flex: 1,
    backgroundColor: '#0E1216',
  },
  scrollContent: {
    paddingBottom: 40,
  },
  motorsportTopBar: {
    backgroundColor: '#12161B',
    borderBottomWidth: 1,
    borderBottomColor: '#23272D',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
  },
  motorsportBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  motorsportMenuGlyph: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
  },
  motorsportBrandText: {
    color: '#FACC15',
    fontSize: 19,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  motorsportUserBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  motorsportSubNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
  },
  motorsportSubNavActive: {
    color: '#FACC15',
    fontFamily: CONDENSED_FONT,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  motorsportSubNavItem: {
    color: '#D4D4D8',
    fontFamily: CONDENSED_FONT,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  articleContentPadding: {
    paddingHorizontal: 18,
    paddingTop: 18,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  ultimasNoticiasPill: {
    backgroundColor: '#FACC15',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 3,
  },
  ultimasNoticiasPillText: {
    color: '#000000',
    fontFamily: CONDENSED_FONT,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  categoryLargePill: {
    alignSelf: 'flex-start',
    borderRadius: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  categoryLargePillText: {
    fontFamily: CONDENSED_FONT,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  articleMainTitle: {
    color: '#FFFFFF',
    fontFamily: CONDENSED_FONT,
    fontSize: 25,
    lineHeight: 30,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  articleLead: {
    color: '#D4D4D8',
    fontSize: 15,
    lineHeight: 21,
    marginBottom: 16,
  },
  metadataContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  authorAccentBar: {
    width: 2,
    height: 30,
    backgroundColor: '#3B82F6',
  },
  metaAuthorName: {
    color: '#60A5FA',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 2,
  },
  metaText: {
    color: '#9CA3AF',
    fontSize: 11,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
  },
  compactActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    marginBottom: 16,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  compactActionCount: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  heroImageContainer: {
    width: '100%',
    height: 200,
    borderTopWidth: 3,
    borderTopColor: '#FACC15',
    overflow: 'hidden',
    marginBottom: 18,
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bodyContainer: {
    marginBottom: 20,
  },
  paragraphText: {
    fontSize: 15,
    lineHeight: 24,
  },
  tagsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    flexWrap: 'wrap',
    gap: 8,
  },
  tagsLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  tagsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tagBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  tagBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  relatedSection: {
    marginTop: 12,
    marginBottom: 24,
  },
  relatedTitle: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  relatedList: {
    gap: 10,
  },
  relatedCard: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    height: 80,
  },
  relatedImage: {
    width: 90,
    height: '100%',
  },
  relatedContent: {
    flex: 1,
    padding: 10,
    justifyContent: 'space-between',
  },
  relatedHeadline: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  relatedDate: {
    fontSize: 10,
    fontWeight: '500',
  },
  bottomCtaContainer: {
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 20,
  },
  returnButton: {
    borderRadius: 9999,
    paddingHorizontal: 28,
    paddingVertical: 12,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  returnButtonText: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  notFoundContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  notFoundTitle: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0.5,
    textAlign: 'center',
    marginTop: 8,
  },
  notFoundSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
  },
});

export default demoOnly(NoticiaScreen);
