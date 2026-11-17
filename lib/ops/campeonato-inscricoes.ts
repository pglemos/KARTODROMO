/**
 * Inscrição de equipes pelo site (200 Milhas de Betim): o site fala com /api/campeonato-site/* (com a chave, pelo worker
 * kartodromo-200-milhas) e o Admin Web com /api/office/campeonato-inscricoes*. O pagamento é a fatura do Asaas, gerada pelo
 * worker do pré-cadastro; a conferência roda a cada minuto. A busca do piloto exige documento + nascimento.
 */
import { randomBytes } from 'node:crypto';
import { isValidCpf, one, onlyDigits, query, tx } from './db';
import { HttpError } from './office';
import type { Sessao } from './auth';

type Res = (status: number, body: unknown) => void;
type Log = (...args: unknown[]) => void;
type Linha = Record<string, unknown>;
type Insc = Linha & { falta: number; situacao: string; pilotos: Linha[]; cobrancas: Linha[]; pagamentos: Linha[] };

export const EVENTOS: Record<string, { nome: string; valorCentavos: number; abre: string; fecha: string; minPilotos: number; maxPilotos: number; dia: string; maxKarts: number }> = {
  '200-milhas': { nome: '200 Milhas de Betim', valorCentavos: 280_000, abre: '2026-10-05T10:00:00-03:00', fecha: '2027-01-10T23:59:59-03:00', minPilotos: 2, maxPilotos: 10, dia: '2027-01-30', maxKarts: 5 },
};
const evento = (id: string) => {
  const e = EVENTOS[id];
  if (!e) throw new HttpError(404, 'Campeonato não encontrado.');
  return e;
};
const aberta = (id: string, agora = Date.now()) => agora >= Date.parse(EVENTOS[id].abre) && agora <= Date.parse(EVENTOS[id].fecha);
const txt = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max);
const dataIso = (v: unknown) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v ?? '')) && !Number.isNaN(Date.parse(String(v))) ? String(v) : '');
const emailOk = (v: string) => v.length <= 200 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);

export function idadeEm(nascimento: string, dia: string) {
  const [a, m, d] = nascimento.split('-').map(Number);
  const [ea, em, ed] = dia.split('-').map(Number);
  return ea - a - (em < m || (em === m && ed < d) ? 1 : 0);
}

export type PilotoIn = { kart: number; nome: string; cpf: string; nascimento: string; telefone: string; email: string; alturaCm: number; pesoKg: number; clienteId: number | null };

/** Regras do regulamento (3.10, 4.1, 4.3): devolve o primeiro problema, em português. */
export function problemaDoPiloto(p: PilotoIn, dia: string) {
  const quem = p.nome || 'Piloto sem nome';
  if (p.nome.split(/\s+/).length < 2) return `${quem}: informe nome e sobrenome.`;
  if (!isValidCpf(p.cpf)) return `${quem}: CPF inválido.`;
  if (!p.nascimento) return `${quem}: informe a data de nascimento.`;
  if (idadeEm(p.nascimento, dia) < 12) return `${quem}: a idade mínima é 12 anos na data da prova.`;
  if (!(p.alturaCm > 150 && p.alturaCm < 230)) return `${quem}: a altura precisa ser maior que 1,50 m.`;
  if (!(p.pesoKg > 50 && p.pesoKg < 250)) return `${quem}: o peso precisa ser maior que 50 kg.`;
  return null;
}

export function lerPiloto(b: Linha): PilotoIn {
  return {
    kart: Math.trunc(Number(b.kart)) || 1,
    nome: txt(b.nome, 150).replace(/\s+/g, ' '),
    cpf: onlyDigits(b.cpf),
    nascimento: dataIso(b.nascimento),
    telefone: onlyDigits(b.telefone).slice(0, 13),
    email: txt(b.email, 200).toLowerCase(),
    alturaCm: Math.round(Number(String(b.altura ?? '').replace(',', '.')) * 100),
    pesoKg: Math.round(Number(String(b.peso ?? '').replace(',', '.')) * 10) / 10,
    clienteId: null,
  };
}

