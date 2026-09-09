import http from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import sql from 'mssql';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  buildStageSnapshot,
  type StageBinding,
  type StageCategory,
  type StageCompetitor,
  type StageDriver,
  type StageRace,
  type StageRule,
  type StageSnapshot,
} from '../lib/udk-bridge/live-stage';
import { ULTRAS_CATEGORY_SLUGS } from '../lib/udk-bridge/ultras-stage-config';

function loadLocalEnv(): void {
  const envPath = resolve(process.cwd(), '.env.local');
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

type StageMetadata = {
  at: number;
  bindingFingerprint: string;
  drivers: StageDriver[];
  categories: StageCategory[];
  rule: StageRule;
  sessions: Array<{ id: string; stage_id: string; name: string | null; kind: string; status: string | null }>;
};

type LapTimeRaceRow = {
  Id_Racing: number;
  Id_RacingGroup: number;
  RacingState: number;
  StartDateTime: Date | null;
  EndTime: Date | string | null;
  FinishLap: number | null;
  LastPassingFlag: number | null;
};

const pollMs = Math.max(3000, Number(process.env.UDK_STAGE_POLL_MS) || 5000);
const bindingPath = resolve(process.cwd(), process.env.UDK_STAGE_CONFIG || 'scripts/ultras-stage.json');
const stagePort = Number(process.env.UDK_STAGE_PORT || '4014');
const stageHost = process.env.UDK_STAGE_HOST || '127.0.0.1';
const checkMode = process.argv.includes('--check');
const onceMode = process.argv.includes('--once');
const strictMode = process.argv.includes('--strict');

let client: SupabaseClient | null = null;
let pool: sql.ConnectionPool | null = null;
let lastSuccess: string | null = null;
let lastError: string | null = null;
let lastSnapshot: StageSnapshot | null = null;
let lastStoredAt: string | null = null;
let busy = false;
let metadata: StageMetadata | null = null;

function configuredClient(): SupabaseClient {
  if (client) return client;
  const url = process.env.UDK_SUPABASE_URL;
  const serviceRoleKey = process.env.UDK_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) throw new Error('UDK_SUPABASE_URL/UDK_SERVICE_ROLE_KEY não configurados');

  client = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) =>
        fetch(input, {
          ...init,
          signal: init?.signal || AbortSignal.timeout(10_000),
        }),
    },
  });
  return client;
}

function configuredPool(): sql.ConnectionPool {
  if (pool) return pool;
  const required = ['LAPTIME_SQL_SERVER', 'LAPTIME_SQL_DATABASE', 'LAPTIME_SQL_USER', 'LAPTIME_SQL_PASSWORD'] as const;
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length) throw new Error(`Variáveis LapTime ausentes: ${missing.join(', ')}`);

  pool = new sql.ConnectionPool({
    server: process.env.LAPTIME_SQL_SERVER!,
    database: process.env.LAPTIME_SQL_DATABASE!,
    user: process.env.LAPTIME_SQL_USER!,
    password: process.env.LAPTIME_SQL_PASSWORD!,
    port: process.env.LAPTIME_SQL_PORT ? Number(process.env.LAPTIME_SQL_PORT) : undefined,
    connectionTimeout: 10_000,
    requestTimeout: 10_000,
    pool: { max: 2, min: 0, idleTimeoutMillis: 30_000 },
    options: {
      instanceName: process.env.LAPTIME_SQL_INSTANCE,
      encrypt: false,
      trustServerCertificate: true,
    },
  });
  pool.on('error', (error) => console.error('[ultras-stage] SQL:', error.message));
  return pool;
}

function readBinding(): StageBinding {
  if (!existsSync(bindingPath)) throw new Error(`Configuração da etapa não encontrada: ${bindingPath}`);
  const binding = JSON.parse(readFileSync(bindingPath, 'utf8')) as StageBinding;
  const categorySlugs = binding.categorySlugs || [...ULTRAS_CATEGORY_SLUGS];
  if (
    !binding.stageId ||
    !binding.seasonId ||
    binding.races.length !== 2 ||
    categorySlugs.length !== 2 ||
    new Set(categorySlugs).size !== 2 ||
    categorySlugs.some((slug) => !ULTRAS_CATEGORY_SLUGS.includes(slug as (typeof ULTRAS_CATEGORY_SLUGS)[number]))
  ) {
    throw new Error('Configuração Ultras inválida: são necessárias duas corridas e as categorias insanos/rapidos');
  }
  return { ...binding, categorySlugs };
}

function parsePositionPoints(value: unknown): Record<string, number> {
  const source = typeof value === 'string' ? JSON.parse(value) : value;
  if (!source || typeof source !== 'object' || Array.isArray(source)) throw new Error('Tabela de pontos UDK inválida');

  const result: Record<string, number> = {};
  for (const [position, points] of Object.entries(source)) {
    if (Number.isFinite(Number(points))) result[position] = Number(points);
  }
  return result;
}

