// worker no ar + link único do grupo: cadastro completo obrigatório, cobrança Asaas da vaga e página nova
import { readFileSync, writeFileSync } from 'node:fs';
let js = readFileSync('index.js', 'utf8');
const pagina = readFileSync('pagina-grupo.html', 'utf8');
const troca = (de, para) => { if (!js.includes(de)) throw new Error('não achei: ' + de.slice(0, 90)); js = js.replace(de, para); };

troca(`  const chave = chaveDocumento(v.dados.tipoDocumento, v.dados.documento);
  const registro = { chave, recebidoEm: (/* @__PURE__ */ new Date()).toISOString(), ...v.dados };
  await env.PRE.put(\`pendentes/\${chave}.json\`, JSON.stringify(registro), { httpMetadata: { contentType: "application/json" } });
  return json12(201, { ok: true, nome: v.dados.nome.split(" ")[0] });
}`, `  const falta = faltaNoCadastro(v.dados);
  if (falta) return json12(400, { erro: falta });
  const chave = chaveDocumento(v.dados.tipoDocumento, v.dados.documento);
  // link único do grupo: o código vai junto e o SRVKART põe a pessoa na próxima vaga "Amigo N" do grupo
  const reserva = /^[A-Za-z0-9]{10,24}$/.test(String(corpo.reserva ?? "")) ? String(corpo.reserva) : void 0;
  const grupo = reserva ? await grupoDoLink(env, reserva) : null;
  let pagamento = null;
  if (grupo && grupo.modo === "individual" && grupo.precoCentavos > 0 && grupo.livres > 0) {
    if (v.dados.tipoDocumento !== "CPF") return json12(400, { erro: "Para pagar a vaga pelo link do grupo, use o CPF." });
    pagamento = await cobrancaDoLink(env, reserva, chave, v.dados, grupo);
  }
  const registro = { chave, recebidoEm: (/* @__PURE__ */ new Date()).toISOString(), ...v.dados, ...reserva ? { reserva } : {},
    ...pagamento ? { cobranca: { id: pagamento.id, link: pagamento.link, valorCentavos: pagamento.valorCentavos } } : {} };
  await env.PRE.put(\`pendentes/\${chave}.json\`, JSON.stringify(registro), { httpMetadata: { contentType: "application/json" } });
  return json12(201, { ok: true, nome: v.dados.nome.split(" ")[0], ...grupo ? { grupo: { responsavel: grupo.responsavel, bateria: grupo.bateria, inicio: grupo.inicio } } : {}, ...pagamento ? { pagamento } : {} });
}
// todos os campos do totem são obrigatórios (só CEP e complemento ficam opcionais)
function faltaNoCadastro(d) {
  if (!d.email) return "Informe seu e-mail.";
  if (!(Number(d.peso) >= 20 && Number(d.peso) <= 250)) return "Informe seu peso em kg (entre 20 e 250).";
  if (!d.endereco) return "Informe a rua do seu endere\\xE7o.";
  if (!d.numero) return "Informe o n\\xFAmero do endere\\xE7o.";
  if (!d.bairro) return "Informe o bairro.";
  if (!d.cidade) return "Informe a cidade.";
  return null;
}
__name(faltaNoCadastro, "faltaNoCadastro");
var cacheGrupos = null;
async function grupoDoLink(env, token) {
  if (!token) return null;
  if (!cacheGrupos || Date.now() - cacheGrupos.em > 3e4) {
    const obj = await env.PRE.get("grupos/todos.json");
    cacheGrupos = { em: Date.now(), lista: obj ? await obj.json() : [] };
  }
  const achado = cacheGrupos.lista.find((x) => x.tokens.includes(token));
  if (!achado) return null;
  const { tokens, ...g } = achado;
  if (!g || g.status !== "ativa" || Date.parse(String(g.inicio).slice(0, 16) + ":00-03:00") < Date.now() - 36e5) return null;
  return g;
}
__name(grupoDoLink, "grupoDoLink");
// uma cobrança por pessoa no grupo (o mesmo CPF reenviando reaproveita a que está aberta)
async function cobrancaDoLink(env, token, chave, d, g) {
  const k = \`grupo-pag/\${token}/\${chave}.json\`;
  const antiga = await env.PRE.get(k);
  if (antiga) {
    const a = await antiga.json();
    try {
      const s = await consultar(env, a.id);
      if (PAGO.has(s.status)) return { ...a, pago: true };
      if (s.status === "PENDING" && Number(a.valorCentavos) === Number(g.precoCentavos)) return { ...a, pago: false };
    } catch {}
  }
  const dados = { nome: d.nome, cpf: digitos(d.documento), email: d.email, celular: digitos(d.telefone), referencia: \`grupo-\${g.codigo}\` };
  let cliente;
  try { cliente = await garantirCliente(env, dados); } catch (e) {
    if (!/celular|mobilePhone/i.test(e.message)) throw e;
    cliente = await garantirCliente(env, { ...dados, celular: "" });
  }
  const hoje = hojeBrasilia();
  const dia = String(g.inicio).slice(0, 10);
  const cob = await chamar(env, "/payments", {
    method: "POST",
    body: JSON.stringify({
      customer: cliente, billingType: "UNDEFINED", value: Math.round(Number(g.precoCentavos)) / 100,
      dueDate: /^\\d{4}-\\d{2}-\\d{2}$/.test(dia) && dia >= hoje ? dia : hoje,
      description: \`Kart\\xF3dromo de Betim \\xB7 \${g.bateria} \${dia.split("-").reverse().join("/")} \${String(g.inicio).slice(11, 16)} \\xB7 \${d.nome} \\xB7 grupo do(a) \${g.responsavel}\`.slice(0, 500),
      externalReference: \`grupo-\${g.codigo}-\${chave}\`.slice(0, 100)
    })
  });
  const r = { id: cob.id, link: cob.invoiceUrl, valorCentavos: Number(g.precoCentavos), pago: false };
  await env.PRE.put(k, JSON.stringify(r), { httpMetadata: { contentType: "application/json" } });
  return r;
}
__name(cobrancaDoLink, "cobrancaDoLink");
var PAGINA_CADASTRO = ${JSON.stringify(pagina)};`);

