/**
 * Servico de cronometragem proprio (substitui o LapTime.Server).
 *
 * Roda no PC de cronometragem (ORBITS 192.168.20.249), le o decoder TranX direto pela rede
 * (somente leitura) e serve:
 *   /            painel do operador (montar bateria, iniciar, quadriculada, resultado)
 *   /tv          tela de TV/telao em tempo real
 *   /resultado/:id  resultado imprimivel
 *   /api/...     API JSON + /api/events (SSE)
 *   /api/livetime-snapshot  mesmo formato que o site/telao/TB50 ja consomem
 *
 * Funciona sem internet. Todo estado fica em disco (data/timing), entao reiniciar o servico
 * no meio de uma bateria nao perde volta: cada passagem vai pro diario .jsonl antes de tudo.
 */
import http from 'node:http';
import net from 'node:net';
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { DecoderClient } from '../lib/timing/decoder-client';
import { formatTrxPassing, type TrxPassing } from '../lib/timing/trx-parser';
import {
  applyPassing,
  cancelSession,
  checkered,
  closeSession,
  computeStandings,
  createSession,
  formatLap,
  remainingMs,
  setCompetitors,
  startSession,
  tick,
  toggleLapInvalid,
  type Session,
  type SessionType,
} from '../lib/timing/race-engine';

// ---------------------------------------------------------------- config

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

const PORT = Number(process.env.TIMING_PORT || 4050);
const SIMULATE = process.env.TIMING_SIMULATE === '1';
const SIM_PORT = Number(process.env.TIMING_SIM_PORT || 5199);
const DECODER_HOST = SIMULATE ? '127.0.0.1' : process.env.TIMING_DECODER_HOST || '192.168.20.171';
const DECODER_PORT = SIMULATE ? SIM_PORT : Number(process.env.TIMING_DECODER_PORT || 5100);
const DATA_DIR = resolve(process.env.TIMING_DATA_DIR || join(process.cwd(), 'data', 'timing'));
const SESSIONS_DIR = join(DATA_DIR, 'sessions');
const JOURNAL_DIR = join(DATA_DIR, 'passagens');
const TRANSPONDERS_FILE = join(DATA_DIR, 'transponders.json');
const UI_DIR = resolve(process.cwd(), 'services', 'timing-ui');
const TRACK_NAME = process.env.TIMING_TRACK_NAME || 'Kartodromo Internacional de Betim';

for (const dir of [DATA_DIR, SESSIONS_DIR, JOURNAL_DIR]) mkdirSync(dir, { recursive: true });

function log(...args: unknown[]) {
  console.log(`[${new Date().toISOString()}]`, ...args);
}

// ---------------------------------------------------------------- persistencia

function writeJsonAtomic(file: string, data: unknown) {
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, JSON.stringify(data, null, 1));
  renameSync(tmp, file);
}

const sessions = new Map<string, Session>();
for (const f of readdirSync(SESSIONS_DIR).filter((f) => f.endsWith('.json'))) {
  try {
    const s = JSON.parse(readFileSync(join(SESSIONS_DIR, f), 'utf8')) as Session;
    sessions.set(s.id, s);
  } catch (err) {
    log('sessao ilegivel ignorada', f, err);
  }
}

function saveSession(s: Session) {
  writeJsonAtomic(join(SESSIONS_DIR, `${s.id}.json`), s);
}

let transponderMap: Record<string, string> = {};
function loadTransponders() {
  if (!existsSync(TRANSPONDERS_FILE)) return;
  transponderMap = (JSON.parse(readFileSync(TRANSPONDERS_FILE, 'utf8')) as { map: Record<string, string> }).map ?? {};
}
loadTransponders();

function saveTransponders() {
  writeJsonAtomic(TRANSPONDERS_FILE, { updatedAt: new Date().toISOString(), map: transponderMap });
}

/** ID bruto do transponder -> numero do kart. Numeros pequenos sem mapa ja sao o kart. */
function kartFor(raw: number): string | null {
  const mapped = transponderMap[String(raw)];
  if (mapped) return mapped;
  if (raw > 0 && raw < 1000) return String(raw);
  return null;
}

function journal(entry: Record<string, unknown>) {
  const day = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
  appendFileSync(join(JOURNAL_DIR, `${day}.jsonl`), JSON.stringify(entry) + '\n');
}

// ---------------------------------------------------------------- estado vivo

const OPEN_STATES = new Set(['em_andamento', 'bandeira_final']);

