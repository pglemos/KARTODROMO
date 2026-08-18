import http from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { TELAO_LAYOUT_PRESETS } from '@/lib/telao-layout-config';
import { readTelaoLayoutConfig, telaoLayoutStoreStatus, writeTelaoLayoutConfigToFile } from '@/lib/telao-layout-store';
import { readTb50Page, tb50PageStoreStatus, writeTb50PageToFile } from '@/lib/tb50-page-store';
import { listViplexPrograms, startViplexProgram } from '@/lib/viplex-programs';
import { fetchClientesPage } from '@/lib/livetime/cliente-unificado';
import { fetchCalXProCreditosPage, fetchCalXProReceitasPage } from '@/lib/livetime/calxpro-receitas';
import { fetchCalXProCorridaCompetidores, fetchCalXProCorridasPage } from '@/lib/livetime/calxpro-corridas';
import { fetchLapTimeBookingCustomers, fetchLapTimeBookingsPage } from '@/lib/livetime/laptime-bookings';
import { fetchLapTimeRacingCompetitors, fetchLapTimeRacingsPage } from '@/lib/livetime/laptime-racings';
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

const calxproSqlOptions = process.env.CALXPRO_SQL_SERVER
  ? {
      server: process.env.CALXPRO_SQL_SERVER,
      instanceName: process.env.CALXPRO_SQL_INSTANCE,
      database: process.env.CALXPRO_SQL_DATABASE || 'CALXPRO',
      user: process.env.CALXPRO_SQL_USER || '',
      password: process.env.CALXPRO_SQL_PASSWORD || '',
      port: process.env.CALXPRO_SQL_PORT ? Number(process.env.CALXPRO_SQL_PORT) : undefined,
      timeoutMs: Number(process.env.CALXPRO_SQL_TIMEOUT_MS || '5000'),
    }
  : undefined;

// Espelho (LapTimeMirror no SRVKART, ver lib/livetime/laptime-mirror-sync.ts). Mesmo schema da
// producao (tabela/coluna por nome identico), preenchido por um daemon separado com alguns
// segundos/minutos de atraso — ver [[laptime-espelho-srvkart]] na memoria do projeto.
const mirrorSqlOptions = process.env.SRVKART_SQL_SERVER
  ? {
      server: process.env.SRVKART_SQL_SERVER,
      instanceName: process.env.SRVKART_SQL_INSTANCE,
      database: process.env.SRVKART_SQL_DATABASE || 'LapTimeMirror',
      user: process.env.SRVKART_SQL_USER || '',
      password: process.env.SRVKART_SQL_PASSWORD || '',
      port: process.env.SRVKART_SQL_PORT ? Number(process.env.SRVKART_SQL_PORT) : undefined,
      timeoutMs: Number(process.env.SRVKART_SQL_TIMEOUT_MS || '5000'),
    }
  : undefined;

// Migracao pagina-por-pagina pro espelho (2026-07-02): cada leitura do LapTime pode ser apontada
// pro espelho individualmente via env var, default 'production' (comportamento atual, sem
// mudanca). So' muda de fato quando a var especifica for setada pra 'mirror' E o espelho estiver
// configurado — senao cai pra producao (nunca quebra por falta de config do espelho). Clientes nao
// usa esse toggle: sempre le de dbo.ClienteUnificado no espelho (ver cliente-unificado.ts), que so'
// existe la'.
type LaptimeReadSource = 'bookings' | 'racings';

function resolveLaptimeSqlOptions(feature: LaptimeReadSource) {
  const envKey = `LAPTIME_READ_SOURCE_${feature.toUpperCase()}`;
  const wantsMirror = (process.env[envKey] || 'production').toLowerCase() === 'mirror';
  return wantsMirror && mirrorSqlOptions ? mirrorSqlOptions : laptimeSqlOptions;
}

