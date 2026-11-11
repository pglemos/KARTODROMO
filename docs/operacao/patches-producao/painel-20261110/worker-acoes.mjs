// Painel do organizador v2: ações que gravam no SRVKART por uma fila no R2.
// - POST /api/grupo/painel/acao { g, k, acao: "liberar", ordem }: organizador libera a vaga de quem desistiu.
// - GET  /api/sync/grupos/acoes: SRVKART busca a fila (lib/ops/grupos.ts aplicarAcoesDoPainel).
// - POST /api/sync/grupos/acoes { feitas: [{ key, erro }] }: SRVKART confirma; recusa fica 1 h visível no painel.
// - GET  /api/grupo/painel passa a trazer `pendentes` (vagas liberando) e `recusas` ({ ordem: motivo }).
// Uso: node worker-acoes.mjs base-painel-resp-aviso-termo.js -> base-painel-resp-aviso-termo-acoes.js
import { readFileSync, writeFileSync } from 'node:fs';
const entrada = process.argv[2];
let js = readFileSync(entrada, 'utf8');
if (js.includes('"/api/grupo/painel/acao"')) throw new Error('bundle já tem as ações');
const troca = (de, para) => { if (js.split(de).length !== 2) throw new Error('âncora ausente ou repetida: ' + de.slice(0, 80)); js = js.replace(de, para); };

troca('  return { codigo: g.codigo, responsavel: g.responsavel, bateria: g.bateria, inicio: g.inicio, modo: g.modo, precoCentavos: g.precoCentavos, status: g.status, linkGrupo, atualizadoEm: new Date(cacheGrupos.em).toISOString(), ...painel };',
`  const pendentes = [], recusas = {};
  const fila = await env.PRE.list({ prefix: "grupos/acoes/" + g.codigo + "-" });
  for (const o of fila.objects ?? []) { const n = Number(o.key.split("-").pop().replace(".json", "")); if (Number.isInteger(n)) pendentes.push(n); }
  const erros = await env.PRE.list({ prefix: "grupos/acoes-erro/" + g.codigo + "-" });
  for (const o of erros.objects ?? []) {
    const e = await (await env.PRE.get(o.key))?.json().catch(() => null);
    if (e && Date.parse(e.em) > Date.now() - 36e5) recusas[e.ordem] = e.erro; else await env.PRE.delete(o.key);
  }
  return { codigo: g.codigo, responsavel: g.responsavel, bateria: g.bateria, inicio: g.inicio, modo: g.modo, precoCentavos: g.precoCentavos, status: g.status, linkGrupo, atualizadoEm: new Date(cacheGrupos.em).toISOString(), ...painel, pendentes, recusas };`);

troca('      if (p === "/api/grupo/painel" && req.method === "GET") {', `      if (p === "/api/grupo/painel/acao" && req.method === "POST") {
        const b = await req.json().catch(() => ({}));
        const d = await painelDoGrupo(env, String(b.g ?? "").slice(0, 12), String(b.k ?? "").slice(0, 16));
        if (!d) return json12(404, { erro: "Painel n\\xE3o encontrado." });
        if (b.acao !== "liberar") return json12(400, { erro: "A\\xE7\\xE3o inv\\xE1lida." });
        const vaga = (d.vagas || []).find((v) => v.ordem === Number(b.ordem));
        if (!vaga || !vaga.podeLiberar) return json12(409, { erro: "Esta vaga n\\xE3o pode ser liberada pelo painel. Fale com a recep\\xE7\\xE3o." });
        if (Date.parse(String(d.inicio).slice(0, 16) + ":00-03:00") < Date.now() + 36e5) return json12(409, { erro: "Falta menos de 1 hora para a bateria. Fale com a recep\\xE7\\xE3o." });
        await env.PRE.put("grupos/acoes/" + d.codigo + "-" + vaga.ordem + ".json", JSON.stringify({ codigo: d.codigo, acao: "liberar", ordem: vaga.ordem, em: new Date().toISOString() }), { httpMetadata: { contentType: "application/json" } });
        await env.PRE.delete("grupos/acoes-erro/" + d.codigo + "-" + vaga.ordem + ".json");
        return json12(202, { ok: true });
      }
      if (p === "/api/grupo/painel" && req.method === "GET") {`);

troca('        if (p === "/api/sync/termo" && req.method === "PUT") {', `        if (p === "/api/sync/grupos/acoes" && req.method === "GET") {
          const fila = await env.PRE.list({ prefix: "grupos/acoes/" });
          const acoes = [];
          for (const o of (fila.objects ?? []).slice(0, 50)) { const a = await (await env.PRE.get(o.key))?.json().catch(() => null); if (a) acoes.push({ key: o.key, ...a }); }
          return json12(200, { acoes });
        }
        if (p === "/api/sync/grupos/acoes" && req.method === "POST") {
          const { feitas } = await req.json().catch(() => ({}));
          for (const f of Array.isArray(feitas) ? feitas.slice(0, 50) : []) {
            if (!/^grupos\\/acoes\\/G[0-9A-F]{4,11}-\\d{1,3}\\.json$/.test(String(f.key))) continue;
            await env.PRE.delete(f.key);
            if (f.erro) { const [cod, ordem] = f.key.slice(13, -5).split("-"); await env.PRE.put("grupos/acoes-erro/" + cod + "-" + ordem + ".json", JSON.stringify({ ordem: Number(ordem), erro: String(f.erro).slice(0, 200), em: new Date().toISOString() }), { httpMetadata: { contentType: "application/json" } }); }
          }
          cacheGrupos = null;
          return json12(200, { ok: true });
        }
        if (p === "/api/sync/termo" && req.method === "PUT") {`);

const saida = entrada.replace(/\.js$/, '') + '-acoes.js';
writeFileSync(saida, js); console.log('ok', saida, js.length);
