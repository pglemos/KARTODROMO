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
import os from 'node:os';
import { appendFileSync, closeSync, copyFileSync, cpSync, createWriteStream, existsSync, fsyncSync, ftruncateSync, mkdirSync, openSync, readFileSync, readdirSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { format } from 'node:util';
import { chaveOperadorValida, clienteEhMaquinaOperadora } from '../lib/timing/operator-auth';
import { redigirEmails } from '../lib/timing/redact-pii';
import { DecoderClient, type DecoderProtocol } from '../lib/timing/decoder-client';
import { formatTrxPassing, type TrxPassing } from '../lib/timing/trx-parser';
import { mobileApiEndpoint } from '../lib/mobile-api-url';
import {
  acceptRejected,
  addPenalty,
  removePenalty,
  voltaAtualDoKart,
  restartSession,
  voltasCompletas,
  applyPassing,
  assignCrossing,
  cancelSession,
  clearCrossings,
  closeSession,
  timeIsUp,
  computeStandings,
  crossingIdsFromKartAtOrAfter,
  progressoNasPassagens,
  createSession,
  aguardandoLargada,
  copiarCompetidores,
  propagarTrocaKart,
  mesmoPrograma,
  elapsedMs,
  formatLap,
  includeManualPassing,
  remainingMs,
  setCompetitors,
  restoreCompetitor,
  setChuva,
  setManualPosition,
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
  type ObservationKind,
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
import { condicaoChuvaPeloTracado, dataBrasilia, historicoDoKart, rankingKarts } from '../lib/timing/ranking-karts';
import { calcularComAnteriores, retomarEqualizacao, validarFaixasRedutor, type FaixaRedutor, faixasDaRegra, importarKarts, REGRA_PADRAO, regraDa, SISTEMAS_KART, tempoVoltaParaMs, TOLERANCIA_PADRAO_MS, ultimaEqualizacaoPorKart, voltasNasBaterias, type ChecklistKart, type ConfigEqualizacao } from '../lib/timing/equalizacao';
import { nomeProprio } from '../lib/nomes';
import { configPublica, enviarEmailSimples, enviarResultado, enviarTeste, lerConfig, salvarConfig, semEmailAosPilotos, traduzirErro, verificarTransporteEmail, type Dependencias, type OpcoesEnvio } from './timing-email';
import { usoKartsDaSessao } from '../lib/timing/kart-fisico';
import { serializeMobilePublication } from '../lib/timing/mobile-results';
import type { ContextoProva, EmpresaEmail } from '../lib/timing/email-resultado';
import { competidoresComSorteio, descricaoModoSorteio, ListaMudouError, pilotosDoSorteio, validarSorteio, type Atribuicao } from '../lib/timing/sorteio';
import { normalizarPaginaPainel, PAINEL_LED_PAGE_SIZE } from '../lib/timing/painel-page';
import { assinaturaDoConteudo, conferirChave, extrairChave, filtrarVoltasPorKart, lerHashes, montarTransmissao, montarVoltas, type Transmissao, type VoltasTransmissao } from '../lib/timing/transmissao';

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

// Item 3: Rotação ativa de log timing.log (> 5MB) sem manter offset corrompido de cmd.exe
const TIMING_LOG_FILE = join(DATA_DIR, 'timing.log');

function log(...args: unknown[]) {
  const formatted = format(...args);
  const line = redigirEmails(`[${new Date().toISOString()}] ${formatted}`);
  console.log(line);
  try {
    appendFileSync(TIMING_LOG_FILE, line + '\n', 'utf8');
  } catch {
    // silencioso se o arquivo de log estiver em rotação
  }
}

function logTrocas(s: { name: string }, trocas: TrocaDeKart[]) {
  for (const t of trocas) {
    log(`bateria ${s.name}: TROCA DE KART ${t.nome} do kart ${t.de} para o ${t.para}, levou ${t.voltasLevadas} volta(s)` +
      (t.passagensJuntadas ? ` e juntou ${t.passagensJuntadas} passagem(ns) que o kart ${t.para} ja tinha` : ''));
  }
}

// ---------------------------------------------------------------- persistencia

function rotateTimingLogIfNeeded() {
  try {
    if (!existsSync(TIMING_LOG_FILE)) return;
    const stats = statSync(TIMING_LOG_FILE);
    if (stats.size > 5 * 1024 * 1024) {
      const now = new Date();
      const stamp = now.toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' }) + '-' + String(now.getHours()).padStart(2, '0') + String(now.getMinutes()).padStart(2, '0');
      const backup = join(DATA_DIR, `timing-${stamp}.log`);
      try {
        renameSync(TIMING_LOG_FILE, backup);
      } catch {
        copyFileSync(TIMING_LOG_FILE, backup);
        writeFileSync(TIMING_LOG_FILE, '', 'utf8');
      }
      // Mantém no máximo os 5 backups rotacionados mais recentes
      const rotated = readdirSync(DATA_DIR)
        .filter((f) => /^timing-\d{4}-\d{2}-\d{2}-.*\.log$/.test(f))
        .map((f) => ({ full: join(DATA_DIR, f), mtime: statSync(join(DATA_DIR, f)).mtimeMs }))
        .sort((a, b) => b.mtime - a.mtime);
      for (const old of rotated.slice(5)) {
        try { unlinkSync(old.full); } catch {}
      }
      log(`timing.log rotacionado (${(stats.size / 1024 / 1024).toFixed(1)} MB -> 0 MB; backup em ${backup})`);
    }
  } catch {
    // silencioso para não impactar operação
  }
}
setInterval(rotateTimingLogIfNeeded, 60_000).unref();

// Item 7 & 32: Escrita atômica com fsyncSync e recuperação contra locks temporários no Windows
function writeJsonAtomic(file: string, data: unknown) {
  const tmp = `${file}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2, 6)}.tmp`;
  const content = JSON.stringify(data, null, 1);
  const fd = openSync(tmp, 'w');
  try {
    writeFileSync(fd, content, 'utf8');
    try { fsyncSync(fd); } catch {}
  } finally {
    try { closeSync(fd); } catch {}
  }

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      renameSync(tmp, file);
      return;
    } catch (err: any) {
      if ((err?.code === 'EPERM' || err?.code === 'EBUSY') && attempt < 4) {
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 20 * (attempt + 1));
        continue;
      }
      try {
        copyFileSync(tmp, file);
        try { unlinkSync(tmp); } catch {}
        return;
      } catch (fallbackErr) {
        if (attempt === 4) {
          try { unlinkSync(tmp); } catch {}
          throw err;
        }
      }
    }
  }
}

function cleanOrphanTmpFiles(dir: string) {
  try {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) cleanOrphanTmpFiles(full);
      else if (entry.name.endsWith('.tmp')) {
        try { unlinkSync(full); } catch {}
      }
    }
  } catch {}
}
cleanOrphanTmpFiles(DATA_DIR);

// Item 8: Mutex de serialização por sessão para concorrência
const sessionLocks = new Map<string, Promise<void>>();
async function withSessionLock<T>(sessionId: string, action: () => Promise<T> | T): Promise<T> {
  const prev = sessionLocks.get(sessionId) ?? Promise.resolve();
  let resolveCurrent!: () => void;
  const current = new Promise<void>((r) => { resolveCurrent = r; });
  sessionLocks.set(sessionId, prev.then(() => current, () => current));
  try {
    await prev;
    return await action();
  } finally {
    resolveCurrent();
    if (sessionLocks.get(sessionId) === current) sessionLocks.delete(sessionId);
  }
}

// Item 12: Fila de sessões sujas (dirty queue) para retentativa de gravação
const dirtySessions = new Set<string>();

// Item 2 & 30: Particionamento de sessões em data/timing/sessions/YYYY-MM/ e poda de RAM em cold sessions
const sessions = new Map<string, Session>();
const sessionPaths = new Map<string, string>();

function sessionMonth(s: { createdAt?: number }) {
  return new Date(s.createdAt || Date.now()).toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' }).slice(0, 7);
}

function isOldColdSession(s: Session) {
  return (s.state === 'encerrada' || s.state === 'cancelada') && Date.now() - (s.finishedAt ?? s.createdAt) > 7 * 86_400_000;
}

function resolveSessionFilePath(s: Session): string {
  if (isOldColdSession(s)) {
    const ym = sessionMonth(s);
    const dir = join(SESSIONS_DIR, ym);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    return join(dir, `${s.id}.json`);
  }
  return join(SESSIONS_DIR, `${s.id}.json`);
}

function loadSessionsFromDisk() {
  const filesToLoad: string[] = [];
  for (const entry of readdirSync(SESSIONS_DIR, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith('.json')) {
      filesToLoad.push(join(SESSIONS_DIR, entry.name));
    } else if (entry.isDirectory() && /^\d{4}-\d{2}$/.test(entry.name)) {
      const sub = join(SESSIONS_DIR, entry.name);
      for (const subEntry of readdirSync(sub, { withFileTypes: true })) {
        if (subEntry.isFile() && subEntry.name.endsWith('.json')) {
          filesToLoad.push(join(sub, subEntry.name));
        }
      }
    }
  }

  for (const fullPath of filesToLoad) {
    try {
      const s = JSON.parse(readFileSync(fullPath, 'utf8')) as Session;
      sessions.set(s.id, s);
      sessionPaths.set(s.id, fullPath);
    } catch (err) {
      log('sessao ilegivel ignorada', fullPath, err);
    }
  }
}
loadSessionsFromDisk();

for (const session of sessions.values()) {
  session.currentFlag ??= session.state === 'em_andamento' ? 'green' : session.state === 'bandeira_final' ? 'checkered' : 'none';
  session.chuva ??= false;
  session.observations ??= [];
  for (const o of session.observations) o.id ??= randomUUID();
  session.competitors ??= [];
  for (const competitor of session.competitors) {
    competitor.crossings ??= [];
    competitor.flag ??= 'none';
    competitor.crossings.forEach((crossing) => { crossing.id ??= randomUUID(); crossing.source ??= 'decoder'; });
  }
  if (isOldColdSession(session)) {
    // Redução imediata de heap: sessões encerradas há mais de 7 dias não mantêm rejected em memória
    session.rejected = [];
  }
}

function saveSession(s: Session) {
  const targetPath = resolveSessionFilePath(s);
  try {
    writeJsonAtomic(targetPath, s);
    const previousPath = sessionPaths.get(s.id);
    if (previousPath && previousPath !== targetPath && existsSync(previousPath)) {
      try { unlinkSync(previousPath); } catch {}
    }
    sessionPaths.set(s.id, targetPath);
    dirtySessions.delete(s.id);
  } catch (err) {
    dirtySessions.add(s.id);
    log(`ERRO ao gravar bateria ${s.name} (${s.id}) no disco; retentando em segundo plano: ${(err as Error).message}`);
    throw err;
  }
}

function archiveOldSessions() {
  let arquivadas = 0;
  for (const s of sessions.values()) {
    if (!isOldColdSession(s)) continue;
    const target = resolveSessionFilePath(s);
    const current = sessionPaths.get(s.id);
    if (current && current !== target) {
      try {
        writeJsonAtomic(target, s);
        if (existsSync(current)) unlinkSync(current);
        sessionPaths.set(s.id, target);
        s.rejected = [];
        arquivadas++;
      } catch {}
    }
  }
  if (arquivadas > 0) log(`particionamento: ${arquivadas} bateria(s) arquivada(s) por ano/mês`);
}
setInterval(archiveOldSessions, 6 * 3_600_000).unref();
archiveOldSessions();

// Retentativa periódica das sessões com erro de disco (Item 12)
setInterval(() => {
  if (!dirtySessions.size) return;
  for (const id of [...dirtySessions]) {
    const s = sessions.get(id);
    if (!s) { dirtySessions.delete(id); continue; }
    try {
      saveSession(s);
      log(`bateria ${s.name} salva com sucesso no disco na retentativa`);
    } catch {}
  }
}, 3_000).unref();

let transponderMap: Record<string, string> = {};
function loadTransponders() {
  if (!existsSync(TRANSPONDERS_FILE)) return;
  transponderMap = (JSON.parse(readFileSync(TRANSPONDERS_FILE, 'utf8')) as { map: Record<string, string> }).map ?? {};
}
loadTransponders();