/** Cadastro do piloto: só com o documento (ou e-mail) E a data de nascimento certa, para o CPF não abrir dados de ninguém. */
export async function buscarPiloto(doc: string, nascimento: string) {
  const data = dataIso(nascimento);
  if (!data) return null;
  const termo = doc.trim().toLowerCase();
  const num = onlyDigits(termo);
  const where = termo.includes('@') ? 'lower(c.email) = @email' : 'c.documento_num = @num';
  if (!termo.includes('@') && num.length !== 11) return null;
  const c = await one<Linha>(
    `select c.id, c.nome, c.documento_num cpf, c.telefone, c.email, c.cidade, c.peso
     from kart.cliente c where ${where} and c.nascimento = @data::date and not coalesce(c.bloqueado, false) order by c.atualizado_em desc limit 1`,
    { email: termo, num, data },
  );
  if (!c) return null;
  return { nome: c.nome, cpf: c.cpf, telefone: c.telefone, email: c.email, cidade: c.cidade, peso: c.peso };
}

async function montar(where: string, p: Linha): Promise<Insc[]> {
  const insc = await query<Linha>(
    `select i.id, i.evento, i.protocolo, i.token, i.equipe, i.chefe_nome "chefeNome", i.chefe_cpf "chefeCpf", i.chefe_telefone "chefeTelefone",
            i.chefe_email "chefeEmail", i.cidade, i.karts, i.valor_centavos valor, i.status, i.observacao, i.obs_interna "obsInterna",
            i.autoriza_imagem "autorizaImagem", i.origem, to_char(i.criado_em, 'YYYY-MM-DD"T"HH24:MI') "criadoEm",
            coalesce((select sum(g.valor_centavos) from kart.campeonato_inscricao_pagamento g where g.inscricao_id = i.id), 0) pago
     from kart.campeonato_inscricao i where ${where} order by i.id desc`,
    p,
  );
  if (!insc.length) return [];
  const ids = insc.map((i) => Number(i.id)).join(',');
  const [pilotos, cobrancas, pagamentos] = await Promise.all([
    query<Linha>(`select id, inscricao_id "inscricaoId", kart, cliente_id "clienteId", nome, cpf, to_char(nascimento, 'YYYY-MM-DD') nascimento, telefone, email, altura_cm "alturaCm", peso_kg "pesoKg" from kart.campeonato_inscricao_piloto where inscricao_id in (${ids}) and ativo order by kart, id`),
    query<Linha>(`select id, inscricao_id "inscricaoId", valor_centavos valor, forma, parcelas, link, status, to_char(criado_em, 'YYYY-MM-DD"T"HH24:MI') "criadoEm" from kart.campeonato_inscricao_cobranca where inscricao_id in (${ids}) order by id desc`),
    query<Linha>(`select id, inscricao_id "inscricaoId", valor_centavos valor, forma, origem, observacao, to_char(em, 'YYYY-MM-DD"T"HH24:MI') em from kart.campeonato_inscricao_pagamento where inscricao_id in (${ids}) order by id desc`),
  ]);
  return insc.map((i) => {
    const valor = Number(i.valor), pago = Number(i.pago);
    return {
      ...i, falta: Math.max(0, valor - pago),
      situacao: i.status === 'cancelada' ? 'cancelada' : pago >= valor ? 'paga' : pago > 0 ? 'parcial' : 'pendente',
      pilotos: pilotos.filter((x) => x.inscricaoId === i.id),
      cobrancas: cobrancas.filter((x) => x.inscricaoId === i.id),
      pagamentos: pagamentos.filter((x) => x.inscricaoId === i.id),
    } as Insc;
  });
}
const umaPorId = async (id: number) => (await montar('i.id = @id', { id }))[0] ?? null;

const siteUrl = () => (process.env.PRECADASTRO_URL || '').replace(/\/+$/, '');
async function site(caminho: string, init: RequestInit = {}) {
  if (!siteUrl() || !process.env.PRECADASTRO_KEY) throw new HttpError(503, 'Pagamento online desligado neste servidor.');
  const r = await fetch(siteUrl() + caminho, { ...init, headers: { 'x-sync-key': process.env.PRECADASTRO_KEY, 'content-type': 'application/json' }, signal: AbortSignal.timeout(20_000) });
  const j = (await r.json().catch(() => ({}))) as Linha;
  if (!r.ok) throw new HttpError(502, `Pagamento: ${String(j.erro ?? `HTTP ${r.status}`).replace(/^Asaas [^:]*: /, '')}`);
  return j;
}

