import type {
  MessageResponse,
  RegistrationInput,
  SessionTokens,
  SuccessResponse,
} from './contracts';
import { readSession } from '../session/secure-storage';

export const API_BASE_URL = (
  process.env.EXPO_PUBLIC_API_URL ?? 'https://reservas.kartodromodebetim.com.br'
).replace(/\/$/, '');
const AUTH = '/api/mobile/v1/auth';

export type MobileApiErrorCode =
  | 'NETWORK'
  | 'TIMEOUT'
  | 'UNAUTHORIZED'
  | 'RATE_LIMITED'
  | 'UNAVAILABLE'
  | 'INVALID_RESPONSE'
  | 'REQUEST_FAILED'
  | (string & {});

export class MobileApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly code: MobileApiErrorCode = codeForStatus(status),
    readonly retryable = retryableForStatus(status, code),
    readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = 'MobileApiError';
  }
}

function codeForStatus(status?: number): MobileApiErrorCode {
  if (status === 401) return 'UNAUTHORIZED';
  if (status === 429) return 'RATE_LIMITED';
  if (status === 503 || status === 502 || status === 504) return 'UNAVAILABLE';
  return status === undefined ? 'REQUEST_FAILED' : 'REQUEST_FAILED';
}

function retryableForStatus(status?: number, code?: MobileApiErrorCode) {
  return code === 'TIMEOUT' || code === 'NETWORK' || status === 408 || status === 425 || status === 429 || status === 502 || status === 503 || status === 504 || (status !== undefined && status >= 500);
}

function payloadField(payload: unknown, names: string[]) {
  if (!payload || typeof payload !== 'object') return undefined;
  for (const name of names) {
    const value = (payload as Record<string, unknown>)[name];
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  }
  return undefined;
}

function messageForStatus(status: number, fallback: string) {
  if (status === 401) return fallback || 'Sua sessão expirou. Entre novamente.';
  if (status === 429) return fallback || 'Muitas tentativas. Aguarde um pouco e tente novamente.';
  if (status === 503 || status === 502 || status === 504) return fallback || 'Serviço temporariamente indisponível. Tente novamente em instantes.';
  return fallback || 'Não foi possível concluir. Tente novamente.';
}

export interface MobileRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  accessToken?: string;
  idempotencyKey?: string;
}

export async function mobileRequest<T>(path: string, options: MobileRequestOptions = {}): Promise<T> {
  const { method = 'GET', body, accessToken, idempotencyKey } = options;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  const timeoutError = () => new MobileApiError('A conexão demorou demais. Tente novamente.', undefined, 'TIMEOUT', true);
  try {
    let response: Response;
    try {
      response = await fetch(`${API_BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`, {
        method,
        signal: controller.signal,
        headers: {
          ...(body === undefined ? {} : { 'content-type': 'application/json' }),
          ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
          ...(idempotencyKey ? { 'idempotency-key': idempotencyKey } : {}),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    } catch {
      if (controller.signal.aborted) throw timeoutError();
      throw new MobileApiError('Sem conexão. Confira a internet e tente novamente.', undefined, 'NETWORK', true);
    }

    if (response.status === 204) return undefined as T;

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      if (controller.signal.aborted) throw timeoutError();
      throw new MobileApiError('O serviço respondeu em um formato inválido.', response.status, 'INVALID_RESPONSE', response.status >= 500);
    }
    if (!response.ok) {
      const rawMessage = payloadField(payload, ['erro', 'message']);
      const code = String(payloadField(payload, ['codigo', 'code']) ?? codeForStatus(response.status));
      const retryable = payloadField(payload, ['retryable', 'tentarNovamente']);
      const retryAfter = payloadField(payload, ['retryAfterMs', 'retryAfter']);
      const retryAfterMs = typeof retryAfter === 'number' ? (retryAfter < 1000 ? retryAfter * 1000 : retryAfter) : undefined;
      throw new MobileApiError(
        messageForStatus(response.status, typeof rawMessage === 'string' ? rawMessage : ''),
        response.status,
        code,
        typeof retryable === 'boolean' ? retryable : retryableForStatus(response.status, code),
        retryAfterMs,
      );
    }
    return payload as T;
  } finally {
    clearTimeout(timeout);
  }
}

async function post<T>(path: string, input: unknown, accessToken?: string): Promise<T> {
  return mobileRequest<T>(`${AUTH}/${path}`, { method: 'POST', body: input, accessToken });
}

export const authApi = {
  login(identifier: string, password: string) {
    return post<SessionTokens>('login', { identifier, password });
  },
  /** o CPF já tem conta no app ou cadastro no kartódromo (e-mail mascarado)? */
  cadastroExistente(cpf: string) {
    return post<{ contaApp: boolean; cadastro: boolean; email: string | null }>('cadastro-existente', { cpf });
  },
  register(input: RegistrationInput) {
    return post<MessageResponse>('register', input);
  },
  verifyEmail(token: string) {
    return post<SuccessResponse>('email/verify', { token });
  },
  /** pelo CPF, a resposta diz para qual e-mail (mascarado) o link foi: "esqueci meu e-mail" */
  requestPasswordReset(identifier: string) {
    return post<MessageResponse & { emailMascarado?: string; emailConfirmado?: boolean }>('password/forgot', { identifier });
  },
  /** cadastrou o e-mail errado e a confirmação nunca chegou: CPF + senha provam a conta, o link vai para o e-mail certo */
  correctEmail(cpf: string, password: string, email: string) {
    return post<MessageResponse>('email/corrigir', { cpf, password, email });
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
  async deleteAccount() {
    const session = await readSession();
    if (!session) throw new MobileApiError('Você precisa estar conectado.', 401);
    await post<void>('account/delete', {}, session.accessToken);
  },
};
