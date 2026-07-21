import { createHash } from 'node:crypto';
import { access, cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractPremiumSource } from './extract-premium-zip-source.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const output = resolve(process.argv[2] || join(root, 'premium-dist'));
const publicDir = join(root, 'public');
const sourceRoot = await extractPremiumSource({ root, force: true });

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
];

const routes = [
  '/', '/pista', '/kart-locacao', '/campeonatos', '/eventos', '/duvidas',
  '/kac', '/kac-super', '/200-milhas', '/500-milhas',
];

const sha256 = async (path) =>
  createHash('sha256').update(await readFile(path)).digest('hex');

const exists = async (path) => {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
};

const copyFile = async (source, destination) => {
  await mkdir(dirname(destination), { recursive: true });
  await cp(source, destination);
};

const manifestPath = join(sourceRoot, 'MANIFEST-SHA256.txt');
const manifest = await readFile(manifestPath, 'utf8');
const manifestEntries = manifest
  .split(/\r?\n/)
  .filter(Boolean)
  .map((line) => {
    const match = line.match(/^([a-f0-9]{64})\s+\.\/(.+)$/);
    if (!match) throw new Error(`Linha inválida no manifesto: ${line}`);
    return { expectedHash: match[1], relativePath: match[2] };
  });

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

for (const { expectedHash, relativePath } of manifestEntries) {
  const extractedPath = join(sourceRoot, relativePath);
  const publicPath = join(publicDir, relativePath);
  const sourcePath = (await exists(extractedPath)) ? extractedPath : publicPath;

  if (!(await exists(sourcePath))) {
    throw new Error(`Arquivo exigido pelo ZIP não existe no repositório: ${relativePath}`);
  }

  const actualHash = await sha256(sourcePath);
  if (actualHash !== expectedHash) {
    throw new Error(
      `Hash divergente em ${relativePath}: esperado ${expectedHash}, recebido ${actualHash}`,
    );
  }

  if (relativePath.startsWith('assets/')) {
    await copyFile(sourcePath, join(output, relativePath));
    await copyFile(sourcePath, join(output, 'site', relativePath));
  } else {
    await copyFile(sourcePath, join(output, 'site', relativePath));
  }
}

await copyFile(manifestPath, join(output, 'site', 'MANIFEST-SHA256.txt'));
for (const page of pages) await access(join(output, 'site', page));

const site = 'https://kartodromodebetim.com.br';
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/sitemap/0.9">\n${routes.map((route) => `  <url><loc>${site}${route === '/' ? '/' : route}</loc><changefreq>weekly</changefreq><priority>${route === '/' ? '1.0' : '0.8'}</priority></url>`).join('\n')}\n</urlset>\n`;
await writeFile(join(output, 'sitemap.xml'), sitemap);
await writeFile(
  join(output, 'robots.txt'),
  `User-agent: *\nAllow: /\nDisallow: /site/\nSitemap: ${site}/sitemap.xml\n`,
);
await writeFile(
  join(output, '_headers'),
  `/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  Permissions-Policy: camera=(), microphone=(), geolocation=()\n\n/assets/*\n  Cache-Control: public, max-age=31536000, immutable\n\n/site/*\n  X-Robots-Tag: noindex, nofollow, noarchive\n  Cache-Control: no-store\n`,
);

const notFound = await readFile(join(sourceRoot, 'index.html'), 'utf8');
const fallback = notFound
  .replace(/<title>[\s\S]*?<\/title>/i, '<title>Página não encontrada | Kartódromo de Betim</title>')
  .replace('<body', '<body><script>location.replace("/")</script><div hidden')
  .replace('</body>', '</div></body>');
await writeFile(join(output, '404.html'), fallback);

console.log(`Pacote premium final do ZIP publicado em ${output}`);
console.log(`${pages.length} páginas preservadas byte a byte e ativos validados por SHA-256.`);