const scraper = new LiveTimeScraper({
  apiBaseUrl: process.env.LAPTIME_API_BASE_URL,
  apiToken: process.env.LAPTIME_API_TOKEN,
  apiTokenFile: process.env.LAPTIME_API_TOKEN_FILE,
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

async function handleClientes(url: URL, response: http.ServerResponse) {
  if (!mirrorSqlOptions) {
    sendJson(response, 503, { error: 'mirror_sql_not_configured' });
    return;
  }

  try {
    const { rows, total } = await fetchClientesPage(mirrorSqlOptions, {
      q: url.searchParams.get('q') || undefined,
      limit: url.searchParams.get('limit') ? Number(url.searchParams.get('limit')) : undefined,
      offset: url.searchParams.get('offset') ? Number(url.searchParams.get('offset')) : undefined,
    });
    response.writeHead(200, { ...NO_CACHE_HEADERS, 'x-total-count': String(total) });
    response.end(JSON.stringify(rows));
  } catch (error) {
    sendJson(response, 502, { error: error instanceof Error ? error.message : 'mirror_sql_query_failed' });
  }
}

async function handleCalXProReceitas(url: URL, response: http.ServerResponse) {
  if (!calxproSqlOptions) {
    sendJson(response, 503, { error: 'calxpro_sql_not_configured' });
    return;
  }

  try {
    const { rows, total } = await fetchCalXProReceitasPage(calxproSqlOptions, {
      q: url.searchParams.get('q') || undefined,
      limit: url.searchParams.get('limit') ? Number(url.searchParams.get('limit')) : undefined,
      offset: url.searchParams.get('offset') ? Number(url.searchParams.get('offset')) : undefined,
    });
    response.writeHead(200, { ...NO_CACHE_HEADERS, 'x-total-count': String(total) });
    response.end(JSON.stringify(rows));
  } catch (error) {
    sendJson(response, 502, { error: error instanceof Error ? error.message : 'calxpro_sql_query_failed' });
  }
}

async function handleCalXProCreditos(url: URL, response: http.ServerResponse) {
  if (!calxproSqlOptions) {
    sendJson(response, 503, { error: 'calxpro_sql_not_configured' });
    return;
  }

  try {
    const { rows, total } = await fetchCalXProCreditosPage(calxproSqlOptions, {
      limit: url.searchParams.get('limit') ? Number(url.searchParams.get('limit')) : undefined,
      offset: url.searchParams.get('offset') ? Number(url.searchParams.get('offset')) : undefined,
    });
    response.writeHead(200, { ...NO_CACHE_HEADERS, 'x-total-count': String(total) });
    response.end(JSON.stringify(rows));
  } catch (error) {
    sendJson(response, 502, { error: error instanceof Error ? error.message : 'calxpro_sql_query_failed' });
  }
}

async function handleCalXProCorridas(url: URL, response: http.ServerResponse) {
  if (!calxproSqlOptions) {
    sendJson(response, 503, { error: 'calxpro_sql_not_configured' });
    return;
  }

  try {
    const { rows, total } = await fetchCalXProCorridasPage(calxproSqlOptions, {
      q: url.searchParams.get('q') || undefined,
      from: url.searchParams.get('from') || undefined,
      to: url.searchParams.get('to') || undefined,
      limit: url.searchParams.get('limit') ? Number(url.searchParams.get('limit')) : undefined,
      offset: url.searchParams.get('offset') ? Number(url.searchParams.get('offset')) : undefined,
    });
    response.writeHead(200, { ...NO_CACHE_HEADERS, 'x-total-count': String(total) });
    response.end(JSON.stringify(rows));
  } catch (error) {
    sendJson(response, 502, { error: error instanceof Error ? error.message : 'calxpro_sql_query_failed' });
  }
}

async function handleCalXProCorridaCompetidores(url: URL, response: http.ServerResponse) {
  if (!calxproSqlOptions) {
    sendJson(response, 503, { error: 'calxpro_sql_not_configured' });
    return;
  }

  const corridaId = url.searchParams.get('corridaId');
  if (!corridaId) {
    sendJson(response, 400, { error: 'missing_corridaId' });
    return;
  }

  try {
    const rows = await fetchCalXProCorridaCompetidores(calxproSqlOptions, corridaId);
    response.writeHead(200, NO_CACHE_HEADERS);
    response.end(JSON.stringify(rows));
  } catch (error) {
    sendJson(response, 502, { error: error instanceof Error ? error.message : 'calxpro_sql_query_failed' });
  }
}

async function handleLaptimeBookings(url: URL, response: http.ServerResponse) {
  const sqlOptions = resolveLaptimeSqlOptions('bookings');
  if (!sqlOptions) {
    sendJson(response, 503, { error: 'laptime_sql_not_configured' });
    return;
  }

  try {
    const status = url.searchParams.get('status');
    const { rows, total } = await fetchLapTimeBookingsPage(sqlOptions, {
      q: url.searchParams.get('q') || undefined,
      status: status === 'aberta' || status === 'encerrada' ? status : undefined,
      from: url.searchParams.get('from') || undefined,
      to: url.searchParams.get('to') || undefined,
      limit: url.searchParams.get('limit') ? Number(url.searchParams.get('limit')) : undefined,
      offset: url.searchParams.get('offset') ? Number(url.searchParams.get('offset')) : undefined,
    });
    response.writeHead(200, { ...NO_CACHE_HEADERS, 'x-total-count': String(total) });
    response.end(JSON.stringify(rows));
  } catch (error) {
    sendJson(response, 502, { error: error instanceof Error ? error.message : 'laptime_sql_query_failed' });
  }
}

async function handleLaptimeBookingCustomers(url: URL, response: http.ServerResponse) {
  const sqlOptions = resolveLaptimeSqlOptions('bookings');
  if (!sqlOptions) {
    sendJson(response, 503, { error: 'laptime_sql_not_configured' });
    return;
  }

  const bookingId = url.searchParams.get('bookingId');
  if (!bookingId) {
    sendJson(response, 400, { error: 'bookingId_required' });
    return;
  }

  try {
    const rows = await fetchLapTimeBookingCustomers(sqlOptions, bookingId);
    sendJson(response, 200, rows);
  } catch (error) {
    sendJson(response, 502, { error: error instanceof Error ? error.message : 'laptime_sql_query_failed' });
  }
}

async function handleLaptimeRacings(url: URL, response: http.ServerResponse) {
  const sqlOptions = resolveLaptimeSqlOptions('racings');
  if (!sqlOptions) {
    sendJson(response, 503, { error: 'laptime_sql_not_configured' });
    return;
  }

  try {
    const status = url.searchParams.get('status');
    const { rows, total } = await fetchLapTimeRacingsPage(sqlOptions, {
      q: url.searchParams.get('q') || undefined,
      status: status === 'finalizada' || status === 'aberta' ? status : undefined,
      from: url.searchParams.get('from') || undefined,
      to: url.searchParams.get('to') || undefined,
      limit: url.searchParams.get('limit') ? Number(url.searchParams.get('limit')) : undefined,
      offset: url.searchParams.get('offset') ? Number(url.searchParams.get('offset')) : undefined,
    });
    response.writeHead(200, { ...NO_CACHE_HEADERS, 'x-total-count': String(total) });
    response.end(JSON.stringify(rows));
  } catch (error) {
    sendJson(response, 502, { error: error instanceof Error ? error.message : 'laptime_sql_query_failed' });
  }
}

async function handleLaptimeRacingCompetitors(url: URL, response: http.ServerResponse) {
  const sqlOptions = resolveLaptimeSqlOptions('racings');
  if (!sqlOptions) {
    sendJson(response, 503, { error: 'laptime_sql_not_configured' });
    return;
  }

  const racingId = url.searchParams.get('racingId');
  if (!racingId) {
    sendJson(response, 400, { error: 'racingId_required' });
    return;
  }

  try {
    const rows = await fetchLapTimeRacingCompetitors(sqlOptions, racingId);
    sendJson(response, 200, rows);
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

  if (url.pathname === '/api/clientes') {
    void handleClientes(url, response);
    return;
  }

  if (url.pathname === '/api/calxpro-receitas') {
    void handleCalXProReceitas(url, response);
    return;
  }

  if (url.pathname === '/api/calxpro-creditos') {
    void handleCalXProCreditos(url, response);
    return;
  }

  if (url.pathname === '/api/calxpro-corridas') {
    void handleCalXProCorridas(url, response);
    return;
  }

  if (url.pathname === '/api/calxpro-corrida-competidores') {
    void handleCalXProCorridaCompetidores(url, response);
    return;
  }

  if (url.pathname === '/api/laptime-bookings') {
    void handleLaptimeBookings(url, response);
    return;
  }

  if (url.pathname === '/api/laptime-booking-customers') {
    void handleLaptimeBookingCustomers(url, response);
    return;
  }

  if (url.pathname === '/api/laptime-racings') {
    void handleLaptimeRacings(url, response);
    return;
  }

  if (url.pathname === '/api/laptime-racing-competitors') {
    void handleLaptimeRacingCompetitors(url, response);
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
