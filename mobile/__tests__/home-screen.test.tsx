import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import HomeScreen from '../src/components/home-screen';
import { MOCK_DRIVERS, MOCK_NEWS_ARTICLES } from '../src/mock/kart-data';
import { Driver } from '../src/types/racing';

const mockPush = jest.fn();
const mockBack = jest.fn();

jest.mock('expo-router', () => {
  const React = require('react');
  return {
    useRouter: () => ({
      push: mockPush,
      back: mockBack,
      replace: jest.fn(),
      canGoBack: () => true,
    }),
    useLocalSearchParams: () => ({}),
    Link: ({ children, href, asChild }: any) => {
      if (asChild && React.isValidElement(children)) {
        return React.cloneElement(children, {
          onPress: (e: any) => {
            if (children.props.onPress) children.props.onPress(e);
            mockPush(href);
          },
        });
      }
      return children;
    },
  };
});

describe('HomeScreen Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renderiza o cabeçalho oficial com branding de Betim e status da pista', async () => {
    const { getByTestId, getByText, getByLabelText } = await render(<HomeScreen />);

    // Header presente
    expect(getByTestId('home-header')).toBeTruthy();
    // Logo oficial do Kartódromo de Betim
    expect(getByLabelText('Kartódromo Internacional de Betim')).toBeTruthy();
    // Status Pista Aberta
    expect(getByText('PRÉVIA DO APLICATIVO')).toBeTruthy();
    // Botões de ação rápida
    expect(getByText('Agenda da pista')).toBeTruthy();
    expect(getByText('Reservar bateria')).toBeTruthy();
    // Botão Minha Conta
    expect(getByTestId('btn-minha-conta')).toBeTruthy();
  });

  it('renderiza a seção TOP PILOTOS com pílulas de filtro e top 5 pilotos', async () => {
    const { getByTestId, getByText } = await render(<HomeScreen />);

    // Seção Top Pilotos
    expect(getByTestId('home-top-pilotos-section')).toBeTruthy();
    expect(getByTestId('category-filter-pills')).toBeTruthy();

    // Todas as 6 pílulas de categorias
    expect(getByTestId('filter-pill-todos')).toBeTruthy();
    expect(getByTestId('filter-pill-lenda')).toBeTruthy();
    expect(getByTestId('filter-pill-profissional')).toBeTruthy();
    expect(getByTestId('filter-pill-semi-pro')).toBeTruthy();
    expect(getByTestId('filter-pill-amador')).toBeTruthy();
    expect(getByTestId('filter-pill-novato')).toBeTruthy();

    // Top 5 pilotos padrão
    expect(getByTestId('top-pilotos-list')).toBeTruthy();
    expect(getByText('NELSON CASTRO')).toBeTruthy();
    expect(getByText('NC')).toBeTruthy();
    expect(getByText('13.112 PTS')).toBeTruthy();
  });

  it('filtra competidores ao selecionar diferentes categorias', async () => {
    const { getByTestId, getByText, queryByText } = await render(<HomeScreen />);

    // Categoria inicial TODOS exibe Nelson Castro e Toni Siqueira
    expect(getByText('NELSON CASTRO')).toBeTruthy();

    // Filtra por PROFISSIONAL
    fireEvent.press(getByTestId('filter-pill-profissional'));
    await waitFor(() => {
      // Pilotos da categoria PROFISSIONAL aparecem
      const profDrivers = MOCK_DRIVERS.filter((d) => d.category === 'PROFISSIONAL');
      expect(getByText(profDrivers[0].name)).toBeTruthy();
      // Nelson Castro (LENDA) não deve aparecer
      expect(queryByText('NELSON CASTRO')).toBeNull();
    });

    // Retorna para TODOS
    fireEvent.press(getByTestId('filter-pill-todos'));
    await waitFor(() => {
      expect(getByText('NELSON CASTRO')).toBeTruthy();
    });
  });

  it('exibe mensagem amigável de estado vazio quando não há pilotos na categoria', async () => {
    // Injeta mock vazio
    const { getByTestId, getByText } = await render(
      <HomeScreen drivers={[]} initialCategory="NOVATO" />
    );

    expect(getByTestId('empty-pilotos-text')).toBeTruthy();
    expect(getByText('Nenhum piloto nesta categoria.')).toBeTruthy();
  });

  it('aciona callback ou navegação ao tocar em "VER MAIS ›"', async () => {
    const onOpenRanking = jest.fn();
    const { getByTestId } = await render(<HomeScreen onOpenRanking={onOpenRanking} />);

    fireEvent.press(getByTestId('btn-ver-mais-ranking'));
    expect(onOpenRanking).toHaveBeenCalledTimes(1);
  });

  it('navega para /ranking quando onOpenRanking não é fornecido', async () => {
    const { getByTestId } = await render(<HomeScreen />);

    fireEvent.press(getByTestId('btn-ver-mais-ranking'));
    expect(mockPush).toHaveBeenCalledWith('/ranking');
  });

  it('chama onSelectDriver ao tocar na linha de um piloto', async () => {
    const onSelectDriver = jest.fn();
    const { getByTestId } = await render(<HomeScreen onSelectDriver={onSelectDriver} />);

    fireEvent.press(getByTestId('driver-row-driver-nelson-castro'));
    expect(onSelectDriver).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'driver-nelson-castro' })
    );
  });

  it('renderiza o carrossel de notícias e aciona callback ao tocar', async () => {
    const onOpenNews = jest.fn();
    const { getByTestId, getByText } = await render(<HomeScreen onOpenNews={onOpenNews} />);

    // Seção de notícias
    expect(getByTestId('home-news-section')).toBeTruthy();
    expect(getByTestId('news-carousel')).toBeTruthy();

    // Primeiro card de notícia
    const firstArticle = MOCK_NEWS_ARTICLES[0];
    expect(getByTestId(`news-card-${firstArticle.id}`)).toBeTruthy();
    expect(getByText(firstArticle.category)).toBeTruthy();

    // Tocar no card chama onOpenNews
    fireEvent.press(getByTestId(`news-card-${firstArticle.id}`));
    expect(onOpenNews).toHaveBeenCalledWith(
      expect.objectContaining({ id: firstArticle.id })
    );
  });
});
