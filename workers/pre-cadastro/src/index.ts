/**
 * Pré-cadastro online (cadastro.kartodromodebetim.com.br).
 * O cliente preenche no celular os mesmos dados do totem (menos a bateria). O cadastro fica no R2 só até o
 * servidor da operação (SRVKART) buscar pelo /api/sync, gravar na tabela de clientes e apagar daqui.
 * No totem o cliente digita CPF, RG, passaporte ou e-mail e os dados já aparecem.
 */
import { aceiteDoCadastro, esquecerGrupos, identificarCliente, rotasPublicas, rotasSync, SITE } from './extras';
import { chaveDocumento, digitos, validar, type PreCadastro } from './validar';
import { lembretesSync } from './lembretes';
import { cancelar, chamar, consultar, diagnostico, garantirCliente, hojeBrasilia, PAGO } from './asaas';
import { agendaPublica, criarPedido, politicaPublica, situacaoPedido, syncAgenda, syncPedidos, syncResultado, webhookAsaas, type EnvReservas } from './reservas';
import { handleMobileAccountEmail, handleMobileAuth, handleMobileContaAdmin, type MobileAccountAdminEnv } from './mobile/auth';
import { handleMobileReservations } from './mobile/reservations';
import { handleMobileCoupons, handleMobileCouponsSync } from './mobile/coupons';
import { handleMobileResults, type MobileResultsEnv } from './mobile/results';
import { handleMobileLive, type MobileLiveEnv } from './mobile/live';
export { AoVivo } from './mobile/live';
export { SinalVinculo } from './mobile/sinal-vinculo';
import { esperarPedidoDeVinculo, pedirVinculo, type SinalVinculoEnv } from './mobile/sinal-vinculo';
import { handleMobilePerfil, type MobilePerfilEnv } from './mobile/perfil';
import { handleMobileRanking } from './mobile/ranking';
import { handleMobileOutbox } from './mobile/outbox';

