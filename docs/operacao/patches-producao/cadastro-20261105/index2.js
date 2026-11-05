var __defProp = Object.defineProperty;
var __name = (target, value2) => __defProp(target, "name", { value: value2, configurable: true });

// ../../lib/ops/instagram.ts
function normalizarInstagram(value2) {
  let usuario = String(value2 ?? "").trim();
  const perfil = usuario.match(/^(?:https?:\/\/)?(?:www\.)?instagram\.com\/([^/?#]+)\/?(?:[?#].*)?$/i);
  if (perfil) usuario = perfil[1];
  usuario = usuario.replace(/^@/, "").toLowerCase();
  return usuario ? "@" + usuario : "";
}
__name(normalizarInstagram, "normalizarInstagram");
function erroInstagramCliente(value2) {
  if (!String(value2 ?? "").trim()) return "O Instagram \xE9 obrigat\xF3rio. Informe o @usu\xE1rio do piloto.";
  const perfil = normalizarInstagram(value2);
  return /^@[a-z0-9_](?:[a-z0-9_.]{0,28}[a-z0-9_])?$/.test(perfil) && !perfil.includes("..") ? null : "Instagram inv\xE1lido. Informe o @usu\xE1rio do piloto (ex.: @andre.silva).";
}
__name(erroInstagramCliente, "erroInstagramCliente");

// src/validar.ts
var digitos = /* @__PURE__ */ __name((v) => String(v ?? "").replace(/\D/g, ""), "digitos");
var txt = /* @__PURE__ */ __name((v, max) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max), "txt");
function cpfValido(v) {
  const d = digitos(v);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  for (const t of [9, 10]) {
    let soma = 0;
    for (let i = 0; i < t; i++) soma += Number(d[i]) * (t + 1 - i);
    const dv = soma * 10 % 11 % 10;
    if (dv !== Number(d[t])) return false;
  }
  return true;
}
__name(cpfValido, "cpfValido");
function dataValida(v, hoje = /* @__PURE__ */ new Date()) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!m) return false;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  if (d.getUTCFullYear() !== Number(m[1]) || d.getUTCMonth() !== Number(m[2]) - 1 || d.getUTCDate() !== Number(m[3])) return false;
  const anos = (hoje.getTime() - d.getTime()) / (365.25 * 864e5);
  return anos >= 0 && anos < 110;
}
__name(dataValida, "dataValida");
function chaveDocumento(tipo, documento) {
  const d = digitos(documento);
  return tipo === "Passaporte" && !d ? documento.toUpperCase().replace(/[^A-Z0-9]/g, "") : d;
}
__name(chaveDocumento, "chaveDocumento");
function validar(entrada, hoje = /* @__PURE__ */ new Date()) {
  const tipo = ["CPF", "RG", "Passaporte"].find((t) => t === entrada.tipoDocumento) ?? "CPF";
  const documento = txt(entrada.documento, 40);
  const nome = txt(entrada.nome, 120);
  const email = txt(entrada.email, 160).toLowerCase();
  const telefone = txt(entrada.telefone, 25);
  const nascimento = txt(entrada.nascimento, 10);
  const peso = txt(entrada.peso, 6).replace(",", ".");
  const estado = txt(entrada.estado, 2).toUpperCase();
  if (!documento) return { ok: false, erro: `Informe o ${tipo === "Passaporte" ? "passaporte" : tipo}.` };
  if (tipo === "CPF" && !cpfValido(documento)) return { ok: false, erro: "CPF inv\xE1lido. Confira os n\xFAmeros." };
  if (tipo !== "CPF" && chaveDocumento(tipo, documento).length < 5) return { ok: false, erro: `${tipo} inv\xE1lido.` };
  if (nome.split(" ").length < 2) return { ok: false, erro: "Informe o nome completo." };
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return { ok: false, erro: "E-mail inv\xE1lido." };
  if (digitos(telefone).length < 10) return { ok: false, erro: "Informe o celular com DDD." };
  if (!dataValida(nascimento, hoje)) return { ok: false, erro: "Data de nascimento inv\xE1lida." };
  if (peso && !(Number(peso) >= 15 && Number(peso) <= 250)) return { ok: false, erro: "Peso inv\xE1lido (em kg)." };
  if (estado && !/^[A-Z]{2}$/.test(estado)) return { ok: false, erro: "UF inv\xE1lida." };
  if (!String(entrada.instagram ?? "").trim()) return { ok: false, erro: "O Instagram \xE9 obrigat\xF3rio. Informe o @usu\xE1rio." };
  const erroInstagram = erroInstagramCliente(entrada.instagram);
  if (erroInstagram) return { ok: false, erro: erroInstagram.replace(" do piloto", "") };
  if (entrada.lgpd !== true) return { ok: false, erro: "\xC9 preciso aceitar o Termo de Consentimento para Tratamento de Dados Pessoais." };
  const menoresBrutos = Array.isArray(entrada.menores) ? entrada.menores.slice(0, 10) : [];
  const menores = [];
  for (const m of menoresBrutos) {
    const n = txt(m?.nome, 120);
    const nasc = txt(m?.nascimento, 10);
    if (!n && !nasc) continue;
    if (n.split(" ").length < 2) return { ok: false, erro: "Informe o nome completo de cada menor." };
    if (!dataValida(nasc, hoje)) return { ok: false, erro: `Data de nascimento inv\xE1lida para ${n}.` };
    menores.push({ nome: n, nascimento: nasc, documento: txt(m?.documento, 40) });
  }
  return {
    ok: true,
    dados: {
      tipoDocumento: tipo,
      documento,
      nome,
      email,
      instagram: normalizarInstagram(entrada.instagram),
      telefone,
      nascimento,
      peso,
      cep: digitos(entrada.cep).slice(0, 8),
      endereco: txt(entrada.endereco, 150),
      numero: txt(entrada.numero, 20),
      complemento: txt(entrada.complemento, 80),
      bairro: txt(entrada.bairro, 80),
      cidade: txt(entrada.cidade, 80),
      estado,
      menores,
      lgpd: true
    }
  };
}
__name(validar, "validar");
var IDADE_MINIMA_PILOTO = 14;
function idade(nascimento, hoje = /* @__PURE__ */ new Date()) {
  const [a, m, d] = nascimento.split("-").map(Number);
  let anos = hoje.getUTCFullYear() - a;
  if (hoje.getUTCMonth() + 1 < m || hoje.getUTCMonth() + 1 === m && hoje.getUTCDate() < d) anos--;
  return anos;
}
__name(idade, "idade");
function validarReserva(entrada, agenda, hoje = /* @__PURE__ */ new Date()) {
  if (!agenda) return { ok: false, erro: "A agenda est\xE1 sendo atualizada. Tente de novo em instantes." };
  const horario = agenda.horarios.find((h) => h.id === Number(entrada.bateriaId));
  if (!horario) return { ok: false, erro: "Esse hor\xE1rio n\xE3o est\xE1 mais dispon\xEDvel. Escolha outro." };
  const quantidade = Math.trunc(Number(entrada.quantidade));
  if (!(quantidade >= 1 && quantidade <= agenda.maxPilotos)) return { ok: false, erro: `Escolha de 1 a ${agenda.maxPilotos} pilotos.` };
  if (quantidade > horario.livres) return { ok: false, erro: horario.livres ? `Esse hor\xE1rio tem s\xF3 ${horario.livres} ${horario.livres === 1 ? "vaga" : "vagas"}.` : "Esse hor\xE1rio lotou. Escolha outro." };
  const forma = entrada.forma === "pix" || entrada.forma === "cartao" ? entrada.forma : null;
  if (!forma) return { ok: false, erro: "Escolha Pix ou cart\xE3o." };
  if (entrada.politica !== true) return { ok: false, erro: "Para reservar, aceite a Pol\xEDtica de Cancelamento, Reagendamento e Reembolso." };
  const v = validar({ ...entrada, tipoDocumento: "CPF" }, hoje);
  if (!v.ok) return v;
  if (idade(v.dados.nascimento, hoje) < 18) return { ok: false, erro: "A reserva precisa ser feita por um adulto (18 anos ou mais), que \xE9 o respons\xE1vel pelo pagamento." };
  const compradorPilota = entrada.compradorPilota !== false;
  const faltam = quantidade - (compradorPilota ? 1 : 0);
  const brutos = (Array.isArray(entrada.acompanhantes) ? entrada.acompanhantes : []).slice(0, faltam);
  if (brutos.length !== faltam) return { ok: false, erro: faltam === 1 ? compradorPilota ? "Cadastre o outro piloto: cada vaga \xE9 de uma pessoa diferente." : "Cadastre quem vai pilotar." : compradorPilota ? `Cadastre os outros ${faltam} pilotos: cada vaga \xE9 de uma pessoa diferente.` : `Cadastre os ${faltam} pilotos: cada vaga \xE9 de uma pessoa diferente.` };
  const documentos = /* @__PURE__ */ new Set([digitos(v.dados.documento)]);
  const acompanhantes = [];
  for (const [i, a] of brutos.entries()) {
    const n = i + (compradorPilota ? 2 : 1);
    const nome = txt(a?.nome, 120);
    const documento = txt(a?.documento, 20);
    const nascimento = txt(a?.nascimento, 10);
    if (nome.split(" ").length < 2) return { ok: false, erro: `Informe o nome completo do piloto ${n}.` };
    if (!cpfValido(documento)) return { ok: false, erro: `CPF inv\xE1lido do piloto ${n} (${nome}).` };
    if (documentos.has(digitos(documento))) return { ok: false, erro: `O CPF do piloto ${n} (${nome}) repete o de outro piloto. Cada vaga \xE9 de uma pessoa diferente.` };
    documentos.add(digitos(documento));
    if (!dataValida(nascimento, hoje)) return { ok: false, erro: `Data de nascimento inv\xE1lida do piloto ${n} (${nome}).` };
    if (idade(nascimento, hoje) < IDADE_MINIMA_PILOTO) return { ok: false, erro: `${nome} precisa ter ${IDADE_MINIMA_PILOTO} anos ou mais para pilotar.` };
    // os mesmos campos obrigatórios do totem para cada piloto (antes só nome/CPF/nascimento chegavam ao kartódromo)
    const quem = `do piloto ${n} (${nome})`;
    const instagram = String(a?.instagram ?? "").trim();
    if (!instagram) return { ok: false, erro: `Informe o Instagram ${quem}.` };
    if (erroInstagramCliente(instagram)) return { ok: false, erro: `Instagram inválido ${quem}. Informe o @usuário (ex.: @andre.silva).` };
    const email = txt(a?.email, 120).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return { ok: false, erro: `Informe um e-mail válido ${quem}.` };
    const telefone = digitos(a?.telefone);
    if (telefone.length < 10 || telefone.length > 13) return { ok: false, erro: `Informe o celular com DDD ${quem}.` };
    const peso = txt(a?.peso, 6).replace(",", ".");
    if (!(Number(peso) >= 20 && Number(peso) <= 250)) return { ok: false, erro: `Informe o peso ${quem} (entre 20 e 250 kg).` };
    const endereco = txt(a?.endereco, 150);
    if (!endereco) return { ok: false, erro: `Informe o endereço (rua e número) ${quem}.` };
    const bairro = txt(a?.bairro, 80);
    if (!bairro) return { ok: false, erro: `Informe o bairro ${quem}.` };
    const cidade = txt(a?.cidade, 80);
    if (!cidade) return { ok: false, erro: `Informe a cidade ${quem}.` };
    acompanhantes.push({ nome, documento, nascimento, instagram: normalizarInstagram(instagram), email, telefone, peso,
      cep: digitos(a?.cep).slice(0, 8), endereco, complemento: txt(a?.complemento, 80), bairro, cidade });
  }
  const pilotos = [...compradorPilota ? [v.dados.nome] : [], ...acompanhantes.map((a) => a.nome)];
  return { ok: true, dados: { cliente: v.dados, bateriaId: horario.id, quantidade, forma, pilotos, acompanhantes, compradorPilota } };
}
__name(validarReserva, "validarReserva");
function codigoReserva(aleatorio = (n) => crypto.getRandomValues(new Uint8Array(n))) {
  const alfabeto = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  return Array.from(aleatorio(6), (b) => alfabeto[b % alfabeto.length]).join("");
}
__name(codigoReserva, "codigoReserva");

// src/asaas.ts
var asaasLigado = /* @__PURE__ */ __name((env) => Boolean(env.ASAAS_API_KEY), "asaasLigado");
async function chamar(env, caminho, init = {}) {
  const base = (env.ASAAS_URL || "https://api.asaas.com/v3").replace(/\/+$/, "");
  const r = await fetch(base + caminho, {
    ...init,
    headers: { access_token: env.ASAAS_API_KEY ?? "", "content-type": "application/json", "user-agent": "kartodromo-betim-reservas", ...init.headers ?? {} }
  });
  const texto2 = await r.text();
  const corpo = texto2 ? JSON.parse(texto2) : {};
  if (!r.ok) {
    const msg = corpo?.errors?.[0]?.description ?? `HTTP ${r.status}`;
    throw new Error(`Asaas ${caminho.split("?")[0]}: ${msg}`);
  }
  return corpo;
}
__name(chamar, "chamar");
async function garantirCliente(env, c) {
  const achados = await chamar(env, `/customers?cpfCnpj=${encodeURIComponent(c.cpf)}&limit=1`);
  if (achados.data?.[0]?.id) return achados.data[0].id;
  const novo = await chamar(env, "/customers", {
    method: "POST",
    body: JSON.stringify({ name: c.nome, cpfCnpj: c.cpf, email: c.email || void 0, mobilePhone: c.celular, externalReference: c.referencia, notificationDisabled: true })
  });
  return novo.id;
}
__name(garantirCliente, "garantirCliente");
async function buscarCobrancaPorReferencia(env, referencia) {
  const response = await chamar(env, `/payments?externalReference=${encodeURIComponent(referencia)}`);
  return response.data?.[0] ?? null;
}
__name(buscarCobrancaPorReferencia, "buscarCobrancaPorReferencia");
function hojeBrasilia(agora = /* @__PURE__ */ new Date()) {
  return new Date(agora.getTime() - 3 * 36e5).toISOString().slice(0, 10);
}
__name(hojeBrasilia, "hojeBrasilia");
async function criarCobranca(env, cliente, forma, valorCentavos, descricao, pedidoId) {
  return chamar(env, "/payments", {
    method: "POST",
    body: JSON.stringify({
      customer: cliente,
      // CREDIT_CARD: a fatura da Asaas também oferece débito (Visa/Master); boleto fica de fora (não compensa em 15 min)
      billingType: forma === "pix" ? "PIX" : "CREDIT_CARD",
      value: Math.round(valorCentavos) / 100,
      dueDate: hojeBrasilia(),
      description: descricao.slice(0, 500),
      externalReference: pedidoId
    })
  });
}
__name(criarCobranca, "criarCobranca");
var qrPix = /* @__PURE__ */ __name((env, id) => chamar(env, `/payments/${encodeURIComponent(id)}/pixQrCode`), "qrPix");
var consultar = /* @__PURE__ */ __name((env, id) => chamar(env, `/payments/${encodeURIComponent(id)}`), "consultar");
var cancelar = /* @__PURE__ */ __name((env, id) => chamar(env, `/payments/${encodeURIComponent(id)}`, { method: "DELETE" }), "cancelar");
async function pagasDesde(env, data) {
  const todas = [];
  for (const status of ["RECEIVED", "CONFIRMED"]) {
    const r = await chamar(env, `/payments?status=${status}&paymentDate%5Bge%5D=${data}&limit=100`);
    todas.push(...r.data ?? []);
  }
  return todas;
}
__name(pagasDesde, "pagasDesde");
async function diagnostico(env) {
  const w = await chamar(env, "/webhooks?limit=20");
  const pix = await chamar(env, "/pix/addressKeys?status=ACTIVE&limit=5").catch((e) => ({ erro: e.message }));
  return {
    webhooks: (w.data ?? []).map((x) => ({ url: x.url, ativo: x.enabled, interrompido: x.interrupted, versao: x.apiVersion, envio: x.sendType, eventos: x.events })),
    chavesPix: "erro" in pix ? pix.erro : pix.totalCount ?? pix.data?.length ?? 0
  };
}
__name(diagnostico, "diagnostico");
var PAGO = /* @__PURE__ */ new Set(["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"]);
var EVENTOS_PAGO = /* @__PURE__ */ new Set(["PAYMENT_RECEIVED", "PAYMENT_CONFIRMED"]);

// ../../src/config/politica-cancelamento.ts
var POLITICA_VERSAO = "2026-10-09";
var POLITICA_TITULO = "Pol\xEDtica de Cancelamento, Reagendamento e Reembolso";
var POLITICA_ACEITE = "Li e aceito a Pol\xEDtica de Cancelamento, Reagendamento e Reembolso.";
var POLITICA_SECOES = [
  {
    titulo: "1. Objetivo",
    paragrafos: [
      "Esta Pol\xEDtica define as regras para cancelamento, reagendamento e reembolso de reservas realizadas em nossa plataforma. Ao concluir a reserva, o cliente declara estar ciente e de acordo com os termos."
    ]
  },
  {
    titulo: "2. Cancelamento pelo Cliente",
    subsecoes: [
      {
        titulo: "2.1 Prazo para Cancelamento",
        paragrafos: [
          "O cancelamento pode ser solicitado com at\xE9 48 horas de anteced\xEAncia da data e hor\xE1rio agendados.",
          "Nessa condi\xE7\xE3o, o valor pago ser\xE1 reembolsado com desconto de 5% referente \xE0 taxa administrativa."
        ]
      },
      {
        titulo: "2.2 Cancelamento Fora do Prazo",
        paragrafos: [
          "Solicita\xE7\xF5es com menos de 48 horas de anteced\xEAncia, bem como o n\xE3o comparecimento (no-show), n\xE3o d\xE3o direito a reembolso.",
          "Em casos excepcionais, analisados individualmente, poder\xE1 ser concedido um voucher para utiliza\xE7\xE3o em outra data."
        ]
      }
    ]
  },
  {
    titulo: "3. Reembolsos",
    subsecoes: [
      {
        titulo: "3.1 Cart\xE3o de Cr\xE9dito ou D\xE9bito",
        paragrafos: ["O estorno ser\xE1 solicitado em at\xE9 7 dias \xFAteis ap\xF3s o cancelamento.", "O prazo para cr\xE9dito depende da operadora do cart\xE3o."]
      },
      {
        titulo: "3.2 PIX",
        paragrafos: ["O reembolso ser\xE1 realizado em at\xE9 7 dias \xFAteis ap\xF3s o cancelamento.", "A devolu\xE7\xE3o ser\xE1 feita exclusivamente para conta de titularidade do cliente."]
      }
    ]
  },
  {
    titulo: "4. Reagendamento",
    paragrafos: ["O reagendamento pode ser solicitado sem custo, desde que realizado com no m\xEDnimo 48 horas de anteced\xEAncia e sujeito \xE0 disponibilidade."]
  },
  {
    titulo: "5. Cancelamento pelo Kart\xF3dromo Internacional de Betim",
    paragrafos: ["O kart\xF3dromo poder\xE1 cancelar reservas por motivos operacionais ou de for\xE7a maior, garantindo reembolso integral ao cliente."]
  },
  {
    titulo: "6. Disposi\xE7\xF5es Gerais",
    itens: ["Cancelamentos devem ser feitos pelos canais oficiais;", "A confirma\xE7\xE3o ser\xE1 enviada via WhatsApp;", "Promo\xE7\xF5es podem ter regras espec\xEDficas."]
  },
  {
    titulo: "7. Aceita\xE7\xE3o",
    paragrafos: ["Ao realizar a reserva, o cliente declara que leu e aceita integralmente esta Pol\xEDtica."]
  }
];

