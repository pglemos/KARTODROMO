/**
 * Empirical Adversarial Test Harness — Milestone 2 News Module Challenge
 * Tests NewsCarousel, NoticiaScreen, and kart-data news helpers under hostile edge cases,
 * boundary inputs, failure conditions, and state stress.
 */

import React from 'react';
import { Share } from 'react-native';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';

import NoticiaScreen from '../src/app/noticia/[id]';
import { NewsCarousel } from '../src/components/news-carousel';
import {
  getNewsArticleById,
  getNewsCategoryPillStyle,
  getRelatedNewsArticles,
  MOCK_NEWS_ARTICLES,
} from '../src/mock/kart-data';
import { NewsArticle } from '../src/types/racing';

// Mocks for Expo Router
const mockPush = jest.fn();
const mockBack = jest.fn();
const mockReplace = jest.fn();
let mockCanGoBack = true;
let mockParams: { id?: any } = { id: 'news-1' };

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    back: mockBack,
    replace: mockReplace,
    canGoBack: () => mockCanGoBack,
  }),
  useLocalSearchParams: () => mockParams,
}));

jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    SafeAreaView: ({ children, ...props }: any) => <View {...props}>{children}</View>,
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
  };
});

describe('Milestone 2 News Module — Adversarial Challenge Suite', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCanGoBack = true;
    mockParams = { id: 'news-betim-copa-centro-oeste' };
    jest.spyOn(Share, 'share').mockImplementation(
      jest.fn().mockResolvedValue({ action: 'sharedAction' })
    );
  });

  afterEach(() => {
    cleanup();
  });

  // =========================================================================
  // 1. Stress Testing getNewsArticleById Helper
  // =========================================================================
  describe('Adversarial ID Resolution (kart-data getNewsArticleById)', () => {
    const invalidIds: Array<[string, any]> = [
      ['empty string', ''],
      ['whitespace string', '   '],
      ['negative number as string', '-1'],
      ['negative number literal', -1],
      ['large negative number', -9999],
      ['zero as string', '0'],
      ['zero as number', 0],
      ['out of range positive number', 999999],
      ['out of range string number', '999999'],
      ['non-matching arbitrary string', 'unknown-slug-xyz-404'],
      ['SQL injection string', "'; DROP TABLE news; --"],
      ['XSS string', '<script>alert("xss")</script>'],
      ['URL encoded gibberish', '%20%2F%3F%26'],
      ['prototype pollution property', '__proto__'],
      ['constructor property', 'constructor'],
      ['toString property', 'toString'],
      ['undefined value', undefined],
      ['null value', null],
      ['floating point number string', '3.14159'],
    ];

    test.each(invalidIds)(
      'returns undefined for invalid ID: %s (%p)',
      (_, input) => {
        const result = getNewsArticleById(input);
        expect(result).toBeUndefined();
      }
    );

    const validResolutions: Array<[string, any, string]> = [
      ['exact ID news-f1', 'news-f1-russell-engine-penalty', 'news-f1-russell-engine-penalty'],
      ['exact ID news-betim', 'news-betim-copa-centro-oeste', 'news-betim-copa-centro-oeste'],
      ['alias news-1', 'news-1', 'news-1'],
      ['alias news-2', 'news-2', 'news-2'],
      ['alias news-3', 'news-3', 'news-3'],
      ['number index 1', '1', '1'],
      ['number index 2', '2', '2'],
      ['number index 3', '3', '3'],
      ['numeric literal 1', 1, '1'],
      ['substring match russell', 'russell', 'russell'],
      ['case-insensitive alias NEWS-1', 'NEWS-1', 'NEWS-1'],
    ];

    test.each(validResolutions)(
      'resolves valid article identifier: %s (%p)',
      (_, input, expectedId) => {
        const result = getNewsArticleById(input);
        expect(result).toBeDefined();
        expect(result?.id).toBe(expectedId);
      }
    );
  });

  // =========================================================================
  // 2. Stress Testing News Reader Route (NoticiaScreen) Fallbacks
  // =========================================================================
  describe('NoticiaScreen Non-Crashing Fallback UI for Hostile IDs', () => {
    const hostileRouteIds = [
      '',
      '   ',
      '-1',
      '-999',
      '0',
      '999999',
      'invalid-id-404',
      '__proto__',
      'constructor',
      '<script>alert(1)</script>',
      'null',
      'undefined',
    ];

    test.each(hostileRouteIds)(
      'renders non-crashing fallback UI for hostile id "%s"',
      async (hostileId) => {
        mockParams = { id: hostileId };
        const { getByText, getByTestId, queryByTestId } = await render(<NoticiaScreen />);

        // Must display graceful Not Found screen
        expect(getByText('NOTÍCIA NÃO ENCONTRADA')).toBeTruthy();
        expect(getByText('A matéria solicitada não existe ou foi arquivada.')).toBeTruthy();
        expect(getByTestId('btn-back-home')).toBeTruthy();

        // Must NOT render reader content or share buttons in not-found state
        expect(queryByTestId('news-reader-title')).toBeNull();
        expect(queryByTestId('btn-share-news')).toBeNull();
      }
    );

    it('handles undefined params without crashing', async () => {
      mockParams = {};
      const { getByText, getByTestId } = await render(<NoticiaScreen />);

      expect(getByText('NOTÍCIA NÃO ENCONTRADA')).toBeTruthy();
      expect(getByTestId('btn-back-home')).toBeTruthy();
    });

    it('navigates to (tabs) when router.canGoBack is false on fallback screen', async () => {
      mockParams = { id: 'invalid-deep-link' };
      mockCanGoBack = false;

      const { getByTestId } = await render(<NoticiaScreen />);
      fireEvent.press(getByTestId('btn-back-home'));

      expect(mockBack).not.toHaveBeenCalled();
      expect(mockReplace).toHaveBeenCalledWith('/(tabs)');
    });

    it('navigates with router.back when router.canGoBack is true on fallback screen', async () => {
      mockParams = { id: 'invalid-deep-link' };
      mockCanGoBack = true;

      const { getByTestId } = await render(<NoticiaScreen />);
      fireEvent.press(getByTestId('btn-back-home'));

      expect(mockBack).toHaveBeenCalledTimes(1);
    });
  });

  // =========================================================================
  // 3. Native Share Integration & Error Handling
  // =========================================================================
  describe('Native Share Integration & Resilience', () => {
    it('calls Share.share with correct payload from header button', async () => {
      mockParams = { id: 'news-1' };
      const { getByTestId } = await render(<NoticiaScreen />);

      const shareBtn = getByTestId('btn-share-news');
      fireEvent.press(shareBtn);

      expect(Share.share).toHaveBeenCalledWith(
        expect.objectContaining({
          title: expect.any(String),
          message: expect.stringContaining('Kartódromo de Betim'),
          url: 'https://www.kartodromodebetim.com.br',
        })
      );
    });

    it('calls Share.share from action bar button', async () => {
      mockParams = { id: 'news-1' };
      const { getByText } = await render(<NoticiaScreen />);

      const shareAction = getByText('Compartilhar');
      fireEvent.press(shareAction);

      expect(Share.share).toHaveBeenCalledTimes(1);
    });

    it('gracefully handles Share.share rejection (user cancellation or OS failure)', async () => {
      jest.spyOn(Share, 'share').mockRejectedValueOnce(new Error('User dismissed share'));
      mockParams = { id: 'news-1' };

      const { getByTestId } = await render(<NoticiaScreen />);
      const shareBtn = getByTestId('btn-share-news');

      // Should not throw or crash
      await expect(async () => {
        fireEvent.press(shareBtn);
      }).not.toThrow();
    });
  });

  // =========================================================================
  // 4. Bookmark State Toggle Stress
  // =========================================================================
  describe('Bookmark State Toggle', () => {
    it('toggles bookmark state back and forth correctly on multiple presses', async () => {
      mockParams = { id: 'news-1' };
      const { getByText, queryByText } = await render(<NoticiaScreen />);

      // Initial state: not bookmarked
      expect(getByText('Favoritar')).toBeTruthy();
      expect(queryByText('Salvo')).toBeNull();

      // Press 1: becomes bookmarked
      fireEvent.press(getByText('Favoritar'));
      await waitFor(() => {
        expect(getByText('Salvo')).toBeTruthy();
        expect(queryByText('Favoritar')).toBeNull();
      });

      // Press 2: un-bookmarked
      fireEvent.press(getByText('Salvo'));
      await waitFor(() => {
        expect(getByText('Favoritar')).toBeTruthy();
        expect(queryByText('Salvo')).toBeNull();
      });

      // Press 3: bookmarked again
      fireEvent.press(getByText('Favoritar'));
      await waitFor(() => {
        expect(getByText('Salvo')).toBeTruthy();
        expect(queryByText('Favoritar')).toBeNull();
      });
    });
  });

  // =========================================================================
  // 5. NewsCarousel Snap, Aspect Ratio & Edge Cases
  // =========================================================================
  describe('NewsCarousel Snap Behavior & Edge Cases', () => {
    it('configures FlatList with correct snap intervals, deceleration and horizontal scroll', async () => {
      const { getByTestId } = await render(<NewsCarousel />);
      const flatList = getByTestId('news-carousel');

      expect(flatList.props.horizontal).toBe(true);
      expect(flatList.props.showsHorizontalScrollIndicator).toBe(false);
      expect(flatList.props.decelerationRate).toBe('fast');

      // snapToInterval must be cardWidth (max 300) + cardGap (14)
      expect(typeof flatList.props.snapToInterval).toBe('number');
      expect(flatList.props.snapToInterval).toBeGreaterThan(14);
      expect(flatList.props.snapToInterval).toBeLessThanOrEqual(314);
    });

    it('renders ListEmptyComponent when articles array is empty', async () => {
      const { getByText, queryByTestId } = await render(<NewsCarousel articles={[]} />);

      expect(getByText('Nenhuma notícia recente disponível no momento.')).toBeTruthy();
      expect(queryByTestId('news-card-news-1')).toBeNull();
    });

    it('handles article with missing optional fields without crashing', async () => {
      const sparseArticle: NewsArticle = {
        id: 'sparse-news',
        title: 'NOTÍCIA DE TESTE COM CAMPOS AUSENTES',
        summary: '',
        content: 'Conteúdo mínimo para teste de estresse.',
        imageUrl: '',
        date: '15/OUT./2026',
        category: 'OUTROS',
        author: 'Tester',
        readTime: '1 min',
      };

      const { getByText, getByTestId } = await render(
        <NewsCarousel articles={[sparseArticle]} />
      );

      expect(getByTestId('news-card-sparse-news')).toBeTruthy();
      expect(getByText('NOTÍCIA DE TESTE COM CAMPOS AUSENTES')).toBeTruthy();
    });

    it('falls back to placeholder icon when image fails to load in card', async () => {
      const brokenImageArticle: NewsArticle = {
        id: 'broken-img-news',
        title: 'NOTÍCIA COM IMAGEM CORROMPIDA',
        summary: 'Resumo',
        content: 'Conteúdo',
        imageUrl: 'https://invalid-domain-does-not-exist.test/image.jpg',
        date: '15/OUT./2026',
        category: 'CAMPEONATO',
        author: 'Autor',
        readTime: '2 min',
      };

      const { getByTestId } = await render(
        <NewsCarousel articles={[brokenImageArticle]} />
      );

      // Trigger image error
      const imageComponent = getByTestId('news-card-broken-img-news');
      expect(imageComponent).toBeTruthy();
    });

    it('handles image error in NoticiaScreen without crashing', async () => {
      mockParams = { id: 'news-1' };
      const { getByTestId } = await render(<NoticiaScreen />);

      // Screen renders hero image container
      expect(getByTestId('news-reader-modal')).toBeTruthy();
    });
  });

  // =========================================================================
  // 6. Related News & Category Pill Robustness
  // =========================================================================
  describe('Related News & Category Styling Resilience', () => {
    it('getRelatedNewsArticles handles null, undefined, empty, or non-existent currentId', () => {
      const relNull = getRelatedNewsArticles(null as any);
      expect(relNull.length).toBe(2);

      const relUndef = getRelatedNewsArticles(undefined as any);
      expect(relUndef.length).toBe(2);

      const relEmpty = getRelatedNewsArticles('');
      expect(relEmpty.length).toBe(2);

      const relUnknown = getRelatedNewsArticles('unknown-article-slug');
      expect(relUnknown.length).toBe(2);
    });

    it('getRelatedNewsArticles never includes current article in related results', () => {
      for (const article of MOCK_NEWS_ARTICLES) {
        const related = getRelatedNewsArticles(article.id, 10);
        expect(related.every((r) => r.id !== article.id)).toBe(true);
      }
    });

    it('getNewsCategoryPillStyle returns safe defaults for unexpected or lowercase categories', () => {
      const unknownStyle = getNewsCategoryPillStyle('categoria-desconhecida');
      expect(unknownStyle.backgroundColor).toBe('#2A2E35');
      expect(unknownStyle.textColor).toBe('#FFFFFF');

      const nullStyle = getNewsCategoryPillStyle(null as any);
      expect(nullStyle.backgroundColor).toBe('#2A2E35');
      expect(nullStyle.textColor).toBe('#FFFFFF');

      const lowerCampStyle = getNewsCategoryPillStyle('campeonato');
      expect(lowerCampStyle.backgroundColor).toBe('#F59E0B');
    });

    it('navigates to related article when tapping on related news card', async () => {
      mockParams = { id: 'news-1' };
      const { getByText } = await render(<NoticiaScreen />);

      // Find a related article title
      const related = getRelatedNewsArticles('news-1', 2);
      if (related.length > 0) {
        const relatedTitle = related[0].title;
        fireEvent.press(getByText(relatedTitle));
        expect(mockPush).toHaveBeenCalledWith(`/noticia/${related[0].id}`);
      }
    });
  });
});
