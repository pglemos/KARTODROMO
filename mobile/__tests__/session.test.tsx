import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';

import { authApi } from '../src/api/client';
import type { SessionTokens } from '../src/api/contracts';
import { SessionProvider, useSession } from '../src/session/provider';
import * as secureStorage from '../src/session/secure-storage';

jest.mock('../src/api/client', () => ({
  authApi: {
    login: jest.fn(),
    refresh: jest.fn(),
    logout: jest.fn(),
  },
}));

jest.mock('../src/session/secure-storage', () => ({
  readSession: jest.fn(),
  saveSession: jest.fn(),
  clearSession: jest.fn(),
}));

const currentSession: SessionTokens = {
  accessToken: 'access-current',
  refreshToken: 'refresh-current',
  accessTokenExpiresAt: new Date(Date.now() + 60_000).toISOString(),
  refreshTokenExpiresAt: new Date(Date.now() + 86_400_000).toISOString(),
};

const renewedSession: SessionTokens = {
  ...currentSession,
  accessToken: 'access-renewed',
  refreshToken: 'refresh-renewed',
  accessTokenExpiresAt: new Date(Date.now() + 120_000).toISOString(),
};

function wrapper({ children }: PropsWithChildren) {
  return <SessionProvider>{children}</SessionProvider>;
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(secureStorage.readSession).mockResolvedValue(null);
  jest.mocked(secureStorage.saveSession).mockResolvedValue(undefined);
  jest.mocked(secureStorage.clearSession).mockResolvedValue(undefined);
});

describe('sessão do app', () => {
  it('não restaura a conta antiga depois de um login novo durante a inicialização', async () => {
    let finishRestore!: (value: SessionTokens) => void;
    jest.mocked(secureStorage.readSession).mockImplementation(() => new Promise((resolve) => { finishRestore = resolve; }));
    jest.mocked(authApi.login).mockResolvedValue(renewedSession);
    const { result } = await renderHook(() => useSession(), { wrapper });
    await waitFor(() => expect(finishRestore).toBeDefined());
    let login!: Promise<void>;
    await act(async () => { login = result.current.login('teste@example.com', 'test-password'); });
    await act(async () => { finishRestore(currentSession); await login; });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.session).toEqual(renewedSession);
  });

  it('não ressuscita sessão quando refresh termina depois do logout', async () => {
    jest.mocked(secureStorage.readSession).mockResolvedValue(currentSession);
    let finishRefresh!: (value: SessionTokens) => void;
    jest.mocked(authApi.refresh).mockImplementation(() => new Promise((resolve) => { finishRefresh = resolve; }));
    jest.mocked(authApi.logout).mockResolvedValue(undefined);
    const { result } = await renderHook(() => useSession(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    let refresh!: Promise<SessionTokens | null>;
    let logout!: Promise<void>;
    await act(async () => { refresh = result.current.refresh(); });
    await waitFor(() => expect(finishRefresh).toBeDefined());
    await act(async () => { logout = result.current.logout(); });
    await act(async () => { finishRefresh(renewedSession); await Promise.all([refresh, logout]); });
    expect(result.current.session).toBeNull();
    expect(jest.mocked(secureStorage.clearSession).mock.invocationCallOrder.at(-1)).toBeGreaterThan(jest.mocked(secureStorage.saveSession).mock.invocationCallOrder.at(-1)!);
  });
  it('restores a valid session from secure storage', async () => {
    jest.mocked(secureStorage.readSession).mockResolvedValue(currentSession);

    const { result } = await renderHook(() => useSession(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.session).toEqual(currentSession);
    expect(authApi.refresh).not.toHaveBeenCalled();
  });

  it('refreshes an expired access token once during restoration', async () => {
    jest.mocked(secureStorage.readSession).mockResolvedValue({
      ...currentSession,
      accessTokenExpiresAt: new Date(Date.now() - 1).toISOString(),
    });
    jest.mocked(authApi.refresh).mockResolvedValue(renewedSession);

    const { result } = await renderHook(() => useSession(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(authApi.refresh).toHaveBeenCalledTimes(1);
    expect(secureStorage.saveSession).toHaveBeenCalledWith(renewedSession);
    expect(result.current.session).toEqual(renewedSession);
  });

  it('coalesces concurrent refresh requests', async () => {
    jest.mocked(secureStorage.readSession).mockResolvedValue(currentSession);
    jest.mocked(authApi.refresh).mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(renewedSession), 10)),
    );

    const { result } = await renderHook(() => useSession(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => {
      await Promise.all([result.current.refresh(), result.current.refresh()]);
    });

    expect(authApi.refresh).toHaveBeenCalledTimes(1);
    expect(result.current.session).toEqual(renewedSession);
  });

  it('clears the persisted session and current state on logout', async () => {
    jest.mocked(secureStorage.readSession).mockResolvedValue(currentSession);
    jest.mocked(authApi.logout).mockResolvedValue(undefined);

    const { result } = await renderHook(() => useSession(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => result.current.logout());

    expect(authApi.logout).toHaveBeenCalledTimes(1);
    expect(secureStorage.clearSession).toHaveBeenCalledTimes(1);
    expect(result.current.session).toBeNull();
  });

  it('clears tokens when restoring an expired session cannot refresh', async () => {
    jest.mocked(secureStorage.readSession).mockResolvedValue({
      ...currentSession,
      accessTokenExpiresAt: new Date(Date.now() - 1).toISOString(),
    });
    jest.mocked(authApi.refresh).mockRejectedValue(new Error('offline'));

    const { result } = await renderHook(() => useSession(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(secureStorage.clearSession).toHaveBeenCalledTimes(1);
    expect(result.current.session).toBeNull();
  });
});
