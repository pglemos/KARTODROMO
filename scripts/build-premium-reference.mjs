import { access, cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const output = resolve(process.argv[2] || join(root, 'premium-dist'));
const publicDir = join(root, 'public');
const designDir = join(publicDir, 'design');
const responsivePatch = await readFile(
  join(root, 'premium-src/reference-responsive-patch.css'),
  'utf8',
);

const pages = [
  'home.dc.html',
  'pista.dc.html',
  'kart-locacao.dc.html',
  'campeonatos.dc.html',
  'eventos.dc.html',
  'duvidas.dc.html',
  'kac.dc.html',
  'kac-super.dc.html',
  '200-milhas.dc.html',
  '500-milhas.dc.html',
];

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

for (const page of pages) {
  await access(join(designDir, page));
}

await cp(designDir, join(output, 'design'), { recursive: true });
await cp(join(publicDir, 'assets'), join(output, 'assets'), { recursive: true });

for (const helper of ['support.js', 'motion.js', 'beneficios-nav.css']) {
  const source = join(publicDir, helper);
  await access(source);
  await cp(source, join(output, helper));
}

const patchTag = `<style id="kib-reference-responsive-recovery">\n${responsivePatch}\n</style>`;
for (const page of pages) {
  const target = join(output, 'design', page);
  const html = await readFile(target, 'utf8');
  const patched = html.includes('</helmet>')
    ? html.replace('</helmet>', `${patchTag}\n</helmet>`)
    : html.replace('</head>', `${patchTag}\n</head>`);
  await writeFile(target, patched);
}

const routes = [
  '/', '/pista', '/kart-locacao', '/campeonatos', '/eventos', '/duvidas',
  '/kac', '/kac-super', '/200-milhas', '/500-milhas',
];
const site = 'https://kartodromodebetim.com.br';
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/sitemap/0.9">\n${routes.map((route) => `  <url><loc>${site}${route === '/' ? '/' : route}</loc><changefreq>weekly</changefreq><priority>${route === '/' ? '1.0' : '0.8'}</priority></url>`).join('\n')}\n</urlset>\n`;
await writeFile(join(output, 'sitemap.xml'), sitemap);
await writeFile(join(output, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /design/\nSitemap: ${site}/sitemap.xml\n`);
await writeFile(join(output, '_headers'), `/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  Permissions-Policy: camera=(), microphone=(), geolocation=()\n\n/assets/*\n  Cache-Control: public, max-age=31536000, immutable\n\n/support.js\n  Cache-Control: public, max-age=31536000, immutable\n\n/motion.js\n  Cache-Control: public, max-age=31536000, immutable\n\n/beneficios-nav.css\n  Cache-Control: public, max-age=31536000, immutable\n\n/design/*\n  X-Robots-Tag: noindex, nofollow, noarchive\n  Cache-Control: no-store\n`);

const notFound = await readFile(join(output, 'design', 'home.dc.html'), 'utf8');
const fallback = notFound
  .replace(/<title>[\s\S]*?<\/title>/i, '<title>Página não encontrada | Kartódromo de Betim</title>')
  .replace('<body>', '<body><script>location.replace("/")</script>');
await writeFile(join(output, '404.html'), fallback);

console.log(`Páginas premium originais copiadas para ${output}`);
console.log(`${pages.length} referências oficiais com correção responsiva aplicada.`);