async function loadMetadata(binding: StageBinding): Promise<StageMetadata> {
  const udk = configuredClient();
  const expectedSlugs = binding.categorySlugs || [...ULTRAS_CATEGORY_SLUGS];
  const [stageResult, sessionsResult, categoriesResult, ruleResult] = await Promise.all([
    udk
      .from('stages')
      .select('id,season_id,format,track,status')
      .eq('id', binding.stageId)
      .is('deleted_at', null)
      .single(),
    udk
      .from('sessions')
      .select('id,stage_id,name,kind,status')
      .in('id', binding.races.map((race) => race.sessionId))
      .is('deleted_at', null),
    udk
      .from('categories')
      .select('id,name,slug')
      .eq('season_id', binding.seasonId)
      .eq('status', 'active')
      .is('deleted_at', null)
      .in('slug', expectedSlugs),
    udk
      .from('points_rules')
      .select('position_points,pole_points,fastest_lap_points,version')
      .eq('season_id', binding.seasonId)
      .eq('event_format', 'regular')
      .eq('active', true)
      .is('category_id', null)
      .is('deleted_at', null)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  for (const result of [stageResult, sessionsResult, categoriesResult, ruleResult]) {
    if (result.error) throw new Error(`UDK: ${result.error.message}`);
  }

  if (
    stageResult.data?.season_id !== binding.seasonId ||
    stageResult.data.format !== 'regular' ||
    sessionsResult.data?.length !== 2
  ) {
    throw new Error('Etapa UDK incompatível com a configuração Ultras');
  }

  const categories = (categoriesResult.data || []) as StageCategory[];
  if (
    categories.length !== expectedSlugs.length ||
    expectedSlugs.some((slug) => !categories.some((category) => category.slug === slug))
  ) {
    throw new Error('As categorias Ultras Insanos e Ultras Rápidos não estão ativas no UDK');
  }

  const sessions = (sessionsResult.data || []) as StageMetadata['sessions'];
  for (const expectedRace of binding.races) {
    const session = sessions.find((item) => item.id === expectedRace.sessionId);
    if (!session || session.stage_id !== binding.stageId || session.kind !== 'race' || session.status === 'cancelled') {
      throw new Error(`Sessão UDK incompatível: ${expectedRace.sessionId}`);
    }
  }

  if (!ruleResult.data) throw new Error('Regra de pontos regular não encontrada no UDK');
  const rule: StageRule = {
    position_points: parsePositionPoints(ruleResult.data.position_points),
    pole_points: Number(ruleResult.data.pole_points || 0),
    fastest_lap_points: Number(ruleResult.data.fastest_lap_points || 0),
  };
  if (rule.position_points['1'] !== 50) throw new Error('Regra UDK inválida: o vencedor precisa valer 50 pontos');

  const categoryIds = categories.map((category) => category.id);
  const driversResult = await udk
    .from('drivers')
    .select('id,full_name,sport_name,category_id')
    .eq('season_id', binding.seasonId)
    .is('deleted_at', null)
    .in('category_id', categoryIds);
  if (driversResult.error) throw new Error(`UDK: ${driversResult.error.message}`);

  return {
    at: Date.now(),
    bindingFingerprint: JSON.stringify(binding),
    drivers: (driversResult.data || []) as StageDriver[],
    categories,
    rule,
    sessions,
  };
}

async function readLapTimeRaces(binding: StageBinding): Promise<StageRace[]> {
  const lapTime = configuredPool();
  await lapTime.connect();
  const races: StageRace[] = [];

  for (const expected of binding.races) {
    const raceResult = await lapTime
      .request()
      .input('id', sql.BigInt, expected.racingId)
      .query<LapTimeRaceRow>(`
        select
          r.Id_Racing,
          r.Id_RacingGroup,
          r.RacingState,
          r.StartDateTime,
          r.EndTime,
          r.FinishLap,
          lastPassing.Id_RacingFlag as LastPassingFlag
        from dbo.Racing r with (nolock)
        outer apply (
          select top 1 p.Id_RacingFlag
          from dbo.Passing p with (nolock)
          where p.Id_Racing = r.Id_Racing
          order by p.Id_Passing desc
        ) lastPassing
        where r.Id_Racing = @id
      `);
    const row = raceResult.recordset[0];
    if (!row) throw new Error(`Corrida ${expected.racingId} ausente no LapTime`);

    const entries = await lapTime
      .request()
      .input('id', sql.BigInt, expected.racingId)
      .query<StageCompetitor>(`
        select
          Id_RacingCompetitor,
          Competitor,
          Number,
          Pos,
          Lap,
          BestLapTime,
          TotalTime,
          PenaltyTotalTime,
          PenaltyLap,
          StopAndGo,
          StartPos,
          RacingStatus,
          IsHidden
        from dbo.RacingCompetitor with (nolock)
        where Id_Racing = @id
        order by coalesce(Pos, 9999), Id_RacingCompetitor
      `);

    races.push({
      racingId: Number(row.Id_Racing),
      groupId: Number(row.Id_RacingGroup),
      state: Number(row.RacingState),
      startedAt: row.StartDateTime,
      endTime: row.EndTime,
      finishLap: row.FinishLap,
      lastPassingFlag: row.LastPassingFlag,
      competitors: entries.recordset,
    });
  }

  return races;
}

function snapshotStatus(snapshot: StageSnapshot): Record<string, unknown> {
  return {
    complete: snapshot.complete,
    provisional: snapshot.provisional,
    unresolved: snapshot.unresolved,
    heats: snapshot.heats.map((heat) => ({
      id: heat.racingId,
      sessionId: heat.sessionId,
      label: heat.label,
      state: heat.state,
      entries: heat.entries.length,
    })),
    categories: snapshot.categories.map((category) => ({
      slug: category.slug,
      name: category.name,
      pilots: category.rows.length,
    })),
  };
}

async function tick(): Promise<StageSnapshot | null> {
  if (busy) return lastSnapshot;
  busy = true;

  try {
    const binding = readBinding();
    const fingerprint = JSON.stringify(binding);
    if (!metadata || Date.now() - metadata.at > 60_000 || metadata.bindingFingerprint !== fingerprint) {
      metadata = await loadMetadata(binding);
    }

    const races = await readLapTimeRaces(binding);
    const snapshot = buildStageSnapshot(binding, races, metadata.drivers, metadata.categories, metadata.rule);
    const capturedAt = new Date().toISOString();

    if (!checkMode) {
      const result = await configuredClient().from('live_stage_snapshots').upsert(
        {
          stage_id: binding.stageId,
          captured_at: capturedAt,
          payload: snapshot,
        },
        { onConflict: 'stage_id' },
      );
      if (result.error) throw new Error(`UDK snapshot: ${result.error.message}`);
      lastStoredAt = capturedAt;
    }

    lastSnapshot = snapshot;
    lastSuccess = capturedAt;
    lastError = null;
    if (checkMode) {
      console.log(
        JSON.stringify(
          {
            ok: true,
            capturedAt,
            stageId: binding.stageId,
            source: 'LapTime SQL',
            persistence: 'UDK live_stage_snapshots (skipped in --check)',
            ...snapshotStatus(snapshot),
          },
          null,
          2,
        ),
      );
    }
    return snapshot;
  } catch (error) {
    lastError = error instanceof Error ? error.message : String(error);
    if (checkMode) {
      console.log(JSON.stringify({ ok: false, error: lastError }, null, 2));
    } else {
      console.error('[ultras-stage]', lastError);
    }
    return null;
  } finally {
    busy = false;
  }
}

function statusBody(): Record<string, unknown> {
  let binding: StageBinding | null = null;
  try {
    binding = readBinding();
  } catch {
    // The last error below contains the actionable config failure after a poll.
  }

  const fresh = lastSuccess !== null && Date.now() - Date.parse(lastSuccess) < Math.max(30_000, pollMs * 3);
  return {
    service: 'ultras-stage',
    status: fresh && !lastError ? 'healthy' : 'degraded',
    source: 'LapTime SQL',
    destination: 'UDK Supabase API',
    stageId: binding?.stageId || null,
    seasonId: binding?.seasonId || null,
    races: binding?.races || [],
    categories: binding?.categorySlugs || [...ULTRAS_CATEGORY_SLUGS],
    pollMs,
    lastSuccess,
    lastStoredAt,
    lastError,
    snapshot: lastSnapshot ? snapshotStatus(lastSnapshot) : null,
  };
}

async function closeResources(): Promise<void> {
  await pool?.close().catch(() => undefined);
  pool = null;
}

async function main(): Promise<void> {
  if (checkMode || onceMode) {
    const snapshot = await tick();
    if (!snapshot || (strictMode && snapshot.unresolved.length > 0)) process.exitCode = strictMode && snapshot?.unresolved.length ? 2 : 1;
    await closeResources();
    return;
  }

  const server = http.createServer((request, response) => {
    const url = new URL(request.url || '/', `http://${stageHost}:${stagePort}`);
    if (request.method !== 'GET' || (url.pathname !== '/healthz' && url.pathname !== '/api/ultras-stage/status')) {
      response.writeHead(404, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      response.end(JSON.stringify({ error: 'not_found' }));
      return;
    }

    const body = statusBody();
    response.writeHead(body.status === 'healthy' ? 200 : 503, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
    });
    response.end(JSON.stringify(body));
  });

  await new Promise<void>((resolveServer, rejectServer) => {
    server.once('error', rejectServer);
    server.listen(stagePort, stageHost, () => resolveServer());
  });
  console.log(`[ultras-stage] iniciado em http://${stageHost}:${stagePort}/healthz`);

  let timer: NodeJS.Timeout | null = null;
  const loop = async (): Promise<void> => {
    await tick();
    timer = setTimeout(() => void loop(), pollMs);
  };
  await loop();

  const shutdown = (): void => {
    if (timer) clearTimeout(timer);
    server.close(() => void closeResources().finally(() => process.exit(0)));
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

void main().catch(async (error) => {
  console.error('[ultras-stage]', error instanceof Error ? error.message : String(error));
  await closeResources();
  process.exitCode = 1;
});
