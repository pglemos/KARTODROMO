import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

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

const { provisionViplexHtmlProgram, startViplexProgram } = await import('../lib/viplex-programs');
const name = process.argv[2] || process.env.VIPLEX_STREAM_PROGRAM_NAME || 'CRONOMETRAGEM';
const provisioned = await provisionViplexHtmlProgram(name);
const started = await startViplexProgram(provisioned.identifier);

console.log(
  JSON.stringify({
    ok: true,
    program: provisioned.name,
    identifier: started.identifier,
    mode: started.mode,
    scoreboardUrl: process.env.TB50_SCOREBOARD_URL || 'configured-default',
  }),
);
