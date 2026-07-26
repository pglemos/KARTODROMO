/**
 * Regenerates public/design/*.dc.html from the pristine Claude Design prototypes
 * vendored in design-source/.
 *
 * Only routing plumbing is applied on top of the prototypes — no visual edits.
 * Any change to the design must be made in the design tool and re-exported into
 * design-source/, never by hand-editing public/design/.
 *
 * Usage: node scripts/sync-design.mjs [--check]
 */
import { readFileSync, writeFileSync, readdirSync, copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const sourceDir = join(root, 'design-source');
const designDir = join(root, 'public', 'design');
const publicDir = join(root, 'public');

/** Prototype file basename -> public route served by next.config.ts */
const routes = {
  home: '/',
  pista: '/pista',
  'kart-locacao': '/kart-locacao',
  campeonatos: '/campeonatos',
  eventos: '/eventos',
  duvidas: '/duvidas',
  kac: '/kac',
  'kac-super': '/kac-super',
  '200-milhas': '/200-milhas',
  '500-milhas': '/500-milhas',
  'clube-vantagens': '/clube-vantagens',
  'clube-cadastro': '/clube-cadastro',
  'clube-consulta': '/clube-consulta',
  'clube-painel': '/clube-painel',
  'clube-corridas': '/clube-corridas',
  'clube-pontuacao': '/clube-pontuacao',
  'clube-catalogo': '/clube-catalogo',
  'clube-resgates': '/clube-resgates',
  'clube-perfil': '/clube-perfil',
  'clube-regulamento': '/clube-regulamento',
  'clube-campanhas': '/clube-campanhas',
};

/** Pages whose nav must expose the Clube de Vantagens entrance. */
const navPages = new Set([
  'home',
  'pista',
  'kart-locacao',
  'campeonatos',
  'eventos',
  'duvidas',
  'kac',
  'kac-super',
  '200-milhas',
  '500-milhas',
  'clube-vantagens',
]);

const sharedScripts = ['support.js', 'motion.js', 'clube-shared.js', 'admin-shared.js'];

/** Metadados canônicos das rotas públicas, compartilhados com o app Next. */
const routeMetadata = JSON.parse(readFileSync(join(root, 'src', 'config', 'public-routes.json'), 'utf8'));
const metadataByPath = new Map(routeMetadata.map((route) => [route.path, route]));
const siteOrigin = 'https://kartodromodebetim.com.br';

const escapeHtml = (value) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * Os protótipos não trazem `<title>`, descrição ou canonical. Sem isso o site
 * perde SEO, então o gerador injeta os metadados canônicos do registro de rotas.
 * Páginas marcadas `coming-soon` (portal do Clube, ainda sem autenticação e com
 * saldo de demonstração) saem com `noindex`.
 */
function seoHead(page) {
  const route = metadataByPath.get(routes[page]);
  if (!route) return '';

  const canonical = `${siteOrigin}${route.path === '/' ? '' : route.path}`;
  const robots = route.availability === 'active' ? 'index, follow' : 'noindex, follow, noarchive';

  return (
    `<title>${escapeHtml(route.title)}</title>\n` +
    `<meta name="description" content="${escapeHtml(route.description)}">\n` +
    `<meta name="robots" content="${robots}">\n` +
    `<link rel="canonical" href="${canonical}">\n` +
    `<meta property="og:type" content="website">\n` +
    `<meta property="og:locale" content="pt_BR">\n` +
    `<meta property="og:site_name" content="Kartódromo Internacional de Betim">\n` +
    `<meta property="og:title" content="${escapeHtml(route.title)}">\n` +
    `<meta property="og:description" content="${escapeHtml(route.description)}">\n` +
    `<meta property="og:url" content="${canonical}">\n` +
    `<meta property="og:image" content="${siteOrigin}/posters/home-karting.jpg">\n` +
    `<meta name="twitter:card" content="summary_large_image">\n`
  );
}

const navLocacao = "      { label: 'Locação', href: '/kart-locacao', id: 'locacao' },\n";
const navBeneficios = "      { label: 'BENEFÍCIOS', href: '/clube-vantagens', id: 'clube' },\n";
const navPista = "      { label: 'A Pista', href: '/pista', id: 'pista' },\n";
const navDuvidas = "      { label: 'Dúvidas', href: '/duvidas', id: 'duvidas' },\n";
const navClubeProto = "      { label: 'Clube', href: '/clube-vantagens', id: 'clube' },\n";

/**
 * The prototypes are authored desktop-only (no breakpoints), so on phones their
 * multi-column grids and fixed rows overflow and get clipped. This layer only
 * applies below 720px — the design above that width stays byte-for-byte the
 * prototype's.
 */
const mobileFitStyle = `<style data-generated="mobile-fit">
@media (max-width: 720px) {
  [style*="grid-template-columns"] { grid-template-columns: 1fr !important; }
  [style*="grid-auto-flow:column"], [style*="grid-auto-flow: column"] { grid-auto-flow: row !important; }
  [style*="display:flex"]:not([style*="flex-wrap:nowrap"]) { flex-wrap: wrap; }
  img, video, iframe, canvas, svg, table { max-width: 100%; }
  [style*="white-space:nowrap"] { white-space: normal; }

  /* Alvo de toque mínimo de 44px nos links e botões de navegação. */
  header a, header button, nav a, nav button, footer a {
    min-height: 44px;
    display: inline-flex;
    align-items: center;
  }
  [style*="min-height:32px"], [style*="min-height: 32px"],
  [style*="min-height:34px"], [style*="min-height: 34px"],
  [style*="min-height:38px"], [style*="min-height: 38px"],
  [style*="min-height:40px"], [style*="min-height: 40px"] { min-height: 44px !important; }
  header a:not([style*="width"]), header button { padding-inline: 12px; }
  :is(div, section, article, main, aside) > a[style*="font-weight:700"]:not([style*="min-height"]),
  :is(div, section, article, main, aside) > a[style*="font-weight: 700"]:not([style*="min-height"]) {
    min-height: 44px;
    display: inline-flex !important;
    align-items: center;
  }
  input[type="checkbox"], input[type="radio"] {
    width: 24px !important;
    height: 24px !important;
    flex: none;
  }

  /* Legibilidade: nada abaixo de 11px no celular. */
  small { font-size: 11px !important; }
  [style*="font-size:9px"], [style*="font-size: 9px"],
  [style*="font-size:9.5px"], [style*="font-size: 9.5px"],
  [style*="font-size:10px"], [style*="font-size: 10px"],
  [style*="font-size:10.5px"], [style*="font-size: 10.5px"] { font-size: 11px !important; }

  /* Evita o zoom automático do iOS ao focar um campo. */
  input, select, textarea { font-size: 16px !important; }

  /* Faixas que rolam na horizontal ganham rolagem suave por toque. */
  [style*="overflow-x:auto"], [style*="overflow-x: auto"] {
    -webkit-overflow-scrolling: touch;
    scroll-behavior: smooth;
  }
}
</style>
`;

/** No celular a faixa de abas do portal rola: centraliza a aba da página atual. */
const clubTabScript = `<script data-generated="club-tab-focus">(function(){function focusTab(){var nav=document.querySelector('nav[aria-label="Menu do portal"]');if(!nav)return false;var current=nav.querySelector('a[href="'+location.pathname+'"]');if(!current)return false;if(nav.scrollWidth>nav.clientWidth+1){var offset=current.offsetLeft-(nav.clientWidth-current.offsetWidth)/2;nav.scrollTo({left:Math.max(0,offset),behavior:'auto'})}current.setAttribute('aria-current','page');return true}if(!focusTab()){var tries=0;var timer=setInterval(function(){if(focusTab()||++tries>40)clearInterval(timer)},100)}})();</script>
`;

/** Keeps the address bar on the clean route when the static prototype is served. */
function cleanUrlScript() {
  const map = JSON.stringify(routes);
  return (
    '<script>(function(){var n=location.pathname.split("/").pop();' +
    'n=n.endsWith(".html")?n.slice(0,-5):n;n=n.endsWith(".dc")?n.slice(0,-3):n;' +
    `var m=${map};` +
    'if(m[n]&&location.pathname!==m[n])history.replaceState(null,"",m[n]+location.hash)})();</script>\n'
  );
}

function rewriteLinks(html) {
  return html.replace(/(["'])([a-z0-9-]+)\.dc\.html\1/g, (match, quote, page) =>
    routes[page] ? `${quote}${routes[page]}${quote}` : match,
  );
}

function patchNavigation(html) {
  let out = html.replace(navClubeProto, navBeneficios);

  if (!out.includes(navBeneficios) && out.includes(navDuvidas)) {
    out = out.replace(navDuvidas, `${navBeneficios}${navDuvidas}`);
  }
  if (!out.includes(navLocacao) && out.includes(navPista)) {
    out = out.replace(navPista, `${navPista}${navLocacao}`);
  }
  return out;
}

function build(page, source) {
  let html = source.replace('<head>\n', '<head>\n<base href="/">\n');
  html = rewriteLinks(html);

  if (navPages.has(page)) {
    html = patchNavigation(html);
  }
  if (routes[page]) {
    // A descrição canônica passa a ser a do registro de rotas, sem duplicar a do protótipo.
    html = html.replace(/\n\s*<meta name="description" content="(?:[^"\\]|\\.)*">(?=\n)/, '');
    html = html.replace('<base href="/">\n', `<base href="/">\n${seoHead(page)}`);
    html = html.replace('</head>', `${mobileFitStyle}</head>`);
    html = html.replace('</body>', `${cleanUrlScript()}</body>`);

    if (page.startsWith('clube-')) {
      html = html.replace('</body>', `${clubTabScript}</body>`);
    }
  }
  return html;
}

export { routes };

/** Só executa a sincronização quando chamado direto (`node scripts/sync-design.mjs`). */
if (!process.argv[1]?.endsWith('sync-design.mjs')) {
  // Importado por um teste apenas para ler o mapa de rotas.
} else {
  run();
}

function run() {
const pages = readdirSync(sourceDir).filter((file) => file.endsWith('.dc.html'));
const check = process.argv.includes('--check');
const stale = [];

for (const file of pages) {
  const page = file.replace('.dc.html', '');
  const expected = build(page, readFileSync(join(sourceDir, file), 'utf8'));
  const target = join(designDir, file);
  const current = (() => {
    try {
      return readFileSync(target, 'utf8');
    } catch {
      return null;
    }
  })();

  if (current === expected) continue;
  if (check) {
    stale.push(file);
    continue;
  }
  writeFileSync(target, expected);
}

for (const script of sharedScripts) {
  const expected = readFileSync(join(sourceDir, script));
  const target = join(publicDir, script);
  if (check) {
    let current = null;
    try {
      current = readFileSync(target);
    } catch {
      current = null;
    }
    if (current === null || !current.equals(expected)) stale.push(script);
    continue;
  }
  copyFileSync(join(sourceDir, script), target);
}

if (check && stale.length > 0) {
  console.error(`Arquivos fora de sincronia com design-source/: ${stale.join(', ')}`);
  console.error('Rode: npm run sync:design');
  process.exit(1);
}

console.log(
  check
    ? `public/design está em sincronia com design-source (${pages.length} telas).`
    : `Sincronizadas ${pages.length} telas de design-source para public/design.`,
);
}
