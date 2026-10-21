/**
 * Ranking e carreira dos pilotos no app. O SRVKART calcula (mesma base do ranking do admin: melhor volta por traçado,
 * semana/mês/geral) e publica aqui de 10 em 10 minutos só o que é público — nome, tempos, posições e contagens de
 * corridas. Nada de CPF, telefone, nascimento ou compras.
 *
 *   POST /api/mobile/v1/internal/ranking          (x-mobile-admin-token) { itens: [{ chave, dados }], limpar? }
 *   GET  /api/mobile/v1/ranking?periodo=&tracado= ranking de um período/traçado
 *   GET  /api/mobile/v1/ranking/pilotos/:id       carreira de um piloto
 *   GET  /api/mobile/v1/ranking/me                carreira do dono da sessão (conta vinculada ao cadastro)
 */
import { authenticateMobileRequest, type MobileAuthEnv } from './auth';

export interface MobileRankingEnv extends MobileAuthEnv {
  MOBILE_DB?: D1Database;
  MOBILE_ADMIN_TOKEN?: string;
  PRE?: R2Bucket;
}

// foto do piloto (enviada pelo próprio app): JPEG de até 1,5 MB no R2, em fotos-app/<cliente>.jpg
const FOTO_MAX = 1_500_000;
const fotoChave = (cliente: string) => `fotos-app/${cliente}.jpg`;

async function enviarFoto(request: Request, env: MobileRankingEnv, cliente: string) {
  if (!env.PRE) return json(503, { erro: 'Serviço temporariamente indisponível.' });
  if (request.headers.get('content-type') !== 'image/jpeg') return json(415, { erro: 'Envie a foto em JPEG.' });
  if (Number(request.headers.get('content-length') ?? 0) > FOTO_MAX) return json(413, { erro: 'A foto é grande demais.' });
  const bytes = new Uint8Array(await request.arrayBuffer());
  // começo de todo JPEG: FF D8 FF
  if (bytes.length < 100 || bytes.length > FOTO_MAX || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) return json(400, { erro: 'Arquivo de imagem inválido.' });
  await env.PRE.put(fotoChave(cliente), bytes, { httpMetadata: { contentType: 'image/jpeg' }, customMetadata: { enviadaEm: new Date().toISOString() } });
  return json(200, { ok: true, versao: Date.now() });
}

async function lerFoto(env: MobileRankingEnv, cliente: string) {
  const obj = env.PRE ? await env.PRE.get(fotoChave(cliente)) : null;
  if (!obj) return new Response(null, { status: 404, headers: { 'cache-control': 'public, max-age=300' } });
  return new Response(obj.body, { headers: { 'content-type': 'image/jpeg', 'cache-control': 'public, max-age=300', etag: obj.httpEtag } });
}

const json = (status: number, body: unknown, maxAge = 0) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': maxAge ? `public, max-age=${maxAge}` : 'no-store' },
});

const encoder = new TextEncoder();
function constantTimeEqual(a: string, b: string) {
  const x = encoder.encode(a), y = encoder.encode(b);
  if (x.length !== y.length) return false;
  let dif = 0;
  for (let i = 0; i < x.length; i++) dif |= x[i] ^ y[i];
  return dif === 0;
}

const CHAVE = /^(ranking|piloto:\d{1,12})$/;
const LIMITE_CORPO = 4_000_000;

// a tabela também é criada aqui (mesmo SQL da migration 0007): o wrangler local não tem permissão de D1
let tabelaPronta = false;
async function garantirTabela(env: MobileRankingEnv) {
  if (tabelaPronta) return;
  await env.MOBILE_DB!.prepare('CREATE TABLE IF NOT EXISTS mobile_ranking (chave TEXT PRIMARY KEY, dados TEXT NOT NULL, atualizado_em INTEGER NOT NULL)').run();
  tabelaPronta = true;
}

async function receber(request: Request, env: MobileRankingEnv) {
  if (!constantTimeEqual(request.headers.get('x-mobile-admin-token') ?? '', env.MOBILE_ADMIN_TOKEN!)) return json(401, { erro: 'Não autorizado.' });
  if (Number(request.headers.get('content-length') ?? 0) > LIMITE_CORPO) return json(413, { erro: 'Envio grande demais.' });
  const raw = await request.text();
  if (raw.length > LIMITE_CORPO) return json(413, { erro: 'Envio grande demais.' });
  let corpo: { itens?: { chave?: unknown; dados?: unknown }[]; limpar?: unknown };
  try { corpo = JSON.parse(raw); } catch { return json(400, { erro: 'JSON inválido.' }); }
  const itens = Array.isArray(corpo.itens) ? corpo.itens : [];
  if (!itens.length || itens.length > 2000) return json(400, { erro: 'Envie de 1 a 2000 itens.' });
  await garantirTabela(env);
  const agora = Date.now();
  const stmts: D1PreparedStatement[] = [];
  for (const it of itens) {
    if (typeof it.chave !== 'string' || !CHAVE.test(it.chave) || it.dados === null || typeof it.dados !== 'object') return json(400, { erro: 'Item inválido.' });
    stmts.push(env.MOBILE_DB!.prepare(
      'INSERT INTO mobile_ranking(chave, dados, atualizado_em) VALUES (?, ?, ?) ON CONFLICT(chave) DO UPDATE SET dados = excluded.dados, atualizado_em = excluded.atualizado_em',
    ).bind(it.chave, JSON.stringify(it.dados), agora));
  }
  for (let i = 0; i < stmts.length; i += 100) await env.MOBILE_DB!.batch(stmts.slice(i, i + 100));
  // fim da publicação: apaga pilotos que saíram do ranking (não foram reenviados nesta rodada)
  if (typeof corpo.limpar === 'number' && corpo.limpar > 0) {
    await env.MOBILE_DB!.prepare("DELETE FROM mobile_ranking WHERE chave LIKE 'piloto:%' AND atualizado_em < ?").bind(corpo.limpar).run();
  }
  return json(200, { ok: true, gravados: stmts.length });
}

