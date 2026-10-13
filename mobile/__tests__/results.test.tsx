import { render, waitFor } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';

import ResultsScreen from '../src/app/(tabs)/resultados';
import { useSession } from '../src/session/provider';

jest.mock('../src/session/provider', () => ({ useSession: jest.fn() }));

jest.mock('expo-router', () => {
  const React = jest.requireActual('react') as typeof import('react');
  return {
    Link: ({ children }: PropsWithChildren) => children,
    router: { push: jest.fn(), replace: jest.fn() },
    useFocusEffect: (effect: React.EffectCallback) => React.useEffect(effect, [effect]),
  };
});

const accessSession = {
  accessToken: `test-${crypto.randomUUID()}`,
  refreshToken: `test-${crypto.randomUUID()}`,
  accessTokenExpiresAt: new Date(Date.now() + 60_000).toISOString(),
  refreshTokenExpiresAt: new Date(Date.now() + 86_400_000).toISOString(),
};
const originalFetch = globalThis.fetch;
let fetchMock: jest.Mock<Promise<Response>, [input: URL | RequestInfo, init?: RequestInit]>;
let publicResults: unknown[];
let personalResults: unknown;

function apiResponse(body: unknown): Response {
  return { ok: true, status: 200, json: async () => body } as Response;
}

function setSession(value: typeof accessSession | null) {
  jest.mocked(useSession).mockReturnValue({
    session: value,
    isLoading: false,
    login: jest.fn(),
    logout: jest.fn(),
    refresh: jest.fn(),
  });
}

function requests(pathname: string) {
  return fetchMock.mock.calls.filter(([url]) => new URL(String(url)).pathname === pathname);
}

beforeEach(() => {
  jest.clearAllMocks();
  publicResults = [{
    sessionId: 'sessao-publicada',
    eventName: 'Treino oficial · TESTE CODEX',
    eventDate: '2026-10-13',
    results: [{ displayName: 'Ana Silva', position: 1, kart: '12', laps: 4, bestLapMs: 29_340 }],
  }];
  personalResults = {
    vinculo: 'pendente',
    mensagem: 'Para ver seu histórico, procure a recepção.',
    results: [],
  };
  fetchMock = jest.fn(async (input) => {
    const pathname = new URL(String(input)).pathname;
    if (pathname === '/api/mobile/v1/results') return apiResponse(publicResults);
    if (pathname === '/api/mobile/v1/results/me') return apiResponse(personalResults);
    throw new Error(`Unexpected request ${pathname}`);
  });
  globalThis.fetch = fetchMock as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  jest.restoreAllMocks();
});

describe('resultados oficiais e histórico do cliente', () => {
  it('mostra os resultados publicados pela API e não reapresenta uma sessão retirada', async () => {
    setSession(null);
    const view = await render(<ResultsScreen />);

    expect(await view.findByText('Treino oficial · TESTE CODEX')).toBeTruthy();
    expect(view.getByText(/Ana Silva/)).toBeTruthy();
    expect(view.queryByText('Corrida retirada · TESTE CODEX')).toBeNull();
    expect(requests('/api/mobile/v1/results')).toHaveLength(1);
    expect(requests('/api/mobile/v1/results/me')).toHaveLength(0);
  });

  it('carrega o histórico oficial apenas com sessão vinculada e envia o token', async () => {
    setSession(accessSession);
    personalResults = {
      vinculo: 'validado',
      results: [{
        sessionId: 'historico-validado',
        eventName: 'Bateria de outubro',
        eventDate: '2026-10-12',
        displayName: 'Ana Silva',
        position: 2,
        kart: '7',
        laps: 12,
        bestLapMs: 28_950,
      }],
    };
    const view = await render(<ResultsScreen />);

    expect(await view.findByText('Bateria de outubro')).toBeTruthy();
    expect(view.getByText(/2º lugar/)).toBeTruthy();
    const [historyRequest] = requests('/api/mobile/v1/results/me');
    expect(historyRequest[1]?.headers).toMatchObject({ authorization: `Bearer ${accessSession.accessToken}` });
  });

  it('orienta conta sem vínculo sem expor dados de cadastro', async () => {
    setSession(accessSession);
    const view = await render(<ResultsScreen />);

    expect(await view.findByText('Para ver seu histórico, procure a recepção.')).toBeTruthy();
    expect(view.queryByText(/CPF|e-mail cadastrado|cliente encontrado/i)).toBeNull();
    expect(requests('/api/mobile/v1/results/me')).toHaveLength(1);
  });

  it('limpa o histórico anterior enquanto carrega outra conta', async () => {
    setSession(accessSession);
    personalResults = {
      vinculo: 'validado',
      results: [{
        sessionId: 'historico-anterior',
        eventName: 'Histórico da primeira conta',
        eventDate: '2026-10-12',
        displayName: 'Ana Silva',
        position: 1,
        kart: '12',
        laps: 3,
        bestLapMs: 29_100,
      }],
    };
    const view = await render(<ResultsScreen />);
    expect(await view.findByText('Histórico da primeira conta')).toBeTruthy();

    const secondToken = 'second-account-token';
    const secondSession = { ...accessSession, accessToken: secondToken };
    let finishSecondRequest: ((response: Response) => void) | undefined;
    const previousImplementation = fetchMock.getMockImplementation();
    fetchMock.mockImplementation(async (input, init) => {
      const pathname = new URL(String(input)).pathname;
      const authorization = new Headers(init?.headers).get('authorization');
      if (pathname === '/api/mobile/v1/results/me' && authorization === `Bearer ${secondToken}`) {
        return await new Promise<Response>((resolve) => { finishSecondRequest = resolve; });
      }
      if (previousImplementation) return previousImplementation(input, init);
      throw new Error(`Unexpected request ${pathname}`);
    });

    setSession(secondSession);
    await view.rerender(<ResultsScreen />);
    await waitFor(() => expect(finishSecondRequest).toBeDefined());
    expect(view.queryByText('Histórico da primeira conta')).toBeNull();

    finishSecondRequest?.(apiResponse({
      vinculo: 'pendente',
      mensagem: 'Para ver seu histórico, procure a recepção.',
      results: [],
    }));
    expect(await view.findByText('Para ver seu histórico, procure a recepção.')).toBeTruthy();
  });
});
