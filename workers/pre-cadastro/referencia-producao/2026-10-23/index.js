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
  if (!email) return { ok: false, erro: "Informe seu e-mail (o recibo e o resultado v\xE3o para ele)." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return { ok: false, erro: "E-mail inv\xE1lido." };
  if (digitos(telefone).length < 10) return { ok: false, erro: "Informe o celular com DDD." };
  if (!dataValida(nascimento, hoje)) return { ok: false, erro: "Data de nascimento inv\xE1lida." };
  if (!peso) return { ok: false, erro: "Informe seu peso (kg). Ele \xE9 usado para equilibrar os karts." };
  if (!(Number(peso) >= 20 && Number(peso) <= 250)) return { ok: false, erro: "Peso inv\xE1lido: informe entre 20 e 250 kg." };
  if (estado && !/^[A-Z]{2}$/.test(estado)) return { ok: false, erro: "UF inv\xE1lida." };
  if (!txt(entrada.endereco, 150)) return { ok: false, erro: "Informe o endere\xE7o (rua e n\xFAmero)." };
  if (!txt(entrada.bairro, 80)) return { ok: false, erro: "Informe o bairro." };
  if (!txt(entrada.cidade, 80)) return { ok: false, erro: "Informe a cidade." };
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
    const quem = `do piloto ${n} (${nome})`;
    const email = txt(a?.email, 160).toLowerCase();
    if (!email) return { ok: false, erro: `Informe o e-mail ${quem}.` };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return { ok: false, erro: `E-mail inv\xE1lido ${quem}.` };
    const telefone = txt(a?.telefone, 25);
    if (digitos(telefone).length < 10) return { ok: false, erro: `Informe o celular com DDD ${quem}.` };
    const peso = txt(a?.peso, 6).replace(",", ".");
    if (!peso) return { ok: false, erro: `Informe o peso (kg) ${quem}.` };
    if (!(Number(peso) >= 20 && Number(peso) <= 250)) return { ok: false, erro: `Peso inv\xE1lido ${quem}: informe entre 20 e 250 kg.` };
    const endereco = txt(a?.endereco, 150);
    if (!endereco) return { ok: false, erro: `Informe o endere\xE7o (rua e n\xFAmero) ${quem}.` };
    const bairro = txt(a?.bairro, 80);
    if (!bairro) return { ok: false, erro: `Informe o bairro ${quem}.` };
    const cidade = txt(a?.cidade, 80);
    if (!cidade) return { ok: false, erro: `Informe a cidade ${quem}.` };
    const instagram = String(a?.instagram ?? "").trim();
    if (erroInstagramCliente(instagram)) return { ok: false, erro: `Informe o Instagram ${quem}. Use o @usu\xE1rio (ex.: @andre.silva).` };
    acompanhantes.push({
      nome,
      documento,
      nascimento,
      instagram: normalizarInstagram(instagram),
      email,
      telefone,
      peso,
      cep: digitos(a?.cep).slice(0, 8),
      endereco,
      complemento: txt(a?.complemento, 80),
      bairro,
      cidade
    });
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
  await env.MOBILE_DB.prepare("DELETE FROM mobile_email_outbox WHERE created_at < ?").bind(agora - 36e5).run();
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
  if (env.MOBILE_DB && !(env.RESEND_API_KEY?.trim() && env.RESEND_FROM_EMAIL?.trim())) {
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
    return response.ok;
  } catch {
    return false;
  }
}
__name(sendMobileAuthEmail, "sendMobileAuthEmail");

