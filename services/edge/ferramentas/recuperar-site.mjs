/**
 * Recupera o pacote PUBLICADO do Worker kartodromo-site-2026 (o fonte não está no repo; ver
 * docs/operacao/patches-producao/README.md) para site-deploy/: worker.js + módulo da política (do bundle baixado pela API)
 * e os assets por varredura do site no ar: cada rota, as referências dentro de HTML/JS/CSS e uma lista extra de caminhos
 * (ex.: os /media/* vistos no analytics). O HTML é salvo como o asset original (script antigo, sem o beacon da Cloudflare).
 * Uso: node recuperar-site.mjs <bundle-multipart.js> <pasta-saida> [lista-extra.txt]
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

const [bundle, saida, extra] = process.argv.slice(2);
const ORIGEM = 'https://kartodromodebetim.com.br';
const multipart = readFileSync(bundle, 'latin1');
const fronteira = multipart.slice(0, multipart.indexOf('\r\n'));
const partes = multipart.split(fronteira).filter((p) => p.includes('Content-Disposition'));
const modulos = {};
for (const p of partes) {
  const nome = p.match(/name="([^"]+)"/)[1];
  const corpo = p.slice(p.indexOf('\r\n\r\n') + 4).replace(/\r\n$/, '');
  modulos[nome] = Buffer.from(corpo, 'latin1');
}
mkdirSync(join(saida, 'dist'), { recursive: true });
for (const [n, b] of Object.entries(modulos)) writeFileSync(join(saida, n.replace(/^\.\//, '')), b);
const worker = modulos['worker.js'].toString('utf8');
const JS_VELHO = worker.match(/var JS_VELHO = "([^"]+)"/)[1];
const JS_NOVO = worker.match(/var JS_NOVO = "([^"]+)"/)[1];
const rotas = [...worker.matchAll(/path: "([^"]+)"/g)].map((m) => m[1]);
console.log('módulos:', Object.keys(modulos).join(', '), '| rotas:', rotas.length);

const vistos = new Set();
const fila = [];
const salvar = (caminho, buf) => { const f = join(saida, 'dist', caminho); mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, buf); };
const refs = (txt) => [...txt.matchAll(/["'(\s=](\/(?:media|ui-assets)\/[^"'()\s\\<>]+?)(?=["'()\s\\<>])/g)].map((m) => m[1].replace(/[?#].*$/, ''));

let falhas = 0;
for (const r of rotas) {
  const res = await fetch(ORIGEM + r, { redirect: 'manual' });
  if (res.status !== 200) { console.log('rota', r, res.status); falhas++; continue; }
  let html = await res.text();
  html = html.replace(/<script[^>]*cloudflareinsights[^<]*<\/script>/g, '').replace(/\n  \n<\/body>/, '\n</body>').split(JS_NOVO).join(JS_VELHO);
  salvar(r === '/' ? 'index.html' : `${r.slice(1)}/index.html`, html);
  for (const x of refs(html)) fila.push(x);
}
fila.push('/sitemap.xml', '/robots.txt');
// o pacote da política (JS_NOVO) vem do bundle; as referências dele também entram
for (const b of Object.values(modulos)) for (const x of refs(b.toString('utf8'))) fila.push(x);
if (extra && existsSync(extra)) for (const l of readFileSync(extra, 'utf8').split('\n')) if (l.trim()) fila.push(l.trim());
while (fila.length) {
  const p = fila.shift();
  if (vistos.has(p) || p === JS_NOVO) continue;
  vistos.add(p);
  const res = await fetch(ORIGEM + encodeURI(decodeURI(p)));
  if (res.status !== 200) { console.log('falta', p, res.status); falhas++; continue; }
  const buf = Buffer.from(await res.arrayBuffer());
  salvar(decodeURI(p).slice(1), buf);
  if (/\.(js|css|html|svg|json|xml|webmanifest)$/.test(p)) for (const x of refs(buf.toString('utf8'))) if (!vistos.has(x)) fila.push(x);
}
console.log('arquivos:', vistos.size, 'falhas:', falhas);
