'use client';

import { createContext, useContext, useMemo, type PropsWithChildren } from 'react';
import type { Role } from '../lib/rbac';

type AdminUser = {
  email: string;
};

type AuthContextValue = {
  loading: boolean;
  role: Role;
  session: { user: AdminUser } | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  user: AdminUser | null;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function LegacyAuthProvider({ children, email }: PropsWithChildren<{ email: string }>) {
  const user = useMemo<AdminUser>(() => ({ email }), [email]);

  const value = useMemo<AuthContextValue>(
    () => ({
      loading: false,
      role: 'owner',
      session: { user },
      signIn: async () => undefined,
      signOut: async () => {
        await fetch('/api/admin/logout', { method: 'POST' }).catch(() => undefined);
        window.location.assign('/login');
      },
      user,
    }),
    [user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth deve ser usado dentro de LegacyAuthProvider.');
  return context;
}
