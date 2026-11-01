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

const mockPush = jest.fn();
const mockBack = jest.fn();
const mockReplace = jest.fn();
const mockUseLocalSearchParams = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    back: mockBack,
    replace: mockReplace,
    canGoBack: () => true,
  }),
  useLocalSearchParams: () => mockUseLocalSearchParams(),
}));

jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    SafeAreaView: ({ children, ...props }: any) => <View {...props}>{children}</View>,
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
  };
});

describe('News Module (M2)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseLocalSearchParams.mockReturnValue({ id: 'news-betim-copa-centro-oeste' });
    jest.spyOn(Share, 'share').mockImplementation(jest.fn().mockResolvedValue({ action: 'sharedAction' }));
  });

  afterEach(() => {
    cleanup();
  });

  describe('News Helpers in kart-data', () => {
    it('recupera artigos por ID exato, por alias ou por número', () => {
      // ID direto
      const art1 = getNewsArticleById('news-betim-copa-centro-oeste');
      expect(art1).toBeDefined();
      expect(art1?.category).toBe('KART BETIM');

      // Alias news-1
      const artAlias1 = getNewsArticleById('news-1');
      expect(artAlias1).toBeDefined();
      expect(artAlias1?.id).toBe('news-1');

      // Alias news-2
      const artAlias2 = getNewsArticleById('news-2');
      expect(artAlias2).toBeDefined();

      // Número '1'
      const artNum1 = getNewsArticleById('1');
      expect(artNum1).toBeDefined();

      // ID inexistente retorna undefined
      expect(getNewsArticleById('nao-existe-xyz')).toBeUndefined();
    });

    it('retorna artigos relacionados excluindo o artigo atual', () => {
      const currentId = 'news-betim-copa-centro-oeste';
      const related = getRelatedNewsArticles(currentId, 2);
      expect(related.length).toBeLessThanOrEqual(2);
      expect(related.every((a) => a.id !== currentId)).toBe(true);
    });

    it('retorna cores semânticas corretas para as pílulas de categorias', () => {
      expect(getNewsCategoryPillStyle('CAMPEONATO').backgroundColor).toBe('#F59E0B');
      expect(getNewsCategoryPillStyle('FÓRMULA 1').backgroundColor).toBe('#3B82F6');
      expect(getNewsCategoryPillStyle('KART BETIM').backgroundColor).toBe('#8B5CF6');
      expect(getNewsCategoryPillStyle('DICAS').backgroundColor).toBe('#00E676');
    });
  });

  describe('NewsCarousel Component', () => {
    it('renderiza o carrossel de notícias com cards e dados corretos', async () => {
      const { getByTestId, getByText } = await render(<NewsCarousel />);

      expect(getByTestId('news-carousel')).toBeTruthy();
      expect(getByText('ÚLTIMAS NOTÍCIAS')).toBeTruthy();

      // Primeiro card
      const firstArticle = MOCK_NEWS_ARTICLES[0];
      expect(getByTestId(`news-card-${firstArticle.id}`)).toBeTruthy();
      expect(getByText(firstArticle.title)).toBeTruthy();
      expect(getByText(firstArticle.category)).toBeTruthy();
    });

    it('dispara onOpenArticle ou router.push ao tocar no card', async () => {
      const onOpenArticle = jest.fn();
      const { getByTestId } = await render(
        <NewsCarousel onOpenArticle={onOpenArticle} />
      );

      const firstArticle = MOCK_NEWS_ARTICLES[0];
      fireEvent.press(getByTestId(`news-card-${firstArticle.id}`));
      expect(onOpenArticle).toHaveBeenCalledWith(
        expect.objectContaining({ id: firstArticle.id })
      );
    });

    it('renderiza mensagem de estado vazio quando não há notícias', async () => {
      const { getByText } = await render(<NewsCarousel articles={[]} />);
      expect(getByText('Nenhuma notícia recente disponível no momento.')).toBeTruthy();
    });
  });

  describe('NoticiaScreen Component (Full Reader)', () => {
    it('exibe tela amigável de erro quando a notícia não for encontrada', async () => {
      mockUseLocalSearchParams.mockReturnValue({ id: 'artigo-inexistente-12345' });
      const { getByText, getByTestId } = await render(<NoticiaScreen />);

      expect(getByText('NOTÍCIA NÃO ENCONTRADA')).toBeTruthy();
      expect(getByText('A matéria solicitada não existe ou foi arquivada.')).toBeTruthy();
      expect(getByTestId('btn-back-home')).toBeTruthy();
    });

    it('renderiza matéria completa com título, categoria, metadados e corpo', async () => {
      const { getByTestId, getByText } = await render(<NoticiaScreen />);

      expect(getByTestId('news-reader-modal')).toBeTruthy();
      expect(getByTestId('news-reader-tag')).toBeTruthy();
      expect(getByTestId('news-reader-title')).toBeTruthy();
      expect(getByTestId('news-reader-body')).toBeTruthy();
      expect(getByText('KART BETIM OFICIAL')).toBeTruthy();
      expect(getByTestId('btn-share-news')).toBeTruthy();
      expect(getByTestId('btn-close-news-reader')).toBeTruthy();
    });

    it('aciona compartilhamento nativo ao tocar no botão de compartilhar', async () => {
      const { getByTestId } = await render(<NoticiaScreen />);

      fireEvent.press(getByTestId('btn-share-news'));
      expect(Share.share).toHaveBeenCalled();
    });

    it('permite favoritar o artigo', async () => {
      const { getByText } = await render(<NoticiaScreen />);

      expect(getByText('Favoritar')).toBeTruthy();
      fireEvent.press(getByText('Favoritar'));
      await waitFor(() => {
        expect(getByText('Salvo')).toBeTruthy();
      });
    });

    it('aciona router.back ao pressionar o botão voltar ou o botão voltar para o início', async () => {
      const { getByTestId } = await render(<NoticiaScreen />);

      fireEvent.press(getByTestId('btn-close-news-reader'));
      expect(mockBack).toHaveBeenCalled();

      fireEvent.press(getByTestId('btn-back-home'));
      expect(mockBack).toHaveBeenCalledTimes(2);
    });
  });
});
