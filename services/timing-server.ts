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
  addPenalty,
  removePenalty,
  restartSession,
  voltasCompletas,
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
  swapKart,
  startSession,
  tick,
  toggleLapInvalid,
  updateSessionParameters,
  type Session,
  type SessionType,
  type TrocaDeKart,
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
import { rankingPorPeso, tituloFaixas, type DadosPiloto } from '../lib/timing/ranking-peso';
import { dataBrasilia, historicoDoKart, rankingKarts } from '../lib/timing/ranking-karts';
import { calcularEqualizacao, SISTEMAS_KART, TOLERANCIA_PADRAO_MS, ultimaEqualizacaoPorKart, voltasNasBaterias, type ChecklistKart, type ConfigEqualizacao } from '../lib/timing/equalizacao';
import { nomeProprio } from '../lib/nomes';
import { configPublica, enviarResultado, enviarTeste, lerConfig, salvarConfig, traduzirErro, type Dependencias } from './timing-email';
import type { ContextoProva, EmpresaEmail } from '../lib/timing/email-resultado';
import { competidoresComSorteio, descricaoModoSorteio, pilotosDoSorteio, validarSorteio, type Atribuicao } from '../lib/timing/sorteio';

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

function logTrocas(s: { name: string }, trocas: TrocaDeKart[]) {
  for (const t of trocas) {
    log(`bateria ${s.name}: TROCA DE KART ${t.nome} do kart ${t.de} para o ${t.para}, levou ${t.voltasLevadas} volta(s)` +
      (t.passagensJuntadas ? ` e juntou ${t.passagensJuntadas} passagem(ns) que o kart ${t.para} ja tinha` : ''));
  }
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

/**
 * Outras provas da MESMA bateria (tomada de tempo + corrida): mesmo programa, mesma bateria da agenda ou o mesmo
 * grupo do evento com outra prova (baterias repetidas da mesma prova não contam: têm pilotos diferentes).
 */
function irmasDe(s: Session) {
  return [...sessions.values()].filter((x) => x.id !== s.id && x.state !== 'cancelada' && (
    mesmoPrograma(s, x)
    || (s.agendaId != null && x.agendaId === s.agendaId)
    || (Boolean(s.groupId) && x.groupId === s.groupId && x.eventId === s.eventId && x.proofId !== s.proofId)));
}

/**
 * Bateria nova sem pilotos (ou com pilotos sem número de kart, quando não teve sorteio) herda a lista da outra prova
 * da mesma bateria: os nomes e karts digitados à mão na tomada vão para a corrida. Devolve de quem copiou.
 */
function herdarCompetidores(s: Session): Session | null {
  if (s.state !== 'preparando') return null;
  const temKart = s.competitors.some((c) => String(c.kart ?? '').trim());
  if (s.competitors.length && temKart) return null;
  const fonte = irmasDe(s)
    .filter((x) => x.competitors.some((c) => !c.autoAdded && String(c.kart ?? '').trim()))
    .sort((a, b) => b.createdAt - a.createdAt)[0];
  if (!fonte) return null;
  setCompetitors(s, fonte.competitors.filter((c) => !c.autoAdded).map((c) => ({ kart: c.kart, name: c.name, customerId: c.customerId ?? null, category: c.category ?? null, detalhes: c.detalhes })));
  return fonte;
}

function registrarObservacao(s: Session, text: string, author: string) {
  (s.observations ??= []).unshift({ id: randomUUID(), text, wallMs: Date.now(), author });
  log(`bateria ${s.name}: ${text}`);
}

function textoPenalidade(p: { tipo: string; segundos?: number }) {
  return p.tipo === 'tempo' ? `Penalidade de +${String(p.segundos ?? 0).replace('.', ',')} s` : 'Advertência';
}

/** Bandeira verde de novo (relargada): zera a bateria e arma o cronômetro para o próximo kart que passar na linha. */
function relargar(s: Session, now: number, autor: string) {
  restartSession(s);
  startSession(s, now);
  registrarObservacao(s, 'Relargada: bandeira verde de novo, o cronômetro recomeça no primeiro kart que passar na linha (passagens anteriores continuam no diário)', autor);
  setTb50Offset(0, 'relargada');
}

/** "19:55" da prova da agenda (ordem do dia); sem prova, a hora de criação. */
function horaDaProva(s: Session) {
  const p = s.proofId ? catalog.provas.find((x) => x.id === s.proofId) : undefined;
  if (p?.startAt) return `${p.startAt}|${p.order}`;
  return new Date(s.createdAt).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });
}

function sortedSessions() {
  return [...sessions.values()].sort((a, b) => b.createdAt - a.createdAt);
}

/** Traçado da bateria: o escolhido nela (Editar bateria) › o da prova › o do evento. null = traçado padrão. */
function trackIdDa(s: Session): string | null {
  if (s.trackId && catalog.tracks.some((t) => t.id === s.trackId)) return s.trackId;
  const prova = catalog.provas.find((p) => p.id === s.proofId);
  if (prova?.trackId) return prova.trackId;
  return catalog.events.find((e) => e.id === (s.eventId ?? prova?.eventId))?.trackId ?? null;
}

function defaultTrackLength() {
  const system = (timingSettings.system && typeof timingSettings.system === 'object' ? timingSettings.system : {}) as Record<string, unknown>;
  return Number(system.defaultTrackLengthMeters ?? timingSettings.defaultTrackLengthMeters) || 1_000;
}

function trackDa(s: Session) {
  const id = trackIdDa(s);
  const t = id ? catalog.tracks.find((item) => item.id === id) : undefined;
  return { id: t?.id ?? null, name: t?.name ?? 'Traçado principal', lengthMeters: t?.lengthMeters ?? defaultTrackLength() };
}

function trackLengthFor(s: Session) {
  return trackDa(s).lengthMeters;
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

/** Mantém a faixa ao vivo coerente depois de uma troca e grava um evento de auditoria.
 * O diário das leituras continua imutável (ele registra o que o decoder enviou); este evento
 * permite reconstruir o vínculo do piloto sem perder a informação do kart original. */
function registrarTrocas(s: { id?: string; name: string }, trocas: TrocaDeKart[], source = 'operator') {
  if (!trocas.length) return;
  logTrocas(s, trocas);
  for (const t of trocas) {
    if (s.id) for (const passing of recentPassings) if (passing.sessionId === s.id && passing.kart === t.de) passing.kart = t.para;
    journal({ type: 'kart-swap', wallMs: Date.now(), sessionId: s.id ?? null, fromKart: t.de, toKart: t.para, name: t.nome, source });
  }
}

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
    voltasCompletas: voltasCompletas(s),
    trackId: s.trackId ?? null,
    track: trackDa(s),
    elapsedMs: elapsedMs(s, now),
    currentFlag: s.currentFlag ?? 'none',
    eventId: s.eventId ?? null,
    groupId: s.groupId ?? null,
    proofId: s.proofId ?? null,
    observations: s.observations ?? [],
    // nome próprio só na exibição (telão, resultado, operador): o cadastro vinha TUDO MAIÚSCULO ou tudo minúsculo
    competitors: s.competitors.map((c) => ({
      kart: c.kart, name: nomeProprio(c.name), customerId: c.customerId ?? null, category: c.category ?? null, flag: c.flag ?? 'none', autoAdded: Boolean(c.autoAdded), detalhes: c.detalhes ?? null,
      // já passou na linha nesta bateria (a lista de competidores fica amarela até o kart passar)
      passou: c.crossings.some((x) => !x.deleted),
      penalidades: c.penalidades ?? [],
    })),
    standings: computeStandings(s, trackLengthFor(s)).filter((r) => !s.competitors.find((c) => c.kart === r.kart && c.name === r.name)?.detalhes?.oculto).map((r) => ({ ...r, name: nomeProprio(r.name) })),
    emailsResultado: s.emailsResultado ?? null,
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
    semKart: s.competitors.filter((c) => !c.kart && c.name?.trim()).length,
    agendaId: s.agendaId ?? null,
    programaId: s.programaId ?? null,
  };
}

function decoderView() {
  const st = decoder.status;
  return { ...st, simulated: SIMULATE, healthy: st.connected && !!st.lastDataAt && Date.now() - st.lastDataAt < 15_000 };
}

function stateView() {
  const running = runningSession();
  const list = sortedSessions();
  // a bateria em foco: a que esta correndo, senao a proxima preparada HOJE, senao a ultima encerrada
  // (uma preparada esquecida de outro dia prendia o telao: em 30/09 o foco era o "Clube da Insonia" de 27/09)
  const focus =
    running ??
    // ordem do horário da agenda (as baterias que a agenda cria sozinha não podem pular na frente da próxima)
    list.filter((s) => s.state === 'preparando' && s.createdAt >= inicioDoDia()).sort((a, b) => horaDaProva(a).localeCompare(horaDaProva(b)) || a.createdAt - b.createdAt)[0] ??
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
    tb50: {
      offset: tb50Page.offset,
      pageSize: TB50_PAGE_SIZE,
      updatedAt: tb50Page.updatedAt,
      telas: [...tb50Pings.entries()].map(([ip, p]) => ({ ip, ultimoSinalMs: Date.now() - p.at, navegador: p.ua })),
    },
  };
}

// ---------------------------------------------------------------- telao de LED (TB50, PC .250)
// O placar do .250 mostra 20 posicoes por vez. A pagina (1-20, 21-40...) fica aqui para o
// ORBITS e o CRONO1 mandarem a mesma coisa; volta para 1-20 na bandeira verde.

const TB50_PAGE_FILE = join(DATA_DIR, 'tb50-page.json');
const TB50_PAGE_SIZE = 20;
const tb50Pings = new Map<string, { at: number; ua: string }>();
let tb50Page: { offset: number; updatedAt: string | null } = { offset: 0, updatedAt: null };
try {
  if (existsSync(TB50_PAGE_FILE)) tb50Page = { offset: 0, updatedAt: null, ...JSON.parse(readFileSync(TB50_PAGE_FILE, 'utf8')) };
} catch {
  // arquivo ruim: comeca da primeira pagina
}