async function gerarCobranca(id: number, forma: string, parcelas: number) {
  const i = await umaPorId(id);
  if (!i) throw new HttpError(404, 'Inscrição não encontrada.');
  if (i.situacao === 'cancelada') throw new HttpError(409, 'Esta inscrição está cancelada.');
  if (i.falta <= 0) throw new HttpError(409, 'Esta inscrição já está paga.');
  const f = forma === 'cartao' ? 'cartao' : 'pix';
  const n = f === 'cartao' ? Math.min(5, Math.max(1, Math.trunc(parcelas) || 1)) : 1;
  const igual = (i.cobrancas as Linha[]).find((c) => c.status === 'aguardando' && Number(c.valor) === i.falta && c.forma === f && Number(c.parcelas) === n);
  if (igual) return String(igual.link);
  const e = EVENTOS[String(i.evento)] ?? evento('200-milhas');
  const hoje = new Date(Date.now() - 3 * 3_600_000);
  const vence = new Date(hoje.getTime() + 3 * 86_400_000).toISOString().slice(0, 10);
  const limite = e.fecha.slice(0, 10);
  const c = await site('/api/sync/campeonato/cobranca', {
    method: 'POST',
    body: JSON.stringify({
      nome: i.chefeNome, cpf: i.chefeCpf, email: i.chefeEmail, celular: i.chefeTelefone, valorCentavos: i.falta, forma: f, parcelas: n,
      vencimento: vence < limite ? vence : limite >= hoje.toISOString().slice(0, 10) ? limite : vence,
      descricao: `${e.nome} · equipe ${i.equipe} · ${i.karts} kart(s) · protocolo ${i.protocolo}`,
      referencia: `camp-${i.id}-${Date.now()}`,
    }),
  });
  const antigas = (i.cobrancas as Linha[]).filter((x) => x.status === 'aguardando');
  await query(`insert into kart.campeonato_inscricao_cobranca (inscricao_id, valor_centavos, forma, parcelas, asaas_id, link) values (@i, @v, @f, @n, @a, @l)`, { i: id, v: i.falta, f, n, a: String(c.id), l: String(c.link) });
  // fatura trocada: a antiga deixa de valer no Asaas, senão a equipe podia pagar duas vezes
  for (const a of antigas) {
    const atual = await one<{ asaas: string }>(`update kart.campeonato_inscricao_cobranca set status = 'cancelada' where id = @id and status = 'aguardando' returning asaas_id asaas`, { id: a.id });
    if (atual) await site(`/api/sync/campeonato/cobranca/${encodeURIComponent(atual.asaas)}`, { method: 'DELETE' }).catch(() => undefined);
  }
  return String(c.link);
}

/** A cada minuto: confere as faturas em aberto. Cartão parcelado conta inteiro quando a 1ª parcela é aprovada. */
export async function conferirCobrancasCampeonato(log: Log) {
  if (!siteUrl() || !process.env.PRECADASTRO_KEY) return;
  const abertas = await query<{ id: number; inscricao: number; valor: number; asaas: string; forma: string; parcelas: number }>(
    `select id, inscricao_id inscricao, valor_centavos valor, asaas_id asaas, forma, parcelas from kart.campeonato_inscricao_cobranca where status = 'aguardando' order by id limit 60`,
  );
  for (const c of abertas) {
    try {
      const s = await site(`/api/sync/campeonato/cobranca/${encodeURIComponent(c.asaas)}`);
      if (s.pago) {
        await tx(async (run) => {
          const [ok] = await run(`update kart.campeonato_inscricao_cobranca set status = 'pago', pago_em = now() where id = @id and status = 'aguardando' returning id`, { id: c.id });
          if (ok) await run(`insert into kart.campeonato_inscricao_pagamento (inscricao_id, valor_centavos, forma, origem, asaas_id) values (@i, @v, @f, 'asaas', @a)`, { i: c.inscricao, v: c.valor, f: s.forma === 'PIX' ? 'Pix (Asaas)' : `Cartão ${c.parcelas}x (Asaas)`, a: c.asaas });
        });
        log(`campeonato: inscrição ${c.inscricao} pagou ${c.valor} centavos pelo Asaas`);
      } else if (['REFUNDED', 'DELETED'].includes(String(s.status))) {
        await query(`update kart.campeonato_inscricao_cobranca set status = 'cancelada' where id = @id`, { id: c.id });
      }
    } catch (e) {
      log(`campeonato: conferência da cobrança ${c.id} falhou (${(e as Error).message})`);
    }
  }
}