// src/reservas.ts
var json = /* @__PURE__ */ __name((status, body2, cache2 = "no-store") => new Response(JSON.stringify(body2), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": cache2 } }), "json");
var chavePedido = /* @__PURE__ */ __name((id) => `reservas/pedidos/${id}.json`, "chavePedido");
var chaveFila = /* @__PURE__ */ __name((id) => `reservas/fila/${id}`, "chaveFila");
var idValido = /* @__PURE__ */ __name((id) => /^[a-f0-9-]{36}$/.test(id), "idValido");
async function lerPedido(env, id) {
  if (!idValido(id)) return null;
  const o = await env.PRE.get(chavePedido(id));
  return o ? await o.json() : null;
}
__name(lerPedido, "lerPedido");
async function gravarPedido(env, p, naFila) {
  p.atualizadoEm = (/* @__PURE__ */ new Date()).toISOString();
  await env.PRE.put(chavePedido(p.id), JSON.stringify(p), { httpMetadata: { contentType: "application/json" } });
  if (naFila) await env.PRE.put(chaveFila(p.id), p.status);
  else await env.PRE.delete(chaveFila(p.id));
}
__name(gravarPedido, "gravarPedido");
async function agendaAtual(env) {
  const o = await env.PRE.get("reservas/agenda.json");
  return o ? await o.json() : null;
}
__name(agendaAtual, "agendaAtual");
function liberado(req, env) {
  if (env.RESERVAS_ATIVAS === "1") return true;
  const previa = new URL(req.url).searchParams.get("previa") ?? req.headers.get("x-previa") ?? "";
  return Boolean(env.RESERVAS_PREVIA && previa === env.RESERVAS_PREVIA);
}
__name(liberado, "liberado");
function visaoPublica(p) {
  return {
    id: p.id,
    codigo: p.codigo,
    status: p.status,
    forma: p.forma,
    quantidade: p.quantidade,
    nome: p.cliente.nome.split(" ")[0],
    descricao: p.servidor?.descricao ?? null,
    inicio: p.servidor?.inicio ?? null,
    valorCentavos: p.servidor?.valorCentavos ?? null,
    expiraEm: p.servidor?.expiraEm ?? null,
    pix: p.status === "aguardando_pagamento" && p.asaas?.pixPayload ? { payload: p.asaas.pixPayload, imagem: p.asaas.pixImagem } : null,
    invoiceUrl: p.status === "aguardando_pagamento" && p.forma === "cartao" ? p.asaas?.invoiceUrl ?? null : null,
    preparandoPagamento: p.status === "aguardando_pagamento" && !p.asaas,
    erro: p.erro ?? null
  };
}
__name(visaoPublica, "visaoPublica");
async function criarPedido(req, env, excedeuLimite2) {
  if (!liberado(req, env)) return json(403, { erro: "A reserva online ainda n\xE3o est\xE1 aberta." });
  if (!asaasLigado(env)) return json(503, { erro: "Pagamento online indispon\xEDvel no momento. Fale com a recep\xE7\xE3o pelo WhatsApp." });
  let corpo;
  try {
    corpo = await req.json();
  } catch {
    return json(400, { erro: "Envio inv\xE1lido." });
  }
  if (String(corpo.site ?? "") !== "") return json(400, { erro: "Envio inv\xE1lido." });
  const aberto = Number(corpo.t ?? 0);
  if (!aberto || Date.now() - aberto < 6e3) return json(400, { erro: "Confira os dados e envie de novo." });
  if (await excedeuLimite2(req.headers.get("cf-connecting-ip") ?? "x")) return json(429, { erro: "Muitos pedidos seguidos. Aguarde alguns minutos." });
  const v = validarReserva(corpo, await agendaAtual(env));
  if (!v.ok) return json(400, { erro: v.erro });
  const agora = (/* @__PURE__ */ new Date()).toISOString();
  const p = {
    id: crypto.randomUUID(),
    codigo: codigoReserva(),
    status: "novo",
    criadoEm: agora,
    atualizadoEm: agora,
    bateriaId: v.dados.bateriaId,
    quantidade: v.dados.quantidade,
    forma: v.dados.forma,
    pilotos: v.dados.pilotos,
    acompanhantes: v.dados.acompanhantes.map((a) => ({ ...a, chave: chaveDocumento("CPF", a.documento) })),
    compradorPilota: v.dados.compradorPilota,
    cliente: { ...v.dados.cliente, chave: chaveDocumento("CPF", v.dados.cliente.documento) },
    politica: { versao: POLITICA_VERSAO, aceitaEm: agora }
  };
  await gravarPedido(env, p, true);
  return json(201, { id: p.id, codigo: p.codigo });
}
__name(criarPedido, "criarPedido");
function politicaPublica() {
  return json(200, { versao: POLITICA_VERSAO, titulo: POLITICA_TITULO, aceite: POLITICA_ACEITE, secoes: POLITICA_SECOES }, "public, max-age=300");
}
__name(politicaPublica, "politicaPublica");
async function situacaoPedido(env, id, ctx) {
  const p = await lerPedido(env, id);
  if (!p) return json(404, { erro: "Reserva n\xE3o encontrada." });
  if (p.status === "aguardando_pagamento" && p.asaas?.pagamentoId && asaasLigado(env)) {
    const ultima = p.asaas.consultadoEm ? Date.parse(p.asaas.consultadoEm) : 0;
    if (Date.now() - ultima > 15e3) {
      p.asaas.consultadoEm = (/* @__PURE__ */ new Date()).toISOString();
      try {
        const c = await consultar(env, p.asaas.pagamentoId);
        const pagou = PAGO.has(c.status) && marcarPago(p, c.id, c.billingType);
        await gravarPedido(env, p, pagou);
      } catch (e) {
        console.error("consulta asaas", e.message);
      }
    }
  }
  void ctx;
  return json(200, visaoPublica(p));
}
__name(situacaoPedido, "situacaoPedido");
async function agendaPublica(req, env) {
  if (!liberado(req, env)) return json(403, { erro: "A reserva online ainda n\xE3o est\xE1 aberta." });
  const a = await agendaAtual(env);
  if (!a) return json(503, { erro: "A agenda est\xE1 sendo atualizada. Tente de novo em instantes." });
  return json(200, { ...a, pagamentoOnline: asaasLigado(env) }, "public, max-age=3, must-revalidate");
}
__name(agendaPublica, "agendaPublica");
function marcarPago(p, asaasId, billingType) {
  if (p.status === "pago" || p.status === "confirmado" || p.status === "pago_sem_vaga") return false;
  p.status = "pago";
  p.pagamento = { asaasId, billingType, pagoEm: (/* @__PURE__ */ new Date()).toISOString(), valorCentavos: p.servidor?.valorCentavos ?? 0 };
  return true;
}
__name(marcarPago, "marcarPago");
function tokenConfere(recebido, esperado) {
  if (!esperado || recebido.length !== esperado.length) return false;
  let dif = 0;
  for (let i = 0; i < esperado.length; i++) dif |= recebido.charCodeAt(i) ^ esperado.charCodeAt(i);
  return dif === 0;
}
__name(tokenConfere, "tokenConfere");
async function webhookAsaas(req, env) {
  if (!tokenConfere(req.headers.get("asaas-access-token") ?? "", env.ASAAS_WEBHOOK_TOKEN ?? "")) return json(401, { erro: "N\xE3o autorizado." });
  const corpo = await req.json().catch(() => ({}));
  const ref = corpo.payment?.externalReference ?? "";
  if (!corpo.event || !EVENTOS_PAGO.has(corpo.event) || !idValido(ref)) return json(200, { ok: true, ignorado: true });
  const p = await lerPedido(env, ref);
  if (!p) return json(200, { ok: true, ignorado: true });
  if (marcarPago(p, corpo.payment?.id ?? "", corpo.payment?.billingType ?? "")) await gravarPedido(env, p, true);
  return json(200, { ok: true });
}
__name(webhookAsaas, "webhookAsaas");
async function cobrar(env, p) {
  try {
    const cliente = await garantirCliente(env, {
      nome: p.cliente.nome,
      cpf: digitos(p.cliente.documento),
      email: p.cliente.email,
      celular: digitos(p.cliente.telefone),
      referencia: p.cliente.chave
    });
    let c;
    try {
      c = await criarCobranca(env, cliente, p.forma, p.servidor.valorCentavos, p.servidor.descricao + ` \xB7 reserva ${p.codigo}`, p.id);
    } catch (error) {
      const existente = await buscarCobrancaPorReferencia(env, p.id);
      if (!existente) throw error;
      c = existente;
    }
    p.asaas = { pagamentoId: c.id, invoiceUrl: c.invoiceUrl };
    if (p.forma === "pix") {
      const q = await qrPix(env, c.id);
      p.asaas.pixPayload = q.payload;
      p.asaas.pixImagem = q.encodedImage;
    }
    if (PAGO.has(c.status)) {
      p.status = "pago";
      p.pagamento = { asaasId: c.id, billingType: c.billingType, pagoEm: (/* @__PURE__ */ new Date()).toISOString(), valorCentavos: p.servidor.valorCentavos };
    }
  } catch (e) {
    console.error("cobran\xE7a asaas", e.message);
    p.status = "erro_pagamento";
    p.erro = "N\xE3o conseguimos gerar o pagamento agora. Tente de novo em alguns minutos ou fale com a recep\xE7\xE3o pelo WhatsApp.";
  }
  const atual = await lerPedido(env, p.id);
  if (atual && atual.status !== "aguardando_pagamento") return;
  await gravarPedido(env, p, p.status === "pago");
}
__name(cobrar, "cobrar");
var proximaConciliacao = 0;
async function conciliarPagamentos(env, agora = Date.now()) {
  if (!asaasLigado(env) || agora < proximaConciliacao) return 0;
  proximaConciliacao = agora + 6e4;
  let n = 0;
  try {
    for (const c of await pagasDesde(env, hojeBrasilia(new Date(agora - 2 * 864e5)))) {
      if (!PAGO.has(c.status) || !c.externalReference || !idValido(c.externalReference)) continue;
      const p = await lerPedido(env, c.externalReference);
      if (!p) continue;
      const parado = p.status === "pago" && !await env.PRE.get(chaveFila(p.id));
      if (marcarPago(p, c.id, c.billingType) || parado) {
        await gravarPedido(env, p, true);
        console.log(`reserva ${p.codigo}: pagamento ${c.id} achado na confer\xEAncia com a Asaas`);
        n++;
      }
    }
  } catch (e) {
    console.error("confer\xEAncia asaas", e.message);
  }
  return n;
}
__name(conciliarPagamentos, "conciliarPagamentos");
async function syncPedidos(env) {
  await conciliarPagamentos(env);
  const fila = await env.PRE.list({ prefix: "reservas/fila/", limit: 50 });
  const itens = [];
  for (const o of fila.objects) {
    const p = await lerPedido(env, o.key.slice("reservas/fila/".length));
    if (p && (p.status === "novo" || p.status === "pago")) itens.push(p);
    else await env.PRE.delete(o.key);
  }
  return json(200, itens);
}
__name(syncPedidos, "syncPedidos");
async function syncAgenda(req, env) {
  const a = await req.json();
  if (!Array.isArray(a?.horarios)) return json(400, { erro: "Agenda inv\xE1lida." });
  await env.PRE.put("reservas/agenda.json", JSON.stringify(a), { httpMetadata: { contentType: "application/json" } });
  return json(200, { horarios: a.horarios.length });
}
__name(syncAgenda, "syncAgenda");
async function syncResultado(req, env, ctx) {
  const lista = await req.json();
  let n = 0;
  for (const r of Array.isArray(lista) ? lista : []) {
    const p = await lerPedido(env, String(r.id));
    if (!p) continue;
    n++;
    if (r.acao === "reservado" && p.status === "novo") {
      p.status = "aguardando_pagamento";
      p.servidor = { valorCentavos: Number(r.valorCentavos), expiraEm: String(r.expiraEm), descricao: String(r.descricao ?? ""), inicio: String(r.inicio ?? "") };
      await gravarPedido(env, p, false);
      ctx.waitUntil(cobrar(env, p));
    } else if (r.acao === "recusado" && p.status === "novo") {
      p.status = "recusado";
      p.erro = r.erro ?? "Esse hor\xE1rio n\xE3o est\xE1 mais dispon\xEDvel.";
      await gravarPedido(env, p, false);
    } else if (r.acao === "confirmado" && (p.status === "pago" || p.status === "novo")) {
      p.status = "confirmado";
      await gravarPedido(env, p, false);
    } else if (r.acao === "expirado" && (p.status === "aguardando_pagamento" || p.status === "erro_pagamento")) {
      p.status = "expirado";
      await gravarPedido(env, p, false);
      if (p.asaas?.pagamentoId && asaasLigado(env)) ctx.waitUntil(cancelar(env, p.asaas.pagamentoId).then(() => void 0, (e) => console.error("cancelar asaas", e.message)));
    } else if (r.acao === "pago_sem_vaga") {
      p.status = "pago_sem_vaga";
      p.erro = r.erro;
      await gravarPedido(env, p, false);
    }
  }
  return json(200, { processados: n });
}
__name(syncResultado, "syncResultado");

// src/mobile/auth.ts
import { scryptSync } from "node:crypto";

// src/mobile/clientes.ts
var CHAVE_R2 = "app/clientes-indice.json";
var encoder = new TextEncoder();
var cache = null;
async function codigoDoCpf(segredo, cpf) {
  const k = await crypto.subtle.importKey("raw", encoder.encode(segredo), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", k, encoder.encode("cpf:" + cpf)));
  return Array.from(sig.slice(0, 16), (b) => b.toString(16).padStart(2, "0")).join("");
}
__name(codigoDoCpf, "codigoDoCpf");
var json2 = /* @__PURE__ */ __name((status, body2) => new Response(JSON.stringify(body2), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
}), "json");
async function receberClientes(request, env, autorizado3) {
  if (!autorizado3) return json2(401, { erro: "N\xE3o autorizado." });
  if (!env.PRE) return json2(503, { erro: "Servi\xE7o temporariamente indispon\xEDvel." });
  const corpo = await request.json().catch(() => null);
  const itens = Array.isArray(corpo?.itens) ? corpo.itens : [];
  const validos = itens.filter((i) => Array.isArray(i) && typeof i[0] === "string" && /^[0-9a-f]{32}$/.test(i[0]) && (i[1] === null || typeof i[1] === "string" && i[1].length <= 80));
  if (!validos.length) return json2(400, { erro: "Nada para gravar." });
  await env.PRE.put(CHAVE_R2, JSON.stringify(validos), { httpMetadata: { contentType: "application/json" } });
  cache = null;
  return json2(200, { ok: true, gravados: validos.length });
}
__name(receberClientes, "receberClientes");
async function clienteExistente(env, cpf) {
  if (!env.PRE || !env.MOBILE_ADMIN_TOKEN) return null;
  if (!cache || Date.now() - cache.em > 10 * 6e4) {
    const obj = await env.PRE.get(CHAVE_R2);
    const lista = obj ? JSON.parse(await obj.text()) : [];
    cache = { em: Date.now(), mapa: new Map(lista) };
  }
  const codigo = await codigoDoCpf(env.MOBILE_ADMIN_TOKEN, cpf);
  return cache.mapa.has(codigo) ? cache.mapa.get(codigo) ?? "" : null;
}
__name(clienteExistente, "clienteExistente");

// src/mobile/email.ts
var REMETENTE_PADRAO = "resultados@kartodromodebetim.com.br";
function mobileEmailConfigured(env) {
  return Boolean(env.EMAIL || env.MOBILE_DB || env.RESEND_API_KEY?.trim() && env.RESEND_FROM_EMAIL?.trim());
}
__name(mobileEmailConfigured, "mobileEmailConfigured");
async function enfileirar(env, to, subject, text, html) {
  if (!env.MOBILE_DB) return false;
  const agora = Date.now();
  await env.MOBILE_DB.prepare(
    "INSERT INTO mobile_email_outbox(id, to_address, subject, text_body, html_body, created_at) VALUES (?, ?, ?, ?, ?, ?)"
  ).bind(crypto.randomUUID(), to, subject, text, html, agora).run();
  return true;
}
__name(enfileirar, "enfileirar");
function mobileEmailLink(env, purpose, token) {
  const base = (env.MOBILE_PUBLIC_URL?.trim() || "https://reservas.kartodromodebetim.com.br").replace(/\/$/, "");
  return `${base}/conta?acao=${purpose === "verify" ? "verificar" : "senha"}&token=${encodeURIComponent(token)}`;
}
__name(mobileEmailLink, "mobileEmailLink");
var LOGO = "https://reservas.kartodromodebetim.com.br/kib-logo-escuro.png";
var KART = "https://reservas.kartodromodebetim.com.br/email-kart.gif?v=2";
var xadrez = /* @__PURE__ */ __name((inverte) => Array.from({ length: 45 }, (_, i) => `<td height="10" style="background:${(i + (inverte ? 1 : 0)) % 2 ? "#ffffff" : "#0b0b0d"};font-size:0;line-height:0">&nbsp;</td>`).join(""), "xadrez");
function conteudo(purpose, link) {
  const verificar = purpose === "verify";
  const subject = verificar ? "\u{1F3C1} Seu kart est\xE1 no grid \u2014 falta s\xF3 a largada!" : "\u{1F527} Pit stop: crie sua nova senha \xB7 Kart\xF3dromo de Betim";
  const acao = verificar ? "Confirmar e acelerar \u{1F3CE}\uFE0F" : "Criar nova senha";
  const titulo = verificar ? "Motor ligado. Falta a largada!" : "Pit stop r\xE1pido";
  const intro = verificar ? "Bem-vindo ao Kart\xF3dromo Internacional de Betim! Sua conta j\xE1 est\xE1 aquecendo os pneus no grid. Confirme seu e-mail e libere tudo: reserve baterias em segundos, acompanhe cada volta ao vivo e construa sua carreira de piloto \u2014 com XP, conquistas e categorias de Novato a Lenda." : "Recebemos um pedido para trocar a senha da sua conta. \xC9 rapidinho: toque no bot\xE3o, escolha uma senha nova e volte para a pista em segundos.";
  const fim = verificar ? "Se voc\xEA n\xE3o criou esta conta, \xE9 s\xF3 ignorar este e-mail." : "Se n\xE3o foi voc\xEA, ignore este e-mail: sua senha continua a mesma.";
  const vantagens = verificar ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 26px"><tr>${[["\u{1F3CE}\uFE0F", "Reserve sua bateria"], ["\u23F1\uFE0F", "Tempos ao vivo"], ["\u{1F3C6}", "Ranking e carreira"]].map(([e, t]) => `<td align="center" width="32%" style="padding:12px 4px;background:#17171b;border-radius:14px;font-size:12px;color:#d4d4d8"><div style="font-size:22px;line-height:30px">${e}</div>${t}</td>`).join('<td width="2%"></td>')}</tr></table>` : "";
  const categorias = verificar ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:26px 0 0;background:#141418;border-radius:16px"><tr><td style="padding:18px 18px 16px">
<p style="margin:0 0 10px;font-size:12px;font-weight:800;letter-spacing:.14em;color:#f59e0b">\u{1F525} SEU DESAFIO DE ESTREIA</p>
<p style="margin:0 0 14px;font-size:14px;line-height:1.55;color:#d4d4d8">Confirme, reserve sua primeira bateria e tente entrar no <b style="color:#ffffff">top 10 da semana</b>. Cada bateria vale XP \u2014 e cada p\xF3dio te leva mais perto do topo.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${[["NOVATO", "#9ca3af"], ["AMADOR", "#22c55e"], ["SEMI-PRO", "#3b82f6"], ["PRO", "#a855f7"], ["LENDA", "#f59e0b"]].map(([n, c], i) => `<td align="center" style="padding:7px 2px;border-radius:999px;background:${i === 0 ? c : "#1f1f25"};color:${i === 0 ? "#000000" : c};font-size:10px;font-weight:900;letter-spacing:.06em">${n}</td>`).join('<td width="4" style="font-size:10px;color:#3f3f46">\u203A</td>')}</tr></table>
<p style="margin:10px 0 0;font-size:12px;color:#71717a">Voc\xEA come\xE7a aqui \u2B06\uFE0F At\xE9 onde vai chegar?</p></td></tr></table>` : "";
  const href = link.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
  const text = `${titulo}

${intro}

${acao}: ${link}

O link vale por 30 minutos. ${fim}

Kart\xF3dromo Internacional de Betim`;
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta name="color-scheme" content="dark light"></head>
<body style="margin:0;padding:0;background:#000000;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#000000"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:540px;background:#0b0b0d;border-radius:24px;overflow:hidden;border:1px solid #26262b">
<tr><td align="center" style="padding:30px 24px 24px"><img src="${LOGO}" width="240" alt="Kart\xF3dromo Internacional de Betim" style="display:block;width:240px;max-width:80%;height:auto;border:0"></td></tr>
<tr><td style="line-height:0;font-size:0"><img src="${KART}" width="540" alt="Karts disputando a curva na pista do Kart\xF3dromo de Betim" style="display:block;width:100%;max-width:540px;height:auto;border:0"></td></tr>
<tr><td><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="table-layout:fixed"><tr>${xadrez(false)}</tr><tr>${xadrez(true)}</tr></table></td></tr>
<tr><td style="padding:32px 28px 8px">
<p style="margin:0 0 8px;font-size:12px;font-weight:800;letter-spacing:.18em;color:#f59e0b">APP DO PILOTO</p>
<h1 style="margin:0 0 14px;font-size:30px;line-height:1.15;color:#ffffff;font-weight:900">${titulo}</h1>
<p style="margin:0 0 26px;font-size:16px;line-height:1.6;color:#a1a1aa">${intro}</p>
${vantagens}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="border-radius:999px;background:#f59e0b">
<a href="${href}" style="display:block;padding:17px 24px;font-size:17px;font-weight:900;color:#000000;text-decoration:none;border-radius:999px">${acao} \u2192</a></td></tr></table>
<p style="margin:18px 0 0;font-size:13px;line-height:1.5;color:#71717a;text-align:center">\u23F1\uFE0F O link vale por 30 minutos. ${fim}</p>
${categorias}
</td></tr>
<tr><td style="padding:26px 28px 30px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #26262b"><tr><td style="padding-top:18px;font-size:12px;line-height:1.6;color:#71717a;text-align:center">
<b style="color:#a1a1aa">Nos vemos na pista! \u{1F3C1}</b><br>Kart\xF3dromo Internacional de Betim \xB7 Betim/MG<br>E-mail autom\xE1tico do app. N\xE3o precisa responder.</td></tr></table></td></tr>
</table></td></tr></table></body></html>`;
  return { subject, text, html };
}
__name(conteudo, "conteudo");
var LIMITE_MES = 2500;
async function cotaDoMes(env) {
  if (!env.MOBILE_DB) return true;
  const mes = (/* @__PURE__ */ new Date()).toISOString().slice(0, 7);
  await env.MOBILE_DB.prepare("CREATE TABLE IF NOT EXISTS mobile_email_cota (mes TEXT PRIMARY KEY, enviados INTEGER NOT NULL)").run();
  const r = await env.MOBILE_DB.prepare("SELECT enviados FROM mobile_email_cota WHERE mes = ?").bind(mes).first();
  return (r?.enviados ?? 0) < LIMITE_MES;
}
__name(cotaDoMes, "cotaDoMes");
async function contar(env) {
  if (!env.MOBILE_DB) return;
  const mes = (/* @__PURE__ */ new Date()).toISOString().slice(0, 7);
  await env.MOBILE_DB.prepare("INSERT INTO mobile_email_cota(mes, enviados) VALUES (?, 1) ON CONFLICT(mes) DO UPDATE SET enviados = enviados + 1").bind(mes).run();
}
__name(contar, "contar");
async function sendMobileAuthEmail(env, to, purpose, token) {
  if (!mobileEmailConfigured(env)) return false;
  const { subject, text, html } = conteudo(purpose, mobileEmailLink(env, purpose, token));
  return entregar(env, to, subject, text, html);
}
__name(sendMobileAuthEmail, "sendMobileAuthEmail");
async function sendMobileAccountDeletionEmail(env, to, limite) {
  if (!mobileEmailConfigured(env)) return false;
  const data = limite.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const subject = "Sua conta foi marcada para exclus\xE3o \xB7 Kart\xF3dromo de Betim";
  const text = `Recebemos um pedido para excluir sua conta do aplicativo do Kart\xF3dromo de Betim. Ela ser\xE1 apagada em ${data}.

Foi voc\xEA? N\xE3o precisa fazer nada.

N\xE3o foi voc\xEA? Abra o aplicativo, entre com sua senha e toque em Restaurar conta. Depois, troque sua senha.`;
  const html = `<p>Recebemos um pedido para excluir sua conta do aplicativo do Kart\xF3dromo de Betim. Ela ser\xE1 apagada em <strong>${data}</strong>.</p><p>Foi voc\xEA? N\xE3o precisa fazer nada.</p><p><strong>N\xE3o foi voc\xEA?</strong> Abra o aplicativo, entre com sua senha e toque em <strong>Restaurar conta</strong>. Depois, troque sua senha.</p>`;
  return entregar(env, to, subject, text, html);
}
__name(sendMobileAccountDeletionEmail, "sendMobileAccountDeletionEmail");
async function entregar(env, to, subject, text, html) {
  if (env.EMAIL && env.MOBILE_EMAIL_FILA !== "1" && await cotaDoMes(env).catch(() => false)) {
    try {
      await env.EMAIL.send({
        to,
        from: { email: env.MOBILE_EMAIL_FROM?.trim() || REMETENTE_PADRAO, name: "Kart\xF3dromo de Betim" },
        subject,
        text,
        html
      });
      await contar(env).catch(() => void 0);
      return true;
    } catch (e) {
      console.error("mobile email binding", e.code ?? "", e.message);
    }
  }
  if (env.MOBILE_EMAIL_FILA === "1" || !(env.RESEND_API_KEY?.trim() && env.RESEND_FROM_EMAIL?.trim())) {
    try {
      return await enfileirar(env, to, subject, text, html);
    } catch (e) {
      console.error("mobile email outbox", e.message);
      return false;
    }
  }
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${env.RESEND_API_KEY}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({ from: env.RESEND_FROM_EMAIL, to: [to], subject, text, html })
    });
    if (response.ok) return true;
  } catch {
  }
  try {
    return await enfileirar(env, to, subject, text, html);
  } catch {
    console.error("mobile email outbox unavailable");
    return false;
  }
}
__name(entregar, "entregar");