export interface Env extends EnvReservas, MobileAccountAdminEnv, MobileResultsEnv, MobileLiveEnv, MobilePerfilEnv, SinalVinculoEnv {
  ASSETS: Fetcher;
  PRE: R2Bucket;
  SYNC_KEY: string;
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

function autorizado(req: Request, env: Env) {
  const recebido = req.headers.get('x-sync-key') ?? '';
  const esperado = env.SYNC_KEY ?? '';
  if (!esperado || recebido.length !== esperado.length) return false;
  let dif = 0;
  for (let i = 0; i < esperado.length; i++) dif |= recebido.charCodeAt(i) ^ esperado.charCodeAt(i);
  return dif === 0;
}

/** Limite simples por IP (por data center): 6 envios a cada 10 minutos (cada tipo de envio conta separado). */
async function excedeuLimite(ip: string, tipo = 'cadastro') {
  const cache = caches.default;
  const chave = new Request(`https://limite.cadastro/${tipo}/${encodeURIComponent(ip)}`);
  const atual = Number((await (await cache.match(chave))?.text()) ?? 0);
  if (atual >= 6) return true;
  await cache.put(chave, new Response(String(atual + 1), { headers: { 'cache-control': 'max-age=600' } }));
  return false;
}

async function receber(req: Request, env: Env) {
  let corpo: Record<string, unknown>;
  try { corpo = (await req.json()) as Record<string, unknown>; } catch { return json(400, { erro: 'Envio inválido.' }); }
  // armadilhas para robôs: campo escondido preenchido ou envio rápido demais
  if (String(corpo.site ?? '') !== '') return json(200, { ok: true });
  const aberto = Number(corpo.t ?? 0);
  if (!aberto || Date.now() - aberto < 4000) return json(400, { erro: 'Confira os dados e envie de novo.' });
  if (await excedeuLimite(req.headers.get('cf-connecting-ip') ?? 'x')) return json(429, { erro: 'Muitos envios seguidos. Aguarde alguns minutos.' });

  const v = validar(corpo);
  if (!v.ok) return json(400, { erro: v.erro });
  const falta = faltaNoCadastro(v.dados);
  if (falta) return json(400, { erro: falta });
  const chave = chaveDocumento(v.dados.tipoDocumento, v.dados.documento);
  // link único do grupo: o código vai junto e o SRVKART põe a pessoa na próxima vaga "Amigo N" do grupo
  const reserva = /^[A-Za-z0-9]{10,24}$/.test(String(corpo.reserva ?? '')) ? String(corpo.reserva) : undefined;
  const grupo = reserva ? await grupoDoLink(env, reserva) : null;
  let pagamento: CobrancaDoLink | null = null;
  let pagamentoFalhou = false;
  if (grupo && grupo.modo === 'individual' && grupo.precoCentavos > 0 && grupo.livres > 0) {
    if (v.dados.tipoDocumento !== 'CPF') return json(400, { erro: 'Para pagar a vaga pelo link do grupo, use o CPF.' });
    // sem o Asaas (fora do ar ou cota estourada, 12/11/2026) o cadastro não pode se perder: salva e a vaga é paga depois
    try { pagamento = await cobrancaDoLink(env, reserva!, chave, v.dados, grupo); }
    catch (e) { console.error('cobrança do link', (e as Error).message); pagamentoFalhou = true; }
  }
  // termo de responsabilidade aceito no cadastro (texto publicado pelo SRVKART)
  const aceite = await aceiteDoCadastro(env, corpo as Record<string, unknown>, req.headers.get('cf-connecting-ip'));
  if (aceite.erro) return json(409, { erro: aceite.erro });
  const registro = { chave, recebidoEm: new Date().toISOString(), ...v.dados, ...(reserva ? { reserva } : {}), ...(aceite.termo ? { termo: aceite.termo } : {}),
    ...(pagamento ? { cobranca: { id: pagamento.id, link: pagamento.link, valorCentavos: pagamento.valorCentavos } } : {}) };
  // um cadastro por documento: se a pessoa enviar de novo, vale o último
  await env.PRE.put(`pendentes/${chave}.json`, JSON.stringify(registro), { httpMetadata: { contentType: 'application/json' } });
  return json(201, { ok: true, nome: v.dados.nome.split(' ')[0],
    ...(grupo ? { grupo: { responsavel: grupo.responsavel, bateria: grupo.bateria, inicio: grupo.inicio } } : {}), ...(pagamento ? { pagamento } : {}),
    ...(pagamentoFalhou ? { aviso: 'Cadastro salvo! O pagamento online está fora do ar agora. Pague a sua vaga na recepção ou abra este link de novo mais tarde.' } : {}) });
}

// todos os campos do totem são obrigatórios (só CEP e complemento ficam opcionais)
function faltaNoCadastro(d: PreCadastro) {
  if (!d.email) return 'Informe seu e-mail.';
  if (!(Number(d.peso) >= 20 && Number(d.peso) <= 250)) return 'Informe seu peso em kg (entre 20 e 250).';
  if (!d.endereco) return 'Informe a rua do seu endereço.';
  if (!d.numero) return 'Informe o número do endereço.';
  if (!d.bairro) return 'Informe o bairro.';
  if (!d.cidade) return 'Informe a cidade.';
  return null;
}

type GrupoDoLink = { tokens: string[]; status: string; codigo: string; responsavel: string; bateria: string; inicio: string; modo: string; precoCentavos: number; livres: number };
type CobrancaDoLink = { id: string; link: string; valorCentavos: number; pago?: boolean };
let cacheGrupos: { em: number; lista: GrupoDoLink[] } | null = null;
/** Resumo das reservas em grupo ativas (o SRVKART manda a cada minuto em /api/sync/grupos). */
async function grupoDoLink(env: Env, token: string) {
  if (!token) return null;
  if (!cacheGrupos || Date.now() - cacheGrupos.em > 30_000) {
    const obj = await env.PRE.get('grupos/todos.json');
    cacheGrupos = { em: Date.now(), lista: obj ? await obj.json<GrupoDoLink[]>() : [] };
  }
  const achado = cacheGrupos.lista.find((x) => x.tokens.includes(token));
  if (!achado) return null;
  if (achado.status !== 'ativa' || Date.parse(String(achado.inicio).slice(0, 16) + ':00-03:00') < Date.now() - 3_600_000) return null;
  const { tokens: _tokens, ...g } = achado;
  return g;
}

/**
 * Situação de uma cobrança de grupo, gastando o mínimo da cota da Asaas (12/11/2026: a cota de 12h estourou e
 * travou cadastro e pagamento): o aviso do webhook (grupos/pagos/) responde sem chamar a Asaas; senão a resposta da
 * Asaas fica guardada 60 s no cache, porque a página de pagamento e o SRVKART perguntam a mesma coisa várias vezes.
 */
async function situacaoCobranca(env: Env, id: string): Promise<{ pago: boolean; status: string; forma: string | null }> {
  const aviso = await env.PRE.get(`grupos/pagos/${id}.json`);
  if (aviso) { const a = await aviso.json<{ billingType?: string }>(); return { pago: true, status: 'RECEIVED', forma: a.billingType ?? null }; }
  const chaveCache = new Request(`https://cache.kartodromo/cobranca/${id}`);
  const cache = (globalThis as { caches?: { default?: Cache } }).caches?.default;
  const guardado = cache ? await cache.match(chaveCache) : undefined;
  if (guardado) return await guardado.json();
  const c = await consultar(env, id);
  const r = { pago: PAGO.has(c.status), status: c.status, forma: c.billingType ?? null };
  if (cache) await cache.put(chaveCache, new Response(JSON.stringify(r), { headers: { 'cache-control': `max-age=${r.pago ? 3600 : 60}` } }));
  return r;
}

/**
 * Preço da vaga de quem entra pelo link (estreante paga o de primeira vez da bateria, 12/11/2026): o SRVKART sabe se o
 * CPF já correu. Sem resposta em 3,5 s, vale o preço do grupo (nunca cobra a mais; o desconto só é aceito se for menor).
 */
async function precoDaVaga(env: Env, token: string, cpf: string, cheio: number) {
  try {
    const ops = ((env as { OPS_URL?: string }).OPS_URL || 'https://ops.kartodromodebetim.com.br').replace(/\/+$/, '');
    const r = await fetch(`${ops}/api/publico/grupo-preco`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token, cpf: digitos(cpf) }), signal: AbortSignal.timeout(3500) });
    if (!r.ok) return cheio;
    const v = Math.round(Number(((await r.json()) as { precoCentavos?: number }).precoCentavos));
    return v > 0 && v <= cheio ? v : cheio;
  } catch { return cheio; }
}