// Item 9: Catálogo com backup automático .bak e proteção contra reset acidental
const CATALOG_BAK_FILE = join(DATA_DIR, 'catalog.json.bak');
let catalog: TimingCatalog = emptyCatalog();
if (existsSync(CATALOG_FILE)) {
  try {
    catalog = normalizeCatalog(JSON.parse(readFileSync(CATALOG_FILE, 'utf8')));
    try { copyFileSync(CATALOG_FILE, CATALOG_BAK_FILE); } catch {}
  } catch (err) {
    let recuperado = false;
    if (existsSync(CATALOG_BAK_FILE)) {
      try {
        catalog = normalizeCatalog(JSON.parse(readFileSync(CATALOG_BAK_FILE, 'utf8')));
        log('catálogo principal ilegível; recuperado da cópia de segurança catalog.json.bak');
        recuperado = true;
      } catch {}
    }
    if (!recuperado) {
      const copia = CATALOG_FILE.replace(/\.json$/i, `.ilegivel-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
      try { copyFileSync(CATALOG_FILE, copia); } catch {}
      log(`cadastro de eventos ilegível; iniciando vazio (o arquivo original foi guardado em ${copia})`, err);
    }
  }
} else if (existsSync(CATALOG_BAK_FILE)) {
  try {
    catalog = normalizeCatalog(JSON.parse(readFileSync(CATALOG_BAK_FILE, 'utf8')));
    log('catálogo carregado da cópia de segurança catalog.json.bak');
  } catch {}
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

function saveCatalog() {
  if (existsSync(CATALOG_FILE)) {
    try { copyFileSync(CATALOG_FILE, CATALOG_BAK_FILE); } catch {}
  }
  writeJsonAtomic(CATALOG_FILE, catalog);
}
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

// Item 10: Stream assíncrono bufferizado para gravação do diário sem bloquear o event loop
let activeJournalDay = '';
let journalStream: ReturnType<typeof createWriteStream> | null = null;

function journal(entry: Record<string, unknown>) {
  const day = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
  const line = JSON.stringify(entry) + '\n';
  if (day !== activeJournalDay || !journalStream || journalStream.destroyed) {
    if (journalStream && !journalStream.destroyed) {
      try { journalStream.end(); } catch {}
    }
    activeJournalDay = day;
    journalStream = createWriteStream(join(JOURNAL_DIR, `${day}.jsonl`), { flags: 'a', encoding: 'utf8' });
  }
  journalStream.write(line);
}

type EntradaDiario = { wallMs: number; kart: string | null; transponder: number | null; decoderTimeMs: number; result: string };

/** Passagens do diário que caíram como "sem bateria" (kart conhecido, nenhuma bateria aberta) num intervalo. */
function passagensSemBateria(deMs: number, ateMs: number): EntradaDiario[] {
  const out: EntradaDiario[] = [];
  for (let t = deMs - 86_400_000; t <= ateMs + 86_400_000; t += 86_400_000) {
    const arq = join(JOURNAL_DIR, `${new Date(t).toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })}.jsonl`);
    if (!existsSync(arq)) continue;
    for (const linha of readFileSync(arq, 'utf8').split('\n')) {
      if (!linha.includes('"sem-bateria"')) continue;
      try {
        const e = JSON.parse(linha) as EntradaDiario;
        if (e.result === 'sem-bateria' && e.kart && e.wallMs >= deMs && e.wallMs <= ateMs) out.push(e);
      } catch { /* linha cortada */ }
    }
  }
  const vistos = new Set<string>();
  return out.sort((a, b) => a.wallMs - b.wallMs).filter((e) => { const k = `${e.wallMs}|${e.kart}`; if (vistos.has(k)) return false; vistos.add(k); return true; });
}

/** Resumo por kart das passagens "sem bateria" do intervalo (para o cronometrista conferir antes de remontar). */
function resumoSemBateria(s: Session, deMs: number, ateMs: number) {
  const daLista = new Set(s.competitors.map((c) => c.kart));
  const todas = passagensSemBateria(deMs, ateMs);
  const porKart = new Map<string, EntradaDiario[]>();
  for (const e of todas) { if (!porKart.has(e.kart!)) porKart.set(e.kart!, []); porKart.get(e.kart!)!.push(e); }
  return {
    de: deMs, ate: ateMs, passagens: todas.length,
    karts: [...porKart].map(([kart, v]) => ({ kart, naLista: daLista.has(kart), piloto: s.competitors.find((c) => c.kart === kart)?.name ?? null, passagens: v.length, primeira: v[0].wallMs, ultima: v[v.length - 1].wallMs }))
      .sort((a, b) => Number(b.naLista) - Number(a.naLista) || a.kart.localeCompare(b.kart, 'pt-BR', { numeric: true })),
  };
}

/**
 * Remonta a bateria que correu sem estar aberta: aplica, na ordem, as passagens "sem bateria" do intervalo como se a
 * verde tivesse sido dada antes da primeira. A quadriculada entra quando o tempo da prova acaba (cada kart termina na
 * passagem seguinte) e a bateria fica encerrada na última passagem. Só os karts da lista, salvo incluirOutros.
 */
function remontarPeloDiario(s: Session, deMs: number, ateMs: number, incluirOutros: boolean, autor: string) {
  if (s.state === 'em_andamento' || s.state === 'bandeira_final') throw new Error('A bateria está aberta: encerre antes de remontar.');
  if (s.competitors.some((c) => c.crossings.some((x) => !x.deleted))) throw new Error('Esta bateria já tem passagens. Use Reiniciar bateria antes de remontar pelo diário.');
  const daLista = new Set(s.competitors.map((c) => c.kart));
  const entradas = passagensSemBateria(deMs, ateMs).filter((e) => incluirOutros || daLista.has(e.kart!));
  if (!entradas.length) throw new Error('Não há passagens sem bateria dos karts desta lista nesse horário.');
  restartSession(s);
  startSession(s, entradas[0].wallMs - 1_000);
  let contadas = 0;
  for (const e of entradas) {
    const correndo = (s.state as Session['state']) === 'em_andamento'; // startSession acabou de abrir
    const tempoAcabou = correndo && s.durationMs > 0 && s.startedAt !== null && e.wallMs - s.startedAt >= s.durationMs;
    // corrida: a quadriculada é do LÍDER — a prova acaba quando ele cruza a linha depois do tempo e os outros terminam
    // na passagem seguinte. Tomada/treino: a bandeira sai quando o tempo acaba e cada kart fecha a volta que estava fazendo.
    if (tempoAcabou && s.type !== 'corrida') setRaceFlag(s, 'checkered', s.startedAt! + s.durationMs);
    if (applyPassing(s, { id: randomUUID(), kart: e.kart!, decoderTimeMs: e.decoderTimeMs, wallMs: e.wallMs, transponder: e.transponder, source: 'decoder' }) === 'counted') contadas++;
    // líder DEPOIS desta passagem (quem cruzou na frente nesta volta, mesmo que tenha ultrapassado agora)
    const liderFechando = tempoAcabou && s.type === 'corrida' && computeStandings(s)[0]?.kart === e.kart;
    if (liderFechando) {
      setRaceFlag(s, 'checkered', e.wallMs);
      const lider = s.competitors.find((c) => c.kart === e.kart);
      if (lider) lider.finished = true;
    }
  }
  closeSession(s, entradas[entradas.length - 1].wallMs + 1_000);
  s.usoKartsEnviado = false; // agora há voltas: os minutos de pista vão para a oficina
  const hora = (ms: number) => new Date(ms).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  registrarObservacao(s, `Resultado remontado pelo diário de passagens (${contadas} passagens de ${hora(entradas[0].wallMs)} a ${hora(entradas[entradas.length - 1].wallMs)}): a bateria não estava aberta durante a prova`, autor);
  return contadas;
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

function atualizarKartsNasProvasPreparadas(origem: Session, de: string, para: string, customerId?: string | null) {
  for (const destino of irmasDe(origem)) {
    try {
      if (!propagarTrocaKart(origem, destino, de, para, customerId)) continue;
      saveSession(destino);
      log(`troca de kart ${de} → ${para} de ${origem.name} aplicada em ${destino.name}`);
    } catch (err) {
      log(`troca de kart ${de} → ${para} não aplicada em ${destino.name}: ${(err as Error).message}`);
    }
  }
}

function registrarObservacao(s: Session, text: string, author: string, kind: ObservationKind = 'system') {
  (s.observations ??= []).unshift({ id: randomUUID(), text, wallMs: Date.now(), author, kind });
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

/**
 * Trocou o traçado da PROVA (Registro de prova): as baterias dela que ainda estavam com o traçado antigo da prova vão
 * junto. A bateria guarda o próprio traçado quando nasce da agenda e ele vale antes do da prova — sem isso o ranking
 * dos karts seguia mostrando "Normal" numa bateria corrida no Invertido (06/10). Traçado escolhido à mão na bateria fica.
 */
function levarTracadoDaProva(provaId: string, antes: string | null, depois: string | null) {
  if (antes === depois) return;
  for (const s of sessions.values()) {
    if (s.proofId !== provaId || s.state === 'cancelada' || (s.trackId ?? null) !== antes && s.trackId != null) continue;
    s.trackId = depois;
    aplicarCondicaoDoTracado(s);
    saveSession(s);
    log(`bateria ${s.name}: traçado ${trackDa(s).name} (veio da prova)`);
  }
  scheduleStateBroadcast();
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

/** Traçado com sufixo "(Chuva)" já informa a condição da pista da bateria. */
function aplicarCondicaoDoTracado(s: Session) {
  if (!s.chuva && condicaoChuvaPeloTracado(trackDa(s).name)) {
    s.chuva = true;
    return true;
  }
  return false;
}

/** Corrige sessões antigas criadas a partir de traçados de chuva antes da regra existir. */
function normalizarCondicoesDosTracados() {
  let corrigidas = 0;
  for (const s of sessions.values()) {
    if (!aplicarCondicaoDoTracado(s)) continue;
    saveSession(s);
    corrigidas++;
  }
  if (corrigidas) log(`condição de chuva sincronizada em ${corrigidas} bateria(s) pelo traçado`);
}

normalizarCondicoesDosTracados();

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
  // diário primeiro: é a fonte de verdade para remontar qualquer bateria. Falha de disco (arquivo preso pelo
  // antivírus, disco cheio) não pode perder a leitura nem derrubar o serviço no meio da prova.
  try {
    journal({ wallMs, raw: p.raw, transponder: p.transponder, kart, decoderTimeMs: p.decoderTimeMs, seq: p.sequence, sessionId: session?.id ?? null, result });
  } catch (err) { log(`ERRO ao gravar o diário de passagens (kart ${kart ?? '?'}): ${(err as Error).message}`); }
  if (session) {
    try { saveSession(session); }
    catch (err) { log(`ERRO ao gravar a bateria ${session.name} (a passagem está na memória e no diário): ${(err as Error).message}`); }
  }
  log(`passagem transponder ${p.transponder} -> kart ${kart ?? '?'} (${result})`);

  recentPassings.unshift({ id, wallMs, transponder: p.transponder, kart, result, lapMs, sessionId: session?.id ?? null });
  recentPassings.length = Math.min(recentPassings.length, 60);
  broadcast('passing', recentPassings[0]);
  // painéis de LED na hora (o piloto olha o tempo assim que cruza a linha); telas do operador em 20 ms
  enviarAosPaineis();
  scheduleStateBroadcast(20);
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
    semEmailPilotos: semEmailAosPilotos(s, nomeEventoDa(s)),
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
    chuva: s.chuva === true,
    track: trackDa(s),
    elapsedMs: elapsedMs(s, now),
    currentFlag: s.currentFlag ?? 'none',
    eventId: s.eventId ?? null,
    groupId: s.groupId ?? null,
    proofId: s.proofId ?? null,
    observations: s.observations ?? [],
    manualPositions: s.manualPositions ?? {},
    // nome próprio só na exibição (telão, resultado, operador): o cadastro vinha TUDO MAIÚSCULO ou tudo minúsculo
    competitors: s.competitors.map((c) => ({
      kart: c.kart, name: nomeProprio(c.name), customerId: c.customerId ?? null, category: c.category ?? null, flag: c.flag ?? 'none', autoAdded: Boolean(c.autoAdded), detalhes: c.detalhes ?? null,
      // já passou na linha nesta bateria (a lista de competidores fica amarela até o kart passar)
      passou: c.crossings.some((x) => !x.deleted),
      // volta em que o kart está agora (vai no texto padrão da advertência/penalidade)
      voltaAtual: voltaAtualDoKart(s, c),
      penalidades: c.penalidades ?? [],
    })),
    standings: computeStandings(s, trackLengthFor(s)).filter((r) => !s.competitors.find((c) => c.kart === r.kart && c.name === r.name)?.detalhes?.oculto).map((r) => ({ ...r, name: nomeProprio(r.name) })),
    excludedCompetitors: (s.excludedCompetitors ?? []).map((e) => ({ id: e.id, excludedAt: e.excludedAt, kart: e.competitor.kart, name: e.competitor.name })),
    passingsCount: s.competitors.reduce((acc, c) => acc + c.crossings.filter((x) => !x.deleted).length, 0),
    rejectedCount: (s.rejected ?? []).length,
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
    chuva: s.chuva === true,
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

// Item 16: Monitoramento de instâncias concorrentes do app do operador
const activeOperatorMachines = new Map<string, { machine: string; ip: string; lastSeenAt: number }>();
function recordOperatorMachine(req: http.IncomingMessage) {
  const machine = req.headers['x-client-machine'];
  if (machine && typeof machine === 'string' && machine.trim()) {
    const name = machine.trim().slice(0, 60);
    const ip = (req.socket.remoteAddress || '').replace(/^::ffff:/, '');
    activeOperatorMachines.set(name, { machine: name, ip, lastSeenAt: Date.now() });
  }
}
function activeOperatorsList(): string[] {
  const now = Date.now();
  const list: string[] = [];
  for (const [name, op] of activeOperatorMachines.entries()) {
    if (now - op.lastSeenAt <= 20_000) list.push(name);
    else activeOperatorMachines.delete(name);
  }
  return list;
}

function stateView() {
  const running = runningSession();
  const list = sortedSessions();
  // a bateria em foco: a que esta correndo, senao a proxima preparada HOJE, senao a ultima encerrada
  // (uma preparada esquecida de outro dia prendia o telao: em 30/09 o foco era o "Clube da Insonia" de 27/09)
  // Encerradas pela hora em que TERMINARAM (não pela criação): em 02/10 as baterias da noite foram criadas às 12:53 e
  // as equalizações depois, e o painel de LED voltava sempre para a equalização ao fim de cada bateria. Equalização é
  // interna da oficina: não vai para o telão nem para a montagem do grid.
  const fimDe = (s: Session) => s.finishedAt ?? s.startedAt ?? s.createdAt;
  const encerradas = list.filter((s) => s.state === 'encerrada' && s.type !== 'equalizacao').sort((a, b) => fimDe(b) - fimDe(a));
  // a próxima da agenda é a primeira preparada de hoje que não ficou para trás da última que já largou
  // (baterias preparadas e não usadas de manhã — ou de outro dia da agenda — prendiam o telão no 17:00)
  const preparadasHoje = list.filter((s) => s.state === 'preparando' && s.createdAt >= inicioDoDia()).sort((a, b) => horaDaProva(a).localeCompare(horaDaProva(b)) || a.createdAt - b.createdAt);
  const ultimaLargada = list.filter((s) => s.startedAt != null && s.startedAt >= inicioDoDia() && s.type !== 'equalizacao').sort((a, b) => b.startedAt! - a.startedAt!)[0];
  const focus =
    running ??
    // ordem do horário da agenda (as baterias que a agenda cria sozinha não podem pular na frente da próxima)
    (ultimaLargada ? preparadasHoje.find((s) => horaDaProva(s).localeCompare(horaDaProva(ultimaLargada)) > 0) : undefined) ??
    preparadasHoje[0] ??
    encerradas[0] ??
    null;
  const lastQualifying = encerradas.find((s) => s.type !== 'corrida');
  return {
    now: Date.now(),
    track: TRACK_NAME,
    decoder: decoderView(),
    runningId: running?.id ?? null,
    activeOperators: activeOperatorsList(),
    focus: focus ? sessionView(focus) : null,
    lastQualifying: lastQualifying ? sessionView(lastQualifying) : null,
    // painel de LED sem kart na pista: tomada encerrada = grid; corrida encerrada = segue com o resultado da corrida
    lastFinished: !running && encerradas[0] ? sessionView(encerradas[0]) : null,
    sessions: list.slice(0, 40).map(sessionSummary),
    recentPassings,
    tb50: {
      offset: tb50Page.offset,
      pageSize: TB50_PAGE_SIZE,
      updatedAt: tb50Page.updatedAt,
      telas: [...tb50Pings.entries()].map(([ip, p]) => ({ ip, ultimoSinalMs: Date.now() - p.at, navegador: p.ua })),
    },
    painelLed: {
      pagina: painelLedPage.pagina,
      pageSize: PAINEL_LED_PAGE_SIZE,
      updatedAt: painelLedPage.updatedAt,
      origem: painelLedPage.origem,
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

// ---------------------------------------------------------------- painel de LED físico (COM3 do ORBITS)
// O hardware fica no ORBITS, mas a página selecionada é compartilhada para que o CRONO1
// controle o mesmo painel sem tentar abrir uma porta serial que não existe nele.

const PAINEL_LED_PAGE_FILE = join(DATA_DIR, 'painel-led-page.json');
let painelLedPage: { pagina: number; updatedAt: string | null; origem: string } = {
  pagina: 0,
  updatedAt: null,
  origem: 'inicialização',
};
try {
  if (existsSync(PAINEL_LED_PAGE_FILE)) {
    const salvo = JSON.parse(readFileSync(PAINEL_LED_PAGE_FILE, 'utf8')) as Record<string, unknown>;
    painelLedPage = {
      pagina: normalizarPaginaPainel(salvo.pagina),
      updatedAt: typeof salvo.updatedAt === 'string' ? salvo.updatedAt : null,
      origem: typeof salvo.origem === 'string' && salvo.origem.trim() ? salvo.origem.slice(0, 80) : 'arquivo',
    };
  }
} catch {
  // arquivo ausente ou inválido: começa da primeira página
}

function setPainelLedPage(value: unknown, origem: string) {
  const pagina = normalizarPaginaPainel(value);
  if (pagina === painelLedPage.pagina && painelLedPage.updatedAt) return painelLedPage;
  painelLedPage = {
    pagina,
    updatedAt: new Date().toISOString(),
    origem: origem.trim().slice(0, 80) || 'cronometragem',
  };
  try { writeJsonAtomic(PAINEL_LED_PAGE_FILE, painelLedPage); } catch { /* continua em memória */ }
  log(`painel LED COM3: posições ${pagina * PAINEL_LED_PAGE_SIZE + 1}-${(pagina + 1) * PAINEL_LED_PAGE_SIZE} (${painelLedPage.origem})`);
  scheduleStateBroadcast();
  return painelLedPage;
}

// ---------------------------------------------------------------- transmissão ao vivo (parceiros, ex.: YouTube)
// Leitura com chave: GET /api/transmissao/v1/corrida (JSON) e /api/transmissao/v1/eventos (fluxo SSE).
// Fora da rede do kartódromo o parceiro lê do site: este servidor ENVIA o retrato para lá (sem abrir porta nenhuma).
// As chaves ficam só como SHA-256 em data/timing/transmissao.json (fora do Git). Documentação: docs/api-transmissao.md

const TRANSMISSAO_FILE = join(DATA_DIR, 'transmissao.json');
type ConfigTransmissao = { chavesSha256: string; publicarUrl: string; publicarChave: string };
let configTransmissao: ConfigTransmissao = { chavesSha256: '', publicarUrl: '', publicarChave: '' };
let configTransmissaoLidaEm = 0;

function lerConfigTransmissao(): ConfigTransmissao {
  if (Date.now() - configTransmissaoLidaEm < 5_000) return configTransmissao;
  configTransmissaoLidaEm = Date.now();
  let arquivo: Partial<ConfigTransmissao> = {};
  try {
    if (existsSync(TRANSMISSAO_FILE)) arquivo = JSON.parse(readFileSync(TRANSMISSAO_FILE, 'utf8'));
  } catch (err) {
    log('transmissão: data/timing/transmissao.json inválido', (err as Error).message);
  }
  configTransmissao = {
    chavesSha256: process.env.TRANSMISSAO_CHAVES_SHA256 || String(arquivo.chavesSha256 ?? ''),
    publicarUrl: process.env.TRANSMISSAO_PUBLICAR_URL || String(arquivo.publicarUrl ?? ''),
    publicarChave: process.env.TRANSMISSAO_PUBLICAR_CHAVE || String(arquivo.publicarChave ?? ''),
  };
  return configTransmissao;
}

/** A mesma bateria em foco da tela do operador; equalização é interna da oficina e não vai para a transmissão. */
function transmissaoAtual(): Transmissao {
  const foco = stateView().focus;
  if (foco && foco.type !== 'equalizacao') return montarTransmissao(foco);
  const ultima = ultimaEncerrada();
  return montarTransmissao(ultima ? sessionView(ultima) : null);
}

function voltasDaTransmissao(t: Transmissao): VoltasTransmissao {
  const s = t.bateria ? sessions.get(t.bateria.id) : undefined;
  return montarVoltas(t, (s?.competitors ?? []).map((c) => ({ kart: c.kart, nome: nomeProprio(c.name), crossings: c.crossings })));
}

const clientesTransmissao = new Set<http.ServerResponse>();
let ultimaTransmissao: { assinatura: string; dados: Transmissao } | null = null;
const publicacao = { emAndamento: false, assinaturaEnviada: '', enviadoEm: 0, ultimoOkEm: 0, ultimoErro: '', erroLogadoEm: 0, falhas: 0, proximaTentativaEm: 0 };
/** Passagem chega ao site em até meio segundo; o hub do site distribui na hora a quem está conectado. */
const INTERVALO_MINIMO_PUBLICACAO_MS = 500;

async function publicarTransmissao(t: Transmissao, voltas: VoltasTransmissao, assinatura: string) {
  const cfg = lerConfigTransmissao();
  if (!cfg.publicarUrl || !cfg.publicarChave || publicacao.emAndamento) return;
  publicacao.emAndamento = true;
  publicacao.enviadoEm = Date.now();
  try {
    const resposta = await fetch(cfg.publicarUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${cfg.publicarChave}` },
      // o volta a volta vai junto, num envio só; o site o separa em /corrida e /voltas
      body: JSON.stringify({ ...t, voltaAVolta: voltas.pilotos }),
      signal: AbortSignal.timeout(5_000),
    });
    if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
    if (publicacao.ultimoErro) log(`transmissão: envio ao site voltou a funcionar (falhava: ${publicacao.ultimoErro}${publicacao.falhas > 1 ? `, ${publicacao.falhas} tentativas` : ''})`);
    publicacao.falhas = 0;
    publicacao.proximaTentativaEm = 0;
    publicacao.assinaturaEnviada = assinatura;
    publicacao.ultimoOkEm = Date.now();
    publicacao.ultimoErro = '';
  } catch (err) {
    publicacao.ultimoErro = (err as Error).message;
    // espera crescente (1, 2, 4… até 30 s): antes tentava de novo a cada 250 ms e martelava o site enquanto ele falhava
    publicacao.falhas++;
    publicacao.proximaTentativaEm = Date.now() + Math.min(30_000, 1_000 * 2 ** Math.min(5, publicacao.falhas - 1));
    // o log registra no máximo 1x por minuto
    if (Date.now() - publicacao.erroLogadoEm > 60_000) {
      publicacao.erroLogadoEm = Date.now();
      log(`transmissão: não consegui enviar ao site (${publicacao.ultimoErro}); a cronometragem segue normal`);
    }
  } finally {
    publicacao.emAndamento = false;
  }
}