function runningSession(): Session | null {
  for (const s of sessions.values()) if (OPEN_STATES.has(s.state)) return s;
  return null;
}

function sortedSessions() {
  return [...sessions.values()].sort((a, b) => b.createdAt - a.createdAt);
}

type RecentPassing = {
  wallMs: number;
  transponder: number;
  kart: string | null;
  result: string;
  lapMs: number | null;
  sessionId: string | null;
};
const recentPassings: RecentPassing[] = [];
const seenPassings = new Set<string>();
const seenOrder: string[] = [];

function remember(key: string) {
  seenPassings.add(key);
  seenOrder.push(key);
  if (seenOrder.length > 5000) seenPassings.delete(seenOrder.shift()!);
}

const decoder = new DecoderClient(DECODER_HOST, DECODER_PORT);

decoder.on('passing', (p: TrxPassing) => {
  const key = `${p.decoderId}:${p.sequence}:${p.transponder}:${p.decoderTimeMs}`;
  if (seenPassings.has(key)) return; // reenvio do decoder apos reconexao
  remember(key);

  const wallMs = Date.now();
  const kart = kartFor(p.transponder);
  const session = runningSession();
  let result = kart ? 'sem-bateria' : 'transponder-desconhecido';
  let lapMs: number | null = null;

  if (session && kart) {
    result = applyPassing(session, { kart, decoderTimeMs: p.decoderTimeMs, wallMs });
    if (result === 'counted') {
      const comp = session.competitors.find((c) => c.kart === kart);
      lapMs = comp?.crossings[comp.crossings.length - 1]?.lapMs ?? null;
    }
    saveSession(session);
  }

  // diario primeiro: e a fonte de verdade pra reconstruir qualquer bateria
  journal({ wallMs, raw: p.raw, transponder: p.transponder, kart, decoderTimeMs: p.decoderTimeMs, seq: p.sequence, sessionId: session?.id ?? null, result });

  recentPassings.unshift({ wallMs, transponder: p.transponder, kart, result, lapMs, sessionId: session?.id ?? null });
  recentPassings.length = Math.min(recentPassings.length, 60);
  broadcast('passing', recentPassings[0]);
  scheduleStateBroadcast();
});

decoder.on('change', () => {
  log(decoder.status.connected ? 'decoder conectado' : 'decoder desconectado', `${DECODER_HOST}:${DECODER_PORT}`);
  scheduleStateBroadcast();
});

// relogio: quadriculada por tempo e auto-encerramento
setInterval(() => {
  const s = runningSession();
  if (s && tick(s, Date.now())) {
    log(`bateria ${s.name} -> ${s.state}`);
    saveSession(s);
    scheduleStateBroadcast();
  }
}, 250);

// ---------------------------------------------------------------- views

function sessionView(s: Session) {
  const now = Date.now();
  return {
    id: s.id,
    name: s.name,
    type: s.type,
    state: s.state,
    durationMs: s.durationMs,
    maxLaps: s.maxLaps,
    minLapMs: s.minLapMs,
    createdAt: s.createdAt,
    startedAt: s.startedAt,
    checkeredAt: s.checkeredAt,
    finishedAt: s.finishedAt,
    remainingMs: remainingMs(s, now),
    elapsedMs: s.startedAt ? (s.finishedAt ?? now) - s.startedAt : 0,
    competitors: s.competitors.map((c) => ({ kart: c.kart, name: c.name, customerId: c.customerId ?? null, autoAdded: Boolean(c.autoAdded) })),
    standings: computeStandings(s),
  };
}

function sessionSummary(s: Session) {
  return {
    id: s.id,
    name: s.name,
    type: s.type,
    state: s.state,
    createdAt: s.createdAt,
    startedAt: s.startedAt,
    finishedAt: s.finishedAt,
    competitors: s.competitors.length,
  };
}

function decoderView() {
  const st = decoder.status;
  return { ...st, simulated: SIMULATE, healthy: st.connected && !!st.lastDataAt && Date.now() - st.lastDataAt < 15_000 };
}

function stateView() {
  const running = runningSession();
  const list = sortedSessions();
  // a bateria em foco: a que esta correndo, senao a proxima preparada, senao a ultima encerrada
  const focus =
    running ??
    list.filter((s) => s.state === 'preparando').sort((a, b) => a.createdAt - b.createdAt)[0] ??
    list.find((s) => s.state === 'encerrada') ??
    null;
  return {
    now: Date.now(),
    track: TRACK_NAME,
    decoder: decoderView(),
    runningId: running?.id ?? null,
    focus: focus ? sessionView(focus) : null,
    sessions: list.slice(0, 40).map(sessionSummary),
    recentPassings,
  };
}

