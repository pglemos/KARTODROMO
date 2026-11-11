// Aviso operacional da reserva online (faixa no topo de reservas.kartodromodebetim.com.br), editável pelo admin.
// GET /api/aviso (público, cache curto) e PUT /api/sync/aviso (SRVKART, autenticado como as outras rotas /api/sync).
// Uso: node worker-aviso.mjs index-painel-resp.js -> index-painel-resp-aviso.js
import { readFileSync, writeFileSync } from 'node:fs';
const entrada = process.argv[2];
let js = readFileSync(entrada, 'utf8');
if (js.includes('"/api/aviso"')) throw new Error('bundle já tem o aviso');
const troca = (de, para) => { if (js.split(de).length !== 2) throw new Error('âncora ausente ou repetida: ' + de.slice(0, 80)); js = js.replace(de, para); };
troca('      if (p === "/api/grupo/painel" && req.method === "GET") {', `      if (p === "/api/aviso" && req.method === "GET") {
        const obj = await env.PRE.get("config/aviso.json");
        const a = obj ? await obj.json() : null;
        const vale = a && a.texto && (!a.ate || Date.parse(a.ate) > Date.now());
        return new Response(JSON.stringify(vale ? { texto: a.texto, tom: a.tom === "alerta" ? "alerta" : "info" } : null), { status: vale ? 200 : 404, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=30" } });
      }
      if (p === "/api/grupo/painel" && req.method === "GET") {`);
troca('        if (p === "/api/sync/pedidos" && req.method === "GET") return await syncPedidos(env);', `        if (p === "/api/sync/pedidos" && req.method === "GET") return await syncPedidos(env);
        if (p === "/api/sync/aviso" && req.method === "PUT") {
          const a = await req.json().catch(() => ({}));
          const texto = String(a.texto ?? "").replace(/\\s+/g, " ").trim().slice(0, 400);
          if (!texto) { await env.PRE.delete("config/aviso.json"); return json12(200, { ok: true, aviso: null }); }
          const aviso = { texto, tom: a.tom === "alerta" ? "alerta" : "info", ate: /^\\d{4}-\\d{2}-\\d{2}T/.test(String(a.ate ?? "")) ? String(a.ate) : null, em: new Date().toISOString() };
          await env.PRE.put("config/aviso.json", JSON.stringify(aviso), { httpMetadata: { contentType: "application/json" } });
          return json12(200, { ok: true, aviso });
        }`);
const saida = entrada.replace(/\.js$/, '') + '-aviso.js';
writeFileSync(saida, js); console.log('ok', saida, js.length);
