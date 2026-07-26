#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import {
  extractEntriesFromSnapshot,
  publishRaceResult,
  readExistingRaces,
} from './lib/race-results.mjs';

const SNAPSHOT_ENDPOINT = process.env.LIVETIME_SNAPSHOT_ENDPOINT || 'http://localhost:4010/api/livetime-snapshot';
const POLL_MS = Number(process.env.RESULTS_WATCH_POLL_MS || 10000);
const STABLE_MS = Number(process.env.RESULTS_WATCH_STABLE_MS || 300000);
const MIN_ENTRIES = Number(process.env.RESULTS_WATCH_MIN_ENTRIES || 3);
const STATE_FILE = process.env.RESULTS_WATCH_STATE_FILE || '.runtime/results-watcher-state.json';
const FINAL_STATUSES = new Set(['final', 'finished', 'completed', 'encerrada', 'encerrado']);
const DEFAULT_CHAMPIONSHIPS = [
  {
    id: 'kac',
    name: 'KAC Iniciantes',
    season: '2026',
    eventPattern: '\\bKAC\\b',
    roundsByDate: {
      '2026-06-06': 1,
      '2026-06-07': 2,
      '2026-06-13': 3,
      '2026-06-14': 4,
      '2026-06-20': 5,
      '2026-06-21': 6,
      '2026-06-27': 7,
      '2026-06-28': 8,
    },
  },
];

const parseChampionships = () => {
  if (!process.env.RESULTS_CHAMPIONSHIPS_JSON) return DEFAULT_CHAMPIONSHIPS;

  const configs = JSON.parse(process.env.RESULTS_CHAMPIONSHIPS_JSON);
  if (!Array.isArray(configs) || configs.length === 0) throw new Error('RESULTS_CHAMPIONSHIPS_JSON deve ser uma lista.');
  return configs;
};

const championships = parseChampionships().map((config) => ({
  ...config,
  matcher: new RegExp(config.eventPattern, 'i'),
}));

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
const eventKey = (snapshot) => `${snapshot.eventName || 'sem-evento'}|${snapshot.trackName || 'sem-tracado'}`;
const fingerprint = (snapshot) => JSON.stringify(
  (snapshot.drivers || []).map(({ position, kart, name, time }) => [position, kart, name, time]),
);

const loadState = async () => {
  try {
    return JSON.parse(await readFile(STATE_FILE, 'utf8'));
  } catch {
    return { publishedEvents: {}, candidates: {} };
  }
};

const saveState = async (state) => {
  await mkdir(dirname(STATE_FILE), { recursive: true });
  await writeFile(STATE_FILE, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
};

const inferRound = async (config, date) => {
  if (Number.isFinite(Number(config.roundsByDate?.[date]))) return Number(config.roundsByDate[date]);

  const races = await readExistingRaces(config.id);
  const rounds = races.map((race) => Number(race.round)).filter((round) => Number.isFinite(round));
  return rounds.length > 0 ? Math.max(...rounds) + 1 : 1;
};

const publishCandidate = async (config, candidate, state, reason) => {
  const entries = extractEntriesFromSnapshot(candidate.snapshot);
  if (entries.length < MIN_ENTRIES) {
    console.log(`[results-watcher] Ignorando ${candidate.eventKey}: apenas ${entries.length} pilotos validos.`);
    return;
  }

  const date = candidate.date;
  const round = await inferRound(config, date);
  const published = await publishRaceResult({
    championshipId: config.id,
    championshipName: config.name,
    season: config.season || String(new Date().getFullYear()),
    title: `${config.name}${round ? ` - Corrida ${round}` : ''}`,
    date,
    round,
    status: 'final',
    source: SNAPSHOT_ENDPOINT,
    generatedAt: new Date().toISOString(),
    eventName: candidate.snapshot.eventName,
    trackName: candidate.snapshot.trackName,
    entries,
  });

  state.publishedEvents[config.id] = {
    eventKey: candidate.eventKey,
    publishedAt: new Date().toISOString(),
    archive: published.archiveBlob.pathname,
  };
  delete state.candidates[config.id];
  await saveState(state);
  console.log(`[results-watcher] Publicado ${config.id} corrida ${round}: ${entries[0].name} venceu (${reason}).`);
};

const processSnapshot = async (snapshot, state) => {
  const snapshotEventKey = eventKey(snapshot);
  const snapshotFingerprint = fingerprint(snapshot);
  const sessionType = String(snapshot.sessionType || '').toLowerCase();
  const status = String(snapshot.status || '').toLowerCase();

  for (const config of championships) {
    const candidate = state.candidates[config.id];
    const matches = config.matcher.test(String(snapshot.eventName || '')) && sessionType !== 'qualifying';

    if (!matches) {
      if (candidate && state.publishedEvents[config.id]?.eventKey !== candidate.eventKey) {
        await publishCandidate(config, candidate, state, 'troca de sessao');
      }
      continue;
    }

    if (state.publishedEvents[config.id]?.eventKey === snapshotEventKey) continue;

    if (candidate && candidate.eventKey !== snapshotEventKey) {
      await publishCandidate(config, candidate, state, 'nova corrida detectada');
    }

    const current = state.candidates[config.id];
    const now = Date.now();
    const nextCandidate = current?.eventKey === snapshotEventKey
      ? {
          ...current,
          snapshot,
          lastSeenAt: now,
          lastChangedAt: current.fingerprint === snapshotFingerprint ? current.lastChangedAt : now,
          fingerprint: snapshotFingerprint,
        }
      : {
          eventKey: snapshotEventKey,
          date: today(),
          snapshot,
          fingerprint: snapshotFingerprint,
          firstSeenAt: now,
          lastSeenAt: now,
          lastChangedAt: now,
        };

    state.candidates[config.id] = nextCandidate;
    await saveState(state);

    if (FINAL_STATUSES.has(status)) {
      await publishCandidate(config, nextCandidate, state, `status ${status}`);
    } else if (STABLE_MS > 0 && now - nextCandidate.lastChangedAt >= STABLE_MS) {
      await publishCandidate(config, nextCandidate, state, `${Math.round(STABLE_MS / 1000)}s sem alteracao`);
    }
  }
};

const main = async () => {
  if (!process.env.BLOB_READ_WRITE_TOKEN) throw new Error('Defina BLOB_READ_WRITE_TOKEN para iniciar o watcher.');

  const state = await loadState();
  console.log(`[results-watcher] Monitorando ${SNAPSHOT_ENDPOINT} a cada ${POLL_MS}ms.`);

  while (true) {
    try {
      const response = await fetch(SNAPSHOT_ENDPOINT, { signal: AbortSignal.timeout(Math.max(POLL_MS, 5000)) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      await processSnapshot(await response.json(), state);
    } catch (error) {
      console.error(`[results-watcher] ${error instanceof Error ? error.message : error}`);
    }

    await sleep(POLL_MS);
  }
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
