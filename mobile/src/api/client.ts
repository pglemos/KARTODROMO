import type {
  MessageResponse,
  RegistrationInput,
  SessionTokens,
  SuccessResponse,
} from './contracts';
import { readSession } from '../session/secure-storage';

const API_BASE_URL = (
  process.env.EXPO_PUBLIC_API_URL ?? 'https://reservas.kartodromodebetim.com.br'
).replace(/\/$/, '');
const AUTH = '/api/mobile/v1/auth';

export class MobileApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'MobileApiError';
  }
}

export interface MobileRequestOptions {
  method?: 'GET' | 'POST';
  body?: unknown;
  accessToken?: string;
  idempotencyKey?: string;
}

export async function mobileRequest<T>(path: string, options: MobileRequestOptions = {}): Promise<T> {
  const { method = 'GET', body, accessToken, idempotencyKey } = options;
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`, {
      method,
      headers: {
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
        ...(idempotencyKey ? { 'idempotency-key': idempotencyKey } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch {
    throw new MobileApiError('Sem conexão. Confira a internet e tente novamente.');
  }

  if (response.status === 204) return undefined as T;

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new MobileApiError('O serviço respondeu em um formato inválido.', response.status);
  }
  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && 'erro' in payload && typeof payload.erro === 'string'
        ? payload.erro
        : 'Não foi possível concluir. Tente novamente.';
    throw new MobileApiError(message, response.status);
  }
  return payload as T;
}

async function post<T>(path: string, input: unknown, accessToken?: string): Promise<T> {
  return mobileRequest<T>(`${AUTH}/${path}`, { method: 'POST', body: input, accessToken });
}

export const authApi = {
  login(identifier: string, password: string) {
    return post<SessionTokens>('login', { identifier, password });
  },
  register(input: RegistrationInput) {
    return post<MessageResponse>('register', input);
  },
  verifyEmail(token: string) {
    return post<SuccessResponse>('email/verify', { token });
  },
  requestPasswordReset(identifier: string) {
    return post<MessageResponse>('password/forgot', { identifier });
  },
  resetPassword(token: string, password: string) {
    return post<SuccessResponse>('password/reset', { token, password });
  },
  async refresh() {
    const session = await readSession();
    if (!session) throw new MobileApiError('Sua sessão expirou. Entre novamente.', 401);
    return post<SessionTokens>('session/refresh', { refreshToken: session.refreshToken });
  },
  async logout() {
    const session = await readSession();
    if (session) await post<void>('session/logout', {}, session.accessToken);
  },
};