async function cpfJaInscrito(eventoId: string, cpfs: string[], excetoPiloto = 0) {
  if (!cpfs.length) return null;
  return one<{ nome: string; equipe: string }>(
    `select p.nome, i.equipe from kart.campeonato_inscricao_piloto p join kart.campeonato_inscricao i on i.id = p.inscricao_id
     where i.evento = @e and i.status = 'ativa' and p.ativo and p.id <> @x and p.cpf in (${cpfs.map((c) => `'${onlyDigits(c)}'`).join(',')}) limit 1`,
    { e: eventoId, x: excetoPiloto },
  );
}

const clienteDoCpf = async (cpf: string) => (await one<{ id: number }>(`select id from kart.cliente where documento_num = @cpf order by atualizado_em desc limit 1`, { cpf }))?.id ?? null;

async function criarInscricao(eventoId: string, b: Linha, origem: string) {
  const e = evento(eventoId);
  const equipe = txt(b.equipe, 100), chefeNome = txt(b.chefeNome, 150).replace(/\s+/g, ' '), chefeCpf = onlyDigits(b.chefeCpf), chefeTelefone = onlyDigits(b.chefeTelefone).slice(0, 13), chefeEmail = txt(b.chefeEmail, 200).toLowerCase();
  const karts = Math.trunc(Number(b.karts));
  if (equipe.length < 2) throw new HttpError(400, 'Informe o nome da equipe.');
  if (chefeNome.split(' ').length < 2) throw new HttpError(400, 'Informe nome e sobrenome do chefe de equipe.');
  if (!isValidCpf(chefeCpf)) throw new HttpError(400, 'Confira o CPF do chefe de equipe.');
  if (!/^\d{10,13}$/.test(chefeTelefone)) throw new HttpError(400, 'Informe o WhatsApp com DDD.');
  if (!emailOk(chefeEmail)) throw new HttpError(400, 'Confira o e-mail do chefe de equipe.');
  if (!(karts >= 1 && karts <= e.maxKarts)) throw new HttpError(400, `Escolha de 1 a ${e.maxKarts} karts.`);
  const pilotos = (Array.isArray(b.pilotos) ? b.pilotos as Linha[] : []).map(lerPiloto);
  for (let k = 1; k <= karts; k++) {
    const n = pilotos.filter((p) => p.kart === k).length;
    if (n < e.minPilotos) throw new HttpError(400, `Kart ${k}: informe pelo menos ${e.minPilotos} pilotos.`);
    if (n > e.maxPilotos) throw new HttpError(400, `Kart ${k}: máximo de ${e.maxPilotos} pilotos.`);
  }
  if (pilotos.some((p) => p.kart < 1 || p.kart > karts)) throw new HttpError(400, 'Há piloto em um kart que não existe.');
  for (const p of pilotos) { const erro = problemaDoPiloto(p, e.dia); if (erro) throw new HttpError(400, erro); }
  const cpfs = pilotos.map((p) => p.cpf);
  if (new Set(cpfs).size !== cpfs.length) throw new HttpError(400, 'O mesmo CPF aparece em mais de um piloto.');
  const ja = await cpfJaInscrito(eventoId, cpfs);
  if (ja) throw new HttpError(409, `${ja.nome} já está inscrito na equipe ${ja.equipe}. O regulamento (4.3) não permite o piloto em duas equipes.`);
  for (const p of pilotos) p.clienteId = await clienteDoCpf(p.cpf);
  const chefeClienteId = await clienteDoCpf(chefeCpf);
  const token = randomBytes(18).toString('base64url');
  const id = await tx(async (run) => {
    // trava por evento+equipe até o fim da transação (o UPDLOCK/HOLDLOCK do banco anterior também travava a faixa vazia)
    await run(`select pg_advisory_xact_lock(hashtext('campeonato:' || @e || ':' || lower(@q)))`, { e: eventoId, q: equipe });
    const [dup] = await run(`select 1 x from kart.campeonato_inscricao where evento = @e and status = 'ativa' and lower(equipe) = lower(@q)`, { e: eventoId, q: equipe });
    if (dup) throw new HttpError(409, 'Já existe uma inscrição com esse nome de equipe. Fale com a organização se ela for sua.');
    const [n] = await run(
      `insert into kart.campeonato_inscricao (evento, protocolo, token, equipe, chefe_cliente_id, chefe_nome, chefe_cpf, chefe_telefone, chefe_email, cidade, karts, valor_centavos, observacao, autoriza_imagem, origem)
       values (@e, @prot, @tok, @q, @cc, @cn, @cpf, @tel, @em, @cid, @k, @v, @obs, @img, @org) returning id`,
      { e: eventoId, prot: `M${Date.now().toString(36).toUpperCase().slice(-7)}${randomBytes(1).toString('hex').toUpperCase()}`, tok: token, q: equipe, cc: chefeClienteId, cn: chefeNome, cpf: chefeCpf, tel: chefeTelefone, em: chefeEmail, cid: txt(b.cidade, 100) || null, k: karts, v: karts * e.valorCentavos, obs: txt(b.observacao, 1000) || null, img: !!b.autorizaImagem, org: origem },
    );
    for (const p of pilotos) {
      await run(`insert into kart.campeonato_inscricao_piloto (inscricao_id, kart, cliente_id, nome, cpf, nascimento, telefone, email, altura_cm, peso_kg) values (@i, @k, @c, @n, @cpf, @d, @t, @em, @a, @pk)`,
        { i: n.id, k: p.kart, c: p.clienteId, n: p.nome, cpf: p.cpf, d: p.nascimento, t: p.telefone || null, em: p.email || null, a: p.alturaCm, pk: p.pesoKg });
    }
    return Number(n.id);
  });
  return { id, token };
}