async function ler(env: MobileRankingEnv, chave: string) {
  await garantirTabela(env);
  const row = await env.MOBILE_DB!.prepare('SELECT dados, atualizado_em FROM mobile_ranking WHERE chave = ?').bind(chave).first<{ dados: string; atualizado_em: number }>();
  return row ? { dados: JSON.parse(row.dados) as Record<string, unknown>, atualizadoEm: new Date(row.atualizado_em).toISOString() } : null;
}

type Tracado = { nome: string; pilotos: number; linhas: unknown[] };
type Periodo = { de: string | null; ate: string | null; tracados: Tracado[] };

async function ranking(url: URL, env: MobileRankingEnv) {
  const r = await ler(env, 'ranking');
  if (!r) return json(503, { erro: 'O ranking ainda está sendo preparado. Tente de novo em alguns minutos.' });
  const periodos = (r.dados.periodos ?? {}) as Record<string, Periodo>;
  const nome = ['semana', 'mes', 'geral'].includes(url.searchParams.get('periodo') ?? '') ? url.searchParams.get('periodo')! : 'semana';
  const per = periodos[nome] ?? { de: null, ate: null, tracados: [] };
  const pedido = url.searchParams.get('tracado');
  const escolhido = per.tracados.find((t) => t.nome === pedido) ?? per.tracados[0] ?? null;
  return json(200, {
    periodo: nome,
    de: per.de,
    ate: per.ate,
    tracados: per.tracados.map((t) => ({ nome: t.nome, pilotos: t.pilotos })),
    tracado: escolhido?.nome ?? null,
    linhas: escolhido?.linhas ?? [],
    atualizadoEm: r.atualizadoEm,
  }, 60);
}

async function piloto(id: string, env: MobileRankingEnv, publico = true) {
  const r = await ler(env, 'piloto:' + id);
  if (!r) return json(404, { erro: 'Piloto sem corridas no ranking.' });
  return json(200, { id, ...r.dados, atualizadoEm: r.atualizadoEm }, publico ? 60 : 0);
}

/** sessão do app → cliente vinculado (mesma regra do histórico: só conta vinculada ao cadastro do kartódromo) */
async function clienteDaSessao(request: Request, env: MobileRankingEnv) {
  const conta = await authenticateMobileRequest(request, env);
  if (!conta) return null;
  const row = await env.MOBILE_DB!.prepare('SELECT customer_id FROM mobile_identity_links WHERE account_id = ?').bind(conta.id).first<{ customer_id: string }>();
  return row?.customer_id ?? null;
}

export async function handleMobileRanking(request: Request, env: MobileRankingEnv) {
  if (!env.MOBILE_DB || !env.MOBILE_ADMIN_TOKEN) return json(503, { erro: 'Serviço temporariamente indisponível.' });
  const url = new URL(request.url);
  const p = url.pathname;
  try {
    if (p === '/api/mobile/v1/internal/ranking') return request.method === 'POST' ? await receber(request, env) : json(405, { erro: 'Método não permitido.' });
    if (p === '/api/mobile/v1/ranking/me/foto') {
      const cliente = await clienteDaSessao(request, env);
      if (!cliente) return json(404, { erro: 'Sua conta ainda não está ligada ao seu cadastro no kartódromo.' });
      if (request.method === 'PUT') return await enviarFoto(request, env, cliente);
      if (request.method === 'DELETE') { await env.PRE?.delete(fotoChave(cliente)); return json(200, { ok: true }); }
      return json(405, { erro: 'Método não permitido.' });
    }
    if (request.method !== 'GET') return json(405, { erro: 'Método não permitido.' });
    const mf = /^\/api\/mobile\/v1\/ranking\/pilotos\/(\d{1,12})\/foto$/.exec(p);
    if (mf) return await lerFoto(env, mf[1]);
    if (p === '/api/mobile/v1/ranking') return await ranking(url, env);
    if (p === '/api/mobile/v1/ranking/me') {
      const cliente = await clienteDaSessao(request, env);
      if (!cliente) return json(404, { erro: 'Sua conta ainda não está ligada ao seu cadastro no kartódromo.' });
      return await piloto(cliente, env, false);
    }
    const m = /^\/api\/mobile\/v1\/ranking\/pilotos\/(\d{1,12})$/.exec(p);
    if (m) return await piloto(m[1], env);
    return json(404, { erro: 'Rota desconhecida.' });
  } catch {
    return json(503, { erro: 'Serviço temporariamente indisponível.' });
  }
}
