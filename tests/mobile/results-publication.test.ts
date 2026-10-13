import { spawn, type ChildProcess } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { createServer, type Server } from 'node:http';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { once } from 'node:events';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import worker from '../../workers/pre-cadastro/src/index';

const migrations = [
  '0001_mobile_identity.sql',
  '0002_mobile_bookings.sql',
  '0003_mobile_coupon_previews.sql',
  '0004_mobile_results.sql',
].map((name) => new URL(`../../workers/pre-cadastro/migrations/${name}`, import.meta.url));

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
    for (const migration of migrations) {
      if (existsSync(migration)) this.database.exec(readFileSync(migration, 'utf8'));
    }
  }

  prepare(query: string) {
    return new TestStatement(this.database, query);
  }

  async batch(statements: TestStatement[]) {
    this.database.exec('BEGIN');
    try {
      const results = [];
      for (const statement of statements) results.push(await statement.run());
      this.database.exec('COMMIT');
      return results;
    } catch (error) {
      this.database.exec('ROLLBACK');
      throw error;
    }
  }

  close() {
    this.database.close();
  }
}

const randomSecret = () => Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url');
const realFetch = globalThis.fetch.bind(globalThis);
const PUBLISH_TOKEN = 'publish-token-for-local-test-only';
const ADMIN_TOKEN = 'admin-token-for-local-test-only';
const OPERATOR_TOKEN = 'operator-token-for-local-test-only';

function cpfForTest() {
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
}

const resultPayload = {
  action: 'publish',
  sessionId: '2026-10-13-teste-codex',
  eventName: 'TESTE CODEX · Treino',
  eventDate: '2026-10-13',
  results: [{ customerId: '312', displayName: 'Ana Silva', position: 1, kart: '12', laps: 4, bestLapMs: 29_340 }],
};

let database: TestD1;
let emails: Record<string, unknown>[];
let env: Record<string, unknown>;

beforeEach(() => {
  database = new TestD1();
  emails = [];
  vi.stubGlobal('fetch', vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
    emails.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
    return new Response('{"id":"test-email"}', { status: 200, headers: { 'content-type': 'application/json' } });
  }));
  env = {
    MOBILE_DB: database,
    MOBILE_LOOKUP_KEY: randomSecret(),
    MOBILE_DATA_KEY: randomSecret(),
    MOBILE_PUBLISH_TOKEN: PUBLISH_TOKEN,
    MOBILE_ADMIN_TOKEN: ADMIN_TOKEN,
    RESEND_API_KEY: randomSecret(),
    RESEND_FROM_EMAIL: 'Kartódromo <conta@kartodromodebetim.com.br>',
    SYNC_KEY: randomSecret(),
    ASSETS: { fetch: async () => new Response('not found', { status: 404 }) },
  };
});

afterEach(() => {
  database.close();
  vi.unstubAllGlobals();
});