/** Uma cobrança por pessoa no grupo (o mesmo CPF reenviando reaproveita a que está aberta). */
async function cobrancaDoLink(env: Env, token: string, chave: string, d: PreCadastro, g: NonNullable<Awaited<ReturnType<typeof grupoDoLink>>>): Promise<CobrancaDoLink> {
  const k = `grupo-pag/${token}/${chave}.json`;
  const valor = await precoDaVaga(env, token, d.documento, Number(g.precoCentavos));
  const antiga = await env.PRE.get(k);
  if (antiga) {
    const a = await antiga.json<CobrancaDoLink>();
    try {
      const s = await situacaoCobranca(env, a.id);
      if (s.pago) return { ...a, pago: true };
      if (s.status === 'PENDING' && Number(a.valorCentavos) === valor) return { ...a, pago: false };
    } catch { /* cobrança antiga sumiu: cria outra */ }
  }
  const dados = { nome: d.nome, cpf: digitos(d.documento), email: d.email, celular: digitos(d.telefone), referencia: `grupo-${g.codigo}` };
  let cliente: string;
  try { cliente = await garantirCliente(env, dados); } catch (e) {
    if (!/celular|mobilePhone/i.test((e as Error).message)) throw e;
    cliente = await garantirCliente(env, { ...dados, celular: '' });
  }
  const hoje = hojeBrasilia();
  const dia = String(g.inicio).slice(0, 10);
  const cob = await chamar<{ id: string; invoiceUrl: string }>(env, '/payments', {
    method: 'POST',
    body: JSON.stringify({
      customer: cliente, billingType: 'PIX', value: Math.round(valor) / 100,
      dueDate: /^\d{4}-\d{2}-\d{2}$/.test(dia) && dia >= hoje ? dia : hoje,
      description: `Kartódromo de Betim · ${g.bateria} ${dia.split('-').reverse().join('/')} ${String(g.inicio).slice(11, 16)} · ${d.nome} · grupo do(a) ${g.responsavel}`.slice(0, 500),
      externalReference: `grupo-${g.codigo}-${chave}`.slice(0, 100),
    }),
  });
  const r: CobrancaDoLink = { id: cob.id, link: cob.invoiceUrl, valorCentavos: valor, pago: false };
  await env.PRE.put(k, JSON.stringify(r), { httpMetadata: { contentType: 'application/json' } });
  return r;
}

