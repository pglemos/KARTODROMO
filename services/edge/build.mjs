#!/usr/bin/env node
/**
 * Build do kart-edge: empacota cada Worker listado em edge.config.json (esbuild, ESM para Node), copia os assets e gera
 * dist/manifest.json com rotas e bindings tirados do próprio wrangler.jsonc. O servidor também vira um arquivo só.
 * Uso: node services/edge/build.mjs   (gera services/edge/dist)
 */
import { build } from 'esbuild';
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const AQUI = import.meta.dirname;
const RAIZ = resolve(AQUI, '..', '..');
const DIST = join(AQUI, 'dist');
const config = JSON.parse(readFileSync(join(AQUI, 'edge.config.json'), 'utf8'));

/** JSONC → JSON: tira comentários (fora de strings) e vírgulas finais. */
function jsonc(txt) {
  let out = '';
  let s = false;
  for (let i = 0; i < txt.length; i++) {
    const c = txt[i];
    if (s) { out += c; if (c === '\\') { out += txt[++i]; } else if (c === '"') s = false; continue; }
    if (c === '"') { s = true; out += c; continue; }
    if (c === '/' && txt[i + 1] === '/') { while (i < txt.length && txt[i] !== '\n') i++; out += '\n'; continue; }
    if (c === '/' && txt[i + 1] === '*') { i += 2; while (i < txt.length && !(txt[i] === '*' && txt[i + 1] === '/')) i++; i++; continue; }
    out += c;
  }
  return JSON.parse(out.replace(/,(\s*[}\]])/g, '$1'));
}

function rotas(w) {
  const lista = w.routes ?? (w.route ? [w.route] : []);
  return lista.map((r) => {
    const p = typeof r === 'string' ? r : r.pattern;
    const dominio = typeof r === 'object' && r.custom_domain === true;
    const i = p.indexOf('/');
    const host = (i < 0 ? p : p.slice(0, i)).toLowerCase();
    let caminho = i < 0 ? '/' : p.slice(i);
    const exato = !caminho.endsWith('*');
    if (!exato) caminho = caminho.slice(0, -1);
    return { host, caminho, exato: dominio ? false : exato, dominio };
  });
}

rmSync(DIST, { recursive: true, force: true });
mkdirSync(join(DIST, 'workers'), { recursive: true });
const manifesto = [];
for (const item of config.workers) {
  const arqW = join(RAIZ, item.wrangler);
  const w = jsonc(readFileSync(arqW, 'utf8'));
  const pasta = dirname(arqW);
  const nome = item.nome ?? w.name;
  const modulo = `workers/${nome}.mjs`;
  await build({
    entryPoints: [join(pasta, item.main ?? w.main)],
    bundle: true,
    format: 'esm',
    platform: 'node',
    target: 'node24',
    outfile: join(DIST, modulo),
    alias: { 'cloudflare:workers': join(AQUI, 'src', 'cloudflare-workers.ts') },
    loader: { '.txt': 'text' },
    logLevel: 'warning',
    legalComments: 'none',
  });
  let assets;
  if (w.assets?.directory) {
    const origem = join(pasta, w.assets.directory);
    const destino = `assets/${nome}`;
    if (existsSync(origem)) cpSync(origem, join(DIST, destino), { recursive: true });
    assets = { ...w.assets, directory: destino };
  }
  manifesto.push({
    nome,
    modulo,
    rotas: [...rotas(w), ...rotas({ routes: item.rotasZona ?? [] }), ...(item.rotasExtras ?? []).map((h) => ({ host: h, caminho: '/', exato: false, dominio: true }))],
    vars: w.vars ?? {},
    d1: (w.d1_databases ?? []).map(({ binding, database_name }) => ({ binding, database_name })),
    r2: (w.r2_buckets ?? []).map(({ binding, bucket_name }) => ({ binding, bucket_name })),
    dos: (w.durable_objects?.bindings ?? []).map(({ name, class_name, script_name }) => ({ name, class_name, script_name })),
    servicos: (w.services ?? []).map(({ binding, service }) => ({ binding, service })),
    email: (w.send_email ?? []).map(({ name, allowed_sender_addresses }) => ({ name, allowed_sender_addresses })),
    assets,
  });
  console.log(`ok ${nome}: ${manifesto.at(-1).rotas.map((r) => r.host + (r.dominio ? '' : r.caminho + (r.exato ? '' : '*'))).join(', ') || '(sem rota)'}`);
}
writeFileSync(join(DIST, 'manifest.json'), JSON.stringify(manifesto, null, 2));
writeFileSync(join(DIST, 'externos.json'), JSON.stringify(config.servicosExternos ?? {}, null, 2));
await build({
  entryPoints: [join(AQUI, 'src', 'server.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node24',
  outfile: join(DIST, 'server.mjs'),
  external: ['bufferutil', 'utf-8-validate'],
  banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" },
  logLevel: 'warning',
});
console.log(`manifesto: ${manifesto.length} workers -> ${DIST}`);