// src/mobile/auth.ts
var ITERATIONS = 6e5;
var PASSWORD_SCHEME = "scrypt-32768-8-3-v1";
var PASSWORD_MIN = 8;
var PASSWORD_MAX = 128;
var ACCESS_TTL = 15 * 6e4;
var REFRESH_TTL = 30 * 24 * 60 * 6e4;
var RATE_WINDOW = 10 * 6e4;
var DELETION_GRACE = 30 * 24 * 60 * 60 * 1e3;
var RATE_LIMIT = 6;
var RATE_LIMIT_IP = 60;
var TOKEN_TTL = 30 * 6e4;
var encoder2 = new TextEncoder();
var authError = "E-mail/CPF ou senha inv\xE1lidos.";
var genericMessage = "Se os dados puderem ser processados, enviaremos as instru\xE7\xF5es ao e-mail informado.";
var json3 = /* @__PURE__ */ __name((status, value2) => new Response(JSON.stringify(value2), {
  status,
  headers: {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  }
}), "json");
function encodeBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
__name(encodeBase64Url, "encodeBase64Url");
function decodeBase64Url(value2) {
  const padded = value2.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - value2.length % 4) % 4);
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
}
__name(decodeBase64Url, "decodeBase64Url");
async function createContext(env) {
  if (!env.MOBILE_DB || !env.MOBILE_LOOKUP_KEY || !env.MOBILE_DATA_KEY) return null;
  if (encoder2.encode(env.MOBILE_LOOKUP_KEY).length < 32) return null;
  const dataKeyBytes = decodeBase64Url(env.MOBILE_DATA_KEY);
  if (dataKeyBytes.length !== 32) return null;
  const [lookupKey, dataKey] = await Promise.all([
    crypto.subtle.importKey(
      "raw",
      encoder2.encode(env.MOBILE_LOOKUP_KEY),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    ),
    crypto.subtle.importKey("raw", dataKeyBytes, { name: "AES-GCM" }, false, ["encrypt", "decrypt"])
  ]);
  return { db: env.MOBILE_DB, lookupKey, dataKey };
}
__name(createContext, "createContext");
async function hmac(context, value2) {
  return encodeBase64Url(new Uint8Array(await crypto.subtle.sign("HMAC", context.lookupKey, encoder2.encode(value2))));
}
__name(hmac, "hmac");
async function sha256(value2) {
  return encodeBase64Url(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder2.encode(value2))));
}
__name(sha256, "sha256");
function randomToken() {
  return encodeBase64Url(crypto.getRandomValues(new Uint8Array(32)));
}
__name(randomToken, "randomToken");
async function encrypt(context, value2) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    context.dataKey,
    encoder2.encode(value2)
  );
  const packed = new Uint8Array(iv.length + ciphertext.byteLength);
  packed.set(iv);
  packed.set(new Uint8Array(ciphertext), iv.length);
  return encodeBase64Url(packed);
}
__name(encrypt, "encrypt");
async function decrypt(context, value2) {
  const packed = decodeBase64Url(value2);
  const clear = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: packed.slice(0, 12) },
    context.dataKey,
    packed.slice(12)
  );
  return new TextDecoder().decode(clear);
}
__name(decrypt, "decrypt");
async function mobileAccountCpf(env, accountId) {
  const context = await createContext(env);
  if (!context) return null;
  const row = await context.db.prepare("SELECT cpf_cipher FROM mobile_accounts WHERE id = ? LIMIT 1").bind(accountId).first();
  return row ? decrypt(context, row.cpf_cipher) : null;
}
__name(mobileAccountCpf, "mobileAccountCpf");
async function mobileIdentityCandidates(env, limit = 50) {
  const context = await createContext(env);
  if (!context) return null;
  const { results } = await context.db.prepare(
    `SELECT a.email_cipher, a.cpf_cipher, a.phone_cipher, l.nivel nivel FROM mobile_accounts a
       LEFT JOIN mobile_identity_links l ON l.account_id = a.id
      WHERE a.email_verified_at IS NOT NULL
        AND a.deleted_at IS NULL
        AND (l.account_id IS NULL OR l.nivel = 'cpf')
      ORDER BY (l.account_id IS NOT NULL), a.email_verified_at DESC LIMIT ?`
  ).bind(limit).all();
  return Promise.all(results.map(async (row) => ({
    email: await decrypt(context, row.email_cipher),
    cpf: await decrypt(context, row.cpf_cipher),
    phone: await decrypt(context, row.phone_cipher),
    nivel: row.nivel
  })));
}
__name(mobileIdentityCandidates, "mobileIdentityCandidates");
async function passwordHash(password, salt, scheme = PASSWORD_SCHEME) {
  if (scheme === PASSWORD_SCHEME) {
    return encodeBase64Url(scryptSync(password, salt, 32, { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 }));
  }
  if (scheme !== "pbkdf2-sha256-v1") throw new Error("Unsupported password scheme");
  const key = await crypto.subtle.importKey("raw", encoder2.encode(password), "PBKDF2", false, ["deriveBits"]);
  const saltBuffer = new ArrayBuffer(salt.byteLength);
  new Uint8Array(saltBuffer).set(salt);
  const derived = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: saltBuffer, iterations: ITERATIONS },
    key,
    256
  );
  return encodeBase64Url(new Uint8Array(derived));
}
__name(passwordHash, "passwordHash");
function constantTimeEqual(left, right) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index++) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}
__name(constantTimeEqual, "constantTimeEqual");
function normalizeEmail(value2) {
  return value2.trim().toLowerCase();
}
__name(normalizeEmail, "normalizeEmail");
function normalizeIdentifier(value2) {
  const trimmed = value2.trim();
  return trimmed.includes("@") ? normalizeEmail(trimmed) : digitos(trimmed);
}
__name(normalizeIdentifier, "normalizeIdentifier");
function clientIp(request) {
  return request.headers.get("cf-connecting-ip") ?? "unknown";
}
__name(clientIp, "clientIp");
async function overLimit(context, scope, limit = RATE_LIMIT) {
  const now = Date.now();
  const key = await hmac(context, scope);
  const row = await context.db.prepare(
    `INSERT INTO mobile_auth_attempts(scope_hash, window_started_at, attempt_count)
       VALUES (?, ?, 1)
       ON CONFLICT(scope_hash) DO UPDATE SET
         attempt_count = CASE
           WHEN mobile_auth_attempts.window_started_at + ? <= ? THEN 1
           ELSE mobile_auth_attempts.attempt_count + 1
         END,
         window_started_at = CASE
           WHEN mobile_auth_attempts.window_started_at + ? <= ? THEN ?
           ELSE mobile_auth_attempts.window_started_at
         END
       RETURNING attempt_count`
  ).bind(key, now, RATE_WINDOW, now, RATE_WINDOW, now, now).first();
  await context.db.prepare("DELETE FROM mobile_auth_attempts WHERE window_started_at + ? < ?").bind(24 * 60 * 6e4, now).run();
  return Number(row?.attempt_count ?? limit + 1) > limit;
}
__name(overLimit, "overLimit");
async function rateLimited(context, request, route, identifier = "") {
  const ipLimit = await overLimit(context, `${route}:ip:${clientIp(request)}`, RATE_LIMIT_IP);
  if (ipLimit) return true;
  return identifier ? overLimit(context, `${route}:id:${identifier}`) : false;
}
__name(rateLimited, "rateLimited");
async function requestBody(request) {
  const contentType = request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
  const contentLength = Number(request.headers.get("content-length"));
  if (contentType !== "application/json" || contentLength > 16384 || !request.body) return null;
  const reader = request.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value: value2 } = await reader.read();
      if (done) break;
      size += value2.byteLength;
      if (size > 16384) {
        await reader.cancel();
        return null;
      }
      chunks.push(value2);
    }
  } catch {
    return null;
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    const value2 = JSON.parse(new TextDecoder().decode(bytes));
    return value2 && typeof value2 === "object" && !Array.isArray(value2) ? value2 : null;
  } catch {
    return null;
  }
}
__name(requestBody, "requestBody");
function value(input, key) {
  return typeof input[key] === "string" ? input[key] : "";
}
__name(value, "value");
function acceptedRegistration() {
  return json3(202, { mensagem: genericMessage });
}
__name(acceptedRegistration, "acceptedRegistration");
async function validateRegistration(input) {
  const name = value(input, "name").replace(/\s+/g, " ").trim();
  const email = normalizeEmail(value(input, "email"));
  const cpf = digitos(value(input, "cpf"));
  const phone = digitos(value(input, "phone"));
  const password = value(input, "password");
  if (password.length < PASSWORD_MIN) return { error: "A senha deve ter pelo menos 8 caracteres." };
  if (password.length > PASSWORD_MAX) return { error: "A senha deve ter no m\xE1ximo 128 caracteres." };
  if (name.length < 3 || name.length > 120 || name.split(" ").length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || !cpfValido(cpf) || phone.length < 10 || phone.length > 13 || input.privacyAccepted !== true) {
    return { error: "Revise os dados informados e aceite a pol\xEDtica de privacidade." };
  }
  return { value: { name, email, cpf, phone, password } };
}
__name(validateRegistration, "validateRegistration");
async function findAccount(context, identifier) {
  if (identifier.includes("@")) {
    const lookup2 = await hmac(context, `email:${normalizeEmail(identifier)}`);
    return context.db.prepare(
      `SELECT id, name_cipher, email_lookup, email_cipher, cpf_lookup, cpf_cipher,
                phone_cipher, password_salt, password_hash, password_iterations, password_scheme, email_verified_at, deleted_at
         FROM mobile_accounts WHERE email_lookup = ? LIMIT 1`
    ).bind(lookup2).first();
  }
  const lookup = await hmac(context, `cpf:${digitos(identifier)}`);
  return context.db.prepare(
    `SELECT id, name_cipher, email_lookup, email_cipher, cpf_lookup, cpf_cipher,
              phone_cipher, password_salt, password_hash, password_iterations, password_scheme, email_verified_at, deleted_at
       FROM mobile_accounts WHERE cpf_lookup = ? LIMIT 1`
  ).bind(lookup).first();
}
__name(findAccount, "findAccount");
async function createEmailToken(context, accountId, purpose) {
  const now = Date.now();
  const token = randomToken();
  const tokenHash = await sha256(token);
  await context.db.prepare("DELETE FROM mobile_email_tokens WHERE expires_at <= ?").bind(now).run();
  await context.db.prepare(
    `INSERT INTO mobile_email_tokens(token_hash, account_id, purpose, expires_at, used_at, created_at)
       VALUES (?, ?, ?, ?, NULL, ?)`
  ).bind(tokenHash, accountId, purpose, now + TOKEN_TTL, now).run();
  return token;
}
__name(createEmailToken, "createEmailToken");
async function deliverEmail(env, context, account, purpose) {
  const email = await decrypt(context, account.email_cipher);
  const token = await createEmailToken(context, account.id, purpose);
  const delivered = await sendMobileAuthEmail(env, email, purpose, token);
  if (!delivered) throw new Error("Mobile email delivery unavailable");
}
__name(deliverEmail, "deliverEmail");
async function register(request, input, env, context) {
  if (!mobileEmailConfigured(env)) return json3(503, { erro: "Cadastro temporariamente indispon\xEDvel." });
  const checked = await validateRegistration(input);
  if ("error" in checked) return json3(400, { erro: checked.error });
  if (await rateLimited(context, request, "register", checked.value.email)) {
    return json3(429, { erro: "Muitas tentativas. Aguarde alguns minutos." });
  }
  const { name, email, cpf, phone, password } = checked.value;
  const [nameCipher, emailCipher, cpfCipher, phoneCipher, emailLookup2, cpfLookup] = await Promise.all([
    encrypt(context, name),
    encrypt(context, email),
    encrypt(context, cpf),
    encrypt(context, phone),
    hmac(context, `email:${email}`),
    hmac(context, `cpf:${cpf}`)
  ]);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const passwordDigest = await passwordHash(password, salt);
  const id = crypto.randomUUID();
  const now = Date.now();
  try {
    await context.db.prepare(
      `INSERT INTO mobile_accounts(
          id, name_cipher, email_lookup, email_cipher, cpf_lookup, cpf_cipher, phone_cipher,
          password_salt, password_hash, password_iterations, password_scheme, email_verified_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)`
    ).bind(
      id,
      nameCipher,
      emailLookup2,
      emailCipher,
      cpfLookup,
      cpfCipher,
      phoneCipher,
      encodeBase64Url(salt),
      passwordDigest,
      ITERATIONS,
      PASSWORD_SCHEME,
      now
    ).run();
  } catch (error) {
    if (String(error).includes("UNIQUE constraint failed")) {
      const existing = await findAccount(context, email);
      if (existing?.cpf_lookup === cpfLookup && existing.email_verified_at === null) {
        await deliverEmail(env, context, existing, "verify");
      }
      return acceptedRegistration();
    }
    throw error;
  }
  await deliverEmail(env, context, { id, email_cipher: emailCipher }, "verify");
  return acceptedRegistration();
}
__name(register, "register");
async function createSession(context, accountId) {
  const now = Date.now();
  const accessToken = randomToken();
  const refreshToken = randomToken();
  const accessExpiresAt = now + ACCESS_TTL;
  const refreshExpiresAt = now + REFRESH_TTL;
  await context.db.prepare(
    `INSERT INTO mobile_sessions(
        id, account_id, access_token_hash, refresh_token_hash,
        access_expires_at, refresh_expires_at, created_at, revoked_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL)`
  ).bind(
    crypto.randomUUID(),
    accountId,
    await sha256(accessToken),
    await sha256(refreshToken),
    accessExpiresAt,
    refreshExpiresAt,
    now
  ).run();
  await context.db.prepare("DELETE FROM mobile_sessions WHERE refresh_expires_at <= ? OR revoked_at < ?").bind(now, now - REFRESH_TTL).run();
  return {
    accessToken,
    refreshToken,
    accessTokenExpiresAt: new Date(accessExpiresAt).toISOString(),
    refreshTokenExpiresAt: new Date(refreshExpiresAt).toISOString()
  };
}
__name(createSession, "createSession");
async function passwordMatches(account, password) {
  if (password.length === 0 || password.length > PASSWORD_MAX) return false;
  const salt = decodeBase64Url(account.password_salt);
  const scheme = account.password_scheme ?? PASSWORD_SCHEME;
  if (constantTimeEqual(await passwordHash(password, salt, scheme), account.password_hash)) return true;
  const limpa = password.trim();
  return limpa !== password && limpa.length >= PASSWORD_MIN && constantTimeEqual(await passwordHash(limpa, salt, scheme), account.password_hash);
}
__name(passwordMatches, "passwordMatches");
async function auditDeletion(context, request, accountId, action, sessionId, now) {
  const ip = action === "purged" ? null : await hmac(context, `ip:${clientIp(request)}`);
  const agent = action === "purged" ? null : (request.headers.get("user-agent") ?? "").slice(0, 200) || null;
  return context.db.prepare("INSERT INTO mobile_account_deletion_audit(id, account_id, action, session_id, ip_hash, user_agent, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(crypto.randomUUID(), accountId, action, sessionId, ip, agent, now);
}
__name(auditDeletion, "auditDeletion");
async function purgeExpiredAccounts(context, request) {
  const now = Date.now();
  const { results } = await context.db.prepare("SELECT id FROM mobile_accounts WHERE deleted_at IS NOT NULL AND deleted_at <= ? LIMIT 20").bind(now - DELETION_GRACE).all();
  for (const { id } of results) {
    await context.db.batch([
      await auditDeletion(context, request, id, "purged", null, now),
      context.db.prepare("DELETE FROM mobile_sessions WHERE account_id = ?").bind(id),
      context.db.prepare("DELETE FROM mobile_email_tokens WHERE account_id = ?").bind(id),
      context.db.prepare("DELETE FROM mobile_coupon_previews WHERE account_id = ?").bind(id),
      context.db.prepare("DELETE FROM mobile_identity_links WHERE account_id = ?").bind(id),
      context.db.prepare("DELETE FROM mobile_orders WHERE account_id = ?").bind(id),
      context.db.prepare("DELETE FROM mobile_accounts WHERE id = ?").bind(id)
    ]);
    console.info("mobile-account-purged", { accountId: id, purgedAt: now });
  }
}
__name(purgeExpiredAccounts, "purgeExpiredAccounts");
async function restoreAccount(request, input, context) {
  const identifier = normalizeIdentifier(value(input, "identifier"));
  if (await rateLimited(context, request, "restore", identifier)) {
    return json3(429, { erro: "Muitas tentativas. Aguarde alguns minutos." });
  }
  const account = identifier ? await findAccount(context, identifier) : null;
  const now = Date.now();
  if (!account || !await passwordMatches(account, value(input, "password")) || account.deleted_at === null || account.deleted_at + DELETION_GRACE <= now) {
    return json3(401, { erro: authError });
  }
  await context.db.batch([
    context.db.prepare("UPDATE mobile_accounts SET deleted_at = NULL WHERE id = ?").bind(account.id),
    await auditDeletion(context, request, account.id, "restored", null, now)
  ]);
  console.info("mobile-account-restored", { accountId: account.id, restoredAt: now });
  if (account.email_verified_at === null) return json3(403, { erro: "Conta restaurada. Confirme seu e-mail para entrar." });
  return json3(200, await createSession(context, account.id));
}
__name(restoreAccount, "restoreAccount");
async function login(request, input, env, context) {
  await purgeExpiredAccounts(context, request);
  const identifier = normalizeIdentifier(value(input, "identifier"));
  if (await rateLimited(context, request, "login", identifier)) {
    return json3(429, { erro: "Muitas tentativas. Aguarde alguns minutos." });
  }
  const password = value(input, "password");
  if (password.length === 0 || password.length > PASSWORD_MAX) return json3(401, { erro: authError });
  const account = await findAccount(context, identifier);
  const salt = account ? decodeBase64Url(account.password_salt) : new Uint8Array(16);
  const candidate = await passwordHash(password, salt, account?.password_scheme ?? PASSWORD_SCHEME);
  let valid = Boolean(account && constantTimeEqual(candidate, account.password_hash));
  if (!valid && account && password.trim() !== password && password.trim().length >= PASSWORD_MIN) {
    const candidateTrimmed = await passwordHash(password.trim(), salt, account.password_scheme ?? PASSWORD_SCHEME);
    valid = constantTimeEqual(candidateTrimmed, account.password_hash);
  }
  if (!valid || !account) return json3(401, { erro: authError });
  if (account.deleted_at !== null) {
    if (account.deleted_at + DELETION_GRACE <= Date.now()) return json3(401, { erro: authError });
    return json3(409, {
      codigo: "CONTA_EM_EXCLUSAO",
      erro: "Esta conta est\xE1 marcada para exclus\xE3o. Restaure a conta para voltar a entrar."
    });
  }
  if (account.email_verified_at === null) {
    if (mobileEmailConfigured(env)) await deliverEmail(env, context, account, "verify");
    return json3(403, { erro: "Confirme seu e-mail para entrar. Reenviamos o link de confirma\xE7\xE3o; confira tamb\xE9m o spam." });
  }
  return json3(200, await createSession(context, account.id));
}
__name(login, "login");
async function verifyEmail(input, context) {
  const token = value(input, "token");
  if (!token) return json3(400, { erro: "Link inv\xE1lido ou expirado." });
  const now = Date.now();
  const tokenHash = await sha256(token);
  const tokenRow = await context.db.prepare(
    `UPDATE mobile_email_tokens SET used_at = ?
       WHERE token_hash = ? AND purpose = 'verify' AND used_at IS NULL AND expires_at > ?
       RETURNING account_id`
  ).bind(now, tokenHash, now).first();
  if (!tokenRow) return json3(400, { erro: "Link inv\xE1lido ou expirado." });
  await context.db.prepare("UPDATE mobile_accounts SET email_verified_at = ? WHERE id = ?").bind(now, tokenRow.account_id).run();
  await context.db.prepare("UPDATE mobile_email_tokens SET used_at = ? WHERE account_id = ? AND purpose = 'verify' AND used_at IS NULL").bind(now, tokenRow.account_id).run();
  return json3(200, { ok: true });
}
__name(verifyEmail, "verifyEmail");
async function forgotPassword(request, input, env, context) {
  if (!mobileEmailConfigured(env)) return json3(503, { erro: "Recupera\xE7\xE3o temporariamente indispon\xEDvel." });
  const identifier = normalizeIdentifier(value(input, "identifier"));
  if (await rateLimited(context, request, "forgot", identifier)) {
    return json3(429, { erro: "Muitas tentativas. Aguarde alguns minutos." });
  }
  const account = identifier ? await findAccount(context, identifier) : null;
  if (account) await deliverEmail(env, context, account, account.email_verified_at === null ? "verify" : "reset");
  if (account && /^\d{11}$/.test(identifier)) {
    const email = await decrypt(context, account.email_cipher);
    return json3(202, {
      mensagem: `Enviamos o link para ${mascararEmail(email)}. Confira tamb\xE9m o spam.`,
      emailMascarado: mascararEmail(email),
      emailConfirmado: account.email_verified_at !== null
    });
  }
  return json3(202, { mensagem: genericMessage });
}
__name(forgotPassword, "forgotPassword");
function mascararEmail(email) {
  const [usuario, dominio] = email.trim().toLowerCase().split("@");
  if (!usuario || !dominio) return "\u2022\u2022\u2022";
  return `${usuario.slice(0, Math.min(2, usuario.length - 1) || 1)}\u2022\u2022\u2022@${dominio}`;
}
__name(mascararEmail, "mascararEmail");
async function resetPassword(input, context) {
  const token = value(input, "token");
  const password = value(input, "password").trim();
  if (password.length < PASSWORD_MIN) {
    return json3(400, { erro: "A senha deve ter pelo menos 8 caracteres." });
  }
  if (password.length > PASSWORD_MAX) {
    return json3(400, { erro: "A senha deve ter no m\xE1ximo 128 caracteres." });
  }
  if (!token) return json3(400, { erro: "Link inv\xE1lido ou expirado." });
  const now = Date.now();
  const tokenRow = await context.db.prepare(
    `UPDATE mobile_email_tokens SET used_at = ?
       WHERE token_hash = ? AND purpose = 'reset' AND used_at IS NULL AND expires_at > ?
       RETURNING account_id`
  ).bind(now, await sha256(token), now).first();
  if (!tokenRow) return json3(400, { erro: "Link inv\xE1lido ou expirado." });
  const salt = crypto.getRandomValues(new Uint8Array(16));
  await context.db.prepare(
    `UPDATE mobile_accounts
       SET password_salt = ?, password_hash = ?, password_iterations = ?, password_scheme = ?
       WHERE id = ?`
  ).bind(encodeBase64Url(salt), await passwordHash(password, salt), ITERATIONS, PASSWORD_SCHEME, tokenRow.account_id).run();
  await context.db.prepare("UPDATE mobile_sessions SET revoked_at = ? WHERE account_id = ? AND revoked_at IS NULL").bind(now, tokenRow.account_id).run();
  await context.db.prepare("UPDATE mobile_email_tokens SET used_at = ? WHERE account_id = ? AND purpose = 'reset' AND used_at IS NULL").bind(now, tokenRow.account_id).run();
  return json3(200, { ok: true });
}
__name(resetPassword, "resetPassword");
async function refreshSession(input, context) {
  const refreshToken = value(input, "refreshToken");
  if (!refreshToken) return json3(401, { erro: "Sess\xE3o inv\xE1lida ou expirada." });
  const now = Date.now();
  const rotated = await context.db.prepare(
    `UPDATE mobile_sessions SET revoked_at = ?
       WHERE refresh_token_hash = ? AND revoked_at IS NULL AND refresh_expires_at > ?
       RETURNING account_id`
  ).bind(now, await sha256(refreshToken), now).first();
  if (!rotated) return json3(401, { erro: "Sess\xE3o inv\xE1lida ou expirada." });
  return json3(200, await createSession(context, rotated.account_id));
}
__name(refreshSession, "refreshSession");
async function logout(request, context) {
  const match = /^Bearer\s+(.+)$/i.exec(request.headers.get("authorization") ?? "");
  if (match?.[1]) {
    await context.db.prepare("UPDATE mobile_sessions SET revoked_at = ? WHERE access_token_hash = ? AND revoked_at IS NULL").bind(Date.now(), await sha256(match[1])).run();
  }
  return new Response(null, {
    status: 204,
    headers: { "cache-control": "no-store" }
  });
}
__name(logout, "logout");
async function deleteAccount(request, input, env, context) {
  const match = /^Bearer\s+(.+)$/i.exec(request.headers.get("authorization") ?? "");
  if (!match?.[1]) return json3(401, { erro: "Voc\xEA precisa estar conectado." });
  const tokenHash = await sha256(match[1]);
  const now = Date.now();
  const session = await context.db.prepare(
    `SELECT id, account_id FROM mobile_sessions
       WHERE access_token_hash = ? AND revoked_at IS NULL AND access_expires_at > ?
       LIMIT 1`
  ).bind(tokenHash, now).first();
  if (!session) return json3(401, { erro: "Sess\xE3o inv\xE1lida ou expirada." });
  if (await rateLimited(context, request, "delete", session.account_id)) {
    return json3(429, { erro: "Muitas tentativas. Aguarde alguns minutos." });
  }
  const accountId = session.account_id;
  const account = await context.db.prepare("SELECT id, email_cipher, password_salt, password_hash, password_scheme FROM mobile_accounts WHERE id = ? LIMIT 1").bind(accountId).first();
  if (!account || !await passwordMatches(account, value(input, "password"))) {
    return json3(403, { codigo: "SENHA_INCORRETA", erro: "Senha incorreta. Sua conta n\xE3o foi exclu\xEDda." });
  }
  await context.db.batch([
    context.db.prepare("UPDATE mobile_accounts SET deleted_at = ? WHERE id = ?").bind(now, accountId),
    await auditDeletion(context, request, accountId, "requested", session.id, now),
    context.db.prepare("DELETE FROM mobile_sessions WHERE account_id = ?").bind(accountId),
    context.db.prepare("DELETE FROM mobile_email_tokens WHERE account_id = ?").bind(accountId)
  ]);
  console.info("mobile-account-deleted", {
    accountId,
    deletedAt: now,
    requestId: request.headers.get("cf-ray")
  });
  await sendMobileAccountDeletionEmail(env, await decrypt(context, account.email_cipher), new Date(now + DELETION_GRACE)).then((enviado) => {
    if (!enviado) console.error("mobile-account-deletion-email", "not delivered");
  }).catch(() => console.error("mobile-account-deletion-email", "failed"));
  await purgeExpiredAccounts(context, request);
  return new Response(null, {
    status: 204,
    headers: { "cache-control": "no-store" }
  });
}
__name(deleteAccount, "deleteAccount");
async function handleMobileAccountEmail(request, env) {
  if (request.method !== "POST") return json3(405, { erro: "M\xE9todo n\xE3o permitido." });
  if (!env.MOBILE_DB || !env.MOBILE_ADMIN_TOKEN || env.MOBILE_ADMIN_TOKEN === env.MOBILE_PUBLISH_TOKEN) {
    return json3(503, { erro: "Servi\xE7o temporariamente indispon\xEDvel." });
  }
  if (!constantTimeEqual(request.headers.get("x-mobile-admin-token") ?? "", env.MOBILE_ADMIN_TOKEN)) {
    return json3(401, { erro: "N\xE3o autorizado." });
  }
  const context = await createContext(env);
  if (!context || !mobileEmailConfigured(env)) return json3(503, { erro: "Servi\xE7o temporariamente indispon\xEDvel." });
  const input = await requestBody(request);
  if (!input) return json3(400, { erro: "Envio inv\xE1lido." });
  const cpf = digitos(value(input, "cpf"));
  const email = normalizeEmail(value(input, "email"));
  if (!cpfValido(cpf) || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return json3(400, { erro: "Informe um CPF e um e-mail v\xE1lidos." });
  }
  const account = await findAccount(context, cpf);
  if (!account) return json3(404, { erro: "Conta n\xE3o encontrada." });
  return trocarEmailNaoConfirmado(env, context, account, email);
}
__name(handleMobileAccountEmail, "handleMobileAccountEmail");
async function trocarEmailNaoConfirmado(env, context, account, email) {
  if (account.email_verified_at !== null) {
    return json3(409, { codigo: "EMAIL_JA_CONFIRMADO", erro: "Esta conta j\xE1 foi confirmada. Entre com seu CPF e senha." });
  }
  const emailLookup2 = await hmac(context, `email:${email}`);
  const other = await context.db.prepare(
    "SELECT id FROM mobile_accounts WHERE email_lookup = ? AND id <> ? LIMIT 1"
  ).bind(emailLookup2, account.id).first();
  if (other) return json3(409, { erro: "Este e-mail j\xE1 est\xE1 em outra conta." });
  const emailCipher = await encrypt(context, email);
  try {
    await context.db.batch([
      context.db.prepare(
        "UPDATE mobile_accounts SET email_lookup = ?, email_cipher = ?, email_verified_at = NULL WHERE id = ? AND email_verified_at IS NULL"
      ).bind(emailLookup2, emailCipher, account.id),
      context.db.prepare("DELETE FROM mobile_email_tokens WHERE account_id = ?").bind(account.id)
    ]);
  } catch (error) {
    if (String(error).includes("UNIQUE constraint failed")) return json3(409, { erro: "Este e-mail j\xE1 est\xE1 em outra conta." });
    throw error;
  }
  await deliverEmail(env, context, { id: account.id, email_cipher: emailCipher }, "verify");
  return json3(202, { mensagem: `Pronto! Enviamos o link de confirma\xE7\xE3o para ${email}. Confira tamb\xE9m o spam.` });
}
__name(trocarEmailNaoConfirmado, "trocarEmailNaoConfirmado");
async function corrigirEmail(request, input, env, context) {
  if (!mobileEmailConfigured(env)) return json3(503, { erro: "Servi\xE7o temporariamente indispon\xEDvel." });
  const cpf = digitos(value(input, "cpf"));
  const email = normalizeEmail(value(input, "email"));
  const password = value(input, "password");
  if (await rateLimited(context, request, "email-corrigir", cpf)) {
    return json3(429, { erro: "Muitas tentativas. Aguarde alguns minutos." });
  }
  if (!cpfValido(cpf) || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return json3(400, { erro: "Informe o CPF da conta e o e-mail certo." });
  }
  if (password.length === 0 || password.length > PASSWORD_MAX) return json3(401, { erro: "CPF ou senha inv\xE1lidos." });
  const account = await findAccount(context, cpf);
  const salt = account ? decodeBase64Url(account.password_salt) : new Uint8Array(16);
  const candidate = await passwordHash(password, salt, account?.password_scheme ?? PASSWORD_SCHEME);
  let valid = Boolean(account && constantTimeEqual(candidate, account.password_hash));
  if (!valid && account && password.trim() !== password && password.trim().length >= PASSWORD_MIN) {
    valid = constantTimeEqual(await passwordHash(password.trim(), salt, account.password_scheme ?? PASSWORD_SCHEME), account.password_hash);
  }
  if (!valid || !account || account.deleted_at !== null) return json3(401, { erro: "CPF ou senha inv\xE1lidos." });
  return trocarEmailNaoConfirmado(env, context, account, email);
}
__name(corrigirEmail, "corrigirEmail");
async function authenticateMobileRequest(request, env) {
  const match = /^Bearer\s+(.+)$/i.exec(request.headers.get("authorization") ?? "");
  if (!match?.[1]) return null;
  const context = await createContext(env);
  if (!context) return null;
  const now = Date.now();
  const row = await context.db.prepare(
    `SELECT a.id, a.name_cipher, a.email_cipher, a.cpf_cipher, a.phone_cipher
       FROM mobile_sessions s
       JOIN mobile_accounts a ON a.id = s.account_id
       WHERE s.access_token_hash = ? AND s.revoked_at IS NULL
         AND s.access_expires_at > ? AND a.email_verified_at IS NOT NULL
       LIMIT 1`
  ).bind(await sha256(match[1]), now).first();
  if (!row) return null;
  const [name, email, cpf, phone] = await Promise.all([
    decrypt(context, row.name_cipher),
    decrypt(context, row.email_cipher),
    decrypt(context, row.cpf_cipher),
    decrypt(context, row.phone_cipher)
  ]);
  return { id: row.id, name, email, cpf, phone };
}
__name(authenticateMobileRequest, "authenticateMobileRequest");
async function handleMobileAuth(request, env) {
  const route = new URL(request.url).pathname.slice("/api/mobile/v1/auth/".length);
  if (request.method !== "POST") return json3(405, { erro: "M\xE9todo n\xE3o permitido." });
  let context;
  try {
    context = await createContext(env);
  } catch {
    context = null;
  }
  if (!context) return json3(503, { erro: "Servi\xE7o temporariamente indispon\xEDvel." });
  const input = await requestBody(request);
  if (!input) return json3(400, { erro: "Envio inv\xE1lido." });
  try {
    switch (route) {
      case "cadastro-existente": {
        if (await rateLimited(context, request, "lookup")) return json3(429, { erro: "Muitas tentativas. Aguarde alguns minutos." });
        const cpf = digitos(String(input.cpf ?? ""));
        if (!cpfValido(cpf)) return json3(400, { erro: "CPF inv\xE1lido." });
        const conta = await context.db.prepare("SELECT 1 FROM mobile_accounts WHERE cpf_lookup = ? LIMIT 1").bind(await hmac(context, `cpf:${cpf}`)).first();
        const cadastro = await clienteExistente(env, cpf).catch(() => null);
        return json3(200, { contaApp: Boolean(conta), cadastro: cadastro !== null, email: null });
      }
      case "register":
        return await register(request, input, env, context);
      case "login":
        return await login(request, input, env, context);
      case "email/verify":
        if (await rateLimited(context, request, "verify")) {
          return json3(429, { erro: "Muitas tentativas. Aguarde alguns minutos." });
        }
        return await verifyEmail(input, context);
      case "email/corrigir":
        return await corrigirEmail(request, input, env, context);
      case "password/forgot":
        return await forgotPassword(request, input, env, context);
      case "password/reset":
        if (await rateLimited(context, request, "reset")) {
          return json3(429, { erro: "Muitas tentativas. Aguarde alguns minutos." });
        }
        return await resetPassword(input, context);
      case "session/refresh":
        if (await rateLimited(context, request, "refresh")) {
          return json3(429, { erro: "Muitas tentativas. Aguarde alguns minutos." });
        }
        return await refreshSession(input, context);
      case "session/logout":
        return await logout(request, context);
      case "account/delete":
        return await deleteAccount(request, input, env, context);
      case "account/restore":
        return await restoreAccount(request, input, context);
      default:
        return json3(404, { erro: "Rota desconhecida." });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    console.error("mobile-auth", /iteration counts above \d+ are not supported/i.test(message) ? "PBKDF2 iteration limit" : message.startsWith("D1_ERROR:") ? "D1 operation failed" : "Authentication operation failed");
    return json3(503, { erro: "Servi\xE7o temporariamente indispon\xEDvel." });
  }
}
__name(handleMobileAuth, "handleMobileAuth");

// src/mobile/reservations.ts
var json4 = /* @__PURE__ */ __name((status, body2) => new Response(JSON.stringify(body2), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
}), "json");
var missing = /* @__PURE__ */ __name(() => json4(404, { erro: "Reserva n\xE3o encontrada." }), "missing");
var unavailable = /* @__PURE__ */ __name(() => json4(503, { erro: "N\xE3o foi poss\xEDvel salvar agora. Tente de novo em instantes." }), "unavailable");
var encoder3 = new TextEncoder();
var sha2562 = /* @__PURE__ */ __name(async (value2) => {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", encoder3.encode(value2)));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}, "sha256");
async function pedidoDaConta(env, accountId, pedidoId) {
  const row = await env.MOBILE_DB.prepare(
    `SELECT pedido_id FROM mobile_orders
     WHERE account_id = ? AND pedido_id = ? AND state = 'ready' LIMIT 1`
  ).bind(accountId, pedidoId).first();
  if (!row) return null;
  const object = await env.PRE.get(`reservas/pedidos/${row.pedido_id}.json`);
  return object ? object.json() : null;
}
__name(pedidoDaConta, "pedidoDaConta");
function publicOrder(order) {
  return { ...visaoPublica(order), criadoEm: order.criadoEm };
}
__name(publicOrder, "publicOrder");
async function listOrders(env, accountId) {
  const rows = await env.MOBILE_DB.prepare(
    `SELECT pedido_id FROM mobile_orders
     WHERE account_id = ? AND state = 'ready' ORDER BY created_at DESC LIMIT 50`
  ).bind(accountId).all();
  const orders = [];
  for (const row of rows.results) {
    const object = await env.PRE.get(`reservas/pedidos/${row.pedido_id}.json`);
    if (object) orders.push(publicOrder(await object.json()));
  }
  return json4(200, orders);
}
__name(listOrders, "listOrders");
async function getOrder(env, accountId, pedidoId) {
  if (!/^[a-f0-9-]{36}$/.test(pedidoId)) return missing();
  const order = await pedidoDaConta(env, accountId, pedidoId);
  return order ? json4(200, publicOrder(order)) : missing();
}
__name(getOrder, "getOrder");
async function parseBody(request) {
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > 16384) return null;
  const raw = await request.text();
  if (encoder3.encode(raw).length > 16384) return null;
  try {
    const body2 = JSON.parse(raw);
    return body2 !== null && typeof body2 === "object" && !Array.isArray(body2) ? body2 : null;
  } catch {
    return null;
  }
}
__name(parseBody, "parseBody");
function reservationData(body2) {
  const bateriaId = Number(body2.bateriaId);
  const quantidade = Number(body2.quantidade);
  const forma = body2.forma;
  const cupom = typeof body2.cupom === "string" ? body2.cupom.trim().toUpperCase() : "";
  const pilotosEntrada = body2.pilotos == null ? [] : body2.pilotos;
  if (!Number.isSafeInteger(bateriaId) || bateriaId < 1 || !Number.isSafeInteger(quantidade) || quantidade < 1 || quantidade > 10 || forma !== "pix" && forma !== "cartao" || body2.cupom != null && !/^[A-Z0-9_-]{1,40}$/.test(cupom) || !Array.isArray(pilotosEntrada) || pilotosEntrada.some((nome) => typeof nome !== "string")) return null;
  const acompanhantesEntrada = body2.acompanhantes == null ? [] : body2.acompanhantes;
  if (!Array.isArray(acompanhantesEntrada) || acompanhantesEntrada.length > 10 || acompanhantesEntrada.some((a) => !a || typeof a !== "object" || Array.isArray(a))) return null;
  const texto2 = /* @__PURE__ */ __name((valor, max) => typeof valor === "string" ? valor.replace(/\s+/g, " ").trim().slice(0, max) : "", "texto");
  const acompanhantes = acompanhantesEntrada.map((a) => ({
    nome: texto2(a.nome, 120),
    documento: texto2(a.documento, 20),
    nascimento: texto2(a.nascimento, 10),
    ...texto2(a.instagram, 80) ? { instagram: texto2(a.instagram, 80) } : {}
  }));
  const nascimento = typeof body2.nascimento === "string" ? body2.nascimento.trim().slice(0, 10) : "";
  const pilotos = pilotosEntrada.map((nome) => nome.replace(/\s+/g, " ").trim().slice(0, 80)).filter(Boolean).slice(0, quantidade);
  return {
    bateriaId,
    quantidade,
    pilotos,
    forma,
    nascimento,
    politica: body2.politica === true,
    instagram: texto2(body2.instagram, 80),
    compradorPilota: body2.compradorPilota !== false,
    acompanhantes,
    ...cupom ? { cupom } : {}
  };
}
__name(reservationData, "reservationData");
function reservationInput(body2, account) {
  return {
    ...body2,
    tipoDocumento: "CPF",
    documento: account.cpf,
    nome: account.name,
    email: account.email,
    telefone: account.phone,
    lgpd: true
  };
}
__name(reservationInput, "reservationInput");
function recoveryAgenda(body2) {
  const bateriaId = body2.bateriaId;
  return {
    atualizadoEm: "",
    precoCentavos: 0,
    maxPilotos: 10,
    prazoMin: 15,
    antecedenciaMin: 0,
    horarios: [{ id: bateriaId, inicio: "", nome: "", livres: 10 }]
  };
}
__name(recoveryAgenda, "recoveryAgenda");
async function createOrder(request, env, account) {
  const key = request.headers.get("idempotency-key")?.trim() ?? "";
  if (!/^[A-Za-z0-9._:-]{8,128}$/.test(key)) return json4(400, { erro: "Chave de idempot\xEAncia inv\xE1lida." });
  if (!env.MOBILE_DB) return unavailable();
  const body2 = await parseBody(request);
  if (!body2) return json4(400, { erro: "Envio inv\xE1lido." });
  const data = reservationData(body2);
  if (!data) return json4(400, { erro: "Envio inv\xE1lido." });
  const hash = await sha2562(JSON.stringify(data));
  let row = await env.MOBILE_DB.prepare(
    "SELECT * FROM mobile_orders WHERE account_id = ? AND idempotency_key = ? LIMIT 1"
  ).bind(account.id, key).first();
  let isReplay = Boolean(row);
  if (row && row.request_hash !== hash) return json4(409, { erro: "Esta chave j\xE1 foi usada com outros dados." });
  let checked;
  if (row) {
    let existing;
    try {
      existing = await env.PRE.get(`reservas/pedidos/${row.pedido_id}.json`);
    } catch {
      return unavailable();
    }
    if (existing) {
      try {
        const order = await existing.json();
        if (order.id !== row.pedido_id) return unavailable();
        if (order.status === "novo") await env.PRE.put(`reservas/fila/${row.pedido_id}`, order.status);
        if (row.state !== "ready") {
          await env.MOBILE_DB.prepare(
            `UPDATE mobile_orders SET state = 'ready' WHERE account_id = ? AND idempotency_key = ?`
          ).bind(account.id, key).run();
        }
        return json4(200, { id: order.id, codigo: order.codigo });
      } catch {
        return unavailable();
      }
    }
    checked = validarReserva(reservationInput(data, account), recoveryAgenda(data));
    if (!checked.ok) return json4(400, { erro: checked.erro });
  } else {
    if (!asaasLigado(env)) return json4(503, { erro: "Pagamento online indispon\xEDvel no momento. Fale com a recep\xE7\xE3o pelo WhatsApp." });
    const agendaResponse = await agendaPublica(request, env);
    if (!agendaResponse.ok) return agendaResponse;
    const agenda = await agendaResponse.json();
    checked = validarReserva(reservationInput(data, account), agenda);
    if (!checked.ok) return json4(400, { erro: checked.erro });
  }
  if (!row) {
    const pedidoId = crypto.randomUUID();
    const now = Date.now();
    const inserted = await env.MOBILE_DB.prepare(
      `INSERT INTO mobile_orders(account_id, idempotency_key, pedido_id, request_hash, codigo, state, created_at)
       VALUES (?, ?, ?, ?, ?, 'creating', ?)
       ON CONFLICT(account_id, idempotency_key) DO NOTHING`
    ).bind(account.id, key, pedidoId, hash, codigoReserva(), now).run();
    isReplay = inserted.meta.changes === 0;
    row = await env.MOBILE_DB.prepare(
      "SELECT * FROM mobile_orders WHERE account_id = ? AND idempotency_key = ? LIMIT 1"
    ).bind(account.id, key).first();
    if (!row) return unavailable();
    if (row.request_hash !== hash) return json4(409, { erro: "Esta chave j\xE1 foi usada com outros dados." });
  }
  try {
    const existing = await env.PRE.get(`reservas/pedidos/${row.pedido_id}.json`);
    if (existing) {
      const order2 = await existing.json();
      if (order2.id !== row.pedido_id) return unavailable();
      if (order2.status === "novo") await env.PRE.put(`reservas/fila/${row.pedido_id}`, order2.status);
      if (row.state !== "ready") {
        await env.MOBILE_DB.prepare(
          `UPDATE mobile_orders SET state = 'ready' WHERE account_id = ? AND idempotency_key = ?`
        ).bind(account.id, key).run();
      }
      return json4(isReplay ? 200 : 201, { id: order2.id, codigo: order2.codigo });
    }
    const now = new Date(row.created_at).toISOString();
    const order = {
      id: row.pedido_id,
      codigo: row.codigo,
      status: "novo",
      criadoEm: now,
      atualizadoEm: now,
      bateriaId: checked.dados.bateriaId,
      quantidade: checked.dados.quantidade,
      forma: checked.dados.forma,
      pilotos: checked.dados.pilotos,
      acompanhantes: checked.dados.acompanhantes.map((a) => ({ ...a, chave: chaveDocumento("CPF", a.documento) })),
      compradorPilota: checked.dados.compradorPilota,
      ...data.cupom ? { cupom: data.cupom } : {},
      cliente: {
        ...checked.dados.cliente,
        chave: chaveDocumento("CPF", account.cpf)
      }
    };
    await env.PRE.put(`reservas/pedidos/${row.pedido_id}.json`, JSON.stringify(order), {
      httpMetadata: { contentType: "application/json" }
    });
    await env.PRE.put(`reservas/fila/${row.pedido_id}`, order.status);
    await env.MOBILE_DB.prepare(
      `UPDATE mobile_orders SET state = 'ready' WHERE account_id = ? AND idempotency_key = ?`
    ).bind(account.id, key).run();
    return json4(isReplay ? 200 : 201, { id: order.id, codigo: order.codigo });
  } catch {
    return unavailable();
  }
}
__name(createOrder, "createOrder");
async function handleMobileReservations(request, env) {
  const pathname = new URL(request.url).pathname;
  if (pathname === "/api/mobile/v1/agenda" && request.method === "GET") return agendaPublica(request, env);
  if (pathname !== "/api/mobile/v1/reservations" && !pathname.startsWith("/api/mobile/v1/reservations/")) {
    return json4(404, { erro: "Rota desconhecida." });
  }
  const account = await authenticateMobileRequest(request, env);
  if (!account) return json4(401, { erro: "Sess\xE3o inv\xE1lida ou expirada." });
  if (!env.MOBILE_DB) return unavailable();
  if (pathname === "/api/mobile/v1/reservations") {
    if (request.method === "POST") return createOrder(request, env, account);
    if (request.method === "GET") return listOrders(env, account.id);
    return json4(405, { erro: "M\xE9todo n\xE3o permitido." });
  }
  if (request.method === "GET") {
    return getOrder(env, account.id, pathname.slice("/api/mobile/v1/reservations/".length));
  }
  return json4(405, { erro: "M\xE9todo n\xE3o permitido." });
}
__name(handleMobileReservations, "handleMobileReservations");

// src/mobile/coupons.ts
var json5 = /* @__PURE__ */ __name((status, body2) => new Response(JSON.stringify(body2), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
}), "json");
var unavailable2 = /* @__PURE__ */ __name(() => json5(503, { erro: "Servi\xE7o temporariamente indispon\xEDvel." }), "unavailable");
var isUuid = /* @__PURE__ */ __name((value2) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value2), "isUuid");
async function body(request) {
  const raw = await request.text();
  if (new TextEncoder().encode(raw).length > 4096) return null;
  try {
    const value2 = JSON.parse(raw);
    return value2 !== null && typeof value2 === "object" && !Array.isArray(value2) ? value2 : null;
  } catch {
    return null;
  }
}
__name(body, "body");
function previewInput(value2) {
  const codigo = typeof value2.codigo === "string" ? value2.codigo.trim().toUpperCase() : "";
  const bateriaId = Number(value2.bateriaId);
  const quantidade = Number(value2.quantidade);
  if (!/^[A-Z0-9_-]{1,40}$/.test(codigo) || !Number.isSafeInteger(bateriaId) || bateriaId < 1 || !Number.isSafeInteger(quantidade) || quantidade < 1 || quantidade > 10) return null;
  return { codigo, bateriaId, quantidade };
}
__name(previewInput, "previewInput");
async function createPreview(request, env) {
  if (!env.MOBILE_DB) return unavailable2();
  const account = await authenticateMobileRequest(request, env);
  if (!account) return json5(401, { erro: "Entre novamente para continuar." });
  const inputBody = await body(request);
  if (!inputBody) return json5(400, { erro: "Envio inv\xE1lido." });
  const input = previewInput(inputBody);
  if (!input) return json5(400, { erro: "Informe um cupom e uma bateria v\xE1lidos." });
  const now = Date.now();
  await env.MOBILE_DB.prepare("DELETE FROM mobile_coupon_previews WHERE expires_at <= ?").bind(now).run();
  const pending = await env.MOBILE_DB.prepare(
    `SELECT COUNT(*) count FROM mobile_coupon_previews
     WHERE account_id = ? AND state = 'pending' AND expires_at > ?`
  ).bind(account.id, now).first();
  if (Number(pending?.count ?? 0) >= 5) return json5(429, { erro: "Aguarde a conclus\xE3o de uma pr\xE9via antes de enviar outra." });
  const id = crypto.randomUUID();
  await env.MOBILE_DB.prepare(
    `INSERT INTO mobile_coupon_previews(id, account_id, codigo, bateria_id, quantidade, state, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)`
  ).bind(id, account.id, input.codigo, input.bateriaId, input.quantidade, now, now + 10 * 6e4).run();
  return json5(202, { requestId: id });
}
__name(createPreview, "createPreview");
function publicResult(row) {
  if (row.state === "pending") return { status: "pending" };
  if (row.state !== "completed" || !row.result_json) return null;
  try {
    const result = JSON.parse(row.result_json);
    if (typeof result.erro === "string") return { status: "completed", erro: result.erro.slice(0, 300) };
    const brutoCentavos = Number(result.brutoCentavos);
    const descontoCentavos = Number(result.descontoCentavos);
    const totalCentavos = Number(result.totalCentavos);
    if (![brutoCentavos, descontoCentavos, totalCentavos].every(Number.isSafeInteger) || brutoCentavos < 0 || descontoCentavos < 0 || descontoCentavos > brutoCentavos || totalCentavos !== brutoCentavos - descontoCentavos) return null;
    return { status: "completed", brutoCentavos, descontoCentavos, totalCentavos };
  } catch {
    return null;
  }
}
__name(publicResult, "publicResult");
async function getPreview(request, env, requestId) {
  if (!isUuid(requestId)) return json5(404, { erro: "Pr\xE9via n\xE3o encontrada." });
  if (!env.MOBILE_DB) return unavailable2();
  const account = await authenticateMobileRequest(request, env);
  if (!account) return json5(401, { erro: "Entre novamente para continuar." });
  const row = await env.MOBILE_DB.prepare(
    `SELECT state, result_json FROM mobile_coupon_previews
     WHERE id = ? AND account_id = ? AND expires_at > ? LIMIT 1`
  ).bind(requestId, account.id, Date.now()).first();
  if (!row) return json5(404, { erro: "Pr\xE9via n\xE3o encontrada." });
  const result = publicResult(row);
  return result ? json5(200, result) : unavailable2();
}
__name(getPreview, "getPreview");
async function listSyncPreviews(env) {
  if (!env.MOBILE_DB) return unavailable2();
  const now = Date.now();
  const rows = await env.MOBILE_DB.prepare(
    `SELECT id, account_id, codigo, bateria_id, quantidade FROM mobile_coupon_previews
     WHERE state = 'pending' AND expires_at > ? ORDER BY created_at LIMIT 50`
  ).bind(now).all();
  const jobs = [];
  for (const row of rows.results) {
    const documento = await mobileAccountCpf(env, row.account_id);
    if (documento === null) return unavailable2();
    jobs.push({ ...row, requestId: row.id, documento });
  }
  return json5(200, jobs.map(({ id: _id, account_id: _account, codigo, bateria_id, quantidade, requestId, documento }) => ({
    requestId,
    codigo,
    bateriaId: bateria_id,
    quantidade,
    documento
  })));
}
__name(listSyncPreviews, "listSyncPreviews");
function validResult(value2) {
  if (typeof value2.erro === "string" && value2.erro.trim()) return { erro: value2.erro.trim().slice(0, 300) };
  const brutoCentavos = Number(value2.brutoCentavos);
  const descontoCentavos = Number(value2.descontoCentavos);
  const totalCentavos = Number(value2.totalCentavos);
  if (![brutoCentavos, descontoCentavos, totalCentavos].every(Number.isSafeInteger) || brutoCentavos < 0 || descontoCentavos < 0 || descontoCentavos > brutoCentavos || totalCentavos !== brutoCentavos - descontoCentavos) return null;
  return { brutoCentavos, descontoCentavos, totalCentavos };
}
__name(validResult, "validResult");
async function completeSyncPreview(request, env, requestId) {
  if (!isUuid(requestId)) return json5(404, { erro: "Pr\xE9via n\xE3o encontrada." });
  if (!env.MOBILE_DB) return unavailable2();
  const resultBody = await body(request);
  const result = resultBody && validResult(resultBody);
  if (!result) return json5(400, { erro: "Resultado de pr\xE9via inv\xE1lido." });
  const now = Date.now();
  const updated = await env.MOBILE_DB.prepare(
    `UPDATE mobile_coupon_previews SET state = 'completed', result_json = ?
     WHERE id = ? AND state = 'pending' AND expires_at > ?`
  ).bind(JSON.stringify(result), requestId, now).run();
  if (updated.meta.changes) return json5(200, { ok: true });
  const row = await env.MOBILE_DB.prepare(
    "SELECT state FROM mobile_coupon_previews WHERE id = ? AND expires_at > ? LIMIT 1"
  ).bind(requestId, now).first();
  return row?.state === "completed" ? json5(200, { ok: true, repetido: true }) : json5(404, { erro: "Pr\xE9via n\xE3o encontrada." });
}
__name(completeSyncPreview, "completeSyncPreview");
async function handleMobileCoupons(request, env) {
  const path = new URL(request.url).pathname;
  if (path === "/api/mobile/v1/coupons/preview" && request.method === "POST") return createPreview(request, env);
  const match = path.match(/^\/api\/mobile\/v1\/coupons\/preview\/([0-9a-f-]{36})$/i);
  if (match && request.method === "GET") return getPreview(request, env, match[1]);
  return json5(405, { erro: "M\xE9todo n\xE3o permitido." });
}
__name(handleMobileCoupons, "handleMobileCoupons");
async function handleMobileCouponsSync(request, env) {
  const path = new URL(request.url).pathname;
  if (path === "/api/sync/mobile/coupons" && request.method === "GET") return listSyncPreviews(env);
  const match = path.match(/^\/api\/sync\/mobile\/coupons\/([0-9a-f-]{36})$/i);
  if (match && request.method === "POST") return completeSyncPreview(request, env, match[1]);
  return json5(404, { erro: "Pr\xE9via n\xE3o encontrada." });
}
__name(handleMobileCouponsSync, "handleMobileCouponsSync");