// a cada 250 ms: passagem/bandeira saem na hora; o relógio do retrato muda 1x por segundo
setInterval(() => {
  const cfg = lerConfigTransmissao();
  const publicando = Boolean(cfg.publicarUrl && cfg.publicarChave);
  if (!clientesTransmissao.size && !publicando) return;
  const t = transmissaoAtual();
  const voltas = voltasDaTransmissao(t);
  const voltasTexto = JSON.stringify(voltas.pilotos);
  // anular uma volta nem sempre muda a classificação: o volta a volta entra na comparação
  const assinatura = assinaturaDoConteudo(t) + voltasTexto;
  const mudou = assinatura !== ultimaTransmissao?.assinatura;
  ultimaTransmissao = { assinatura, dados: t };
  if (mudou) {
    const payload = `event: corrida\ndata: ${JSON.stringify(t)}\n\nevent: voltas\ndata: ${JSON.stringify(voltas)}\n\n`;
    for (const res of clientesTransmissao) res.write(payload);
  }
  // reenvia a cada 30 s mesmo parado: o site sabe que a cronometragem está viva (economiza pedidos no Cloudflare)
  const agora = Date.now();
  const podeEnviar = agora - publicacao.enviadoEm >= INTERVALO_MINIMO_PUBLICACAO_MS && agora >= publicacao.proximaTentativaEm;
  if (publicando && podeEnviar && (assinatura !== publicacao.assinaturaEnviada || agora - publicacao.enviadoEm > 30_000)) void publicarTransmissao(t, voltas, assinatura);
}, 250);
setInterval(() => {
  for (const res of clientesTransmissao) res.write(': ping\n\n');
}, 15_000);

