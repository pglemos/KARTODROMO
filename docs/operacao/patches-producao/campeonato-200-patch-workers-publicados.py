import re, sys, json
base = 'C:/repos/KARTODROMO/'
tmp = base + '.tmp-200/'

# ---- Admin: index e css
p = base + 'workers/admin/public/index.html'
s = open(p, encoding='utf8').read()
if 'campeonato-inscricoes.js' not in s:
    s = s.replace('<script src="/endurance.js?v=20261021a" defer></script>', '<script src="/endurance.js?v=20261021a" defer></script>\n<script src="/campeonato-inscricoes.js?v=20261031a" defer></script>')
    s = s.replace('/endurance.css?v=20261021a', '/endurance.css?v=20261031a')
    open(p, 'w', encoding='utf8').write(s)
p = base + 'workers/admin/public/endurance.css'
s = open(p, encoding='utf8').read()
if 'i2-num' not in s:
    s += """
/* 200 Milhas · inscrições */
.i2-num{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.i2-num .cartao{padding:16px}.i2-num span{display:block;font-size:13px;opacity:.75}.i2-num b{display:block;font-size:28px;line-height:1.2}.i2-num small{font-size:12px;opacity:.75}
.i2-filtros{display:flex;flex-wrap:wrap;gap:8px;align-items:center}.i2-filtros input{max-width:340px}.i2-f{min-height:36px;padding:0 12px;border:1px solid rgba(127,127,127,.4);border-radius:99px;background:none;color:inherit;font:inherit;font-size:13px;cursor:pointer}.i2-f.atual{background:#111;color:#fff;border-color:#111}
.i2-rolar{overflow-x:auto}.i2-t{width:100%;border-collapse:collapse;font-size:14px}.i2-t th{text-align:left;font-size:12px;opacity:.75;padding:10px 12px;white-space:nowrap}.i2-t td{padding:10px 12px;border-top:1px solid rgba(127,127,127,.2)}.i2-l{cursor:pointer}.i2-l:hover,.i2-l:focus-visible{background:rgba(127,127,127,.1)}.i2-m{opacity:.75;font-size:12px}
.i2-selo{display:inline-block;padding:2px 10px;border-radius:99px;font-size:12px;font-weight:600;white-space:nowrap}.i2-selo.verde{background:#D7F7E2;color:#0B6B31}.i2-selo.amarelo{background:#FFF0CC;color:#7A5200}.i2-selo.vermelho{background:#FFE0E0;color:#A11A1A}
.i2-g{padding:20px;display:flex;flex-direction:column;gap:10px;overflow:auto;max-height:100vh}.i2-g h2{margin:6px 0 2px}.i2-g h3{margin:14px 0 0;font-size:15px}.i2-g p{margin:0}.i2-gc{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.i2-acoes{display:flex;flex-wrap:wrap;gap:8px}.i2-pg{display:flex;flex-direction:column;gap:8px;padding:12px;border:1px solid rgba(127,127,127,.25);border-radius:10px}.i2-lin{display:flex;gap:8px}.i2-lin>*{min-width:0;flex:1}.i2-ul{list-style:none;margin:0;padding:0}.i2-ul li{display:flex;justify-content:space-between;gap:10px;padding:8px 0;border-top:1px solid rgba(127,127,127,.2);font-size:14px}.i2-x{background:none;border:0;color:#B3261E;font:inherit;font-size:13px;cursor:pointer;min-height:32px;white-space:nowrap}.i2-sug{display:block;width:100%;text-align:left;background:none;border:0;border-bottom:1px solid rgba(127,127,127,.2);padding:8px 2px;font:inherit;font-size:13px;color:inherit;cursor:pointer}.i2-fim{margin-top:12px}
@media(max-width:800px){.i2-num{grid-template-columns:1fr 1fr}}
"""
    open(p, 'w', encoding='utf8').write(s)