/** Formato LiveTimingSnapshot (lib/livetime/types.ts) consumido pelo site, telao e TB50. */
function liveSnapshot() {
  const list = sortedSessions();
  const s = runningSession() ?? list.find((x) => x.state === 'encerrada') ?? null;
  const updatedAt = new Date().toISOString();
  if (!s) return { status: 'empty', source: 'sql', updatedAt, trackName: TRACK_NAME, drivers: [] };
  const standings = computeStandings(s);
  return {
    status: OPEN_STATES.has(s.state) ? 'live' : 'finished',
    source: 'sql',
    updatedAt,
    sessionType: s.type === 'corrida' ? 'race' : 'qualifying',
    eventName: s.name,
    trackName: TRACK_NAME,
    race: {
      id: s.id,
      name: s.name,
      type: s.type,
      state: s.state === 'em_andamento' ? 3 : s.state === 'bandeira_final' ? 4 : 5,
      startedAt: s.startedAt ? new Date(s.startedAt).toISOString() : null,
      rules: { requiredStops: 0, minimumStopMs: 0, additionalStopsAllowed: 0, candidateStopMinMs: 0, penaltyLapsPerStop: 0, boxOpenAfterMs: 0, boxCloseAfterMs: 0 },
    },
    drivers: standings
      .filter((r) => r.laps > 0 || !OPEN_STATES.has(s.state))
      .map((r) => ({ position: r.position, kart: r.kart, name: r.name, time: formatLap(r.bestLapMs) })),
  };
}

// ---------------------------------------------------------------- SSE

const clients = new Set<http.ServerResponse>();
let stateTimer: NodeJS.Timeout | null = null;

function broadcast(event: string, data: unknown) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of clients) res.write(payload);
}

function scheduleStateBroadcast() {
  if (stateTimer) return;
  stateTimer = setTimeout(() => {
    stateTimer = null;
    broadcast('state', stateView());
  }, 150);
}

// cronometro na tela anda mesmo sem passagem
setInterval(() => {
  if (clients.size && runningSession()) scheduleStateBroadcast();
}, 1_000);
setInterval(() => {
  for (const res of clients) res.write(': ping\n\n');
}, 15_000);

// ---------------------------------------------------------------- HTTP

function send(res: http.ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}) {
  const isString = typeof body === 'string';
  res.writeHead(status, {
    'content-type': isString ? 'text/plain; charset=utf-8' : 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
    'cache-control': 'no-store',
    ...headers,
  });
  res.end(isString ? body : JSON.stringify(body));
}

function sendFile(res: http.ServerResponse, name: string) {
  const file = join(UI_DIR, name);
  if (!existsSync(file)) return send(res, 404, 'nao encontrado');
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
  res.end(readFileSync(file));
}

