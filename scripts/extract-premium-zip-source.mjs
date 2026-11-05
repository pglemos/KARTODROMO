import { execFileSync } from 'node:child_process';
import { mkdir, rm } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const defaultRoot = resolve(here, '..');

export async function extractPremiumSource({ root = defaultRoot, force = true } = {}) {
  const archive = join(
    root,
    'premium-src',
    'kartodromo-betim-premium-revisado-final-text-source.tar.gz',
  );
  const destination = join(root, 'premium-src', 'kartodromo-betim-premium-revisado-final');

  if (force) await rm(destination, { recursive: true, force: true });
  await mkdir(destination, { recursive: true });
  execFileSync('tar', ['-xzf', archive, '-C', destination], {
    cwd: root,
    stdio: 'pipe',
  });
  return destination;
}

const isDirectExecution =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectExecution) {
  const destination = await extractPremiumSource();
  console.log(`Pacote final do ZIP extraído em ${destination}`);
}