# ---- ops-server de produção: ganchos
def ganchos(s):
    if 'campeonato-inscricoes' in s: return s
    s = s.replace("import { conferirCobrancas, gruposRoutes } from '../lib/ops/grupos';", "import { conferirCobrancas, gruposRoutes } from '../lib/ops/grupos';\nimport { campeonatoOfficeRoutes, campeonatoSiteRoutes, conferirCobrancasCampeonato } from '../lib/ops/campeonato-inscricoes';", 1)
    s = s.replace("      if (await gruposRoutes(reqOffice, (status, body) => send(res, status, body))) return;", "      if (await campeonatoOfficeRoutes(reqOffice, (status, body) => send(res, status, body))) return;\n      if (await gruposRoutes(reqOffice, (status, body) => send(res, status, body))) return;", 1)
    s = s.replace("    if (path.startsWith('/api/crono/')) {", "    if (path.startsWith('/api/campeonato-site/')) {\n      requireKey(req);\n      if (await campeonatoSiteRoutes(path, method, () => readBody(req), (status, body) => send(res, status, body))) return;\n      return send(res, 404, { error: 'Rota desconhecida.' });\n    }\n    if (path.startsWith('/api/crono/')) {", 1)
    s = s.replace("    try { await conferirCobrancas(log); } catch (e) { log(`grupo: conferência das cobranças falhou (${(e as Error).message})`); } finally { conferindo = false; }", "    try { await conferirCobrancas(log); await conferirCobrancasCampeonato(log); } catch (e) { log(`grupo: conferência das cobranças falhou (${(e as Error).message})`); } finally { conferindo = false; }", 1)
    assert s.count('campeonatoSiteRoutes') == 2 and s.count('conferirCobrancasCampeonato') == 2 and s.count('campeonatoOfficeRoutes') == 2
    return s
for p in [tmp + 'ops-server.prod.ts']:
    t = open(p, encoding='utf8', newline='').read()
    crlf = '\r\n' in t
    n = ganchos(t.replace('\r\n', '\n'))
    if crlf: n = n.replace('\n', '\r\n')
    open(p, 'w', encoding='utf8', newline='').write(n)

