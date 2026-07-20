import { appendFile, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const output = resolve(process.argv[2] || join(root, 'premium-dist'));

await import('./build-premium-static.mjs');

const overrides = await readFile(join(root, 'premium-src/site-overrides.css'), 'utf8');
await appendFile(join(output, 'assets/css/site.css'), `\n\n/* Recovery overrides */\n${overrides}`);

const pages = [
  'index.html',
  'pista.html',
  'kart-locacao.html',
  'campeonatos.html',
  'eventos.html',
  'duvidas.html',
  'kac.html',
  'kac-super.html',
  '200-milhas.html',
  '500-milhas.html',
  '404.html',
];

const bootstrap = `<script>document.documentElement.classList.add('js')</script>`;
for (const page of pages) {
  const path = join(output, page);
  const html = await readFile(path, 'utf8');
  if (!html.includes(bootstrap)) {
    await writeFile(path, html.replace('<head>', `<head>${bootstrap}`));
  }
}

console.log('Overrides de segurança e progressive enhancement aplicados.');