function setTb50Offset(value: unknown, motivo: string) {
  const n = Number(value);
  const offset = Number.isFinite(n) ? Math.min(Math.floor(Math.max(0, n) / TB50_PAGE_SIZE) * TB50_PAGE_SIZE, 80) : 0;
  if (offset === tb50Page.offset && tb50Page.updatedAt) return tb50Page;
  tb50Page = { offset, updatedAt: new Date().toISOString() };
  try { writeJsonAtomic(TB50_PAGE_FILE, tb50Page); } catch { /* fica em memoria */ }
  log(`telao TB50: posicoes ${offset + 1}-${offset + TB50_PAGE_SIZE} (${motivo})`);
  scheduleStateBroadcast();
  return tb50Page;
}

/** Formato LiveTimingSnapshot (lib/livetime/types.ts) consumido pelo site, telao e TB50. */
function liveSnapshot(painelTb50 = false) {
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
    drivers: painelVazio(
      painelTb50 && OPEN_STATES.has(s.state),
      standings
        .filter((r) => r.laps > 0 || !OPEN_STATES.has(s.state))
        .map((r) => ({ position: r.position, kart: r.kart, name: r.name, time: formatLap(r.bestLapMs) })),
    ),
  };
}

/**
 * Na bandeira verde ninguem completou volta ainda e a lista vem vazia; o placar do .250
 * trata lista vazia como "sem dados" e segura a tela anterior (o grid da tomada). Para ele
 * zerar na largada, vai uma linha fora das 20 casas (posicao 999), que nao aparece.
 */
function painelVazio<T extends { position: number; kart: string; name: string; time: string }>(aoVivo: boolean, drivers: T[]) {
  if (!aoVivo || drivers.length) return drivers;
  return [{ position: 999, kart: '-', name: '-', time: '-' } as T];
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

/** Karts com transponder cadastrado (os que podem entrar no sorteio). */
function kartsCadastrados() {
  return [...new Set(Object.values(transponderMap).map((k) => String(k).trim()).filter((k) => /^\d+$/.test(k)))].sort((a, b) => Number(a) - Number(b));
}

/** Id da bateria na agenda da recepção: o guardado na prova ou, nas criadas sem ele, pelo nome no mesmo dia. */
async function agendaIdDa(s: Session): Promise<number | null> {
  if (s.agendaId) return s.agendaId;
  try {
    const data = new Date(s.createdAt).toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
    const agenda = (await opsGet(`/api/baterias?data=${data}`)) as { id?: number; nome?: string }[];
    const i = s.name.lastIndexOf(' · ');
    const base = (i > 0 ? s.name.slice(0, i) : s.name).trim().toLowerCase();
    return agenda.find((b) => String(b.nome ?? '').trim().toLowerCase() === base)?.id ?? null;
  } catch {
    return null;
  }
}

/** Tipo de kart da bateria na agenda da recepção (light/super), achado pelo id ou pelo nome da bateria. */
async function tipoKartDa(s: Session): Promise<string | null> {
  try {
    const data = new Date(s.createdAt).toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
    const agenda = (await opsGet(`/api/baterias?data=${data}`)) as { id?: number; nome?: string; tipoKart?: string }[];
    const i = s.name.lastIndexOf(' · ');
    const base = (i > 0 ? s.name.slice(0, i) : s.name).trim().toLowerCase();
    const achada = agenda.find((b) => s.agendaId != null && b.id === s.agendaId) ?? agenda.find((b) => String(b.nome ?? '').trim().toLowerCase() === base);
    return achada?.tipoKart ?? null;
  } catch {
    return null;
  }
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

// ---------------------------------------------------------------- equalização dos karts
// A equalização é uma bateria do tipo "equalizacao" (voltas do decoder, separadas das baterias normais). Aqui ficam o
// histórico de metas por traçado e as contas que a tela e o relatório da oficina mostram.

type MetaTracado = {
  id: string; trackId: string | null; metaMs: number; toleranciaMs: number; quando: number;
  /** manual = definida para o traçado; equalizacao = a meta que saiu de uma equalização finalizada */
  origem: 'manual' | 'equalizacao'; sessionId?: string | null; referencias?: string[]; autor?: string;
};
const METAS_FILE = join(DATA_DIR, 'equalizacao-metas.json');
let metasTracado: MetaTracado[] = (() => {
  try { const j = JSON.parse(readFileSync(METAS_FILE, 'utf8')) as unknown; return Array.isArray(j) ? (j as MetaTracado[]) : []; } catch { return []; }
})();
function saveMetas() { writeFileSync(METAS_FILE, JSON.stringify(metasTracado, null, 2)); }

/** Última meta registrada para o traçado até a data dada. */
function metaVigente(trackId: string | null, ate = Date.now()) {
  return metasTracado.filter((m) => (m.trackId ?? null) === (trackId ?? null) && m.quando <= ate).sort((a, b) => b.quando - a.quando)[0] ?? null;
}

/** Volta do kart físico: pelo transponder (troca de kart) e, sem ele, pelo número na bateria. */
function kartDaPassagem(kart: string, transponder: number | null | undefined) {
  return (transponder != null && transponderMap[String(transponder)]) || kart;
}

/** "52,395" ou 52.395 (segundos) → ms. */
function segundosParaMs(v: unknown) {
  const n = Number(String(v ?? '').trim().replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 1000) : null;
}

/** Configuração usada na conta: no modo "meta fixa" sem valor digitado vale a última meta do traçado. */
function configEqualizacao(s: Session): ConfigEqualizacao {
  const cfg = s.equalizacao ?? {};
  if (cfg.metaModo === 'fixa' && !(Number(cfg.metaFixaMs) > 0)) return { ...cfg, metaFixaMs: metaVigente(trackIdDa(s), s.startedAt ?? s.createdAt)?.metaMs ?? null };
  return cfg;
}

function equalizacaoResumo(s: Session) {
  const r = calcularEqualizacao(s, configEqualizacao(s));
  const testados = r.karts.filter((k) => !k.referencia);
  return {
    id: s.id, name: s.name, state: s.state, createdAt: s.createdAt, startedAt: s.startedAt, finishedAt: s.finishedAt,
    finalizadaEm: s.equalizacao?.finalizadaEm ?? null, track: trackDa(s), mecanico: s.equalizacao?.mecanico ?? '',
    metaMs: r.metaMs, metaOrigem: r.metaOrigem, toleranciaMs: r.toleranciaMs, referencias: s.equalizacao?.referencias ?? [],
    karts: testados.length, equalizados: testados.filter((k) => k.status === 'EQUALIZADO').length,
    ajustando: testados.filter((k) => k.status === 'AJUSTANDO').length, revisar: testados.filter((k) => k.status === 'REVISAR').length,
  };
}

/** Voltas de cada kart nas baterias normais desde a última equalização dele até o começo desta. */
function voltasDesdeUltimaEqualizacao(s: Session) {
  const ate = s.startedAt ?? s.createdAt;
  const ultima = ultimaEqualizacaoPorKart(sessions.values(), ate);
  const out: Record<string, { voltas: number; baterias: number; desde: number | null }> = {};
  for (const c of s.competitors) {
    const desde = ultima.get(c.kart) ?? null;
    const v = voltasNasBaterias(sessions.values(), desde, ate, kartDaPassagem).get(c.kart);
    out[c.kart] = { voltas: v?.voltas ?? 0, baterias: v?.baterias ?? 0, desde };
  }
  return out;
}

function equalizacaoDetalhe(s: Session) {
  const cfg = s.equalizacao ?? {};
  return {
    ...equalizacaoResumo(s),
    config: { metaModo: cfg.metaModo ?? 'referencia', metaFixaMs: cfg.metaFixaMs ?? null, toleranciaMs: cfg.toleranciaMs ?? TOLERANCIA_PADRAO_MS, referencias: cfg.referencias ?? [], redutores: cfg.redutores ?? {}, mecanico: cfg.mecanico ?? '', trackId: s.trackId ?? null },
    metaDoTracado: metaVigente(trackIdDa(s), s.startedAt ?? s.createdAt),
    resultado: (() => { const r = calcularEqualizacao(s, configEqualizacao(s)); return { ...r, karts: r.karts.map((k) => ({ ...k, piloto: nomeProprio(k.piloto) })) }; })(),
    voltasDesdeUltima: voltasDesdeUltimaEqualizacao(s),
    observations: s.observations ?? [],
    sistemas: SISTEMAS_KART,
  };
}

// ---------------------------------------------------------------- agenda (servidor da operacao no SRVKART)

const OPS_URL = process.env.OPS_URL || 'http://192.168.20.13:4060';

async function opsGet(path: string) {
  const r = await fetch(OPS_URL + path, { headers: { 'x-ops-key': process.env.OPS_RECEPCAO_KEY || '' }, signal: AbortSignal.timeout(6000) });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((data as { error?: string }).error || `Servidor da operacao respondeu ${r.status}`);
  return data;
}

/**
 * Horas de uso dos karts para a oficina (Manutenções no Módulo Office): ao encerrar a bateria manda quantos minutos
 * cada kart ficou na pista (da primeira à última passagem). Uma vez por bateria; se o servidor da operação estiver
 * fora, tenta de novo a cada 5 minutos (baterias dos últimos 2 dias).
 */
async function enviarUsoKarts(s: Session) {
  // simulador (testes) nunca grava horas de uso de mentira no controle da oficina de verdade
  if (SIMULATE || s.usoKartsEnviado || s.state !== 'encerrada') return;
  const karts = s.competitors
    .map((c) => {
      const t = c.crossings.filter((x) => !x.deleted).map((x) => x.wallMs).sort((a, b) => a - b);
      return { kart: c.kart, minutos: t.length > 1 ? Math.round((t[t.length - 1] - t[0]) / 60_000) : 0 };
    })
    .filter((k) => k.kart && k.minutos > 0);
  if (!karts.length) { s.usoKartsEnviado = true; saveSession(s); return; }
  try {
    const r = await fetch(OPS_URL + '/api/crono/uso-karts', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-ops-key': process.env.OPS_RECEPCAO_KEY || '' },
      // sem a bateria da agenda não se sabe a categoria (Indoor/Super Kart têm karts com o mesmo número)
      body: JSON.stringify({ sessaoId: s.id, agendaId: await agendaIdDa(s), karts }),
      signal: AbortSignal.timeout(8000),
    });
    const d = (await r.json().catch(() => ({}))) as { somados?: number; criados?: number; ignorados?: number; categoria?: string | null; error?: string };
    if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
    s.usoKartsEnviado = true;
    saveSession(s);
    log(`uso dos karts de ${s.name} enviado para a oficina: ${karts.length} karts, ${d.somados ?? 0} controles somados, ${d.criados ?? 0} novos, ${d.ignorados ?? 0} sem controle (${d.categoria ?? 'sem categoria'})`);
  } catch (err) {
    log(`uso dos karts de ${s.name} não foi enviado (tenta de novo): ${(err as Error).message}`);
  }
}
setInterval(() => {
  const limite = Date.now() - 2 * 86_400_000;
  for (const s of sessions.values()) if (s.state === 'encerrada' && !s.usoKartsEnviado && (s.finishedAt ?? s.createdAt) > limite) void enviarUsoKarts(s);
}, 5 * 60_000);

// ---------------------------------------------------------------- e-mail do resultado para os pilotos (como o LapTime)
// Ao encerrar cada TOMADA DE TEMPO e cada CORRIDA: um e-mail por piloto com o resumo dele, a classificação e os PDFs
// (resultado oficial + volta a volta). Conta de e-mail do kartódromo em data/timing/email.json (tela na Cronometragem).

const EMAIL_FILE = join(DATA_DIR, 'email.json');
const LOGO_EMAIL = (() => {
  // versão pequena (360 px, 35 KB): o logo original (263 KB) ia 3 vezes por e-mail e deixava cada um com 1,1 MB
  try { return readFileSync(resolve(process.cwd(), 'services', 'timing-ui', 'logo-email.png')); } catch { return null; }
})();
let empresaCache: { em: number; dados: EmpresaEmail } | null = null;

async function empresaParaEmail(): Promise<EmpresaEmail> {
  if (empresaCache && Date.now() - empresaCache.em < 3_600_000) return empresaCache.dados;
  try {
    const e = (await opsGet('/api/crono/empresa')) as Record<string, string | null>;
    const dados: EmpresaEmail = { nome: e.nome || TRACK_NAME, telefone: e.telefone, email: e.email, cidade: e.cidade, estado: e.estado, site: 'www.kartodromodebetim.com.br' };
    empresaCache = { em: Date.now(), dados };
    return dados;
  } catch {
    return { nome: 'Kartódromo Internacional de Betim', site: 'www.kartodromodebetim.com.br' };
  }
}

async function contextoDaProva(s: Session): Promise<ContextoProva> {
  const prova = catalog.provas.find((p) => p.id === s.proofId);
  const grupo = catalog.groups.find((g) => g.id === (s.groupId ?? prova?.groupId));
  const evento = catalog.events.find((e) => e.id === (s.eventId ?? prova?.eventId));
  const pista = catalog.tracks.find((t) => t.id === trackIdDa(s));
  // sem o programa do catálogo, o nome da bateria já vem "BATERIA 17:00 · CORRIDA"
  const i = s.name.lastIndexOf(' · ');
  return {
    empresa: await empresaParaEmail(),
    evento: evento?.name ?? null,
    grupo: grupo?.name ?? (i > 0 ? s.name.slice(0, i) : null),
    prova: prova?.name ?? (i > 0 ? s.name.slice(i + 3) : s.name),
    tipo: s.type,
    tracado: pista?.name ?? null,
    quando: s.startedAt ?? s.finishedAt ?? s.createdAt,
    classificacao: computeStandings(s, trackLengthFor(s)).filter((r) => !r.autoAdded || r.laps > 0).filter((r) => !s.competitors.find((c) => c.kart === r.kart && c.name === r.name)?.detalhes?.oculto),
  };
}

const depEmail: Dependencias = {
  dataDir: DATA_DIR,
  simulador: SIMULATE,
  log: (t) => log(t),
  salvarSessao: (s) => saveSession(s),
  contexto: contextoDaProva,
  emailsDosClientes: async (ids) => {
    const mapa = new Map<string, string>();
    for (let i = 0; i < ids.length; i += 150) {
      const rows = (await opsGet(`/api/crono/clientes?ids=${ids.slice(i, i + 150).join(',')}`)) as { id: number; email?: string | null }[];
      for (const r of rows) if (r.email) mapa.set(String(r.id), r.email);
    }
    return mapa;
  },
  logoPng: LOGO_EMAIL,
};

/** Disparo do encerramento: só tomada de tempo e corrida, com voltas; nunca derruba o servidor. */
async function emailsAoEncerrar(s: Session) {
  if (s.state !== 'encerrada' || !['classificacao', 'corrida'].includes(s.type)) return;
  if (!s.competitors.some((c) => c.crossings.some((x) => !x.deleted && x.lapMs != null))) return; // bateria sem volta nenhuma
  try {
    await enviarResultado(s, EMAIL_FILE, depEmail, { automatico: true });
  } catch (err) {
    const erro = (err as Error).message;
    s.emailsResultado = { status: 'falhou', atualizadoEm: Date.now(), tentativas: (s.emailsResultado?.tentativas ?? 0) + 1, enviados: s.emailsResultado?.enviados ?? [], falhas: [{ kart: '', nome: '', email: '', erro }], semEmail: s.emailsResultado?.semEmail ?? [] };
    saveSession(s);
    log(`e-mail do resultado de ${s.name} não foi enviado (tenta de novo): ${erro}`);
  }
}
// nova tentativa a cada 5 min só para quem falhou (servidor de e-mail fora, internet caiu), até 6 h depois do encerramento
setInterval(() => {
  const limite = Date.now() - 6 * 3_600_000;
  for (const s of sessions.values()) {
    const e = s.emailsResultado;
    if (s.state === 'encerrada' && e && (e.status === 'parcial' || e.status === 'falhou') && e.tentativas < 12 && (s.finishedAt ?? s.createdAt) > limite) void emailsAoEncerrar(s);
  }
}, 5 * 60_000);

// ---------------------------------------------------------------- agenda da recepção -> evento do dia (canvas Eventos.dc.html)
// Como no canvas: cada dia vira o evento "Baterias dd/mm/aaaa", cada bateria da agenda da recepção vira um grupo e as
// provas vêm do produto vendido (Tomada de tempo + Corrida...). As provas criadas aqui podem ser ajustadas pelo
// cronometrista: a sincronização só cria o que falta, nunca sobrescreve.

type BateriaAgenda = { id: number; nome?: string; inicio?: string; tipoKart?: string; pagos?: number; inscritos?: number };
type ProgramaAgenda = { ordem?: number; nome?: string; tipo?: string; finalizacao?: string; tempoMin?: number; voltasMax?: number; voltaMinimaSeg?: number };
const programasAgenda = new Map<number, { em: number; provas: ProgramaAgenda[] }>();

function hojeBrasilia() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
}