// src/mobile/auth.ts
var ITERATIONS = 6e5;
var PASSWORD_SCHEME = "scrypt-32768-8-3-v1";
var PASSWORD_MIN = 8;
var PASSWORD_MAX = 128;
var ACCESS_TTL = 15 * 6e4;
var REFRESH_TTL = 30 * 24 * 60 * 6e4;
var RATE_WINDOW = 10 * 6e4;
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
    `SELECT a.email_cipher, a.cpf_cipher, a.phone_cipher FROM mobile_accounts a
      WHERE a.email_verified_at IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM mobile_identity_links l WHERE l.account_id = a.id)
      ORDER BY a.email_verified_at DESC LIMIT ?`
  ).bind(limit).all();
  return Promise.all(results.map(async (row) => ({
    email: await decrypt(context, row.email_cipher),
    cpf: await decrypt(context, row.cpf_cipher),
    phone: await decrypt(context, row.phone_cipher)
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
                phone_cipher, password_salt, password_hash, password_iterations, password_scheme, email_verified_at
         FROM mobile_accounts WHERE email_lookup = ? LIMIT 1`
    ).bind(lookup2).first();
  }
  const lookup = await hmac(context, `cpf:${digitos(identifier)}`);
  return context.db.prepare(
    `SELECT id, name_cipher, email_lookup, email_cipher, cpf_lookup, cpf_cipher,
              phone_cipher, password_salt, password_hash, password_iterations, password_scheme, email_verified_at
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
    "UPDATE mobile_email_tokens SET used_at = ? WHERE account_id = ? AND purpose = ? AND used_at IS NULL"
  ).bind(now, accountId, purpose).run();
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
  if (!delivered) console.error("mobile auth email delivery failed");
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
async function login(request, input, env, context) {
  const identifier = normalizeIdentifier(value(input, "identifier"));
  if (await rateLimited(context, request, "login", identifier)) {
    return json3(429, { erro: "Muitas tentativas. Aguarde alguns minutos." });
  }
  const password = value(input, "password");
  if (password.length < PASSWORD_MIN || password.length > PASSWORD_MAX) return json3(401, { erro: authError });
  const account = await findAccount(context, identifier);
  const salt = account ? decodeBase64Url(account.password_salt) : new Uint8Array(16);
  const candidate = await passwordHash(password, salt, account?.password_scheme ?? PASSWORD_SCHEME);
  const valid = Boolean(account && constantTimeEqual(candidate, account.password_hash));
  if (!valid || !account) return json3(401, { erro: authError });
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
  if (account?.email_verified_at !== null && account) await deliverEmail(env, context, account, "reset");
  return json3(202, { mensagem: genericMessage });
}
__name(forgotPassword, "forgotPassword");
async function resetPassword(input, context) {
  const token = value(input, "token");
  const password = value(input, "password");
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
async function deleteAccount(request, context) {
  const match = /^Bearer\s+(.+)$/i.exec(request.headers.get("authorization") ?? "");
  if (!match?.[1]) return json3(401, { erro: "Voc\xEA precisa estar conectado." });
  const tokenHash = await sha256(match[1]);
  const now = Date.now();
  const session = await context.db.prepare(
    `SELECT account_id FROM mobile_sessions
       WHERE access_token_hash = ? AND revoked_at IS NULL AND access_expires_at > ?
       LIMIT 1`
  ).bind(tokenHash, now).first();
  if (!session) return json3(401, { erro: "Sess\xE3o inv\xE1lida ou expirada." });
  const accountId = session.account_id;
  await context.db.batch([
    context.db.prepare("DELETE FROM mobile_sessions WHERE account_id = ?").bind(accountId),
    context.db.prepare("DELETE FROM mobile_email_tokens WHERE account_id = ?").bind(accountId),
    context.db.prepare("DELETE FROM mobile_coupon_previews WHERE account_id = ?").bind(accountId),
    context.db.prepare("DELETE FROM mobile_identity_links WHERE account_id = ?").bind(accountId),
    context.db.prepare("DELETE FROM mobile_orders WHERE account_id = ?").bind(accountId),
    context.db.prepare("DELETE FROM mobile_accounts WHERE id = ?").bind(accountId)
  ]);
  return new Response(null, {
    status: 204,
    headers: { "cache-control": "no-store" }
  });
}
__name(deleteAccount, "deleteAccount");
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
        return json3(200, { contaApp: Boolean(conta), cadastro: cadastro !== null, email: cadastro || null });
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
        return await deleteAccount(request, context);
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
  if (!/^\d{1,20}$/.test(customerId) || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return invalid();
  const lookup = await emailLookup(env, email);
  if (!lookup) return unavailable3();
  const account = await env.MOBILE_DB.prepare(
    "SELECT id FROM mobile_accounts WHERE email_lookup = ? AND email_verified_at IS NOT NULL LIMIT 1"
  ).bind(lookup).first();
  if (!account) return json6(404, { erro: "N\xE3o foi poss\xEDvel validar o e-mail informado." });
  const now = Date.now();
  await env.MOBILE_DB.batch([
    env.MOBILE_DB.prepare(
      `INSERT OR IGNORE INTO mobile_identity_links(customer_id, account_id, linked_at) VALUES (?, ?, ?)`
    ).bind(customerId, account.id, now),
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
  return json6(200, { ok: true });
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
    mensagem: "Seu hist\xF3rico aparece sozinho quando o documento e o e-mail ou o telefone da sua conta s\xE3o os mesmos do seu cadastro no kart\xF3dromo. Se n\xE3o aparecer em alguns minutos, pe\xE7a para a recep\xE7\xE3o conferir seu cadastro.",
    results: []
  });
  const rows = await env.MOBILE_DB.prepare(
    `SELECT session_id, event_name, event_date, display_name, position, kart, laps, best_lap_ms
     FROM mobile_results WHERE customer_id = ? AND status = 'published'
     ORDER BY event_date DESC, session_id DESC, position LIMIT 500`
  ).bind(link.customer_id).all();
  return json6(200, {
    vinculo: "validado",
    results: rows.results.map((row) => ({
      sessionId: row.session_id,
      eventName: row.event_name,
      eventDate: row.event_date,
      displayName: row.display_name,
      position: Number(row.position),
      kart: row.kart,
      laps: Number(row.laps),
      bestLapMs: row.best_lap_ms == null ? null : Number(row.best_lap_ms)
    }))
  });
}
__name(personalResults, "personalResults");
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
    // hora exata da última passagem, no relógio da cronometragem (versão app=1 do retrato)
    passouEm: typeof d.passouEm === "number" && Number.isFinite(d.passouEm) ? d.passouEm : null
  }));
  return {
    status,
    eventName: texto(r.eventName, 120),
    trackName: texto(r.trackName, 120),
    sessionType: r.sessionType === "race" ? "race" : "qualifying",
    startedAt: typeof r.race?.startedAt === "string" ? r.race.startedAt : null,
    updatedAt: typeof r.updatedAt === "string" ? r.updatedAt : (/* @__PURE__ */ new Date()).toISOString(),
    drivers: status === "empty" ? [] : pilotos
  };
}
__name(retratoParaApp, "retratoParaApp");
async function handleMobileLive(request, env) {
  if (request.method !== "GET") return json7(405, { erro: "M\xE9todo n\xE3o permitido." });
  if (env.AO_VIVO) {
    const objeto = env.AO_VIVO.get(env.AO_VIVO.idFromName("crono"));
    if (request.headers.get("upgrade")?.toLowerCase() === "websocket") return objeto.fetch(request);
    const cache3 = globalThis.caches?.default;
    const chave2 = new Request("https://cache.kartodromo/app/ao-vivo-1s");
    const guardado2 = cache3 ? await cache3.match(chave2) : void 0;
    if (guardado2) return guardado2;
    const r2 = await objeto.fetch("https://ao-vivo/retrato").catch(() => null);
    if (!r2?.ok) return handleMobileLive(request, { CRONO_URL: env.CRONO_URL });
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
  }
  state;
  env;
  static {
    __name(this, "AoVivo");
  }
  retrato = null;
  voltas = /* @__PURE__ */ new Map();
  passou = /* @__PURE__ */ new Map();
  corrida = null;
  fonte = null;
  ultimoUso = 0;
  ultimoDado = 0;
  esperando = [];
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
  difCrono = null;
  medido = 0;
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
    return JSON.stringify({ tipo: "retrato", agora: this.agoraCrono(), ...this.retrato });
  }
};