/** O que a equipe vê no link dela: sem CPF nem dados de outros pilotos além do nome. */
function publico(i: Insc) {
  const aguardando = (i.cobrancas as Linha[]).find((c) => c.status === 'aguardando');
  return {
    protocolo: i.protocolo, evento: EVENTOS[String(i.evento)]?.nome, equipe: i.equipe, karts: i.karts, valor: i.valor, pago: i.pago, falta: i.falta, situacao: i.situacao,
    link: aguardando?.link ?? null, forma: aguardando?.forma ?? null, parcelas: aguardando?.parcelas ?? null,
    pilotos: (i.pilotos as Linha[]).map((p) => ({ kart: p.kart, nome: p.nome })),
  };
}

export async function campeonatoSiteRoutes(path: string, method: string, corpo: () => Promise<Linha>, send: Res): Promise<boolean> {
  const m = path.match(/^\/api\/campeonato-site\/([a-z0-9-]+)(\/.*)?$/);
  if (!m) return false;
  const ev = m[1], resto = m[2] ?? '';
  const e = evento(ev);
  if (resto === '' && method === 'GET') {
    send(200, { nome: e.nome, aberta: aberta(ev), abre: e.abre, fecha: e.fecha, valorCentavos: e.valorCentavos, minPilotos: e.minPilotos, maxPilotos: e.maxPilotos, maxKarts: e.maxKarts, dia: e.dia });
    return true;
  }
  if (resto === '/piloto' && method === 'POST') {
    const b = await corpo();
    const p = await buscarPiloto(String(b.documento ?? ''), String(b.nascimento ?? ''));
    send(200, p ? { encontrado: true, ...p } : { encontrado: false });
    return true;
  }
  if (resto === '/inscricoes' && method === 'POST') {
    if (!aberta(ev)) throw new HttpError(409, 'As inscrições não estão abertas neste momento.');
    const b = await corpo();
    const criada = await criarInscricao(ev, b, 'site');
    // a inscrição fica gravada mesmo se o Asaas falhar: a página dela permite gerar a fatura de novo
    let erroPagamento: string | null = null;
    try { await gerarCobranca(criada.id, String(b.forma ?? 'pix'), Number(b.parcelas)); } catch (err) { erroPagamento = (err as Error).message; }
    send(201, { token: criada.token, erroPagamento });
    return true;
  }
  const t = resto.match(/^\/inscricoes\/([\w-]{20,40})(\/pagar)?$/);
  if (t) {
    const i = (await montar('i.token = @t and i.evento = @e', { t: t[1], e: ev }))[0];
    if (!i) throw new HttpError(404, 'Inscrição não encontrada.');
    if (!t[2] && method === 'GET') { send(200, publico(i)); return true; }
    if (t[2] && method === 'POST') {
      const b = await corpo();
      const link = await gerarCobranca(Number(i.id), String(b.forma ?? 'pix'), Number(b.parcelas));
      send(200, { link });
      return true;
    }
  }
  return false;
}