async function rotaTransmissao(req: http.IncomingMessage, res: http.ServerResponse, url: URL) {
  if (req.method !== 'GET') return send(res, 405, { erro: 'Use GET.' });
  const aceitos = lerHashes(lerConfigTransmissao().chavesSha256);
  if (!aceitos.length) return send(res, 503, { erro: 'API de transmissão sem chave cadastrada neste servidor.' });
  const parceiro = await conferirChave(extrairChave((n) => (req.headers[n] as string | undefined) ?? null, url), aceitos);
  if (!parceiro) {
    log(`transmissão: chave recusada (${req.socket.remoteAddress ?? '?'} ${url.pathname})`);
    return send(res, 401, { erro: 'Chave ausente ou inválida. Envie no cabeçalho Authorization: Bearer <chave>.' }, { 'www-authenticate': 'Bearer' });
  }
  if (url.pathname === '/api/transmissao/v1/corrida') return send(res, 200, transmissaoAtual());
  if (url.pathname === '/api/transmissao/v1/voltas') return send(res, 200, filtrarVoltasPorKart(voltasDaTransmissao(transmissaoAtual()), url.searchParams.get('kart')));
  if (url.pathname === '/api/transmissao/v1/eventos') {
    res.writeHead(200, { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-store', connection: 'keep-alive', 'access-control-allow-origin': '*' });
    const inicial = transmissaoAtual();
    res.write(`retry: 2000\nevent: corrida\ndata: ${JSON.stringify(inicial)}\n\nevent: voltas\ndata: ${JSON.stringify(voltasDaTransmissao(inicial))}\n\n`);
    clientesTransmissao.add(res);
    log(`transmissão: ${parceiro} conectou no fluxo ao vivo (${req.socket.remoteAddress ?? '?'})`);
    req.on('close', () => clientesTransmissao.delete(res));
    return;
  }
  return send(res, 404, { erro: 'Rota desconhecida. Use /api/transmissao/v1/corrida, /api/transmissao/v1/voltas ou /api/transmissao/v1/eventos.' });
}

/** Situação da API de transmissão para o /healthz (sem chave nenhuma). */
function transmissaoStatus() {
  const cfg = lerConfigTransmissao();
  return {
    chavesCadastradas: lerHashes(cfg.chavesSha256).length,
    conexoesAoVivo: clientesTransmissao.size,
    enviandoAoSite: Boolean(cfg.publicarUrl && cfg.publicarChave),
    ultimoEnvioOkEm: publicacao.ultimoOkEm ? new Date(publicacao.ultimoOkEm).toISOString() : null,
    ultimoErro: publicacao.ultimoErro || null,
  };
}

/** Formato LiveTimingSnapshot (lib/livetime/types.ts) consumido pelo site, telao e TB50. */
/**
 * A última bateria que TERMINOU (pela hora do fim; equalização fica de fora). É o que o placar e o painel mostram
 * sem kart na pista: tomada encerrada = classificação para montar o grid; corrida encerrada = pódio (TB50) e o
 * resultado final (painel). Antes era a última CRIADA, e em 02/10 voltava sempre para a equalização do Edu.
 */
function ultimaEncerrada() {
  const fimDe = (s: Session) => s.finishedAt ?? s.startedAt ?? s.createdAt;
  return [...sessions.values()].filter((s) => s.state === 'encerrada' && s.type !== 'equalizacao').sort((a, b) => fimDe(b) - fimDe(a))[0] ?? null;
}

function liveSnapshot(painelTb50 = false) {
  const s = runningSession() ?? ultimaEncerrada();
  const updatedAt = new Date().toISOString();
  if (!s) return { status: 'empty', source: 'sql', updatedAt, trackName: TRACK_NAME, drivers: [] };
  const standings = computeStandings(s);
  return {
    status: OPEN_STATES.has(s.state) ? 'live' : 'finished',
    clearGrid: Boolean(OPEN_STATES.has(s.state) && !standings.some((r) => r.laps > 0)),
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
        // O placar/telão usam os quatro primeiros campos; o app também recebe o histórico
        // completo para abrir a volta a volta do piloto selecionado.
        .map((r) => {
          const c = s.competitors.find((competitor) => competitor.kart === r.kart);
          const ativas = c?.crossings.filter((x) => !x.deleted).sort((a, b) => a.wallMs - b.wallMs) ?? [];
          const lapTimes = ativas
            .map((crossing, index) => ({ crossing, number: index }))
            .filter(({ crossing, number }) => number > 0 && typeof crossing.lapMs === 'number' && Number.isFinite(crossing.lapMs) && crossing.lapMs > 0)
            .map(({ crossing, number }) => ({ number, time: formatLap(crossing.lapMs), timeMs: crossing.lapMs! }));
          return {
            position: r.position, kart: r.kart, name: r.name, time: formatLap(r.bestLapMs),
            laps: r.laps, last: formatLap(r.lastLapMs), bestLap: r.bestLapNumber,
            gap: r.position === 1 ? '' : r.gapLaps > 0 ? `+${r.gapLaps} ${r.gapLaps === 1 ? 'volta' : 'voltas'}` : r.gapMs != null ? `+${(r.gapMs / 1000).toFixed(3)}` : '',
            lapTimes,
          };
        }),
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

let stateTimerAte = 0;

/** Junta mudanças próximas num aviso só. Passagem de kart pede aviso quase imediato (20 ms): os painéis de LED do
 * piloto (TB50 e o placar 1–10 da COM3) dependem disso; o resto (cadastros, relógio) pode esperar 150 ms. */
function scheduleStateBroadcast(esperaMs = 150) {
  const ate = Date.now() + esperaMs;
  if (stateTimer && stateTimerAte <= ate) return;
  if (stateTimer) clearTimeout(stateTimer);
  stateTimerAte = ate;
  stateTimer = setTimeout(() => {
    stateTimer = null;
    if (clients.size) broadcast('state', stateView());
    enviarAosPaineis();
  }, esperaMs);
}

// cronometro na tela anda mesmo sem passagem
setInterval(() => {
  if ((clients.size || clientesPainel.size) && runningSession()) scheduleStateBroadcast();
}, 1_000);
setInterval(() => {
  for (const res of clients) res.write(': ping\n\n');
  for (const c of clientesPainel) c.res.write(': ping\n\n');
}, 15_000);

// ---------------------------------------------------------------- fluxo para os painéis de LED (TB50)
// O TB50 perguntava o placar 1x por segundo: o piloto via o tempo até ~1,5 s depois de passar na linha. Agora a página
// abre GET /api/livetime-snapshot/eventos?painel=tb50 e recebe o retrato no instante da passagem.

type ClientePainel = { res: http.ServerResponse; tb50: boolean; ultimo: string };
const clientesPainel = new Set<ClientePainel>();

function enviarAosPaineis() {
  if (!clientesPainel.size) return;
  const prontos = new Map<boolean, { texto: string; semHora: string }>();
  for (const c of clientesPainel) {
    let r = prontos.get(c.tb50);
    if (!r) {
      const texto = JSON.stringify(liveSnapshot(c.tb50));
      // o carimbo de hora muda sempre; só manda quando o placar mudou de verdade
      r = { texto, semHora: texto.replace(/"updatedAt":"[^"]*",?/, '') };
      prontos.set(c.tb50, r);
    }
    if (r.semHora === c.ultimo) continue;
    c.ultimo = r.semHora;
    c.res.write(`event: snapshot\ndata: ${r.texto}\n\n`);
  }
}

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
function saveMetas() { writeJsonAtomic(METAS_FILE, metasTracado); }

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

const META_INVALIDA = 'Digite a meta de tempo como minutos:segundos:milésimos (ex.: 01:14:000).';

/** "0,1", "+0,3" ou "−0,2" (mm) → número com 2 casas; null se não for número. */
function milimetros(v: unknown) {
  const n = Number(String(v ?? '').trim().replace(',', '.').replace('−', '-'));
  return String(v ?? '').trim() !== '' && Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

// Regra do redutor por tipo de kart (editável): até a tolerância = equalizado; a cada faixa de diferença, um passo em mm.
type RegraSalva = { faixasPersonalizadas?: FaixaRedutor[] | null; id: string; nome: string; toleranciaMs: number; faixaMs: number; passoMm: number; limiteMs?: number | null; faixa2Ms?: number | null; passo2Mm?: number | null; atualizadoEm?: number; autor?: string };

/**
 * 2ª faixa da regra (acima de limiteSeg, "a cada faixa2Seg, passo2Mm"). limiteSeg vazio/0 = desliga.
 * Campo que não veio no pedido mantém o anterior (undefined).
 */
function segundaFaixaDoPedido(body: Record<string, unknown>, toleranciaMs: number, anterior?: { limiteMs?: number | null; faixa2Ms?: number | null; passo2Mm?: number | null } | null) {
  if (body.limiteSeg === undefined && body.faixa2Seg === undefined && body.passo2Mm === undefined)
    return { limiteMs: anterior?.limiteMs ?? null, faixa2Ms: anterior?.faixa2Ms ?? null, passo2Mm: anterior?.passo2Mm ?? null };
  const limiteMs = segundosParaMs(body.limiteSeg);
  if (!limiteMs) return { limiteMs: null, faixa2Ms: null, passo2Mm: null };
  const faixa2Ms = segundosParaMs(body.faixa2Seg); const passo2Mm = milimetros(body.passo2Mm);
  if (limiteMs <= toleranciaMs || limiteMs > 60_000) throw new Error('O limite da 2ª faixa tem que ser maior que a tolerância (ex.: 2,000 s).');
  if (!faixa2Ms || faixa2Ms < 10 || faixa2Ms > 10_000) throw new Error('2ª faixa: digite de quantos em quantos segundos muda o redutor acima do limite (ex.: 0,500).');
  if (!passo2Mm || passo2Mm <= 0 || passo2Mm > 5) throw new Error('2ª faixa: digite quantos milímetros abrir ou fechar a cada faixa acima do limite (ex.: 0,1).');
  return { limiteMs, faixa2Ms, passo2Mm };
}
const REGRAS_FILE = join(DATA_DIR, 'equalizacao-regras.json');
let regrasRedutor: RegraSalva[] = (() => {
  try { const j = JSON.parse(readFileSync(REGRAS_FILE, 'utf8')) as unknown; if (Array.isArray(j) && j.length) return j as RegraSalva[]; } catch { /* primeira vez: vale a regra padrão */ }
  return [{ id: 'kart-indoor', ...REGRA_PADRAO }];
})();
function saveRegras() { writeJsonAtomic(REGRAS_FILE, regrasRedutor); }
const regraView = (r: RegraSalva) => ({ ...r, faixas: faixasDaRegra(r, 5) });
/** Regra pelo id ou pelo nome do tipo de kart; sem achar, a primeira (Kart Indoor). */
function regraSalva(chave: unknown) {
  const k = String(chave ?? '').trim().toLowerCase();
  return regrasRedutor.find((r) => r.id === k || r.nome.toLowerCase() === k) ?? regrasRedutor[0];
}

/** Tolerância, faixa e passo vindos da tela (segundos e mm); o que faltar vem da regra do tipo de kart. */
function regraDoPedido(body: Record<string, unknown>, atual?: ConfigEqualizacao) {
  const base = body.regra !== undefined || !atual ? regraSalva(body.regra) : null;
  const faixaMs = segundosParaMs(body.faixaSeg) ?? base?.faixaMs ?? atual?.faixaMs ?? REGRA_PADRAO.faixaMs;
  const passoMm = milimetros(body.passoMm) ?? base?.passoMm ?? atual?.passoMm ?? REGRA_PADRAO.passoMm;
  const toleranciaMs = segundosParaMs(body.toleranciaSeg) ?? base?.toleranciaMs ?? atual?.toleranciaMs ?? REGRA_PADRAO.toleranciaMs;
  if (faixaMs < 10 || faixaMs > 10_000) throw new Error('A faixa de tempo da regra do redutor deve ficar entre 0,010 e 10 segundos.');
  if (!(passoMm > 0) || passoMm > 5) throw new Error('O passo do redutor deve ficar entre 0,01 e 5 mm.');
  // 2ª faixa: a da tela; sem ela, a do tipo de kart escolhido (ou a que a equalização já tinha)
  const faixa2 = segundaFaixaDoPedido(body, toleranciaMs, base ?? atual);
  return { regraNome: base?.nome ?? atual?.regraNome ?? REGRA_PADRAO.nome, toleranciaMs, faixaMs, passoMm, ...faixa2, faixasPersonalizadas: validarFaixasRedutor(body.faixasPersonalizadas === undefined ? (base ?? atual)?.faixasPersonalizadas : body.faixasPersonalizadas, toleranciaMs) };
}

/** Configuração usada na conta: no modo "meta fixa" sem valor digitado vale a última meta do traçado. */
function configEqualizacao(s: Session): ConfigEqualizacao {
  const cfg = s.equalizacao ?? {};
  if (cfg.metaModo === 'fixa' && !(Number(cfg.metaFixaMs) > 0)) return { ...cfg, metaFixaMs: metaVigente(trackIdDa(s), s.startedAt ?? s.createdAt)?.metaMs ?? null };
  return cfg;
}

/** Resultado da equalização já com o que ficou pendente (REVISAR) nas anteriores. */
const resultadoEqualizacao = (s: Session) => calcularComAnteriores(s, sessions.values(), configEqualizacao);

function equalizacaoResumo(s: Session) {
  const r = resultadoEqualizacao(s);
  const testados = r.karts.filter((k) => !k.referencia);
  return {
    id: s.id, name: s.name, state: s.state, createdAt: s.createdAt, startedAt: s.startedAt, finishedAt: s.finishedAt,
    finalizadaEm: s.equalizacao?.finalizadaEm ?? null, track: trackDa(s), mecanico: s.equalizacao?.mecanico ?? '',
    metaMs: r.metaMs, metaOrigem: r.metaOrigem, toleranciaMs: r.toleranciaMs, regra: { ...r.regra, faixas: faixasDaRegra(r.regra, 5) }, referencias: s.equalizacao?.referencias ?? [],
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
    config: {
      metaModo: cfg.metaModo ?? 'referencia', metaFixaMs: cfg.metaFixaMs ?? null, referencias: cfg.referencias ?? [], mecanico: cfg.mecanico ?? '', trackId: s.trackId ?? null,
      ...(({ nome, ...r }) => ({ regraNome: nome, ...r }))(regraDa(cfg)), aberturas: cfg.aberturas ?? {}, redutorInicialMm: cfg.redutorInicialMm ?? {},
    },
    metaDoTracado: metaVigente(trackIdDa(s), s.startedAt ?? s.createdAt),
    resultado: (() => { const r = resultadoEqualizacao(s); return { ...r, karts: r.karts.map((k) => ({ ...k, piloto: nomeProprio(k.piloto) })) }; })(),
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

async function mobilePublishPermission(token: string) {
  return fetch(`${OPS_URL}/api/office/mobile-permissions/resultados_publicar_mobile`, {
    headers: { authorization: `Bearer ${token}`, 'x-ops-key': process.env.OPS_RECEPCAO_KEY || '' },
    signal: AbortSignal.timeout(6000),
  });
}

/**
 * Horas de uso dos karts para a oficina (Manutenções no Módulo Office): ao encerrar a bateria manda quantos minutos
 * cada kart ficou na pista (da primeira à última passagem). Uma vez por bateria; se o servidor da operação estiver
 * fora, tenta de novo a cada 5 minutos (baterias dos últimos 2 dias).
 */
const usoKartsEmEnvio = new Set<string>();
async function enviarUsoKarts(s: Session) {
  // simulador (testes) nunca grava horas de uso de mentira no controle da oficina de verdade
  if (SIMULATE || s.usoKartsEnviado || s.state !== 'encerrada') return;
  // um envio por vez por bateria: o envio ao encerrar e a nova tentativa de 5 em 5 min não podem somar duas vezes
  if (usoKartsEmEnvio.has(s.id)) return;
  // por kart FÍSICO: com troca de kart cada um fica com o tempo em que esteve na pista
  const karts = usoKartsDaSessao(s);
  if (!karts.length) { s.usoKartsEnviado = true; saveSession(s); return; }
  usoKartsEmEnvio.add(s.id);
  try {
    const r = await fetch(OPS_URL + '/api/crono/uso-karts', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-ops-key': process.env.OPS_RECEPCAO_KEY || '' },
      // sem a bateria da agenda não se sabe a categoria (Indoor/Super Kart têm karts com o mesmo número)
      body: JSON.stringify({ sessaoId: s.id, agendaId: await agendaIdDa(s), karts }),
      // 8 s era pouco: o servidor somava, a resposta chegava atrasada e a nova tentativa somava de novo
      signal: AbortSignal.timeout(60_000),
    });
    const d = (await r.json().catch(() => ({}))) as { somados?: number; criados?: number; ignorados?: number; categoria?: string | null; error?: string };
    if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
    s.usoKartsEnviado = true;
    saveSession(s);
    log(`uso dos karts de ${s.name} enviado para a oficina: ${karts.length} karts, ${d.somados ?? 0} controles somados, ${d.criados ?? 0} novos, ${d.ignorados ?? 0} sem controle (${d.categoria ?? 'sem categoria'})`);
  } catch (err) {
    log(`uso dos karts de ${s.name} não foi enviado (tenta de novo): ${(err as Error).message}`);
  } finally {
    usoKartsEmEnvio.delete(s.id);
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
  const classificacao = computeStandings(s, trackLengthFor(s))
    .filter((r) => !r.autoAdded || r.laps > 0)
    .filter((r) => !s.competitors.find((c) => c.kart === r.kart && c.name === r.name)?.detalhes?.oculto);
  const penalidades = s.competitors.flatMap((c) => [
    ...(c.flag === 'black' ? [{ kart: c.kart, nome: c.name, flag: 'black', wallMs: s.finishedAt ?? s.createdAt }] : []),
    ...(c.penalidades ?? []).map((p) => ({
      kart: c.kart,
      nome: c.name,
      tipo: p.tipo,
      segundos: p.segundos,
      texto: p.texto,
      motivo: p.motivo,
      wallMs: p.wallMs,
    })),
  ]);
  return {
    empresa: await empresaParaEmail(),
    evento: evento?.name ?? null,
    grupo: grupo?.name ?? (i > 0 ? s.name.slice(0, i) : null),
    prova: prova?.name ?? (i > 0 ? s.name.slice(i + 3) : s.name),
    tipo: s.type,
    tracado: pista?.name ?? null,
    quando: s.startedAt ?? s.finishedAt ?? s.createdAt,
    classificacao,
    observacoes: s.observations ?? [],
    penalidades,
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

/**
 * Um envio de e-mail por vez em cada bateria. Dois cliques em "Enviar a todos" (ou o automático junto com o manual)
 * mandavam o resultado em dobro para cada piloto e disputavam os mesmos PDFs temporários.
 */
const filaEmails = new Map<string, Promise<void>>();
// Item 14: Redução do limite de bloqueio de 30 min para 3 min por envio
const LIMITE_ENVIO_EMAILS_MS = 3 * 60_000;
const envioATodosAtivo = new Set<string>();

// Item 13: Fila de e-mails persistida em disco (pending-emails.json) contra perda em reinicializações
const PENDING_EMAILS_FILE = join(DATA_DIR, 'pending-emails.json');
type JobEmailPendente = { sessionId: string; agendadoPara: number; tentativas: number };
let jobsEmailsPendentes: JobEmailPendente[] = [];
function carregarJobsEmails() {
  if (existsSync(PENDING_EMAILS_FILE)) {
    try {
      const dados = JSON.parse(readFileSync(PENDING_EMAILS_FILE, 'utf8')) as unknown;
      if (!Array.isArray(dados) || dados.some((j) => !j || typeof j.sessionId !== 'string' || !Number.isFinite(j.agendadoPara) || !Number.isInteger(j.tentativas))) throw new Error('esquema inválido');
      jobsEmailsPendentes = dados as JobEmailPendente[];
    } catch (e) {
      const quarentena = `${PENDING_EMAILS_FILE}.corrompido-${Date.now()}`;
      try { renameSync(PENDING_EMAILS_FILE, quarentena); } catch {}
      log(`ERRO: fila de e-mails inválida; arquivo preservado para diagnóstico em ${quarentena}: ${(e as Error).message}`);
      jobsEmailsPendentes = [];
    }
  }
}
function salvarJobsEmails() {
  try {
    writeJsonAtomic(PENDING_EMAILS_FILE, jobsEmailsPendentes);
  } catch (e) { log(`ERRO ao persistir fila de e-mails (${PENDING_EMAILS_FILE}): ${(e as Error).message}`); }
}
carregarJobsEmails();

function registrarJobEmail(sessionId: string, agendadoPara: number) {
  jobsEmailsPendentes = jobsEmailsPendentes.filter((j) => j.sessionId !== sessionId);
  jobsEmailsPendentes.push({ sessionId, agendadoPara, tentativas: 0 });
  salvarJobsEmails();
}
function concluirJobEmail(sessionId: string) {
  jobsEmailsPendentes = jobsEmailsPendentes.filter((j) => j.sessionId !== sessionId);
  salvarJobsEmails();
}

function enviarResultadoEmFila(s: Session, op: OpcoesEnvio) {
  const aTodos = !op.kart && !op.para;
  if (aTodos) envioATodosAtivo.add(s.id);
  let iniciar!: () => void;
  let trabalhoReal: Promise<void> = Promise.resolve();
  const iniciou = new Promise<void>((resolve) => { iniciar = resolve; });
  const tarefa = () => {
    const trabalho = enviarResultado(s, EMAIL_FILE, depEmail, op);
    trabalhoReal = trabalho.then(() => undefined, () => undefined);
    iniciar();
    let timer: NodeJS.Timeout | undefined;
    const limite = new Promise<never>((_, falhar) => {
      timer = setTimeout(() => falhar(new Error('o envio atingiu o tempo limite de 3 min; tentando de novo no próximo ciclo')), LIMITE_ENVIO_EMAILS_MS);
    });
    // A resposta pode expirar para o chamador, mas a fila permanece ocupada até o trabalho real terminar.
    // Isso impede que a tentativa seguinte envie duplicatas enquanto um SMTP/PDF antigo ainda executa.
    void trabalho.finally(() => clearTimeout(timer)).catch(() => undefined);
    return Promise.race([trabalho, limite]);
  };
  const anterior = filaEmails.get(s.id) ?? Promise.resolve();
  const atual = anterior.then(tarefa, tarefa);
  const marca = atual.then(() => undefined, () => undefined);
  // Em timeout, atual já rejeitou mas o trabalho SMTP continua. Mantemos uma trava até sua liquidação real.
  const bloqueio: Promise<void> = Promise.all([marca, iniciou.then(() => trabalhoReal)]).then(() => undefined);
  filaEmails.set(s.id, bloqueio);
  void bloqueio.then(() => {
    if (aTodos) envioATodosAtivo.delete(s.id);
    if (filaEmails.get(s.id) === bloqueio) filaEmails.delete(s.id);
  });
  return atual;
}

/** Disparo do encerramento: só tomada de tempo e corrida, com voltas; nunca derruba o servidor. */
function nomeEventoDa(s: Session) {
  const prova = catalog.provas.find((p) => p.id === s.proofId);
  return catalog.events.find((e) => e.id === (s.eventId ?? prova?.eventId))?.name ?? '';
}

async function emailsAoEncerrar(s: Session) {
  if (s.state !== 'encerrada' || !['classificacao', 'corrida'].includes(s.type)) return;
  if (!s.competitors.some((c) => c.crossings.some((x) => !x.deleted && x.lapMs != null))) return; // bateria sem volta nenhuma
  if (envioATodosAtivo.has(s.id)) return; // já está mandando para todos (a próxima tentativa confere quem faltou)
  try {
    await enviarResultadoEmFila(s, { automatico: true, nomeEvento: nomeEventoDa(s), assinaturaResultado: assinaturaResultado(s) });
  } catch (err) {
    const erro = (err as Error).message;
    const tentativas = (s.emailsResultado?.tentativas ?? 0) + 1;
    s.emailsResultado = { status: 'falhou', atualizadoEm: Date.now(), tentativas, proximaTentativaEm: Date.now() + Math.min(30 * 60_000, 60_000 * 2 ** Math.min(tentativas - 1, 5)) + Math.floor(Math.random() * 30_000), enviados: s.emailsResultado?.enviados ?? [], falhas: [{ kart: '', nome: '', email: '', erro }], semEmail: s.emailsResultado?.semEmail ?? [] };
    saveSession(s);
    log(`e-mail do resultado de ${s.name} não foi enviado (tenta de novo): ${erro}`);
  }
}
/**
 * O e-mail do resultado sai 3 min depois do encerramento e de cada ajuste na classificação. Ultras 13/10: o kart 114
 * foi posto em P10 por engano, a bateria encerrou, o e-mail saiu 1 min depois e a correção para P28 veio 30 s
 * depois do envio — os pilotos receberam o 114 em 10º. Se já tinha saído, vai de novo para todos com o aviso de
 * resultado corrigido (só até 6 h do encerramento; depois disso, reenvio manual pelo menu).
 */
const ESPERA_EMAIL_MS = Number(process.env.TIMING_ESPERA_EMAIL_MS || 3 * 60_000); // o simulador de teste encurta
const emailsAgendados = new Map<string, NodeJS.Timeout>();

/**
 * App do cliente: o resultado vai para o app junto com o e-mail (3 min depois de encerrar e a cada correção), sem
 * precisar do menu "Publicar / corrigir resultado no app". Quem correu sem cadastro fica de fora (não tem conta).
 * Guarda a última versão enviada; se a internet falhar, o ciclo de 5 min tenta de novo (até 6 h depois).
 */
/**
 * E-mails de conta do app (confirmação e troca de senha): o Worker deixa numa fila e este servidor envia pela mesma
 * saída dos resultados (HostGator), porque o Email Sending da Cloudflare não está liberado para o domínio. A cada 10 s.
 * O log não mostra destinatário nem o link (o link é a chave da conta).
 */
let filaEmailsDoAppRodando = false;
async function enviarEmailsDoApp() {
  const destination = process.env.MOBILE_RESULTS_URL;
  const token = process.env.MOBILE_PUBLISH_TOKEN;
  if (filaEmailsDoAppRodando || !destination || !token) return;
  const base = mobileApiEndpoint(destination, '/api/mobile/v1/internal/results', SIMULATE);
  if (!base) return;
  filaEmailsDoAppRodando = true;
  try {
    const r = await fetch(new URL('/api/mobile/v1/internal/outbox', base), { headers: { 'x-mobile-publish-token': token }, redirect: 'error', signal: AbortSignal.timeout(15_000) });
    if (!r.ok) return;
    const fila = (await r.json()) as { id: string; to: string; subject: string; text: string; html: string }[];
    let enviados = 0;
    for (const m of fila) {
      let ok = true;
      try { await enviarEmailSimples(EMAIL_FILE, SIMULATE, m); enviados++; }
      catch (e) { ok = false; log(`app: e-mail de conta não saiu (${traduzirErro(e)}); tenta de novo`); }
      await fetch(new URL(`/api/mobile/v1/internal/outbox/${m.id}/${ok ? 'enviado' : 'falhou'}`, base), {
        method: 'POST', headers: { 'x-mobile-publish-token': token }, redirect: 'error', signal: AbortSignal.timeout(15_000),
      }).catch(() => undefined);
    }
    if (enviados) log(`app: ${enviados} e-mail(s) de conta enviados (confirmação/troca de senha)`);
  } catch {
    // internet ou Worker fora: tenta no próximo ciclo
  } finally {
    filaEmailsDoAppRodando = false;
  }
}
setInterval(() => void enviarEmailsDoApp(), 10_000);

const publicadosNoApp = new Map<string, string>();
async function publicarNoAppAutomatico(s: Session) {
  const destination = process.env.MOBILE_RESULTS_URL;
  const publishToken = process.env.MOBILE_PUBLISH_TOKEN;
  if (!destination || !publishToken || s.state !== 'encerrada' || !['classificacao', 'corrida'].includes(s.type)) return;
  const url = mobileApiEndpoint(destination, '/api/mobile/v1/internal/results', SIMULATE);
  if (!url) return;
  const assinatura = assinaturaResultado(s);
  if (publicadosNoApp.get(s.id) === assinatura) return;
  let payload: ReturnType<typeof serializeMobilePublication>;
  try { payload = serializeMobilePublication(s, 'publish', { ignorarSemCadastro: true }); }
  catch (e) { publicadosNoApp.set(s.id, assinatura); log(`app: resultado de ${s.name} não foi para o app (${(e as Error).message})`); return; }
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-mobile-publish-token': publishToken },
      body: JSON.stringify(payload),
      redirect: 'error',
      signal: AbortSignal.timeout(10_000),
    });
    if (!r.ok) { log(`app: o serviço do app recusou o resultado de ${s.name} (HTTP ${r.status})`); return; }
    publicadosNoApp.set(s.id, assinatura);
    log(`app: resultado de ${s.name} publicado (${payload.results?.length ?? 0} pilotos com cadastro)`);
  } catch (e) {
    log(`app: não foi possível publicar ${s.name} agora (${(e as Error).message}); tenta de novo em 5 min`);
  }
}

function agendarEmails(s: Session) {
  clearTimeout(emailsAgendados.get(s.id));
  registrarJobEmail(s.id, Date.now() + ESPERA_EMAIL_MS);
  emailsAgendados.set(s.id, setTimeout(() => {
    emailsAgendados.delete(s.id);
    concluirJobEmail(s.id);
    if (s.state !== 'encerrada' || !['classificacao', 'corrida'].includes(s.type)) return;
    void publicarNoAppAutomatico(s);
    if (envioATodosAtivo.has(s.id)) return agendarEmails(s); // ainda mandando a versão anterior: corrige quando terminar
    const assinaturaAtual = assinaturaResultado(s);
    if (!(s.emailsResultado?.enviados.length)) {
      return void emailsAoEncerrar(s);
    }
    if (!lerConfig(EMAIL_FILE).automatico || semEmailAosPilotos(s, nomeEventoDa(s))) return;
    // Item 15: Só reenvia resultado com aviso de correção se a classificação realmente tiver mudado
    if (s.emailsResultado.assinaturaResultado && s.emailsResultado.assinaturaResultado === assinaturaAtual) {
      log(`e-mail de ${s.name}: classificação inalterada após ajuste manual; reenvio de correção cancelado`);
      return;
    }
    log(`e-mail do resultado de ${s.name}: a classificação mudou depois do envio, reenviando a todos com o aviso de correção`);
    void enviarResultadoEmFila(s, { automatico: false, corrigido: true, nomeEvento: nomeEventoDa(s), assinaturaResultado: assinaturaAtual })
      .catch((e) => log(`e-mail corrigido de ${s.name}: ${(e as Error).message}`));
  }, ESPERA_EMAIL_MS));
}
function assinaturaResultado(s: Session) {
  // o que o piloto lê no e-mail; marcar a posição que ele já tinha (manualPosition igual) não reenvia
  return JSON.stringify(computeStandings(s, trackLengthFor(s)).map((r) => [r.position, r.kart, r.name, r.laps, r.bestLapMs, r.totalMs, r.gapMs, r.gapLaps, r.penaltyMs, r.advertencias, r.desclassificado]));
}

// nova tentativa a cada 5 min só para quem falhou (servidor de e-mail fora, internet caiu), até 6 h depois do encerramento.
// Bateria encerrada há mais de 3 min sem registro de envio = o envio morreu no meio (servidor reiniciado logo depois do
// encerramento: 10/10 09:50 e 11/10 17:25 ficaram sem resultado) → manda de novo.
setInterval(() => {
  const agora = Date.now();
  const limite = agora - 6 * 3_600_000;
  for (const s of sessions.values()) {
    const e = s.emailsResultado;
    const fim = s.finishedAt ?? s.createdAt;
    if (s.state !== 'encerrada' || fim <= limite || emailsAgendados.has(s.id)) continue;
    const suprimidoHistorico100Milhas = e?.status === 'sem-email-pilotos' && /100\s*milhas/i.test(`${nomeEventoDa(s)} ${s.name}`);
    const horaRetry = e?.proximaTentativaEm ?? 0;
    const possuiFalhaTransitoria = e?.falhas.some((f) => !f.permanente) ?? false;
    if (suprimidoHistorico100Milhas || (e ? (e.status === 'parcial' || e.status === 'falhou') && possuiFalhaTransitoria && e.tentativas < 12 && agora >= horaRetry : fim < agora - 3 * 60_000)) void emailsAoEncerrar(s);
    if (fim < agora - 3 * 60_000) void publicarNoAppAutomatico(s);
  }
}, 60_000);

// ---------------------------------------------------------------- agenda da recepção -> evento do dia (canvas Eventos.dc.html)
// Como no canvas: cada dia vira o evento "Baterias dd/mm/aaaa", cada bateria da agenda da recepção vira um grupo e as
// provas vêm do produto vendido (Tomada de tempo + Corrida...). As provas criadas aqui podem ser ajustadas pelo
// cronometrista: a sincronização só cria o que falta, nunca sobrescreve.

type BateriaAgenda = { id: number; nome?: string; inicio?: string; tipoKart?: string; trackId?: string | null; pagos?: number; inscritos?: number };
type ProgramaAgenda = { ordem?: number; nome?: string; tipo?: string; finalizacao?: string; tempoMin?: number; voltasMax?: number; voltaMinimaSeg?: number; trackId?: string | null };
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
          id, eventId, groupId, agendaId: String(b.id), order: k + 1, heats: 1, intervalMin: 0, trackId: b.trackId ?? null,
          name: String(p.nome ?? '').trim() || (tipo === 'classificacao' ? 'TOMADA DE TEMPO' : tipo === 'treino' ? 'TREINO' : 'CORRIDA'),
          type: tipo, durationMin: tempo, maxLaps: porVoltas && Number(p.voltasMax) > 0 ? Number(p.voltasMax) : null,
          minLapSec: Number(p.voltaMinimaSeg) > 0 ? Number(p.voltaMinimaSeg) : null,
          startAt: minutos == null ? '' : `${String(Math.floor(minutos / 60) % 24).padStart(2, '0')}:${String(minutos % 60).padStart(2, '0')}`,
        });
        mudou = true;
      }
      const existente = catalog.provas.find((x) => x.id === id);
      const trackId = b.trackId ?? null;
      // O traçado da Recepção é a fonte da agenda enquanto a prova ainda não foi usada.
      // Depois que existe uma sessão, a escolha do cronometrista permanece intocada.
      if (existente && existente.trackId !== trackId && ![...sessions.values()].some((s) => s.proofId === id && s.state !== 'cancelada')) {
        existente.trackId = trackId;
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
    s.trackId = p.trackId ?? null;
    aplicarCondicaoDoTracado(s);
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
  // metas e regras da equalização também (o e-mail fica fora: tem a senha da caixa)
  for (const name of ['transponders.json', 'catalog.json', 'settings.json', 'equalizacao-metas.json', 'equalizacao-regras.json']) {
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
  const progresso = progressoNasPassagens(s);
  return s.competitors.flatMap((competitor) => competitor.crossings.map((crossing, index) => ({
    id: crossing.id ?? `${s.id}-${competitor.kart}-${index}`,
    kart: competitor.kart,
    name: nomeProprio(competitor.name), // como no resultado ao lado (TUDO MAIÚSCULO cortava no registro de passagens)
    category: competitor.category ?? null,
    transponder: crossing.transponder ?? null,
    lap: index,
    voltas: progresso.get(crossing)?.voltas ?? null,
    leaderLap: progresso.get(crossing)?.lider ?? 0,
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
    voltas: null,
    leaderLap: 0,
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
  const sameKartFromTarget = target ? new Set(crossingIdsFromKartAtOrAfter(s, target.id)) : null;
  const selected = rows.filter((row) => ids.includes(row.id) || sameKartFromTarget?.has(row.id));
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
        const tracadoAntes = entity === 'provas' ? catalog.provas.find((p) => p.id === id)?.trackId ?? null : undefined;
        const item = updateCatalogRecord(catalog, entity, id, await readBody(req));
        if (entity === 'provas') levarTracadoDaProva(id, tracadoAntes ?? null, (item as { trackId?: string | null }).trackId ?? null);
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
  if (path.startsWith('/api/email-config') && !isAuthorizedDestructive(req)) return send(res, 403, { error: 'Acesso não autorizado para configurações de e-mail.' });
  if (path === '/api/email-config' && method === 'GET') return send(res, 200, configPublica(lerConfig(EMAIL_FILE)));
  if (path === '/api/email-config' && method === 'PUT') {
    try { return send(res, 200, configPublica(salvarConfig(EMAIL_FILE, await readBody(req)))); } catch (e) { return send(res, 400, { error: (e as Error).message }); }
  }
  if (path === '/api/email-config/verificar' && method === 'POST') {
    try { return send(res, 200, await verificarTransporteEmail(EMAIL_FILE, SIMULATE)); }
    catch (e) { return send(res, 502, { error: `Falha na autenticação SMTP: ${traduzirErro(e)}` }); }
  }
  if (path === '/api/email-config/teste' && method === 'POST') {
    const body = await readBody(req);
    try {
      const daTela = body.config && typeof body.config === 'object' && !Array.isArray(body.config) ? body.config as Record<string, unknown> : undefined;
      const resultado = await enviarTeste(EMAIL_FILE, String(body.para ?? ''), SIMULATE, daTela);
      log('e-mail de teste aceito pelo servidor; destinatário ocultado do log');
      return send(res, 200, { ok: true, ...(resultado ?? { status: 'simulador', entregaConfirmada: false, mensagem: 'Teste gravado no simulador.' }) });
    }
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
      // o teste da conexão leva até alguns segundos: se alguém deu a verde nesse meio tempo, não troca o decoder
      if (runningSession()) return send(res, 409, { error: 'Uma bateria largou enquanto a conexão era testada. Encerre a bateria antes de alterar o decoder.' });
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
  if (path === '/api/painel-led-page' && method === 'GET') return send(res, 200, painelLedPage);
  if (path === '/api/painel-led-page' && (method === 'PUT' || method === 'POST')) {
    const body = await readBody(req);
    try {
      return send(res, 200, setPainelLedPage(body.pagina, String(body.origem ?? 'cronometragem')));
    } catch (err) {
      return send(res, 400, { error: (err as Error).message });
    }
  }
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

  if (path.startsWith('/api/transmissao/')) return rotaTransmissao(req, res, url);

  if (path === '/api/livetime-snapshot/eventos') {
    res.writeHead(200, { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-store', connection: 'keep-alive', 'access-control-allow-origin': '*' });
    const cliente: ClientePainel = { res, tb50: url.searchParams.get('painel') === 'tb50', ultimo: '' };
    res.write('retry: 1000\n\n');
    clientesPainel.add(cliente);
    enviarAosPaineis(); // o retrato atual na hora de conectar
    req.on('close', () => clientesPainel.delete(cliente));
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
    s.trackId = typeof body.trackId === 'string' && catalog.tracks.some((track) => track.id === body.trackId)
      ? body.trackId
      : prova?.trackId ?? null;
    aplicarCondicaoDoTracado(s);
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

  const mobilePublicationRoute = path.match(/^\/api\/sessions\/([\w-]+)\/mobile-publication$/);
  if (mobilePublicationRoute && method === 'POST') {
    const token = /^Bearer\s+([^\s]+)$/i.exec(String(req.headers.authorization ?? ''))?.[1];
    if (!token) return send(res, 401, { error: 'Entre novamente para publicar resultados.' });
    let permission: Response;
    try {
      permission = await mobilePublishPermission(token);
    } catch {
      return send(res, 503, { error: 'Não foi possível validar sua permissão agora.' });
    }
    if (permission.status === 401) return send(res, 401, { error: 'Sessão expirada. Entre novamente.' });
    if (!permission.ok || !(await permission.json().catch(() => ({})) as { allowed?: boolean }).allowed) {
      return send(res, 403, { error: 'Seu perfil não pode publicar resultados no app.' });
    }

    const session = sessions.get(mobilePublicationRoute[1]);
    if (!session) return send(res, 404, { error: 'Bateria não encontrada.' });
    let payload: ReturnType<typeof serializeMobilePublication>;
    try {
      const body = await readBody(req);
      if (body.action !== 'publish' && body.action !== 'withdraw') return send(res, 400, { error: 'Ação de publicação inválida.' });
      payload = serializeMobilePublication(session, body.action);
    } catch (error) {
      return send(res, session.state === 'encerrada' ? 400 : 409, { error: (error as Error).message });
    }

    const destination = process.env.MOBILE_RESULTS_URL;
    const publishToken = process.env.MOBILE_PUBLISH_TOKEN;
    if (!destination || !publishToken) return send(res, 503, { error: 'Publicação móvel ainda não está configurada.' });
    try {
      const url = mobileApiEndpoint(destination, '/api/mobile/v1/internal/results', SIMULATE);
      if (!url) return send(res, 503, { error: 'O destino de publicação não é o Worker móvel autorizado.' });
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-mobile-publish-token': publishToken },
        body: JSON.stringify(payload),
        redirect: 'error',
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) return send(res, 502, { error: 'O serviço móvel não confirmou a publicação.' });
      return send(res, 200, { ok: true, action: payload.action });
    } catch {
      return send(res, 502, { error: 'Não foi possível enviar o resultado ao app.' });
    }
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
        // Tabajara: false = vale só o kart novo (voltas e tempos do anterior saem da conta)
        manterVoltas: body.manterVoltas !== false,
      });
      registrarTrocas(s, [troca], 'explicit-swap');
      saveSession(s);
      atualizarKartsNasProvasPreparadas(s, troca.de, troca.para, body.customerId == null ? null : String(body.customerId));
      scheduleStateBroadcast();
      return send(res, 200, { ok: true, troca, session: sessionView(s) });
    } catch (err) { return send(res, 400, { error: (err as Error).message }); }
  }

  // ---------------------------------------------------------------- registro de competidor (Competidor do canvas)
  const recuperar = path.match(/^\/api\/sessions\/([\w-]+)\/competitors\/restore$/);
  if (recuperar && method === 'POST') {
    const s = sessions.get(recuperar[1]);
    if (!s) return send(res, 404, { error: 'Bateria não encontrada.' });
    const body = await readBody(req);
    try {
      const c = restoreCompetitor(s, String(body.id ?? ''));
      registrarObservacao(s, `Piloto recuperado · Kart ${c.kart} · ${c.name}`, String(body.autor ?? 'Cronometragem'), 'system');
      saveSession(s); scheduleStateBroadcast();
      return send(res, 200, sessionView(s));
    } catch (err) { return send(res, 409, { error: (err as Error).message }); }
  }
  const rc = path.match(/^\/api\/sessions\/([\w-]+)\/competitors\/(\d+)$/);
  if (rc && method === 'PUT') {
    const s = sessions.get(rc[1]);
    if (!s) return send(res, 404, { error: 'Bateria não encontrada.' });
    const i = Number(rc[2]);
    const atual = s.competitors[i];
    if (!atual) return send(res, 404, { error: 'Competidor não encontrado nessa bateria.' });
    const body = await readBody(req);
    // a tela manda quem estava nessa linha quando abriu o registro: se a lista mudou no meio, não grava em outro piloto
    if ((typeof body.kartAntes === 'string' && body.kartAntes !== atual.kart) || (typeof body.nomeAntes === 'string' && body.nomeAntes.trim() !== atual.name.trim()))
      return send(res, 409, { error: 'A lista de pilotos desta bateria mudou enquanto o registro estava aberto. Feche e abra o registro de novo.' });
    const num = (v: unknown) => (v === '' || v == null || !Number.isFinite(Number(String(v).replace(',', '.'))) ? null : Number(String(v).replace(',', '.')));
    const txt = (v: unknown, max = 80) => String(v ?? '').trim().slice(0, max);
    const d = (body.detalhes ?? {}) as Record<string, unknown>;
    const detalhes = {
      sexo: txt(d.sexo, 20), iniciais: txt(d.iniciais, 6).toUpperCase(), email: txt(d.email, 160), patrocinador: txt(d.patrocinador), clube: txt(d.clube),
      cidade: txt(d.cidade), estado: txt(d.estado, 4).toUpperCase(), pais: txt(d.pais, 40), box: txt(d.box, 20),
      peso: num(d.peso), pesoIndumentaria: num(d.pesoIndumentaria), pesoLastro: num(d.pesoLastro), pontuacao: num(d.pontuacao),
      oculto: Boolean(d.oculto), equipe: Array.isArray(d.equipe) ? (d.equipe as unknown[]).map((x) => txt(x, 100)).slice(0, 6) : [],
      // transponder de cada piloto da equipe, na mesma posição de "equipe" (a coluna da tela não era gravada)
      ...(Array.isArray(d.equipeTransponders) ? { equipeTransponders: (d.equipeTransponders as unknown[]).map((x) => txt(x, 12).replace(/\D/g, '') || null).slice(0, 6) } : {}),
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
    for (const troca of trocas) atualizarKartsNasProvasPreparadas(s, troca.de, troca.para, atual.customerId ?? null);
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
    const metaMs = tempoVoltaParaMs(body.metaSeg) ?? (Number(body.metaMs) > 0 ? Math.round(Number(body.metaMs)) : null);
    if (!metaMs) return send(res, 400, { error: META_INVALIDA });
    const tid = body.trackId ? String(body.trackId) : null;
    if (tid && !catalog.tracks.some((t) => t.id === tid)) return send(res, 400, { error: 'Traçado não encontrado.' });
    const meta: MetaTracado = { id: randomUUID(), trackId: tid, metaMs, toleranciaMs: segundosParaMs(body.toleranciaSeg) ?? TOLERANCIA_PADRAO_MS, quando: Date.now(), origem: 'manual', autor: String(body.autor ?? 'Cronometragem').slice(0, 60) };
    metasTracado.push(meta); saveMetas();
    log(`equalização: meta de ${formatLap(metaMs)} para o traçado ${tid ? catalog.tracks.find((t) => t.id === tid)?.name : 'principal'}`);
    return send(res, 201, meta);
  }
  if (path === '/api/equalizacao/regras' && method === 'GET') return send(res, 200, { regras: regrasRedutor.map(regraView) });
  if (path === '/api/equalizacao/regras' && method === 'POST') {
    // regra do redutor de um tipo de kart: cria ou altera (pelo id ou pelo nome)
    const body = await readBody(req);
    const nome = String(body.nome ?? '').trim().slice(0, 60);
    if (!nome) return send(res, 400, { error: 'Digite o tipo de kart (ex.: Kart Indoor).' });
    const toleranciaMs = segundosParaMs(body.toleranciaSeg); const faixaMs = segundosParaMs(body.faixaSeg); const passoMm = milimetros(body.passoMm);
    if (!toleranciaMs || toleranciaMs > 10_000) return send(res, 400, { error: 'Digite até quantos segundos de diferença o kart está equalizado (ex.: 0,200).' });
    if (!faixaMs || faixaMs < 10 || faixaMs > 10_000) return send(res, 400, { error: 'Digite de quantos em quantos segundos muda o redutor (ex.: 0,200).' });
    if (!passoMm || passoMm <= 0 || passoMm > 5) return send(res, 400, { error: 'Digite quantos milímetros abrir ou fechar a cada faixa (ex.: 0,1).' });
    const outra = regrasRedutor.find((r) => r.nome.toLowerCase() === nome.toLowerCase());
    const atual = (body.id ? regrasRedutor.find((r) => r.id === String(body.id)) : null) ?? outra;
    if (atual && outra && outra !== atual) return send(res, 409, { error: `Já existe a regra "${outra.nome}".` });
    let faixasPersonalizadas: FaixaRedutor[] | null;
    let faixa2: ReturnType<typeof segundaFaixaDoPedido>;
    try { faixa2 = segundaFaixaDoPedido(body, toleranciaMs, atual); faixasPersonalizadas = validarFaixasRedutor(body.faixasPersonalizadas === undefined ? atual?.faixasPersonalizadas : body.faixasPersonalizadas, toleranciaMs); } catch (err) { return send(res, 400, { error: (err as Error).message }); }
    const regra: RegraSalva = { id: atual?.id ?? randomUUID().slice(0, 8), nome, toleranciaMs, faixaMs, passoMm, ...faixa2, faixasPersonalizadas, atualizadoEm: Date.now(), autor: String(body.autor ?? 'Cronometragem').slice(0, 60) };
    regrasRedutor = atual ? regrasRedutor.map((r) => (r === atual ? regra : r)) : [...regrasRedutor, regra];
    saveRegras();
    log(`equalização: regra do redutor "${nome}" — equalizado até ${toleranciaMs} ms; a cada ${faixaMs} ms, ${passoMm} mm` + (faixa2.limiteMs ? `; acima de ${faixa2.limiteMs} ms, a cada ${faixa2.faixa2Ms} ms, ${faixa2.passo2Mm} mm` : ''));
    return send(res, atual ? 200 : 201, { regra: regraView(regra), regras: regrasRedutor.map(regraView) });
  }
  const regraId = path.match(/^\/api\/equalizacao\/regras\/([\w-]+)$/);
  if (regraId && method === 'DELETE') {
    if (!regrasRedutor.some((r) => r.id === regraId[1])) return send(res, 404, { error: 'Regra não encontrada.' });
    if (regrasRedutor.length === 1) return send(res, 409, { error: 'Precisa ficar pelo menos uma regra do redutor.' });
    regrasRedutor = regrasRedutor.filter((r) => r.id !== regraId[1]);
    saveRegras();
    return send(res, 200, { regras: regrasRedutor.map(regraView) });
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
    if (String(body.metaSeg ?? '').trim() && !tempoVoltaParaMs(body.metaSeg)) return send(res, 400, { error: META_INVALIDA });
    let regra: ReturnType<typeof regraDoPedido>;
    try { regra = regraDoPedido(body); } catch (err) { return send(res, 400, { error: (err as Error).message }); }
    const agora = new Date();
    const quando = agora.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).replace(',', '');
    const cfgT = (timingSettings.timing as Record<string, unknown> | undefined) ?? {};
    const s = createSession({
      id: `${hojeBrasilia()}-${randomUUID().slice(0, 8)}`, name: String(body.nome ?? '').trim() || `Equalização ${quando}`, type: 'equalizacao',
      durationMin: 0, minLapSec: Number(cfgT.minimumLapSeconds ?? 5), now: Date.now(),
      competitors: [...referencias.map((k) => ({ kart: k, name: `Kart ${k} (referência)` })), ...parseCompetitors(body.karts).filter((c) => c.kart && !referencias.includes(c.kart))],
    });
    s.trackId = tid;
    aplicarCondicaoDoTracado(s);
    s.equalizacao = {
      referencias, metaModo: body.metaModo === 'fixa' ? 'fixa' : 'referencia', metaFixaMs: tempoVoltaParaMs(body.metaSeg),
      ...regra, mecanico: String(body.mecanico ?? '').trim().slice(0, 80), checklist: {}, aberturas: {}, redutorInicialMm: {},
    };
    sessions.set(s.id, s);
    saveSession(s);
    log(`equalização criada: ${s.name} · ${trackDa(s).name} · referências ${referencias.join(', ') || '(nenhuma)'}`);
    scheduleStateBroadcast();
    return send(res, 201, equalizacaoDetalhe(s));
  }
  const eq = path.match(/^\/api\/equalizacao\/([\w-]+)(?:\/(karts|finalizar|reabrir|importar)(?:\/([^/]+))?)?$/);
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
          aplicarCondicaoDoTracado(s);
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
        if (body.metaSeg !== undefined) {
          if (String(body.metaSeg ?? '').trim() && !tempoVoltaParaMs(body.metaSeg)) return send(res, 400, { error: META_INVALIDA });
          cfg.metaFixaMs = tempoVoltaParaMs(body.metaSeg);
        }
        if (body.regra !== undefined || body.toleranciaSeg !== undefined || body.faixaSeg !== undefined || body.passoMm !== undefined || body.limiteSeg !== undefined || body.faixasPersonalizadas !== undefined) Object.assign(cfg, regraDoPedido(body, cfg));
        if (typeof body.mecanico === 'string') cfg.mecanico = body.mecanico.trim().slice(0, 80);
        if (body.abertura && typeof body.abertura === 'object') {
          // correção do redutor de um bloco: abertura em mm em relação ao inicial (vazio volta para o ajuste sugerido)
          const r = body.abertura as { kart?: unknown; bloco?: unknown; mm?: unknown };
          const kart = String(r.kart ?? ''); const bloco = String(Number(r.bloco));
          if (!kart || !(Number(r.bloco) >= 2)) return send(res, 400, { error: 'Informe o kart e o bloco (o bloco 1 é sempre o redutor inicial).' });
          const doKart = ((cfg.aberturas ??= {})[kart] ??= {});
          const mm = milimetros(r.mm);
          if (r.mm === null || r.mm === '' || r.mm === undefined) delete doKart[bloco];
          else if (mm != null && Math.abs(mm) <= 20) doKart[bloco] = mm;
          else return send(res, 400, { error: 'Abertura inválida: digite os milímetros em relação ao redutor inicial (ex.: 0,3 ou -0,1).' });
        }
        if (body.redutorInicial && typeof body.redutorInicial === 'object') {
          // medida do redutor que estava no kart no bloco 1 (vazio = não informada)
          const r = body.redutorInicial as { kart?: unknown; mm?: unknown };
          const kart = String(r.kart ?? '');
          if (!kart) return send(res, 400, { error: 'Informe o kart.' });
          const mm = milimetros(r.mm);
          if (r.mm === null || r.mm === '' || r.mm === undefined) delete (cfg.redutorInicialMm ??= {})[kart];
          else if (mm != null && mm > 0 && mm <= 99) (cfg.redutorInicialMm ??= {})[kart] = mm;
          else return send(res, 400, { error: 'Medida do redutor inválida: digite em milímetros (ex.: 17,2).' });
        }
      } else if (eq[2] === 'karts' && eq[3] && method === 'PUT') {
        // apontamentos da oficina para o kart: chassi, pneu, motor, embreagem, freio, observações e ação
        const kart = decodeURIComponent(eq[3]);
        const comp = s.competitors.find((c) => c.kart === kart);
        if (!comp) return send(res, 404, { error: 'Kart não encontrado nesta equalização.' });
        const body = await readBody(req);
        const anteriorChecklist = cfg.checklist?.[kart];
        let confirmacaoManual = anteriorChecklist?.confirmacaoManual;
        if (Object.prototype.hasOwnProperty.call(body, 'confirmacaoManual')) {
          if (body.confirmacaoManual == null) confirmacaoManual = undefined;
          else {
            const atual = resultadoEqualizacao(s).karts.find((k) => k.kart === kart);
            const completos = atual?.blocos.filter((b) => b.completo) ?? [];
            const ultimo = completos[completos.length - 1];
            const pedido = body.confirmacaoManual as { aberturaMm?: unknown };
            const aberturaMm = milimetros(pedido.aberturaMm);
            if (!atual || atual.referencia || !ultimo || atual.melhorMs == null || aberturaMm == null || Math.abs(aberturaMm) > 20 || resultadoEqualizacao(s).metaMs == null)
              return send(res, 400, { error: 'Para confirmar manualmente, informe um ajuste de até 20 mm para um kart não referência com bloco completo e meta definida nesta equalização.' });
            confirmacaoManual = { aberturaMm, bloco: ultimo.bloco, confirmadoEm: Date.now(), autor: String(body.autor ?? 'Cronometragem').slice(0, 60) };
          }
        }
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
          ...(confirmacaoManual ? { confirmacaoManual } : {}),
        };
        if (typeof body.piloto === 'string' && body.piloto.trim()) comp.name = body.piloto.trim().slice(0, 80);
      } else if (eq[2] === 'importar' && !eq[3] && method === 'POST') {
        // karts que andaram em outra bateria (as voltas foram cronometradas fora da equalização): copia as passagens
        const body = await readBody(req);
        const origem = sessions.get(String(body.sessionId ?? ''));
        if (!origem || origem.id === s.id) return send(res, 400, { error: 'Escolha a bateria de onde vêm os karts.' });
        const lista = (Array.isArray(body.karts) ? body.karts : String(body.karts ?? '').split(/[;, ]+/)).map((k: unknown) => String(k));
        if (!lista.some((k) => k.trim())) return send(res, 400, { error: 'Digite os números dos karts.' });
        const r = importarKarts(s, origem, lista);
        if (r.importados.length === 0) return send(res, 409, { error: `Nenhum kart foi trazido: ${r.ignorados.map((x) => `${x.kart} (${x.motivo})`).join(', ')}.` });
        registrarObservacao(s, `Karts trazidos de "${origem.name}" (${new Date(origem.startedAt ?? origem.createdAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}): ${r.importados.map((x) => x.kart).join(', ')}`, String(body.autor ?? 'Cronometragem').slice(0, 60));
        log(`equalização ${s.name}: karts ${r.importados.map((x) => x.kart).join(', ')} trazidos de ${origem.name}${r.ignorados.length ? `; ficaram de fora ${r.ignorados.map((x) => `${x.kart} (${x.motivo})`).join(', ')}` : ''}`);
        saveSession(s);
        scheduleStateBroadcast();
        return send(res, 200, { ...equalizacaoDetalhe(s), importados: r.importados, ignorados: r.ignorados });
      } else if (eq[2] === 'finalizar' && method === 'POST') {
        if (s.state === 'preparando') return send(res, 409, { error: 'Esta equalização ainda não largou (dê a bandeira verde na Cronometragem).' });
        const agora = Date.now();
        if (s.state === 'em_andamento' || s.state === 'bandeira_final') { closeSession(s, agora); void enviarUsoKarts(s); }
        cfg.finalizadaEm = agora;
        // a meta que saiu desta equalização fica no histórico do traçado
        const r = resultadoEqualizacao(s);
        metasTracado = metasTracado.filter((m) => m.sessionId !== s.id);
        if (r.metaMs) metasTracado.push({ id: randomUUID(), trackId: trackIdDa(s), metaMs: r.metaMs, toleranciaMs: r.toleranciaMs, quando: s.startedAt ?? agora, origem: 'equalizacao', sessionId: s.id, referencias: cfg.referencias ?? [] });
        saveMetas();
        registrarObservacao(s, `Equalização finalizada: meta ${r.metaMs ? formatLap(r.metaMs) : 'não definida'}, ${r.karts.filter((k) => k.status === 'EQUALIZADO').length} equalizado(s), ${r.karts.filter((k) => k.status === 'REVISAR').length} para revisar`, 'Cronometragem');
      } else if (eq[2] === 'reabrir' && method === 'POST') {
        // retomar a MESMA equalização (volta a contar passagens) em vez de criar outra a cada pausa
        if (s.state === 'encerrada') {
          const outra = runningSession();
          if (outra && outra.id !== s.id) return send(res, 409, { error: `A bateria "${outra.name}" está em andamento. Encerre ela antes de retomar a equalização.` });
          const body = await readBody(req);
          retomarEqualizacao(s);
          registrarObservacao(s, 'Equalização retomada: as voltas já feitas continuam e as novas entram nos blocos seguintes', String(body.autor ?? 'Cronometragem').slice(0, 60));
          log(`equalização ${s.name}: RETOMADA`);
        }
        cfg.finalizadaEm = null;
        // a meta desta equalização sai do histórico até ser finalizada de novo
        const antes = metasTracado.length;
        metasTracado = metasTracado.filter((m) => m.sessionId !== s.id);
        if (metasTracado.length !== antes) saveMetas();
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
    const chaveCategoria = (valor: string) => valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase('pt-BR');
    const categoriaPedida = (q.get('categoria') ?? '').trim();
    const chavePedida = chaveCategoria(categoriaPedida);
    // A agenda chama a categoria não-Super de "Light", enquanto o cadastro histórico
    // ainda guarda esse grupo como "Indoor". Prefere um cadastro "Light" quando existir.
    const nomeCadastro = chavePedida === 'light' ? 'indoor' : chavePedida;
    const categoriaCadastro = catalog.categories.find((c) => chaveCategoria(c.name) === chavePedida)
      ?? (chavePedida === 'light' ? catalog.categories.find((c) => chaveCategoria(c.name) === nomeCadastro) : undefined);
    const categorias = categoriaPedida
      ? [...new Set([chavePedida, ...(categoriaCadastro ? [chaveCategoria(categoriaCadastro.id), chaveCategoria(categoriaCadastro.name)] : [])])]
      : null;
    const categoriaDaBateria = (s: Session) => {
      const prova = catalog.provas.find((p) => p.id === s.proofId);
      const grupo = catalog.groups.find((g) => g.id === (s.groupId ?? prova?.groupId));
      return grupo?.categoryId ?? null;
    };
    const opcoes = { de: data(q.get('de')), ate: data(q.get('ate')), trackId: q.get('trackId') || null, tipos: tipos.length ? tipos : null, categorias, categoriaDaBateria, extensaoM: trackLengthFor };
    const kart = q.get('kart');
    if (kart) return send(res, 200, historicoDoKart(sessions.values(), kart, opcoes, trackIdDa, kartDaPassagem, (s) => trackDa(s).name).map((h) => ({ ...h, piloto: nomeProprio(h.piloto) })));
    return send(res, 200, rankingKarts(sessions.values(), opcoes, trackIdDa, kartDaPassagem, (s) => trackDa(s).name).map((r) => ({ ...r, melhorPiloto: nomeProprio(r.melhorPiloto) })));
  }

  // ---------------------------------------------------------------- último sorteio, para a TV do briefing (áudio 06/10):
  // cada piloto acha o nome e vai direto para o kart, sem esquecer o número no caminho
  if (path === '/api/sorteio/ultimo' && method === 'GET') {
    let ultimo: { s: Session; em: number } | null = null;
    for (const x of sessions.values()) {
      if (x.state === 'cancelada') continue;
      for (const o of x.observations ?? []) if (o.author === 'Sorteio' && (!ultimo || o.wallMs > ultimo.em)) ultimo = { s: x, em: o.wallMs };
    }
    if (!ultimo) return send(res, 200, { sorteio: null });
    const { s, em } = ultimo;
    const pilotos = s.competitors
      .filter((c) => c.kart && !c.autoAdded && !c.detalhes?.oculto)
      .map((c) => ({ nome: nomeProprio(c.name), kart: c.kart }))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    return send(res, 200, { sorteio: { sessaoId: s.id, bateria: s.name.split(' · ')[0], tipo: s.type, state: s.state, em, tipoKart: await tipoKartDa(s), pilotos } });
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
      } catch (err) { return send(res, err instanceof ListaMudouError ? 409 : 400, { error: (err as Error).message }); }
      const nomes = atribuicoes.map((a) => `${s.competitors[Number(a.indice)]?.name ?? '?'} → kart ${a.kart}`);
      setCompetitors(s, competidoresComSorteio(s, atribuicoes));
      const modo = descricaoModoSorteio(String(body.modo ?? ''));
      const texto = `Sorteio de karts no tablet (${modo}): ` + nomes.join('; ');
      (s.observations ??= []).push({ id: randomUUID(), text: texto, wallMs: Date.now(), author: 'Sorteio', kind: 'system' });
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
          // texto padrão: o cronometrista informa só o kart atingido e a curva; a volta é a que o kart está agora
          kartAtingido: body.kartAtingido == null ? undefined : String(body.kartAtingido),
          curva: body.curva == null ? undefined : String(body.curva),
          volta: body.volta == null || body.volta === '' ? undefined : Number(body.volta),
        });
        registrarObservacao(s, `${penalidade.texto} (${competitor.name})`, autor, 'penalty');
      } else {
        if (!pen[3]) return send(res, 400, { error: 'Informe a penalidade.' });
        const { competitor, penalidade } = removePenalty(s, kart, pen[3]);
        registrarObservacao(s, `Retirada de ${competitor.name}: ${penalidade.texto ?? textoPenalidade(penalidade)}`, 'Cronometragem', 'penalty');
      }
    } catch (err) { return send(res, 400, { error: (err as Error).message }); }
    saveSession(s);
    scheduleStateBroadcast();
    return send(res, 200, sessionView(s));
  }

  // excluir uma observação da prova (aba Observações, pedido de 07/10): sai do resultado e dos relatórios; fica no log
  const ob = path.match(/^\/api\/sessions\/([\w-]+)\/observations\/([\w-]+)$/);
  if (ob && method === 'DELETE') {
    const s = sessions.get(ob[1]);
    if (!s) return send(res, 404, { error: 'Bateria não encontrada.' });
    const o = (s.observations ?? []).find((x) => x.id === ob[2]);
    if (!o) return send(res, 404, { error: 'Essa observação não existe mais (a lista foi atualizada).' });
    s.observations = (s.observations ?? []).filter((x) => x !== o);
    saveSession(s);
    scheduleStateBroadcast();
    log(`bateria ${s.name}: observação excluída por ${url.searchParams.get('autor') || 'Cronometragem'}: "${o.text}"`);
    return send(res, 200, { ok: true });
  }

  const m = path.match(/^\/api\/sessions\/([\w-]+)(?:\/(\w+))?(?:\/(\w+))?$/);
  if (m) {
    const s = sessions.get(m[1]);
    if (!s) return send(res, 404, { error: 'Bateria nao encontrada.' });
    const action = m[2];
    const now = Date.now();
    // ajuste na classificação de bateria encerrada (posição manual, penalidade, passagem): o e-mail espera ou sai corrigido
    if (method !== 'GET' && action !== 'emails' && s.state === 'encerrada' && (s.finishedAt ?? 0) > now - 6 * 3_600_000) {
      const antes = assinaturaResultado(s);
      res.once('finish', () => { if (s.state === 'encerrada' && assinaturaResultado(s) !== antes) agendarEmails(s); });
    }
    try {
      if (!action && method === 'GET') return send(res, 200, sessionView(s));
      if (action === 'emails' && !m[3] && method === 'GET') {
        if (!isAuthorizedDestructive(req)) return send(res, 403, { error: 'Acesso não autorizado para consultar destinatários e resultado dos e-mails.' });
        return send(res, 200, s.emailsResultado ?? null);
      }
      if (action === 'emails' && !m[3] && method === 'POST') {
        if (!isAuthorizedDestructive(req)) return send(res, 403, { error: 'Acesso não autorizado para reenvio de resultados.' });
        // reenvio manual (menu da cronometragem): todos, só um kart, ou o resultado oficial para outro endereço
        const body = await readBody(req);
        if (s.state !== 'encerrada' && s.state !== 'bandeira_final') return send(res, 409, { error: 'Encerre a bateria antes de enviar o resultado.' });
        const kart = body.kart ? String(body.kart) : null;
        const para = body.para ? String(body.para) : null;
        if (!kart && !para) {
          // todos: um PDF + um e-mail por piloto pode passar de 1 min — vai em segundo plano, a tela acompanha pelo GET
          if (!lerConfig(EMAIL_FILE).senha && !SIMULATE) return send(res, 400, { error: 'E-mail não configurado: preencha a conta de e-mail do kartódromo em Ferramentas › E-mail dos resultados.' });
          if (envioATodosAtivo.has(s.id)) return send(res, 409, { error: 'O resultado desta bateria já está sendo enviado a todos os pilotos. Aguarde terminar.' });
          // somenteFaltantes: só quem ainda não recebeu; atrasado: abre com o pedido de desculpas (reenvio de 13/10)
          void enviarResultadoEmFila(s, { automatico: false, somenteFaltantes: body.somenteFaltantes === true, atrasado: body.atrasado === true }).catch((e) => log(`e-mail do resultado de ${s.name}: ${(e as Error).message}`));
          return send(res, 202, { emSegundoPlano: true });
        }
        return send(res, 200, await enviarResultadoEmFila(s, { automatico: false, kart, para, organizador: Boolean(para) && body.organizador === true }));
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
              const volta = (p.volta ? laps.find((l) => l.lap === p.volta) : undefined) ?? laps.find((l) => l.wallMs >= p.wallMs) ?? laps[laps.length - 1];
              const texto = p.texto ?? textoPenalidade(p) + (p.motivo ? ` (${p.motivo})` : '');
              if (volta) volta.penalty = volta.penalty ? `${volta.penalty} · ${texto}` : texto;
            }
            return { kart: c.kart, name: c.name, laps };
          }),
        );
      }
      if (action === 'passings' && !m[3] && method === 'GET') {
        let rows = crossingRows(s);
        const since = Number(url.searchParams.get('since'));
        if (Number.isFinite(since) && since > 0) {
          rows = rows.filter((r) => r.wallMs >= since);
        }
        const afterId = url.searchParams.get('afterId');
        if (afterId) {
          const idx = rows.findIndex((r) => r.id === afterId);
          if (idx >= 0) rows = rows.slice(0, idx);
        }
        const limit = Number(url.searchParams.get('limit'));
        if (Number.isFinite(limit) && limit > 0) {
          rows = rows.slice(0, limit);
        }
        return send(res, 200, rows);
      }
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
        if (!isAuthorizedDestructive(req)) return send(res, 403, { error: 'Acesso não autorizado para limpar passagens.' });
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
        const requestedKind = String(body.kind ?? '').trim();
        const kind: ObservationKind = requestedKind === 'kart-swap' ? 'kart-swap' : 'manual';
        const observation = { id: randomUUID(), text, wallMs: now, author: String(body.author ?? 'Cronometragem'), kind };
        s.observations.unshift(observation);
        saveSession(s);
        scheduleStateBroadcast();
        return send(res, 201, observation);
      }
      if (action === 'weather' && !m[3] && method === 'POST') {
        const body = await readBody(req);
        const valor = body.chuva;
        const chuva = valor === true || valor === 1 || String(valor ?? '').trim().toLowerCase() === 'true';
        setChuva(s, chuva);
        registrarObservacao(s, chuva ? 'Condição de pista: chuva' : 'Condição de pista: seca', String(body.autor ?? 'Cronometragem').slice(0, 60));
        saveSession(s);
        scheduleStateBroadcast();
        return send(res, 200, sessionView(s));
      }
      if (action === 'position' && !m[3] && method === 'POST') {
        const body = await readBody(req);
        const kart = String(body.kart ?? '').trim();
        const bruto = body.position;
        const limpar = bruto === null || bruto === undefined || String(bruto).trim() === '' || Number(bruto) === 0;
        const position = limpar ? null : Number(bruto);
        setManualPosition(s, kart, position);
        const autor = String(body.autor ?? 'Cronometragem').slice(0, 60);
        registrarObservacao(s, limpar ? `Posição automática restaurada · Kart ${kart}` : `Posição manual · Kart ${kart} → P${position}`, autor, limpar ? 'system' : 'manual');
        saveSession(s);
        scheduleStateBroadcast();
        return send(res, 200, sessionView(s));
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
        if (typeof body.semEmailPilotos === 'boolean') {
          for (const x of [s, ...irmasDe(s)]) { x.semEmailPilotos = body.semEmailPilotos; if (x !== s) saveSession(x); }
          log(`bateria ${s.name}: resultado por e-mail aos pilotos ${body.semEmailPilotos ? 'DESLIGADO (o organizador divulga)' : 'ligado'}`);
        }
        if (typeof body.eventId === 'string' || body.eventId === null) s.eventId = body.eventId as string | null;
        if (typeof body.groupId === 'string' || body.groupId === null) s.groupId = body.groupId as string | null;
        if (typeof body.proofId === 'string' || body.proofId === null) s.proofId = body.proofId as string | null;
        if (body.trackId !== undefined) {
          const tid = body.trackId ? String(body.trackId) : null;
          if (tid && !catalog.tracks.some((t) => t.id === tid)) return send(res, 400, { error: 'Traçado não encontrado.' });
          s.trackId = tid;
          aplicarCondicaoDoTracado(s);
          log(`bateria ${s.name}: traçado ${trackDa(s).name} (${trackDa(s).lengthMeters} m)`);
        }
      } else if (action === 'diario' && method === 'GET') {
        // passagens "sem bateria" de um horário (padrão: do fim da prova anterior da mesma bateria até o fim desta ou agora)
        const q = url.searchParams;
        const anterior = irmasDe(s).map((x) => x.finishedAt ?? 0).filter((t) => t > 0 && t <= (s.finishedAt ?? now)).sort((a, b) => b - a)[0];
        const de = Number(q.get('de')) || anterior || (s.createdAt - 3_600_000);
        const ate = Number(q.get('ate')) || s.finishedAt || now;
        return send(res, 200, resumoSemBateria(s, de, ate));
      } else if (action === 'remontar' && method === 'POST') {
        const body = await readBody(req);
        const de = Number(body.de); const ate = Number(body.ate);
        if (!(de > 0) || !(ate > de) || ate - de > 6 * 3_600_000) return send(res, 400, { error: 'Informe o horário de início e de fim da prova (até 6 horas).' });
        const contadas = remontarPeloDiario(s, de, ate, Boolean(body.incluirOutros), String(body.autor ?? 'Cronometragem'));
        void enviarUsoKarts(s);
        log(`bateria ${s.name}: REMONTADA pelo diário (${contadas} passagens)`);
      } else if (action === 'restart' && method === 'POST') {
        if (!isAuthorizedDestructive(req)) return send(res, 403, { error: 'Acesso não autorizado para reiniciar a bateria.' });
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
        if (!isAuthorizedDestructive(req)) return send(res, 403, { error: 'Acesso não autorizado para encerrar a bateria.' });
        closeSession(s, now);
        void enviarUsoKarts(s);
        agendarEmails(s); // 3 min para o cronometrista acertar posição/penalidade antes do e-mail sair
      } else if (action === 'cancel' && method === 'POST') {
        if (!isAuthorizedDestructive(req)) return send(res, 403, { error: 'Acesso não autorizado para cancelar a bateria.' });
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
        if (flag === 'black' && antes !== 'black') registrarObservacao(s, `Bandeira preta · ${quem} desclassificado, vai para o último lugar`, String(body.autor ?? 'Cronometragem'), 'penalty');
        else if (antes === 'black' && flag !== 'black') registrarObservacao(s, `Bandeira preta retirada · ${quem} volta à classificação`, String(body.autor ?? 'Cronometragem'), 'penalty');
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
    let programa: { nome?: string; tipo?: string; tempoMin?: number; finalizacao?: string; voltasMax?: number; voltaMinimaSeg?: number; trackId?: string | null }[] = [];
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
      s.trackId = typeof p.trackId === 'string' && catalog.tracks.some((track) => track.id === p.trackId) ? p.trackId : null;
      aplicarCondicaoDoTracado(s);
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

  if (path === '/healthz') return send(res, 200, { ok: true, decoder: decoderView(), sessions: sessions.size, transmissao: transmissaoStatus() });

  return send(res, 404, { error: 'Rota desconhecida.' });
}

