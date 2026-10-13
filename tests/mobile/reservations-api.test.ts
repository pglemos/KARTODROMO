import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import worker from '../../workers/pre-cadastro/src/index';

const IDENTITY_SCHEMA = readFileSync(
  new URL('../../workers/pre-cadastro/migrations/0001_mobile_identity.sql', import.meta.url),
  'utf8',
) + readFileSync(new URL('../../workers/pre-cadastro/migrations/0005_mobile_password_scheme.sql', import.meta.url), 'utf8');

const BOOKINGS_SCHEMA = readFileSync(
  new URL('../../workers/pre-cadastro/migrations/0002_mobile_bookings.sql', import.meta.url),
  'utf8',
);

type Row = Record<string, unknown>;

class TestStatement {
  private parameters: unknown[] = [];

  constructor(private readonly database: DatabaseSync, private readonly query: string) {}

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
    this.database.exec(IDENTITY_SCHEMA);
    this.database.exec(BOOKINGS_SCHEMA);
  }

  prepare(query: string) {
    return new TestStatement(this.database, query);
  }

  close() {
    this.database.close();
  }
}

function r2() {
  const data = new Map<string, string>();
  let failOrderPut = false;
  let failQueuePut = false;
  const bucket = {
    get: async (key: string) => (data.has(key)
      ? { key, json: async () => JSON.parse(data.get(key)!), text: async () => data.get(key)! }
      : null),
    put: async (key: string, value: string) => {
      if (failOrderPut && key.startsWith('reservas/pedidos/')) {
        failOrderPut = false;
        throw new Error('R2 temporariamente indisponível');
      }
      if (failQueuePut && key.startsWith('reservas/fila/')) {
        failQueuePut = false;
        throw new Error('R2 fila temporariamente indisponível');
      }
      data.set(key, value);
    },
    list: async ({ prefix = '' }: { prefix?: string } = {}) => ({
      objects: [...data.keys()].filter((key) => key.startsWith(prefix)).map((key) => ({ key })),
      truncated: false,
    }),
    delete: async (keys: string | string[]) => {
      for (const key of Array.isArray(keys) ? keys : [keys]) data.delete(key);
    },
  };
  return {
    data,
    bucket: bucket as unknown as R2Bucket,
    failNextOrderPut: () => { failOrderPut = true; },
    failNextQueuePut: () => { failQueuePut = true; },
  };
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

const agenda = {
  atualizadoEm: '2026-10-12T12:00:00.000Z',
  precoCentavos: 14500,
  maxPilotos: 10,
  prazoMin: 15,
  antecedenciaMin: 120,
  horarios: [{ id: 101, inicio: '2026-10-15T09:15', nome: 'BATERIA 09:15', livres: 4 }],
};

let database: TestD1;
let bucket: ReturnType<typeof r2>;
let sentEmails: Record<string, unknown>[];
let environment: Record<string, unknown>;
let accountA: { accessToken: string; name: string; email: string; cpf: string; phone: string };

beforeEach(async () => {
  database = new TestD1();
  bucket = r2();
  sentEmails = [];
  vi.stubGlobal('fetch', vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
    sentEmails.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
    return new Response('{"id":"test-email"}', { status: 200, headers: { 'content-type': 'application/json' } });
  }));
  bucket.data.set('reservas/agenda.json', JSON.stringify(agenda));
  environment = {
    MOBILE_DB: database,
    MOBILE_LOOKUP_KEY: randomSecret(),
    MOBILE_DATA_KEY: randomSecret(),
    RESEND_API_KEY: randomSecret(),
    RESEND_FROM_EMAIL: 'Kartódromo <conta@kartodromodebetim.com.br>',
    RESERVAS_ATIVAS: '1',
    ASAAS_API_KEY: 'sandbox-test-key',
    ASAAS_URL: 'https://api-sandbox.asaas.com/v3',
    PRE: bucket.bucket,
    ASSETS: { fetch: async () => new Response(null, { status: 404 }) },
    SYNC_KEY: randomSecret(),
  };
  accountA = await createAccount('Ana Silva', 'ana@example.com', '123456789');
});

afterEach(() => {
  database.close();
  vi.unstubAllGlobals();
});

