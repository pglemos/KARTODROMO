import http from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import sql from 'mssql';
import { LapTimeMirrorEngine } from '@/lib/livetime/laptime-mirror-sync';
import { mirrorSqlConfig, type MirrorSqlOptions, type SourceSqlOptions } from '@/lib/livetime/laptime-mirror-sql';
import type { TableSyncPlan } from '@/lib/livetime/laptime-mirror-tables';
import { ensureClienteUnificadoTable, syncClienteUnificado } from '@/lib/livetime/cliente-unificado-sync';

// Le .env.local manualmente (mesmo padrao de services/livetime-scraper-server.ts — dotenv nao e'
// usado neste projeto).
function loadLocalEnv() {
  const envPath = join(process.cwd(), '.env.local');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separator = trimmed.indexOf('=');
    if (separator <= 0) continue;
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim().replace(/^["']|["']$/g, '');
    process.env[key] ||= value;
  }
}

loadLocalEnv();

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Variavel de ambiente obrigatoria ausente: ${name}`);
  }
  return value;
}

const sourceOptions: SourceSqlOptions = {
  server: required('LAPTIME_SQL_SERVER'),
  instanceName: process.env.LAPTIME_SQL_INSTANCE,
  database: process.env.LAPTIME_SQL_DATABASE || 'LapTime',
  user: required('LAPTIME_SQL_USER'),
  password: required('LAPTIME_SQL_PASSWORD'),
  port: process.env.LAPTIME_SQL_PORT ? Number(process.env.LAPTIME_SQL_PORT) : undefined,
  timeoutMs: Number(process.env.LAPTIME_SQL_TIMEOUT_MS || '120000'),
};

const mirrorOptions: MirrorSqlOptions = {
  server: required('SRVKART_SQL_SERVER'),
  instanceName: process.env.SRVKART_SQL_INSTANCE,
  database: process.env.SRVKART_SQL_DATABASE || 'LapTimeMirror',
  user: required('SRVKART_SQL_USER'),
  password: required('SRVKART_SQL_PASSWORD'),
  port: process.env.SRVKART_SQL_PORT ? Number(process.env.SRVKART_SQL_PORT) : undefined,
  timeoutMs: Number(process.env.SRVKART_SQL_TIMEOUT_MS || '120000'),
};

const logFile = process.env.MIRROR_LOG_FILE || join(process.cwd(), '.runtime', 'laptime-mirror.log');
const port = Number(process.env.MIRROR_PORT || '4020');

const engine = new LapTimeMirrorEngine({
  source: sourceOptions,
  mirror: mirrorOptions,
  logFile,
  batchSize: Number(process.env.MIRROR_BATCH_SIZE || '5000'),
});

// Guarda quando cada tabela foi sincronizada pela ultima vez, para respeitar o intervalo por tabela.
const lastRunAt: Record<string, number> = {};

function isDue(plan: TableSyncPlan, now: number): boolean {
  const last = lastRunAt[plan.name] || 0;
  return now - last >= plan.intervalMs;
}

let ticking = false;

async function tick() {
  if (ticking) return;
  ticking = true;
  const now = Date.now();
  try {
    await engine.runDueTables(now, (plan) => isDue(plan, now));
    for (const plan of engine.getPlan()) {
      if (isDue(plan, now)) {
        lastRunAt[plan.name] = now;
      }
    }
  } catch (err) {
    engine.log(`tick ERRO: ${(err as Error).message}`);
  } finally {
    ticking = false;
  }
}

// Job separado: concentra LapTime (Customer) + CalXPro (CLIENTE/CONTATO) numa unica tabela
// dbo.ClienteUnificado no espelho, ver lib/livetime/cliente-unificado-sync.ts. Cadencia propria
// (mais lenta que Customer, pois 2 das 3 fontes sao historico estatico) e nao entra no plano
// generico de tabelas porque nao e' um espelho 1:1 de uma tabela de origem.
const CLIENTE_UNIFICADO_INTERVAL_MS = Number(process.env.MIRROR_CLIENTE_UNIFICADO_INTERVAL_MS || '300000');
let lastClienteUnificadoRunAt = 0;
let clienteUnificadoTicking = false;

async function tickClienteUnificado() {
  if (clienteUnificadoTicking) return;
  const now = Date.now();
  if (now - lastClienteUnificadoRunAt < CLIENTE_UNIFICADO_INTERVAL_MS) return;
  clienteUnificadoTicking = true;
  const pool = new sql.ConnectionPool(mirrorSqlConfig(mirrorOptions));
  try {
    await pool.connect();
    await ensureClienteUnificadoTable(pool);
    const count = await syncClienteUnificado(pool);
    lastClienteUnificadoRunAt = Date.now();
    engine.log(`sync: ClienteUnificado = ${count} linhas em ${Date.now() - now}ms`);
  } catch (err) {
    engine.log(`sync ERRO ClienteUnificado: ${(err as Error).message}`);
  } finally {
    await pool.close().catch(() => undefined);
    clienteUnificadoTicking = false;
  }
}

const NO_CACHE_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'access-control-allow-origin': '*',
};

const server = http.createServer((request, response) => {
  const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
  if (url.pathname === '/healthz') {
    const status = engine.getStatus();
    const clienteUnificado = {
      lastSyncUtc: lastClienteUnificadoRunAt ? new Date(lastClienteUnificadoRunAt).toISOString() : null,
    };
    response.writeHead(200, NO_CACHE_HEADERS);
    response.end(JSON.stringify({ ok: true, ...status, clienteUnificado }));
    return;
  }
  response.writeHead(404, NO_CACHE_HEADERS);
  response.end(JSON.stringify({ error: 'not_found' }));
});

async function main() {
  const isBootstrap = process.argv.includes('--bootstrap');
  if (isBootstrap) {
    engine.log('=== BOOTSTRAP iniciado ===');
    await engine.bootstrap();
    engine.log('=== BOOTSTRAP concluido ===');
    process.exit(0);
    return;
  }

  engine.log('=== Daemon de espelho iniciando ===');
  await engine.prepare();
  server.listen(port, () => {
    engine.log(`healthz em http://localhost:${port}/healthz`);
  });

  // Loop principal: verifica a cada 2s quais tabelas venceram o intervalo.
  const loopMs = Number(process.env.MIRROR_LOOP_MS || '2000');
  setInterval(() => {
    void tick();
    void tickClienteUnificado();
  }, loopMs);
  void tick();
  void tickClienteUnificado();
}

process.on('SIGINT', () => {
  engine.log('SIGINT: encerrando');
  server.close(() => process.exit(0));
});
process.on('SIGTERM', () => {
  engine.log('SIGTERM: encerrando');
  server.close(() => process.exit(0));
});

void main().catch((err) => {
  engine.log(`FATAL: ${(err as Error).message}`);
  process.exit(1);
});
