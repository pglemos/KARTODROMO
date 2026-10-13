import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import worker from '../../workers/pre-cadastro/src/index';

const IDENTITY_SCHEMA = readFileSync(
  new URL('../../workers/pre-cadastro/migrations/0001_mobile_identity.sql', import.meta.url), 'utf8',
);
const BOOKINGS_SCHEMA = readFileSync(
  new URL('../../workers/pre-cadastro/migrations/0002_mobile_bookings.sql', import.meta.url), 'utf8',
);
const COUPONS_SCHEMA = readFileSync(
  new URL('../../workers/pre-cadastro/migrations/0003_mobile_coupon_previews.sql', import.meta.url), 'utf8',
);

type Row = Record<string, unknown>;

class TestStatement {
  private parameters: unknown[] = [];
  constructor(private readonly database: DatabaseSync, private readonly query: string) {}
  bind(...parameters: unknown[]) { this.parameters = parameters; return this; }
  async first<T = Row>(columnName?: string): Promise<T | null> {
    const row = this.database.prepare(this.query).get(...(this.parameters as never[])) as Row | undefined;
    if (!row) return null;
    return (columnName ? row[columnName] : row) as T;
  }
  async all<T = Row>() {
    return { success: true, results: this.database.prepare(this.query).all(...(this.parameters as never[])) as T[], meta: { changes: 0 } };
  }
  async run() {
    const result = this.database.prepare(this.query).run(...(this.parameters as never[]));
    return { success: true, meta: { changes: Number(result.changes) } };
  }
}

class TestD1 {
  readonly database = new DatabaseSync(':memory:');
  constructor() {
    this.database.exec(IDENTITY_SCHEMA);
    this.database.exec(BOOKINGS_SCHEMA);
    this.database.exec(COUPONS_SCHEMA);
  }
  prepare(query: string) { return new TestStatement(this.database, query); }
  close() { this.database.close(); }
}

const randomSecret = () => Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url');
const createTestCpf = () => {
  const digits = Array.from(crypto.getRandomValues(new Uint8Array(9)), (value) => value % 10);
  if (digits.every((digit) => digit === digits[0])) digits[0] = (digits[0] + 1) % 10;
  const checkDigit = (length: number) => {
    const sum = digits.slice(0, length).reduce((total, digit, index) => total + digit * (length + 1 - index), 0);
    const digit = (sum * 10) % 11;
    return digit === 10 ? 0 : digit;
  };
  digits.push(checkDigit(9));
  digits.push(checkDigit(10));
  return digits.join('');
};

let database: TestD1;
let sentEmails: Record<string, unknown>[];
let env: Record<string, unknown>;
let token: string;
let cpf: string;

beforeEach(async () => {
  database = new TestD1();
  sentEmails = [];
  vi.stubGlobal('fetch', vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
    sentEmails.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
    return new Response('{"id":"test-email"}', { status: 200 });
  }));
  cpf = createTestCpf();
  env = {
    MOBILE_DB: database,
    MOBILE_LOOKUP_KEY: randomSecret(),
    MOBILE_DATA_KEY: randomSecret(),
    RESEND_API_KEY: randomSecret(),
    RESEND_FROM_EMAIL: 'Kartódromo <conta@kartodromodebetim.com.br>',
    RESERVAS_ATIVAS: '1',
    PRE: { get: async () => null, put: async () => undefined, list: async () => ({ objects: [], truncated: false }), delete: async () => undefined },
    ASSETS: { fetch: async () => new Response(null, { status: 404 }) },
    SYNC_KEY: randomSecret(),
  };
  const registration = await call('/api/mobile/v1/auth/register', 'POST', {
    name: 'Maria da Silva', cpf, email: 'maria@example.com', phone: '31 99999-0000',
    password: 'SenhaSegura!2026', privacyAccepted: true,
  });
  expect(registration.status).toBe(202);
  const verifyToken = /token=([A-Za-z0-9_-]+)/.exec(JSON.stringify(sentEmails[sentEmails.length - 1]))?.[1];
  expect(verifyToken).toBeTruthy();
  expect((await call('/api/mobile/v1/auth/email/verify', 'POST', { token: verifyToken })).status).toBe(200);
  const login = await call('/api/mobile/v1/auth/login', 'POST', { identifier: 'maria@example.com', password: 'SenhaSegura!2026' });
  expect(login.status).toBe(200);
  token = String((await login.json() as { accessToken: string }).accessToken);
});

