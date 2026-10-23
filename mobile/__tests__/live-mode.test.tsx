import { renderRouter } from 'expo-router/testing-library';
import { Text } from 'react-native';

import { demoOnly, isDemoMode } from '../src/config/features';
import { getTabBarItems } from '../src/components/floating-tab-bar';
import StartScreen from '../src/components/start-screen';
import { SessionProvider } from '../src/session/provider';

describe('modo loja (sem dados demonstrativos)', () => {
  const originalEnv = process.env.EXPO_PUBLIC_DEMO_MODE;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.EXPO_PUBLIC_DEMO_MODE;
    } else {
      process.env.EXPO_PUBLIC_DEMO_MODE = originalEnv;
    }
  });

  it('desliga o modo demo com EXPO_PUBLIC_DEMO_MODE=0', () => {
    process.env.EXPO_PUBLIC_DEMO_MODE = '0';
    expect(isDemoMode()).toBe(false);
  });

  it('a barra de abas em modo de produção só tem telas com dados reais', () => {
    process.env.EXPO_PUBLIC_DEMO_MODE = '0';
    const items = getTabBarItems(false);
    expect(items.map((item) => item.name)).toEqual(['index', 'agenda', 'reservas', 'livetime', 'carreira']);
  });

  it('rotas fictícias redirecionam para o início quando demo está desligado', async () => {
    process.env.EXPO_PUBLIC_DEMO_MODE = '0';
    const MockScreen = demoOnly(() => <Text>Ranking fictício</Text>);
    const view = await renderRouter(
      {
        '(tabs)/index': () => <Text>Início real</Text>,
        '(tabs)/ranking-teste': () => <MockScreen />,
      },
      { initialUrl: '/(tabs)/ranking-teste' },
    );
    expect(await view.findByText('Início real')).toBeTruthy();
    expect(view.queryByText('Ranking fictício')).toBeNull();
  });

  it('o início de loja não mostra notícias, telemetria nem dados de demonstração (o ranking é o real)', async () => {
    function WrappedStart() {
      return (
        <SessionProvider>
          <StartScreen />
        </SessionProvider>
      );
    }
    const view = await renderRouter({ '(tabs)/index': WrappedStart }, { initialUrl: '/' });
    expect(view.getByText('Agenda')).toBeTruthy();
    expect(view.getByText('Política de privacidade')).toBeTruthy();
    expect(view.queryByText(/notícia|telemetria|demonstrativ|fictíci/i)).toBeNull();
    expect(view.getByText('Ranking')).toBeTruthy();
  });
});
