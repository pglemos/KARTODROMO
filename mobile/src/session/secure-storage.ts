import * as SecureStore from 'expo-secure-store';

import type { SessionTokens } from '../api/contracts';

const SESSION_KEY = 'kartodromo.session.v1';

function parseSession(value: string): SessionTokens | null {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object') return null;
    const session = parsed as Partial<SessionTokens>;
    if (
      typeof session.accessToken !== 'string' ||
      typeof session.refreshToken !== 'string' ||
      typeof session.accessTokenExpiresAt !== 'string' ||
      typeof session.refreshTokenExpiresAt !== 'string' ||
      !Number.isFinite(Date.parse(session.accessTokenExpiresAt)) ||
      !Number.isFinite(Date.parse(session.refreshTokenExpiresAt))
    ) {
      return null;
    }
    return {
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      accessTokenExpiresAt: session.accessTokenExpiresAt,
      refreshTokenExpiresAt: session.refreshTokenExpiresAt,
    };
  } catch {
    return null;
  }
}

export async function readSession() {
  const value = await SecureStore.getItemAsync(SESSION_KEY);
  if (value === null) return null;
  const session = parseSession(value);
  if (!session) await clearSession();
  return session;
}

export async function saveSession(session: SessionTokens) {
  await SecureStore.setItemAsync(
    SESSION_KEY,
    JSON.stringify({
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      accessTokenExpiresAt: session.accessTokenExpiresAt,
      refreshTokenExpiresAt: session.refreshTokenExpiresAt,
    }),
  );
}

export async function clearSession() {
  await SecureStore.deleteItemAsync(SESSION_KEY);
}