async function readBody(req: http.IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function parseCompetitors(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((c) => ({
      kart: String((c as Record<string, unknown>).kart ?? '').trim(),
      name: String((c as Record<string, unknown>).name ?? '').trim(),
      customerId: ((c as Record<string, unknown>).customerId as string | undefined) ?? null,
    }))
    .filter((c) => c.kart || c.name);
}

// ---------------------------------------------------------------- agenda (servidor da operacao no SRVKART)

const OPS_URL = process.env.OPS_URL || 'http://192.168.20.13:4060';

async function opsGet(path: string) {
  const r = await fetch(OPS_URL + path, { headers: { 'x-ops-key': process.env.OPS_RECEPCAO_KEY || '' }, signal: AbortSignal.timeout(6000) });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((data as { error?: string }).error || `Servidor da operacao respondeu ${r.status}`);
  return data;
}

const SESSION_TYPES = new Set<SessionType>(['treino', 'classificacao', 'corrida']);

async function handleApi(req: http.IncomingMessage, res: http.ServerResponse, url: URL) {
  const path = url.pathname;
  const method = req.method ?? 'GET';

  if (path === '/api/state') return send(res, 200, stateView());
  if (path === '/api/livetime-snapshot') return send(res, 200, liveSnapshot());

  if (path === '/api/events') {
    res.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-store',
      connection: 'keep-alive',
      'access-control-allow-origin': '*',
    });
    res.write(`event: state\ndata: ${JSON.stringify(stateView())}\n\n`);
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }

  if (path === '/api/sessions' && method === 'GET') return send(res, 200, sortedSessions().map(sessionSummary));

  if (path === '/api/sessions' && method === 'POST') {
    const body = await readBody(req);
    const type = String(body.type ?? 'treino') as SessionType;
    if (!SESSION_TYPES.has(type)) return send(res, 400, { error: 'Tipo invalido.' });
    const s = createSession({
      id: `${new Date().toISOString().slice(0, 10)}-${randomUUID().slice(0, 8)}`,
      name: String(body.name ?? ''),
      type,
      durationMin: Number(body.durationMin ?? (type === 'corrida' ? 20 : type === 'classificacao' ? 5 : 10)),
      maxLaps: body.maxLaps ? Number(body.maxLaps) : null,
      minLapSec: body.minLapSec ? Number(body.minLapSec) : 5,
      now: Date.now(),
      competitors: parseCompetitors(body.competitors),
    });
    sessions.set(s.id, s);
    saveSession(s);
    log(`bateria criada ${s.name} (${s.type}) com ${s.competitors.length} pilotos`);
    scheduleStateBroadcast();
    return send(res, 201, sessionView(s));
  }

  const m = path.match(/^\/api\/sessions\/([\w-]+)(?:\/(\w+))?(?:\/(\w+))?$/);
  if (m) {
    const s = sessions.get(m[1]);
    if (!s) return send(res, 404, { error: 'Bateria nao encontrada.' });
    const action = m[2];
    const now = Date.now();
    try {
      if (!action && method === 'GET') return send(res, 200, sessionView(s));
      if (action === 'laps' && !m[3] && method === 'GET') {
        return send(
          res,
          200,
          s.competitors.map((c) => ({
            kart: c.kart,
            name: c.name,
            laps: c.crossings.map((x, i) => ({ lap: i, lapMs: x.lapMs, invalid: Boolean(x.invalid), wallMs: x.wallMs })).filter((x) => x.lapMs !== null),
          })),
        );
      }
      if (!action && method === 'PATCH') {
        const body = await readBody(req);
        if (typeof body.name === 'string') s.name = body.name.trim() || s.name;
        if (s.state === 'preparando') {
          if (body.type && SESSION_TYPES.has(body.type as SessionType)) s.type = body.type as SessionType;
          if (body.durationMin !== undefined) s.durationMs = Math.round(Number(body.durationMin) * 60_000);
          if (body.maxLaps !== undefined) s.maxLaps = Number(body.maxLaps) > 0 ? Number(body.maxLaps) : null;
        } else if (s.state === 'em_andamento' && body.durationMin !== undefined) {
          s.durationMs = Math.round(Number(body.durationMin) * 60_000); // estender/encurtar prova em andamento
        }
        if (body.competitors) setCompetitors(s, parseCompetitors(body.competitors));
      } else if (action === 'start' && method === 'POST') {
        const other = runningSession();
        if (other && other.id !== s.id) return send(res, 409, { error: `Ja existe bateria em andamento: ${other.name}. Encerre ela antes.` });
        startSession(s, now);
        log(`bateria ${s.name} INICIADA`);
      } else if (action === 'checkered' && method === 'POST') {
        checkered(s, now);
      } else if (action === 'close' && method === 'POST') {
        closeSession(s, now);
      } else if (action === 'cancel' && method === 'POST') {
        cancelSession(s, now);
      } else if (action === 'laps' && m[3] === 'invalidate' && method === 'POST') {
        const body = await readBody(req);
        toggleLapInvalid(s, String(body.kart), Number(body.lap));
      } else {
        return send(res, 404, { error: 'Acao desconhecida.' });
      }
    } catch (err) {
      return send(res, 400, { error: (err as Error).message });
    }
    saveSession(s);
    scheduleStateBroadcast();
    return send(res, 200, sessionView(s));
  }

  if (path === '/api/transponders' && method === 'GET') return send(res, 200, transponderMap);
  if (path === '/api/transponders' && method === 'PUT') {
    const body = await readBody(req);
    const raw = String(body.raw ?? '').trim();
    const kart = String(body.kart ?? '').trim();
    if (!/^\d+$/.test(raw)) return send(res, 400, { error: 'Transponder invalido.' });
    if (kart) {
      for (const [k, v] of Object.entries(transponderMap)) if (v === kart) delete transponderMap[k]; // 1 transponder por kart
      transponderMap[raw] = kart;
    } else delete transponderMap[raw];
    saveTransponders();
    log(`transponder ${raw} -> kart ${kart || '(removido)'}`);
    return send(res, 200, { ok: true });
  }

  if (path === '/api/agenda' && method === 'GET') {
    const data = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
    try {
      return send(res, 200, await opsGet(`/api/baterias?data=${url.searchParams.get('data') || data}`));
    } catch (err) {
      return send(res, 502, { error: `Agenda indisponivel: ${(err as Error).message}` });
    }
  }
  const pg = path.match(/^\/api\/agenda\/(\d+)\/programa$/);
  if (pg && method === 'GET') {
    try {
      return send(res, 200, await opsGet(`/api/crono/baterias/${pg[1]}/programa`));
    } catch {
      return send(res, 200, []); // servidor antigo sem programa: bateria unica
    }
  }
  const ag = path.match(/^\/api\/agenda\/(\d+)\/grid$/);
  if (ag && method === 'GET') {
    try {
      return send(res, 200, await opsGet(`/api/crono/baterias/${ag[1]}/grid`));
    } catch (err) {
      return send(res, 502, { error: `Agenda indisponivel: ${(err as Error).message}` });
    }
  }

  if (path === '/healthz') return send(res, 200, { ok: true, decoder: decoderView(), sessions: sessions.size });

  return send(res, 404, { error: 'Rota desconhecida.' });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET,POST,PUT,PATCH', 'access-control-allow-headers': 'content-type' });
    return res.end();
  }
  if (url.pathname === '/' || url.pathname === '/operador') return sendFile(res, 'operador.html');
  if (url.pathname === '/tv') return sendFile(res, 'tv.html');
  if (url.pathname.startsWith('/resultado/')) return sendFile(res, 'resultado.html');
  if (url.pathname.startsWith('/api/') || url.pathname === '/healthz') {
    handleApi(req, res, url).catch((err) => {
      log('erro na API', err);
      if (!res.headersSent) send(res, 500, { error: 'Erro interno.' });
    });
    return;
  }
  send(res, 404, 'nao encontrado');
});

