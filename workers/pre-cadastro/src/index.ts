/**
 * Pré-cadastro online (cadastro.kartodromodebetim.com.br).
 * O cliente preenche no celular os mesmos dados do totem (menos a bateria). O cadastro fica no R2 só até o
 * servidor da operação (SRVKART) buscar pelo /api/sync, gravar na tabela de clientes e apagar daqui.
 * No totem o cliente digita CPF, RG, passaporte ou e-mail e os dados já aparecem.
 */
import { chaveDocumento, validar } from './validar';
import { diagnostico } from './asaas';
import { agendaPublica, criarPedido, politicaPublica, situacaoPedido, syncAgenda, syncPedidos, syncResultado, webhookAsaas, type EnvReservas } from './reservas';
import { handleMobileAccountEmail, handleMobileAuth, type MobileAccountAdminEnv } from './mobile/auth';
import { handleMobileReservations } from './mobile/reservations';
import { handleMobileCoupons, handleMobileCouponsSync } from './mobile/coupons';
import { handleMobileResults, type MobileResultsEnv } from './mobile/results';
import { handleMobileLive, type MobileLiveEnv } from './mobile/live';
export { AoVivo } from './mobile/live';
import { handleMobilePerfil, type MobilePerfilEnv } from './mobile/perfil';
import { handleMobileRanking } from './mobile/ranking';
import { handleMobileOutbox } from './mobile/outbox';

export interface Env extends EnvReservas, MobileAccountAdminEnv, MobileResultsEnv, MobileLiveEnv, MobilePerfilEnv {
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
  const registro = { chave, recebidoEm: new Date().toISOString(), ...v.dados };
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
      if (p === '/api/mobile/v1/internal/account-email') return await handleMobileAccountEmail(req, env);
      if (p.startsWith('/api/mobile/v1/auth/')) return await handleMobileAuth(req, env);
      if (p === '/api/mobile/v1/coupons/preview' || p.startsWith('/api/mobile/v1/coupons/preview/')) {
        return await handleMobileCoupons(req, env);
      }
      if (p === '/api/mobile/v1/internal/results' || p === '/api/mobile/v1/internal/identity-links' || p === '/api/mobile/v1/internal/identity-candidates' ||
          p === '/api/mobile/v1/results' || p === '/api/mobile/v1/results/me') {
        return await handleMobileResults(req, env);
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
        if (p === '/api/sync/mobile/coupons' || p.startsWith('/api/sync/mobile/coupons/')) return await handleMobileCouponsSync(req, env);
        if (p === '/api/sync/pedidos' && req.method === 'GET') return await syncPedidos(env);
        if (p === '/api/sync/pedido' && req.method === 'POST') return await syncResultado(req, env, ctx);
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
