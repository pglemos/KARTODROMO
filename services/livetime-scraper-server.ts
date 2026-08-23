import http from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import sql from 'mssql';
import { DEFAULT_UID } from '@/lib/livetime/demo-data';
import { LapTimeApiClient } from '@/lib/livetime/laptime-api-client';
import { TELAO_LAYOUT_PRESETS } from '@/lib/telao-layout-config';
import { readTelaoLayoutConfig, telaoLayoutStoreStatus, writeTelaoLayoutConfigToFile } from '@/lib/telao-layout-store';
import { readTb50Page, tb50PageStoreStatus, writeTb50PageToFile } from '@/lib/tb50-page-store';
import { listViplexPrograms, provisionViplexHtmlProgram, startViplexProgram } from '@/lib/viplex-programs';
import { readTelaoPlaylistFromStore, telaoPlaylistStoreStatus, writeTelaoPlaylist } from '@/lib/telao-playlist-store';
import { fetchClientesPage } from '@/lib/livetime/cliente-unificado';
import { fetchCalXProCreditosPage, fetchCalXProReceitasPage } from '@/lib/livetime/calxpro-receitas';
import { fetchCalXProCorridaCompetidores, fetchCalXProCorridasPage } from '@/lib/livetime/calxpro-corridas';
import { fetchLapTimeBookingCustomers, fetchLapTimeBookingsPage } from '@/lib/livetime/laptime-bookings';
import {
  fetchLapTimeCurrentPitData,
  type LapTimeRacingPitData,
} from '@/lib/livetime/laptime-pit-stops';
import {
  fetchLapTimeRacingDetail,
  fetchLapTimeRacingCompetitors,
  fetchLapTimeRacingLaps,
  fetchLapTimeRacingsPage,
} from '@/lib/livetime/laptime-racings';
import { fetchLapTimeKartHistory, fetchLapTimeKartHistorySummary } from '@/lib/livetime/kart-history';
import { fetchLapTimeKartFleet } from '@/lib/livetime/kart-fleet';
import { fetchEqualizacaoLiveSnapshot } from '@/lib/equalizacao/equalizacao-live-source';
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

// The SRVKART deployment uses the TB50's internal HTML program. Do not let a
// stale machine-level variable route the controller back to the legacy HLS
// publisher, which would incorrectly make FFmpeg/MediaMTX a requirement.
process.env.VIPLEX_LIVE_PROGRAM_MODE = 'html';

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

let lapTimeAuthPool: Promise<sql.ConnectionPool> | null = null;

async function getLapTimeServerNowUtc() {
  if (!laptimeSqlOptions) throw new Error('laptime_auth_sql_not_configured');

  if (!lapTimeAuthPool) {
    lapTimeAuthPool = sql.connect({
      server: laptimeSqlOptions.server,
      database: laptimeSqlOptions.database,
      user: laptimeSqlOptions.user,
      password: laptimeSqlOptions.password,
      port: laptimeSqlOptions.port,
      connectionTimeout: laptimeSqlOptions.timeoutMs,
      requestTimeout: laptimeSqlOptions.timeoutMs,
      options: {
        instanceName: laptimeSqlOptions.instanceName,
        encrypt: false,
        trustServerCertificate: true,
      },
    });
  }

  const pool = await lapTimeAuthPool;
  const result = await pool.request().query('SELECT GETUTCDATE() AS serverNowUtc');
  return new Date(result.recordset[0].serverNowUtc);
}

const lapTimeApiAuthClient =
  process.env.LAPTIME_API_BASE_URL && laptimeSqlOptions && process.env.LAPTIME_API_AUTO_AUTH !== 'false'
    ? new LapTimeApiClient(
        {
          baseUrl: process.env.LAPTIME_API_BASE_URL,
          origin: process.env.LAPTIME_API_ORIGIN || 'LapTimeMirror',
          timeoutMs: Number(process.env.LAPTIME_API_TIMEOUT_MS || process.env.LIVETIME_TIMEOUT_MS || '15000'),
        },
        getLapTimeServerNowUtc,
      )
    : null;