async function listar(env: Env) {
  const lista = await env.PRE.list({ prefix: 'pendentes/', limit: 50 });
  const itens: Record<string, unknown>[] = [];
  for (const o of lista.objects) {
    const obj = await env.PRE.get(o.key);
    if (obj) itens.push({ key: o.key, ...(await obj.json<Record<string, unknown>>()) });
  }
  return itens;
}

async function buscar(env: Env, q: string) {
  const termo = q.trim();
  if (termo.length < 5) return null;
  if (!termo.includes('@')) {
    for (const chave of [termo.replace(/\D/g, ''), termo.toUpperCase().replace(/[^A-Z0-9]/g, '')]) {
      if (!chave) continue;
      const obj = await env.PRE.get(`pendentes/${chave}.json`);
      if (obj) return { key: `pendentes/${chave}.json`, ...(await obj.json<Record<string, unknown>>()) };
    }
    return null;
  }
  const email = termo.toLowerCase();
  return (await listar(env)).find((i) => String(i.email ?? '') === email) ?? null;
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);
    const p = url.pathname;
    try {
      if ((p === '/api/cliente/identificar' || p === '/api/pre-cadastro/identificar' || p === '/api/identificar') && (req.method === 'GET' || req.method === 'POST'))
        return await identificarCliente(req, env, (q) => buscar(env, q) as Promise<Record<string, unknown> | null>, excedeuLimite);
      const extra = await rotasPublicas(req, env, p, url, excedeuLimite);
      if (extra) return extra;
      if (p === '/api/pre-cadastro' && req.method === 'POST') return await receber(req, env);
      if (p === '/api/grupo' && req.method === 'GET') {
        const g = await grupoDoLink(env, String(url.searchParams.get('r') ?? '').replace(/[^A-Za-z0-9]/g, '').slice(0, 24));
        return json(g ? 200 : 404, g ? { responsavel: g.responsavel, bateria: g.bateria, inicio: g.inicio, modo: g.modo, precoCentavos: g.precoCentavos, livres: g.livres,
          // a página do cadastro avisa a cobrança só no modo 'cada um paga o seu' (o responsável paga o grupo pelo admin)
          souResponsavel: false, aCobrarCentavos: g.modo === 'individual' && g.livres > 0 ? g.precoCentavos : 0 } : { erro: 'Reserva não encontrada.' });
      }
      // Pix ou cartão da mesma cobrança, nunca boleto (dono, 12/11/2026): troca a forma na Asaas se precisar e abre a fatura
      if (p === '/api/pagar' && req.method === 'GET') {
        const id = String(url.searchParams.get('id') ?? '');
        const forma = url.searchParams.get('forma') === 'cartao' ? 'CREDIT_CARD' : 'PIX';
        if (!/^pay_[A-Za-z0-9]{6,40}$/.test(id)) return json(400, { erro: 'Pagamento inválido.' });
        const c = await consultar(env, id) as Awaited<ReturnType<typeof consultar>> & { externalReference?: string | null };
        if (!String(c.externalReference ?? '').startsWith('grupo-')) return json(404, { erro: 'Pagamento não encontrado.' });
        if (PAGO.has(c.status)) return Response.redirect(c.invoiceUrl, 302);
        if (c.status !== 'PENDING' && c.status !== 'OVERDUE') return json(409, { erro: 'Esta cobrança não está mais aberta. Fale com a recepção.' });
        if (c.billingType !== forma) await chamar(env, `/payments/${encodeURIComponent(id)}`, { method: 'POST', body: JSON.stringify({ billingType: forma }) });
        return Response.redirect(c.invoiceUrl, 302);
      }
      if (p === '/api/grupo/pagamento' && req.method === 'GET') {
        const id = String(url.searchParams.get('id') ?? '');
        if (!/^pay_[A-Za-z0-9]{6,40}$/.test(id)) return json(400, { erro: 'Pagamento inválido.' });
        return json(200, await situacaoCobranca(env, id));
      }
      if (p === '/api/mobile/v1/internal/account-email') return await handleMobileAccountEmail(req, env);
      if (p === '/api/mobile/v1/internal/conta-admin') return await handleMobileContaAdmin(req, env);
      if (p.startsWith('/api/mobile/v1/auth/')) {
        const resposta = await handleMobileAuth(req, env);
        // e-mail confirmado: a conta vira candidata ao vínculo agora, não no próximo ciclo
        if (p === '/api/mobile/v1/auth/email/verify' && resposta.ok) ctx.waitUntil(pedirVinculo(env));
        return resposta;
      }
      if (p === '/api/mobile/v1/internal/identity-wait') return await esperarPedidoDeVinculo(req, env);
      if (p === '/api/mobile/v1/coupons/preview' || p.startsWith('/api/mobile/v1/coupons/preview/')) {
        return await handleMobileCoupons(req, env);
      }
      if (p === '/api/mobile/v1/internal/results' || p === '/api/mobile/v1/internal/identity-links' || p === '/api/mobile/v1/internal/identity-candidates' ||
          p === '/api/mobile/v1/results' || p === '/api/mobile/v1/results/me') {
        const resposta = await handleMobileResults(req, env);
        // cliente abriu o histórico e ainda não está vinculado: pede o vínculo agora
        if (p === '/api/mobile/v1/results/me' && resposta.ok) {
          const corpo = await resposta.clone().json().catch(() => null) as { vinculo?: string } | null;
          if (corpo?.vinculo === 'pendente') ctx.waitUntil(pedirVinculo(env));
        }
        return resposta;
      }
      if (p === '/api/mobile/v1/live' || p === '/api/mobile/v1/live/ws') return await handleMobileLive(req, env);
      if (p === '/api/mobile/v1/conta/perfil' || p === '/api/mobile/v1/internal/perfil') return await handleMobilePerfil(req, env);
      if (p === '/api/mobile/v1/internal/ranking' || p === '/api/mobile/v1/ranking' || p.startsWith('/api/mobile/v1/ranking/')) return await handleMobileRanking(req, env);
      if (p === '/api/mobile/v1/internal/outbox' || p.startsWith('/api/mobile/v1/internal/outbox/')) return await handleMobileOutbox(req, env);
      if (p === '/api/mobile/v1/agenda' || p === '/api/mobile/v1/reservations' || p.startsWith('/api/mobile/v1/reservations/')) {
        return await handleMobileReservations(req, env);
      }
      // reserva online (reservas.kartodromodebetim.com.br)
      if (p === '/api/agenda' && req.method === 'GET') return await agendaPublica(req, env);
      if (p === '/api/reservas' && req.method === 'POST') return await criarPedido(req, env, (ip) => excedeuLimite(ip, 'reserva'));
      if (p === '/api/reservas/politica' && req.method === 'GET') return politicaPublica();
      if (p.startsWith('/api/reservas/') && req.method === 'GET') {
        const id = p.slice('/api/reservas/'.length);
        if (env.MOBILE_DB) {
          const mobileOrder = await env.MOBILE_DB.prepare('SELECT 1 FROM mobile_orders WHERE pedido_id = ? LIMIT 1').bind(id).first();
          if (mobileOrder) return json(404, { erro: 'Reserva não encontrada.' });
        }
        return await situacaoPedido(env, id, ctx);
      }
      if (p === '/api/asaas/webhook' && req.method === 'POST') return await webhookAsaas(req, env);
      if (p.startsWith('/api/sync/')) {
        if (!autorizado(req, env)) return json(401, { erro: 'Não autorizado.' });
        const sync = await rotasSync(req, env, p);
        if (sync) return sync;
        if (p === '/api/sync/pendentes' && req.method === 'GET') return json(200, await listar(env));
        if (p === '/api/sync/buscar' && req.method === 'GET') return json(200, await buscar(env, url.searchParams.get('q') ?? ''));
        if (p === '/api/sync/concluir' && req.method === 'POST') {
          const { keys } = (await req.json()) as { keys?: string[] };
          const validas = (keys ?? []).filter((k) => /^pendentes\/[A-Z0-9]+\.json$/.test(k));
          if (validas.length) await env.PRE.delete(validas);
          return json(200, { apagados: validas.length });
        }
        if (p === '/api/sync/agenda' && req.method === 'PUT') return await syncAgenda(req, env);
        // resumo das reservas em grupo ativas: o link único mostra quem reservou e cobra a vaga (um arquivo só, não um por link)
        if (p === '/api/sync/grupos' && req.method === 'PUT') {
          const { grupos } = (await req.json()) as { grupos?: GrupoDoLink[] };
          const lista = (Array.isArray(grupos) ? grupos.slice(0, 500) : []).filter((g) => Array.isArray(g.tokens));
          await env.PRE.put('grupos/todos.json', JSON.stringify(lista), { httpMetadata: { contentType: 'application/json' } });
          cacheGrupos = null;
          esquecerGrupos();
          return json(200, { gravados: lista.length });
        }
        if (p === '/api/sync/asaas' && req.method === 'GET') return json(200, await diagnostico(env));
        if (p === '/api/sync/campeonato/cobranca' && req.method === 'POST') {
          const c = (await req.json()) as Record<string, unknown>;
          const dadosCli = {
            nome: String(c.nome ?? ''),
            cpf: String(c.cpf ?? '').replace(/\D/g, ''),
            email: String(c.email ?? ''),
            celular: String(c.celular ?? '').replace(/\D/g, ''),
            referencia: String(c.referencia ?? ''),
          };
          let cliente: string;
          try {
            cliente = await garantirCliente(env, dadosCli);
          } catch (erroCli) {
            if (!/celular|mobilePhone/i.test((erroCli as Error).message)) throw erroCli;
            cliente = await garantirCliente(env, { ...dadosCli, celular: '' });
          }
          const valor = Math.round(Number(c.valorCentavos)) / 100;
          const n = c.forma === 'cartao' ? Math.min(5, Math.max(1, Math.trunc(Number(c.parcelas)) || 1)) : 1;
          const cob = await chamar<{ id: string; invoiceUrl: string; status: string }>(env, '/payments', {
            method: 'POST',
            body: JSON.stringify({
              customer: cliente,
              billingType: c.forma === 'cartao' ? 'CREDIT_CARD' : 'PIX',
              ...(n > 1 ? { installmentCount: n, totalValue: valor } : { value: valor }),
              dueDate: String(c.vencimento ?? hojeBrasilia()),
              description: String(c.descricao ?? '').slice(0, 500),
              externalReference: String(c.referencia ?? '').slice(0, 100),
            }),
          });
          return json(201, { id: cob.id, link: cob.invoiceUrl, status: cob.status });
        }
        const mCamp = p.match(/^\/api\/sync\/campeonato\/cobranca\/([A-Za-z0-9_]{6,40})$/);
        if (mCamp && req.method === 'GET') {
          const c = await consultar(env, mCamp[1]);
          return json(200, { id: c.id, status: c.status, pago: PAGO.has(c.status), forma: c.billingType });
        }
        if (mCamp && req.method === 'DELETE') {
          const c = await chamar<{ id: string; installment?: string }>(env, `/payments/${encodeURIComponent(mCamp[1])}`);
          if (c.installment) {
            return json(200, await chamar(env, `/installments/${encodeURIComponent(c.installment)}`, { method: 'DELETE' }));
          }
          return json(200, await cancelar(env, mCamp[1]));
        }
        if (p === '/api/sync/campeonato/cobrancas' && req.method === 'GET') {
          const cpf = (url.searchParams.get('cpf') ?? '').replace(/\D/g, '');
          const cli = await chamar<{ data?: { id: string }[] }>(env, `/customers?cpfCnpj=${cpf}&limit=1`);
          const id = cli.data?.[0]?.id;
          if (!id) return json(200, []);
          const r = await chamar<{ data?: { id: string; status: string; value: number; installment?: string; deleted: boolean; externalReference?: string }[] }>(env, `/payments?customer=${id}&limit=50`);
          return json(200, (r.data ?? []).map((x) => ({
            id: x.id,
            status: x.status,
            valor: x.value,
            parcelamento: x.installment ?? null,
            deleted: x.deleted,
            ref: x.externalReference ?? null,
          })));
        }
        if (p === '/api/sync/cobranca' && req.method === 'POST') {
          const c = (await req.json()) as Record<string, unknown>;
          const dadosCli = {
            nome: String(c.nome ?? ''),
            cpf: String(c.cpf ?? '').replace(/\D/g, ''),
            email: String(c.email ?? ''),
            celular: String(c.celular ?? '').replace(/\D/g, ''),
            referencia: String(c.referencia ?? ''),
          };
          let cliente: string;
          try {
            cliente = await garantirCliente(env, dadosCli);
          } catch (erroCli) {
            if (!/celular|mobilePhone/i.test((erroCli as Error).message)) throw erroCli;
            cliente = await garantirCliente(env, { ...dadosCli, celular: '' });
          }
          const hoje = hojeBrasilia();
          const venc = String(c.vencimento ?? '');
          const dueDate = /^\d{4}-\d{2}-\d{2}$/.test(venc) && venc >= hoje ? venc : hoje;
          const cob = await chamar<{ id: string; invoiceUrl: string; status: string }>(env, '/payments', {
            method: 'POST',
            body: JSON.stringify({
              customer: cliente,
              // nunca boleto (dono, 12/11/2026): nasce Pix; o cartão sai pela página /pagar (troca a forma da mesma cobrança)
              billingType: 'PIX',
              value: Math.round(Number(c.valorCentavos)) / 100,
              dueDate,
              description: String(c.descricao ?? '').slice(0, 500),
              externalReference: String(c.referencia ?? '').slice(0, 100),
            }),
          });
          return json(201, { id: cob.id, link: `${SITE}/pagar?id=${cob.id}`, invoiceUrl: cob.invoiceUrl, status: cob.status });
        }
        // cobranças antigas criadas com a forma livre (a fatura da Asaas oferecia boleto): passam para Pix (12/11/2026)
        if (p === '/api/sync/cobrancas/sem-boleto' && req.method === 'POST') {
          const { ids } = (await req.json().catch(() => ({}))) as { ids?: unknown[] };
          const res: Record<string, string> = {};
          for (const id of (Array.isArray(ids) ? ids : []).map(String).filter((x) => /^pay_[A-Za-z0-9]{6,40}$/.test(x)).slice(0, 40)) {
            try {
              const c = await consultar(env, id);
              if (c.status !== 'PENDING' && c.status !== 'OVERDUE') { res[id] = 'fechada'; continue; }
              if (c.billingType === 'PIX' || c.billingType === 'CREDIT_CARD') { res[id] = 'ok'; continue; }
              await chamar(env, `/payments/${encodeURIComponent(id)}`, { method: 'POST', body: JSON.stringify({ billingType: 'PIX' }) });
              res[id] = 'convertida';
            } catch (e) { res[id] = 'erro: ' + (e as Error).message.slice(0, 120); if (/Cota/i.test((e as Error).message)) break; }
          }
          return json(200, res);
        }
        const mGrupo = p.match(/^\/api\/sync\/cobranca\/([A-Za-z0-9_]{6,40})$/);
        if (mGrupo && req.method === 'GET') {
          const c = await situacaoCobranca(env, mGrupo[1]);
          return json(200, { id: mGrupo[1], status: c.status, pago: c.pago, forma: c.forma });
        }
        if (mGrupo && req.method === 'DELETE') {
          return json(200, await cancelar(env, mGrupo[1]));
        }
        // pagamentos de grupo avisados pelo webhook da Asaas (gravados em grupos/pagos/): o SRVKART lê e limpa.
        // Existiam só no bundle remendado e sumiram no deploy do fonte; sem elas o pagamento só chegava consultando a Asaas.
        if (p === '/api/sync/grupos/pagos' && req.method === 'GET') {
          const lista = await env.PRE.list({ prefix: 'grupos/pagos/', limit: 200 });
          const itens: unknown[] = [];
          for (const o of lista.objects) { const d = await env.PRE.get(o.key); if (d) itens.push(await d.json()); }
          return json(200, itens);
        }
        if (p === '/api/sync/grupos/pagos/limpar' && req.method === 'POST') {
          const { ids } = (await req.json().catch(() => ({}))) as { ids?: unknown[] };
          const validos = (Array.isArray(ids) ? ids : []).map(String).filter((id) => /^pay_[A-Za-z0-9_]+$/.test(id)).slice(0, 200);
          for (const id of validos) await env.PRE.delete(`grupos/pagos/${id}.json`);
          return json(200, { ok: true, removidos: validos.length });
        }
        if (p === '/api/sync/lembretes' && req.method === 'POST') return await lembretesSync(req, env);
        if (p === '/api/sync/mobile/coupons' || p.startsWith('/api/sync/mobile/coupons/')) return await handleMobileCouponsSync(req, env);
        if (p === '/api/sync/pedidos' && req.method === 'GET') return await syncPedidos(env);
        if (p === '/api/sync/pedido' && req.method === 'POST') return await syncResultado(req, env, ctx);
      }
      if (p.startsWith('/api/')) return json(404, { erro: 'Rota desconhecida.' });
      // endereço único (12/11/2026): as páginas de cadastro.* abrem em reservas.* (link do grupo, pré-cadastro do QR e painel).
      // /conta e /privacidade ficam (links do app e dos e-mails). O que já veio pelo site de reservas tem a marca e não volta.
      if (url.hostname.startsWith('cadastro.') && !req.headers.get('x-kib-via-reservas') && (req.method === 'GET' || req.method === 'HEAD')
          && ['/', '/index.html', '/painel', '/painel.html'].includes(p)) {
        const alvo = new URL(url);
        alvo.hostname = 'reservas.kartodromodebetim.com.br';
        alvo.pathname = p.startsWith('/painel') ? '/painel' : url.searchParams.get('r') || url.searchParams.get('token') ? '/' : '/cadastro';
        return Response.redirect(alvo.toString(), 302);
      }
      // reservas.kartodromodebetim.com.br abre direto a página de reserva
      if (p === '/' && url.hostname.startsWith('reservas.')) return env.ASSETS.fetch(new Request(new URL('/reservar', url), req));
      return env.ASSETS.fetch(req);
    } catch (e) {
      console.error('pre-cadastro', (e as Error).message);
      return json(500, { erro: 'Não foi possível salvar agora. Tente de novo em instantes.' });
    }
  },
} satisfies ExportedHandler<Env>;
