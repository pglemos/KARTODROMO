#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { publishRaceResult } from './lib/race-results.mjs';

const file = process.argv[2];

if (!file) {
  console.error('Uso: node scripts/publish-result-file.mjs <arquivo.json>');
  process.exit(1);
}

try {
  const payload = JSON.parse(await readFile(file, 'utf8'));
  const published = await publishRaceResult(payload);

  console.log(JSON.stringify({
    ok: true,
    archive: published.archiveBlob.pathname,
    latest: published.latestBlob.pathname,
    winner: published.result.entries[0],
  }, null, 2));
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
