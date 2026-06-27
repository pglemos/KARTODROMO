import http from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULT_UID } from '@/lib/livetime/demo-data';
import { TELAO_LAYOUT_PRESETS } from '@/lib/telao-layout-config';
import { readTelaoLayoutConfig, telaoLayoutStoreStatus, writeTelaoLayoutConfigToFile } from '@/lib/telao-layout-store';
import { readTb50Page, tb50PageStoreStatus, writeTb50PageToFile } from '@/lib/tb50-page-store';
import { listViplexPrograms, startViplexProgram } from '@/lib/viplex-programs';
import { fetchLapTimeCustomersPage } from '@/lib/livetime/laptime-customers';
import { LiveTimeScraper } from './livetime-scraper';

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

const uid = process.env.LIVETIME_UID || process.env.NEXT_PUBLIC_DEFAULT_UID || DEFAULT_UID;
const port = Number(process.env.SCRAPER_PORT || process.env.PORT || '4010');

const laptimeSqlOptions = process.env.LAPTIME_SQL_SERVER
  ? {
      server: process.env.LAPTIME_SQL_SERVER,
      instanceName: process.env.LAPTIME_SQL_INSTANCE,
      database: process.env.LAPTIME_SQL_DATABASE || 'LapTime',
      user: process.env.LAPTIME_SQL_USER || '',
      password: process.env.LAPTIME_SQL_PASSWORD || '',
      port: process.env.LAPTIME_SQL_PORT ? Number(process.env.LAPTIME_SQL_PORT) : undefined,
      timeoutMs: Number(process.env.LAPTIME_SQL_TIMEOUT_MS || process.env.LIVETIME_TIMEOUT_MS || '3000'),
    }
  : undefined;

const scraper = new LiveTimeScraper({
  uid,
  sourceUrl: process.env.LIVETIME_SOURCE_URL,
  apiBaseUrl: process.env.LAPTIME_API_BASE_URL,
  apiToken: process.env.LAPTIME_API_TOKEN,
  apiTokenFile: process.env.LAPTIME_API_TOKEN_FILE,
  sql: laptimeSqlOptions,
  headless: process.env.LIVETIME_HEADLESS !== 'false',
  pollMs: Number(process.env.LIVETIME_SCRAPER_POLL_MS || '2000'),
});

const NO_CACHE_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
  expires: '0',
  pragma: 'no-cache',
  'access-control-allow-origin': '*',
};

function sendJson(response: http.ServerResponse, status: number, body: unknown) {
  response.writeHead(status, NO_CACHE_HEADERS);
  response.end(JSON.stringify(body));
}

function readBody(request: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    request.setEncoding('utf8');
    request.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1024 * 1024) {
        request.destroy(new Error('Payload too large'));
      }
    });
    request.on('end', () => resolve(body));
    request.on('error', reject);
  });
}

async function handleLayout(request: http.IncomingMessage, response: http.ServerResponse) {
  if (request.method === 'GET') {
    sendJson(response, 200, {
      layout: readTelaoLayoutConfig(),
      presets: TELAO_LAYOUT_PRESETS,
      store: {
        ...telaoLayoutStoreStatus(),
        storage: 'file',
        persistent: true,
        localEndpoint: true,
      },
    });
    return;
  }

  if (request.method === 'PUT') {
    try {
      const layout = writeTelaoLayoutConfigToFile(JSON.parse(await readBody(request)));
      sendJson(response, 200, {
        layout,
        storage: 'file',
        persistent: true,
        store: {
          ...telaoLayoutStoreStatus(),
          storage: 'file',
          persistent: true,
          localEndpoint: true,
        },
      });
    } catch (error) {
      sendJson(response, 400, { error: error instanceof Error ? error.message : 'invalid_layout' });
    }
    return;
  }

  sendJson(response, 405, { error: 'method_not_allowed' });
}