async function request(path: string, options: {
  method?: string;
  body?: unknown;
  token?: string;
  headers?: Record<string, string>;
} = {}) {
  const headers = new Headers(options.headers);
  if (options.body !== undefined) headers.set('content-type', 'application/json');
  if (options.token) headers.set('authorization', `Bearer ${options.token}`);
  return worker.fetch(
    new Request(`https://reservas.kartodromodebetim.com.br/api/mobile/v1/${path}`, {
      method: options.method ?? (options.body === undefined ? 'GET' : 'POST'),
      headers,
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
    }),
    environment as never,
    { waitUntil: () => undefined } as never,
  );
}

async function createAccount(name: string, email: string, cpfBase: string) {
  const cpf = cpfForTest(cpfBase);
  const registration = {
    name,
    cpf,
    email,
    phone: '+55 31 98888-7777',
    password: 'SenhaSegura!2026',
    privacyAccepted: true,
  };
  const registerResponse = await request('auth/register', { method: 'POST', body: registration });
  expect(registerResponse.status).toBe(202);
  const token = /token=([A-Za-z0-9_-]+)/.exec(JSON.stringify(sentEmails[sentEmails.length - 1]))?.[1];
  expect(token).toBeTruthy();
  expect((await request('auth/email/verify', { method: 'POST', body: { token } })).status).toBe(200);
  const login = await request('auth/login', {
    method: 'POST',
    body: { identifier: email, password: registration.password },
  });
  expect(login.status).toBe(200);
  const result = await login.json() as { accessToken: string };
  return { accessToken: result.accessToken, name, email, cpf, phone: registration.phone.replace(/\D/g, '') };
}

const requestBody: {
  bateriaId: number;
  quantidade: number;
  pilotos: string[];
  forma: string;
  nascimento: string;
  politica: boolean;
  account_id: string;
  valorCentavos: number;
  cupom?: string;
} = {
  bateriaId: 101,
  quantidade: 2,
  pilotos: ['Ana Silva', 'Bruno Souza'],
  forma: 'pix',
  nascimento: '1990-05-20',
  politica: true,
  // These untrusted values must never replace the authenticated profile or server price.
  account_id: 'attacker-account',
  valorCentavos: 1,
};
const idempotencyKey = '89c79f40-52af-41ef-8c1a-748aa12b028b';

async function createReservation(body = requestBody, token = accountA.accessToken, key = idempotencyKey) {
  return request('reservations', {
    method: 'POST',
    token,
    headers: { 'idempotency-key': key },
    body,
  });
}