// src/mobile/results.ts
var encoder4 = new TextEncoder();
var json6 = /* @__PURE__ */ __name((status, body2) => new Response(JSON.stringify(body2), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
}), "json");
var invalid = /* @__PURE__ */ __name(() => json6(400, { erro: "Dados de publica\xE7\xE3o inv\xE1lidos." }), "invalid");
var unavailable3 = /* @__PURE__ */ __name(() => json6(503, { erro: "N\xE3o foi poss\xEDvel concluir agora. Tente novamente." }), "unavailable");
function constantTimeEqual2(left, right) {
  if (!left || left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index++) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}
__name(constantTimeEqual2, "constantTimeEqual");
function authorized(request, expected, header) {
  return Boolean(expected && constantTimeEqual2(request.headers.get(header) ?? "", expected));
}
__name(authorized, "authorized");
async function parseBody2(request) {
  if (Number(request.headers.get("content-length") ?? 0) > 64e3) return null;
  const raw = await request.text();
  if (encoder4.encode(raw).length > 64e3) return null;
  try {
    const body2 = JSON.parse(raw);
    return body2 !== null && typeof body2 === "object" && !Array.isArray(body2) ? body2 : null;
  } catch {
    return null;
  }
}
__name(parseBody2, "parseBody");
function isDate(value2) {
  if (typeof value2 !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value2)) return false;
  const date = /* @__PURE__ */ new Date(`${value2}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value2;
}
__name(isDate, "isDate");
function parsePublication(body2) {
  const sessionId = typeof body2.sessionId === "string" ? body2.sessionId.trim() : "";
  const eventName = typeof body2.eventName === "string" ? body2.eventName.trim() : "";
  if (!/^[A-Za-z0-9._:-]{1,128}$/.test(sessionId) || !eventName || eventName.length > 160 || !isDate(body2.eventDate)) return null;
  if (!Array.isArray(body2.results) || body2.results.length < 1 || body2.results.length > 100) return null;
  const seen = /* @__PURE__ */ new Set();
  const results = [];
  for (const value2 of body2.results) {
    if (!value2 || typeof value2 !== "object" || Array.isArray(value2)) return null;
    const row = value2;
    const customerId = typeof row.customerId === "string" ? row.customerId.trim() : "";
    const displayName = typeof row.displayName === "string" ? row.displayName.replace(/\s+/g, " ").trim() : "";
    const kart = typeof row.kart === "string" ? row.kart.trim() : "";
    const position = Number(row.position);
    const laps = Number(row.laps);
    const bestLapMs = row.bestLapMs === null ? null : Number(row.bestLapMs);
    if (!/^\d{1,20}$/.test(customerId) || seen.has(customerId) || !displayName || displayName.length > 80 || !kart || kart.length > 40 || !Number.isSafeInteger(position) || position < 1 || position > 1e3 || !Number.isSafeInteger(laps) || laps < 0 || laps > 1e4 || bestLapMs !== null && (!Number.isSafeInteger(bestLapMs) || bestLapMs < 1 || bestLapMs > 6e5)) return null;
    seen.add(customerId);
    results.push({ customerId, displayName, position, kart, laps, bestLapMs });
  }
  return { sessionId, eventName, eventDate: body2.eventDate, results };
}
__name(parsePublication, "parsePublication");
function publicResult2(row) {
  return {
    displayName: row.display_name,
    position: Number(row.position),
    kart: row.kart,
    laps: Number(row.laps),
    bestLapMs: row.best_lap_ms == null ? null : Number(row.best_lap_ms)
  };
}
__name(publicResult2, "publicResult");
function historicalResult(value2) {
  if (!value2 || typeof value2 !== "object" || Array.isArray(value2)) return null;
  const row = value2;
  const sessionId = typeof row.sessionId === "string" ? row.sessionId : "";
  const eventName = typeof row.eventName === "string" ? row.eventName : "";
  const displayName = typeof row.displayName === "string" ? row.displayName : "";
  const kart = typeof row.kart === "string" ? row.kart : "";
  const position = Number(row.position);
  const laps = Number(row.laps);
  const bestLapMs = row.bestLapMs == null ? null : Number(row.bestLapMs);
  if (!/^[A-Za-z0-9._:-]{1,128}$/.test(sessionId) || !eventName || eventName.length > 160 || !isDate(row.eventDate) || !displayName || displayName.length > 80 || !kart || kart.length > 40 || !Number.isSafeInteger(position) || position < 1 || position > 1e3 || !Number.isSafeInteger(laps) || laps < 0 || laps > 1e4 || bestLapMs !== null && (!Number.isSafeInteger(bestLapMs) || bestLapMs < 1 || bestLapMs > 6e5)) return null;
  return { sessionId, eventName, eventDate: row.eventDate, displayName, position, kart, laps, bestLapMs };
}
__name(historicalResult, "historicalResult");
function auditJson(row) {
  return row ? JSON.stringify({
    eventName: row.event_name,
    eventDate: row.event_date,
    ...publicResult2(row),
    status: row.status
  }) : null;
}
__name(auditJson, "auditJson");
function identical(previous, publication, result) {
  return previous.status === "published" && previous.event_name === publication.eventName && previous.event_date === publication.eventDate && previous.display_name === result.displayName && Number(previous.position) === result.position && previous.kart === result.kart && Number(previous.laps) === result.laps && (previous.best_lap_ms == null ? null : Number(previous.best_lap_ms)) === result.bestLapMs;
}
__name(identical, "identical");
async function publish(env, body2) {
  if (!env.MOBILE_DB || !env.MOBILE_PUBLISH_TOKEN) return unavailable3();
  if (body2.action !== "publish") return invalid();
  const publication = parsePublication(body2);
  if (!publication) return invalid();
  const existing = await env.MOBILE_DB.prepare("SELECT * FROM mobile_results WHERE session_id = ?").bind(publication.sessionId).all();
  const previousByCustomer = new Map(existing.results.map((row) => [row.customer_id, row]));
  const nextByCustomer = new Set(publication.results.map((row) => row.customerId));
  const now = Date.now();
  const statements = [];
  for (const result of publication.results) {
    const previous = previousByCustomer.get(result.customerId) ?? null;
    if (previous && identical(previous, publication, result)) continue;
    const current = {
      session_id: publication.sessionId,
      customer_id: result.customerId,
      event_name: publication.eventName,
      event_date: publication.eventDate,
      display_name: result.displayName,
      position: result.position,
      kart: result.kart,
      laps: result.laps,
      best_lap_ms: result.bestLapMs,
      status: "published"
    };
    statements.push(env.MOBILE_DB.prepare(
      `INSERT INTO mobile_results(session_id, customer_id, event_name, event_date, display_name, position, kart, laps, best_lap_ms, status, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'published', ?)
       ON CONFLICT(session_id, customer_id) DO UPDATE SET event_name = excluded.event_name,
         event_date = excluded.event_date, display_name = excluded.display_name, position = excluded.position,
         kart = excluded.kart, laps = excluded.laps, best_lap_ms = excluded.best_lap_ms,
         status = 'published', updated_at = excluded.updated_at`
    ).bind(
      publication.sessionId,
      result.customerId,
      publication.eventName,
      publication.eventDate,
      result.displayName,
      result.position,
      result.kart,
      result.laps,
      result.bestLapMs,
      now
    ));
    statements.push(env.MOBILE_DB.prepare(
      `INSERT INTO mobile_results_audit(session_id, customer_id, action, previous_json, current_json, actor, changed_at)
       VALUES (?, ?, ?, ?, ?, 'timing-server', ?)`
    ).bind(publication.sessionId, result.customerId, previous ? "correct" : "publish", auditJson(previous), auditJson(current), now));
  }
  for (const previous of existing.results) {
    if (previous.status !== "published" || nextByCustomer.has(previous.customer_id)) continue;
    statements.push(env.MOBILE_DB.prepare(
      `UPDATE mobile_results SET status = 'withdrawn', updated_at = ? WHERE session_id = ? AND customer_id = ?`
    ).bind(now, publication.sessionId, previous.customer_id));
    statements.push(env.MOBILE_DB.prepare(
      `INSERT INTO mobile_results_audit(session_id, customer_id, action, previous_json, current_json, actor, changed_at)
       VALUES (?, ?, 'withdraw', ?, NULL, 'timing-server', ?)`
    ).bind(publication.sessionId, previous.customer_id, auditJson(previous), now));
  }
  if (statements.length) await env.MOBILE_DB.batch(statements);
  return json6(200, { ok: true, status: "published" });
}
__name(publish, "publish");
async function withdraw(env, body2) {
  if (!env.MOBILE_DB || !env.MOBILE_PUBLISH_TOKEN) return unavailable3();
  const sessionId = typeof body2.sessionId === "string" ? body2.sessionId.trim() : "";
  if (!/^[A-Za-z0-9._:-]{1,128}$/.test(sessionId)) return invalid();
  const rows = await env.MOBILE_DB.prepare("SELECT * FROM mobile_results WHERE session_id = ?").bind(sessionId).all();
  const now = Date.now();
  const active = rows.results.filter((row) => row.status === "published");
  const statements = [];
  for (const row of active) {
    statements.push(env.MOBILE_DB.prepare(
      `UPDATE mobile_results SET status = 'withdrawn', updated_at = ? WHERE session_id = ? AND customer_id = ?`
    ).bind(now, sessionId, row.customer_id));
    statements.push(env.MOBILE_DB.prepare(
      `INSERT INTO mobile_results_audit(session_id, customer_id, action, previous_json, current_json, actor, changed_at)
       VALUES (?, ?, 'withdraw', ?, NULL, 'timing-server', ?)`
    ).bind(sessionId, row.customer_id, auditJson(row), now));
  }
  if (!rows.results.length) {
    statements.push(env.MOBILE_DB.prepare(
      `INSERT INTO mobile_results_audit(session_id, customer_id, action, previous_json, current_json, actor, changed_at)
       VALUES (?, NULL, 'withdraw', NULL, NULL, 'timing-server', ?)`
    ).bind(sessionId, now));
  }
  if (statements.length) await env.MOBILE_DB.batch(statements);
  return json6(200, { ok: true, status: "withdrawn" });
}
__name(withdraw, "withdraw");
async function emailLookup(env, email) {
  if (!env.MOBILE_LOOKUP_KEY) return null;
  const key = await crypto.subtle.importKey(
    "raw",
    encoder4.encode(env.MOBILE_LOOKUP_KEY),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder4.encode(`email:${email.trim().toLowerCase()}`)));
  let binary = "";
  for (const byte of signature) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
__name(emailLookup, "emailLookup");
async function linkIdentity(request, env) {
  if (!env.MOBILE_DB || !env.MOBILE_ADMIN_TOKEN || !env.MOBILE_LOOKUP_KEY || env.MOBILE_ADMIN_TOKEN === env.MOBILE_PUBLISH_TOKEN) return unavailable3();
  if (!authorized(request, env.MOBILE_ADMIN_TOKEN, "x-mobile-admin-token")) return json6(401, { erro: "N\xE3o autorizado." });
  const body2 = await parseBody2(request);
  const customerId = typeof body2?.customerId === "string" ? body2.customerId.trim() : "";
  const email = typeof body2?.email === "string" ? body2.email.trim().toLowerCase() : "";
  const nivel = body2?.nivel === "cpf" ? "cpf" : "completo";
  if (!/^\d{1,20}$/.test(customerId) || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return invalid();
  const lookup = await emailLookup(env, email);
  if (!lookup) return unavailable3();
  const account = await env.MOBILE_DB.prepare(
    "SELECT id FROM mobile_accounts WHERE email_lookup = ? AND email_verified_at IS NOT NULL AND deleted_at IS NULL LIMIT 1"
  ).bind(lookup).first();
  if (!account) return json6(404, { erro: "N\xE3o foi poss\xEDvel validar o e-mail informado." });
  const now = Date.now();
  await env.MOBILE_DB.batch([
    env.MOBILE_DB.prepare(
      `INSERT OR IGNORE INTO mobile_identity_links(customer_id, account_id, linked_at, nivel) VALUES (?, ?, ?, ?)`
    ).bind(customerId, account.id, now, nivel),
    // promoção: o mesmo par passou a bater também e-mail/telefone (nunca rebaixa)
    env.MOBILE_DB.prepare(
      `UPDATE mobile_identity_links SET nivel = 'completo' WHERE customer_id = ? AND account_id = ? AND ? = 'completo' AND nivel <> 'completo'`
    ).bind(customerId, account.id, nivel),
    env.MOBILE_DB.prepare(
      `INSERT OR IGNORE INTO mobile_identity_link_audit(customer_id, account_id, action, changed_at)
       SELECT ?, ?, 'linked', ? WHERE EXISTS (
         SELECT 1 FROM mobile_identity_links WHERE customer_id = ? AND account_id = ?
       )`
    ).bind(customerId, account.id, now, customerId, account.id)
  ]);
  const link = await env.MOBILE_DB.prepare(
    "SELECT account_id FROM mobile_identity_links WHERE customer_id = ? LIMIT 1"
  ).bind(customerId).first();
  if (link?.account_id !== account.id) return json6(409, { erro: "Este cliente ou esta conta j\xE1 est\xE1 vinculado." });
  return json6(200, { ok: true, nivel });
}
__name(linkIdentity, "linkIdentity");
async function publicResults(env) {
  if (!env.MOBILE_DB) return unavailable3();
  const sessions = await env.MOBILE_DB.prepare(
    `SELECT session_id, event_name, event_date, MAX(updated_at) publicado FROM mobile_results WHERE status = 'published'
     GROUP BY session_id, event_name, event_date ORDER BY event_date DESC, publicado DESC, session_id DESC LIMIT 60`
  ).all();
  if (!sessions.results.length) return json6(200, []);
  const ids = sessions.results.map((s) => s.session_id);
  const rows = await env.MOBILE_DB.prepare(
    `SELECT session_id, display_name, position, kart, laps, best_lap_ms FROM mobile_results
     WHERE status = 'published' AND session_id IN (${ids.map(() => "?").join(",")}) ORDER BY session_id, position, display_name`
  ).bind(...ids).all();
  const porBateria = /* @__PURE__ */ new Map();
  for (const row of rows.results) porBateria.set(row.session_id, [...porBateria.get(row.session_id) ?? [], row]);
  return json6(200, sessions.results.map((session) => ({
    sessionId: session.session_id,
    eventName: session.event_name,
    eventDate: session.event_date,
    results: (porBateria.get(session.session_id) ?? []).slice(0, 100).map((row) => ({
      displayName: row.display_name,
      position: Number(row.position),
      kart: row.kart,
      laps: Number(row.laps),
      bestLapMs: row.best_lap_ms == null ? null : Number(row.best_lap_ms)
    }))
  })));
}
__name(publicResults, "publicResults");
async function personalResults(request, env) {
  const account = await authenticateMobileRequest(request, env);
  if (!account) return json6(401, { erro: "Sess\xE3o inv\xE1lida ou expirada." });
  if (!env.MOBILE_DB) return unavailable3();
  const link = await env.MOBILE_DB.prepare(
    "SELECT customer_id FROM mobile_identity_links WHERE account_id = ? LIMIT 1"
  ).bind(account.id).first();
  if (!link) return json6(200, {
    vinculo: "pendente",
    mensagem: "Seu hist\xF3rico aparece sozinho assim que o CPF da sua conta for encontrado no cadastro do kart\xF3dromo. Se voc\xEA ainda n\xE3o correu aqui, ele aparece depois da sua primeira bateria.",
    results: []
  });
  const rows = await env.MOBILE_DB.prepare(
    `SELECT session_id, event_name, event_date, display_name, position, kart, laps, best_lap_ms
     FROM mobile_results WHERE customer_id = ? AND status = 'published'
     ORDER BY event_date DESC, session_id DESC, position LIMIT 500`
  ).bind(link.customer_id).all();
  await env.MOBILE_DB.prepare("CREATE TABLE IF NOT EXISTS mobile_ranking (chave TEXT PRIMARY KEY, dados TEXT NOT NULL, atualizado_em INTEGER NOT NULL)").run();
  const historyRow = await env.MOBILE_DB.prepare("SELECT dados FROM mobile_ranking WHERE chave = ?").bind(`historico:${link.customer_id}`).first();
  const bySession = /* @__PURE__ */ new Map();
  if (historyRow) {
    try {
      const stored = JSON.parse(historyRow.dados);
      if (Array.isArray(stored.results)) {
        for (const value2 of stored.results) {
          const result = historicalResult(value2);
          if (result) bySession.set(result.sessionId, result);
        }
      }
    } catch {
    }
  }
  for (const row of rows.results) {
    const result = {
      sessionId: String(row.session_id),
      eventName: String(row.event_name),
      eventDate: String(row.event_date),
      displayName: String(row.display_name),
      position: Number(row.position),
      kart: String(row.kart),
      laps: Number(row.laps),
      bestLapMs: row.best_lap_ms == null ? null : Number(row.best_lap_ms)
    };
    bySession.set(result.sessionId, result);
  }
  const results = [...bySession.values()].sort((a, b) => b.eventDate.localeCompare(a.eventDate) || b.sessionId.localeCompare(a.sessionId) || a.position - b.position).slice(0, 500);
  return json6(200, {
    vinculo: "validado",
    results
  });
}
__name(personalResults, "personalResults");
async function linkedCustomers(request, env) {
  if (!env.MOBILE_DB || !env.MOBILE_ADMIN_TOKEN) return unavailable3();
  if (!authorized(request, env.MOBILE_ADMIN_TOKEN, "x-mobile-admin-token")) return json6(401, { erro: "N\xE3o autorizado." });
  const links = await env.MOBILE_DB.prepare("SELECT DISTINCT customer_id FROM mobile_identity_links ORDER BY customer_id").all();
  return json6(200, { customerIds: links.results.map((row) => String(row.customer_id)).filter((id) => /^\d{1,20}$/.test(id)) });
}
__name(linkedCustomers, "linkedCustomers");
async function handleMobileResults(request, env) {
  const path = new URL(request.url).pathname;
  try {
    if (path === "/api/mobile/v1/internal/results") {
      if (request.method !== "POST") return json6(405, { erro: "M\xE9todo n\xE3o permitido." });
      if (!env.MOBILE_DB || !env.MOBILE_PUBLISH_TOKEN) return unavailable3();
      if (!authorized(request, env.MOBILE_PUBLISH_TOKEN, "x-mobile-publish-token")) return json6(401, { erro: "N\xE3o autorizado." });
      const body2 = await parseBody2(request);
      if (!body2) return invalid();
      if (body2.action === "withdraw") {
        return await withdraw(env, body2);
      }
      return await publish(env, body2);
    }
    if (path === "/api/mobile/v1/internal/identity-links") {
      if (request.method === "GET") return await linkedCustomers(request, env);
      if (request.method !== "POST") return json6(405, { erro: "M\xE9todo n\xE3o permitido." });
      return await linkIdentity(request, env);
    }
    if (path === "/api/mobile/v1/internal/identity-candidates") {
      if (request.method !== "GET") return json6(405, { erro: "M\xE9todo n\xE3o permitido." });
      if (!env.MOBILE_DB || !env.MOBILE_ADMIN_TOKEN) return unavailable3();
      if (!authorized(request, env.MOBILE_ADMIN_TOKEN, "x-mobile-admin-token")) return json6(401, { erro: "N\xE3o autorizado." });
      const candidates = await mobileIdentityCandidates(env);
      return candidates ? json6(200, candidates) : unavailable3();
    }
    if (path === "/api/mobile/v1/results") {
      if (request.method !== "GET") return json6(405, { erro: "M\xE9todo n\xE3o permitido." });
      return await publicResults(env);
    }
    if (path === "/api/mobile/v1/results/me") {
      if (request.method !== "GET") return json6(405, { erro: "M\xE9todo n\xE3o permitido." });
      return await personalResults(request, env);
    }
    return json6(404, { erro: "Rota desconhecida." });
  } catch {
    return unavailable3();
  }
}
__name(handleMobileResults, "handleMobileResults");

// src/mobile/live.ts
var json7 = /* @__PURE__ */ __name((status, body2, maxAge = 0) => new Response(JSON.stringify(body2), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": maxAge ? `public, max-age=${maxAge}` : "no-store" }
}), "json");
var texto = /* @__PURE__ */ __name((v, max) => typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "", "texto");
var inteiro = /* @__PURE__ */ __name((v) => typeof v === "number" && Number.isSafeInteger(v) && v >= 0 ? v : null, "inteiro");
var milissegundos = /* @__PURE__ */ __name((v) => typeof v === "number" && Number.isFinite(v) && Number.isSafeInteger(v) && v > 0 ? v : null, "milissegundos");
function voltasParaApp(value2) {
  if (!Array.isArray(value2)) return [];
  const porNumero = /* @__PURE__ */ new Map();
  for (const item of value2) {
    const number = inteiro(item?.number);
    const time = texto(item?.time, 16);
    const timeMs = milissegundos(item?.timeMs);
    if (number === null || number < 1 || !time || timeMs === null) continue;
    porNumero.set(number, { number, time, timeMs });
  }
  return [...porNumero.values()].sort((a, b) => a.number - b.number);
}
__name(voltasParaApp, "voltasParaApp");
function historicoIncompleto(drivers) {
  if (!Array.isArray(drivers) || drivers.length === 0) return false;
  return drivers.some((driver) => {
    const laps = inteiro(driver?.laps);
    const bruto = driver?.lapTimes;
    if (laps === null) return !Array.isArray(bruto);
    if (laps === 0) return false;
    return voltasParaApp(bruto).length < laps;
  });
}
__name(historicoIncompleto, "historicoIncompleto");
function retratoParaApp(r) {
  const status = r.status === "live" ? "live" : r.status === "finished" ? "finished" : "empty";
  const pilotos = (Array.isArray(r.drivers) ? r.drivers : []).filter((d) => inteiro(d.position) !== null && inteiro(d.position) < 999 && texto(d.kart, 10) && texto(d.kart, 10) !== "-").slice(0, 60).map((d) => ({
    position: inteiro(d.position),
    kart: texto(d.kart, 10),
    name: texto(d.name, 80),
    best: texto(d.time, 16),
    laps: inteiro(d.laps),
    last: texto(d.last, 16),
    bestLap: inteiro(d.bestLap),
    gap: texto(d.gap, 20),
    lapTimes: voltasParaApp(d.lapTimes),
    // hora exata da última passagem, no relógio da cronometragem (versão app=1 do retrato)
    passouEm: typeof d.passouEm === "number" && Number.isFinite(d.passouEm) ? d.passouEm : null
  }));
  const updatedAt = typeof r.updatedAt === "string" ? r.updatedAt : (/* @__PURE__ */ new Date()).toISOString();
  return {
    transport: "polling",
    status,
    eventName: texto(r.eventName, 120),
    trackName: texto(r.trackName, 120),
    sessionType: r.sessionType === "race" ? "race" : "qualifying",
    raceId: typeof r.race?.id === "string" ? r.race.id : null,
    startedAt: typeof r.race?.startedAt === "string" ? r.race.startedAt : null,
    updatedAt,
    lastUpdatedAt: typeof r.lastUpdatedAt === "string" ? r.lastUpdatedAt : updatedAt,
    drivers: status === "empty" ? [] : pilotos
  };
}
__name(retratoParaApp, "retratoParaApp");
async function handleMobileLive(request, env) {
  if (request.method !== "GET") return json7(405, { erro: "M\xE9todo n\xE3o permitido." });
  if (env.AO_VIVO) {
    const objeto2 = env.AO_VIVO.get(env.AO_VIVO.idFromName("crono"));
    if (request.headers.get("upgrade")?.toLowerCase() === "websocket") return objeto2.fetch(request);
    const cache3 = globalThis.caches?.default;
    const chave2 = new Request("https://cache.kartodromo/app/ao-vivo-1s");
    const guardado2 = cache3 ? await cache3.match(chave2) : void 0;
    if (guardado2) return guardado2;
    const r2 = await objeto2.fetch("https://ao-vivo/retrato").catch(() => null);
    if (!r2?.ok) return handleMobileLive(request, { CRONO_URL: env.CRONO_URL });
    try {
      const corpo2 = await r2.clone().json();
      if (historicoIncompleto(corpo2.drivers)) return handleMobileLive(request, { CRONO_URL: env.CRONO_URL });
    } catch {
      return handleMobileLive(request, { CRONO_URL: env.CRONO_URL });
    }
    const resposta2 = new Response(r2.body, { status: r2.status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": r2.ok ? "public, max-age=1" : "no-store" } });
    if (cache3 && r2.ok) await cache3.put(chave2, resposta2.clone());
    return resposta2;
  }
  const cache2 = globalThis.caches?.default;
  const chave = new Request("https://cache.kartodromo/app/ao-vivo");
  const guardado = cache2 ? await cache2.match(chave) : void 0;
  if (guardado) return guardado;
  const origem = (env.CRONO_URL?.trim() || "https://crono.kartodromodebetim.com.br").replace(/\/$/, "");
  let r;
  try {
    r = await fetch(`${origem}/api/livetime-snapshot`, { signal: AbortSignal.timeout(6e3), headers: { accept: "application/json" } });
  } catch {
    return json7(503, { erro: "A cronometragem n\xE3o respondeu. Tente de novo em instantes." });
  }
  if (!r.ok) return json7(503, { erro: "A cronometragem n\xE3o respondeu. Tente de novo em instantes." });
  let corpo;
  try {
    corpo = await r.json();
  } catch {
    return json7(503, { erro: "A cronometragem respondeu num formato inesperado." });
  }
  const resposta = json7(200, retratoParaApp(corpo), 2);
  if (cache2) await cache2.put(chave, resposta.clone());
  return resposta;
}
__name(handleMobileLive, "handleMobileLive");
var AoVivo = class {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.retrato = null;
    this.voltas = /* @__PURE__ */ new Map();
    this.passou = /* @__PURE__ */ new Map();
    this.corrida = null;
    this.fonte = null;
    this.ultimoUso = 0;
    this.ultimoDado = 0;
    this.esperando = [];
    this.difCrono = null;
    this.medido = 0;
  }
  static {
    __name(this, "AoVivo");
  }
  async fetch(request) {
    this.ultimoUso = Date.now();
    this.ligar();
    if (request.headers.get("upgrade")?.toLowerCase() === "websocket") {
      const par = new WebSocketPair();
      this.state.acceptWebSocket(par[1]);
      if (this.retrato) par[1].send(this.mensagem());
      return new Response(null, { status: 101, webSocket: par[0] });
    }
    if (!this.retrato) await new Promise((ok) => {
      this.esperando.push(ok);
      setTimeout(ok, 5e3);
    });
    if (!this.retrato) return json7(503, { erro: "A cronometragem n\xE3o respondeu. Tente de novo em instantes." });
    return new Response(this.mensagem(), { headers: { "content-type": "application/json; charset=utf-8" } });
  }
  webSocketMessage(ws, msg) {
    this.ultimoUso = Date.now();
    if (msg === "ping") ws.send(JSON.stringify({ tipo: "pong", agora: this.agoraCrono() }));
  }
  webSocketClose(ws) {
    try {
      ws.close();
    } catch {
    }
  }
  webSocketError(ws) {
    try {
      ws.close();
    } catch {
    }
  }
  /** de 20 em 20 s: reabre a fonte se caiu ou ficou muda; fecha quando não há mais ninguém */
  async alarm() {
    const conectados = this.state.getWebSockets().length;
    if (!conectados && Date.now() - this.ultimoUso > 6e4) {
      this.fonte?.abort();
      this.fonte = null;
      return;
    }
    if (this.fonte && Date.now() - this.ultimoDado > 4e4) {
      this.fonte.abort();
      this.fonte = null;
    }
    this.ligar();
    if (this.fonte && Date.now() - this.medido > 6e4) await this.medirRelogio();
  }
  ligar() {
    void this.state.storage.getAlarm().then((a) => {
      if (!a) void this.state.storage.setAlarm(Date.now() + 2e4);
    });
    if (this.fonte) return;
    const ctl = new AbortController();
    this.fonte = ctl;
    void this.ler(ctl).finally(() => {
      if (this.fonte === ctl) this.fonte = null;
    });
  }
  async ler(ctl) {
    const origem = (this.env.CRONO_URL?.trim() || "https://crono.kartodromodebetim.com.br").replace(/\/$/, "");
    try {
      const r = await fetch(`${origem}/api/livetime-snapshot/eventos?app=1`, { signal: ctl.signal, headers: { accept: "text/event-stream" } });
      if (!r.ok || !r.body) return;
      this.ultimoDado = Date.now();
      this.difCrono = null;
      this.medido = 0;
      void this.medirRelogio();
      const leitor = r.body.pipeThrough(new TextDecoderStream()).getReader();
      let resto = "";
      for (; ; ) {
        const { value: value2, done } = await leitor.read();
        if (done) return;
        this.ultimoDado = Date.now();
        resto += value2;
        let fim;
        while ((fim = resto.indexOf("\n\n")) >= 0) {
          const bloco = resto.slice(0, fim);
          resto = resto.slice(fim + 2);
          const dados = bloco.split("\n").filter((l) => l.startsWith("data:")).map((l) => l.slice(5).trimStart()).join("\n");
          if (/^event:\s*snapshot/m.test(bloco) && dados) {
            try {
              this.novo(JSON.parse(dados));
            } catch {
            }
          }
        }
      }
    } catch {
    }
  }
  novo(corpo) {
    const gerado = typeof corpo.updatedAt === "string" ? Date.parse(corpo.updatedAt) : NaN;
    if (Number.isFinite(gerado) && !this.medido) {
      const dif = gerado - Date.now();
      if (this.difCrono === null || dif > this.difCrono) this.difCrono = dif;
    }
    const agora = Number.isFinite(gerado) ? gerado : this.agoraCrono();
    const base = retratoParaApp(corpo);
    const raceId = typeof corpo.race?.id === "string" ? corpo.race.id : null;
    const novaCorrida = raceId !== this.corrida;
    if (novaCorrida) {
      this.corrida = raceId;
      this.voltas.clear();
      this.passou.clear();
    }
    const conhecida = !novaCorrida && this.voltas.size > 0;
    const drivers = base.drivers.map((d) => {
      const antes = this.voltas.get(d.kart);
      if (d.laps !== null) {
        if (antes !== void 0 && d.laps > antes || antes === void 0 && conhecida && d.laps > 0) this.passou.set(d.kart, agora);
        this.voltas.set(d.kart, d.laps);
      }
      return { ...d, passouEm: d.passouEm ?? this.passou.get(d.kart) ?? null };
    });
    this.retrato = { ...base, raceId, drivers };
    for (const ok of this.esperando.splice(0)) ok();
    const msg = this.mensagem();
    for (const ws of this.state.getWebSockets()) {
      try {
        ws.send(msg);
      } catch {
      }
    }
  }
  /** acerta o relógio pelo da crono como num relógio de rede: 3 pedidos, vale o de menor ida e volta (meio do caminho) */
  async medirRelogio() {
    const origem = (this.env.CRONO_URL?.trim() || "https://crono.kartodromodebetim.com.br").replace(/\/$/, "");
    let melhor = Infinity;
    for (let i = 0; i < 3; i++) {
      try {
        const t0 = Date.now();
        const r = await fetch(`${origem}/api/livetime-snapshot`, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(3e3) });
        const j = await r.json();
        const t1 = Date.now();
        const hora = typeof j.updatedAt === "string" ? Date.parse(j.updatedAt) : NaN;
        if (Number.isFinite(hora) && t1 - t0 < melhor) {
          melhor = t1 - t0;
          this.difCrono = hora - (t0 + t1) / 2;
          this.medido = Date.now();
        }
      } catch {
      }
    }
  }
  agoraCrono() {
    return Date.now() + (this.difCrono ?? 0);
  }
  mensagem() {
    return JSON.stringify({ tipo: "retrato", agora: this.agoraCrono(), ...this.retrato, lastUpdatedAt: this.retrato?.updatedAt ?? null, transport: "websocket" });
  }
};

// src/mobile/sinal-vinculo.ts
var ESPERA_MAX_MS = 25e3;
var SinalVinculo = class {
  constructor() {
    this.esperando = /* @__PURE__ */ new Set();
    this.pendente = false;
  }
  static {
    __name(this, "SinalVinculo");
  }
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === "/tocar") {
      await this.tocar();
      return new Response("ok");
    }
    const sinal = await this.esperar(Number(url.searchParams.get("ms") ?? ESPERA_MAX_MS));
    return Response.json({ sinal });
  }
  /** Acorda quem está esperando; se ninguém estiver, guarda para o próximo. */
  async tocar() {
    if (this.esperando.size === 0) {
      this.pendente = true;
      return;
    }
    for (const acordar of this.esperando) acordar(true);
    this.esperando.clear();
  }
  /** true = houve pedido de vínculo; false = passou o tempo sem pedido. */
  async esperar(ms) {
    if (this.pendente) {
      this.pendente = false;
      return true;
    }
    const limite = Math.min(Math.max(ms, 1e3), ESPERA_MAX_MS);
    return new Promise((resolve) => {
      const acordar = /* @__PURE__ */ __name((sinal) => {
        clearTimeout(timer);
        this.esperando.delete(acordar);
        resolve(sinal);
      }, "acordar");
      const timer = setTimeout(() => acordar(false), limite);
      this.esperando.add(acordar);
    });
  }
};
function objeto(env) {
  return env.SINAL_VINCULO?.get(env.SINAL_VINCULO.idFromName("vinculo"));
}
__name(objeto, "objeto");
async function pedirVinculo(env) {
  try {
    await objeto(env)?.fetch("https://sinal/tocar", { method: "POST" });
  } catch {
  }
}
__name(pedirVinculo, "pedirVinculo");
function igual(a, b) {
  const x = new TextEncoder().encode(a), y = new TextEncoder().encode(b);
  if (x.length !== y.length) return false;
  let d = 0;
  for (let i = 0; i < x.length; i++) d |= x[i] ^ y[i];
  return d === 0;
}
__name(igual, "igual");
var json8 = /* @__PURE__ */ __name((status, body2) => new Response(JSON.stringify(body2), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
}), "json");
async function esperarPedidoDeVinculo(request, env) {
  if (request.method !== "GET") return json8(405, { erro: "M\xE9todo n\xE3o permitido." });
  const token = request.headers.get("x-mobile-admin-token") ?? "";
  if (!env.MOBILE_ADMIN_TOKEN || !igual(token, env.MOBILE_ADMIN_TOKEN)) return json8(401, { erro: "N\xE3o autorizado." });
  const alvo = objeto(env);
  if (!alvo) return json8(503, { erro: "Servi\xE7o temporariamente indispon\xEDvel." });
  const ms = Number(new URL(request.url).searchParams.get("ms") ?? ESPERA_MAX_MS);
  const r = await alvo.fetch(`https://sinal/esperar?ms=${Number.isFinite(ms) ? ms : ESPERA_MAX_MS}`);
  const { sinal } = await r.json();
  return json8(200, { sinal });
}
__name(esperarPedidoDeVinculo, "esperarPedidoDeVinculo");