export async function campeonatoOfficeRoutes(req: { method: string; url: URL; body: () => Promise<Linha>; sessao: Sessao }, send: Res): Promise<boolean> {
  const { method, url, sessao } = req;
  const path = url.pathname.replace(/^\/api\/office/, '');
  if (!path.startsWith('/campeonato-inscricoes')) return false;
  let m: RegExpMatchArray | null;
  if (path === '/campeonato-inscricoes' && method === 'GET') {
    const ev = url.searchParams.get('evento') || '200-milhas';
    send(200, { evento: { id: ev, ...evento(ev), aberta: aberta(ev) }, inscricoes: await montar('i.evento = @e', { e: ev }) });
    return true;
  }
  if (path === '/campeonato-inscricoes' && method === 'POST') {
    const b = await req.body();
    const c = await criarInscricao(String(b.evento || '200-milhas'), b, 'admin');
    send(201, await umaPorId(c.id));
    return true;
  }
  if ((m = path.match(/^\/campeonato-inscricoes\/(\d+)$/)) && method === 'PUT') {
    const id = Number(m[1]);
    const b = await req.body();
    const nome = txt(b.equipe, 100), tel = onlyDigits(b.chefeTelefone), em = txt(b.chefeEmail, 200).toLowerCase();
    if (nome.length < 2) throw new HttpError(400, 'Informe o nome da equipe.');
    if (!/^\d{10,13}$/.test(tel)) throw new HttpError(400, 'Informe o WhatsApp com DDD.');
    if (!emailOk(em)) throw new HttpError(400, 'Confira o e-mail.');
    await query(`update kart.campeonato_inscricao set equipe = @q, chefe_nome = @n, chefe_telefone = @t, chefe_email = @em, cidade = @c, obs_interna = @o where id = @id`,
      { id, q: nome, n: txt(b.chefeNome, 150), t: tel, em, c: txt(b.cidade, 100) || null, o: txt(b.obsInterna, 1000) || null });
    send(200, await umaPorId(id));
    return true;
  }
  if ((m = path.match(/^\/campeonato-inscricoes\/(\d+)\/cancelar$/)) && method === 'POST') {
    const id = Number(m[1]);
    const abertas = await query<{ asaas: string }>(`update kart.campeonato_inscricao_cobranca set status = 'cancelada' where inscricao_id = @id and status = 'aguardando' returning asaas_id asaas`, { id });
    for (const a of abertas) await site(`/api/sync/campeonato/cobranca/${encodeURIComponent(a.asaas)}`, { method: 'DELETE' }).catch(() => undefined);
    await query(`update kart.campeonato_inscricao set status = 'cancelada' where id = @id`, { id });
    send(200, await umaPorId(id));
    return true;
  }
  if ((m = path.match(/^\/campeonato-inscricoes\/(\d+)\/reativar$/)) && method === 'POST') {
    const id = Number(m[1]);
    const i = await umaPorId(id);
    if (!i) throw new HttpError(404, 'Inscrição não encontrada.');
    const ja = await cpfJaInscrito(String(i.evento), (i.pilotos as Linha[]).map((p) => String(p.cpf)));
    if (ja) throw new HttpError(409, `${ja.nome} já está na equipe ${ja.equipe}.`);
    await query(`update kart.campeonato_inscricao set status = 'ativa' where id = @id`, { id });
    send(200, await umaPorId(id));
    return true;
  }
  if ((m = path.match(/^\/campeonato-inscricoes\/(\d+)\/cobranca$/)) && method === 'POST') {
    const b = await req.body();
    send(200, { link: await gerarCobranca(Number(m[1]), String(b.forma ?? 'pix'), Number(b.parcelas)) });
    return true;
  }
  if ((m = path.match(/^\/campeonato-inscricoes\/(\d+)\/pagamentos$/)) && method === 'POST') {
    const id = Number(m[1]);
    const b = await req.body();
    const valor = Math.round(Number(b.valorCentavos));
    if (!(valor > 0 && valor <= 100_000_000)) throw new HttpError(400, 'Informe o valor recebido.');
    const forma = txt(b.forma, 60);
    if (!forma) throw new HttpError(400, 'Informe a forma de pagamento.');
    await query(`insert into kart.campeonato_inscricao_pagamento (inscricao_id, valor_centavos, forma, origem, usuario_id, observacao) values (@i, @v, @f, 'manual', @u, @o)`,
      { i: id, v: valor, f: forma, u: sessao.uid, o: txt(b.observacao, 300) || null });
    send(201, await umaPorId(id));
    return true;
  }
  if ((m = path.match(/^\/campeonato-inscricoes\/(\d+)\/pagamentos\/(\d+)$/)) && method === 'DELETE') {
    const r = await one(`delete from kart.campeonato_inscricao_pagamento where id = @p and inscricao_id = @i and origem = 'manual' returning id`, { p: Number(m[2]), i: Number(m[1]) });
    if (!r) throw new HttpError(409, 'Só dá para excluir pagamento lançado à mão.');
    send(200, await umaPorId(Number(m[1])));
    return true;
  }
  if ((m = path.match(/^\/campeonato-inscricoes\/(\d+)\/pilotos$/)) && method === 'POST') {
    const id = Number(m[1]);
    const i = await umaPorId(id);
    if (!i) throw new HttpError(404, 'Inscrição não encontrada.');
    const p = lerPiloto(await req.body());
    const e = EVENTOS[String(i.evento)];
    const erro = problemaDoPiloto(p, e.dia);
    if (erro) throw new HttpError(400, erro);
    if (p.kart > Number(i.karts)) throw new HttpError(400, 'Esse kart não existe nesta inscrição.');
    const ja = await cpfJaInscrito(String(i.evento), [p.cpf]);
    if (ja) throw new HttpError(409, `${ja.nome} já está na equipe ${ja.equipe}.`);
    await query(`insert into kart.campeonato_inscricao_piloto (inscricao_id, kart, cliente_id, nome, cpf, nascimento, telefone, email, altura_cm, peso_kg) values (@i, @k, @c, @n, @cpf, @d, @t, @em, @a, @pk)`,
      { i: id, k: p.kart, c: await clienteDoCpf(p.cpf), n: p.nome, cpf: p.cpf, d: p.nascimento, t: p.telefone || null, em: p.email || null, a: p.alturaCm, pk: p.pesoKg });
    send(201, await umaPorId(id));
    return true;
  }
  if ((m = path.match(/^\/campeonato-inscricoes\/(\d+)\/pilotos\/(\d+)$/)) && method === 'DELETE') {
    await query(`update kart.campeonato_inscricao_piloto set ativo = false where id = @p and inscricao_id = @i`, { p: Number(m[2]), i: Number(m[1]) });
    send(200, await umaPorId(Number(m[1])));
    return true;
  }
  if (path === '/campeonato-inscricoes/buscar-piloto' && method === 'GET') {
    // equipe logada no Admin Web: acha pelo CPF, e-mail ou nome sem pedir nascimento
    const q = txt(url.searchParams.get('q'), 100);
    if (q.length < 3) { send(200, []); return true; }
    const num = onlyDigits(q);
    send(200, await query(
      `select id, nome, documento_num cpf, to_char(nascimento, 'YYYY-MM-DD') nascimento, telefone, email, peso from kart.cliente
       where ${q.includes('@') ? 'lower(email) = @em' : num.length === 11 ? 'documento_num = @num' : 'nome ilike @nome'} order by nome limit 8`,
      { em: q.toLowerCase(), num, nome: `${q}%` },
    ));
    return true;
  }
  return false;
}