async function callWorker(path: string, method = 'GET', body?: unknown, headers: Record<string, string> = {}) {
  const request = new Request(`https://reservas.kartodromodebetim.com.br${path}`, {
    method,
    headers: { ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return worker.fetch(request, env as never, { waitUntil: () => undefined });
}

function verificationToken() {
  const token = /token=([A-Za-z0-9_-]+)/.exec(JSON.stringify(emails[emails.length - 1]))?.[1];
  if (!token) throw new Error('O e-mail de teste não continha o token de verificação.');
  return token;
}

async function createVerifiedAccount(email: string) {
  const registration = await callWorker('/api/mobile/v1/auth/register', 'POST', {
    name: 'Ana Silva',
    cpf: cpfForTest(),
    email,
    phone: '+55 31 98888-7777',
    password: 'SenhaSegura!2026',
    privacyAccepted: true,
  }, { 'cf-connecting-ip': '203.0.113.20' });
  expect(registration.status).toBe(202);
  const token = verificationToken();
  const tokenHash = Buffer.from(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))).toString('base64url');
  expect(database.database.prepare('SELECT purpose FROM mobile_email_tokens WHERE token_hash = ?').get(tokenHash))
    .toMatchObject({ purpose: 'verify' });
  const storedToken = database.database.prepare('SELECT used_at, expires_at FROM mobile_email_tokens WHERE token_hash = ?').get(tokenHash) as Row;
  expect(storedToken.used_at).toBeNull();
  expect(Number(storedToken.expires_at)).toBeGreaterThan(Date.now());
  const verified = await callWorker('/api/mobile/v1/auth/email/verify', 'POST', { token });
  expect(verified.status, await verified.text()).toBe(200);
  const login = await callWorker('/api/mobile/v1/auth/login', 'POST', {
    identifier: email,
    password: 'SenhaSegura!2026',
  }, { 'cf-connecting-ip': '203.0.113.20' });
  expect(login.status).toBe(200);
  return String((await login.json() as { accessToken: string }).accessToken);
}

describe('API pública de resultados móveis', () => {
  it('aceita apenas publicação autenticada e exibe os dados oficiais permitidos', async () => {
    expect((await callWorker('/api/mobile/v1/results')).status).toBe(200);
    expect((await callWorker('/api/mobile/v1/internal/results', 'POST', resultPayload)).status).toBe(401);

    const published = await callWorker('/api/mobile/v1/internal/results', 'POST', {
      ...resultPayload,
      results: [{ ...resultPayload.results[0], email: 'privado@example.com', cpf: '12345678909' }],
    }, { 'x-mobile-publish-token': PUBLISH_TOKEN });
    expect(published.status).toBe(200);

    const listing = await callWorker('/api/mobile/v1/results');
    expect(listing.status).toBe(200);
    const payload = JSON.stringify(await listing.json());
    expect(payload).toContain('Ana Silva');
    expect(payload).toContain('TESTE CODEX · Treino');
    expect(payload).not.toContain('privado@example.com');
    expect(payload).not.toContain('12345678909');
  });

  it('atualiza correções por sessão e retira o resultado público com auditoria', async () => {
    const publish = (body: unknown) => callWorker('/api/mobile/v1/internal/results', 'POST', body, {
      'x-mobile-publish-token': PUBLISH_TOKEN,
    });
    expect((await publish(resultPayload)).status).toBe(200);
    expect((await publish(resultPayload)).status).toBe(200);
    expect(database.database.prepare('SELECT COUNT(*) AS total FROM mobile_results_audit').get()).toMatchObject({ total: 1 });
    expect((await publish({ ...resultPayload, results: [{ ...resultPayload.results[0], position: 2 }] })).status).toBe(200);

    const corrected = await callWorker('/api/mobile/v1/results');
    expect(await corrected.json()).toMatchObject([{ sessionId: resultPayload.sessionId, results: [{ position: 2 }] }]);

    expect((await publish({ action: 'withdraw', sessionId: resultPayload.sessionId })).status).toBe(200);
    expect(await (await callWorker('/api/mobile/v1/results')).json()).toEqual([]);
    expect(database.database.prepare('SELECT COUNT(*) AS total FROM mobile_results_audit').get()).toMatchObject({ total: 3 });
  });

  it('vincula somente e-mail verificado e entrega histórico apenas à conta validada', async () => {
    const email = `ana+${crypto.randomUUID()}@example.com`;
    const accessToken = await createVerifiedAccount(email);
    expect((await callWorker('/api/mobile/v1/internal/results', 'POST', resultPayload, {
      'x-mobile-publish-token': PUBLISH_TOKEN,
    })).status).toBe(200);
    expect((await callWorker('/api/mobile/v1/internal/identity-links', 'POST', {
      customerId: '312', email,
    })).status).toBe(401);

    const linked = await callWorker('/api/mobile/v1/internal/identity-links', 'POST', {
      customerId: '312', email,
    }, { 'x-mobile-admin-token': ADMIN_TOKEN });
    expect(linked.status).toBe(200);
    const history = await callWorker('/api/mobile/v1/results/me', 'GET', undefined, {
      authorization: `Bearer ${accessToken}`,
    });
    const historyBody = await history.json();
    expect(historyBody).toMatchObject({ vinculo: 'validado', results: [{ displayName: 'Ana Silva' }] });
    expect(JSON.stringify(historyBody)).not.toContain('312');

    const unlinkedToken = await createVerifiedAccount(`outra+${crypto.randomUUID()}@example.com`);
    const unlinked = await callWorker('/api/mobile/v1/results/me', 'GET', undefined, {
      authorization: `Bearer ${unlinkedToken}`,
    });
    expect(await unlinked.json()).toEqual({
      vinculo: 'pendente',
      mensagem: 'Para ver seu histórico, procure a recepção.',
      results: [],
    });
  });
});

describe('publicação pela API da cronometragem simulada', () => {
  let mockServer: Server;
  let timingProcess: ChildProcess;
  let dataDir: string;
  let baseUrl: string;
  let permissionAllowed = true;
  let redirectPublication = false;
  let redirectedRequests = 0;
  let receivedPublications: Record<string, unknown>[];

  beforeAll(async () => {
    permissionAllowed = true;
    redirectPublication = false;
    redirectedRequests = 0;
    receivedPublications = [];
    mockServer = createServer((request, response) => {
      if (request.url === '/api/office/mobile-permissions/resultados_publicar_mobile') {
        if (request.headers.authorization !== `Bearer ${OPERATOR_TOKEN}` || request.headers['x-ops-key'] !== 'test-ops-key') {
          response.writeHead(401, { 'content-type': 'application/json' });
          response.end('{"erro":"Sessão inválida."}');
          return;
        }
        response.writeHead(permissionAllowed ? 200 : 403, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ allowed: permissionAllowed }));
        return;
      }
      if (request.url === '/api/mobile/v1/internal/results') {
        if (redirectPublication) {
          response.writeHead(307, { location: '/capture' });
          response.end();
          return;
        }
        if (request.headers['x-mobile-publish-token'] !== PUBLISH_TOKEN) {
          response.writeHead(401, { 'content-type': 'application/json' });
          response.end('{"erro":"Não autorizado."}');
          return;
        }
        let raw = '';
        request.setEncoding('utf8');
        request.on('data', (chunk: string) => { raw += chunk; });
        request.on('end', () => {
          receivedPublications.push(JSON.parse(raw) as Record<string, unknown>);
          response.writeHead(200, { 'content-type': 'application/json' });
          response.end('{"ok":true}');
        });
        return;
      }
      if (request.url === '/capture') {
        redirectedRequests++;
        response.writeHead(200);
        response.end();
        return;
      }
      response.writeHead(404);
      response.end();
    });
    await new Promise<void>((resolveListen) => mockServer.listen(0, '127.0.0.1', resolveListen));
    const address = mockServer.address();
    if (!address || typeof address === 'string') throw new Error('Não foi possível iniciar o servidor de teste local.');
    const mockUrl = `http://127.0.0.1:${address.port}`;
    dataDir = mkdtempSync(join(tmpdir(), 'kartodromo-mobile-results-'));
    timingProcess = spawn(process.execPath, [resolve('node_modules/tsx/dist/cli.mjs'), 'services/timing-server.ts'], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        TIMING_SIMULATE: '1',
        TIMING_PORT: '4150',
        TIMING_SIM_PORT: '0',
        TIMING_DATA_DIR: dataDir,
        OPS_URL: mockUrl,
        OPS_RECEPCAO_KEY: 'test-ops-key',
        MOBILE_RESULTS_URL: `${mockUrl}/api/mobile/v1/internal/results`,
        MOBILE_PUBLISH_TOKEN: PUBLISH_TOKEN,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    baseUrl = 'http://127.0.0.1:4150';
    await new Promise<void>((ready, reject) => {
      let output = '';
      const timeout = setTimeout(() => reject(new Error(`Cronometragem simulada não iniciou: ${output}`)), 10_000);
      const capture = (chunk: Buffer) => {
        output += chunk.toString();
        if (output.includes('Cronometragem em http://0.0.0.0:4150')) {
          clearTimeout(timeout);
          ready();
        }
      };
      timingProcess.stdout?.on('data', capture);
      timingProcess.stderr?.on('data', capture);
      timingProcess.once('exit', (code) => {
        clearTimeout(timeout);
        reject(new Error(`Cronometragem simulada encerrou antes de iniciar (${code}): ${output}`));
      });
    });
  }, 20_000);

  afterAll(async () => {
    if (timingProcess && timingProcess.exitCode === null) {
      timingProcess.kill('SIGTERM');
      await once(timingProcess, 'exit');
    }
    if (mockServer) await new Promise<void>((resolveClose) => mockServer.close(() => resolveClose()));
    if (dataDir) rmSync(dataDir, { recursive: true, force: true });
  });

  async function timingPost(path: string, body: unknown, operatorToken?: string) {
    return realFetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(operatorToken ? { authorization: `Bearer ${operatorToken}` } : {}),
      },
      body: JSON.stringify(body),
    });
  }

  async function createSession(name: string, customerId?: string) {
    const response = await timingPost('/api/sessions', {
      name,
      type: 'treino',
      durationMin: 5,
      competitors: [{ kart: '12', name: 'Ana Silva', ...(customerId ? { customerId } : {}) }],
    });
    expect(response.status).toBe(201);
    return await response.json() as { id: string };
  }

  async function closeSession(id: string) {
    expect((await timingPost(`/api/sessions/${id}/start`, {})).status).toBe(200);
    expect((await timingPost(`/api/sessions/${id}/close`, {})).status).toBe(200);
  }

  it('exige a permissão resultados_publicar_mobile para publicar', async () => {
    const session = await createSession('TESTE CODEX · sem permissão', '312');
    expect((await timingPost(`/api/sessions/${session.id}/mobile-publication`, { action: 'publish' })).status).toBe(401);
    permissionAllowed = false;
    expect((await timingPost(`/api/sessions/${session.id}/mobile-publication`, { action: 'publish' }, OPERATOR_TOKEN)).status).toBe(403);
  });

  it('recusa sessão aberta ou competidor sem customerId', async () => {
    permissionAllowed = true;
    const open = await createSession('TESTE CODEX · em aberto', '312');
    expect((await timingPost(`/api/sessions/${open.id}/mobile-publication`, { action: 'publish' }, OPERATOR_TOKEN)).status).toBe(409);

    const missingCustomer = await createSession('TESTE CODEX · sem identidade');
    await closeSession(missingCustomer.id);
    expect((await timingPost(`/api/sessions/${missingCustomer.id}/mobile-publication`, { action: 'publish' }, OPERATOR_TOKEN)).status).toBe(400);
  });

  it('publica, corrige e retira apenas os campos da lista permitida', async () => {
    const session = await createSession('TESTE CODEX · publicação', '312');
    await closeSession(session.id);
    const published = await timingPost(`/api/sessions/${session.id}/mobile-publication`, { action: 'publish' }, OPERATOR_TOKEN);
    expect(published.status).toBe(200);
    const payload = receivedPublications[receivedPublications.length - 1];
    expect(payload).toMatchObject({
      action: 'publish',
      sessionId: session.id,
      eventDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      results: [{ customerId: '312', displayName: 'Ana Silva', position: 1, kart: '12' }],
    });
    expect(Object.keys(payload ?? {}).sort()).toEqual(['action', 'eventDate', 'eventName', 'results', 'sessionId']);
    expect(Object.keys(((payload?.results as Record<string, unknown>[])[0])).sort()).toEqual([
      'bestLapMs', 'customerId', 'displayName', 'kart', 'laps', 'position',
    ]);

    expect((await timingPost(`/api/sessions/${session.id}/mobile-publication`, { action: 'withdraw' }, OPERATOR_TOKEN)).status).toBe(200);
    expect(receivedPublications[receivedPublications.length - 1]).toEqual({ action: 'withdraw', sessionId: session.id });
  });

  it('não segue redirecionamentos antes de enviar o token de publicação', async () => {
    const session = await createSession('TESTE CODEX · sem redirecionamento', '312');
    await closeSession(session.id);
    redirectPublication = true;

    const response = await timingPost(`/api/sessions/${session.id}/mobile-publication`, { action: 'publish' }, OPERATOR_TOKEN);

    redirectPublication = false;
    expect(response.status).toBe(502);
    expect(redirectedRequests).toBe(0);
  });
});