function inicioDoDia() {
  const [a, m, d] = hojeBrasilia().split('-').map(Number);
  return new Date(a, m - 1, d).getTime();
}

async function sincronizarAgendaDoDia() {
  const hoje = hojeBrasilia();
  let baterias: BateriaAgenda[];
  try { baterias = (await opsGet(`/api/baterias?data=${hoje}`)) as BateriaAgenda[]; } catch { return false; }
  if (!Array.isArray(baterias) || !baterias.length) return false;
  let mudou = false;
  const eventId = `agenda-${hoje}`;
  const [a, m, d] = hoje.split('-');
  if (!catalog.events.some((e) => e.id === eventId)) {
    catalog.events.push({ id: eventId, name: `Baterias ${d}/${m}/${a}`, date: hoje, venue: TRACK_NAME, trackId: null, active: true, createdAt: Date.now() });
    mudou = true;
  }
  // categorias do canvas (Indoor · Super Kart): separam os resultados "Por categoria"
  const categoria = (nome: string) => {
    let c = catalog.categories.find((x) => x.name.trim().toLowerCase() === nome.toLowerCase());
    if (!c) { c = { id: `cat-${nome.toLowerCase().replace(/W+/g, '-')}`, name: nome, color: nome === 'Super Kart' ? '#B45309' : '#0B7A53', sport: 'Karting', active: true }; catalog.categories.push(c); mudou = true; }
    return c.id;
  };
  for (const [i, b] of baterias.entries()) {
    const groupId = `agenda-b${b.id}`;
    const nome = String(b.nome ?? '').trim() || `Bateria ${b.id}`;
    const grupo = catalog.groups.find((g) => g.id === groupId);
    const catId = categoria(String(b.tipoKart ?? '').toLowerCase() === 'super' ? 'Super Kart' : 'Indoor');
    if (!grupo) { catalog.groups.push({ id: groupId, eventId, name: nome, categoryId: catId, order: i + 1, active: true }); mudou = true; }
    else if (!grupo.categoryId) { grupo.categoryId = catId; mudou = true; }
    else if (grupo.name !== nome || grupo.order !== i + 1) { grupo.name = nome; grupo.order = i + 1; mudou = true; }
    let prog = programasAgenda.get(b.id);
    if (!prog || Date.now() - prog.em > 10 * 60_000) {
      let provas: ProgramaAgenda[] = prog?.provas ?? [];
      try { provas = (await opsGet(`/api/crono/baterias/${b.id}/programa`)) as ProgramaAgenda[]; } catch { /* fica o que já tinha */ }
      prog = { em: Date.now(), provas: Array.isArray(provas) ? provas : [] };
      programasAgenda.set(b.id, prog);
    }
    const lista = prog.provas.length ? prog.provas : [{ nome: 'CORRIDA', tipo: 'corrida', finalizacao: 'tempo', tempoMin: 20 }];
    const hora = String(b.inicio ?? '').slice(11, 16);
    let minutos = /^\d{2}:\d{2}$/.test(hora) ? Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3, 5)) : null;
    lista.forEach((p, k) => {
      const id = `agenda-b${b.id}-${k + 1}`;
      const porVoltas = p.finalizacao === 'voltas';
      const tempo = porVoltas ? 0 : Number(p.tempoMin ?? 20);
      if (!catalog.provas.some((x) => x.id === id)) {
        const tipo: SessionType = p.tipo === 'treino' || p.tipo === 'classificacao' || p.tipo === 'corrida' ? p.tipo : 'corrida';
        catalog.provas.push({
          id, eventId, groupId, agendaId: String(b.id), order: k + 1, heats: 1, intervalMin: 0, trackId: null,
          name: String(p.nome ?? '').trim() || (tipo === 'classificacao' ? 'TOMADA DE TEMPO' : tipo === 'treino' ? 'TREINO' : 'CORRIDA'),
          type: tipo, durationMin: tempo, maxLaps: porVoltas && Number(p.voltasMax) > 0 ? Number(p.voltasMax) : null,
          minLapSec: Number(p.voltaMinimaSeg) > 0 ? Number(p.voltaMinimaSeg) : null,
          startAt: minutos == null ? '' : `${String(Math.floor(minutos / 60) % 24).padStart(2, '0')}:${String(minutos % 60).padStart(2, '0')}`,
        });
        mudou = true;
      }
      if (minutos != null) minutos += (tempo || 10) + 5;
    });
  }
  // baterias de hoje já criadas (pelo "Criar bateria", pelo tablet ou antes desta versão) entram no grupo/prova certos
  const usadas = new Set([...sessions.values()].filter((x) => x.proofId && x.state !== 'cancelada').map((x) => x.proofId));
  for (const s of [...sessions.values()].sort((x, y) => x.createdAt - y.createdAt)) {
    if (s.proofId || s.state === 'cancelada' || s.createdAt < inicioDoDia()) continue;
    let aid = s.agendaId ?? null;
    if (!aid) {
      const k = s.name.lastIndexOf(' · ');
      const base = (k > 0 ? s.name.slice(0, k) : s.name).trim().toLowerCase();
      aid = baterias.find((b) => String(b.nome ?? '').trim().toLowerCase() === base)?.id ?? null;
    }
    if (!aid) continue;
    const provas = catalog.provas.filter((p) => p.agendaId === String(aid)).sort((x, y) => x.order - y.order);
    const alvo = provas.find((p) => p.type === s.type && !usadas.has(p.id)) ?? (provas.length === 1 && !usadas.has(provas[0].id) ? provas[0] : undefined);
    if (!alvo) continue;
    s.agendaId = aid; s.eventId = alvo.eventId; s.groupId = alvo.groupId; s.proofId = alvo.id;
    usadas.add(alvo.id);
    saveSession(s);
    mudou = true;
  }
  if (mudou) { saveCatalog(); scheduleStateBroadcast(); log(`agenda de ${hoje} sincronizada: ${baterias.length} baterias no evento do dia`); }
  // bateria da agenda com piloto pago vira bateria da cronometragem sozinha (sem depender do tablet do sorteio)
  // e quem pagar depois entra na lista até a largada
  let criou = false;
  for (const b of baterias) {
    try { if (await prepararBateriaDaAgenda(b)) criou = true; } catch (err) { log(`agenda ${b.id}: não consegui preparar a bateria (${(err as Error).message})`); }
  }
  if (criou) scheduleStateBroadcast();
  return mudou || criou;
}