const scraper = new LiveTimeScraper({
  uid,
  sourceUrl: process.env.LIVETIME_SOURCE_URL,
  apiBaseUrl: process.env.LAPTIME_API_BASE_URL,
  apiToken: lapTimeApiAuthClient ? undefined : process.env.LAPTIME_API_TOKEN || process.env.LAPTIME_TOKEN,
  apiTokenFile: process.env.LAPTIME_API_TOKEN_FILE,
  apiTokenProvider: lapTimeApiAuthClient ? () => lapTimeApiAuthClient.getToken() : undefined,
  sql: process.env.LIVETIME_USE_SQL === 'true' ? laptimeSqlOptions : undefined,
  headless: process.env.LIVETIME_HEADLESS !== 'false',
  pollMs: Number(process.env.LIVETIME_SCRAPER_POLL_MS || '2000'),
});

const livePitCacheMs = Math.max(1_000, Number(process.env.LIVETIME_PIT_CACHE_MS || '3000'));
type PitRulesInput = Partial<import('@/lib/livetime/laptime-pit-stops').PitRules>;
let livePitCache: { key: string; data: LapTimeRacingPitData | null; expiresAt: number } | null = null;
let livePitRequest: Promise<LapTimeRacingPitData | null> | null = null;
let livePitRequestKey = '';

async function getCurrentPitData(rules?: PitRulesInput): Promise<LapTimeRacingPitData | null> {
  const cacheKey = rules ? JSON.stringify(rules) : 'default';
  const now = Date.now();
  if (livePitCache && livePitCache.key === cacheKey && livePitCache.expiresAt > now) return livePitCache.data;
  if (livePitRequest && livePitRequestKey === cacheKey) return livePitRequest;

  const sqlOptions = resolveLaptimeSqlOptions('racings');
  if (!sqlOptions) {
    livePitCache = { key: cacheKey, data: null, expiresAt: now + livePitCacheMs };
    return null;
  }

  livePitRequestKey = cacheKey;
  livePitRequest = fetchLapTimeCurrentPitData(sqlOptions, rules)
    .catch((error: unknown) => {
      console.error('[livetime] pit stop query failed:', error instanceof Error ? error.message : error);
      return null;
    })
    .then((data) => {
      livePitCache = { key: cacheKey, data, expiresAt: Date.now() + livePitCacheMs };
      return data;
    })
    .finally(() => {
      livePitRequest = null;
      livePitRequestKey = '';
    });

  return livePitRequest;
}

function mergePitData(snapshot: ReturnType<typeof scraper.getSnapshot>, pitData: LapTimeRacingPitData | null) {
  if (!pitData) return snapshot;

  const summariesByKart = new Map(
    pitData.summaries
      .filter((summary) => summary.kart)
      .map((summary) => [summary.kart, summary] as const),
  );
  const driversByKart = new Map(snapshot.drivers.map((driver) => [driver.kart, driver] as const));
  const drivers = snapshot.drivers.map((driver) => ({
    ...driver,
    pitStops: driver.kart ? summariesByKart.get(driver.kart) : undefined,
  }));

  for (const summary of pitData.summaries) {
    if (!summary.kart || driversByKart.has(summary.kart)) continue;
    drivers.push({
      position: summary.position || drivers.length + 1,
      kart: summary.kart,
      name: summary.name,
      time: '',
      pitStops: summary,
    });
  }

  drivers.sort((left, right) => left.position - right.position);
  return { ...snapshot, race: pitData.race, drivers };
}

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

