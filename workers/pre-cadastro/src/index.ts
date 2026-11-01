/**
 * Pré-cadastro online (cadastro.kartodromodebetim.com.br).
 * O cliente preenche no celular os mesmos dados do totem (menos a bateria). O cadastro fica no R2 só até o
 * servidor da operação (SRVKART) buscar pelo /api/sync, gravar na tabela de clientes e apagar daqui.
 * No totem o cliente digita CPF, RG, passaporte ou e-mail e os dados já aparecem.
 */
import { chaveDocumento, validar } from './validar';
import { cancelar, consultar, criarCobrancaLink, diagnostico, garantirCliente, PAGO } from './asaas';
import { agendaPublica, criarPedido, politicaPublica, situacaoPedido, syncAgenda, syncPedidos, syncResultado, webhookAsaas, type EnvReservas } from './reservas';

export interface Env extends EnvReservas {
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
  const chave = chaveDocumento(v.dados.tipoDocumento, v.dados.documento);
  // link da reserva em grupo (painel web): só o código; o SRVKART põe a vaga no nome desta pessoa
  const reserva = /^[A-Za-z0-9]{10,24}$/.test(String(corpo.reserva ?? '')) ? String(corpo.reserva) : undefined;
  const registro = { chave, recebidoEm: new Date().toISOString(), ...v.dados, ...(reserva ? { reserva } : {}) };
  // um cadastro por documento: se a pessoa enviar de novo, vale o último
  await env.PRE.put(`pendentes/${chave}.json`, JSON.stringify(registro), { httpMetadata: { contentType: 'application/json' } });
  return json(201, { ok: true, nome: v.dados.nome.split(' ')[0] });
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
      if (p === '/api/pre-cadastro' && req.method === 'POST') return await receber(req, env);
      // reserva online (reservas.kartodromodebetim.com.br)
      if (p === '/api/agenda' && req.method === 'GET') return await agendaPublica(req, env);
      if (p === '/api/reservas' && req.method === 'POST') return await criarPedido(req, env, (ip) => excedeuLimite(ip, 'reserva'));
      if (p === '/api/reservas/politica' && req.method === 'GET') return politicaPublica();
      if (p.startsWith('/api/reservas/') && req.method === 'GET') return await situacaoPedido(env, p.slice('/api/reservas/'.length), ctx);
      if (p === '/api/asaas/webhook' && req.method === 'POST') return await webhookAsaas(req, env);
      if (p.startsWith('/api/sync/')) {
        if (!autorizado(req, env)) return json(401, { erro: 'Não autorizado.' });
        if (p === '/api/sync/pendentes' && req.method === 'GET') return json(200, await listar(env));
        if (p === '/api/sync/buscar' && req.method === 'GET') return json(200, await buscar(env, url.searchParams.get('q') ?? ''));
        if (p === '/api/sync/concluir' && req.method === 'POST') {
          const { keys } = (await req.json()) as { keys?: string[] };
          const validas = (keys ?? []).filter((k) => /^pendentes\/[A-Z0-9]+\.json$/.test(k));
          if (validas.length) await env.PRE.delete(validas);
          return json(200, { apagados: validas.length });
        }
        if (p === '/api/sync/agenda' && req.method === 'PUT') return await syncAgenda(req, env);
        if (p === '/api/sync/asaas' && req.method === 'GET') return json(200, await diagnostico(env));
        if (p === '/api/sync/pedidos' && req.method === 'GET') return await syncPedidos(env);
        if (p === '/api/sync/pedido' && req.method === 'POST') return await syncResultado(req, env, ctx);
        // cobrança da reserva em grupo (painel web): link da Asaas (Pix ou cartão) para um piloto ou para o grupo
        if (p === '/api/sync/cobranca' && req.method === 'POST') {
          const c = (await req.json()) as { nome: string; cpf: string; email?: string; celular?: string; valorCentavos: number; descricao: string; referencia: string; vencimento: string };
          const cliente = await garantirCliente(env, { nome: c.nome, cpf: String(c.cpf ?? '').replace(/\D/g, ''), email: c.email ?? '', celular: String(c.celular ?? '').replace(/\D/g, ''), referencia: c.referencia });
          const cob = await criarCobrancaLink(env, cliente, c.valorCentavos, c.descricao, c.referencia, c.vencimento);
          return json(201, { id: cob.id, link: cob.invoiceUrl, status: cob.status });
        }
        const mc = p.match(/^\/api\/sync\/cobranca\/([A-Za-z0-9_]{6,40})$/);
        if (mc && req.method === 'GET') { const c = await consultar(env, mc[1]); return json(200, { id: c.id, status: c.status, pago: PAGO.has(c.status), forma: c.billingType }); }
        if (mc && req.method === 'DELETE') return json(200, await cancelar(env, mc[1]));
      }
      if (p.startsWith('/api/')) return json(404, { erro: 'Rota desconhecida.' });
      // reservas.kartodromodebetim.com.br abre direto a página de reserva
      if (p === '/' && url.hostname.startsWith('reservas.')) return env.ASSETS.fetch(new Request(new URL('/reservar', url), req));
      return env.ASSETS.fetch(req);
    } catch (e) {
      console.error('pre-cadastro', (e as Error).message);
      return json(500, { erro: 'Não foi possível salvar agora. Tente de novo em instantes.' });
    }
  },
} satisfies ExportedHandler<Env>;