describe('reservas móveis', () => {
  it('publica a agenda sem exigir sessão', async () => {
    const response = await request('agenda');

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ horarios: [{ id: 101 }], pagamentoOnline: true });
  });

  it('exige sessão e chave de idempotência para criar uma reserva', async () => {
    expect((await request('reservations', { method: 'POST', body: requestBody })).status).toBe(401);
    expect((await request('reservations', { method: 'POST', token: accountA.accessToken, body: requestBody })).status).toBe(400);
  });

  it('usa o perfil autenticado e não expõe reservas de outra conta', async () => {
    const created = await createReservation();
    expect(created.status).toBe(201);
    const order = await created.json() as { id: string; codigo: string };
    const object = bucket.data.get(`reservas/pedidos/${order.id}.json`);
    expect(object).toBeTruthy();
    expect(JSON.parse(object!)).toMatchObject({
      cliente: { nome: accountA.name, email: accountA.email, documento: accountA.cpf, telefone: accountA.phone },
      bateriaId: 101,
      quantidade: 2,
      forma: 'pix',
    });
    expect(JSON.stringify(JSON.parse(object!))).not.toContain('attacker-account');
    expect(JSON.parse(object!).servidor).toBeUndefined();

    const ownerList = await request('reservations', { token: accountA.accessToken });
    expect(ownerList.status).toBe(200);
    const listed = await ownerList.json();
    expect(listed).toMatchObject([{ id: order.id, codigo: order.codigo, nome: 'Ana' }]);
    expect(JSON.stringify(listed)).not.toContain(accountA.cpf);
    expect((await request(`reservations/${order.id}`, { token: accountA.accessToken })).status).toBe(200);

    const sync = await worker.fetch(
      new Request('https://cadastro.kartodromodebetim.com.br/api/sync/pedidos', {
        headers: { 'x-sync-key': String(environment.SYNC_KEY) },
      }),
      environment as never,
      { waitUntil: () => undefined } as never,
    );
    expect(sync.status).toBe(200);
    expect(await sync.json()).toMatchObject([{ id: order.id, status: 'novo' }]);

    const accountB = await createAccount('Bia Costa', 'bia@example.com', '987654321');
    expect((await request('reservations', { token: accountB.accessToken })).status).toBe(200);
    expect(await (await request('reservations', { token: accountB.accessToken })).json()).toEqual([]);
    expect((await request(`reservations/${order.id}`, { token: accountB.accessToken })).status).toBe(404);
  });

  it('normaliza o cupom na reserva e inclui-o no pedido interno idempotente', async () => {
    const created = await createReservation({ ...requestBody, cupom: 'betim10' });
    expect(created.status).toBe(201);
    const { id } = await created.json() as { id: string };
    expect(JSON.parse(bucket.data.get(`reservas/pedidos/${id}.json`)!).cupom).toBe('BETIM10');
    expect((await createReservation(requestBody)).status).toBe(409);

    const sync = await worker.fetch(
      new Request('https://reservas.kartodromodebetim.com.br/api/sync/pedidos', {
        headers: { 'x-sync-key': String(environment.SYNC_KEY) },
      }),
      environment as never,
      { waitUntil: () => undefined } as never,
    );
    expect(await sync.json()).toMatchObject([{ id, cupom: 'BETIM10' }]);
  });

  it('devolve o mesmo pedido para a mesma chave e corpo, e 409 para outro corpo', async () => {
    const first = await createReservation();
    const original = await first.json() as { id: string; codigo: string };
    environment.RESERVAS_ATIVAS = '0';
    environment.ASAAS_API_KEY = '';
    const repeated = await createReservation();
    expect(repeated.status).toBe(200);
    expect(await repeated.json()).toEqual(original);

    const conflict = await createReservation({ ...requestBody, quantidade: 3 });
    expect(conflict.status).toBe(409);
  });

  it('converge duas tentativas simultâneas na mesma reserva', async () => {
    const [first, second] = await Promise.all([createReservation(), createReservation()]);
    const results = await Promise.all([first.json(), second.json()]) as { id: string; codigo: string }[];

    expect(results[0]).toEqual(results[1]);
    expect(bucket.data.keys()).toContain(`reservas/pedidos/${results[0].id}.json`);
    expect(bucket.data.keys()).toContain(`reservas/fila/${results[0].id}`);
    expect(database.database.prepare('SELECT count(*) AS total FROM mobile_orders').get()).toMatchObject({ total: 1 });
  });

  it('recupera a gravação R2 após falha sem trocar o ID do pedido', async () => {
    bucket.failNextOrderPut();
    const first = await createReservation();
    expect(first.status).toBe(503);
    const pending = database.database.prepare('SELECT pedido_id, state FROM mobile_orders').get() as Row;
    expect(pending.state).toBe('creating');
    environment.RESERVAS_ATIVAS = '0';
    environment.ASAAS_API_KEY = '';

    const recovered = await createReservation();
    expect(recovered.status).toBe(200);
    expect(await recovered.json()).toMatchObject({ id: pending.pedido_id });
    expect(database.database.prepare('SELECT state FROM mobile_orders').get()).toMatchObject({ state: 'ready' });
  });

  it('recria a fila quando a gravação do pedido no R2 funcionou e a fila falhou', async () => {
    bucket.failNextQueuePut();
    const first = await createReservation();
    expect(first.status).toBe(503);
    const pending = database.database.prepare('SELECT pedido_id, state FROM mobile_orders').get() as Row;
    expect(bucket.data.has(`reservas/pedidos/${pending.pedido_id}.json`)).toBe(true);
    expect(bucket.data.has(`reservas/fila/${pending.pedido_id}`)).toBe(false);
    environment.RESERVAS_ATIVAS = '0';
    environment.ASAAS_API_KEY = '';

    const recovered = await createReservation();
    expect(recovered.status).toBe(200);
    expect(bucket.data.has(`reservas/fila/${pending.pedido_id}`)).toBe(true);
    expect(database.database.prepare('SELECT state FROM mobile_orders').get()).toMatchObject({ state: 'ready' });
  });

  it('oculta um pedido móvel da consulta pública antiga, preservando a consulta autenticada', async () => {
    const created = await createReservation();
    const { id } = await created.json() as { id: string };
    const publicRead = await worker.fetch(
      new Request(`https://reservas.kartodromodebetim.com.br/api/reservas/${id}`),
      environment as never,
      { waitUntil: () => undefined } as never,
    );

    expect(publicRead.status).toBe(404);
    expect((await request(`reservations/${id}`, { token: accountA.accessToken })).status).toBe(200);
  });
});
