import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import worker from '../../workers/pre-cadastro/src/index';
import { authenticateMobileRequest } from '../../workers/pre-cadastro/src/mobile/auth';

const SCHEMA = readFileSync(
  new URL('../../workers/pre-cadastro/migrations/0001_mobile_identity.sql', import.meta.url),
  'utf8',
) + readFileSync(new URL('../../workers/pre-cadastro/migrations/0005_mobile_password_scheme.sql', import.meta.url), 'utf8');

type Row = Record<string, unknown>;

class TestStatement {
  private parameters: unknown[] = [];

  constructor(
    private readonly database: DatabaseSync,
    private readonly query: string,
  ) {}

  bind(...parameters: unknown[]) {
    this.parameters = parameters;
    return this;
  }

  async first<T = Row>(columnName?: string): Promise<T | null> {
    const row = this.database.prepare(this.query).get(...(this.parameters as never[])) as Row | undefined;
    if (!row) return null;
    return (columnName ? row[columnName] : row) as T;
  }

  async all<T = Row>() {
    const results = this.database.prepare(this.query).all(...(this.parameters as never[])) as T[];
    return { success: true, results, meta: { changes: 0 } };
  }

  async run() {
    const result = this.database.prepare(this.query).run(...(this.parameters as never[]));
    return { success: true, meta: { changes: Number(result.changes) } };
  }
}

class TestD1 {
  readonly database = new DatabaseSync(':memory:');

  constructor() {
    this.database.exec(SCHEMA);
  }

  prepare(query: string) {
    return new TestStatement(this.database, query);
  }

  close() {
    this.database.close();
  }
}

const randomSecret = () => Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url');

function cpfForTest(base: string) {
  const firstNine = base.replace(/\D/g, '').slice(0, 9);
  const digit = (digits: string, weight: number) => {
    const sum = [...digits].reduce((total, value, index) => total + Number(value) * (weight - index), 0);
    const remainder = sum % 11;
    return String(remainder < 2 ? 0 : 11 - remainder);
  };
  const first = digit(firstNine, 10);
  return `${firstNine}${first}${digit(`${firstNine}${first}`, 11)}`;
}

const validRegistration = {
  name: 'Ana Silva',
  cpf: cpfForTest('123456789'),
  email: 'ana@example.com',
  phone: '+55 31 98888-7777',
  password: 'SenhaSegura!2026',
  privacyAccepted: true,
};

let database: TestD1;
let sentEmails: Record<string, unknown>[];
let environment: Record<string, unknown>;

beforeEach(() => {
  database = new TestD1();
  sentEmails = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      sentEmails.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
      return new Response('{"id":"test-email"}', {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }),
  );
  environment = {
    MOBILE_DB: database,
    MOBILE_LOOKUP_KEY: randomSecret(),
    MOBILE_DATA_KEY: randomSecret(),
    RESEND_API_KEY: randomSecret(),
    RESEND_FROM_EMAIL: 'Kartódromo <conta@kartodromodebetim.com.br>',
  };
});

afterEach(() => {
  database.close();
  vi.unstubAllGlobals();
});

async function call(path: string, body: unknown, headers: Record<string, string> = {}) {
  const request = new Request(
    `https://reservas.kartodromodebetim.com.br/api/mobile/v1/auth/${path}`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'cf-connecting-ip': '203.0.113.20',
        ...headers,
      },
      body: JSON.stringify(body),
    },
  );

  return worker.fetch(request, environment as never, { waitUntil: () => undefined });
}

function authenticatedRequest(accessToken: unknown) {
  return new Request('https://reservas.kartodromodebetim.com.br/api/mobile/v1/me', {
    headers: { authorization: `Bearer ${String(accessToken)}` },
  });
}

async function body(response: Response): Promise<Row> {
  return (await response.json()) as Row;
}

async function register(overrides: Record<string, unknown> = {}) {
  return call('register', { ...validRegistration, ...overrides });
}

function tokenFromLastEmail() {
  const message = JSON.stringify(sentEmails[sentEmails.length - 1]);
  const token = /token=([A-Za-z0-9_-]+)/.exec(message)?.[1];
  if (!token) throw new Error('O e-mail de teste não continha o link de uso único.');
  return token;
}