// ---------------------------------------------------------------- simulador de decoder

/**
 * Decoder falso pra treino do operador e testes (TIMING_SIMULATE=1). Emite status a cada 5s
 * e passagens dos karts em TIMING_SIM_KARTS, com volta em torno de TIMING_SIM_LAP_SEC.
 */
function startSimulator() {
  const karts = (process.env.TIMING_SIM_KARTS || '4,5,8,16,29,33,34,38,47,55,57,68').split(',').map((k) => k.trim());
  const lapSec = Number(process.env.TIMING_SIM_LAP_SEC || 65);
  const reverse = new Map(Object.entries(transponderMap).map(([raw, kart]) => [kart, Number(raw)]));
  const base = Date.now();
  const clock = () => (Date.now() - base) % 86_400_000;
  let seq = 1;
  const sim = net.createServer((sock) => {
    const status = setInterval(() => sock.write(`\u0001#\t20\t0\t26\t0\tx0000\r\n`), 5_000);
    const timers = karts.map((kart, i) => {
      const raw = reverse.get(kart) ?? Number(kart);
      const pace = lapSec * (0.97 + (i % 6) * 0.01);
      const loop = () => {
        sock.write(formatTrxPassing({ sequence: seq++, transponder: raw, decoderTimeMs: clock() }));
        t = setTimeout(loop, pace * 1000 * (0.985 + Math.random() * 0.03));
      };
      let t = setTimeout(loop, 1500 + i * 700);
      return () => clearTimeout(t);
    });
    sock.on('close', () => {
      clearInterval(status);
      timers.forEach((stop) => stop());
    });
    sock.on('error', () => undefined);
  });
  sim.listen(SIM_PORT, '127.0.0.1', () => log(`SIMULADOR de decoder em 127.0.0.1:${SIM_PORT} (karts ${karts.join(',')}, volta ~${lapSec}s)`));
}

// ---------------------------------------------------------------- boot

if (SIMULATE) startSimulator();
decoder.start();
server.listen(PORT, '0.0.0.0', () => {
  log(`Cronometragem em http://0.0.0.0:${PORT}  (decoder ${DECODER_HOST}:${DECODER_PORT}${SIMULATE ? ' SIMULADO' : ''})`);
  log(`dados em ${DATA_DIR}, ${sessions.size} baterias carregadas, ${Object.keys(transponderMap).length} transponders mapeados`);
});
