import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { PropsWithChildren } from 'react';

import { authApi } from '../api/client';
import type { SessionTokens } from '../api/contracts';
import * as secureStorage from './secure-storage';

interface SessionContextValue {
  session: SessionTokens | null;
  isLoading: boolean;
  login(identifier: string, password: string): Promise<void>;
  logout(): Promise<void>;
  refresh(): Promise<SessionTokens | null>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<SessionTokens | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const refreshInFlight = useRef<Promise<SessionTokens | null> | null>(null);

  const refresh = useCallback(() => {
    if (refreshInFlight.current) return refreshInFlight.current;

    const operation = (async () => {
      try {
        const renewed = await authApi.refresh();
        await secureStorage.saveSession(renewed);
        setSession(renewed);
        return renewed;
      } catch {
        await secureStorage.clearSession().catch(() => undefined);
        setSession(null);
        return null;
      } finally {
        refreshInFlight.current = null;
      }
    })();
    refreshInFlight.current = operation;
    return operation;
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const stored = await secureStorage.readSession();
        if (!active || !stored) return;
        if (Date.parse(stored.accessTokenExpiresAt) <= Date.now()) await refresh();
        else setSession(stored);
      } catch {
        await secureStorage.clearSession().catch(() => undefined);
        if (active) setSession(null);
      } finally {
        if (active) setIsLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [refresh]);

  const login = useCallback(async (identifier: string, password: string) => {
    const authenticated = await authApi.login(identifier, password);
    await secureStorage.saveSession(authenticated);
    setSession(authenticated);
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // A saída local deve funcionar mesmo sem rede.
    }
    try {
      await secureStorage.clearSession();
    } finally {
      setSession(null);
    }
  }, []);

  return (
    <SessionContext.Provider value={{ session, isLoading, login, logout, refresh }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) throw new Error('useSession deve ser usado dentro de SessionProvider.');
  return context;
}
