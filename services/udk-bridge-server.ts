// UDK Bridge Server: sincroniza corridas ULTRAS finalizadas do LapTime para o
// UDK (Supabase) em modo DRAFT. Loop contínuo com intervalo configurável.
//
// Uso: npm run bridge  (tsx services/udk-bridge-server.ts)
// Variáveis: UDK_SUPABASE_URL, UDK_SERVICE_ROLE_KEY, LAPTIME_SQL_*,
//            UDK_BRIDGE_POLL_MS, UDK_ALLOW_TEXT_ONLY, UDK_STAGES, ...
//
// Endpoints HTTP (porta UDK_BRIDGE_PORT, default 4011):
//   GET  /api/bridge/status  → resumo do último ciclo e da config
//   POST /api/bridge/once    → dispara um ciclo imediatamente (fora do loop)
import http from 'node:http';
import { loadBridgeConfig } from '@/lib/udk-bridge/config';
import { createUdkClient } from '@/lib/udk-bridge/client';
import { syncFinishedUltrasToUdk } from '@/lib/udk-bridge/sync';
import { ultrasFilterSummary } from '@/lib/livetime/ultras-filter';
import type { UdkBridgeSyncResult } from '@/lib/udk-bridge/sync';

const config = loadBridgeConfig();

if (!config.udkSupabaseUrl || !config.udkServiceRoleKey) {
  console.error('[udk-bridge] FALTAM UDK_SUPABASE_URL e/ou UDK_SERVICE_ROLE_KEY — abortando');
  process.exit(1);
}
if (!config.sqlSource.password) {
  console.error('[udk-bridge] FALTA LAPTIME_SQL_PASSWORD — abortando');
  process.exit(1);
}

const udk = createUdkClient({ url: config.udkSupabaseUrl, serviceRoleKey: config.udkServiceRoleKey });
const startedAt = new Date();

let running = false;
let lastCycle: { at: string; result: UdkBridgeSyncResult } | null = null;

const tick = async (): Promise<UdkBridgeSyncResult> => {
  if (running) {
    throw new Error('ciclo já em andamento');
  }
  running = true;
  try {
    const result = await syncFinishedUltrasToUdk({
      sqlSource: config.sqlSource,
      config: {
        championshipId: config.championshipId,
        seasonId: config.seasonId,
        categoryMapping: config.categoryMapping,
        stages: config.stages,
      },
      udk,
      filter: { allowTextOnly: config.allowTextOnly },
    });
    lastCycle = { at: new Date().toISOString(), result };
    console.log(
      `[udk-bridge] ciclo: escaneadas=${result.scanned} importadas=${result.imported} puladas=${result.skipped} falhas=${result.failures.length}`,
    );
    return result;
  } finally {
    running = false;
  }
};

function statusBody(): Record<string, unknown> {
  return {
    service: 'udk-bridge',
    status: running ? 'syncing' : 'idle',
    startedAt: startedAt.toISOString(),
    lastCycle,
    filter: ultrasFilterSummary({ allowTextOnly: config.allowTextOnly }),
    championshipId: config.championshipId,
    seasonId: config.seasonId,
    stages: Object.keys(config.stages),
    pollIntervalMs: config.pollIntervalMs,
    sqlSource: `${config.sqlSource.server}\\${config.sqlSource.instanceName || ''} ${config.sqlSource.database}`,
    allowTextOnly: config.allowTextOnly,
    // Sempre DRAFT: garantia da missão (nunca publica automaticamente).
    writeMode: 'draft-only',
  };
}

const port = Number(process.env.UDK_BRIDGE_PORT || '4011');

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', `http://localhost:${port}`);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method === 'GET' && url.pathname === '/api/bridge/status') {
    res.end(JSON.stringify(statusBody(), null, 2));
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/bridge/once') {
    void tick()
      .then((result) => {
        res.statusCode = 200;
        res.end(JSON.stringify({ ok: true, result }, null, 2));
      })
      .catch((error) => {
        res.statusCode = 409;
        res.end(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }, null, 2));
      });
    return;
  }

  res.statusCode = 404;
  res.end(JSON.stringify({ ok: false, error: 'not_found' }));
});

server.listen(port, () => {
  console.log('[udk-bridge] iniciado');
  console.log(`[udk-bridge] campeonato=${config.championshipId} temporada=${config.seasonId}`);
  console.log(`[udk-bridge] etapas configuradas=${Object.keys(config.stages).length}`);
  console.log(`[udk-bridge] SQL=${config.sqlSource.server}\\${config.sqlSource.instanceName || ''} db=${config.sqlSource.database}`);
  console.log(`[udk-bridge] texto sem whitelist permitido=${config.allowTextOnly ? 'SIM' : 'não (conservador)'}`);
  console.log(`[udk-bridge] HTTP status em http://localhost:${port}/api/bridge/status`);
});

void tick();
setInterval(() => void tick().catch((error) => console.error('[udk-bridge] erro no ciclo:', error.message)), config.pollIntervalMs);

const shutdown = (): void => {
  console.log('[udk-bridge] encerrando');
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);