// src/mobile/perfil.ts
var json8 = /* @__PURE__ */ __name((status, body2) => new Response(JSON.stringify(body2), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } }), "json");
function igual(a, b) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
__name(igual, "igual");
var TEXTO = { telefone: 20, sexo: 1, tipoSanguineo: 3, cep: 12, endereco: 120, numero: 20, complemento: 60, bairro: 60, cidade: 60, estado: 2 };
var SANGUE = /* @__PURE__ */ new Set(["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]);
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
    if (n && (!/^\d{4}-\d{2}-\d{2}$/.test(n) || Number.isNaN(Date.parse(n)) || n < "1920-01-01" || n > (/* @__PURE__ */ new Date()).toISOString().slice(0, 10))) return { ok: false, erro: "Data de nascimento inv\xE1lida." };
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
  if (!env.MOBILE_DB || !env.MOBILE_ADMIN_TOKEN) return json8(503, { erro: "Servi\xE7o temporariamente indispon\xEDvel." });
  const p = new URL(request.url).pathname;
  try {
    await tabela(env);
    if (p === "/api/mobile/v1/internal/perfil") {
      if (!igual(request.headers.get("x-mobile-admin-token") ?? "", env.MOBILE_ADMIN_TOKEN)) return json8(401, { erro: "N\xE3o autorizado." });
      if (request.method === "GET") {
        const r = await env.MOBILE_DB.prepare(
          `SELECT l.customer_id cliente, p.pedido pedido FROM mobile_identity_links l LEFT JOIN mobile_perfil p ON p.cliente = l.customer_id
            WHERE p.pedido IS NOT NULL OR p.publicado_em IS NULL OR p.publicado_em < ?
            ORDER BY (p.pedido IS NULL), p.pedido_em LIMIT 50`
        ).bind(Date.now() - 864e5).all();
        return json8(200, { itens: (r.results ?? []).map((x) => ({ cliente: x.cliente, pedido: x.pedido ? JSON.parse(x.pedido) : null })) });
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
        return json8(200, { ok: true, gravados: stmts.length });
      }
      return json8(405, { erro: "M\xE9todo n\xE3o permitido." });
    }
    const conta = await authenticateMobileRequest(request, env);
    if (!conta) return json8(401, { erro: "Entre na sua conta." });
    const link = await env.MOBILE_DB.prepare("SELECT customer_id FROM mobile_identity_links WHERE account_id = ?").bind(conta.id).first();
    if (!link) return json8(404, { erro: "Sua conta ainda n\xE3o est\xE1 ligada ao seu cadastro no kart\xF3dromo. Isso acontece sozinho em alguns minutos depois do cadastro; se demorar, fale com a recep\xE7\xE3o." });
    const atual = await env.MOBILE_DB.prepare("SELECT perfil, publicado_em, pedido, erro FROM mobile_perfil WHERE cliente = ?").bind(link.customer_id).first();
    if (request.method === "GET") {
      return json8(200, { perfil: atual?.perfil ? JSON.parse(atual.perfil) : null, pendente: atual?.pedido ? JSON.parse(atual.pedido) : null, erro: atual?.erro ?? null, atualizadoEm: atual?.publicado_em ? new Date(atual.publicado_em).toISOString() : null });
    }
    if (request.method === "PUT") {
      const v = validarPerfil(await request.json());
      if (!v.ok) return json8(400, { erro: v.erro });
      const pedido = { ...atual?.pedido ? JSON.parse(atual.pedido) : {}, ...v.dados };
      await env.MOBILE_DB.prepare(`INSERT INTO mobile_perfil(cliente, pedido, pedido_em, erro) VALUES (?, ?, ?, NULL)
        ON CONFLICT(cliente) DO UPDATE SET pedido = excluded.pedido, pedido_em = excluded.pedido_em, erro = NULL`).bind(link.customer_id, JSON.stringify(pedido), Date.now()).run();
      return json8(202, { pendente: pedido, mensagem: "Recebido! Seu cadastro no kart\xF3dromo \xE9 atualizado em at\xE9 1 minuto." });
    }
    return json8(405, { erro: "M\xE9todo n\xE3o permitido." });
  } catch {
    return json8(503, { erro: "Servi\xE7o temporariamente indispon\xEDvel." });
  }
}
__name(handleMobilePerfil, "handleMobilePerfil");

// src/mobile/ranking.ts
var FOTO_MAX = 15e5;
var fotoChave = /* @__PURE__ */ __name((cliente) => `fotos-app/${cliente}.jpg`, "fotoChave");
async function enviarFoto(request, env, cliente) {
  if (!env.PRE) return json9(503, { erro: "Servi\xE7o temporariamente indispon\xEDvel." });
  if (request.headers.get("content-type") !== "image/jpeg") return json9(415, { erro: "Envie a foto em JPEG." });
  if (Number(request.headers.get("content-length") ?? 0) > FOTO_MAX) return json9(413, { erro: "A foto \xE9 grande demais." });
  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.length < 100 || bytes.length > FOTO_MAX || bytes[0] !== 255 || bytes[1] !== 216 || bytes[2] !== 255) return json9(400, { erro: "Arquivo de imagem inv\xE1lido." });
  await env.PRE.put(fotoChave(cliente), bytes, { httpMetadata: { contentType: "image/jpeg" }, customMetadata: { enviadaEm: (/* @__PURE__ */ new Date()).toISOString() } });
  return json9(200, { ok: true, versao: Date.now() });
}
__name(enviarFoto, "enviarFoto");
async function lerFoto(env, cliente) {
  const obj = env.PRE ? await env.PRE.get(fotoChave(cliente)) : null;
  if (!obj) return new Response(null, { status: 404, headers: { "cache-control": "public, max-age=300" } });
  return new Response(obj.body, { headers: { "content-type": "image/jpeg", "cache-control": "public, max-age=300", etag: obj.httpEtag } });
}
__name(lerFoto, "lerFoto");
var json9 = /* @__PURE__ */ __name((status, body2, maxAge = 0) => new Response(JSON.stringify(body2), {
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
var CHAVE = /^(ranking|piloto:\d{1,12})$/;
var LIMITE_CORPO = 4e6;
var tabelaPronta = false;
async function garantirTabela(env) {
  if (tabelaPronta) return;
  await env.MOBILE_DB.prepare("CREATE TABLE IF NOT EXISTS mobile_ranking (chave TEXT PRIMARY KEY, dados TEXT NOT NULL, atualizado_em INTEGER NOT NULL)").run();
  tabelaPronta = true;
}
__name(garantirTabela, "garantirTabela");
async function receber(request, env) {
  if (!constantTimeEqual3(request.headers.get("x-mobile-admin-token") ?? "", env.MOBILE_ADMIN_TOKEN)) return json9(401, { erro: "N\xE3o autorizado." });
  if (Number(request.headers.get("content-length") ?? 0) > LIMITE_CORPO) return json9(413, { erro: "Envio grande demais." });
  const raw = await request.text();
  if (raw.length > LIMITE_CORPO) return json9(413, { erro: "Envio grande demais." });
  let corpo;
  try {
    corpo = JSON.parse(raw);
  } catch {
    return json9(400, { erro: "JSON inv\xE1lido." });
  }
  const itens = Array.isArray(corpo.itens) ? corpo.itens : [];
  if (!itens.length || itens.length > 2e3) return json9(400, { erro: "Envie de 1 a 2000 itens." });
  await garantirTabela(env);
  const agora = Date.now();
  const stmts = [];
  for (const it of itens) {
    if (typeof it.chave !== "string" || !CHAVE.test(it.chave) || it.dados === null || typeof it.dados !== "object") return json9(400, { erro: "Item inv\xE1lido." });
    stmts.push(env.MOBILE_DB.prepare(
      "INSERT INTO mobile_ranking(chave, dados, atualizado_em) VALUES (?, ?, ?) ON CONFLICT(chave) DO UPDATE SET dados = excluded.dados, atualizado_em = excluded.atualizado_em"
    ).bind(it.chave, JSON.stringify(it.dados), agora));
  }
  for (let i = 0; i < stmts.length; i += 100) await env.MOBILE_DB.batch(stmts.slice(i, i + 100));
  if (typeof corpo.limpar === "number" && corpo.limpar > 0) {
    await env.MOBILE_DB.prepare("DELETE FROM mobile_ranking WHERE chave LIKE 'piloto:%' AND atualizado_em < ?").bind(corpo.limpar).run();
  }
  return json9(200, { ok: true, gravados: stmts.length });
}
__name(receber, "receber");
async function ler(env, chave) {
  await garantirTabela(env);
  const row = await env.MOBILE_DB.prepare("SELECT dados, atualizado_em FROM mobile_ranking WHERE chave = ?").bind(chave).first();
  return row ? { dados: JSON.parse(row.dados), atualizadoEm: new Date(row.atualizado_em).toISOString() } : null;
}
__name(ler, "ler");
async function ranking(url, env) {
  const r = await ler(env, "ranking");
  if (!r) return json9(503, { erro: "O ranking ainda est\xE1 sendo preparado. Tente de novo em alguns minutos." });
  const periodos = r.dados.periodos ?? {};
  const nome = ["semana", "mes", "geral"].includes(url.searchParams.get("periodo") ?? "") ? url.searchParams.get("periodo") : "semana";
  const per = periodos[nome] ?? { de: null, ate: null, tracados: [] };
  const pedido = url.searchParams.get("tracado");
  const escolhido = per.tracados.find((t) => t.nome === pedido) ?? per.tracados[0] ?? null;
  return json9(200, {
    periodo: nome,
    de: per.de,
    ate: per.ate,
    tracados: per.tracados.map((t) => ({ nome: t.nome, pilotos: t.pilotos })),
    tracado: escolhido?.nome ?? null,
    linhas: escolhido?.linhas ?? [],
    atualizadoEm: r.atualizadoEm
  }, 60);
}
__name(ranking, "ranking");
async function piloto(id, env, publico = true) {
  const r = await ler(env, "piloto:" + id);
  if (!r) return json9(404, { erro: "Piloto sem corridas no ranking." });
  return json9(200, { id, ...r.dados, atualizadoEm: r.atualizadoEm }, publico ? 60 : 0);
}
__name(piloto, "piloto");
async function clienteDaSessao(request, env) {
  const conta = await authenticateMobileRequest(request, env);
  if (!conta) return null;
  const row = await env.MOBILE_DB.prepare("SELECT customer_id FROM mobile_identity_links WHERE account_id = ?").bind(conta.id).first();
  return row?.customer_id ?? null;
}
__name(clienteDaSessao, "clienteDaSessao");
async function handleMobileRanking(request, env) {
  if (!env.MOBILE_DB || !env.MOBILE_ADMIN_TOKEN) return json9(503, { erro: "Servi\xE7o temporariamente indispon\xEDvel." });
  const url = new URL(request.url);
  const p = url.pathname;
  try {
    if (p === "/api/mobile/v1/internal/ranking") return request.method === "POST" ? await receber(request, env) : json9(405, { erro: "M\xE9todo n\xE3o permitido." });
    if (p === "/api/mobile/v1/ranking/me/foto") {
      const cliente = await clienteDaSessao(request, env);
      if (!cliente) return json9(404, { erro: "Sua conta ainda n\xE3o est\xE1 ligada ao seu cadastro no kart\xF3dromo." });
      if (request.method === "PUT") return await enviarFoto(request, env, cliente);
      if (request.method === "DELETE") {
        await env.PRE?.delete(fotoChave(cliente));
        return json9(200, { ok: true });
      }
      return json9(405, { erro: "M\xE9todo n\xE3o permitido." });
    }
    if (p === "/api/mobile/v1/ranking/interno/clientes" && request.method === "POST") {
      return await receberClientes(request, env, constantTimeEqual3(request.headers.get("x-mobile-admin-token") ?? "", env.MOBILE_ADMIN_TOKEN));
    }
    if (request.method !== "GET") return json9(405, { erro: "M\xE9todo n\xE3o permitido." });
    const mf = /^\/api\/mobile\/v1\/ranking\/pilotos\/(\d{1,12})\/foto$/.exec(p);
    if (mf) return await lerFoto(env, mf[1]);
    if (p === "/api/mobile/v1/ranking") return await ranking(url, env);
    if (p === "/api/mobile/v1/ranking/busca") {
      const termo = (url.searchParams.get("nome") ?? "").trim().replace(/[%_]/g, "");
      if (termo.length < 3) return json9(400, { erro: "Digite pelo menos 3 letras do nome." });
      await garantirTabela(env);
      const r = await env.MOBILE_DB.prepare(
        `SELECT substr(chave, 8) id, json_extract(dados, '$.nome') nome,
                json_extract(dados, '$.baterias') * 50 + json_extract(dados, '$.podios') * 50 + json_extract(dados, '$.vitorias') * 100
                + json_extract(dados, '$.poles') * 50 + json_extract(dados, '$.voltasMaisRapidas') * 50 xp
           FROM mobile_ranking WHERE chave LIKE 'piloto:%' AND json_extract(dados, '$.nome') LIKE ? ORDER BY xp DESC LIMIT 20`
      ).bind(`%${termo}%`).all();
      return json9(200, { pilotos: r.results ?? [] }, 300);
    }
    if (p === "/api/mobile/v1/ranking/karts") {
      const r = await ler(env, "ranking");
      return json9(200, { ...r?.dados.kartsDoDia ?? { dia: null, karts: [] }, atualizadoEm: r?.atualizadoEm ?? null }, 60);
    }
    if (p === "/api/mobile/v1/ranking/me") {
      const cliente = await clienteDaSessao(request, env);
      if (!cliente) return json9(404, { erro: "Sua conta ainda n\xE3o est\xE1 ligada ao seu cadastro no kart\xF3dromo." });
      return await piloto(cliente, env, false);
    }
    const m = /^\/api\/mobile\/v1\/ranking\/pilotos\/(\d{1,12})$/.exec(p);
    if (m) return await piloto(m[1], env);
    return json9(404, { erro: "Rota desconhecida." });
  } catch {
    return json9(503, { erro: "Servi\xE7o temporariamente indispon\xEDvel." });
  }
}
__name(handleMobileRanking, "handleMobileRanking");

// src/mobile/outbox.ts
var json10 = /* @__PURE__ */ __name((status, body2) => new Response(JSON.stringify(body2), {
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
  if (!env.MOBILE_DB || !env.MOBILE_PUBLISH_TOKEN) return json10(503, { erro: "Indispon\xEDvel." });
  if (!autorizado(request, env.MOBILE_PUBLISH_TOKEN)) return json10(401, { erro: "N\xE3o autorizado." });
  const path = new URL(request.url).pathname;
  const agora = Date.now();
  if (path === "/api/mobile/v1/internal/outbox" && request.method === "GET") {
    const { results } = await env.MOBILE_DB.prepare(
      `SELECT id, to_address, subject, text_body, html_body FROM mobile_email_outbox
        WHERE attempts < 5 AND (claimed_at IS NULL OR claimed_at < ?) AND created_at > ?
        ORDER BY created_at LIMIT 10`
    ).bind(agora - 12e4, agora - 36e5).all();
    if (results.length) {
      await env.MOBILE_DB.batch(results.map((r) => env.MOBILE_DB.prepare(
        "UPDATE mobile_email_outbox SET claimed_at = ?, attempts = attempts + 1 WHERE id = ?"
      ).bind(agora, r.id)));
    }
    return json10(200, results.map((r) => ({ id: r.id, to: r.to_address, subject: r.subject, text: r.text_body, html: r.html_body })));
  }
  const m = path.match(/^\/api\/mobile\/v1\/internal\/outbox\/([0-9a-f-]{36})\/(enviado|falhou)$/);
  if (m && request.method === "POST") {
    if (m[2] === "enviado") await env.MOBILE_DB.prepare("DELETE FROM mobile_email_outbox WHERE id = ?").bind(m[1]).run();
    else await env.MOBILE_DB.prepare("UPDATE mobile_email_outbox SET claimed_at = NULL WHERE id = ?").bind(m[1]).run();
    return json10(200, { ok: true });
  }
  return json10(404, { erro: "Rota desconhecida." });
}
__name(handleMobileOutbox, "handleMobileOutbox");

// src/index.ts
var json11 = /* @__PURE__ */ __name((status, body2) => new Response(JSON.stringify(body2), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } }), "json");
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
    return json11(400, { erro: "Envio inv\xE1lido." });
  }
  if (String(corpo.site ?? "") !== "") return json11(200, { ok: true });
  const aberto = Number(corpo.t ?? 0);
  if (!aberto || Date.now() - aberto < 4e3) return json11(400, { erro: "Confira os dados e envie de novo." });
  if (await excedeuLimite(req.headers.get("cf-connecting-ip") ?? "x")) return json11(429, { erro: "Muitos envios seguidos. Aguarde alguns minutos." });
  const v = validar(corpo);
  if (!v.ok) return json11(400, { erro: v.erro });
  const chave = chaveDocumento(v.dados.tipoDocumento, v.dados.documento);
  const registro = { chave, recebidoEm: (/* @__PURE__ */ new Date()).toISOString(), ...v.dados };
  await env.PRE.put(`pendentes/${chave}.json`, JSON.stringify(registro), { httpMetadata: { contentType: "application/json" } });
  return json11(201, { ok: true, nome: v.dados.nome.split(" ")[0] });
}
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
      if (p.startsWith("/api/mobile/v1/auth/")) return await handleMobileAuth(req, env);
      if (p === "/api/mobile/v1/coupons/preview" || p.startsWith("/api/mobile/v1/coupons/preview/")) {
        return await handleMobileCoupons(req, env);
      }
      if (p === "/api/mobile/v1/internal/results" || p === "/api/mobile/v1/internal/identity-links" || p === "/api/mobile/v1/internal/identity-candidates" || p === "/api/mobile/v1/results" || p === "/api/mobile/v1/results/me") {
        return await handleMobileResults(req, env);
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
          if (mobileOrder) return json11(404, { erro: "Reserva n\xE3o encontrada." });
        }
        return await situacaoPedido(env, id, ctx);
      }
      if (p === "/api/asaas/webhook" && req.method === "POST") return await webhookAsaas(req, env);
      if (p.startsWith("/api/sync/")) {
        if (!autorizado2(req, env)) return json11(401, { erro: "N\xE3o autorizado." });
        if (p === "/api/sync/pendentes" && req.method === "GET") return json11(200, await listar(env));
        if (p === "/api/sync/buscar" && req.method === "GET") return json11(200, await buscar(env, url.searchParams.get("q") ?? ""));
        if (p === "/api/sync/concluir" && req.method === "POST") {
          const { keys } = await req.json();
          const validas = (keys ?? []).filter((k) => /^pendentes\/[A-Z0-9]+\.json$/.test(k));
          if (validas.length) await env.PRE.delete(validas);
          return json11(200, { apagados: validas.length });
        }
        if (p === "/api/sync/agenda" && req.method === "PUT") return await syncAgenda(req, env);
        if (p === "/api/sync/asaas" && req.method === "GET") return json11(200, await diagnostico(env));
        if (p === "/api/sync/mobile/coupons" || p.startsWith("/api/sync/mobile/coupons/")) return await handleMobileCouponsSync(req, env);
        if (p === "/api/sync/pedidos" && req.method === "GET") return await syncPedidos(env);
        if (p === "/api/sync/pedido" && req.method === "POST") return await syncResultado(req, env, ctx);
      }
      if (p.startsWith("/api/")) return json11(404, { erro: "Rota desconhecida." });
      if (p === "/" && url.hostname.startsWith("reservas.")) return env.ASSETS.fetch(new Request(new URL("/reservar", url), req));
      return env.ASSETS.fetch(req);
    } catch (e) {
      console.error("pre-cadastro", e.message);
      return json11(500, { erro: "N\xE3o foi poss\xEDvel salvar agora. Tente de novo em instantes." });
    }
  }
};
export {
  AoVivo,
  index_default as default
};
//# sourceMappingURL=index.js.map

--46390850d8c75bd1e89730f185bf874181d5126210ddb8d9b7e750fab173--