type InscritoAgenda = { nome?: string; kart?: string | null; clienteId?: unknown; pago?: boolean; aprovada?: boolean };

/**
 * Cria (se faltar) uma bateria da cronometragem para cada prova da bateria da agenda que tem piloto pago, já com os
 * pilotos da recepção; nas que ainda não largaram, acrescenta quem pagou depois. Quem o cronometrista tirou da lista não
 * volta (fica em agendaPuxados). Sem número de kart da recepção, herda os karts da outra prova da mesma bateria.
 */
async function prepararBateriaDaAgenda(b: BateriaAgenda): Promise<boolean> {
  if (!(Number(b.pagos) > 0)) return false;
  const provas = catalog.provas.filter((p) => p.agendaId === String(b.id)).sort((x, y) => x.order - y.order);
  if (!provas.length) return false;
  const daBateria = [...sessions.values()].filter((s) => s.state !== 'cancelada' && (s.agendaId === b.id || provas.some((p) => p.id === s.proofId)));
  const abertas = daBateria.filter((s) => s.state === 'preparando');
  const faltam = provas.filter((p) => !daBateria.some((s) => s.proofId === p.id));
  // bateria que já passou há mais de 3 h não ganha prova nova
  const inicio = b.inicio ? new Date(`${b.inicio}:00-03:00`).getTime() : NaN;
  const antiga = Number.isFinite(inicio) && Date.now() - inicio > 3 * 3_600_000;
  if (!abertas.length && (!faltam.length || antiga)) return false;
  const grade = (await opsGet(`/api/crono/baterias/${b.id}/grid`)) as InscritoAgenda[];
  const pagos = (Array.isArray(grade) ? grade : []).filter((g) => g.pago !== false && String(g.nome ?? '').trim());
  if (!pagos.length) return false;
  const grupo = catalog.groups.find((g) => g.id === provas[0].groupId);
  const doGrid = (g: InscritoAgenda) => ({ kart: String(g.kart ?? '').trim(), name: String(g.nome ?? '').trim(), customerId: g.clienteId != null ? String(g.clienteId) : null, category: grupo?.categoryId ?? null });
  const cfg = (timingSettings.timing as Record<string, unknown> | undefined) ?? {};
  let mudou = false;
  if (!antiga) for (const p of faltam) {
    const s = createSession({
      id: `${hojeBrasilia()}-${randomUUID().slice(0, 8)}`,
      name: `${grupo?.name ?? b.nome ?? 'Bateria'} · ${p.name}`,
      type: p.type, durationMin: p.durationMin, maxLaps: p.maxLaps,
      minLapSec: p.minLapSec ?? Number(cfg.minimumLapSeconds ?? 5),
      now: Date.now(), competitors: pagos.map(doGrid),
      eventId: p.eventId, groupId: p.groupId, proofId: p.id, programaId: `agenda-${b.id}`,
    });
    s.agendaId = b.id;
    const herdada = herdarCompetidores(s);
    s.agendaPuxados = pagos.map((g) => (g.clienteId != null ? String(g.clienteId) : String(g.nome).trim().toLowerCase()));
    // quem pagou e não estava na outra prova (de onde vieram os karts) entra também
    if (herdada) acrescentarPilotos(s, pagos.map(doGrid));
    sessions.set(s.id, s);
    saveSession(s);
    abertas.push(s);
    log(`bateria criada sozinha pela agenda: ${s.name} com ${s.competitors.length} pilotos pagos${herdada ? ` (karts de ${herdada.name})` : ''}`);
    mudou = true;
  }
  for (const s of abertas) {
    if (s.state !== 'preparando') continue;
    const puxados = new Set(s.agendaPuxados ?? s.competitors.map((c) => String(c.customerId ?? c.name.trim().toLowerCase())));
    const novos = pagos.filter((g) => !puxados.has(g.clienteId != null ? String(g.clienteId) : String(g.nome).trim().toLowerCase()));
    if (!s.agendaPuxados) { s.agendaPuxados = [...puxados]; mudou = true; saveSession(s); }
    if (!novos.length) continue;
    const entraram = acrescentarPilotos(s, novos.map(doGrid));
    s.agendaPuxados = [...puxados, ...novos.map((g) => (g.clienteId != null ? String(g.clienteId) : String(g.nome).trim().toLowerCase()))];
    saveSession(s);
    if (entraram) log(`${s.name}: ${entraram} piloto(s) que pagaram depois entraram na lista`);
    mudou = true;
  }
  return mudou;
}

/** Acrescenta pilotos que ainda não estão na bateria (pelo cliente ou pelo nome), sem mexer em quem já está. */
function acrescentarPilotos(s: Session, lista: { kart: string; name: string; customerId: string | null; category: string | null }[]) {
  const ids = new Set(s.competitors.map((c) => String(c.customerId ?? '')).filter(Boolean));
  const nomes = new Set(s.competitors.map((c) => c.name.trim().toLowerCase()));
  const usados = new Set(s.competitors.map((c) => c.kart).filter(Boolean));
  const novos = lista.filter((p) => (p.customerId ? !ids.has(p.customerId) : !nomes.has(p.name.toLowerCase())))
    .map((p) => ({ ...p, kart: p.kart && !usados.has(p.kart) ? p.kart : '' }));
  if (!novos.length) return 0;
  setCompetitors(s, [...s.competitors.map((c) => ({ kart: c.kart, name: c.name, customerId: c.customerId ?? null, category: c.category ?? null, detalhes: c.detalhes })), ...novos]);
  return novos.length;
}
setTimeout(() => void sincronizarAgendaDoDia(), 3_000);
setInterval(() => void sincronizarAgendaDoDia(), 60_000);