// src/mobile/perfil.ts
var json9 = /* @__PURE__ */ __name((status, body2) => new Response(JSON.stringify(body2), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } }), "json");
function igual2(a, b) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
__name(igual2, "igual");
var TEXTO = { telefone: 20, sexo: 1, tipoSanguineo: 3, cep: 12, endereco: 120, numero: 20, complemento: 60, bairro: 60, cidade: 60, estado: 2 };
var SANGUE = /* @__PURE__ */ new Set(["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]);
function dataIsoValida(value2) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value2)) return false;
  const [ano, mes, dia] = value2.split("-").map(Number);
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  const hoje = /* @__PURE__ */ new Date();
  return data.getUTCFullYear() === ano && data.getUTCMonth() === mes - 1 && data.getUTCDate() === dia && value2 >= "1920-01-01" && value2 <= hoje.toISOString().slice(0, 10);
}
__name(dataIsoValida, "dataIsoValida");
function validarPerfil(c) {
  const dados = {};
  for (const [k, max] of Object.entries(TEXTO)) {
    if (!(k in c)) continue;
    const v = c[k] === null ? "" : String(c[k] ?? "").replace(/\s+/g, " ").trim();
    dados[k] = v ? v.slice(0, max) : null;
  }
  if (dados.telefone) {
    const t = String(dados.telefone).replace(/\D/g, "");
    if (t.length < 10 || t.length > 11) return { ok: false, erro: "Telefone com DDD: 10 ou 11 n\xFAmeros." };
    dados.telefone = t;
  }
  if (dados.cep) {
    const t = String(dados.cep).replace(/\D/g, "");
    if (t.length !== 8) return { ok: false, erro: "CEP com 8 n\xFAmeros." };
    dados.cep = t;
  }
  if (dados.estado) {
    dados.estado = String(dados.estado).toUpperCase();
    if (!/^[A-Z]{2}$/.test(dados.estado)) return { ok: false, erro: "Estado com 2 letras (ex.: MG)." };
  }
  if (dados.sexo && !["M", "F"].includes(String(dados.sexo))) return { ok: false, erro: "G\xEAnero inv\xE1lido." };
  if (dados.tipoSanguineo && !SANGUE.has(String(dados.tipoSanguineo))) return { ok: false, erro: "Tipo sangu\xEDneo inv\xE1lido." };
  if ("nascimento" in c) {
    const n = String(c.nascimento ?? "").trim();
    if (n && !dataIsoValida(n)) return { ok: false, erro: "Data de nascimento inv\xE1lida." };
    dados.nascimento = n || null;
  }
  if ("peso" in c) {
    const p = c.peso === null || c.peso === "" ? null : Number(String(c.peso).replace(",", "."));
    if (p !== null && (!Number.isFinite(p) || p < 15 || p > 250)) return { ok: false, erro: "Peso entre 15 e 250 kg." };
    dados.peso = p === null ? null : Math.round(p * 10) / 10;
  }
  if (!Object.keys(dados).length) return { ok: false, erro: "Nada para alterar." };
  return { ok: true, dados };
}
__name(validarPerfil, "validarPerfil");
async function tabela(env) {
  await env.MOBILE_DB.prepare(`CREATE TABLE IF NOT EXISTS mobile_perfil (cliente TEXT PRIMARY KEY, perfil TEXT, publicado_em INTEGER,
    pedido TEXT, pedido_em INTEGER, erro TEXT)`).run();
}
__name(tabela, "tabela");
async function handleMobilePerfil(request, env) {
  if (!env.MOBILE_DB || !env.MOBILE_ADMIN_TOKEN) return json9(503, { erro: "Servi\xE7o temporariamente indispon\xEDvel." });
  const p = new URL(request.url).pathname;
  try {
    await tabela(env);
    if (p === "/api/mobile/v1/internal/perfil") {
      if (!igual2(request.headers.get("x-mobile-admin-token") ?? "", env.MOBILE_ADMIN_TOKEN)) return json9(401, { erro: "N\xE3o autorizado." });
      if (request.method === "GET") {
        const r = await env.MOBILE_DB.prepare(
          `SELECT l.customer_id cliente, p.pedido pedido FROM mobile_identity_links l LEFT JOIN mobile_perfil p ON p.cliente = l.customer_id
            WHERE l.nivel = 'completo' AND (p.pedido IS NOT NULL OR p.publicado_em IS NULL OR p.publicado_em < ?)
            ORDER BY (p.pedido IS NULL), p.pedido_em LIMIT 50`
        ).bind(Date.now() - 864e5).all();
        return json9(200, { itens: (r.results ?? []).map((x) => ({ cliente: x.cliente, pedido: x.pedido ? JSON.parse(x.pedido) : null })) });
      }
      if (request.method === "POST") {
        const corpo = await request.json();
        const agora = Date.now();
        const stmts = (corpo.itens ?? []).slice(0, 100).filter((i) => /^\d{1,12}$/.test(String(i.cliente))).map((i) => env.MOBILE_DB.prepare(
          `INSERT INTO mobile_perfil(cliente, perfil, publicado_em, pedido, pedido_em, erro) VALUES (?, ?, ?, NULL, NULL, ?)
           ON CONFLICT(cliente) DO UPDATE SET perfil = excluded.perfil, publicado_em = excluded.publicado_em, erro = excluded.erro,
             pedido = CASE WHEN ? THEN NULL ELSE pedido END, pedido_em = CASE WHEN ? THEN NULL ELSE pedido_em END`
        ).bind(String(i.cliente), JSON.stringify(i.perfil ?? null), agora, i.erro ?? null, i.aplicado ? 1 : 0, i.aplicado ? 1 : 0));
        if (stmts.length) await env.MOBILE_DB.batch(stmts);
        return json9(200, { ok: true, gravados: stmts.length });
      }
      return json9(405, { erro: "M\xE9todo n\xE3o permitido." });
    }
    const conta = await authenticateMobileRequest(request, env);
    if (!conta) return json9(401, { erro: "Entre na sua conta." });
    const link = await env.MOBILE_DB.prepare("SELECT customer_id, nivel FROM mobile_identity_links WHERE account_id = ?").bind(conta.id).first();
    if (!link) return json9(404, { erro: "Sua conta ainda n\xE3o est\xE1 ligada ao seu cadastro no kart\xF3dromo. Se voc\xEA j\xE1 correu aqui, confira se o CPF \xE9 o mesmo do cadastro ou fale com a recep\xE7\xE3o." });
    if (link.nivel !== "completo") return json9(403, { codigo: "VINCULO_SO_CPF", erro: "Por seguran\xE7a, seus dados pessoais s\xF3 aparecem quando o e-mail ou o celular da conta forem os mesmos do cadastro no kart\xF3dromo. Pe\xE7a \xE0 recep\xE7\xE3o para atualizar seu cadastro." });
    const atual = await env.MOBILE_DB.prepare("SELECT perfil, publicado_em, pedido, erro FROM mobile_perfil WHERE cliente = ?").bind(link.customer_id).first();
    if (request.method === "GET") {
      return json9(200, { perfil: atual?.perfil ? JSON.parse(atual.perfil) : null, pendente: atual?.pedido ? JSON.parse(atual.pedido) : null, erro: atual?.erro ?? null, atualizadoEm: atual?.publicado_em ? new Date(atual.publicado_em).toISOString() : null });
    }
    if (request.method === "PUT") {
      const v = validarPerfil(await request.json());
      if (!v.ok) return json9(400, { erro: v.erro });
      const pedido = { ...atual?.pedido ? JSON.parse(atual.pedido) : {}, ...v.dados };
      await env.MOBILE_DB.prepare(`INSERT INTO mobile_perfil(cliente, pedido, pedido_em, erro) VALUES (?, ?, ?, NULL)
        ON CONFLICT(cliente) DO UPDATE SET pedido = excluded.pedido, pedido_em = excluded.pedido_em, erro = NULL`).bind(link.customer_id, JSON.stringify(pedido), Date.now()).run();
      return json9(202, { pendente: pedido, mensagem: "Recebido! Seu cadastro no kart\xF3dromo \xE9 atualizado em at\xE9 1 minuto." });
    }
    return json9(405, { erro: "M\xE9todo n\xE3o permitido." });
  } catch {
    return json9(503, { erro: "Servi\xE7o temporariamente indispon\xEDvel." });
  }
}
__name(handleMobilePerfil, "handleMobilePerfil");

