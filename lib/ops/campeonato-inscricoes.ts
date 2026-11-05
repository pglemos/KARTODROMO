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
  const where = termo.includes('@') ? 'c.Email = @email' : 'c.DocumentoNum = @num';
  if (!termo.includes('@') && num.length !== 11) return null;
  const c = await one<Linha>(
    `SELECT TOP 1 c.Id id, c.Nome nome, c.DocumentoNum cpf, c.Telefone telefone, c.Email email, c.Cidade cidade, c.Peso peso
     FROM dbo.Cliente c WHERE ${where} AND c.Nascimento = @data AND ISNULL(c.Bloqueado, 0) = 0 ORDER BY c.AtualizadoEm DESC`,
    { email: termo, num, data },
  );
  if (!c) return null;
  return { nome: c.nome, cpf: c.cpf, telefone: c.telefone, email: c.email, cidade: c.cidade, peso: c.peso };
}

async function montar(where: string, p: Linha): Promise<Insc[]> {
  const insc = await query<Linha>(
    `SELECT i.Id id, i.Evento evento, i.Protocolo protocolo, i.Token token, i.Equipe equipe, i.ChefeNome chefeNome, i.ChefeCpf chefeCpf, i.ChefeTelefone chefeTelefone,
            i.ChefeEmail chefeEmail, i.Cidade cidade, i.Karts karts, i.ValorCentavos valor, i.Status status, i.Observacao observacao, i.ObsInterna obsInterna,
            i.AutorizaImagem autorizaImagem, i.Origem origem, CONVERT(varchar(16), i.CriadoEm, 126) criadoEm,
            ISNULL((SELECT SUM(g.ValorCentavos) FROM dbo.CampeonatoInscricaoPagamento g WHERE g.InscricaoId = i.Id), 0) pago
     FROM dbo.CampeonatoInscricao i WHERE ${where} ORDER BY i.Id DESC`,
    p,
  );
  if (!insc.length) return [];
  const ids = insc.map((i) => Number(i.id)).join(',');
  const [pilotos, cobrancas, pagamentos] = await Promise.all([
    query<Linha>(`SELECT Id id, InscricaoId inscricaoId, Kart kart, ClienteId clienteId, Nome nome, Cpf cpf, CONVERT(varchar(10), Nascimento, 126) nascimento, Telefone telefone, Email email, AlturaCm alturaCm, PesoKg pesoKg FROM dbo.CampeonatoInscricaoPiloto WHERE InscricaoId IN (${ids}) AND Ativo = 1 ORDER BY Kart, Id`),
    query<Linha>(`SELECT Id id, InscricaoId inscricaoId, ValorCentavos valor, Forma forma, Parcelas parcelas, Link link, Status status, CONVERT(varchar(16), CriadoEm, 126) criadoEm FROM dbo.CampeonatoInscricaoCobranca WHERE InscricaoId IN (${ids}) ORDER BY Id DESC`),
    query<Linha>(`SELECT Id id, InscricaoId inscricaoId, ValorCentavos valor, Forma forma, Origem origem, Observacao observacao, CONVERT(varchar(16), Em, 126) em FROM dbo.CampeonatoInscricaoPagamento WHERE InscricaoId IN (${ids}) ORDER BY Id DESC`),
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
const umaPorId = async (id: number) => (await montar('i.Id = @id', { id }))[0] ?? null;

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
  await query(`INSERT INTO dbo.CampeonatoInscricaoCobranca (InscricaoId, ValorCentavos, Forma, Parcelas, AsaasId, Link) VALUES (@i, @v, @f, @n, @a, @l)`, { i: id, v: i.falta, f, n, a: String(c.id), l: String(c.link) });
  // fatura trocada: a antiga deixa de valer no Asaas, senão a equipe podia pagar duas vezes
  for (const a of antigas) {
    const atual = await one<{ asaas: string }>(`UPDATE dbo.CampeonatoInscricaoCobranca SET Status = 'cancelada' OUTPUT inserted.AsaasId asaas WHERE Id = @id AND Status = 'aguardando'`, { id: a.id });
    if (atual) await site(`/api/sync/campeonato/cobranca/${encodeURIComponent(atual.asaas)}`, { method: 'DELETE' }).catch(() => undefined);
  }
  return String(c.link);
}

/** A cada minuto: confere as faturas em aberto. Cartão parcelado conta inteiro quando a 1ª parcela é aprovada. */
export async function conferirCobrancasCampeonato(log: Log) {
  if (!siteUrl() || !process.env.PRECADASTRO_KEY) return;
  const abertas = await query<{ id: number; inscricao: number; valor: number; asaas: string; forma: string; parcelas: number }>(
    `SELECT TOP 60 Id id, InscricaoId inscricao, ValorCentavos valor, AsaasId asaas, Forma forma, Parcelas parcelas FROM dbo.CampeonatoInscricaoCobranca WHERE Status = 'aguardando' ORDER BY Id`,
  );
  for (const c of abertas) {
    try {
      const s = await site(`/api/sync/campeonato/cobranca/${encodeURIComponent(c.asaas)}`);
      if (s.pago) {
        await tx(async (run) => {
          const [ok] = await run(`UPDATE dbo.CampeonatoInscricaoCobranca SET Status = 'pago', PagoEm = SYSDATETIME() OUTPUT inserted.Id WHERE Id = @id AND Status = 'aguardando'`, { id: c.id });
          if (ok) await run(`INSERT INTO dbo.CampeonatoInscricaoPagamento (InscricaoId, ValorCentavos, Forma, Origem, AsaasId) VALUES (@i, @v, @f, 'asaas', @a)`, { i: c.inscricao, v: c.valor, f: s.forma === 'PIX' ? 'Pix (Asaas)' : `Cartão ${c.parcelas}x (Asaas)`, a: c.asaas });
        });
        log(`campeonato: inscrição ${c.inscricao} pagou ${c.valor} centavos pelo Asaas`);
      } else if (['REFUNDED', 'DELETED'].includes(String(s.status))) {
        await query(`UPDATE dbo.CampeonatoInscricaoCobranca SET Status = 'cancelada' WHERE Id = @id`, { id: c.id });
      }
    } catch (e) {
      log(`campeonato: conferência da cobrança ${c.id} falhou (${(e as Error).message})`);
    }
  }
}

async function cpfJaInscrito(eventoId: string, cpfs: string[], excetoPiloto = 0) {
  if (!cpfs.length) return null;
  return one<{ nome: string; equipe: string }>(
    `SELECT TOP 1 p.Nome nome, i.Equipe equipe FROM dbo.CampeonatoInscricaoPiloto p JOIN dbo.CampeonatoInscricao i ON i.Id = p.InscricaoId
     WHERE i.Evento = @e AND i.Status = 'ativa' AND p.Ativo = 1 AND p.Id <> @x AND p.Cpf IN (${cpfs.map((c) => `'${onlyDigits(c)}'`).join(',')})`,
    { e: eventoId, x: excetoPiloto },
  );
}

const clienteDoCpf = async (cpf: string) => (await one<{ id: number }>(`SELECT TOP 1 Id id FROM dbo.Cliente WHERE DocumentoNum = @cpf ORDER BY AtualizadoEm DESC`, { cpf }))?.id ?? null;

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
    const [dup] = await run(`SELECT 1 x FROM dbo.CampeonatoInscricao WITH (UPDLOCK, HOLDLOCK) WHERE Evento = @e AND Status = 'ativa' AND Equipe = @q`, { e: eventoId, q: equipe });
    if (dup) throw new HttpError(409, 'Já existe uma inscrição com esse nome de equipe. Fale com a organização se ela for sua.');
    const [n] = await run(
      `INSERT INTO dbo.CampeonatoInscricao (Evento, Protocolo, Token, Equipe, ChefeClienteId, ChefeNome, ChefeCpf, ChefeTelefone, ChefeEmail, Cidade, Karts, ValorCentavos, Observacao, AutorizaImagem, Origem)
       OUTPUT inserted.Id id VALUES (@e, @prot, @tok, @q, @cc, @cn, @cpf, @tel, @em, @cid, @k, @v, @obs, @img, @org)`,
      { e: eventoId, prot: `M${Date.now().toString(36).toUpperCase().slice(-7)}${randomBytes(1).toString('hex').toUpperCase()}`, tok: token, q: equipe, cc: chefeClienteId, cn: chefeNome, cpf: chefeCpf, tel: chefeTelefone, em: chefeEmail, cid: txt(b.cidade, 100) || null, k: karts, v: karts * e.valorCentavos, obs: txt(b.observacao, 1000) || null, img: b.autorizaImagem ? 1 : 0, org: origem },
    );
    for (const p of pilotos) {
      await run(`INSERT INTO dbo.CampeonatoInscricaoPiloto (InscricaoId, Kart, ClienteId, Nome, Cpf, Nascimento, Telefone, Email, AlturaCm, PesoKg) VALUES (@i, @k, @c, @n, @cpf, @d, @t, @em, @a, @pk)`,
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
    const i = (await montar('i.Token = @t AND i.Evento = @e', { t: t[1], e: ev }))[0];
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
    send(200, { evento: { id: ev, ...evento(ev), aberta: aberta(ev) }, inscricoes: await montar('i.Evento = @e', { e: ev }) });
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
    await query(`UPDATE dbo.CampeonatoInscricao SET Equipe = @q, ChefeNome = @n, ChefeTelefone = @t, ChefeEmail = @em, Cidade = @c, ObsInterna = @o, AtualizadoEm = SYSDATETIME() WHERE Id = @id`,
      { id, q: nome, n: txt(b.chefeNome, 150), t: tel, em, c: txt(b.cidade, 100) || null, o: txt(b.obsInterna, 1000) || null });
    send(200, await umaPorId(id));
    return true;
  }
  if ((m = path.match(/^\/campeonato-inscricoes\/(\d+)\/cancelar$/)) && method === 'POST') {
    const id = Number(m[1]);
    const abertas = await query<{ asaas: string }>(`UPDATE dbo.CampeonatoInscricaoCobranca SET Status = 'cancelada' OUTPUT inserted.AsaasId asaas WHERE InscricaoId = @id AND Status = 'aguardando'`, { id });
    for (const a of abertas) await site(`/api/sync/campeonato/cobranca/${encodeURIComponent(a.asaas)}`, { method: 'DELETE' }).catch(() => undefined);
    await query(`UPDATE dbo.CampeonatoInscricao SET Status = 'cancelada', AtualizadoEm = SYSDATETIME() WHERE Id = @id`, { id });
    send(200, await umaPorId(id));
    return true;
  }
  if ((m = path.match(/^\/campeonato-inscricoes\/(\d+)\/reativar$/)) && method === 'POST') {
    const id = Number(m[1]);
    const i = await umaPorId(id);
    if (!i) throw new HttpError(404, 'Inscrição não encontrada.');
    const ja = await cpfJaInscrito(String(i.evento), (i.pilotos as Linha[]).map((p) => String(p.cpf)));
    if (ja) throw new HttpError(409, `${ja.nome} já está na equipe ${ja.equipe}.`);
    await query(`UPDATE dbo.CampeonatoInscricao SET Status = 'ativa', AtualizadoEm = SYSDATETIME() WHERE Id = @id`, { id });
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
    await query(`INSERT INTO dbo.CampeonatoInscricaoPagamento (InscricaoId, ValorCentavos, Forma, Origem, UsuarioId, Observacao) VALUES (@i, @v, @f, 'manual', @u, @o)`,
      { i: id, v: valor, f: forma, u: sessao.uid, o: txt(b.observacao, 300) || null });
    send(201, await umaPorId(id));
    return true;
  }
  if ((m = path.match(/^\/campeonato-inscricoes\/(\d+)\/pagamentos\/(\d+)$/)) && method === 'DELETE') {
    const r = await one(`DELETE FROM dbo.CampeonatoInscricaoPagamento OUTPUT deleted.Id WHERE Id = @p AND InscricaoId = @i AND Origem = 'manual'`, { p: Number(m[2]), i: Number(m[1]) });
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
    await query(`INSERT INTO dbo.CampeonatoInscricaoPiloto (InscricaoId, Kart, ClienteId, Nome, Cpf, Nascimento, Telefone, Email, AlturaCm, PesoKg) VALUES (@i, @k, @c, @n, @cpf, @d, @t, @em, @a, @pk)`,
      { i: id, k: p.kart, c: await clienteDoCpf(p.cpf), n: p.nome, cpf: p.cpf, d: p.nascimento, t: p.telefone || null, em: p.email || null, a: p.alturaCm, pk: p.pesoKg });
    send(201, await umaPorId(id));
    return true;
  }
  if ((m = path.match(/^\/campeonato-inscricoes\/(\d+)\/pilotos\/(\d+)$/)) && method === 'DELETE') {
    await query(`UPDATE dbo.CampeonatoInscricaoPiloto SET Ativo = 0 WHERE Id = @p AND InscricaoId = @i`, { p: Number(m[2]), i: Number(m[1]) });
    send(200, await umaPorId(Number(m[1])));
    return true;
  }
  if (path === '/campeonato-inscricoes/buscar-piloto' && method === 'GET') {
    // equipe logada no Admin Web: acha pelo CPF, e-mail ou nome sem pedir nascimento
    const q = txt(url.searchParams.get('q'), 100);
    if (q.length < 3) { send(200, []); return true; }
    const num = onlyDigits(q);
    send(200, await query(
      `SELECT TOP 8 Id id, Nome nome, DocumentoNum cpf, CONVERT(varchar(10), Nascimento, 126) nascimento, Telefone telefone, Email email, Peso peso FROM dbo.Cliente
       WHERE ${q.includes('@') ? 'Email = @em' : num.length === 11 ? 'DocumentoNum = @num' : 'Nome LIKE @nome'} ORDER BY Nome`,
      { em: q.toLowerCase(), num, nome: `${q}%` },
    ));
    return true;
  }
  return false;
}