# ---- worker de cobrança (pacote publicado): rotas novas
ROTAS = r'''
        if (p === "/api/sync/campeonato/cobranca" && req.method === "POST") {
          const c = await req.json();
          const dadosCli = { nome: c.nome, cpf: String(c.cpf ?? "").replace(/\D/g, ""), email: c.email ?? "", celular: String(c.celular ?? "").replace(/\D/g, ""), referencia: c.referencia }; let cliente; try { cliente = await garantirCliente(env, dadosCli); } catch (erroCli) { if (!/celular/i.test(erroCli.message)) throw erroCli; cliente = await garantirCliente(env, { ...dadosCli, celular: void 0 }); }
          const valor = Math.round(c.valorCentavos) / 100;
          const n = c.forma === "cartao" ? Math.min(5, Math.max(1, Math.trunc(c.parcelas) || 1)) : 1;
          const cob = await chamar(env, "/payments", { method: "POST", body: JSON.stringify({ customer: cliente, billingType: c.forma === "cartao" ? "CREDIT_CARD" : "PIX", ...(n > 1 ? { installmentCount: n, totalValue: valor } : { value: valor }), dueDate: c.vencimento, description: String(c.descricao ?? "").slice(0, 500), externalReference: String(c.referencia ?? "").slice(0, 100) }) });
          return json11(201, { id: cob.id, link: cob.invoiceUrl, status: cob.status });
        }
        const mCamp = p.match(/^\/api\/sync\/campeonato\/cobranca\/([A-Za-z0-9_]{6,40})$/);
        if (mCamp && req.method === "GET") { const c = await consultar(env, mCamp[1]); return json11(200, { id: c.id, status: c.status, pago: PAGO.has(c.status), forma: c.billingType }); }
        if (mCamp && req.method === "DELETE") { const c = await consultar(env, mCamp[1]); if (c.installment) return json11(200, await chamar(env, `/installments/${encodeURIComponent(c.installment)}`, { method: "DELETE" })); return json11(200, await cancelar(env, mCamp[1])); }
        if (p === "/api/sync/campeonato/cobrancas" && req.method === "GET") { const cpf = (url.searchParams.get("cpf") ?? "").replace(/\D/g, ""); const cli = await chamar(env, `/customers?cpfCnpj=${cpf}&limit=1`); const id = cli.data?.[0]?.id; if (!id) return json11(200, []); const r = await chamar(env, `/payments?customer=${id}&limit=50`); return json11(200, r.data.map((x) => ({ id: x.id, status: x.status, valor: x.value, parcelamento: x.installment ?? null, deleted: x.deleted, ref: x.externalReference }))); }
        if (p === "/api/sync/cobranca" && req.method === "POST") {
          const c = await req.json();
          const dadosCli = { nome: c.nome, cpf: String(c.cpf ?? "").replace(/\D/g, ""), email: c.email ?? "", celular: String(c.celular ?? "").replace(/\D/g, ""), referencia: c.referencia }; let cliente; try { cliente = await garantirCliente(env, dadosCli); } catch (erroCli) { if (!/celular/i.test(erroCli.message)) throw erroCli; cliente = await garantirCliente(env, { ...dadosCli, celular: void 0 }); }
          const hoje = hojeBrasiliaCob();
          const cob = await chamar(env, "/payments", { method: "POST", body: JSON.stringify({ customer: cliente, billingType: "UNDEFINED", value: Math.round(c.valorCentavos) / 100, dueDate: /^\d{4}-\d{2}-\d{2}$/.test(c.vencimento) && c.vencimento >= hoje ? c.vencimento : hoje, description: String(c.descricao ?? "").slice(0, 500), externalReference: String(c.referencia ?? "").slice(0, 100) }) });
          return json11(201, { id: cob.id, link: cob.invoiceUrl, status: cob.status });
        }
        const mGrupo = p.match(/^\/api\/sync\/cobranca\/([A-Za-z0-9_]{6,40})$/);
        if (mGrupo && req.method === "GET") { const c = await consultar(env, mGrupo[1]); return json11(200, { id: c.id, status: c.status, pago: PAGO.has(c.status), forma: c.billingType }); }
        if (mGrupo && req.method === "DELETE") return json11(200, await cancelar(env, mGrupo[1]));
'''
b = open(tmp + 'cad2.txt', encoding='utf8', newline='').read()
inicio = b.index('\r\n\r\n', b.index('name="index.js"')) + 4
fim = b.rindex('\r\n--')
js = b[inicio:fim]
ancora = 'if (!autorizado2(req, env)) return json11(401, { erro: "N\\xE3o autorizado." });'
assert js.count(ancora) == 1
js = js.replace(ancora, ancora + ROTAS)
js = js.replace('var PAGO = /* @__PURE__ */', 'var hojeBrasiliaCob = () => new Date(Date.now() - 3 * 36e5).toISOString().slice(0, 10);\nvar PAGO = /* @__PURE__ */', 1)
js = js.replace('\n//# sourceMappingURL=index.js.map', '')
open(tmp + 'cadastro-index.js', 'w', encoding='utf8', newline='').write(js)

# ---- site: catálogo e links
b = open(tmp + 'kartodromo-site-2026.script.txt', encoding='utf8', newline='').read()
partes = re.split(r'(--[0-9a-f]{40,}(?:--)?\r?\n)', b)
blocos = {}
for x in partes:
    m = re.match(r'Content-Disposition: form-data; name="([^"]+)"[^\r\n]*\r?\n(?:[^\r\n]+\r?\n)*\r?\n', x)
    if m: blocos[m.group(1)] = x[m.end():].rstrip('\r\n')
w = blocos['worker.js']
nomeJs = [k for k in blocos if k != 'worker.js'][0]
j = blocos[nomeJs]
def troca(a, c, n=1):
    global j
    assert j.count(a) >= 1, a
    j = j.replace(a, c) if n == 0 else j.replace(a, c, n)
