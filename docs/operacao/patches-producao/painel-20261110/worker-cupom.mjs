// Cupom (voucher) na reserva online do site. O SRVKART calcula com as regras de dbo.Voucher (calcularPedidoOnline).
// - POST /api/reservas/cupom { codigo, bateriaId, quantidade, documento, documentos }: pede a prévia (fila no R2).
// - GET  /api/reservas/cupom/:id: { status: "pending" } ou { status: "completed", brutoCentavos, descontoCentavos, totalCentavos } / { erro }.
// - GET  /api/sync/cupons-site e POST /api/sync/cupons-site/:id: o SRVKART busca e responde (a cada 5 s, com os cupons do app).
// - POST /api/reservas: guarda `cupom` no pedido; o SRVKART aplica ao reservar (o valor da cobrança já vem com desconto).
// Uso: node worker-cupom.mjs base-painel-resp-aviso-termo-acoes.js -> ...-cupom.js
import { readFileSync, writeFileSync } from 'node:fs';
const entrada = process.argv[2];
let js = readFileSync(entrada, 'utf8');
if (js.includes('"/api/reservas/cupom"')) throw new Error('bundle já tem o cupom');
const troca = (de, para) => { if (js.split(de).length !== 2) throw new Error('âncora ausente ou repetida: ' + de.slice(0, 80)); js = js.replace(de, para); };

troca('    politica: { versao: POLITICA_VERSAO, aceitaEm: agora }\n  };', `    politica: { versao: POLITICA_VERSAO, aceitaEm: agora },
    ...cupomDoPedido(corpo.cupom) ? { cupom: cupomDoPedido(corpo.cupom) } : {}
  };`);

troca('var cacheGrupos = null;', `var cacheGrupos = null;
function cupomDoPedido(v) {
  const c = String(v ?? "").trim().toUpperCase();
  return /^[A-Z0-9_-]{1,40}$/.test(c) ? c : null;
}
__name(cupomDoPedido, "cupomDoPedido");
var ID_CUPOM = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;`);

troca('      if (p === "/api/reservas/politica" && req.method === "GET") return politicaPublica();', `      if (p === "/api/reservas/politica" && req.method === "GET") return politicaPublica();
      if (p === "/api/reservas/cupom" && req.method === "POST") {
        if (await excedeuLimite(req.headers.get("cf-connecting-ip") ?? "x", "cupom")) return json12(429, { erro: "Muitas tentativas de cupom. Aguarde alguns minutos." });
        const b = await req.json().catch(() => ({}));
        const codigo = cupomDoPedido(b.codigo);
        const bateriaId = Number(b.bateriaId), quantidade = Number(b.quantidade);
        const dig = (x) => String(x ?? "").replace(/\\D/g, "");
        const documento = dig(b.documento);
        const documentos = (Array.isArray(b.documentos) ? b.documentos : []).slice(0, 10).map(dig).filter((d) => d.length === 11);
        if (!codigo || !Number.isSafeInteger(bateriaId) || bateriaId < 1 || !Number.isSafeInteger(quantidade) || quantidade < 1 || quantidade > 10) return json12(400, { erro: "Confira o c\\xF3digo do cupom." });
        if (documento.length !== 11) return json12(400, { erro: "Informe o CPF de quem reserva antes de aplicar o cupom." });
        const id = crypto.randomUUID();
        await env.PRE.put("cupons/site/" + id + ".json", JSON.stringify({ codigo, bateriaId, quantidade, documento, documentos, state: "pending", em: Date.now() }), { httpMetadata: { contentType: "application/json" } });
        return json12(202, { requestId: id });
      }
      if (p.startsWith("/api/reservas/cupom/") && req.method === "GET") {
        const id = p.slice(20);
        if (!ID_CUPOM.test(id)) return json12(404, { erro: "Pr\\xE9via n\\xE3o encontrada." });
        const r = await (await env.PRE.get("cupons/site/" + id + ".json"))?.json().catch(() => null);
        if (!r || Date.now() - r.em > 6e5) return json12(404, { erro: "Pr\\xE9via expirada. Aplique o cupom de novo." });
        if (r.state === "pending") return json12(200, { status: "pending" });
        return json12(200, { status: "completed", ...r.resultado });
      }`);

troca('        if (p === "/api/sync/pedidos" && req.method === "GET") return await syncPedidos(env);', `        if (p === "/api/sync/pedidos" && req.method === "GET") return await syncPedidos(env);
        if (p === "/api/sync/cupons-site" && req.method === "GET") {
          const lista = await env.PRE.list({ prefix: "cupons/site/" });
          const jobs = [];
          for (const o of (lista.objects ?? []).slice(0, 50)) {
            const r = await (await env.PRE.get(o.key))?.json().catch(() => null);
            if (!r || Date.now() - r.em > 6e5) { await env.PRE.delete(o.key); continue; }
            if (r.state === "pending") jobs.push({ requestId: o.key.slice(12, -5), codigo: r.codigo, bateriaId: r.bateriaId, quantidade: r.quantidade, documento: r.documento, documentos: r.documentos });
          }
          return json12(200, jobs);
        }
        if (p.startsWith("/api/sync/cupons-site/") && req.method === "POST") {
          const id = p.slice(22);
          if (!ID_CUPOM.test(id)) return json12(404, { erro: "Pr\\xE9via n\\xE3o encontrada." });
          const k = "cupons/site/" + id + ".json";
          const r = await (await env.PRE.get(k))?.json().catch(() => null);
          if (!r) return json12(404, { erro: "Pr\\xE9via n\\xE3o encontrada." });
          const v = await req.json().catch(() => ({}));
          const ok = ["brutoCentavos", "descontoCentavos", "totalCentavos"].every((c) => Number.isSafeInteger(Number(v[c])) && Number(v[c]) >= 0);
          const resultado = typeof v.erro === "string" && v.erro ? { erro: v.erro.slice(0, 300) } : ok ? { brutoCentavos: Number(v.brutoCentavos), descontoCentavos: Number(v.descontoCentavos), totalCentavos: Number(v.totalCentavos) } : { erro: "N\\xE3o foi poss\\xEDvel conferir o cupom agora." };
          await env.PRE.put(k, JSON.stringify({ ...r, state: "completed", resultado }), { httpMetadata: { contentType: "application/json" } });
          return json12(200, { ok: true });
        }`);

const saida = entrada.replace(/\.js$/, '') + '-cupom.js';
writeFileSync(saida, js); console.log('ok', saida, js.length);