/**
 * Pedido que veio da INTERNET pelo túnel do Cloudflare (crono.kartodromodebetim.com.br → :4050)
 * ou pela ponte local tv-public-bridge.mjs (:4051). Pela internet só LEITURA do placar e status.
 */
const LEITURA_PELA_INTERNET = new Set([
  '/tv',
  '/tv-classica',
  '/tb50',
  '/tokens.css',
  '/kib-logo.png',
  '/favicon.ico',
  '/healthz',
  '/api/events',
  '/api/state',
  '/api/livetime-snapshot',
  '/api/livetime-snapshot/eventos',
]);

function isAllowedPublicReadPath(pathname: string): boolean {
  if (LEITURA_PELA_INTERNET.has(pathname)) return true;
  if (/^\/api\/sessions\/[\w-]+\/laps$/.test(pathname)) return true;
  return false;
}

function veioDaInternet(req: http.IncomingMessage): boolean {
  return Boolean(req.headers['cf-connecting-ip'] || req.headers['cf-ray'] || req.headers['x-public-bridge'] === '1');
}

// Item 13: Rate limiting por IP para proteção contra DoS em rotas de tempo real
const rateLimitBuckets = new Map<string, { count: number; resetAt: number }>();
function checkRateLimit(req: http.IncomingMessage): boolean {
  const ip = (req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1')
    .toString().split(',')[0].trim().replace(/^::ffff:/, '');
  const now = Date.now();
  const bucket = rateLimitBuckets.get(ip);
  if (!bucket || now >= bucket.resetAt) {
    rateLimitBuckets.set(ip, { count: 1, resetAt: now + 10_000 });
    return true;
  }
  bucket.count++;
  if (bucket.count > 300) return false;
  return true;
}

// Item 33: Proteção de endpoints destrutivos (close, cancel, restart, clear)
function isAuthorizedDestructive(req: http.IncomingMessage): boolean {
  if (veioDaInternet(req)) return false;
  const ip = req.socket.remoteAddress || '';
  if (ip === '127.0.0.1' || ip === '::1' || ip.endsWith('127.0.0.1') || ip === '::ffff:127.0.0.1') return true;
  const ipsLocais = Object.values(os.networkInterfaces()).flatMap((items) => (items ?? []).map((item) => item.address));
  if (clienteEhMaquinaOperadora(ip, req.headers['x-client-machine'], process.env.COMPUTERNAME, ipsLocais)) return true;
  const key = req.headers['x-timing-key'] || req.headers['x-ops-key'] || req.headers['authorization'];
  const configPath = process.env.TIMING_AUTH_CONFIG_FILE || 'C:/Program Files/Kartodromo/Cronometragem/appsettings.json';
  let installedKey = '';
  try { installedKey = String((JSON.parse(readFileSync(configPath, 'utf8')) as { ChaveCronometragem?: unknown }).ChaveCronometragem ?? ''); } catch {}
  const expected = [process.env.TIMING_OPS_KEY, process.env.OPS_RECEPCAO_KEY, installedKey].filter((x): x is string => Boolean(x));
  if (typeof key === 'string' && expected.some((secret) => chaveOperadorValida(key, secret) || key.startsWith('Bearer ') && chaveOperadorValida(key.slice(7), secret))) return true;
  return false;
}

const server = http.createServer((req, res) => {
  recordOperatorMachine(req);
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);

  if (['/tv', '/tb50', '/tv-classica', '/api/state', '/api/livetime-snapshot'].includes(url.pathname)) {
    if (!checkRateLimit(req)) {
      res.writeHead(429, { 'content-type': 'application/json; charset=utf-8', 'retry-after': '2', 'cache-control': 'no-store' });
      return res.end(JSON.stringify({ error: 'Muitas requisições em sequência deste endereço. Aguarde alguns segundos.' }));
    }
  }

  if (veioDaInternet(req) && !((req.method === 'GET' || req.method === 'HEAD') && isAllowedPublicReadPath(url.pathname))) {
    res.writeHead(403, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    return res.end(JSON.stringify({ error: 'Acesso só pela rede do kartódromo.' }));
  }
  if (url.pathname === '/favicon.ico') {
    res.writeHead(204);
    return res.end();
  }
  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET,POST,PUT,PATCH', 'access-control-allow-headers': 'content-type, authorization, x-api-key' });
    return res.end();
  }
  if (url.pathname === '/' || url.pathname === '/operador') return sendFile(res, 'operador.html');
  if (['/admin', '/cadastros', '/ferramentas', '/configuracoes'].includes(url.pathname)) return sendFile(res, 'admin.html');
  if (url.pathname === '/tv') return sendFile(res, 'tv.html');
  if (url.pathname === '/tb50') return sendFile(res, 'tb50.html');
  // TV com navegador antigo (LG Netcast 2013): mesmo placar em ES5, sem o /tv moderno
  if (url.pathname === '/tv-classica') return sendFile(res, 'tv-classica.html');
  if (url.pathname === '/sorteio') return sendFile(res, 'sorteio.html');
  // design tokens (gerado de tokens/kib.tokens.json): as páginas de operação/relatório passam a ler cores e fontes daqui
  if (url.pathname === '/tokens.css') return sendFile(res, 'tokens.css');
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
  // endereço errado no navegador (ex.: /design): página com as telas que existem, em vez de "nao encontrado" cru
  const pagina404 = join(UI_DIR, 'nao-encontrado.html');
  if ((req.headers.accept ?? '').includes('text/html') && existsSync(pagina404)) {
    res.writeHead(404, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    return res.end(readFileSync(pagina404));
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