async function handlePlaylist(request: http.IncomingMessage, response: http.ServerResponse) {
  if (request.method === 'GET') {
    const playlist = await readTelaoPlaylistFromStore();
    sendJson(response, 200, {
      playlist,
      store: { ...telaoPlaylistStoreStatus(), localEndpoint: true },
    });
    return;
  }

  if (request.method === 'PUT') {
    try {
      const body = JSON.parse(await readBody(request));
      const playlist = await writeTelaoPlaylist(body?.items ?? body);
      sendJson(response, 200, {
        playlist,
        store: { ...telaoPlaylistStoreStatus(), localEndpoint: true },
      });
    } catch (error) {
      sendJson(response, 400, { error: error instanceof Error ? error.message : 'invalid_playlist' });
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
      if (body?.action === 'provision-html' || body?.action === 'provision-cronometragem') {
        const provisioned = await provisionViplexHtmlProgram(body?.name || 'CRONOMETRAGEM');
        if (body?.activate === false) {
          sendJson(response, 200, { ...provisioned, localEndpoint: true });
          return;
        }

        const started = await startViplexProgram(provisioned.identifier);
        sendJson(response, 200, { ...started, provisioned, localEndpoint: true });
        return;
      }

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

async function handleLaptimeRacingDetail(url: URL, response: http.ServerResponse) {
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
    const detail = await fetchLapTimeRacingDetail(sqlOptions, racingId);
    if (!detail) {
      sendJson(response, 404, { error: 'racing_not_found' });
      return;
    }
    sendJson(response, 200, detail);
  } catch (error) {
    sendJson(response, 502, { error: error instanceof Error ? error.message : 'laptime_sql_query_failed' });
  }
}

async function handleLaptimeRacingLaps(url: URL, response: http.ServerResponse) {
  const sqlOptions = resolveLaptimeSqlOptions('racings');
  if (!sqlOptions) {
    sendJson(response, 503, { error: 'laptime_sql_not_configured' });
    return;
  }

  const racingId = url.searchParams.get('racingId');
  const racingCompetitorId = url.searchParams.get('racingCompetitorId');
  if (!racingId || !racingCompetitorId) {
    sendJson(response, 400, { error: 'racingId_and_racingCompetitorId_required' });
    return;
  }

  try {
    const { rows, total } = await fetchLapTimeRacingLaps(sqlOptions, racingId, racingCompetitorId, {
      limit: url.searchParams.get('limit') ? Number(url.searchParams.get('limit')) : undefined,
      offset: url.searchParams.get('offset') ? Number(url.searchParams.get('offset')) : undefined,
    });
    response.writeHead(200, { ...NO_CACHE_HEADERS, 'x-total-count': String(total) });
    response.end(JSON.stringify(rows));
  } catch (error) {
    sendJson(response, 502, { error: error instanceof Error ? error.message : 'laptime_sql_query_failed' });
  }
}

async function handleLaptimeKartHistory(url: URL, response: http.ServerResponse) {
  const sqlOptions = resolveLaptimeSqlOptions('racings');
  if (!sqlOptions) {
    sendJson(response, 503, { error: 'laptime_sql_not_configured' });
    return;
  }

  const plate = url.searchParams.get('plate');
  const sensor = url.searchParams.get('sensor');
  if (!plate && !sensor) {
    sendJson(response, 400, { error: 'plate_or_sensor_required' });
    return;
  }

  try {
    const rows = await fetchLapTimeKartHistory(sqlOptions, {
      plate,
      sensor,
      limit: url.searchParams.get('limit') ? Number(url.searchParams.get('limit')) : undefined,
    });
    response.writeHead(200, { ...NO_CACHE_HEADERS, 'x-total-count': String(rows.length) });
    response.end(JSON.stringify(rows));
  } catch (error) {
    sendJson(response, 502, { error: error instanceof Error ? error.message : 'laptime_sql_query_failed' });
  }
}

async function handleLaptimeKartHistorySummary(response: http.ServerResponse) {
  const sqlOptions = resolveLaptimeSqlOptions('racings');
  if (!sqlOptions) {
    sendJson(response, 503, { error: 'laptime_sql_not_configured' });
    return;
  }

  try {
    const rows = await fetchLapTimeKartHistorySummary(sqlOptions);
    response.writeHead(200, { ...NO_CACHE_HEADERS, 'x-total-count': String(rows.length) });
    response.end(JSON.stringify({ generatedAt: new Date().toISOString(), rows }));
  } catch (error) {
    sendJson(response, 502, { error: error instanceof Error ? error.message : 'laptime_sql_query_failed' });
  }
}

async function handleLaptimeKartFleet(response: http.ServerResponse) {
  const sqlOptions = resolveLaptimeSqlOptions('racings');
  if (!sqlOptions) {
    sendJson(response, 503, { error: 'laptime_sql_not_configured' });
    return;
  }

  try {
    const rows = await fetchLapTimeKartFleet(sqlOptions);
    response.writeHead(200, { ...NO_CACHE_HEADERS, 'x-total-count': String(rows.length) });
    response.end(JSON.stringify(rows));
  } catch (error) {
    sendJson(response, 502, { error: error instanceof Error ? error.message : 'laptime_sql_query_failed' });
  }
}

async function handleLaptimeEqualizacaoLive(response: http.ServerResponse) {
  const sqlOptions = resolveLaptimeSqlOptions('racings');
  if (!sqlOptions) {
    sendJson(response, 503, { error: 'laptime_sql_not_configured' });
    return;
  }

  try {
    sendJson(response, 200, await fetchEqualizacaoLiveSnapshot(sqlOptions));
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

  if (url.pathname === '/api/telao-playlist-local' || url.pathname === '/api/telao-playlist') {
    void handlePlaylist(request, response);
    return;
  }

  if (url.pathname === '/api/viplex-programs-local' || url.pathname === '/api/viplex-programs') {
    void handleViplexPrograms(request, response);
    return;
  }

  if (url.pathname === '/api/livetime-snapshot') {
    // Regras de pit stop podem ser sobrepostas via query (?rules=<JSON>) — vêm do
    // formato configurado no admin (formatos_corrida). Sem query, usa o padrão.
    let customRules: PitRulesInput | null = null;
    const rulesParam = url.searchParams.get('rules');
    if (rulesParam) {
      try {
        const parsed: unknown = JSON.parse(rulesParam);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          customRules = parsed as Partial<import('@/lib/livetime/laptime-pit-stops').PitRules>;
        }
      } catch {
        // parâmetro inválido: segue com regras padrão
      }
    }

    void getCurrentPitData(customRules ?? undefined).then((pitData) => {
      sendJson(response, 200, mergePitData(scraper.getSnapshot(), pitData));
    });
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

  if (url.pathname === '/api/laptime-racing-detail') {
    void handleLaptimeRacingDetail(url, response);
    return;
  }

  if (url.pathname === '/api/laptime-racing-laps') {
    void handleLaptimeRacingLaps(url, response);
    return;
  }

  if (url.pathname === '/api/laptime-kart-history') {
    void handleLaptimeKartHistory(url, response);
    return;
  }

  if (url.pathname === '/api/laptime-kart-history-summary') {
    void handleLaptimeKartHistorySummary(response);
    return;
  }

  if (url.pathname === '/api/laptime-kart-fleet') {
    void handleLaptimeKartFleet(response);
    return;
  }

  if (url.pathname === '/api/laptime-equalizacao-live') {
    void handleLaptimeEqualizacaoLive(response);
    return;
  }

  sendJson(response, 404, { error: 'not_found' });
});

async function main() {
  server.listen(port, () => {
    console.log(`LiveTime scraper listening on http://localhost:${port}/api/livetime-snapshot`);
  });
  try {
    await scraper.start();
  } catch (error) {
    // SQL-backed admin endpoints must remain available even when the optional
    // live snapshot authenticator is temporarily unavailable.
    console.error('LiveTime scraper start failed:', error instanceof Error ? error.message : error);
  }
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