// rotas públicas do grupo e a página nova
troca(`      if (p === "/api/pre-cadastro" && req.method === "POST") return await receber2(req, env);`, `      if (p === "/api/pre-cadastro" && req.method === "POST") return await receber2(req, env);
      if (p === "/api/grupo" && req.method === "GET") {
        const g = await grupoDoLink(env, String(url.searchParams.get("r") ?? "").replace(/[^A-Za-z0-9]/g, "").slice(0, 24));
        return json12(g ? 200 : 404, g ? { responsavel: g.responsavel, bateria: g.bateria, inicio: g.inicio, modo: g.modo, precoCentavos: g.precoCentavos, livres: g.livres } : { erro: "Reserva n\\xE3o encontrada." });
      }
      if (p === "/api/grupo/pagamento" && req.method === "GET") {
        const id = String(url.searchParams.get("id") ?? "");
        if (!/^pay_[A-Za-z0-9]{6,40}$/.test(id)) return json12(400, { erro: "Pagamento inv\\xE1lido." });
        const c = await consultar(env, id);
        return json12(200, { pago: PAGO.has(c.status), status: c.status });
      }
      if ((p === "/" || p === "/index.html") && url.hostname.startsWith("cadastro.")) return new Response(PAGINA_CADASTRO, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });`);
troca(`        if (p === "/api/sync/pedidos" && req.method === "GET") return await syncPedidos(env);`, `        if (p === "/api/sync/pedidos" && req.method === "GET") return await syncPedidos(env);
        // resumo das reservas em grupo ativas (o SRVKART manda a cada minuto): o link do grupo mostra quem reservou e cobra a vaga
        if (p === "/api/sync/grupos" && req.method === "PUT") {
          const { grupos } = await req.json();
          // um arquivo só com todos os grupos (um por link passava de 800 gravações e estourava o tempo)
          const lista = (Array.isArray(grupos) ? grupos.slice(0, 500) : []).filter((g) => Array.isArray(g.tokens));
          await env.PRE.put("grupos/todos.json", JSON.stringify(lista), { httpMetadata: { contentType: "application/json" } });
          cacheGrupos = null;
          return json12(200, { gravados: lista.length });
        }`);
for (const f of ['var consultar =']) if (js.includes(f)) { writeFileSync('index2.js', js); console.log('ok', js.length); process.exit(0); }
throw new Error('consultar não existe');
