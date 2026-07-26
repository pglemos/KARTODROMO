#!/usr/bin/env node
import { writeFile } from 'node:fs/promises';
import {
  buildStandings,
  extractEntriesFromHtml,
  publishRaceResult,
  readExistingRaces,
} from './lib/race-results.mjs';

const DEFAULT_SOURCE_URL = 'http://192.168.20.254/laptimewebtv/livetime';
const DEFAULT_CHAMPIONSHIP = 'kac';
const DEFAULT_CHAMPIONSHIP_NAME = 'KAC Iniciantes';
const DEFAULT_SEASON = '2026';
const args = new Map();
const flags = new Set();

for (let index = 2; index < process.argv.length; index += 1) {
  const arg = process.argv[index];
  if (!arg.startsWith('--')) continue;

  const key = arg.slice(2);
  const next = process.argv[index + 1];

  if (!next || next.startsWith('--')) {
    flags.add(key);
  } else {
    args.set(key, next);
    index += 1;
  }
}

const main = async () => {
  const sourceUrl = args.get('source-url') || process.env.LIVETIME_SOURCE_URL || DEFAULT_SOURCE_URL;
  const championshipId = args.get('championship') || DEFAULT_CHAMPIONSHIP;
  const championshipName = args.get('championship-name') || DEFAULT_CHAMPIONSHIP_NAME;
  const season = args.get('season') || DEFAULT_SEASON;
  const date = args.get('date') || new Date().toISOString().slice(0, 10);
  const round = args.has('round') ? Number(args.get('round')) : undefined;
  const status = args.get('status') || 'final';
  const title = args.get('title') || `${championshipName}${round ? ` - Corrida ${round}` : ''}`;
  const response = await fetch(sourceUrl);

  if (!response.ok) throw new Error(`Falha ao ler LiveTime: HTTP ${response.status}`);

  const entries = extractEntriesFromHtml(await response.text());
  if (entries.length === 0) throw new Error('Nenhum piloto foi encontrado no HTML do LiveTime.');

  let result = {
    championshipId,
    championshipName,
    season,
    title,
    date,
    round,
    status,
    source: sourceUrl,
    generatedAt: new Date().toISOString(),
    entries,
  };

  if (flags.has('upload')) {
    const published = await publishRaceResult(result);
    result = published.result;
    console.log(JSON.stringify({
      ok: true,
      archive: published.archiveBlob.pathname,
      latest: published.latestBlob.pathname,
      winner: result.entries[0],
    }, null, 2));
  } else {
    const races = [...await readExistingRaces(championshipId), result];
    result.standings = buildStandings(races);
    console.log(JSON.stringify({
      ok: true,
      winner: result.entries[0],
      entries: result.entries.length,
      standings: result.standings.length,
    }, null, 2));
  }

  if (args.has('out')) {
    await writeFile(args.get('out'), `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  }
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