async function handlePage(request: http.IncomingMessage, response: http.ServerResponse) {
  if (request.method === 'GET') {
    sendJson(response, 200, {
      ...readTb50Page(),
      store: {
        ...tb50PageStoreStatus(),
        storage: 'file',
        persistent: true,
        localEndpoint: true,
      },
    });
    return;
  }

  if (request.method === 'PUT') {
    try {
      const body = JSON.parse(await readBody(request));
      const page = writeTb50PageToFile(body?.offset);
      sendJson(response, 200, {
        ...page,
        store: {
          ...tb50PageStoreStatus(),
          storage: 'file',
          persistent: true,
          localEndpoint: true,
        },
      });
    } catch (error) {
      sendJson(response, 400, { error: error instanceof Error ? error.message : 'invalid_page' });
    }
    return;
  }

  sendJson(response, 405, { error: 'method_not_allowed' });
}

async function handleViplexPrograms(request: http.IncomingMessage, response: http.ServerResponse) {
  if (request.method === 'GET') {
    try {
      sendJson(response, 200, { programs: await listViplexPrograms(), localEndpoint: true });
    } catch (error) {
      sendJson(response, 502, { programs: [], error: error instanceof Error ? error.message : 'viplex_programs_failed' });
    }
    return;
  }

  if (request.method === 'PUT' || request.method === 'POST') {
    try {
      const body = JSON.parse(await readBody(request));
      const result = await startViplexProgram(body?.identifier);
      sendJson(response, 200, { ...result, localEndpoint: true });
    } catch (error) {
      sendJson(response, 400, { ok: false, error: error instanceof Error ? error.message : 'viplex_start_failed' });
    }
    return;
  }

  sendJson(response, 405, { error: 'method_not_allowed' });
}

async function handleLaptimeClientes(url: URL, response: http.ServerResponse) {
  if (!laptimeSqlOptions) {
    sendJson(response, 503, { error: 'laptime_sql_not_configured' });
    return;
  }

  try {
    const { rows, total } = await fetchLapTimeCustomersPage(laptimeSqlOptions, {
      q: url.searchParams.get('q') || undefined,
      limit: url.searchParams.get('limit') ? Number(url.searchParams.get('limit')) : undefined,
      offset: url.searchParams.get('offset') ? Number(url.searchParams.get('offset')) : undefined,
    });
    response.writeHead(200, { ...NO_CACHE_HEADERS, 'x-total-count': String(total) });
    response.end(JSON.stringify(rows));
  } catch (error) {
    sendJson(response, 502, { error: error instanceof Error ? error.message : 'laptime_sql_query_failed' });
  }
}

const server = http.createServer((request, response) => {
  const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);

  if (request.method === 'OPTIONS') {
    response.writeHead(204, {
      ...NO_CACHE_HEADERS,
      'access-control-allow-methods': 'GET, PUT, POST, OPTIONS',
      'access-control-allow-headers': 'content-type, ngrok-skip-browser-warning',
    });
    response.end();
    return;
  }

  if (url.pathname === '/healthz') {
    sendJson(response, 200, { ok: true, status: scraper.getSnapshot().status });
    return;
  }

  if (url.pathname === '/api/telao-layout-local' || url.pathname === '/api/telao-layout') {
    void handleLayout(request, response);
    return;
  }

  if (url.pathname === '/api/tb50-page-local' || url.pathname === '/api/tb50-page') {
    void handlePage(request, response);
    return;
  }

  if (url.pathname === '/api/viplex-programs-local' || url.pathname === '/api/viplex-programs') {
    void handleViplexPrograms(request, response);
    return;
  }

  if (url.pathname === '/api/livetime-snapshot') {
    sendJson(response, 200, scraper.getSnapshot());
    return;
  }

  if (url.pathname === '/api/laptime-clientes') {
    void handleLaptimeClientes(url, response);
    return;
  }

  sendJson(response, 404, { error: 'not_found' });
});

async function main() {
  await scraper.start();
  server.listen(port, () => {
    console.log(`LiveTime scraper listening on http://localhost:${port}/api/livetime-snapshot`);
  });
}

process.on('SIGINT', async () => {
  await scraper.stop();
  server.close(() => process.exit(0));
});

process.on('SIGTERM', async () => {
  await scraper.stop();
  server.close(() => process.exit(0));
});

void main();
