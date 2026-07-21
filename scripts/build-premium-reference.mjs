import { createHash } from 'node:crypto';
import { access, cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const output = resolve(process.argv[2] || join(root, 'premium-dist'));
const publicDir = join(root, 'public');
const sourceRoot = join(root, 'premium-src', 'kartodromo-betim-premium-revisado-final');
const partsRoot = join(root, 'premium-src', 'source-parts');

const assembledFiles = new Map([
  ['index.html', 'index.html.part-'],
  ['pista.html', 'pista.html.part-'],
  ['kart-locacao.html', 'kart-locacao.html.part-'],
  ['assets/css/site.css', 'assets__css__site.css.part-'],
]);
const publicRoutes = ['/', '/pista', '/kart-locacao', '/campeonatos', '/eventos', '/duvidas', '/kac', '/kac-super', '/200-milhas', '/500-milhas'];
const pages = ['index.html', 'pista.html', 'kart-locacao.html', 'campeonatos.html', 'eventos.html', 'duvidas.html', 'kac.html', 'kac-super.html', '200-milhas.html', '500-milhas.html'];
const sha256 = async (path) => createHash('sha256').update(await readFile(path)).digest('hex');
const exists = async (path) => { try { await access(path); return true; } catch { return false; } };
const copyFile = async (source, destination) => { await mkdir(dirname(destination), { recursive: true }); await cp(source, destination); };

async function assembleSegmentedSources() {
  const availableParts = await readdir(partsRoot);
  for (const [relativePath, prefix] of assembledFiles) {
    const matchingParts = availableParts.filter((file) => file.startsWith(prefix)).sort((left, right) => left.localeCompare(right, 'en'));
    if (!matchingParts.length) throw new Error(`Nenhuma parte encontrada para ${relativePath}`);
    const buffers = await Promise.all(matchingParts.map((file) => readFile(join(partsRoot, file))));
    const target = join(sourceRoot, relativePath);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, Buffer.concat(buffers));
  }
}

await assembleSegmentedSources();
const manifestPath = join(sourceRoot, 'MANIFEST-SHA256.txt');
const manifestEntries = (await readFile(manifestPath, 'utf8')).split(/\r?\n/).filter(Boolean).map((line) => {
  const match = line.match(/^([a-f0-9]{64})\s+\.\/(.+)$/);
  if (!match) throw new Error(`Linha inválida no manifesto: ${line}`);
  return { expectedHash: match[1], relativePath: match[2] };
});

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (const { expectedHash, relativePath } of manifestEntries) {
  const canonicalPath = join(sourceRoot, relativePath);
  const repositoryAssetPath = join(publicDir, relativePath);
  const sourcePath = (await exists(canonicalPath)) ? canonicalPath : repositoryAssetPath;
  if (!(await exists(sourcePath))) throw new Error(`Arquivo exigido pelo ZIP não existe: ${relativePath}`);
  const actualHash = await sha256(sourcePath);
  if (actualHash !== expectedHash) throw new Error(`Hash divergente em ${relativePath}: esperado ${expectedHash}, recebido ${actualHash}`);
  if (relativePath.startsWith('assets/')) {
    await copyFile(sourcePath, join(output, relativePath));
    await copyFile(sourcePath, join(output, 'site', relativePath));
  } else {
    await copyFile(sourcePath, join(output, 'site', relativePath));
  }
}
await copyFile(manifestPath, join(output, 'site', 'MANIFEST-SHA256.txt'));
for (const page of pages) await access(join(output, 'site', page));

const canonicalSite = 'https://kartodromodebetim.com.br';
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/sitemap/0.9">\n${publicRoutes.map((route) => `  <url><loc>${canonicalSite}${route}</loc><changefreq>weekly</changefreq><priority>${route === '/' ? '1.0' : '0.8'}</priority></url>`).join('\n')}\n</urlset>\n`;
await writeFile(join(output, 'sitemap.xml'), sitemap);
await writeFile(join(output, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /site/\nSitemap: ${canonicalSite}/sitemap.xml\n`);
await writeFile(join(output, '_headers'), `/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  Permissions-Policy: camera=(), microphone=(), geolocation=()\n\n/assets/*\n  Cache-Control: public, max-age=31536000, immutable\n\n/site/*\n  X-Robots-Tag: noindex, nofollow, noarchive\n  Cache-Control: no-store\n`);
await writeFile(join(output, '404.html'), '<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Página não encontrada</title><body><script>location.replace("/")</script><noscript><a href="/">Voltar ao início</a></noscript></body></html>');
console.log(`Pacote premium final do ZIP publicado em ${output}`);
console.log(`${pages.length} páginas e ${manifestEntries.length} arquivos validados por SHA-256.`);