# 100 Milhas encerrada; destaque passa a ser as 200 Milhas
troca('u.jsx("img",{src:"/media/championships/100-milhas-light-logo.png",alt:"Logo oficial 100 Milhas Light",width:"180",height:"110"}),u.jsxs("div",{children:[u.jsx("span",{children:"25 OUTUBRO · 2026"}),u.jsx("h2",{children:"O desafio das 100 Milhas Light."}),u.jsx("p",{children:"Monte sua equipe. 2h30 de prova, três paradas e uma estratégia até a bandeirada."})]}),u.jsx(je,{to:"/100-milhas-light",children:"Conhecer a prova"})',
      'u.jsx("img",{src:"/media/championships/200-milhas-logo.png",alt:"Logo oficial 200 Milhas de Betim",width:"180",height:"110"}),u.jsxs("div",{children:[u.jsx("span",{children:"30 JANEIRO · 2027"}),u.jsx("h2",{children:"200 Milhas de Betim: inscrições abertas."}),u.jsx("p",{children:"Cinco horas, cinco paradas e sua equipe no grid. R$ 2.800 por kart, com Pix ou cartão em até 5x sem juros."})]}),u.jsx(je,{to:"/200-milhas",children:"Inscrever minha equipe"})')
m = re.search(r'\{id:"100-milhas-light"[^{}]*?description:"([^"]*)"', j)
assert m
j = j[:m.start(1)] + 'Edição realizada em 25 de outubro de 2026.' + j[m.end(1):]
j = re.sub(r'(\{id:"100-milhas-light",)', r'\1past:!0,', j, 1)
# 500 Milhas: próxima edição conforme a agenda (21/08/2027); valor e regulamento 2027 ainda não publicados
troca('{id:"500-milhas",name:"500 Milhas de Betim",type:"Endurance",day:"29",month:"AGO",year:"2026",date:"29/08/2026",description:"Edição realizada.",price:6800,team:!0,past:!0,',
      '{id:"500-milhas",name:"500 Milhas de Betim",type:"Endurance",day:"21",month:"AGO",year:"2027",date:"21/08/2027",description:"Próxima edição em agosto de 2027. Fale com a organização.",team:!0,past:!0,')
troca('A prova mais longa do calendário. Uma história de resistência, preparação e decisões compartilhadas a cada volta. A edição de 2026 aconteceu em 29 de agosto.',
      'A prova mais longa do calendário. Uma história de resistência, preparação e decisões compartilhadas a cada volta. A próxima edição será em 21 de agosto de 2027.')
troca('c.past?"Ver edição":c.team?"Ver prova":"Ver campeonato"', 'c.past?(c.id==="500-milhas"?"Ver prova":"Ver edição"):c.team?"Ver prova":"Ver campeonato"')
troca('r.past?"Edição realizada":d==="soon"', 'r.past?(r.id==="500-milhas"?"Próxima edição":"Edição realizada"):d==="soon"')
troca('A edição 2026 foi realizada. Fale com a equipe para acompanhar a próxima edição.', 'Fale com a equipe para acompanhar a próxima edição.')
# as 200 Milhas são uma página própria: link interno recarrega a página para o worker dela responder
GANCHO = 'document.addEventListener("click",function(e){var a=e.target&&e.target.closest&&e.target.closest(\'a[href^="/200-milhas"]\');if(a&&!e.metaKey&&!e.ctrlKey&&!e.shiftKey){e.preventDefault();e.stopPropagation();location.assign(a.getAttribute("href"))}},!0);'
if GANCHO not in j: j = GANCHO + j
open(tmp + 'site-politica.js', 'w', encoding='utf8', newline='').write(j)
open(tmp + 'site-worker.js', 'w', encoding='utf8', newline='').write(w)
open(tmp + 'site-nomejs.txt', 'w').write(nomeJs)
print('ok', nomeJs, len(j), len(js))