describe('autenticação móvel', () => {
  it('preserva credenciais PBKDF2 existentes ao versionar o esquema', () => {
    const legacy = new DatabaseSync(':memory:');
    try {
      legacy.exec(readFileSync(new URL('../../workers/pre-cadastro/migrations/0001_mobile_identity.sql', import.meta.url), 'utf8'));
      legacy.prepare('INSERT INTO mobile_accounts VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .run('legacy', ...Array(8).fill('cipher'), 600_000, null, 0);
      legacy.exec(readFileSync(new URL('../../workers/pre-cadastro/migrations/0005_mobile_password_scheme.sql', import.meta.url), 'utf8'));
      expect(legacy.prepare('SELECT id, password_hash, password_iterations, password_scheme FROM mobile_accounts').get())
        .toMatchObject({ id: 'legacy', password_hash: 'cipher', password_iterations: 600_000, password_scheme: 'pbkdf2-sha256-v1' });
    } finally { legacy.close(); }
  });
  it('usa scrypt versionado quando o runtime rejeita PBKDF2', async () => {
    const deriveBits = vi.spyOn(crypto.subtle, 'deriveBits').mockRejectedValue(new Error('Pbkdf2 failed: iteration counts above 100000 are not supported'));
    try {
      const response = await register();
      expect(response.status).toBe(202);
      expect((await call('email/verify', { token: tokenFromLastEmail() })).status).toBe(200);
      expect((await call('login', { identifier: validRegistration.email, password: validRegistration.password })).status).toBe(200);
      expect(database.database.prepare('SELECT password_scheme FROM mobile_accounts').get()).toMatchObject({ password_scheme: 'scrypt-32768-8-3-v1' });
    } finally {
      deriveBits.mockRestore();
    }
  });
  it('rejects oversized JSON bodies even when Content-Length is absent', async () => {
    const response = await register({ ignored: 'x'.repeat(20_000) });

    expect(response.status).toBe(400);
    expect(sentEmails).toHaveLength(0);
  });

  it('rejects passwords shorter than eight characters before storing an account', async () => {
    const response = await register({ password: '1234567' });

    expect(response.status).toBe(400);
    expect(await body(response)).toMatchObject({ erro: expect.stringContaining('8') });
    expect(sentEmails).toHaveLength(0);
    expect(database.database.prepare('SELECT count(*) AS total FROM mobile_accounts').get()).toMatchObject({
      total: 0,
    });
  });

  it('rejects oversized login passwords before running PBKDF2', async () => {
    await register();
    await call('email/verify', { token: tokenFromLastEmail() });
    const deriveBits = vi.spyOn(crypto.subtle, 'deriveBits');

    try {
      const response = await call('login', {
        identifier: validRegistration.email,
        password: 'x'.repeat(129),
      });

      expect(response.status).toBe(401);
      expect(await body(response)).toEqual({ erro: 'E-mail/CPF ou senha inválidos.' });
      expect(deriveBits).not.toHaveBeenCalled();
    } finally {
      deriveBits.mockRestore();
    }
  });

  it('verifies accounts, authenticates by e-mail or CPF, rotates refresh tokens and logs out', async () => {
    const created = await register();
    expect(created.status).toBe(202);
    const createdBody = JSON.stringify(await body(created));
    expect(createdBody).not.toContain('ana@example.com');
    expect(createdBody).not.toContain(tokenFromLastEmail());

    const beforeVerification = await call('login', {
      identifier: validRegistration.email,
      password: validRegistration.password,
    });
    expect(beforeVerification.status).toBe(403);

    const verificationToken = tokenFromLastEmail();
    expect((await call('email/verify', { token: verificationToken })).status).toBe(200);
    expect((await call('email/verify', { token: verificationToken })).status).toBe(400);

    const emailLogin = await call('login', {
      identifier: validRegistration.email,
      password: validRegistration.password,
    });
    expect(emailLogin.status).toBe(200);
    const emailSession = await body(emailLogin);

    const cpfLogin = await call('login', {
      identifier: validRegistration.cpf,
      password: validRegistration.password,
    });
    expect(cpfLogin.status).toBe(200);
    const cpfSession = await body(cpfLogin);

    const account = database.database
      .prepare('SELECT name_cipher, email_cipher, cpf_cipher, phone_cipher FROM mobile_accounts')
      .get() as Row;
    expect(JSON.stringify(account)).not.toContain(validRegistration.name);
    expect(JSON.stringify(account)).not.toContain(validRegistration.email);
    expect(JSON.stringify(account)).not.toContain(validRegistration.cpf.replace(/\D/g, ''));
    const sessions = database.database
      .prepare('SELECT access_token_hash, refresh_token_hash FROM mobile_sessions')
      .all() as Row[];
    expect(JSON.stringify(sessions)).not.toContain(String(emailSession.accessToken));
    expect(JSON.stringify(sessions)).not.toContain(String(cpfSession.refreshToken));

    const [refreshA, refreshB] = await Promise.all([
      call('session/refresh', { refreshToken: emailSession.refreshToken }),
      call('session/refresh', { refreshToken: emailSession.refreshToken }),
    ]);
    expect([refreshA.status, refreshB.status].sort()).toEqual([200, 401]);
    const rotatedSession = await body(refreshA.status === 200 ? refreshA : refreshB);
    expect(
      await authenticateMobileRequest(authenticatedRequest(rotatedSession.accessToken), environment as never),
    ).toMatchObject({ email: validRegistration.email });

    expect(
      (
        await call(
          'session/logout',
          {},
          { authorization: `Bearer ${String(rotatedSession.accessToken)}` },
        )
      ).status,
    ).toBe(204);
    expect(
      await authenticateMobileRequest(authenticatedRequest(rotatedSession.accessToken), environment as never),
    ).toBeNull();
    expect(
      (
        await call('session/refresh', {
          refreshToken: rotatedSession.refreshToken,
        })
      ).status,
    ).toBe(401);
  });

  it('keeps login, registration and reset responses indistinguishable for existing and unknown accounts', async () => {
    const initial = await register();
    const duplicate = await register();
    expect(duplicate.status).toBe(initial.status);
    expect(await body(duplicate)).toEqual(await body(initial));
    expect(sentEmails).toHaveLength(2);

    const verify = await call('email/verify', { token: tokenFromLastEmail() });
    expect(verify.status).toBe(200);
    const existingLogin = await call('login', {
      identifier: validRegistration.email,
      password: 'senha-errada',
    });
    const unknownLogin = await call('login', {
      identifier: 'desconhecido@example.com',
      password: 'senha-errada',
    });
    expect(existingLogin.status).toBe(401);
    expect(await body(existingLogin)).toEqual(await body(unknownLogin));

    const existingReset = await call('password/forgot', {
      identifier: validRegistration.email,
    });
    const unknownReset = await call('password/forgot', {
      identifier: 'desconhecido@example.com',
    });
    expect(existingReset.status).toBe(202);
    expect(await body(existingReset)).toEqual(await body(unknownReset));
  });

  it('changes a password with a single-use reset token', async () => {
    await register();
    expect((await call('email/verify', { token: tokenFromLastEmail() })).status).toBe(200);
    expect(
      (
        await call('password/forgot', {
          identifier: validRegistration.email,
        })
      ).status,
    ).toBe(202);
    const resetToken = tokenFromLastEmail();

    expect(
      (
        await call('password/reset', {
          token: resetToken,
          password: 'SenhaNova!2026',
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await call('password/reset', {
          token: resetToken,
          password: 'OutraSenha!2026',
        })
      ).status,
    ).toBe(400);

    expect(
      (
        await call('login', {
          identifier: validRegistration.email,
          password: validRegistration.password,
        })
      ).status,
    ).toBe(401);
    expect(
      (
        await call('login', {
          identifier: validRegistration.email,
          password: 'SenhaNova!2026',
        })
      ).status,
    ).toBe(200);
  });

  it('rate limits authentication attempts by IP', async () => {
    const responses = await Promise.all(
      Array.from({ length: 7 }, () =>
        call(
          'login',
          { identifier: 'desconhecido@example.com', password: 'senha-errada' },
          { 'cf-connecting-ip': '203.0.113.99' },
        ),
      ),
    );

    // Requisições concorrentes podem chegar ao contador em qualquer ordem.
    expect(responses.map((response) => response.status).sort()).toEqual([401, 401, 401, 401, 401, 401, 429]);
  });
});
