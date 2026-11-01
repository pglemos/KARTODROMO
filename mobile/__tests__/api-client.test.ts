import { authApi, MobileApiError } from '../src/api/client';

describe('erros da API móvel', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('preserva a causa de credenciais inválidas no login', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ erro: 'E-mail/CPF ou senha inválidos.' }),
    }) as unknown as typeof fetch;

    let caught: unknown;
    try {
      await authApi.login('piloto@example.com', 'senha-de-teste');
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(MobileApiError);
    expect(caught).toMatchObject({ status: 401, code: 'UNAUTHORIZED', retryable: false });
    expect((caught as Error).message).toBe('E-mail/CPF ou senha inválidos.');
  });

  it('mantém o aviso de sessão expirada quando a API não envia mensagem', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({}),
    }) as unknown as typeof fetch;

    await expect(authApi.login('piloto@example.com', 'senha-de-teste'))
      .rejects.toThrow('Sua sessão expirou. Entre novamente.');
  });
});
