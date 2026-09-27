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
import { appendFileSync, copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { DecoderClient, type DecoderProtocol } from '../lib/timing/decoder-client';
import { formatTrxPassing, type TrxPassing } from '../lib/timing/trx-parser';
import {
  acceptRejected,
  applyPassing,
  assignCrossing,
  cancelSession,
  clearCrossings,
  closeSession,
  timeIsUp,
  computeStandings,
  createSession,
  aguardandoLargada,
  copiarCompetidores,
  mesmoPrograma,
  elapsedMs,
  formatLap,
  includeManualPassing,
  remainingMs,
  setCompetitors,
  setCrossingDeleted,
  setCrossingInvalid,
  setRaceFlag,
  startSession,
  tick,
  toggleLapInvalid,
  updateSessionParameters,
  type Session,
  type SessionType,
} from '../lib/timing/race-engine';
import {
  createCatalogRecord,
  deleteCatalogRecord,
  distributeProof,
  duplicateEvent,
  emptyCatalog,
  normalizeCatalog,
  updateCatalogRecord,
  type CatalogEntity,
  type TimingCatalog,
} from '../lib/timing/catalog';

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
const ENV_DECODER_HOST = process.env.TIMING_DECODER_HOST || '192.168.20.171';
// P3 (porta 5403) é a mesma saída que o Orbits 4 usa: relógio absoluto do decoder, voltas idênticas às do Orbits.
// TRX (porta 5100) é a saída texto que o LapTime usava; o simulador fala TRX.
const ENV_DECODER_PROTOCOL: DecoderProtocol = process.env.TIMING_DECODER_PROTOCOL === 'trx' ? 'trx' : 'p3';
const ENV_DECODER_PORT = Number(process.env.TIMING_DECODER_PORT || (ENV_DECODER_PROTOCOL === 'p3' ? 5403 : 5100));
const DATA_DIR = resolve(process.env.TIMING_DATA_DIR || join(process.cwd(), 'data', 'timing'));
const SESSIONS_DIR = join(DATA_DIR, 'sessions');
const JOURNAL_DIR = join(DATA_DIR, 'passagens');
const TRANSPONDERS_FILE = join(DATA_DIR, 'transponders.json');
const CATALOG_FILE = join(DATA_DIR, 'catalog.json');
const SETTINGS_FILE = join(DATA_DIR, 'settings.json');
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
for (const session of sessions.values()) {
  session.currentFlag ??= session.state === 'em_andamento' ? 'green' : session.state === 'bandeira_final' ? 'checkered' : 'none';
  session.observations ??= [];
  session.competitors ??= [];
  for (const competitor of session.competitors) {
    competitor.crossings ??= [];
    competitor.flag ??= 'none';
    competitor.crossings.forEach((crossing) => { crossing.id ??= randomUUID(); crossing.source ??= 'decoder'; });
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

let catalog: TimingCatalog = emptyCatalog();
if (existsSync(CATALOG_FILE)) {
  try { catalog = normalizeCatalog(JSON.parse(readFileSync(CATALOG_FILE, 'utf8'))); }
  catch (err) { log('cadastro de eventos ilegível; iniciando vazio', err); }
}

let timingSettings: Record<string, unknown> = {};
if (existsSync(SETTINGS_FILE)) {
  try { timingSettings = JSON.parse(readFileSync(SETTINGS_FILE, 'utf8')) as Record<string, unknown>; }
  catch (err) { log('parâmetros de cronometragem ilegíveis', err); }
}

type DecoderConfig = { name: string; model: string; protocol: DecoderProtocol; host: string; port: number };
const configuredDecoder = (timingSettings.decoder && typeof timingSettings.decoder === 'object' ? timingSettings.decoder : {}) as Partial<DecoderConfig>;
let activeDecoderConfig: DecoderConfig = {
  name: configuredDecoder.name || 'TranX',
  model: configuredDecoder.model || 'TranX',
  protocol: SIMULATE ? 'trx' : configuredDecoder.protocol === 'trx' ? 'trx' : configuredDecoder.protocol === 'p3' ? 'p3' : ENV_DECODER_PROTOCOL,
  host: SIMULATE ? '127.0.0.1' : configuredDecoder.host || ENV_DECODER_HOST,
  port: SIMULATE ? SIM_PORT : Number(configuredDecoder.port || ENV_DECODER_PORT),
};

function saveCatalog() { writeJsonAtomic(CATALOG_FILE, catalog); }
function saveTimingSettings() { writeJsonAtomic(SETTINGS_FILE, timingSettings); }

function saveTransponders() {
  writeJsonAtomic(TRANSPONDERS_FILE, { updatedAt: new Date().toISOString(), map: transponderMap });
}

function unlinkCompetitorTransponder(competitor: TimingCatalog['competitors'][number] | undefined) {
  if (competitor?.transponder && transponderMap[competitor.transponder] === competitor.kart) delete transponderMap[competitor.transponder];
}

function linkCompetitorTransponder(competitor: TimingCatalog['competitors'][number] | undefined) {
  if (!competitor?.transponder) return;
  for (const [raw, kart] of Object.entries(transponderMap)) if (kart === competitor.kart && raw !== competitor.transponder) delete transponderMap[raw];
  transponderMap[competitor.transponder] = competitor.kart;
}

function syncCatalogTransponders(previous: TimingCatalog, next: TimingCatalog) {
  for (const competitor of previous.competitors) unlinkCompetitorTransponder(competitor);
  for (const competitor of next.competitors) linkCompetitorTransponder(competitor);
  saveTransponders();
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

function trackLengthFor(s: Session) {
  const event = catalog.events.find((item) => item.id === s.eventId);
  const track = catalog.tracks.find((item) => item.id === event?.trackId);
  const system = (timingSettings.system && typeof timingSettings.system === 'object' ? timingSettings.system : {}) as Record<string, unknown>;
  return track?.lengthMeters ?? (Number(system.defaultTrackLengthMeters ?? timingSettings.defaultTrackLengthMeters) || 1_000);
}

type RecentPassing = {
  id: string;
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

let decoder: DecoderClient;

function handleDecoderPassing(p: TrxPassing) {
  const key = `${p.decoderId}:${p.sequence}:${p.transponder}:${p.decoderTimeMs}`;
  if (seenPassings.has(key)) return; // reenvio do decoder apos reconexao
  remember(key);

  const wallMs = Date.now();
  const kart = kartFor(p.transponder);
  const session = runningSession();
  const id = randomUUID();
  let result = kart ? 'sem-bateria' : 'transponder-desconhecido';
  let lapMs: number | null = null;

  if (session && kart) {
    const esperando = aguardandoLargada(session);
    result = applyPassing(session, { id, kart, decoderTimeMs: p.decoderTimeMs, wallMs, transponder: p.transponder, source: 'decoder' });
    if (esperando && !aguardandoLargada(session)) log(`bateria ${session.name}: LARGADA com o kart ${kart} (cronômetro começou)`);
    if (result === 'counted') {
      const comp = session.competitors.find((c) => c.kart === kart);
      lapMs = comp?.crossings[comp.crossings.length - 1]?.lapMs ?? null;
    }
  }
  if (session && result !== 'counted') {
    // toda leitura aparece pro operador, mesmo a que não virou volta
    const vivos = session.competitors.find((c) => c.kart === kart)?.crossings.filter((x) => !x.deleted) ?? [];
    const last = vivos[vivos.length - 1];
    (session.rejected ??= []).push({ id, kart, transponder: p.transponder, wallMs, decoderTimeMs: p.decoderTimeMs, reason: result, sinceLastMs: last ? wallMs - last.wallMs : null });
    if (session.rejected.length > 2000) session.rejected.splice(0, session.rejected.length - 2000);
  }
  if (session) saveSession(session);

  // diario primeiro: e a fonte de verdade pra reconstruir qualquer bateria
  journal({ wallMs, raw: p.raw, transponder: p.transponder, kart, decoderTimeMs: p.decoderTimeMs, seq: p.sequence, sessionId: session?.id ?? null, result });
  log(`passagem transponder ${p.transponder} -> kart ${kart ?? '?'} (${result})`);

  recentPassings.unshift({ id, wallMs, transponder: p.transponder, kart, result, lapMs, sessionId: session?.id ?? null });
  recentPassings.length = Math.min(recentPassings.length, 60);
  broadcast('passing', recentPassings[0]);
  scheduleStateBroadcast();
}

function createDecoderClient(config: DecoderConfig) {
  const client = new DecoderClient(config.host, config.port, 20_000, config.protocol);
  client.on('passing', handleDecoderPassing);
  client.on('init', (cmds: string[]) => log('decoder inicializado', cmds.map((c) => JSON.stringify(c)).join(' ')));
  client.on('other', (raw: string) => {
  // "$ <decoder> <seq> <comando> <resultado>" (6 campos) = confirmação de comando (@RESET / ?;;;11;)
  const campos = raw.split('\u0001').join('').trim().split('\t');
  if (campos[0] === '$' && campos.length === 6) log('decoder confirmou comando', JSON.stringify(raw));
  else if (outrasNaHora++ < 30) log('decoder linha não reconhecida', JSON.stringify(raw));
  });
  client.on('change', () => {
    log(client.status.connected ? 'decoder conectado' : 'decoder desconectado', `${client.status.host}:${client.status.port}`);
    scheduleStateBroadcast();
  });
  return client;
}

// linhas que não são status nem passagem: registra as primeiras de cada hora pra diagnóstico
let outrasNaHora = 0;
setInterval(() => { outrasNaHora = 0; }, 3_600_000).unref();
decoder = createDecoderClient(activeDecoderConfig);

// relógio: avisa quando o tempo programado acaba (a quadriculada e o encerramento são do cronometrista)
setInterval(() => {
  const s = runningSession();
  if (s && tick(s, Date.now())) {
    log(`bateria ${s.name}: TEMPO ESGOTADO, aguardando a quadriculada do cronometrista`);
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
    greenAt: s.greenAt ?? null,
    aguardandoLargada: aguardandoLargada(s),
    checkeredAt: s.checkeredAt,
    finishedAt: s.finishedAt,
    remainingMs: remainingMs(s, now),
    tempoEsgotado: timeIsUp(s, now),
    elapsedMs: elapsedMs(s, now),
    currentFlag: s.currentFlag ?? 'none',
    eventId: s.eventId ?? null,
    groupId: s.groupId ?? null,
    proofId: s.proofId ?? null,
    observations: s.observations ?? [],
    competitors: s.competitors.map((c) => ({ kart: c.kart, name: c.name, customerId: c.customerId ?? null, category: c.category ?? null, flag: c.flag ?? 'none', autoAdded: Boolean(c.autoAdded) })),
    standings: computeStandings(s, trackLengthFor(s)),
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
    eventId: s.eventId ?? null,
    groupId: s.groupId ?? null,
    proofId: s.proofId ?? null,
    currentFlag: s.currentFlag ?? 'none',
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
  const lastQualifying = list.find((s) => s.state === 'encerrada' && s.type !== 'corrida');
  return {
    now: Date.now(),
    track: TRACK_NAME,
    decoder: decoderView(),
    runningId: running?.id ?? null,
    focus: focus ? sessionView(focus) : null,
    lastQualifying: lastQualifying ? sessionView(lastQualifying) : null,
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
  const ext = extname(name).toLowerCase();
  const mime = ext === '.png' ? 'image/png' : ext === '.svg' ? 'image/svg+xml' : ext === '.css' ? 'text/css' : ext === '.js' ? 'application/javascript' : 'text/html; charset=utf-8';
  res.writeHead(200, { 'content-type': mime, 'cache-control': 'no-store' });
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
      category: ((c as Record<string, unknown>).category as string | undefined) ?? null,
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
const CATALOG_ENTITIES = new Set<CatalogEntity>(['events', 'groups', 'provas', 'categories', 'tracks', 'competitors']);

function normalizeDecoderConfig(input: Record<string, unknown>): DecoderConfig {
  const host = String(input.host ?? '').trim();
  const port = Number(input.port);
  const protocol = String(input.protocol ?? 'p3');
  if (!host || /\s/.test(host)) throw new Error('Informe um endereço válido para o decoder.');
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Informe uma porta entre 1 e 65535.');
  if (protocol !== 'p3' && protocol !== 'trx') throw new Error('Selecione o protocolo P3 ou TRX.');
  return {
    name: String(input.name ?? 'Decoder').trim() || 'Decoder',
    model: String(input.model ?? 'TranX').trim() || 'TranX',
    protocol,
    host,
    port,
  };
}

function probeTcp(host: string, port: number) {
  return new Promise<{ ok: boolean; error?: string }>((resolve) => {
    const socket = net.createConnection({ host, port });
    const timeout = setTimeout(() => {
      socket.destroy();
      resolve({ ok: false, error: 'Tempo esgotado ao testar a conexão.' });
    }, 3_000);
    socket.once('connect', () => {
      clearTimeout(timeout);
      socket.destroy();
      resolve({ ok: true });
    });
    socket.once('error', (error) => {
      clearTimeout(timeout);
      resolve({ ok: false, error: error.message });
    });
  });
}

function createTimingBackup() {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const target = join(DATA_DIR, 'backups', `timing-${stamp}`);
  mkdirSync(target, { recursive: true });
  for (const name of ['sessions', 'passagens']) {
    const source = join(DATA_DIR, name);
    if (existsSync(source)) cpSync(source, join(target, name), { recursive: true, errorOnExist: false });
  }
  for (const name of ['transponders.json', 'catalog.json', 'settings.json']) {
    const source = join(DATA_DIR, name);
    if (existsSync(source)) copyFileSync(source, join(target, name));
  }
  return { path: target, files: readdirSync(target) };
}

function eventBackupDir() {
  return join(DATA_DIR, 'backups', 'events');
}

function listEventBackups() {
  const dir = eventBackupDir();
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^[\w-]+$/.test(entry.name))
    .map((entry) => {
      const file = join(dir, entry.name, 'catalog.json');
      const createdAt = existsSync(file) ? new Date(statSync(file).mtimeMs).toISOString() : null;
      return { id: entry.name, createdAt };
    })
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

function createEventBackup() {
  const id = new Date().toISOString().replace(/[:.]/g, '-');
  const target = join(eventBackupDir(), id);
  mkdirSync(target, { recursive: true });
  writeJsonAtomic(join(target, 'catalog.json'), catalog);
  return { id, createdAt: new Date().toISOString(), events: catalog.events.length, groups: catalog.groups.length, provas: catalog.provas.length };
}

function restoreEventBackup(id: string) {
  if (!/^[\w-]+$/.test(id)) throw new Error('Cópia inválida.');
  if (runningSession()) throw new Error('Encerre a bateria em andamento antes de restaurar eventos.');
  const file = join(eventBackupDir(), id, 'catalog.json');
  if (!existsSync(file)) throw new Error('Cópia de eventos não encontrada.');
  const previousCatalog = catalog;
  catalog = normalizeCatalog(JSON.parse(readFileSync(file, 'utf8')));
  syncCatalogTransponders(previousCatalog, catalog);
  saveCatalog();
  scheduleStateBroadcast();
  return catalog;
}

function crossingRows(s: Session) {
  return s.competitors.flatMap((competitor) => competitor.crossings.map((crossing, index) => ({
    id: crossing.id ?? `${s.id}-${competitor.kart}-${index}`,
    kart: competitor.kart,
    name: competitor.name,
    category: competitor.category ?? null,
    transponder: crossing.transponder ?? null,
    lap: index,
    lapMs: crossing.lapMs,
    wallMs: crossing.wallMs,
    decoderTimeMs: crossing.decoderTimeMs,
    invalid: Boolean(crossing.invalid),
    deleted: Boolean(crossing.deleted),
    source: crossing.source ?? 'decoder',
    assigned: Boolean(crossing.originalKart && crossing.originalKart !== competitor.kart),
    rejected: false,
    reason: null as string | null,
    sinceLastMs: null as number | null,
  }))).concat((s.rejected ?? []).map((r) => ({
    id: r.id,
    kart: r.kart ?? '?',
    name: r.kart ? s.competitors.find((c) => c.kart === r.kart)?.name ?? 'Kart ' + r.kart : 'Transponder desconhecido',
    category: null,
    transponder: r.transponder,
    lap: -1,
    lapMs: null,
    wallMs: r.wallMs,
    decoderTimeMs: r.decoderTimeMs,
    invalid: false,
    deleted: false,
    source: 'decoder',
    assigned: false,
    rejected: true,
    reason: r.reason as string | null,
    sinceLastMs: r.sinceLastMs,
  }))).sort((a, b) => b.wallMs - a.wallMs);
}

function correctCrossings(s: Session, action: string, ids: string[], aboveId?: string) {
  // restaurar/validar uma leitura ignorada faz ela contar como volta (igual ao LapTime)
  let aceitas = 0;
  if (action === 'restore' || action === 'validate') {
    for (const r of [...(s.rejected ?? [])]) if (ids.includes(r.id) && r.kart) { acceptRejected(s, r); aceitas++; }
  }
  const rows = crossingRows(s).filter((row) => !row.rejected);
  const target = aboveId ? rows.find((row) => row.id === aboveId) : undefined;
  const selected = rows.filter((row) => ids.includes(row.id) || (target && row.wallMs >= target.wallMs));
  for (const row of selected) {
    if (action === 'delete') setCrossingDeleted(s, row.id, true);
    else if (action === 'restore') setCrossingDeleted(s, row.id, false);
    else if (action === 'invalidate' && row.lapMs !== null) setCrossingInvalid(s, row.id, true);
    else if (action === 'validate' && row.lapMs !== null) setCrossingInvalid(s, row.id, false);
  }
  return selected.length + aceitas;
}

async function handleApi(req: http.IncomingMessage, res: http.ServerResponse, url: URL) {
  const path = url.pathname;
  const method = req.method ?? 'GET';

  if (path === '/api/catalog' && method === 'GET') return send(res, 200, catalog);
  if (path === '/api/catalog/export' && method === 'GET') return send(res, 200, catalog, { 'content-disposition': 'attachment; filename="kartodromo-eventos.json"' });
  if (path === '/api/catalog/backups' && method === 'GET') return send(res, 200, listEventBackups());
  if (path === '/api/catalog/backups' && method === 'POST') return send(res, 201, createEventBackup());
  const eventBackupRestore = path.match(/^\/api\/catalog\/backups\/([\w-]+)\/restore$/);
  if (eventBackupRestore && method === 'POST') {
    try { return send(res, 200, restoreEventBackup(eventBackupRestore[1])); }
    catch (err) { return send(res, 400, { error: (err as Error).message }); }
  }
  if (path === '/api/catalog/import' && method === 'POST') {
    try {
      if (runningSession()) return send(res, 409, { error: 'Encerre a bateria em andamento antes de importar eventos.' });
      const previousCatalog = catalog;
      catalog = normalizeCatalog(await readBody(req));
      syncCatalogTransponders(previousCatalog, catalog);
      saveCatalog();
      scheduleStateBroadcast();
      return send(res, 200, catalog);
    } catch (err) { return send(res, 400, { error: (err as Error).message }); }
  }
  const catalogRoute = path.match(/^\/api\/catalog\/(events|groups|provas|categories|tracks|competitors)(?:\/([\w-]+)(?:\/(duplicate|distribute))?)?$/);
  if (catalogRoute) {
    const entity = catalogRoute[1] as CatalogEntity;
    const id = catalogRoute[2];
    const subAction = catalogRoute[3];
    if (!CATALOG_ENTITIES.has(entity)) return send(res, 404, { error: 'Cadastro desconhecido.' });
    try {
      if (!id && method === 'GET') return send(res, 200, catalog[entity]);
      if (!id && method === 'POST') {
        const body = await readBody(req);
        const item = createCatalogRecord(catalog, entity, body, randomUUID(), Date.now());
        if (entity === 'competitors') { linkCompetitorTransponder(item as TimingCatalog['competitors'][number]); saveTransponders(); }
        saveCatalog();
        return send(res, 201, item);
      }
      if (id && entity === 'events' && subAction === 'duplicate' && method === 'POST') {
        const item = duplicateEvent(catalog, id, randomUUID, Date.now());
        saveCatalog();
        return send(res, 201, item);
      }
      if (id && entity === 'provas' && subAction === 'distribute' && method === 'POST') {
        const item = distributeProof(catalog, id, await readBody(req));
        saveCatalog();
        return send(res, 200, item);
      }
      if (id && !subAction && (method === 'PATCH' || method === 'PUT')) {
        const previousCompetitor = entity === 'competitors' ? catalog.competitors.find((item) => item.id === id) : undefined;
        const item = updateCatalogRecord(catalog, entity, id, await readBody(req));
        if (entity === 'competitors') {
          unlinkCompetitorTransponder(previousCompetitor);
          linkCompetitorTransponder(item as TimingCatalog['competitors'][number]);
          saveTransponders();
        }
        saveCatalog();
        return send(res, 200, item);
      }
      if (id && !subAction && method === 'DELETE') {
        const previousCompetitor = entity === 'competitors' ? catalog.competitors.find((item) => item.id === id) : undefined;
        deleteCatalogRecord(catalog, entity, id);
        if (entity === 'competitors') { unlinkCompetitorTransponder(previousCompetitor); saveTransponders(); }
        saveCatalog();
        return send(res, 200, { ok: true });
      }
      return send(res, 405, { error: 'Método não permitido.' });
    } catch (err) { return send(res, 400, { error: (err as Error).message }); }
  }

  if (path === '/api/settings' && method === 'GET') return send(res, 200, { ...timingSettings, decoder: activeDecoderConfig });
  if (path === '/api/settings/decoder/test' && method === 'POST') {
    try {
      const config = normalizeDecoderConfig(await readBody(req));
      const result = await probeTcp(config.host, config.port);
      return send(res, result.ok ? 200 : 502, { ...result, host: config.host, port: config.port, protocol: config.protocol });
    } catch (err) { return send(res, 400, { error: (err as Error).message }); }
  }
  if (path === '/api/settings/decoder' && method === 'PATCH') {
    try {
      if (SIMULATE) return send(res, 409, { error: 'A conexão do decoder é fixa durante a simulação.' });
      if (runningSession()) return send(res, 409, { error: 'Encerre a bateria em andamento antes de alterar o decoder.' });
      const config = normalizeDecoderConfig(await readBody(req));
      const probe = await probeTcp(config.host, config.port);
      if (!probe.ok) return send(res, 502, { error: probe.error || 'Não foi possível conectar ao decoder.' });
      decoder.stop();
      activeDecoderConfig = config;
      timingSettings = { ...timingSettings, decoder: config };
      saveTimingSettings();
      decoder = createDecoderClient(config);
      decoder.start();
      scheduleStateBroadcast();
      return send(res, 200, { ok: true, decoder: activeDecoderConfig });
    } catch (err) { return send(res, 400, { error: (err as Error).message }); }
  }
  if (path === '/api/settings' && method === 'PATCH') {
    const patch = await readBody(req);
    if (Object.prototype.hasOwnProperty.call(patch, 'decoder')) return send(res, 400, { error: 'Use a tela do decoder para validar e aplicar a conexão.' });
    const timing = patch.timing as Record<string, unknown> | undefined;
    if (timing?.minimumLapSeconds !== undefined && (!Number.isFinite(Number(timing.minimumLapSeconds)) || Number(timing.minimumLapSeconds) < 0.1 || Number(timing.minimumLapSeconds) > 60)) {
      return send(res, 400, { error: 'O tempo mínimo de volta deve ficar entre 0,1 e 60 segundos.' });
    }
    const system = patch.system as Record<string, unknown> | undefined;
    if (system?.defaultTrackLengthMeters !== undefined && (!Number.isFinite(Number(system.defaultTrackLengthMeters)) || Number(system.defaultTrackLengthMeters) <= 0)) {
      return send(res, 400, { error: 'A extensão padrão do traçado deve ser maior que zero.' });
    }
    timingSettings = { ...timingSettings, ...patch };
    saveTimingSettings();
    return send(res, 200, timingSettings);
  }
  if (path === '/api/backup' && method === 'POST') {
    try { return send(res, 201, createTimingBackup()); }
    catch (err) { return send(res, 500, { error: `Falha ao criar cópia: ${(err as Error).message}` }); }
  }

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
      durationMin: Number(body.durationMin ?? ((timingSettings.timing as Record<string, unknown> | undefined)?.defaultDurationMin ?? (type === 'corrida' ? 20 : type === 'classificacao' ? 5 : 10))),
      maxLaps: body.maxLaps ? Number(body.maxLaps) : null,
      minLapSec: body.minLapSec ? Number(body.minLapSec) : Number((timingSettings.timing as Record<string, unknown> | undefined)?.minimumLapSeconds ?? 5),
      now: Date.now(),
      competitors: parseCompetitors(body.competitors),
      eventId: typeof body.eventId === 'string' ? body.eventId : null,
      groupId: typeof body.groupId === 'string' ? body.groupId : null,
      proofId: typeof body.proofId === 'string' ? body.proofId : null,
      programaId: typeof body.programaId === 'string' && body.programaId ? body.programaId : null,
    });
    sessions.set(s.id, s);
    saveSession(s);
    log(`bateria criada ${s.name} (${s.type}) com ${s.competitors.length} pilotos`);
    scheduleStateBroadcast();
    return send(res, 201, sessionView(s));
  }

  const passageCorrection = path.match(/^\/api\/sessions\/([\w-]+)\/passings\/([\w-]+)\/(delete|restore|invalidate|validate|assign|unassign)$/);
  if (passageCorrection && method === 'POST') {
    const session = sessions.get(passageCorrection[1]);
    if (!session) return send(res, 404, { error: 'Bateria não encontrada.' });
    const [, , passageId, correction] = passageCorrection;
    try {
      if (correction === 'delete') setCrossingDeleted(session, passageId, true);
      else if (correction === 'restore') setCrossingDeleted(session, passageId, false);
      else if (correction === 'invalidate') setCrossingInvalid(session, passageId, true);
      else if (correction === 'validate') setCrossingInvalid(session, passageId, false);
      else {
        const body = await readBody(req);
        assignCrossing(session, passageId, correction === 'unassign' ? null : String(body.kart ?? ''), String(body.name ?? ''));
      }
      saveSession(session);
      scheduleStateBroadcast();
      return send(res, 200, { ok: true, session: sessionView(session) });
    } catch (err) { return send(res, 400, { error: (err as Error).message }); }
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
      if (action === 'passings' && !m[3] && method === 'GET') return send(res, 200, crossingRows(s));
      if (action === 'passings' && m[3] === 'manual' && method === 'POST') {
        const body = await readBody(req);
        const kart = String(body.kart ?? '').trim();
        const passage = includeManualPassing(s, {
          id: randomUUID(),
          kart,
          lapMs: Number(body.lapMs),
          wallMs: now,
          name: String(body.name ?? ''),
          transponder: body.transponder == null ? null : Number(body.transponder),
        });
        journal({ wallMs: passage.wallMs, transponder: passage.transponder ?? null, kart, decoderTimeMs: passage.decoderTimeMs, sessionId: s.id, result: 'counted-manual', source: 'manual', passageId: passage.id });
        saveSession(s);
        scheduleStateBroadcast();
        return send(res, 201, { ok: true, passages: crossingRows(s) });
      }
      if (action === 'passings' && m[3] === 'actions' && method === 'POST') {
        const body = await readBody(req);
        const correction = String(body.action ?? '');
        if (!['delete', 'restore', 'invalidate', 'validate'].includes(correction)) return send(res, 400, { error: 'Correção desconhecida.' });
        const count = correctCrossings(s, correction, Array.isArray(body.ids) ? body.ids.map(String) : [], typeof body.aboveId === 'string' ? body.aboveId : undefined);
        saveSession(s);
        scheduleStateBroadcast();
        return send(res, 200, { ok: true, count, passages: crossingRows(s) });
      }
      if (action === 'passings' && m[3] === 'clear' && method === 'POST') {
        clearCrossings(s);
        s.rejected = [];
        saveSession(s);
        scheduleStateBroadcast();
        return send(res, 200, { ok: true, passages: crossingRows(s) });
      }
      if (action === 'flag' && !m[3] && method === 'POST') {
        const body = await readBody(req);
        const flags: Record<string, 'green' | 'yellow' | 'red' | 'white' | 'checkered'> = {
          verde: 'green', green: 'green', amarela: 'yellow', yellow: 'yellow',
          vermelha: 'red', red: 'red', branca: 'white', white: 'white',
          quadriculada: 'checkered', checkered: 'checkered',
        };
        const flag = flags[String(body.flag ?? '')];
        if (!flag) return send(res, 400, { error: 'Bandeira inválida.' });
        setRaceFlag(s, flag, now);
        saveSession(s);
        scheduleStateBroadcast();
        return send(res, 200, sessionView(s));
      }
      if (action === 'observations' && !m[3] && method === 'GET') return send(res, 200, s.observations ?? []);
      if (action === 'observations' && !m[3] && method === 'POST') {
        const body = await readBody(req);
        const text = String(body.text ?? '').trim();
        if (!text) return send(res, 400, { error: 'Escreva a observação.' });
        s.observations ??= [];
        const observation = { id: randomUUID(), text, wallMs: now, author: String(body.author ?? 'Cronometragem') };
        s.observations.unshift(observation);
        saveSession(s);
        scheduleStateBroadcast();
        return send(res, 201, observation);
      }
      if (!action && method === 'PATCH') {
        const body = await readBody(req);
        updateSessionParameters(s, {
          ...(typeof body.name === 'string' ? { name: body.name } : {}),
          ...(body.durationMin !== undefined ? { durationMin: Number(body.durationMin) } : {}),
          ...(body.maxLaps !== undefined ? { maxLaps: body.maxLaps === null ? null : Number(body.maxLaps) } : {}),
        }, now);
        if (s.state === 'preparando' && body.type && SESSION_TYPES.has(body.type as SessionType)) s.type = body.type as SessionType;
        if (body.competitors) {
          setCompetitors(s, parseCompetitors(body.competitors));
          // o número do kart digitado na tomada de tempo vale para a corrida da mesma bateria (e vice-versa),
          // enquanto a outra ainda não largou
          for (const irma of sessions.values()) {
            if (mesmoPrograma(s, irma) && copiarCompetidores(irma, s)) {
              saveSession(irma);
              log(`competidores de ${s.name} copiados para ${irma.name}`);
            }
          }
        }
        if (typeof body.eventId === 'string' || body.eventId === null) s.eventId = body.eventId as string | null;
        if (typeof body.groupId === 'string' || body.groupId === null) s.groupId = body.groupId as string | null;
        if (typeof body.proofId === 'string' || body.proofId === null) s.proofId = body.proofId as string | null;
      } else if (action === 'start' && method === 'POST') {
        const other = runningSession();
        if (other && other.id !== s.id) return send(res, 409, { error: `Ja existe bateria em andamento: ${other.name}. Encerre ela antes.` });
        startSession(s, now);
        log(`bateria ${s.name}: BANDEIRA VERDE, aguardando o primeiro kart passar na linha`);
      } else if (action === 'checkered' && method === 'POST') {
        setRaceFlag(s, 'checkered', now);
      } else if (action === 'close' && method === 'POST') {
        closeSession(s, now);
      } else if (action === 'cancel' && method === 'POST') {
        cancelSession(s, now);
      } else if (action === 'flag' && m[3] && method === 'POST') {
        const body = await readBody(req);
        const competitor = s.competitors.find((item) => item.kart === m[3]);
        if (!competitor) return send(res, 404, { error: 'Competidor não encontrado.' });
        const flag = String(body.flag ?? '') as NonNullable<(typeof competitor)['flag']>;
        if (!['none', 'green', 'yellow', 'red', 'white', 'checkered', 'black', 'mechanical', 'warning', 'blue', 'penalty'].includes(flag)) return send(res, 400, { error: 'Bandeira inválida.' });
        competitor.flag = flag;
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
  if (path === '/api/clientes' && method === 'GET') {
    try {
      return send(res, 200, await opsGet(`/api/crono/clientes?ids=${encodeURIComponent(url.searchParams.get('ids') ?? '')}`));
    } catch {
      return send(res, 200, []); // servidor antigo: a lista mostra só o que a cronometragem tem
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
  if (url.pathname === '/favicon.ico') {
    res.writeHead(204);
    return res.end();
  }
  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET,POST,PUT,PATCH', 'access-control-allow-headers': 'content-type' });
    return res.end();
  }
  if (url.pathname === '/' || url.pathname === '/operador') return sendFile(res, 'operador.html');
  if (['/admin', '/cadastros', '/ferramentas', '/configuracoes'].includes(url.pathname)) return sendFile(res, 'admin.html');
  if (url.pathname === '/tv') return sendFile(res, 'tv.html');
  if (url.pathname.startsWith('/resultado/')) return sendFile(res, 'resultado.html');
  if (url.pathname === '/kib-logo.png' || url.pathname === '/assets/da264d01b784a13054e2da496b5f46ff.png' || url.pathname === '/assets/kib-logo.png') return sendFile(res, 'kib-logo.png');
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
  log(`Cronometragem em http://0.0.0.0:${PORT}  (decoder ${decoder.status.host}:${decoder.status.port} ${decoder.protocol.toUpperCase()}${SIMULATE ? ' SIMULADO' : ''})`);
  log(`dados em ${DATA_DIR}, ${sessions.size} baterias carregadas, ${Object.keys(transponderMap).length} transponders mapeados`);
});