afterEach(() => {
  database.close();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function call(path: string, method = 'GET', body?: unknown, headers: Record<string, string> = {}) {
  return worker.fetch(
    new Request(`https://reservas.kartodromodebetim.com.br${path}`, {
      method,
      headers: {
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        ...headers,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }),
    env as never,
    { waitUntil: () => undefined } as never,
  );
}

async function createRegisteredAccount(email: string) {
  const cpf = createTestCpf();
  const registration = await call('/api/mobile/v1/auth/register', 'POST', {
    name: 'Joana de Souza', cpf, email, phone: '31 99999-0000',
    password: 'SenhaSegura!2026', privacyAccepted: true,
  });
  expect(registration.status).toBe(202);
  const verifyToken = /token=([A-Za-z0-9_-]+)/.exec(JSON.stringify(sentEmails[sentEmails.length - 1]))?.[1];
  expect((await call('/api/mobile/v1/auth/email/verify', 'POST', { token: verifyToken })).status).toBe(200);
  const login = await call('/api/mobile/v1/auth/login', 'POST', { identifier: email, password: 'SenhaSegura!2026' });
  return String((await login.json() as { accessToken: string }).accessToken);
}

describe('prévia autenticada de cupons', () => {
  it('cria job, envia o CPF do perfil apenas à operação e devolve o resultado somente à conta', async () => {
    expect((await call('/api/mobile/v1/coupons/preview', 'POST', { codigo: 'BETIM10', bateriaId: 101, quantidade: 1 })).status).toBe(401);
    expect((await call('/api/mobile/v1/coupons/preview', 'POST', { codigo: 'BETIM10', bateriaId: 101, quantidade: 0 }, { authorization: `Bearer ${token}` })).status).toBe(400);
    const created = await call('/api/mobile/v1/coupons/preview', 'POST', {
      codigo: 'betim10', bateriaId: 101, quantidade: 2,
    }, { authorization: `Bearer ${token}` });
    expect(created.status).toBe(202);
    const { requestId } = await created.json() as { requestId: string };
    expect(requestId).toMatch(/^[a-f0-9-]{36}$/);
    const storedJob = database.database.prepare('SELECT * FROM mobile_coupon_previews WHERE id = ?').get(requestId);
    expect(JSON.stringify(storedJob)).not.toContain(cpf);
    const pending = await call(`/api/mobile/v1/coupons/preview/${requestId}`, 'GET', undefined, { authorization: `Bearer ${token}` });
    expect(await pending.json()).toEqual({ status: 'pending' });

    expect((await call('/api/sync/mobile/coupons')).status).toBe(401);
    const jobs = await call('/api/sync/mobile/coupons', 'GET', undefined, { 'x-sync-key': String(env.SYNC_KEY) });
    expect(jobs.status).toBe(200);
    expect(await jobs.json()).toEqual([{ requestId, codigo: 'BETIM10', documento: cpf, bateriaId: 101, quantidade: 2 }]);

    const result = { brutoCentavos: 29000, descontoCentavos: 5000, totalCentavos: 24000 };
    const completed = await call(`/api/sync/mobile/coupons/${requestId}`, 'POST', result, { 'x-sync-key': String(env.SYNC_KEY) });
    expect(completed.status).toBe(200);
    const owner = await call(`/api/mobile/v1/coupons/preview/${requestId}`, 'GET', undefined, { authorization: `Bearer ${token}` });
    expect(owner.status).toBe(200);
    const ownerBody = await owner.json();
    expect(ownerBody).toMatchObject({ status: 'completed', ...result });
    expect(JSON.stringify(ownerBody)).not.toContain(cpf);
  });

  it('não revela nem devolve job de outra conta e expira a prévia curta', async () => {
    const created = await call('/api/mobile/v1/coupons/preview', 'POST', {
      codigo: 'BETIM10', bateriaId: 101, quantidade: 1,
    }, { authorization: `Bearer ${token}` });
    expect(created.status).toBe(202);
    const { requestId } = await created.json() as { requestId: string };

    const otherToken = await createRegisteredAccount(`joana+${crypto.randomUUID()}@example.com`);
    const otherAccount = await call(`/api/mobile/v1/coupons/preview/${requestId}`, 'GET', undefined, { authorization: `Bearer ${otherToken}` });
    expect(otherAccount.status).toBe(404);

    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 11 * 60_000);
    const expired = await call(`/api/mobile/v1/coupons/preview/${requestId}`, 'GET', undefined, { authorization: `Bearer ${token}` });
    expect(expired.status).toBe(404);
  });
});