// src/mobile/ranking-data.ts
function categoriaDoKart(kart) {
  const value2 = String(kart ?? "").trim();
  if (!/^\d{1,3}$/.test(value2)) return null;
  const number = Number(value2);
  return number <= 99 ? "Indoor" : number <= 199 ? "Super Kart" : null;
}
__name(categoriaDoKart, "categoriaDoKart");
function normalizarTracado(value2) {
  return String(value2 ?? "").replace(/\s*·\s*Super\s*Kart\s*$/i, "").replace(/\s+normal$/i, "").trim();
}
__name(normalizarTracado, "normalizarTracado");
function montarRanking(origem, url) {
  const categoria = (url.searchParams.get("categoria") ?? "").toLowerCase().replace(/\s/g, "");
  const normalizadas = origem.filter((l) => Number.isFinite(l.ms) && l.ms > 0).map((l) => ({
    ...l,
    tracado: normalizarTracado(l.tracado),
    categoria: categoriaDoKart(l.kart) ?? (!l.kart ? l.categoria ?? null : null)
  }));
  const dias = [...new Set(normalizadas.map((l) => l.dia))].sort().reverse();
  const dia = url.searchParams.get("dia");
  const filtradas = normalizadas.filter((l) => (!dia || l.dia === dia) && (!categoria || categoria === "todos" || l.categoria?.toLowerCase().replace(/\s/g, "") === categoria));
  const melhores = /* @__PURE__ */ __name((linhas) => {
    const porPiloto = /* @__PURE__ */ new Map();
    for (const l of linhas) {
      const chave = l.id ? "id:" + l.id : "nome:" + l.nome.trim().toLowerCase();
      const atual = porPiloto.get(chave);
      if (!atual || l.ms < atual.ms || l.ms === atual.ms && l.dia > atual.dia) porPiloto.set(chave, l);
    }
    return [...porPiloto.values()].sort((a, b) => a.ms - b.ms || a.nome.localeCompare(b.nome));
  }, "melhores");
  const tracados = [...new Set(filtradas.map((l) => l.tracado))].filter(Boolean).map((nome) => ({ nome, pilotos: melhores(filtradas.filter((l) => l.tracado === nome)).length })).sort((a, b) => b.pilotos - a.pilotos || a.nome.localeCompare(b.nome));
  const tracado = url.searchParams.has("tracado") ? normalizarTracado(url.searchParams.get("tracado")) : tracados[0]?.nome ?? null;
  const todas = melhores(filtradas.filter((l) => l.tracado === tracado));
  return { dias, tracados, tracado, total: todas.length, linhas: todas.slice(0, 100).map((l, i) => ({ ...l, id: l.id ?? null, pos: i + 1 })) };
}
__name(montarRanking, "montarRanking");

// src/mobile/karts.ts
function filtrarKarts(linhas, url, dias) {
  const periodo = url.searchParams.get("periodo") ?? "dia";
  if (!["dia", "semana", "mes"].includes(periodo)) throw new Error("Per\xEDodo inv\xE1lido.");
  const dia = url.searchParams.get("dia") || dias[0] || (/* @__PURE__ */ new Date()).toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dia) || !Number.isFinite(Date.parse(dia)) || new Date(dia).toISOString().slice(0, 10) !== dia) throw new Error("Data inv\xE1lida.");
  const data = /* @__PURE__ */ new Date(dia + "T12:00:00Z");
  const de = new Date(data);
  const ate = new Date(data);
  if (periodo === "semana") {
    de.setUTCDate(data.getUTCDate() - (data.getUTCDay() + 6) % 7);
    ate.setTime(de.getTime());
    ate.setUTCDate(de.getUTCDate() + 6);
  }
  if (periodo === "mes") {
    de.setUTCDate(1);
    ate.setUTCMonth(ate.getUTCMonth() + 1, 0);
  }
  const desde = de.toISOString().slice(0, 10), fim = ate.toISOString().slice(0, 10);
  const categoria = url.searchParams.get("categoria") || null;
  if (categoria && !["Indoor", "Super Kart"].includes(categoria)) throw new Error("Categoria inv\xE1lida.");
  const tracado = url.searchParams.get("tracado") || null;
  const periodoLinhas = linhas.filter((l) => l.dia >= desde && l.dia <= fim);
  const tracados = [...new Set(periodoLinhas.map((l) => l.tracado))].sort();
  const porKart = /* @__PURE__ */ new Map();
  for (const l of periodoLinhas.filter((l2) => (!categoria || l2.categoria === categoria) && (!tracado || l2.tracado === tracado))) {
    const k = porKart.get(l.kart) ?? { kart: l.kart, melhorMs: null, melhorPos: null, corridas: [] };
    if (l.ms !== null && (k.melhorMs === null || l.ms < k.melhorMs)) k.melhorMs = l.ms;
    if (l.pos > 0 && (k.melhorPos === null || l.pos < k.melhorPos)) k.melhorPos = l.pos;
    k.corridas.push(l);
    porKart.set(l.kart, k);
  }
  const karts = [...porKart.values()].sort((a, b) => (a.melhorMs ?? Infinity) - (b.melhorMs ?? Infinity)).map((k, i) => ({ ...k, posVolta: k.melhorMs === null ? null : i + 1, corridas: k.corridas.sort((a, b) => b.inicio - a.inicio) }));
  return { dia, periodo, de: desde, ate: fim, tracado, categoria, tracados, dias, karts };
}
__name(filtrarKarts, "filtrarKarts");

// src/mobile/ranking.ts
var FOTO_MAX = 15e5;
var fotoChave = /* @__PURE__ */ __name((cliente) => `fotos-app/${cliente}.jpg`, "fotoChave");
var FOTO_TYPES = /* @__PURE__ */ new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);
var MARCAS_HEIF = /* @__PURE__ */ new Set(["heic", "heix", "hevc", "hevx", "heim", "heis", "mif1", "msf1"]);
function tipoDaImagem(bytes) {
  if (bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return "image/jpeg";
  if (bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v)) return "image/png";
  if (bytes.length < 12) return null;
  const texto2 = /* @__PURE__ */ __name((de, ate) => String.fromCharCode(...bytes.slice(de, ate)), "texto");
  if (texto2(0, 4) === "RIFF" && texto2(8, 12) === "WEBP") return "image/webp";
  if (texto2(4, 8) === "ftyp" && MARCAS_HEIF.has(texto2(8, 12))) return "image/heic";
  return null;
}
__name(tipoDaImagem, "tipoDaImagem");
async function enviarFoto(request, env, cliente) {
  if (!env.PRE) return json10(503, { erro: "Servi\xE7o temporariamente indispon\xEDvel." });
  const contentType = (request.headers.get("content-type") ?? "").split(";", 1)[0].trim().toLowerCase();
  if (!FOTO_TYPES.has(contentType)) return json10(415, { erro: "Formato de foto n\xE3o aceito. Escolha JPEG, PNG, WebP ou HEIC.", codigo: "UNSUPPORTED_IMAGE" });
  if (Number(request.headers.get("content-length") ?? 0) > FOTO_MAX) return json10(413, { erro: "A foto \xE9 grande demais. Escolha uma imagem de at\xE9 1,5 MB.", codigo: "IMAGE_TOO_LARGE" });
  const bytes = new Uint8Array(await request.arrayBuffer());
  const detectado = tipoDaImagem(bytes);
  if (bytes.length < 100 || bytes.length > FOTO_MAX || !detectado) return json10(400, { erro: "Arquivo de imagem inv\xE1lido.", codigo: "INVALID_IMAGE" });
  await env.PRE.put(fotoChave(cliente), bytes, { httpMetadata: { contentType: detectado }, customMetadata: { enviadaEm: (/* @__PURE__ */ new Date()).toISOString() } });
  return json10(200, { ok: true, versao: Date.now() });
}
__name(enviarFoto, "enviarFoto");
async function lerFoto(env, cliente) {
  const obj = env.PRE ? await env.PRE.get(fotoChave(cliente)) : null;
  if (!obj) return new Response(null, { status: 404, headers: { "cache-control": "public, max-age=300" } });
  const metadata = obj.httpMetadata;
  return new Response(obj.body, { headers: { "content-type": metadata?.contentType ?? "image/jpeg", "cache-control": "public, max-age=300", etag: obj.httpEtag } });
}
__name(lerFoto, "lerFoto");
var json10 = /* @__PURE__ */ __name((status, body2, maxAge = 0) => new Response(JSON.stringify(body2), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": maxAge ? `public, max-age=${maxAge}` : "no-store" }
}), "json");
var encoder5 = new TextEncoder();
function constantTimeEqual3(a, b) {
  const x = encoder5.encode(a), y = encoder5.encode(b);
  if (x.length !== y.length) return false;
  let dif = 0;
  for (let i = 0; i < x.length; i++) dif |= x[i] ^ y[i];
  return dif === 0;
}
__name(constantTimeEqual3, "constantTimeEqual");
var CHAVE = /^(ranking|piloto:\d{1,12}|karts:\d{4}-\d{2}-\d{2}|historico:\d{1,20}|posicoes:(semana|mes|geral):[a-z0-9-]{1,80})$/;
var PERIODOS_POSICAO = ["semana", "mes", "geral"];
function slugTracado(nome) {
  return nome.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "sem-nome";
}
__name(slugTracado, "slugTracado");
async function preencherPosicoes(db, cid, dados) {
  const tracados = Array.isArray(dados.tracados) ? dados.tracados : [];
  if (!tracados.length || !/^\d{1,12}$/.test(cid)) return dados;
  const chaves = tracados.flatMap((t) => PERIODOS_POSICAO.map((p) => `posicoes:${p}:${slugTracado(String(t.nome ?? ""))}`));
  const { results } = await db.prepare(
    `SELECT chave, json_extract(dados, '$.de') de, json_extract(dados, '$.pos."' || ? || '"') pos
       FROM mobile_ranking WHERE chave IN (${chaves.map(() => "?").join(",")})`
  ).bind(cid, ...chaves).all();
  const porChave = new Map(results.map((r) => [r.chave, r]));
  return {
    ...dados,
    tracados: tracados.map((t) => {
      const novo = { ...t };
      for (const p of PERIODOS_POSICAO) {
        const doc = porChave.get(`posicoes:${p}:${slugTracado(String(t.nome ?? ""))}`);
        if (!doc) continue;
        novo[p] = doc.pos != null && doc.de != null ? { pos: Number(doc.pos), de: Number(doc.de) } : null;
      }
      return novo;
    })
  };
}
__name(preencherPosicoes, "preencherPosicoes");
var LIMITE_CORPO = 4e6;
var tabelaPronta = false;
async function garantirTabela(env) {
  if (tabelaPronta) return;
  await env.MOBILE_DB.prepare("CREATE TABLE IF NOT EXISTS mobile_ranking (chave TEXT PRIMARY KEY, dados TEXT NOT NULL, atualizado_em INTEGER NOT NULL)").run();
  tabelaPronta = true;
}
__name(garantirTabela, "garantirTabela");
async function receber(request, env) {
  if (!constantTimeEqual3(request.headers.get("x-mobile-admin-token") ?? "", env.MOBILE_ADMIN_TOKEN)) return json10(401, { erro: "N\xE3o autorizado." });
  if (Number(request.headers.get("content-length") ?? 0) > LIMITE_CORPO) return json10(413, { erro: "Envio grande demais." });
  const raw = await request.text();
  if (raw.length > LIMITE_CORPO) return json10(413, { erro: "Envio grande demais." });
  let corpo;
  try {
    corpo = JSON.parse(raw);
  } catch {
    return json10(400, { erro: "JSON inv\xE1lido." });
  }
  const itens = Array.isArray(corpo.itens) ? corpo.itens : [];
  if (!itens.length || itens.length > 2e3) return json10(400, { erro: "Envie de 1 a 2000 itens." });
  await garantirTabela(env);
  const agora = Date.now();
  const stmts = [];
  for (const it of itens) {
    if (typeof it.chave !== "string" || !CHAVE.test(it.chave) || it.dados === null || typeof it.dados !== "object") return json10(400, { erro: "Item inv\xE1lido." });
    if (it.chave.startsWith("historico:")) {
      const results = it.dados.results;
      if (!Array.isArray(results) || results.length > 500 || results.some((result) => !result || typeof result !== "object" || Array.isArray(result))) {
        return json10(400, { erro: "Hist\xF3rico inv\xE1lido." });
      }
    }
    stmts.push(env.MOBILE_DB.prepare(
      "INSERT INTO mobile_ranking(chave, dados, atualizado_em) VALUES (?, ?, ?) ON CONFLICT(chave) DO UPDATE SET dados = excluded.dados, atualizado_em = excluded.atualizado_em"
    ).bind(it.chave, JSON.stringify(it.dados), agora));
  }
  for (let i = 0; i < stmts.length; i += 100) await env.MOBILE_DB.batch(stmts.slice(i, i + 100));
  if (typeof corpo.limpar === "number" && corpo.limpar > 0) {
    await env.MOBILE_DB.prepare("DELETE FROM mobile_ranking WHERE chave LIKE 'piloto:%' AND atualizado_em < ?").bind(corpo.limpar).run();
  }
  return json10(200, { ok: true, gravados: stmts.length });
}
__name(receber, "receber");
async function ler(env, chave) {
  await garantirTabela(env);
  const row = await env.MOBILE_DB.prepare("SELECT dados, atualizado_em FROM mobile_ranking WHERE chave = ?").bind(chave).first();
  return row ? { dados: JSON.parse(row.dados), atualizadoEm: new Date(row.atualizado_em).toISOString() } : null;
}
__name(ler, "ler");
function categoriaNormalizada(value2) {
  return String(value2 ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
}
__name(categoriaNormalizada, "categoriaNormalizada");
function linhasDosDias(rows) {
  const linhas = rows.flatMap((row) => {
    try {
      const dia = JSON.parse(row.dados).linhas;
      return Array.isArray(dia) ? dia : [];
    } catch {
      console.error("mobile-ranking", "registro di\xE1rio inv\xE1lido ignorado");
      return [];
    }
  }).filter((l) => l.ms !== null).map((l) => ({ ...l, nome: l.piloto, ms: l.ms }));
  return { linhas, atualizadoEm: Math.max(0, ...rows.map((row) => row.atualizado_em)) };
}
__name(linhasDosDias, "linhasDosDias");
var CACHE_DIAS_MS = 3e4;
var cacheDias = /* @__PURE__ */ new WeakMap();
async function diasDoRanking(db, de, ate) {
  const porBanco = cacheDias.get(db) ?? /* @__PURE__ */ new Map();
  cacheDias.set(db, porBanco);
  const chave = `${de}|${ate}`;
  const guardado = porBanco.get(chave);
  if (guardado && Date.now() - guardado.em < CACHE_DIAS_MS) return guardado.valor;
  const { results } = await db.prepare("SELECT dados, atualizado_em FROM mobile_ranking WHERE chave >= ? AND chave <= ? ORDER BY chave").bind("karts:" + de, "karts:" + ate).all();
  const valor = linhasDosDias(results);
  porBanco.set(chave, { em: Date.now(), valor });
  return valor;
}
__name(diasDoRanking, "diasDoRanking");
async function ranking(url, env) {
  const r = await ler(env, "ranking");
  if (!r) return json10(503, { erro: "O ranking ainda est\xE1 sendo preparado. Tente de novo em alguns minutos." });
  const periodos = r.dados.periodos ?? {};
  const pedidoPeriodo = url.searchParams.get("periodo") ?? "semana";
  if (!["dia", "semana", "mes", "geral"].includes(pedidoPeriodo)) return json10(400, { erro: "Per\xEDodo inv\xE1lido.", codigo: "INVALID_PERIOD" });
  const nome = pedidoPeriodo;
  const per = periodos[nome] ?? periodos.geral ?? { de: null, ate: null, tracados: [] };
  const diaPedido = url.searchParams.get("dia");
  const diaValido = diaPedido && /^\d{4}-\d{2}-\d{2}$/.test(diaPedido) && Number.isFinite(Date.parse(`${diaPedido}T12:00:00Z`)) && (/* @__PURE__ */ new Date(`${diaPedido}T12:00:00Z`)).toISOString().slice(0, 10) === diaPedido;
  if (diaPedido && !diaValido) return json10(400, { erro: "Data inv\xE1lida.", codigo: "INVALID_DATE" });
  const dia = diaPedido || null;
  const categoriaBruta = categoriaNormalizada(url.searchParams.get("categoria"));
  if (categoriaBruta && categoriaBruta !== "todos" && categoriaBruta !== "indoor" && categoriaBruta !== "super kart" && categoriaBruta !== "superkart") return json10(400, { erro: "Categoria inv\xE1lida.", codigo: "INVALID_CATEGORY" });
  const categoria = categoriaBruta === "superkart" ? "super kart" : categoriaBruta;
  const registros = await diasDoRanking(env.MOBILE_DB, per.de ?? "0000-01-01", per.ate ?? "9999-12-31");
  const diarias = registros.linhas;
  const diasCompletos = new Set(diarias.map((l) => l.dia));
  const antigas = per.tracados.flatMap((t) => t.linhas.map((l) => ({ ...l, tracado: t.nome }))).filter((l) => !diasCompletos.has(l.dia));
  const completo = montarRanking([...antigas, ...diarias], url);
  return json10(200, {
    periodo: nome,
    de: per.de,
    ate: per.ate,
    ...completo,
    dia,
    categoria: categoria || null,
    atualizadoEm: new Date(Math.max(Date.parse(r.atualizadoEm), registros.atualizadoEm)).toISOString()
  });
}
__name(ranking, "ranking");
async function piloto(id, env, publico = true) {
  const r = await ler(env, "piloto:" + id);
  if (!r) return json10(404, { erro: "Piloto sem corridas no ranking." });
  const dados = await preencherPosicoes(env.MOBILE_DB, id, r.dados);
  return json10(200, { id, ...dados, atualizadoEm: r.atualizadoEm }, publico ? 60 : 0);
}
__name(piloto, "piloto");
async function clienteDaSessao(request, env) {
  const conta = await authenticateMobileRequest(request, env);
  if (!conta) return json10(401, { erro: "Sua sess\xE3o expirou. Entre novamente.", codigo: "AUTH_REQUIRED" });
  const row = await env.MOBILE_DB.prepare("SELECT customer_id FROM mobile_identity_links WHERE account_id = ?").bind(conta.id).first();
  return row?.customer_id ?? null;
}
__name(clienteDaSessao, "clienteDaSessao");
async function handleMobileRanking(request, env) {
  if (!env.MOBILE_DB || !env.MOBILE_ADMIN_TOKEN) return json10(503, { erro: "Servi\xE7o temporariamente indispon\xEDvel." });
  const url = new URL(request.url);
  const p = url.pathname;
  try {
    if (p === "/api/mobile/v1/internal/ranking") return request.method === "POST" ? await receber(request, env) : json10(405, { erro: "M\xE9todo n\xE3o permitido." });
    if (p === "/api/mobile/v1/ranking/me/foto") {
      const cliente = await clienteDaSessao(request, env);
      if (cliente instanceof Response) return cliente;
      if (!cliente) return json10(404, { erro: "Sua conta ainda n\xE3o est\xE1 ligada ao seu cadastro no kart\xF3dromo." });
      if (request.method === "PUT") return await enviarFoto(request, env, cliente);
      if (request.method === "DELETE") {
        await env.PRE?.delete(fotoChave(cliente));
        return json10(200, { ok: true });
      }
      return json10(405, { erro: "M\xE9todo n\xE3o permitido." });
    }
    if (p === "/api/mobile/v1/ranking/interno/clientes" && request.method === "POST") {
      return await receberClientes(request, env, constantTimeEqual3(request.headers.get("x-mobile-admin-token") ?? "", env.MOBILE_ADMIN_TOKEN));
    }
    if (request.method !== "GET") return json10(405, { erro: "M\xE9todo n\xE3o permitido." });
    const mf = /^\/api\/mobile\/v1\/ranking\/pilotos\/(\d{1,12})\/foto$/.exec(p);
    if (mf) return await lerFoto(env, mf[1]);
    if (p === "/api/mobile/v1/ranking") return await ranking(url, env);
    if (p === "/api/mobile/v1/ranking/busca") {
      const termo = (url.searchParams.get("nome") ?? "").trim().replace(/[%_]/g, "");
      if (termo.length < 3) return json10(400, { erro: "Digite pelo menos 3 letras do nome." });
      await garantirTabela(env);
      const r = await env.MOBILE_DB.prepare(
        `SELECT substr(chave, 8) id, json_extract(dados, '$.nome') nome,
                json_extract(dados, '$.baterias') * 50 + json_extract(dados, '$.podios') * 50 + json_extract(dados, '$.vitorias') * 100
                + json_extract(dados, '$.poles') * 50 + json_extract(dados, '$.voltasMaisRapidas') * 50 xp
           FROM mobile_ranking WHERE chave LIKE 'piloto:%' AND json_extract(dados, '$.nome') LIKE ? ORDER BY xp DESC LIMIT 20`
      ).bind(`%${termo}%`).all();
      return json10(200, { pilotos: r.results ?? [] }, 300);
    }
    if (p === "/api/mobile/v1/ranking/karts") {
      await garantirTabela(env);
      const catalogo = await env.MOBILE_DB.prepare("SELECT chave FROM mobile_ranking WHERE chave LIKE 'karts:%' ORDER BY chave DESC").all();
      const dias = (catalogo.results ?? []).map((r2) => r2.chave.slice(6));
      if (dias.length) {
        let filtro;
        try {
          filtro = filtrarKarts([], url, dias);
        } catch (e) {
          return json10(400, { erro: e.message });
        }
        const registros = await env.MOBILE_DB.prepare("SELECT dados, atualizado_em FROM mobile_ranking WHERE chave >= ? AND chave <= ? ORDER BY chave").bind("karts:" + filtro.de, "karts:" + filtro.ate).all();
        const linhas = (registros.results ?? []).flatMap((r2) => JSON.parse(r2.dados).linhas);
        return json10(200, { ...filtrarKarts(linhas, url, dias), atualizadoEm: new Date(Math.max(0, ...(registros.results ?? []).map((r2) => r2.atualizado_em))).toISOString() }, 60);
      }
      const r = await ler(env, "ranking");
      return json10(200, { ...r?.dados.kartsDoDia ?? { dia: null, karts: [] }, atualizadoEm: r?.atualizadoEm ?? null }, 60);
    }
    if (p === "/api/mobile/v1/ranking/me") {
      const cliente = await clienteDaSessao(request, env);
      if (cliente instanceof Response) return cliente;
      if (!cliente) return json10(404, { erro: "Sua conta ainda n\xE3o est\xE1 ligada ao seu cadastro no kart\xF3dromo." });
      return await piloto(cliente, env, false);
    }
    const m = /^\/api\/mobile\/v1\/ranking\/pilotos\/(\d{1,12})$/.exec(p);
    if (m) return await piloto(m[1], env);
    return json10(404, { erro: "Rota desconhecida." });
  } catch {
    return json10(503, { erro: "Servi\xE7o temporariamente indispon\xEDvel." });
  }
}
__name(handleMobileRanking, "handleMobileRanking");

// src/mobile/outbox.ts
var json11 = /* @__PURE__ */ __name((status, body2) => new Response(JSON.stringify(body2), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
}), "json");
function autorizado(request, esperado) {
  const recebido = request.headers.get("x-mobile-publish-token") ?? "";
  if (!esperado || recebido.length !== esperado.length) return false;
  let dif = 0;
  for (let i = 0; i < esperado.length; i++) dif |= recebido.charCodeAt(i) ^ esperado.charCodeAt(i);
  return dif === 0;
}
__name(autorizado, "autorizado");
async function handleMobileOutbox(request, env) {
  if (!env.MOBILE_DB || !env.MOBILE_PUBLISH_TOKEN) return json11(503, { erro: "Indispon\xEDvel." });
  if (!autorizado(request, env.MOBILE_PUBLISH_TOKEN)) return json11(401, { erro: "N\xE3o autorizado." });
  const path = new URL(request.url).pathname;
  const agora = Date.now();
  if (path === "/api/mobile/v1/internal/outbox" && request.method === "GET") {
    const { results } = await env.MOBILE_DB.prepare(
      `UPDATE mobile_email_outbox SET claimed_at = ?, attempts = attempts + 1
        WHERE id IN (SELECT id FROM mobile_email_outbox
          WHERE (claimed_at IS NULL OR claimed_at < ?) AND created_at > ?
          ORDER BY created_at LIMIT 10)
        RETURNING id, to_address, subject, text_body, html_body`
    ).bind(agora, agora - 12e4, agora - 30 * 6e4).all();
    return json11(200, results.map((r) => ({ id: r.id, to: r.to_address, subject: r.subject, text: r.text_body, html: r.html_body })));
  }
  const m = path.match(/^\/api\/mobile\/v1\/internal\/outbox\/([0-9a-f-]{36})\/(enviado|falhou)$/);
  if (m && request.method === "POST") {
    if (m[2] === "enviado") await env.MOBILE_DB.prepare("DELETE FROM mobile_email_outbox WHERE id = ?").bind(m[1]).run();
    else await env.MOBILE_DB.prepare("UPDATE mobile_email_outbox SET claimed_at = NULL WHERE id = ?").bind(m[1]).run();
    return json11(200, { ok: true });
  }
  return json11(404, { erro: "Rota desconhecida." });
}
__name(handleMobileOutbox, "handleMobileOutbox");