const SESSION_TYPES = new Set<SessionType>(['treino', 'classificacao', 'corrida', 'equalizacao']);
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
    name: nomeProprio(competitor.name), // como no resultado ao lado (TUDO MAIÚSCULO cortava no registro de passagens)
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
    name: r.kart ? nomeProprio(s.competitors.find((c) => c.kart === r.kart)?.name ?? 'Kart ' + r.kart) : 'Transponder desconhecido',
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

  // conta de e-mail dos resultados (a senha nunca volta; vazia no PUT = mantém)
  if (path === '/api/email-config' && method === 'GET') return send(res, 200, configPublica(lerConfig(EMAIL_FILE)));
  if (path === '/api/email-config' && method === 'PUT') {
    try { return send(res, 200, configPublica(salvarConfig(EMAIL_FILE, await readBody(req)))); } catch (e) { return send(res, 400, { error: (e as Error).message }); }
  }
  if (path === '/api/email-config/teste' && method === 'POST') {
    const body = await readBody(req);
    try { await enviarTeste(EMAIL_FILE, String(body.para ?? ''), SIMULATE); log(`e-mail de teste enviado para ${String(body.para ?? '')}`); return send(res, 200, { ok: true }); }
    catch (e) { return send(res, 400, { error: `Não enviou: ${traduzirErro(e)}` }); }
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
  if (path === '/api/livetime-snapshot') return send(res, 200, liveSnapshot(url.searchParams.get('painel') === 'tb50'));
  if (path === '/api/tb50-page' && method === 'GET') return send(res, 200, tb50Page);
  if (path === '/api/tb50-ping') {
    const ip = (req.socket.remoteAddress ?? '').replace(/^::ffff:/, '');
    const ua = (url.searchParams.get('ua') ?? '').slice(0, 300);
    const anterior = tb50Pings.get(ip);
    if (!anterior || anterior.ua !== ua || Date.now() - anterior.at > 10 * 60_000) log(`telao TB50: pagina /tb50 viva em ${ip} (${url.searchParams.get('w')}x${url.searchParams.get('h')}) ${ua}`);
    tb50Pings.set(ip, { at: Date.now(), ua });
    return send(res, 200, { ok: true });
  }
  if (path === '/api/tb50-page' && (method === 'PUT' || method === 'POST')) {
    const body = await readBody(req);
    const offset = body.pagina !== undefined ? Number(body.pagina) * TB50_PAGE_SIZE : body.offset;
    return send(res, 200, setTb50Offset(offset, String(body.origem ?? 'cronometragem')));
  }

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
    // prova do catálogo que já tem bateria: abre a que existe (não cria outra igual)
    const prova = typeof body.proofId === 'string' && body.proofId ? catalog.provas.find((p) => p.id === body.proofId) : undefined;
    const jaExiste = prova ? [...sessions.values()].find((x) => x.proofId === prova.id && x.state !== 'cancelada') : undefined;
    if (jaExiste) return send(res, 200, sessionView(jaExiste));
    const s = createSession({
      id: `${hojeBrasilia()}-${randomUUID().slice(0, 8)}`,
      name: String(body.name ?? ''),
      type,
      durationMin: Number(body.durationMin ?? ((timingSettings.timing as Record<string, unknown> | undefined)?.defaultDurationMin ?? (type === 'corrida' ? 20 : type === 'classificacao' ? 5 : 10))),
      maxLaps: body.maxLaps ? Number(body.maxLaps) : null,
      minLapSec: body.minLapSec ? Number(body.minLapSec) : prova?.minLapSec ? prova.minLapSec : Number((timingSettings.timing as Record<string, unknown> | undefined)?.minimumLapSeconds ?? 5),
      now: Date.now(),
      competitors: parseCompetitors(body.competitors),
      eventId: typeof body.eventId === 'string' ? body.eventId : null,
      groupId: typeof body.groupId === 'string' ? body.groupId : null,
      proofId: typeof body.proofId === 'string' ? body.proofId : null,
      programaId: typeof body.programaId === 'string' && body.programaId ? body.programaId : null,
    });
    // bateria da agenda da recepção: guarda de qual horário veio (o app avisa antes de criar a mesma duas vezes)
    if (Number(body.agendaId) > 0) s.agendaId = Number(body.agendaId);
    if (prova?.agendaId && Number(prova.agendaId) > 0) {
      // prova do evento do dia (agenda da recepção): nome "BATERIA 18:00 · TOMADA DE TEMPO" e tomada/corrida ligadas
      s.agendaId = Number(prova.agendaId);
      s.programaId = `agenda-${prova.agendaId}`;
      const grupo = catalog.groups.find((g) => g.id === prova.groupId);
      if (grupo && (!s.name.trim() || s.name.trim() === prova.name)) s.name = `${grupo.name} · ${prova.name}`;
    }
    // sem sorteio no tablet a recepção não manda karts: a corrida herda os pilotos e karts digitados na tomada
    const herdada = herdarCompetidores(s);
    if (herdada) log(`${s.name}: ${s.competitors.length} pilotos e karts copiados de ${herdada.name}`);
    sessions.set(s.id, s);
    saveSession(s);
    log(`bateria criada ${s.name} (${s.type}) com ${s.competitors.length} pilotos${s.agendaId ? ` (agenda ${s.agendaId})` : ''}`);
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

  // ---------------------------------------------------------------- troca explícita de kart
  const swapRoute = path.match(/^\/api\/sessions\/([\w-]+)\/swap-kart$/);
  if (swapRoute && method === 'POST') {
    const s = sessions.get(swapRoute[1]);
    if (!s) return send(res, 404, { error: 'Bateria não encontrada.' });
    try {
      const body = await readBody(req);
      const troca = swapKart(s, {
        fromKart: String(body.fromKart ?? body.kartAtual ?? '').trim(),
        toKart: String(body.toKart ?? body.kartNovo ?? '').trim(),
        customerId: body.customerId == null ? undefined : String(body.customerId),
        name: body.name == null ? undefined : String(body.name),
        category: body.category == null ? undefined : String(body.category),
        detalhes: body.detalhes && typeof body.detalhes === 'object' ? body.detalhes as Record<string, unknown> : undefined,
      });
      registrarTrocas(s, [troca], 'explicit-swap');
      saveSession(s);
      scheduleStateBroadcast();
      return send(res, 200, { ok: true, troca, session: sessionView(s) });
    } catch (err) { return send(res, 400, { error: (err as Error).message }); }
  }

  // ---------------------------------------------------------------- registro de competidor (Competidor do canvas)
  const rc = path.match(/^\/api\/sessions\/([\w-]+)\/competitors\/(\d+)$/);
  if (rc && method === 'PUT') {
    const s = sessions.get(rc[1]);
    if (!s) return send(res, 404, { error: 'Bateria não encontrada.' });
    const i = Number(rc[2]);
    const atual = s.competitors[i];
    if (!atual) return send(res, 404, { error: 'Competidor não encontrado nessa bateria.' });
    const body = await readBody(req);
    const num = (v: unknown) => (v === '' || v == null || !Number.isFinite(Number(String(v).replace(',', '.'))) ? null : Number(String(v).replace(',', '.')));
    const txt = (v: unknown, max = 80) => String(v ?? '').trim().slice(0, max);
    const d = (body.detalhes ?? {}) as Record<string, unknown>;
    const detalhes = {
      sexo: txt(d.sexo, 20), iniciais: txt(d.iniciais, 6).toUpperCase(), email: txt(d.email, 160), patrocinador: txt(d.patrocinador), clube: txt(d.clube),
      cidade: txt(d.cidade), estado: txt(d.estado, 4).toUpperCase(), pais: txt(d.pais, 40), box: txt(d.box, 20),
      peso: num(d.peso), pesoIndumentaria: num(d.pesoIndumentaria), pesoLastro: num(d.pesoLastro), pontuacao: num(d.pontuacao),
      oculto: Boolean(d.oculto), equipe: Array.isArray(d.equipe) ? (d.equipe as unknown[]).map((x) => txt(x, 100)).slice(0, 6) : [],
    };
    const kart = typeof body.kart === 'string' ? body.kart.trim() : atual.kart;
    // o kart novo pode já estar na lista como "Kart 12" (passou na linha antes da troca): esse não conta
    // como outro piloto; as passagens dele vão para este competidor
    const nome = typeof body.name === 'string' && body.name.trim() ? body.name.trim() : atual.name;
    const categoria = body.category === undefined ? atual.category ?? null : (String(body.category ?? '').trim() || null);
    let trocas: TrocaDeKart[];
    try {
      trocas = kart !== atual.kart
        ? [swapKart(s, { fromKart: atual.kart, toKart: kart, customerId: atual.customerId ?? null, name: nome, category: categoria, detalhes })]
        : setCompetitors(s, s.competitors.map((c, j) => j === i
          ? { kart, name: nome, customerId: c.customerId ?? null, category: categoria, detalhes }
          : { kart: c.kart, name: c.name, customerId: c.customerId ?? null, category: c.category ?? null, detalhes: c.detalhes }));
    } catch (err) { return send(res, 400, { error: (err as Error).message }); }
    registrarTrocas(s, trocas, 'competitor-edit');
    saveSession(s);
    // "Aplicar alterações nas demais provas do grupo": o mesmo piloto nas outras provas do grupo/programa
    let outras = 0;
    if (body.aplicarGrupo) {
      const mesmo = (c: { customerId?: string | null; name: string }) => (atual.customerId ? String(c.customerId ?? '') === String(atual.customerId) : c.name.trim().toLowerCase() === atual.name.trim().toLowerCase());
      for (const x of sessions.values()) {
        if (x.id === s.id || !(mesmoPrograma(s, x) || (s.groupId && x.groupId === s.groupId))) continue;
        const k = x.competitors.findIndex(mesmo);
        if (k < 0) continue;
        const trocasGrupo = setCompetitors(x, x.competitors.map((c, j) => j === k
          ? { kart: x.state === 'preparando' ? kart : c.kart, name: nome, customerId: c.customerId ?? null, category: categoria, detalhes }
          : { kart: c.kart, name: c.name, customerId: c.customerId ?? null, category: c.category ?? null, detalhes: c.detalhes }));
        registrarTrocas(x, trocasGrupo, 'competitor-edit-group');
        saveSession(x); outras++;
      }
    }
    log(`competidor ${nome} (kart ${kart}) atualizado em ${s.name}${outras ? ` e em mais ${outras} prova(s)` : ''}`);
    scheduleStateBroadcast();
    return send(res, 200, { ok: true, outras, sessao: sessionView(s) });
  }

  // ---------------------------------------------------------------- ranking por peso (RankingPeso do canvas)
  if (path === '/api/ranking-peso' && method === 'GET') {
    const q = url.searchParams;
    const faixas = String(q.get('faixas') ?? '75,90').split(/[;, ]+/).map(Number).filter((n) => n > 0 && n < 400);
    const encerradas = [...sessions.values()].filter((x) => x.state === 'encerrada');
    const ids = [...new Set(encerradas.flatMap((x) => x.competitors.map((c) => c.customerId).filter(Boolean)))] as string[];
    const clientes = new Map<string, DadosPiloto>();
    for (let i = 0; i < ids.length; i += 200) {
      try {
        for (const c of (await opsGet(`/api/crono/clientes?ids=${encodeURIComponent(ids.slice(i, i + 200).join(','))}`)) as { id?: unknown; peso?: unknown; sexo?: string; email?: string; telefone?: string }[])
          clientes.set(String(c.id), { peso: Number(c.peso) > 0 ? Number(c.peso) : null, sexo: c.sexo ?? null, email: c.email ?? null, telefone: c.telefone ?? null });
      } catch { /* sem o servidor da operação: usa o peso digitado no registro do competidor */ }
    }
    const trilha = (x: Session) => trackIdDa(x);
    const sexo = q.get('sexo');
    const grupos = rankingPorPeso(encerradas, (cid) => (cid ? clientes.get(cid) ?? {} : {}), {
      top: Number(q.get('top') ?? 10), mes: q.get('mes') || null, de: q.get('de') || null, ate: q.get('ate') || null,
      minimoMs: Number(q.get('minimoMs') ?? 0) || null, sexo: sexo === 'M' || sexo === 'F' ? sexo : null, faixas,
      trackId: q.get('trackId') || null, categoria: q.get('categoria') || null, ignorarSegunda: q.get('ignorarSegunda') === '1',
    }, trilha);
    return send(res, 200, { faixas: tituloFaixas(faixas), grupos, pilotosComPeso: [...clientes.values()].filter((c) => c.peso).length });
  }

  // ---------------------------------------------------------------- equalização dos karts
  if (path === '/api/equalizacao/metas' && method === 'GET') {
    const tid = url.searchParams.get('trackId');
    const lista = metasTracado.filter((m) => tid === null || (m.trackId ?? '') === tid).sort((a, b) => b.quando - a.quando)
      .map((m) => ({ ...m, track: m.trackId ? catalog.tracks.find((t) => t.id === m.trackId)?.name ?? 'Traçado removido' : 'Traçado principal' }));
    return send(res, 200, { metas: lista, tracks: catalog.tracks });
  }
  if (path === '/api/equalizacao/metas' && method === 'POST') {
    // meta de tempo escolhida para um traçado (vale para as próximas equalizações no modo "meta fixa")
    const body = await readBody(req);
    const metaMs = segundosParaMs(body.metaSeg) ?? (Number(body.metaMs) > 0 ? Math.round(Number(body.metaMs)) : null);
    if (!metaMs) return send(res, 400, { error: 'Digite a meta de tempo do traçado em segundos (ex.: 52,395).' });
    const tid = body.trackId ? String(body.trackId) : null;
    if (tid && !catalog.tracks.some((t) => t.id === tid)) return send(res, 400, { error: 'Traçado não encontrado.' });
    const meta: MetaTracado = { id: randomUUID(), trackId: tid, metaMs, toleranciaMs: segundosParaMs(body.toleranciaSeg) ?? TOLERANCIA_PADRAO_MS, quando: Date.now(), origem: 'manual', autor: String(body.autor ?? 'Cronometragem').slice(0, 60) };
    metasTracado.push(meta); saveMetas();
    log(`equalização: meta de ${formatLap(metaMs)} para o traçado ${tid ? catalog.tracks.find((t) => t.id === tid)?.name : 'principal'}`);
    return send(res, 201, meta);
  }
  if (path === '/api/equalizacao' && method === 'GET') {
    const q = url.searchParams;
    const lista = [...sessions.values()].filter((s) => s.type === 'equalizacao' && s.state !== 'cancelada')
      .filter((s) => {
        const dia = dataBrasilia(s.startedAt ?? s.createdAt);
        if (q.get('de') && dia < String(q.get('de'))) return false;
        if (q.get('ate') && dia > String(q.get('ate'))) return false;
        if (q.get('trackId') && (trackIdDa(s) ?? '') !== q.get('trackId')) return false;
        return true;
      })
      .sort((a, b) => b.createdAt - a.createdAt).map(equalizacaoResumo);
    return send(res, 200, { equalizacoes: lista, tracks: catalog.tracks, trackPadrao: { name: 'Traçado principal', lengthMeters: defaultTrackLength() } });
  }
  if (path === '/api/equalizacao' && method === 'POST') {
    const body = await readBody(req);
    const tid = body.trackId ? String(body.trackId) : null;
    if (tid && !catalog.tracks.some((t) => t.id === tid)) return send(res, 400, { error: 'Traçado não encontrado.' });
    const referencias = [...new Set((Array.isArray(body.referencias) ? body.referencias : String(body.referencias ?? '').split(/[;, ]+/)).map((k: unknown) => String(k).trim().replace(/^0+(?=\d)/, '')).filter(Boolean))];
    if (referencias.length > 3) return send(res, 400, { error: 'Use 2 ou 3 karts referência.' });
    const agora = new Date();
    const quando = agora.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).replace(',', '');
    const cfgT = (timingSettings.timing as Record<string, unknown> | undefined) ?? {};
    const s = createSession({
      id: `${hojeBrasilia()}-${randomUUID().slice(0, 8)}`, name: String(body.nome ?? '').trim() || `Equalização ${quando}`, type: 'equalizacao',
      durationMin: 0, minLapSec: Number(cfgT.minimumLapSeconds ?? 5), now: Date.now(),
      competitors: [...referencias.map((k) => ({ kart: k, name: `Kart ${k} (referência)` })), ...parseCompetitors(body.karts).filter((c) => c.kart && !referencias.includes(c.kart))],
    });
    s.trackId = tid;
    s.equalizacao = {
      referencias, metaModo: body.metaModo === 'fixa' ? 'fixa' : 'referencia', metaFixaMs: segundosParaMs(body.metaSeg),
      toleranciaMs: segundosParaMs(body.toleranciaSeg) ?? TOLERANCIA_PADRAO_MS, mecanico: String(body.mecanico ?? '').trim().slice(0, 80), checklist: {}, redutores: {},
    };
    sessions.set(s.id, s);
    saveSession(s);
    log(`equalização criada: ${s.name} · ${trackDa(s).name} · referências ${referencias.join(', ') || '(nenhuma)'}`);
    scheduleStateBroadcast();
    return send(res, 201, equalizacaoDetalhe(s));
  }
  const eq = path.match(/^\/api\/equalizacao\/([\w-]+)(?:\/(karts|finalizar|reabrir)(?:\/([^/]+))?)?$/);
  if (eq) {
    const s = sessions.get(eq[1]);
    if (!s || s.type !== 'equalizacao') return send(res, 404, { error: 'Equalização não encontrada.' });
    const cfg = (s.equalizacao ??= {});
    try {
      if (!eq[2] && method === 'GET') return send(res, 200, equalizacaoDetalhe(s));
      if (!eq[2] && method === 'PATCH') {
        const body = await readBody(req);
        if (typeof body.nome === 'string' && body.nome.trim()) s.name = body.nome.trim();
        if (body.trackId !== undefined) {
          const tid = body.trackId ? String(body.trackId) : null;
          if (tid && !catalog.tracks.some((t) => t.id === tid)) return send(res, 400, { error: 'Traçado não encontrado.' });
          s.trackId = tid;
        }
        if (body.referencias !== undefined) {
          const refs = [...new Set((Array.isArray(body.referencias) ? body.referencias : String(body.referencias ?? '').split(/[;, ]+/)).map((k: unknown) => String(k).trim().replace(/^0+(?=\d)/, '')).filter(Boolean))];
          if (refs.length > 3) return send(res, 400, { error: 'Use 2 ou 3 karts referência.' });
          cfg.referencias = refs;
          // referência que ainda não está na lista entra (o kart aparece mesmo antes de passar na linha)
          const faltam = refs.filter((k) => !s.competitors.some((c) => c.kart === k));
          if (faltam.length) setCompetitors(s, [...s.competitors.map((c) => ({ kart: c.kart, name: c.name, customerId: c.customerId ?? null, category: c.category ?? null, detalhes: c.detalhes })), ...faltam.map((k) => ({ kart: k, name: `Kart ${k} (referência)` }))]);
        }
        if (body.metaModo !== undefined) cfg.metaModo = body.metaModo === 'fixa' ? 'fixa' : 'referencia';
        if (body.metaSeg !== undefined) cfg.metaFixaMs = segundosParaMs(body.metaSeg);
        if (body.toleranciaSeg !== undefined) cfg.toleranciaMs = segundosParaMs(body.toleranciaSeg) ?? TOLERANCIA_PADRAO_MS;
        if (typeof body.mecanico === 'string') cfg.mecanico = body.mecanico.trim().slice(0, 80);
        if (body.redutor && typeof body.redutor === 'object') {
          // correção do redutor de um bloco (null volta para o automático: bloco 1 = sem redutor, bloco 2 = redutor 1...)
          const r = body.redutor as { kart?: unknown; bloco?: unknown; redutor?: unknown };
          const kart = String(r.kart ?? ''); const bloco = String(Number(r.bloco));
          if (!kart || !(Number(r.bloco) >= 1)) return send(res, 400, { error: 'Informe o kart e o bloco.' });
          const doKart = ((cfg.redutores ??= {})[kart] ??= {});
          if (r.redutor === null || r.redutor === '' || r.redutor === undefined) delete doKart[bloco];
          else if (Number.isInteger(Number(r.redutor)) && Number(r.redutor) >= 0 && Number(r.redutor) <= 20) doKart[bloco] = Number(r.redutor);
          else return send(res, 400, { error: 'Redutor inválido (use 0 para sem redutor).' });
        }
      } else if (eq[2] === 'karts' && eq[3] && method === 'PUT') {
        // apontamentos da oficina para o kart: chassi, pneu, motor, embreagem, freio, observações e ação
        const kart = decodeURIComponent(eq[3]);
        const comp = s.competitors.find((c) => c.kart === kart);
        if (!comp) return send(res, 404, { error: 'Kart não encontrado nesta equalização.' });
        const body = await readBody(req);
        const entrada = (body.sistemas ?? {}) as Record<string, { status?: string; nota?: string }>;
        const sistemas: NonNullable<ChecklistKart['sistemas']> = {};
        for (const nome of SISTEMAS_KART) {
          const e = entrada[nome];
          if (!e) continue;
          const status = e.status === 'atencao' || e.status === 'critico' ? e.status : 'ok';
          sistemas[nome] = { status, ...(String(e.nota ?? '').trim() ? { nota: String(e.nota).trim().slice(0, 160) } : {}) };
        }
        (cfg.checklist ??= {})[kart] = {
          sistemas, observacoes: String(body.observacoes ?? '').trim().slice(0, 500), acaoOficina: String(body.acaoOficina ?? '').trim().slice(0, 200),
          atualizadoEm: Date.now(), autor: String(body.autor ?? 'Cronometragem').slice(0, 60),
        };
        if (typeof body.piloto === 'string' && body.piloto.trim()) comp.name = body.piloto.trim().slice(0, 80);
      } else if (eq[2] === 'finalizar' && method === 'POST') {
        if (s.state === 'preparando') return send(res, 409, { error: 'Esta equalização ainda não largou (dê a bandeira verde na Cronometragem).' });
        const agora = Date.now();
        if (s.state === 'em_andamento' || s.state === 'bandeira_final') { closeSession(s, agora); void enviarUsoKarts(s); }
        cfg.finalizadaEm = agora;
        // a meta que saiu desta equalização fica no histórico do traçado
        const r = calcularEqualizacao(s, configEqualizacao(s));
        metasTracado = metasTracado.filter((m) => m.sessionId !== s.id);
        if (r.metaMs) metasTracado.push({ id: randomUUID(), trackId: trackIdDa(s), metaMs: r.metaMs, toleranciaMs: r.toleranciaMs, quando: s.startedAt ?? agora, origem: 'equalizacao', sessionId: s.id, referencias: cfg.referencias ?? [] });
        saveMetas();
        registrarObservacao(s, `Equalização finalizada: meta ${r.metaMs ? formatLap(r.metaMs) : 'não definida'}, ${r.karts.filter((k) => k.status === 'EQUALIZADO').length} equalizado(s), ${r.karts.filter((k) => k.status === 'REVISAR').length} para revisar`, 'Cronometragem');
      } else if (eq[2] === 'reabrir' && method === 'POST') {
        cfg.finalizadaEm = null;
      } else return send(res, 404, { error: 'Ação desconhecida.' });
    } catch (err) { return send(res, 400, { error: (err as Error).message }); }
    saveSession(s);
    scheduleStateBroadcast();
    return send(res, 200, equalizacaoDetalhe(s));
  }

  // ---------------------------------------------------------------- ranking dos karts (histórico de tempo de cada kart)
  if (path === '/api/ranking-karts' && method === 'GET') {
    const q = url.searchParams;
    const data = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
    const tipos = String(q.get('tipos') ?? '').split(',').filter((t): t is SessionType => SESSION_TYPES.has(t as SessionType));
    const opcoes = { de: data(q.get('de')), ate: data(q.get('ate')), trackId: q.get('trackId') || null, tipos: tipos.length ? tipos : null, extensaoM: trackLengthFor };
    const kart = q.get('kart');
    if (kart) return send(res, 200, historicoDoKart(sessions.values(), kart, opcoes, trackIdDa, kartDaPassagem).map((h) => ({ ...h, piloto: nomeProprio(h.piloto) })));
    return send(res, 200, rankingKarts(sessions.values(), opcoes, trackIdDa, kartDaPassagem).map((r) => ({ ...r, melhorPiloto: nomeProprio(r.melhorPiloto) })));
  }

  // ---------------------------------------------------------------- sorteio de karts (tablet)
  const so = path.match(/^\/api\/sessions\/([\w-]+)\/sorteio$/);
  if (so) {
    const s = sessions.get(so[1]);
    if (!s) return send(res, 404, { error: 'Bateria não encontrada.' });
    if (method === 'GET') {
      const pilotos = pilotosDoSorteio(s, sessions.values(), mesmoPrograma);
      const pesos = new Map<string, number>();
      const ids = pilotos.map((p) => p.customerId).filter(Boolean).join(',');
      if (ids) {
        try {
          for (const c of (await opsGet(`/api/crono/clientes?ids=${encodeURIComponent(ids)}`)) as { id?: unknown; peso?: unknown }[]) {
            const peso = Number(c.peso);
            if (c.id != null && peso > 0) pesos.set(String(c.id), peso);
          }
        } catch { /* sem o servidor da operação o sorteio funciona sem o peso */ }
      }
      return send(res, 200, {
        sessao: { id: s.id, name: s.name, type: s.type, state: s.state, createdAt: s.createdAt, eventId: s.eventId ?? null },
        programa: [...sessions.values()].filter((x) => mesmoPrograma(s, x)).map((x) => ({ id: x.id, name: x.name, state: x.state })),
        tipoKart: await tipoKartDa(s),
        karts: kartsCadastrados(),
        pilotos: pilotos.map((p) => ({ ...p, pesoKg: p.customerId ? pesos.get(p.customerId) ?? null : null })),
      });
    }
    if (method === 'POST') {
      const body = await readBody(req);
      const atribuicoes = (Array.isArray(body.atribuicoes) ? body.atribuicoes : []) as Atribuicao[];
      try {
        validarSorteio(s, atribuicoes, new Set(kartsCadastrados()));
      } catch (err) { return send(res, 400, { error: (err as Error).message }); }
      const nomes = atribuicoes.map((a) => `${s.competitors[Number(a.indice)]?.name ?? '?'} → kart ${a.kart}`);
      setCompetitors(s, competidoresComSorteio(s, atribuicoes));
      const modo = descricaoModoSorteio(String(body.modo ?? ''));
      const texto = `Sorteio de karts no tablet (${modo}): ` + nomes.join('; ');
      (s.observations ??= []).push({ id: randomUUID(), text: texto, wallMs: Date.now(), author: 'Sorteio' });
      saveSession(s);
      log(`bateria ${s.name}: ${texto}`);
      for (const irma of sessions.values()) {
        if (mesmoPrograma(s, irma) && copiarCompetidores(irma, s)) { saveSession(irma); log(`competidores de ${s.name} copiados para ${irma.name}`); }
      }
      scheduleStateBroadcast();
      return send(res, 200, { ...sessionView(s), gravadoEm: Date.now() });
    }
  }

  // ---------------------------------------------------------------- advertências e penalidades de tempo (várias por piloto)
  const pen = path.match(/^\/api\/sessions\/([\w-]+)\/penalties\/([^/]+)(?:\/([\w-]+))?$/);
  if (pen && (method === 'POST' || method === 'DELETE')) {
    const s = sessions.get(pen[1]);
    if (!s) return send(res, 404, { error: 'Bateria não encontrada.' });
    const kart = decodeURIComponent(pen[2]);
    try {
      if (method === 'POST') {
        const body = await readBody(req);
        const tipo = String(body.tipo ?? '') === 'tempo' ? 'tempo' : String(body.tipo ?? '') === 'advertencia' ? 'advertencia' : null;
        if (!tipo) return send(res, 400, { error: 'Tipo de penalidade inválido.' });
        const autor = String(body.autor ?? 'Cronometragem').slice(0, 60);
        const { competitor, penalidade } = addPenalty(s, kart, {
          id: randomUUID(), tipo, segundos: body.segundos == null ? undefined : Number(String(body.segundos).replace(',', '.')),
          motivo: body.motivo == null ? undefined : String(body.motivo), wallMs: Date.now(), autor,
        });
        const motivo = penalidade.motivo ? ` · ${penalidade.motivo}` : '';
        registrarObservacao(s, `${textoPenalidade(penalidade)} · ${competitor.name} (kart ${competitor.kart})${motivo}`, autor);
      } else {
        if (!pen[3]) return send(res, 400, { error: 'Informe a penalidade.' });
        const { competitor, penalidade } = removePenalty(s, kart, pen[3]);
        registrarObservacao(s, `Retirada: ${textoPenalidade(penalidade).toLowerCase()} · ${competitor.name} (kart ${competitor.kart})`, 'Cronometragem');
      }
    } catch (err) { return send(res, 400, { error: (err as Error).message }); }
    saveSession(s);
    scheduleStateBroadcast();
    return send(res, 200, sessionView(s));
  }

  const m = path.match(/^\/api\/sessions\/([\w-]+)(?:\/(\w+))?(?:\/(\w+))?$/);
  if (m) {
    const s = sessions.get(m[1]);
    if (!s) return send(res, 404, { error: 'Bateria nao encontrada.' });
    const action = m[2];
    const now = Date.now();
    try {
      if (!action && method === 'GET') return send(res, 200, sessionView(s));
      if (action === 'emails' && !m[3] && method === 'GET') return send(res, 200, s.emailsResultado ?? null);
      if (action === 'emails' && !m[3] && method === 'POST') {
        // reenvio manual (menu da cronometragem): todos, só um kart, ou o resultado oficial para outro endereço
        const body = await readBody(req);
        if (s.state !== 'encerrada' && s.state !== 'bandeira_final') return send(res, 409, { error: 'Encerre a bateria antes de enviar o resultado.' });
        const kart = body.kart ? String(body.kart) : null;
        const para = body.para ? String(body.para) : null;
        if (!kart && !para) {
          // todos: um PDF + um e-mail por piloto pode passar de 1 min — vai em segundo plano, a tela acompanha pelo GET
          if (!lerConfig(EMAIL_FILE).senha && !SIMULATE) return send(res, 400, { error: 'E-mail não configurado: preencha a conta de e-mail do kartódromo em Ferramentas › E-mail dos resultados.' });
          void enviarResultado(s, EMAIL_FILE, depEmail, { automatico: false }).catch((e) => log(`e-mail do resultado de ${s.name}: ${(e as Error).message}`));
          return send(res, 202, { emSegundoPlano: true });
        }
        return send(res, 200, await enviarResultado(s, EMAIL_FILE, depEmail, { automatico: false, kart, para }));
      }
      if (action === 'laps' && !m[3] && method === 'GET') {
        return send(
          res,
          200,
          s.competitors.map((c) => {
            const ativas = c.crossings.filter((x) => !x.deleted).sort((a, b) => a.wallMs - b.wallMs);
            const laps = ativas.map((x, i) => ({ lap: i, lapMs: x.lapMs, invalid: Boolean(x.invalid), wallMs: x.wallMs, penalty: '' })).filter((x) => x.lapMs !== null);
            // advertência/penalidade aparece na volta em que foi dada (a primeira que fechou depois dela)
            for (const p of c.penalidades ?? []) {
              const volta = laps.find((l) => l.wallMs >= p.wallMs) ?? laps[laps.length - 1];
              const texto = textoPenalidade(p) + (p.motivo ? ` (${p.motivo})` : '');
              if (volta) volta.penalty = volta.penalty ? `${volta.penalty} · ${texto}` : texto;
            }
            return { kart: c.kart, name: c.name, laps };
          }),
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
        if (flag === 'green' && body.relargar && s.state !== 'preparando') {
          // relargada: as passagens de antes não contam e o cronômetro volta a zero até o 1º kart passar na linha
          relargar(s, now, String(body.autor ?? 'Cronometragem'));
          saveSession(s);
          scheduleStateBroadcast();
          return send(res, 200, sessionView(s));
        }
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
          registrarTrocas(s, setCompetitors(s, parseCompetitors(body.competitors)), 'competitor-list');
          // o número do kart digitado na tomada de tempo vale para a corrida da mesma bateria (e vice-versa),
          // enquanto a outra ainda não largou
          for (const irma of irmasDe(s)) {
            if (copiarCompetidores(irma, s)) {
              saveSession(irma);
              log(`competidores de ${s.name} copiados para ${irma.name}`);
            }
          }
        }
        if (typeof body.eventId === 'string' || body.eventId === null) s.eventId = body.eventId as string | null;
        if (typeof body.groupId === 'string' || body.groupId === null) s.groupId = body.groupId as string | null;
        if (typeof body.proofId === 'string' || body.proofId === null) s.proofId = body.proofId as string | null;
        if (body.trackId !== undefined) {
          const tid = body.trackId ? String(body.trackId) : null;
          if (tid && !catalog.tracks.some((t) => t.id === tid)) return send(res, 400, { error: 'Traçado não encontrado.' });
          s.trackId = tid;
          log(`bateria ${s.name}: traçado ${trackDa(s).name} (${trackDa(s).lengthMeters} m)`);
        }
      } else if (action === 'restart' && method === 'POST') {
        const body = await readBody(req);
        if (body.largar) {
          const other = runningSession();
          if (other && other.id !== s.id) return send(res, 409, { error: `Já existe bateria em andamento: ${other.name}. Encerre ela antes.` });
          relargar(s, now, String(body.autor ?? 'Cronometragem'));
        } else {
          restartSession(s);
          registrarObservacao(s, 'Bateria reiniciada: passagens, bandeiras e penalidades zeradas (as passagens continuam no diário)', String(body.autor ?? 'Cronometragem'));
        }
      } else if (action === 'start' && method === 'POST') {
        const other = runningSession();
        if (other && other.id !== s.id) return send(res, 409, { error: `Ja existe bateria em andamento: ${other.name}. Encerre ela antes.` });
        startSession(s, now);
        log(`bateria ${s.name}: BANDEIRA VERDE, aguardando o primeiro kart passar na linha`);
        setTb50Offset(0, 'bandeira verde');
      } else if (action === 'checkered' && method === 'POST') {
        setRaceFlag(s, 'checkered', now);
      } else if (action === 'close' && method === 'POST') {
        closeSession(s, now);
        void enviarUsoKarts(s);
        void emailsAoEncerrar(s);
      } else if (action === 'cancel' && method === 'POST') {
        cancelSession(s, now);
      } else if (action === 'flag' && m[3] && method === 'POST') {
        const body = await readBody(req);
        const competitor = s.competitors.find((item) => item.kart === m[3]);
        if (!competitor) return send(res, 404, { error: 'Competidor não encontrado.' });
        const flag = String(body.flag ?? '') as NonNullable<(typeof competitor)['flag']>;
        if (!['none', 'green', 'yellow', 'red', 'white', 'checkered', 'black', 'mechanical', 'warning', 'blue', 'penalty'].includes(flag)) return send(res, 400, { error: 'Bandeira inválida.' });
        const antes = competitor.flag ?? 'none';
        competitor.flag = flag;
        const quem = `${competitor.name} (kart ${competitor.kart})`;
        if (flag === 'black' && antes !== 'black') registrarObservacao(s, `Bandeira preta · ${quem} desclassificado, vai para o último lugar`, String(body.autor ?? 'Cronometragem'));
        else if (antes === 'black' && flag !== 'black') registrarObservacao(s, `Bandeira preta retirada · ${quem} volta à classificação`, String(body.autor ?? 'Cronometragem'));
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
  const prep = path.match(/^\/api\/agenda\/(\d+)\/preparar$/);
  if (prep && method === 'POST') {
    const agendaId = Number(prep[1]);
    const existentes = [...sessions.values()].filter((x) => x.agendaId === agendaId && x.state !== 'cancelada');
    if (existentes.length) return send(res, 200, existentes.map(sessionSummary));
    const body = await readBody(req);
    let grade: { nome?: string; clienteId?: unknown; kart?: string }[];
    let programa: { nome?: string; tipo?: string; tempoMin?: number; finalizacao?: string; voltasMax?: number; voltaMinimaSeg?: number }[] = [];
    try {
      grade = await opsGet(`/api/crono/baterias/${agendaId}/grid`);
      try { programa = await opsGet(`/api/crono/baterias/${agendaId}/programa`); } catch { programa = []; }
    } catch (err) { return send(res, 502, { error: `Agenda indisponível: ${(err as Error).message}` }); }
    if (!Array.isArray(grade) || !grade.length) return send(res, 400, { error: 'Essa bateria da agenda não tem inscritos.' });
    if (!Array.isArray(programa)) programa = [];
    const nome = String(body.nome ?? '').trim() || 'Bateria';
    const competitors = grade.map((g) => ({ kart: String(g.kart ?? '').trim(), name: String(g.nome ?? '').trim(), customerId: g.clienteId != null ? String(g.clienteId) : null, category: null }));
    const cfg = (timingSettings.timing as Record<string, unknown> | undefined) ?? {};
    const minimo = Number(cfg.minimumLapSeconds ?? 5);
    const tipo = (t?: string): SessionType => (t === 'treino' || t === 'classificacao' || t === 'corrida' ? t : 'corrida');
    const provas = programa.length > 1 ? programa : [programa[0] ?? { tipo: 'corrida', tempoMin: Number(cfg.defaultDurationMin ?? 20) }];
    const programaId = provas.length > 1 ? randomUUID().replace(/-/g, '') : null;
    const criadas = provas.map((p) => {
      const porVoltas = p.finalizacao === 'voltas';
      const s = createSession({
        id: `${hojeBrasilia()}-${randomUUID().slice(0, 8)}`,
        name: provas.length > 1 ? `${nome} · ${String(p.nome ?? '').trim() || tipo(p.tipo)}` : nome,
        type: tipo(p.tipo),
        durationMin: porVoltas ? 0 : Number(p.tempoMin ?? cfg.defaultDurationMin ?? 20),
        maxLaps: porVoltas && Number(p.voltasMax) > 0 ? Number(p.voltasMax) : null,
        minLapSec: Number(p.voltaMinimaSeg) > 0 ? Number(p.voltaMinimaSeg) : minimo,
        now: Date.now(),
        competitors,
        programaId,
      });
      s.agendaId = agendaId;
      sessions.set(s.id, s);
      saveSession(s);
      log(`bateria criada pelo tablet do sorteio: ${s.name} (${s.type}) com ${s.competitors.length} pilotos`);
      return s;
    });
    scheduleStateBroadcast();
    return send(res, 201, criadas.map(sessionSummary));
  }

  if (path === '/api/empresa' && method === 'GET') {
    try { return send(res, 200, await opsGet('/api/crono/empresa')); } catch (err) { return send(res, 502, { error: (err as Error).message }); }
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
  if (url.pathname === '/tb50') return sendFile(res, 'tb50.html');
  if (url.pathname.startsWith('/resultado/')) return sendFile(res, 'resultado.html');
  if (url.pathname === '/equalizacao' || url.pathname.startsWith('/equalizacao/')) return sendFile(res, 'equalizacao.html');
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
