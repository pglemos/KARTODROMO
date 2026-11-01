import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import RankingScreen from '../src/app/ranking';
import { MOCK_DRIVERS } from '../src/mock/kart-data';

const mockPush = jest.fn();
const mockBack = jest.fn();
const mockReplace = jest.fn();
let mockParams: Record<string, string> = {};

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    back: mockBack,
    replace: mockReplace,
    canGoBack: () => true,
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

describe('RankingScreen Component (M2)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockParams = {};
  });

  it('renderiza o cabeçalho, barra de busca, pílulas de categorias e lista inicial de pilotos', async () => {
    const { getByTestId, getByText, getByPlaceholderText } = await render(<RankingScreen />);

    // Tela e cabeçalho
    expect(getByTestId('ranking-screen')).toBeTruthy();
    expect(getByText('RANKING DE PILOTOS')).toBeTruthy();
    expect(getByTestId('btn-back-ranking')).toBeTruthy();
    expect(getByTestId('btn-ranking-rules')).toBeTruthy();

    // Input de busca
    expect(getByTestId('ranking-search-input')).toBeTruthy();
    expect(getByPlaceholderText('Buscar piloto por nome...')).toBeTruthy();

    // Pílulas de filtro
    expect(getByTestId('ranking-filter-todos')).toBeTruthy();
    expect(getByTestId('ranking-filter-lenda')).toBeTruthy();
    expect(getByTestId('ranking-filter-profissional')).toBeTruthy();
    expect(getByTestId('ranking-filter-semi-pro')).toBeTruthy();
    expect(getByTestId('ranking-filter-amador')).toBeTruthy();
    expect(getByTestId('ranking-filter-novato')).toBeTruthy();

    // Primeiro colocado Nelson Castro
    expect(getByText('NELSON CASTRO')).toBeTruthy();
    expect(getByText('NC')).toBeTruthy();
    expect(getByText('13.112 PTS')).toBeTruthy();
    expect(getByTestId('ranking-driver-row-driver-nelson-castro')).toBeTruthy();
  });

  it('exibe subtítulo quando trackName é fornecido nos parâmetros de rota', async () => {
    mockParams = { trackName: 'KARTÓDROMO DE BETIM' };
    const { getByText } = await render(<RankingScreen />);

    expect(getByText('KARTÓDROMO DE BETIM')).toBeTruthy();
  });

  it('filtra pilotos por categoria ao tocar nas pílulas', async () => {
    const { getByTestId, getByText, queryByText } = await render(<RankingScreen />);

    // Inicialmente com TODOS, Nelson Castro (LENDA) e Toni Siqueira (LENDA) aparecem
    expect(getByText('NELSON CASTRO')).toBeTruthy();

    // Filtra por PROFISSIONAL
    fireEvent.press(getByTestId('ranking-filter-profissional'));
    await waitFor(() => {
      // Pilotos da categoria PROFISSIONAL aparecem (ex: André Felisberto, Lucas Silveira)
      const profDrivers = MOCK_DRIVERS.filter((d) => d.category === 'PROFISSIONAL');
      expect(getByText(profDrivers[0].name)).toBeTruthy();
      // Nelson Castro (LENDA) não deve aparecer
      expect(queryByText('NELSON CASTRO')).toBeNull();
    });

    // Filtra por LENDA
    fireEvent.press(getByTestId('ranking-filter-lenda'));
    await waitFor(() => {
      expect(getByText('NELSON CASTRO')).toBeTruthy();
    });

    // Retorna para TODOS
    fireEvent.press(getByTestId('ranking-filter-todos'));
    await waitFor(() => {
      expect(getByText('NELSON CASTRO')).toBeTruthy();
    });
  });

  it('realiza busca insensível a acentos e maiúsculas/minúsculas', async () => {
    const { getByTestId, getByText, queryByText } = await render(<RankingScreen />);
    const searchInput = getByTestId('ranking-search-input');

    // Busca por "andre" deve encontrar "ANDRÉ FELISBERTO"
    fireEvent.changeText(searchInput, 'andre');
    await waitFor(() => {
      expect(getByText('ANDRÉ FELISBERTO')).toBeTruthy();
      expect(queryByText('NELSON CASTRO')).toBeNull();
    });

    // Busca por "junior" deve encontrar "AGENOR JÚNIOR"
    fireEvent.changeText(searchInput, 'junior');
    await waitFor(() => {
      expect(getByText('AGENOR JÚNIOR')).toBeTruthy();
      expect(queryByText('ANDRÉ FELISBERTO')).toBeNull();
    });

    // Busca por "camara" deve encontrar "FLAVIO VICTOR CÂMARA"
    fireEvent.changeText(searchInput, 'camara');
    await waitFor(() => {
      expect(getByText('FLAVIO VICTOR CÂMARA')).toBeTruthy();
    });

    // Limpa a busca
    fireEvent.changeText(searchInput, '');
    await waitFor(() => {
      expect(getByText('NELSON CASTRO')).toBeTruthy();
    });
  });

  it('exibe estado vazio e botão para limpar filtros quando nenhum resultado for encontrado', async () => {
    const { getByTestId, getByText, queryByText } = await render(<RankingScreen />);
    const searchInput = getByTestId('ranking-search-input');

    fireEvent.changeText(searchInput, 'PilotoInexistenteXYZ');
    await waitFor(() => {
      expect(getByTestId('ranking-empty-state')).toBeTruthy();
      expect(getByText('Nenhum piloto encontrado.')).toBeTruthy();
      expect(getByText('LIMPAR FILTROS')).toBeTruthy();
      expect(queryByText('NELSON CASTRO')).toBeNull();
    });

    // Clicar em LIMPAR FILTROS restaura a lista
    fireEvent.press(getByText('LIMPAR FILTROS'));
    await waitFor(() => {
      expect(getByText('NELSON CASTRO')).toBeTruthy();
    });
  });

  it('abre e fecha o modal de regras do ranking', async () => {
    const { getByTestId, getByText, queryByTestId } = await render(<RankingScreen />);

    // Modal começa fechado
    expect(queryByTestId('ranking-rules-card')).toBeNull();

    // Tocar no botão de regras (i)
    fireEvent.press(getByTestId('btn-ranking-rules'));
    await waitFor(() => {
      expect(getByTestId('ranking-rules-modal')).toBeTruthy();
      expect(getByText('COMO FUNCIONA O RANKING?')).toBeTruthy();
      expect(getByText('SEU RATING')).toBeTruthy();
      expect(getByText('SEU XP')).toBeTruthy();
      expect(getByText('REGRAS DO XP')).toBeTruthy();
      expect(getByTestId('rule-10-drivers-cutoff')).toBeTruthy();
    });

    // Fechar pelo botão "ENTENDI"
    fireEvent.press(getByTestId('btn-understand-rules'));
    await waitFor(() => {
      expect(queryByTestId('ranking-rules-card')).toBeNull();
    });
  });

  it('navega para o perfil do piloto em /carreira ao tocar em um item da lista', async () => {
    const { getByTestId } = await render(<RankingScreen />);

    fireEvent.press(getByTestId('ranking-driver-row-driver-nelson-castro'));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/(tabs)/carreira',
      params: { driverId: 'driver-nelson-castro' },
    });
  });

  it('aciona navegação de retorno ao tocar no botão voltar', async () => {
    const { getByTestId } = await render(<RankingScreen />);

    fireEvent.press(getByTestId('btn-back-ranking'));
    expect(mockBack).toHaveBeenCalled();
  });
});