// src/index.ts
var json12 = /* @__PURE__ */ __name((status, body2) => new Response(JSON.stringify(body2), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } }), "json");
function autorizado2(req, env) {
  const recebido = req.headers.get("x-sync-key") ?? "";
  const esperado = env.SYNC_KEY ?? "";
  if (!esperado || recebido.length !== esperado.length) return false;
  let dif = 0;
  for (let i = 0; i < esperado.length; i++) dif |= recebido.charCodeAt(i) ^ esperado.charCodeAt(i);
  return dif === 0;
}
__name(autorizado2, "autorizado");
async function excedeuLimite(ip, tipo = "cadastro") {
  const cache2 = caches.default;
  const chave = new Request(`https://limite.cadastro/${tipo}/${encodeURIComponent(ip)}`);
  const atual = Number(await (await cache2.match(chave))?.text() ?? 0);
  if (atual >= 6) return true;
  await cache2.put(chave, new Response(String(atual + 1), { headers: { "cache-control": "max-age=600" } }));
  return false;
}
__name(excedeuLimite, "excedeuLimite");
async function receber2(req, env) {
  let corpo;
  try {
    corpo = await req.json();
  } catch {
    return json12(400, { erro: "Envio inv\xE1lido." });
  }
  if (String(corpo.site ?? "") !== "") return json12(200, { ok: true });
  const aberto = Number(corpo.t ?? 0);
  if (!aberto || Date.now() - aberto < 4e3) return json12(400, { erro: "Confira os dados e envie de novo." });
  if (await excedeuLimite(req.headers.get("cf-connecting-ip") ?? "x")) return json12(429, { erro: "Muitos envios seguidos. Aguarde alguns minutos." });
  const v = validar(corpo);
  if (!v.ok) return json12(400, { erro: v.erro });
  const falta = faltaNoCadastro(v.dados);
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
  await env.PRE.put(`pendentes/${chave}.json`, JSON.stringify(registro), { httpMetadata: { contentType: "application/json" } });
  return json12(201, { ok: true, nome: v.dados.nome.split(" ")[0], ...grupo ? { grupo: { responsavel: grupo.responsavel, bateria: grupo.bateria, inicio: grupo.inicio } } : {}, ...pagamento ? { pagamento } : {} });
}
// todos os campos do totem são obrigatórios (só CEP e complemento ficam opcionais)
function faltaNoCadastro(d) {
  if (!d.email) return "Informe seu e-mail.";
  if (!(Number(d.peso) >= 20 && Number(d.peso) <= 250)) return "Informe seu peso em kg (entre 20 e 250).";
  if (!d.endereco) return "Informe a rua do seu endere\xE7o.";
  if (!d.numero) return "Informe o n\xFAmero do endere\xE7o.";
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
  const k = `grupo-pag/${token}/${chave}.json`;
  const antiga = await env.PRE.get(k);
  if (antiga) {
    const a = await antiga.json();
    try {
      const s = await consultar(env, a.id);
      if (PAGO.has(s.status)) return { ...a, pago: true };
      if (s.status === "PENDING" && Number(a.valorCentavos) === Number(g.precoCentavos)) return { ...a, pago: false };
    } catch {}
  }
  const dados = { nome: d.nome, cpf: digitos(d.documento), email: d.email, celular: digitos(d.telefone), referencia: `grupo-${g.codigo}` };
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
      dueDate: /^\d{4}-\d{2}-\d{2}$/.test(dia) && dia >= hoje ? dia : hoje,
      description: `Kart\xF3dromo de Betim \xB7 ${g.bateria} ${dia.split("-").reverse().join("/")} ${String(g.inicio).slice(11, 16)} \xB7 ${d.nome} \xB7 grupo do(a) ${g.responsavel}`.slice(0, 500),
      externalReference: `grupo-${g.codigo}-${chave}`.slice(0, 100)
    })
  });
  const r = { id: cob.id, link: cob.invoiceUrl, valorCentavos: Number(g.precoCentavos), pago: false };
  await env.PRE.put(k, JSON.stringify(r), { httpMetadata: { contentType: "application/json" } });
  return r;
}
__name(cobrancaDoLink, "cobrancaDoLink");
var PAGINA_CADASTRO = "<!doctype html>\n<html lang=\"pt-BR\">\n<head>\n<meta charset=\"utf-8\">\n<meta name=\"viewport\" content=\"width=device-width, initial-scale=1, viewport-fit=cover\">\n<title>Pré-cadastro · Kartódromo Internacional de Betim</title>\n<meta name=\"description\" content=\"Faça seu cadastro antes de chegar. No kartódromo é só digitar o CPF no totem.\">\n<meta name=\"theme-color\" content=\"#030504\">\n<link rel=\"preconnect\" href=\"https://fonts.googleapis.com\"><link rel=\"preconnect\" href=\"https://fonts.gstatic.com\" crossorigin>\n<link rel=\"stylesheet\" href=\"https://fonts.googleapis.com/css2?family=Anton&family=Rajdhani:wght@500;600;700&display=swap\">\n<link rel=\"icon\" href=\"/icone.png\">\n<style>\n  /* Tokens da marca (os mesmos do site e da reserva online): fundo preto, verde neon, Anton nos títulos. */\n  :root {\n    color-scheme: dark;\n    --fundo: #030504; --fundo-2: #070b08; --cartao: #0b100c; --cartao-2: #111712;\n    --linha: rgba(255,255,255,.12); --linha-forte: rgba(255,255,255,.24);\n    --texto: #f7faf6; --suave: #a8b2aa; --apagado: #6b746d;\n    --verde: #00e676; --verde-fundo: rgba(0,230,118,.10); --tinta: #03140b;\n    --erro: #ff7a6b; --erro-fundo: rgba(255,122,107,.12);\n    --titulo: 'Anton', Impact, 'Arial Narrow', sans-serif; --corpo: 'Rajdhani', 'Segoe UI', Roboto, Arial, sans-serif;\n    --raio: 4px; --foco: 0 0 0 2px var(--fundo), 0 0 0 4px var(--verde);\n    --chanfro: polygon(5% 0, 100% 0, 95% 100%, 0 100%);\n  }\n  * { box-sizing: border-box; font-synthesis-weight: none; }\n  html, body { margin: 0; background: var(--fundo); color: var(--texto); font: 500 17px/1.5 var(--corpo); -webkit-text-size-adjust: 100%; -webkit-font-smoothing: antialiased; }\n  :focus-visible { outline: none; box-shadow: var(--foco); }\n  @media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: .01ms !important; transition-duration: .01ms !important; } }\n  .topo { background: radial-gradient(120% 90% at 50% 0%, rgba(0,230,118,.16) 0%, rgba(0,230,118,0) 60%), var(--fundo-2); border-bottom: 1px solid var(--linha); color: var(--texto); padding: 26px 18px 70px; }\n  .topo .logo { display: block; width: min(300px, 76vw); height: auto; margin: 0 auto 20px; }\n  .topo h1 { font: 400 clamp(30px, 8.4vw, 50px)/1 var(--titulo); text-transform: uppercase; margin: 0 auto 10px; max-width: 640px; text-align: center; text-wrap: balance; }\n  .topo h1 em { font-style: normal; color: var(--verde); }\n  .topo p { margin: 0 auto; max-width: 560px; text-align: center; color: var(--suave); font-size: 17px; text-wrap: balance; }\n  .passos { display: flex; justify-content: center; gap: 8px; margin: 18px auto 0; flex-wrap: wrap; max-width: 640px; }\n  .passos span { font: 400 13px/1 var(--titulo); text-transform: uppercase; letter-spacing: .06em; color: var(--texto); }\n  .passos span + span::before { content: \"›\"; margin: 0 10px 0 2px; color: var(--verde); }\n  main { max-width: 680px; margin: -46px auto 0; padding: 0 14px 44px; }\n  .cartao { background: linear-gradient(180deg, var(--cartao-2), var(--cartao)); border: 1px solid var(--linha); border-radius: var(--raio); padding: 22px 18px; margin-bottom: 14px; }\n  .cartao h2 { font: 400 20px/1.05 var(--titulo); text-transform: uppercase; letter-spacing: .02em; margin: 0 0 4px; display: flex; align-items: center; gap: 12px; }\n  .cartao h2 .op { font-family: var(--corpo); text-transform: none; font-size: 15px; color: var(--apagado); letter-spacing: 0; }\n  .cartao h2 .n { width: 28px; height: 28px; background: var(--verde); color: var(--tinta); font: 400 15px/1 var(--titulo); display: inline-flex; align-items: center; justify-content: center; flex: none; clip-path: var(--chanfro); }\n  .cartao .sub { color: var(--suave); font-size: 15.5px; margin: 0 0 16px 40px; }\n  .grade { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 14px 12px; }\n  .grade > div { min-width: 0; }\n  .c6 { grid-column: span 6; } .c4 { grid-column: span 4; } .c3 { grid-column: span 3; } .c2 { grid-column: span 2; }\n  @media (max-width: 520px) { .c3, .c4 { grid-column: span 6; } .c2 { grid-column: span 3; } }\n  label { display: block; font: 400 13px/1.2 var(--titulo); text-transform: uppercase; letter-spacing: .06em; color: var(--suave); margin: 0 0 7px; }\n  label .op { font-family: var(--corpo); text-transform: none; letter-spacing: 0; font-weight: 500; color: var(--apagado); }\n  input, select { width: 100%; min-width: 0; height: 50px; border: 1px solid var(--linha-forte); border-radius: var(--raio); padding: 0 14px; font: 500 17px var(--corpo); color: var(--texto); background: var(--fundo); outline: none; transition: border-color .15s, box-shadow .15s; -webkit-appearance: none; appearance: none; }\n  input::placeholder { color: var(--apagado); }\n  input:focus, select:focus { border-color: var(--verde); box-shadow: 0 0 0 3px rgba(0,230,118,.18); }\n  input.invalido { border-color: var(--erro); box-shadow: 0 0 0 3px rgba(255,122,107,.16); }\n  .seg { display: flex; border: 1px solid var(--linha-forte); border-radius: var(--raio); padding: 4px; gap: 4px; background: var(--fundo); }\n  .seg button { flex: 1; min-height: 42px; border: 0; border-radius: 2px; background: transparent; font: 400 15px/1 var(--titulo); text-transform: uppercase; letter-spacing: .05em; color: var(--suave); cursor: pointer; }\n  .seg button.sel { background: var(--verde); color: var(--tinta); }\n  .menor { border: 1px solid var(--linha); border-radius: var(--raio); padding: 14px; margin-bottom: 10px; position: relative; background: var(--fundo); }\n  .menor .tirar { position: absolute; top: 4px; right: 4px; width: 44px; height: 44px; border: 0; background: none; color: var(--suave); font-size: 24px; line-height: 1; cursor: pointer; }\n  .btn2 { width: 100%; min-height: 50px; border: 1px dashed var(--linha-forte); border-radius: var(--raio); background: transparent; font: 400 15px/1 var(--titulo); text-transform: uppercase; letter-spacing: .05em; color: var(--verde); cursor: pointer; }\n  .termo { display: flex; gap: 12px; align-items: flex-start; font: 500 16px/1.45 var(--corpo); text-transform: none; letter-spacing: 0; color: var(--texto); }\n  .termo input { width: 24px; height: 24px; flex: none; margin: 1px 0 0; accent-color: var(--verde); -webkit-appearance: checkbox; appearance: auto; }\n  details { margin-top: 10px; background: var(--fundo); border: 1px solid var(--linha); border-radius: var(--raio); padding: 11px 14px; font-size: 15.5px; color: var(--suave); }\n  summary { cursor: pointer; font: 400 14px/1.3 var(--titulo); text-transform: uppercase; letter-spacing: .05em; color: var(--verde); }\n  .enviar { width: 100%; min-height: 60px; border: 0; background: var(--verde); color: var(--tinta); font: 400 20px/1.1 var(--titulo); text-transform: uppercase; letter-spacing: .04em; cursor: pointer; padding: 12px 34px; clip-path: var(--chanfro); }\n  .enviar:hover:not(:disabled) { background: #33ff99; }\n  .enviar:disabled { background: #1b3a29; color: #7fa68f; }\n  .erro { display: none; background: var(--erro-fundo); border: 1px solid rgba(255,122,107,.4); color: var(--erro); border-radius: var(--raio); padding: 12px 14px; margin-bottom: 14px; font-weight: 600; }\n  .rodape { text-align: center; color: var(--apagado); font-size: 14.5px; margin-top: 18px; }\n  .oculto { position: absolute; left: -9999px; width: 1px; height: 1px; overflow: hidden; }\n  #pronto { display: none; text-align: center; padding: 34px 20px 28px; }\n  #pronto .ok { width: 84px; height: 84px; border-radius: 50%; margin: 0 auto 16px; background: var(--verde-fundo); border: 1px solid rgba(0,230,118,.4); display: flex; align-items: center; justify-content: center; }\n  #pronto .ok svg { stroke: var(--verde); }\n  #pronto h2 { font: 400 32px/1.05 var(--titulo); margin: 0 0 8px; justify-content: center; }\n  #pronto p { color: var(--suave); margin: 0 auto 8px; max-width: 460px; }\n  .totem { margin: 18px auto 0; max-width: 440px; text-align: left; background: var(--fundo); border: 1px solid var(--linha); border-radius: var(--raio); padding: 16px 18px; color: var(--suave); }\n  .totem b { color: var(--verde); }\n  .grupo { border-color: var(--verde); background: var(--verde-fundo); }\n  .grupo h2 { margin: 0 0 6px; font-family: var(--titulo); font-weight: 400; letter-spacing: .02em; font-size: 26px; line-height: 1.15; }\n  .grupo p { margin: 0; color: var(--suave); }\n  .grupo b, .pagar b { color: var(--verde); }\n  .pagar { margin: 14px 0 18px; padding: 16px 18px; border: 1px solid var(--verde); border-radius: var(--raio); background: var(--verde-fundo); text-align: left; }\n  .pagar p { margin: 0 0 10px; }\n  .pagar .valor { font-family: var(--titulo); font-size: 34px; color: var(--texto); line-height: 1.1; }\n  .pagar a.botao { display: block; text-align: center; padding: 14px 18px; background: var(--verde); color: var(--tinta); font-weight: 700; font-size: 19px; text-decoration: none; border-radius: var(--raio); }\n  .pagar .estado { margin: 10px 0 0; font-size: 15px; color: var(--suave); }\n</style>\n</head>\n<body>\n<header class=\"topo\">\n  <img class=\"logo\" src=\"/kib-logo-escuro.png\" alt=\"Kartódromo Internacional de Betim\" width=\"720\" height=\"200\">\n  <h1>Faça seu cadastro <em>antes de chegar</em></h1>\n  <p>Preencha uma vez aqui. No kartódromo, é só digitar seu CPF no totem de autoatendimento e escolher a bateria.</p>\n  <div class=\"passos\"><span>1 · Cadastro aqui</span><span>2 · CPF no totem</span><span>3 · Pista!</span></div>\n</header>\n\n<main>\n  <section class=\"cartao grupo\" id=\"grupoFaixa\" hidden aria-live=\"polite\"></section>\n  <form id=\"form\" novalidate autocomplete=\"on\">\n    <div class=\"erro\" id=\"erro\" role=\"alert\"></div>\n\n    <section class=\"cartao\">\n      <h2><span class=\"n\">1</span>Documento</h2>\n      <p class=\"sub\">É com ele que o totem encontra seu cadastro.</p>\n      <div class=\"grade\">\n        <div class=\"c6\"><div class=\"seg\" id=\"tipoDoc\">\n          <button type=\"button\" class=\"sel\" data-v=\"CPF\">CPF</button><button type=\"button\" data-v=\"RG\">RG</button><button type=\"button\" data-v=\"Passaporte\">Passaporte</button>\n        </div></div>\n        <div class=\"c6\"><label for=\"documento\" id=\"rotDoc\">CPF</label><input id=\"documento\" name=\"documento\" inputmode=\"numeric\" autocomplete=\"off\" placeholder=\"000.000.000-00\" required></div>\n        <div class=\"c6\"><label for=\"nome\">Nome completo</label><input id=\"nome\" name=\"name\" autocomplete=\"name\" autocapitalize=\"words\" placeholder=\"Como no documento\" required></div>\n      </div>\n    </section>\n\n    <section class=\"cartao\">\n      <h2><span class=\"n\">2</span>Contato</h2>\n      <p class=\"sub\">Para avisos da reserva. O resultado com seus tempos chega no e-mail.</p>\n      <div class=\"grade\">\n        <div class=\"c3\"><label for=\"telefone\">Celular (WhatsApp)</label><input id=\"telefone\" name=\"tel\" type=\"tel\" inputmode=\"tel\" autocomplete=\"tel-national\" placeholder=\"(31) 90000-0000\" required></div>\n        <div class=\"c3\"><label for=\"email\">E-mail <span class=\"op\">(recebe o resultado da corrida)</span></label><input id=\"email\" name=\"email\" type=\"email\" inputmode=\"email\" autocomplete=\"email\" placeholder=\"voce@email.com\"></div>\n        <div class=\"c6\"><label for=\"instagram\">Instagram <span class=\"op\">(sai junto com seu nome no resultado da bateria)</span></label><input id=\"instagram\" name=\"instagram\" autocomplete=\"off\" autocapitalize=\"none\" spellcheck=\"false\" placeholder=\"@seuusuario\" maxlength=\"80\" required></div>\n      </div>\n    </section>\n\n    <section class=\"cartao\">\n      <h2><span class=\"n\">3</span>Sobre você</h2>\n      <p class=\"sub\">O peso ajuda a equilibrar os karts.</p>\n      <div class=\"grade\">\n        <div class=\"c3\"><label for=\"nascimento\">Data de nascimento</label><input id=\"nascimento\" inputmode=\"numeric\" autocomplete=\"bday\" placeholder=\"DD/MM/AAAA\" required></div>\n        <div class=\"c3\"><label for=\"peso\">Peso (kg) <span class=\"op\">(equilibra os karts)</span></label><input id=\"peso\" inputmode=\"decimal\" placeholder=\"Ex.: 72\"></div>\n      </div>\n    </section>\n\n    <section class=\"cartao\">\n      <h2><span class=\"n\">4</span>Endereço</h2>\n      <p class=\"sub\">Digite o CEP e o resto se preenche sozinho.</p>\n      <div class=\"grade\">\n        <div class=\"c2\"><label for=\"cep\">CEP</label><input id=\"cep\" inputmode=\"numeric\" autocomplete=\"postal-code\" placeholder=\"00000-000\"></div>\n        <div class=\"c4\"><label for=\"endereco\">Rua</label><input id=\"endereco\" autocomplete=\"address-line1\"></div>\n        <div class=\"c2\"><label for=\"numero\">Número</label><input id=\"numero\" inputmode=\"numeric\"></div>\n        <div class=\"c4\"><label for=\"complemento\">Complemento <span class=\"op\">(opcional)</span></label><input id=\"complemento\" autocomplete=\"address-line2\"></div>\n        <div class=\"c3\"><label for=\"bairro\">Bairro</label><input id=\"bairro\"></div>\n        <div class=\"c2\"><label for=\"cidade\">Cidade</label><input id=\"cidade\" autocomplete=\"address-level2\"></div>\n        <div class=\"c1\" style=\"grid-column: span 1\"><label for=\"estado\">UF</label><input id=\"estado\" maxlength=\"2\" autocapitalize=\"characters\" autocomplete=\"address-level1\"></div>\n      </div>\n    </section>\n\n    <section class=\"cartao\">\n      <h2><span class=\"n\">5</span>Menores que vão correr com você</h2>\n      <p class=\"sub\">Opcional. Filhos ou menores sob sua responsabilidade.</p>\n      <div id=\"menores\"></div>\n      <button type=\"button\" class=\"btn2\" id=\"addMenor\">+ Adicionar menor</button>\n    </section>\n\n    <section class=\"cartao\">\n      <label class=\"termo\"><input type=\"checkbox\" id=\"lgpd\"><span>Li e concordo com o Termo de Consentimento para Tratamento de Dados Pessoais.</span></label>\n      <details><summary>Ler o termo</summary>\n        <p>Ao se cadastrar, você autoriza o Kartódromo Internacional de Betim a tratar seus dados pessoais (nome, documento, contato, data de nascimento, peso e endereço) para identificar você nas baterias e corridas, emitir o termo de responsabilidade, registrar tempos e resultados, cumprir obrigações legais e entrar em contato sobre suas reservas.</p>\n        <p>Os dados ficam armazenados nos sistemas do kartódromo e não são vendidos a terceiros. Você pode pedir a qualquer momento, na recepção, acesso, correção ou exclusão dos seus dados, nos termos da Lei nº 13.709/2018 (LGPD).</p>\n      </details>\n      <div class=\"oculto\" aria-hidden=\"true\"><label>Site<input id=\"site\" tabindex=\"-1\" autocomplete=\"off\"></label></div>\n    </section>\n\n    <button class=\"enviar\" id=\"enviar\" type=\"submit\">Concluir pré-cadastro</button>\n    <p class=\"rodape\">O termo de responsabilidade é assinado no kartódromo, no dia da corrida.</p>\n  </form>\n\n  <section class=\"cartao\" id=\"pronto\" aria-live=\"polite\">\n    <div class=\"ok\"><svg width=\"44\" height=\"44\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#00e676\" stroke-width=\"2.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M20 6 9 17l-5-5\"/></svg></div>\n    <h2 id=\"prontoTitulo\">Tudo certo!</h2>\n    <div class=\"pagar\" id=\"pagarCaixa\" hidden></div>\n    <p>Seu pré-cadastro foi recebido.</p>\n    <div class=\"totem\">\n      <p style=\"margin:0 0 6px\"><b>Quando chegar ao kartódromo:</b></p>\n      <p style=\"margin:0\">1. Vá ao totem de autoatendimento.<br>2. Digite seu <b id=\"prontoDoc\">CPF</b> (ou e-mail).<br>3. Confira seus dados e escolha a bateria.</p>\n    </div>\n  </section>\n</main>\n\n<script>\n(() => {\n  const $ = (id) => document.getElementById(id);\n  const aberto = Date.now();\n  let tipo = 'CPF';\n  const reserva = /^[A-Za-z0-9]{10,24}$/.test(new URLSearchParams(location.search).get('r') || '') ? new URLSearchParams(location.search).get('r') : '';\n  const brl = (c) => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });\n  const quando = (s) => { const d = new Date(String(s).slice(0, 16) + ':00-03:00'); return isNaN(d) ? '' : d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' }) + ' às ' + String(s).slice(11, 16); };\n  let grupo = null;\n  if (reserva) fetch('/api/grupo?r=' + reserva).then((r) => r.ok ? r.json() : null).then((g) => {\n    if (!g || !g.responsavel) return;\n    grupo = g;\n    const f = $('grupoFaixa');\n    const paga = g.modo === 'individual' && g.precoCentavos > 0;\n    f.innerHTML = '<h2>Grupo do(a) ' + g.responsavel.replace(/[<>&]/g, '') + '</h2><p>' + (g.bateria || 'Bateria').replace(/[<>&]/g, '') + ' · ' + quando(g.inicio) + '. ' +\n      (g.livres > 0 ? (paga ? 'Preencha seu cadastro completo e, no final, pague a sua vaga (<b>' + brl(g.precoCentavos) + '</b>) por Pix ou cartão.' : 'Preencha seu cadastro completo: sua vaga no grupo já fica no seu nome.')\n        : 'Todas as vagas do grupo já têm dono. Faça o cadastro e fale com quem reservou.') + '</p>';\n    f.hidden = false;\n  }).catch(() => {});\n  const dig = (v) => v.replace(/\\D/g, '');\n  const mascaras = {\n    CPF: (v) => dig(v).slice(0, 11).replace(/(\\d{3})(\\d)/, '$1.$2').replace(/(\\d{3})(\\d)/, '$1.$2').replace(/(\\d{3})(\\d{1,2})$/, '$1-$2'),\n    fone: (v) => { const d = dig(v).slice(0, 11); return d.length <= 2 ? d.replace(/^(\\d{1,2})/, '($1') : d.length <= 6 ? d.replace(/^(\\d{2})(\\d+)/, '($1) $2') : d.length <= 10 ? d.replace(/^(\\d{2})(\\d{4})(\\d+)/, '($1) $2-$3') : d.replace(/^(\\d{2})(\\d{5})(\\d+)/, '($1) $2-$3'); },\n    data: (v) => dig(v).slice(0, 8).replace(/(\\d{2})(\\d)/, '$1/$2').replace(/(\\d{2})(\\d)/, '$1/$2'),\n    cep: (v) => dig(v).slice(0, 8).replace(/(\\d{5})(\\d)/, '$1-$2'),\n  };\n  const mascarar = (el, f) => el.addEventListener('input', () => { el.value = f(el.value); el.classList.remove('invalido'); });\n\n  // tipo de documento\n  $('tipoDoc').addEventListener('click', (e) => {\n    const b = e.target.closest('button'); if (!b) return;\n    tipo = b.dataset.v;\n    for (const x of $('tipoDoc').children) x.classList.toggle('sel', x === b);\n    $('rotDoc').textContent = tipo === 'Passaporte' ? 'Número do passaporte' : tipo;\n    const d = $('documento');\n    d.inputMode = tipo === 'CPF' ? 'numeric' : 'text';\n    d.placeholder = tipo === 'CPF' ? '000.000.000-00' : tipo === 'RG' ? 'MG-12.345.678' : 'AB123456';\n    d.value = tipo === 'CPF' ? mascaras.CPF(d.value) : d.value;\n    $('prontoDoc').textContent = tipo === 'Passaporte' ? 'passaporte' : tipo;\n  });\n  $('documento').addEventListener('input', (e) => { if (tipo === 'CPF') e.target.value = mascaras.CPF(e.target.value); e.target.classList.remove('invalido'); });\n  mascarar($('telefone'), mascaras.fone);\n  mascarar($('nascimento'), mascaras.data);\n  mascarar($('cep'), mascaras.cep);\n  $('peso').addEventListener('input', (e) => { e.target.value = e.target.value.replace(/[^\\d.,]/g, '').slice(0, 5); });\n  $('estado').addEventListener('input', (e) => { e.target.value = e.target.value.replace(/[^a-zA-Z]/g, '').toUpperCase(); });\n\n  // CEP → endereço (ViaCEP)\n  $('cep').addEventListener('input', async (e) => {\n    const c = dig(e.target.value); if (c.length !== 8) return;\n    try {\n      const r = await (await fetch(`https://viacep.com.br/ws/${c}/json/`)).json();\n      if (r.erro) return;\n      if (!$('endereco').value) $('endereco').value = r.logradouro || '';\n      if (!$('bairro').value) $('bairro').value = r.bairro || '';\n      $('cidade').value = r.localidade || $('cidade').value;\n      $('estado').value = r.uf || $('estado').value;\n      $('numero').focus();\n    } catch {}\n  });\n\n  // menores\n  const addMenor = () => {\n    const d = document.createElement('div');\n    d.className = 'menor';\n    d.innerHTML = `<button type=\"button\" class=\"tirar\" aria-label=\"Remover\">×</button>\n      <div class=\"grade\"><div class=\"c6\"><label>Nome completo do menor</label><input class=\"mNome\" autocapitalize=\"words\"></div>\n      <div class=\"c3\"><label>Data de nascimento</label><input class=\"mNasc\" inputmode=\"numeric\" placeholder=\"DD/MM/AAAA\"></div>\n      <div class=\"c3\"><label>Documento <span class=\"op\">(opcional)</span></label><input class=\"mDoc\"></div></div>`;\n    mascarar(d.querySelector('.mNasc'), mascaras.data);\n    d.querySelector('.tirar').onclick = () => d.remove();\n    $('menores').appendChild(d);\n    d.querySelector('.mNome').focus();\n  };\n  $('addMenor').onclick = addMenor;\n\n  const iso = (dmy) => { const m = /^(\\d{2})\\/(\\d{2})\\/(\\d{4})$/.exec(dmy.trim()); return m ? `${m[3]}-${m[2]}-${m[1]}` : ''; };\n  const erro = (msg, campo) => {\n    const e = $('erro'); e.textContent = msg; e.style.display = 'block';\n    if (campo) { campo.classList.add('invalido'); campo.focus({ preventScroll: true }); campo.scrollIntoView({ behavior: 'smooth', block: 'center' }); }\n    else e.scrollIntoView({ behavior: 'smooth', block: 'center' });\n  };\n  const cpfOk = (v) => { const d = dig(v); if (d.length !== 11 || /^(\\d)\\1{10}$/.test(d)) return false; for (const t of [9, 10]) { let s = 0; for (let i = 0; i < t; i++) s += +d[i] * (t + 1 - i); if (((s * 10) % 11) % 10 !== +d[t]) return false; } return true; };\n\n  function mostrarPagamento(pg, g) {\n    const c = $('pagarCaixa');\n    const quem = g && g.responsavel ? ' no grupo do(a) <b>' + g.responsavel.replace(/[<>&]/g, '') + '</b>' : '';\n    if (pg.pago) { c.innerHTML = '<p><b>Pagamento confirmado!</b> Sua vaga' + quem + ' está garantida.</p>'; c.hidden = false; return; }\n    c.innerHTML = '<p>Falta pagar a sua vaga' + quem + ':</p><p class=\"valor\">' + brl(pg.valorCentavos) + '</p>' +\n      '<a class=\"botao\" href=\"' + encodeURI(pg.link) + '\" target=\"_blank\" rel=\"noopener\">Pagar agora · Pix ou cartão</a>' +\n      '<p class=\"estado\" id=\"pagarEstado\">Depois de pagar, esta tela confirma sozinha.</p>';\n    c.hidden = false;\n    const t = setInterval(async () => {\n      try {\n        const s = await (await fetch('/api/grupo/pagamento?id=' + encodeURIComponent(pg.id))).json();\n        if (s.pago) { clearInterval(t); c.innerHTML = '<p><b>Pagamento confirmado!</b> Sua vaga' + quem + ' está garantida. No kartódromo, é só digitar seu CPF no totem.</p>'; }\n      } catch {}\n    }, 6000);\n  }\n\n  $('form').addEventListener('submit', async (ev) => {\n    ev.preventDefault();\n    $('erro').style.display = 'none';\n    const doc = $('documento'), nome = $('nome'), fone = $('telefone'), nasc = $('nascimento'), email = $('email'), insta = $('instagram');\n    if (!doc.value.trim()) return erro(`Informe o ${tipo === 'Passaporte' ? 'passaporte' : tipo}.`, doc);\n    if (tipo === 'CPF' && !cpfOk(doc.value)) return erro('CPF inválido. Confira os números.', doc);\n    if (nome.value.trim().split(/\\s+/).length < 2) return erro('Informe o nome completo.', nome);\n    if (dig(fone.value).length < 10) return erro('Informe o celular com DDD.', fone);\n    if (email.value && !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}$/.test(email.value.trim())) return erro('E-mail inválido.', email);\n    const ig = insta.value.trim().replace(/^(?:https?:\\/\\/)?(?:www\\.)?instagram\\.com\\//i, '').replace(/[\\/?#].*$/, '').replace(/^@/, '').toLowerCase();\n    if (!ig) return erro('Informe seu Instagram (o @usuário).', insta);\n    if (!/^[a-z0-9_](?:[a-z0-9_.]{0,28}[a-z0-9_])?$/.test(ig) || ig.includes('..')) return erro('Instagram inválido. Informe o @usuário (ex.: @andre.silva).', insta);\n    if (!iso(nasc.value)) return erro('Informe a data de nascimento (DD/MM/AAAA).', nasc);\n    if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}$/.test(email.value.trim())) return erro('Informe seu e-mail.', email);\n    const kg = Number($('peso').value.replace(',', '.'));\n    if (!(kg >= 20 && kg <= 250)) return erro('Informe seu peso em kg (entre 20 e 250).', $('peso'));\n    if (!$('endereco').value.trim()) return erro('Informe a rua do seu endereço.', $('endereco'));\n    if (!$('numero').value.trim()) return erro('Informe o número do endereço.', $('numero'));\n    if (!$('bairro').value.trim()) return erro('Informe o bairro.', $('bairro'));\n    if (!$('cidade').value.trim()) return erro('Informe a cidade.', $('cidade'));\n    if (reserva && grupo && grupo.modo === 'individual' && tipo !== 'CPF') return erro('Para pagar a vaga pelo link do grupo, use o CPF.', doc);\n    const menores = [...document.querySelectorAll('.menor')].map((m) => ({ nome: m.querySelector('.mNome').value, nascimento: iso(m.querySelector('.mNasc').value), documento: m.querySelector('.mDoc').value, el: m }))\n      .filter((m) => m.nome.trim() || m.nascimento);\n    for (const m of menores) {\n      if (m.nome.trim().split(/\\s+/).length < 2) return erro('Informe o nome completo de cada menor.', m.el.querySelector('.mNome'));\n      if (!m.nascimento) return erro(`Informe a data de nascimento de ${m.nome.trim()} (DD/MM/AAAA).`, m.el.querySelector('.mNasc'));\n    }\n    if (!$('lgpd').checked) return erro('Para continuar, aceite o Termo de Consentimento para Tratamento de Dados Pessoais.', null);\n\n    const btn = $('enviar'); btn.disabled = true; btn.textContent = 'Enviando…';\n    try {\n      const r = await fetch('/api/pre-cadastro', {\n        method: 'POST', headers: { 'content-type': 'application/json' },\n        body: JSON.stringify({\n          tipoDocumento: tipo, documento: doc.value, nome: nome.value, email: email.value, instagram: insta.value, telefone: fone.value, nascimento: iso(nasc.value),\n          peso: $('peso').value, cep: $('cep').value, endereco: $('endereco').value, numero: $('numero').value, complemento: $('complemento').value,\n          bairro: $('bairro').value, cidade: $('cidade').value, estado: $('estado').value,\n          menores: menores.map(({ el, ...m }) => m), lgpd: true, reserva, site: $('site').value, t: aberto,\n        }),\n      });\n      const j = await r.json().catch(() => ({}));\n      if (!r.ok) throw new Error(j.erro || 'Não foi possível enviar agora. Tente de novo.');\n      $('form').style.display = 'none';\n      $('prontoTitulo').textContent = `Tudo certo, ${j.nome || ''}!`.replace(', !', '!');\n      $('pronto').style.display = 'block';\n      if (j.pagamento) mostrarPagamento(j.pagamento, j.grupo);\n      window.scrollTo({ top: 0, behavior: 'smooth' });\n    } catch (e) {\n      erro(e.message, null);\n    } finally {\n      btn.disabled = false; btn.textContent = 'Concluir pré-cadastro';\n    }\n  });\n})();\n</script>\n\n</body>\n</html>\n";
__name(receber2, "receber");
async function listar(env) {
  const lista = await env.PRE.list({ prefix: "pendentes/", limit: 50 });
  const itens = [];
  for (const o of lista.objects) {
    const obj = await env.PRE.get(o.key);
    if (obj) itens.push({ key: o.key, ...await obj.json() });
  }
  return itens;
}
__name(listar, "listar");
async function buscar(env, q) {
  const termo = q.trim();
  if (termo.length < 5) return null;
  if (!termo.includes("@")) {
    for (const chave of [termo.replace(/\D/g, ""), termo.toUpperCase().replace(/[^A-Z0-9]/g, "")]) {
      if (!chave) continue;
      const obj = await env.PRE.get(`pendentes/${chave}.json`);
      if (obj) return { key: `pendentes/${chave}.json`, ...await obj.json() };
    }
    return null;
  }
  const email = termo.toLowerCase();
  return (await listar(env)).find((i) => String(i.email ?? "") === email) ?? null;
}
__name(buscar, "buscar");
var index_default = {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    const p = url.pathname;
    try {
      if (p === "/api/pre-cadastro" && req.method === "POST") return await receber2(req, env);
      if (p === "/api/grupo" && req.method === "GET") {
        const g = await grupoDoLink(env, String(url.searchParams.get("r") ?? "").replace(/[^A-Za-z0-9]/g, "").slice(0, 24));
        return json12(g ? 200 : 404, g ? { responsavel: g.responsavel, bateria: g.bateria, inicio: g.inicio, modo: g.modo, precoCentavos: g.precoCentavos, livres: g.livres } : { erro: "Reserva n\xE3o encontrada." });
      }
      if (p === "/api/grupo/pagamento" && req.method === "GET") {
        const id = String(url.searchParams.get("id") ?? "");
        if (!/^pay_[A-Za-z0-9]{6,40}$/.test(id)) return json12(400, { erro: "Pagamento inv\xE1lido." });
        const c = await consultar(env, id);
        return json12(200, { pago: PAGO.has(c.status), status: c.status });
      }
      if ((p === "/" || p === "/index.html") && url.hostname.startsWith("cadastro.")) return new Response(PAGINA_CADASTRO, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
      if (p === "/api/mobile/v1/internal/account-email") return await handleMobileAccountEmail(req, env);
      if (p.startsWith("/api/mobile/v1/auth/")) {
        const resposta = await handleMobileAuth(req, env);
        if (p === "/api/mobile/v1/auth/email/verify" && resposta.ok) ctx.waitUntil(pedirVinculo(env));
        return resposta;
      }
      if (p === "/api/mobile/v1/internal/identity-wait") return await esperarPedidoDeVinculo(req, env);
      if (p === "/api/mobile/v1/coupons/preview" || p.startsWith("/api/mobile/v1/coupons/preview/")) {
        return await handleMobileCoupons(req, env);
      }
      if (p === "/api/mobile/v1/internal/results" || p === "/api/mobile/v1/internal/identity-links" || p === "/api/mobile/v1/internal/identity-candidates" || p === "/api/mobile/v1/results" || p === "/api/mobile/v1/results/me") {
        const resposta = await handleMobileResults(req, env);
        if (p === "/api/mobile/v1/results/me" && resposta.ok) {
          const corpo = await resposta.clone().json().catch(() => null);
          if (corpo?.vinculo === "pendente") ctx.waitUntil(pedirVinculo(env));
        }
        return resposta;
      }
      if (p === "/api/mobile/v1/live" || p === "/api/mobile/v1/live/ws") return await handleMobileLive(req, env);
      if (p === "/api/mobile/v1/conta/perfil" || p === "/api/mobile/v1/internal/perfil") return await handleMobilePerfil(req, env);
      if (p === "/api/mobile/v1/internal/ranking" || p === "/api/mobile/v1/ranking" || p.startsWith("/api/mobile/v1/ranking/")) return await handleMobileRanking(req, env);
      if (p === "/api/mobile/v1/internal/outbox" || p.startsWith("/api/mobile/v1/internal/outbox/")) return await handleMobileOutbox(req, env);
      if (p === "/api/mobile/v1/agenda" || p === "/api/mobile/v1/reservations" || p.startsWith("/api/mobile/v1/reservations/")) {
        return await handleMobileReservations(req, env);
      }
      if (p === "/api/agenda" && req.method === "GET") return await agendaPublica(req, env);
      if (p === "/api/reservas" && req.method === "POST") return await criarPedido(req, env, (ip) => excedeuLimite(ip, "reserva"));
      if (p === "/api/reservas/politica" && req.method === "GET") return politicaPublica();
      if (p.startsWith("/api/reservas/") && req.method === "GET") {
        const id = p.slice("/api/reservas/".length);
        if (env.MOBILE_DB) {
          const mobileOrder = await env.MOBILE_DB.prepare("SELECT 1 FROM mobile_orders WHERE pedido_id = ? LIMIT 1").bind(id).first();
          if (mobileOrder) return json12(404, { erro: "Reserva n\xE3o encontrada." });
        }
        return await situacaoPedido(env, id, ctx);
      }
      if (p === "/api/asaas/webhook" && req.method === "POST") return await webhookAsaas(req, env);
      if (p.startsWith("/api/sync/")) {
        if (!autorizado2(req, env)) return json12(401, { erro: "N\xE3o autorizado." });
        if (p === "/api/sync/pendentes" && req.method === "GET") return json12(200, await listar(env));
        if (p === "/api/sync/buscar" && req.method === "GET") return json12(200, await buscar(env, url.searchParams.get("q") ?? ""));
        if (p === "/api/sync/concluir" && req.method === "POST") {
          const { keys } = await req.json();
          const validas = (keys ?? []).filter((k) => /^pendentes\/[A-Z0-9]+\.json$/.test(k));
          if (validas.length) await env.PRE.delete(validas);
          return json12(200, { apagados: validas.length });
        }
        if (p === "/api/sync/agenda" && req.method === "PUT") return await syncAgenda(req, env);
        if (p === "/api/sync/asaas" && req.method === "GET") return json12(200, await diagnostico(env));
        if (p === "/api/sync/campeonato/cobranca" && req.method === "POST") {
          const c = await req.json();
          const dadosCli = {
            nome: String(c.nome ?? ""),
            cpf: String(c.cpf ?? "").replace(/\D/g, ""),
            email: String(c.email ?? ""),
            celular: String(c.celular ?? "").replace(/\D/g, ""),
            referencia: String(c.referencia ?? "")
          };
          let cliente;
          try {
            cliente = await garantirCliente(env, dadosCli);
          } catch (erroCli) {
            if (!/celular|mobilePhone/i.test(erroCli.message)) throw erroCli;
            cliente = await garantirCliente(env, { ...dadosCli, celular: "" });
          }
          const valor = Math.round(Number(c.valorCentavos)) / 100;
          const n = c.forma === "cartao" ? Math.min(5, Math.max(1, Math.trunc(Number(c.parcelas)) || 1)) : 1;
          const cob = await chamar(env, "/payments", {
            method: "POST",
            body: JSON.stringify({
              customer: cliente,
              billingType: c.forma === "cartao" ? "CREDIT_CARD" : "PIX",
              ...n > 1 ? { installmentCount: n, totalValue: valor } : { value: valor },
              dueDate: String(c.vencimento ?? hojeBrasilia()),
              description: String(c.descricao ?? "").slice(0, 500),
              externalReference: String(c.referencia ?? "").slice(0, 100)
            })
          });
          return json12(201, { id: cob.id, link: cob.invoiceUrl, status: cob.status });
        }
        const mCamp = p.match(/^\/api\/sync\/campeonato\/cobranca\/([A-Za-z0-9_]{6,40})$/);
        if (mCamp && req.method === "GET") {
          const c = await consultar(env, mCamp[1]);
          return json12(200, { id: c.id, status: c.status, pago: PAGO.has(c.status), forma: c.billingType });
        }
        if (mCamp && req.method === "DELETE") {
          const c = await chamar(env, `/payments/${encodeURIComponent(mCamp[1])}`);
          if (c.installment) {
            return json12(200, await chamar(env, `/installments/${encodeURIComponent(c.installment)}`, { method: "DELETE" }));
          }
          return json12(200, await cancelar(env, mCamp[1]));
        }
        if (p === "/api/sync/campeonato/cobrancas" && req.method === "GET") {
          const cpf = (url.searchParams.get("cpf") ?? "").replace(/\D/g, "");
          const cli = await chamar(env, `/customers?cpfCnpj=${cpf}&limit=1`);
          const id = cli.data?.[0]?.id;
          if (!id) return json12(200, []);
          const r = await chamar(env, `/payments?customer=${id}&limit=50`);
          return json12(200, (r.data ?? []).map((x) => ({
            id: x.id,
            status: x.status,
            valor: x.value,
            parcelamento: x.installment ?? null,
            deleted: x.deleted,
            ref: x.externalReference ?? null
          })));
        }
        if (p === "/api/sync/cobranca" && req.method === "POST") {
          const c = await req.json();
          const dadosCli = {
            nome: String(c.nome ?? ""),
            cpf: String(c.cpf ?? "").replace(/\D/g, ""),
            email: String(c.email ?? ""),
            celular: String(c.celular ?? "").replace(/\D/g, ""),
            referencia: String(c.referencia ?? "")
          };
          let cliente;
          try {
            cliente = await garantirCliente(env, dadosCli);
          } catch (erroCli) {
            if (!/celular|mobilePhone/i.test(erroCli.message)) throw erroCli;
            cliente = await garantirCliente(env, { ...dadosCli, celular: "" });
          }
          const hoje = hojeBrasilia();
          const venc = String(c.vencimento ?? "");
          const dueDate = /^\d{4}-\d{2}-\d{2}$/.test(venc) && venc >= hoje ? venc : hoje;
          const cob = await chamar(env, "/payments", {
            method: "POST",
            body: JSON.stringify({
              customer: cliente,
              billingType: "UNDEFINED",
              value: Math.round(Number(c.valorCentavos)) / 100,
              dueDate,
              description: String(c.descricao ?? "").slice(0, 500),
              externalReference: String(c.referencia ?? "").slice(0, 100)
            })
          });
          return json12(201, { id: cob.id, link: cob.invoiceUrl, status: cob.status });
        }
        const mGrupo = p.match(/^\/api\/sync\/cobranca\/([A-Za-z0-9_]{6,40})$/);
        if (mGrupo && req.method === "GET") {
          const c = await consultar(env, mGrupo[1]);
          return json12(200, { id: c.id, status: c.status, pago: PAGO.has(c.status), forma: c.billingType });
        }
        if (mGrupo && req.method === "DELETE") {
          return json12(200, await cancelar(env, mGrupo[1]));
        }
        if (p === "/api/sync/mobile/coupons" || p.startsWith("/api/sync/mobile/coupons/")) return await handleMobileCouponsSync(req, env);
        if (p === "/api/sync/pedidos" && req.method === "GET") return await syncPedidos(env);
        // resumo das reservas em grupo ativas (o SRVKART manda a cada minuto): o link do grupo mostra quem reservou e cobra a vaga
        if (p === "/api/sync/grupos" && req.method === "PUT") {
          const { grupos } = await req.json();
          // um arquivo só com todos os grupos (gravar um por link passava de 800 gravações e estourava o tempo)
          const lista = (Array.isArray(grupos) ? grupos.slice(0, 500) : []).filter((g) => Array.isArray(g.tokens));
          await env.PRE.put("grupos/todos.json", JSON.stringify(lista), { httpMetadata: { contentType: "application/json" } });
          cacheGrupos = null;
          return json12(200, { gravados: lista.length });
        }
        if (p === "/api/sync/pedido" && req.method === "POST") return await syncResultado(req, env, ctx);
      }
      if (p.startsWith("/api/")) return json12(404, { erro: "Rota desconhecida." });
      if (p === "/" && url.hostname.startsWith("reservas.")) return env.ASSETS.fetch(new Request(new URL("/reservar", url), req));
      return env.ASSETS.fetch(req);
    } catch (e) {
      console.error("pre-cadastro", e.message);
      return json12(500, { erro: "N\xE3o foi poss\xEDvel salvar agora. Tente de novo em instantes." });
    }
  }
};
export {
  AoVivo,
  SinalVinculo,
  index_default as default
};
//# sourceMappingURL=index.js.map
