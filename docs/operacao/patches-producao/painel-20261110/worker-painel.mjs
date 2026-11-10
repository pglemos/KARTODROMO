// Painel do organizador no worker kartodromo-cadastro: /painel?g=CODIGO&k=CHAVE (página) e /api/grupo/painel (dados).
// Aplica sobre o bundle QUE ESTÁ NO AR (baixe antes; nunca sobre o fonte). Uso: node worker-painel.mjs index.js -> index-painel.js
// Os dados vêm do resumo que o SRVKART já manda a cada minuto (grupos/todos.json, campo `painel`, ver lib/ops/grupos.ts).
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = dirname(fileURLToPath(import.meta.url));
const entrada = process.argv[2] || 'index.js';
let js = readFileSync(entrada, 'utf8');
const pagina = readFileSync(join(aqui, 'painel.html'), 'utf8');
if (js.includes('/api/grupo/painel')) throw new Error('bundle já tem o painel');
const ancora = '      if (p === "/api/grupo" && req.method === "GET") {';
if (!js.includes(ancora) || !js.includes('var cacheGrupos = null;')) throw new Error('âncora não encontrada (bundle diferente do esperado)');

js = js.replace('var cacheGrupos = null;', `var cacheGrupos = null;
var PAGINA_PAINEL = ${JSON.stringify(pagina)};
// comparação em tempo constante da chave do painel
function mesmaChave(a, b) {
  a = String(a ?? ""); b = String(b ?? "");
  if (!a || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
__name(mesmaChave, "mesmaChave");
async function painelDoGrupo(env, codigo, chave) {
  if (!/^G[0-9A-F]{4,11}$/.test(codigo) || !/^[A-Za-z0-9_-]{16}$/.test(chave)) return null;
  if (!cacheGrupos || Date.now() - cacheGrupos.em > 3e4) {
    const obj = await env.PRE.get("grupos/todos.json");
    cacheGrupos = { em: Date.now(), lista: obj ? await obj.json() : [] };
  }
  const g = cacheGrupos.lista.find((x) => x.codigo === codigo);
  if (!g || !g.painel || !mesmaChave(g.painel.chave, chave)) return null;
  const { chave: _c, ...painel } = g.painel;
  const linkGrupo = g.responsavelToken ? "https://cadastro.kartodromodebetim.com.br/?r=" + g.responsavelToken : null;
  return { codigo: g.codigo, responsavel: g.responsavel, bateria: g.bateria, inicio: g.inicio, modo: g.modo, precoCentavos: g.precoCentavos, status: g.status, linkGrupo, atualizadoEm: new Date(cacheGrupos.em).toISOString(), ...painel };
}
__name(painelDoGrupo, "painelDoGrupo");`);

js = js.replace(ancora, `      if (p === "/api/grupo/painel" && req.method === "GET") {
        const d = await painelDoGrupo(env, String(url.searchParams.get("g") ?? "").slice(0, 12), String(url.searchParams.get("k") ?? "").slice(0, 16));
        return json12(d ? 200 : 404, d ?? { erro: "Painel n\\xE3o encontrado. Confira o link ou fale com a recep\\xE7\\xE3o." });
      }
      if (p === "/painel" && req.method === "GET") return new Response(PAGINA_PAINEL, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex", "referrer-policy": "no-referrer" } });
${ancora}`);

const saida = entrada.replace(/\.js$/, '') + '-painel.js';
writeFileSync(saida, js);
console.log('ok', saida, js.length);
