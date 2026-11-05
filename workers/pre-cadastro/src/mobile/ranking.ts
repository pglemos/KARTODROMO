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
import { montarRanking, type LinhaCompleta } from './ranking-data';
import { receberClientes } from './clientes';
import { filtrarKarts, type VoltaKart } from './karts';

export interface MobileRankingEnv extends MobileAuthEnv {
  MOBILE_DB?: D1Database;
  MOBILE_ADMIN_TOKEN?: string;
  PRE?: R2Bucket;
}

// foto do piloto (enviada pelo próprio app): imagem de até 1,5 MB no R2, em fotos-app/<cliente>.jpg
const FOTO_MAX = 1_500_000;
const fotoChave = (cliente: string) => `fotos-app/${cliente}.jpg`;
const FOTO_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);

const MARCAS_HEIF = new Set(['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'mif1', 'msf1']);

/** Identifica a imagem pelos primeiros bytes. `ftyp` sozinho não basta: vídeos MP4 também o têm. */
export function tipoDaImagem(bytes: Uint8Array): string | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((v, i) => bytes[i] === v)) return 'image/png';
  if (bytes.length < 12) return null;
  const texto = (de: number, ate: number) => String.fromCharCode(...bytes.slice(de, ate));
  if (texto(0, 4) === 'RIFF' && texto(8, 12) === 'WEBP') return 'image/webp';
  if (texto(4, 8) === 'ftyp' && MARCAS_HEIF.has(texto(8, 12))) return 'image/heic';
  return null;
}

async function enviarFoto(request: Request, env: MobileRankingEnv, cliente: string) {
  if (!env.PRE) return json(503, { erro: 'Serviço temporariamente indisponível.' });
  const contentType = (request.headers.get('content-type') ?? '').split(';', 1)[0].trim().toLowerCase();
  if (!FOTO_TYPES.has(contentType)) return json(415, { erro: 'Formato de foto não aceito. Escolha JPEG, PNG, WebP ou HEIC.', codigo: 'UNSUPPORTED_IMAGE' });
  if (Number(request.headers.get('content-length') ?? 0) > FOTO_MAX) return json(413, { erro: 'A foto é grande demais. Escolha uma imagem de até 1,5 MB.', codigo: 'IMAGE_TOO_LARGE' });
  const bytes = new Uint8Array(await request.arrayBuffer());
  const detectado = tipoDaImagem(bytes);
  if (bytes.length < 100 || bytes.length > FOTO_MAX || !detectado) return json(400, { erro: 'Arquivo de imagem inválido.', codigo: 'INVALID_IMAGE' });
  // o tipo gravado vem do conteúdo, não do que o aparelho declarou
  await env.PRE.put(fotoChave(cliente), bytes, { httpMetadata: { contentType: detectado }, customMetadata: { enviadaEm: new Date().toISOString() } });
  return json(200, { ok: true, versao: Date.now() });
}

async function lerFoto(env: MobileRankingEnv, cliente: string) {
  const obj = env.PRE ? await env.PRE.get(fotoChave(cliente)) : null;
  if (!obj) return new Response(null, { status: 404, headers: { 'cache-control': 'public, max-age=300' } });
  const metadata = (obj as R2ObjectBody & { httpMetadata?: { contentType?: string } }).httpMetadata;
  return new Response(obj.body, { headers: { 'content-type': metadata?.contentType ?? 'image/jpeg', 'cache-control': 'public, max-age=300', etag: obj.httpEtag } });
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

const CHAVE = /^(ranking|piloto:\d{1,12}|karts:\d{4}-\d{2}-\d{2}|historico:\d{1,20}|posicoes:(semana|mes|geral):[a-z0-9-]{1,80})$/;
const PERIODOS_POSICAO = ['semana', 'mes', 'geral'] as const;

/** Mesma regra do SRVKART (lib/ops/pilotos.ts slugTracado). */
export function slugTracado(nome: string) {
  return nome.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'sem-nome';
}

/**
 * A ficha do piloto não guarda mais posição (mudava a cada bateria de qualquer um e regravava todas as fichas).
 * Aqui junta: para cada traçado da ficha e cada período, posição e total vêm do documento posicoes:<período>:<traçado>.
 * O SQLite extrai só a entrada do piloto (json_extract), sem trazer o documento inteiro para o Worker.
 * Sem documento ainda (antes da primeira publicação no formato novo), mantém o que a ficha tiver.
 */
export async function preencherPosicoes(db: D1Database, cid: string, dados: Record<string, unknown>) {
  const tracados = Array.isArray(dados.tracados) ? dados.tracados as Record<string, unknown>[] : [];
  if (!tracados.length || !/^\d{1,12}$/.test(cid)) return dados;
  const chaves = tracados.flatMap((t) => PERIODOS_POSICAO.map((p) => `posicoes:${p}:${slugTracado(String(t.nome ?? ''))}`));
  const { results } = await db.prepare(
    `SELECT chave, json_extract(dados, '$.de') de, json_extract(dados, '$.pos."' || ? || '"') pos
       FROM mobile_ranking WHERE chave IN (${chaves.map(() => '?').join(',')})`,
  ).bind(cid, ...chaves).all<{ chave: string; de: number | null; pos: number | null }>();
  const porChave = new Map(results.map((r) => [r.chave, r]));
  return {
    ...dados,
    tracados: tracados.map((t) => {
      const novo: Record<string, unknown> = { ...t };
      for (const p of PERIODOS_POSICAO) {
        const doc = porChave.get(`posicoes:${p}:${slugTracado(String(t.nome ?? ''))}`);
        if (!doc) continue;
        novo[p] = doc.pos != null && doc.de != null ? { pos: Number(doc.pos), de: Number(doc.de) } : null;
      }
      return novo;
    }),
  };
}
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
    if (it.chave.startsWith('historico:')) {
      const results = (it.dados as Record<string, unknown>).results;
      if (!Array.isArray(results) || results.length > 500 || results.some((result) => !result || typeof result !== 'object' || Array.isArray(result))) {
        return json(400, { erro: 'Histórico inválido.' });
      }
    }
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

function categoriaNormalizada(value: unknown) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
}

type VoltaDiaria = { id?: string; piloto: string; kart: string; categoria: string | null; tracado: string; dia: string; ms: number | null };

/** Um dia corrompido é ignorado (e registrado) em vez de derrubar o ranking inteiro. */
export function linhasDosDias(rows: { dados: string; atualizado_em: number }[]) {
  const linhas = rows.flatMap((row) => {
    try {
      const dia = (JSON.parse(row.dados) as { linhas?: VoltaDiaria[] }).linhas;
      return Array.isArray(dia) ? dia : [];
    } catch {
      console.error('mobile-ranking', 'registro diário inválido ignorado');
      return [];
    }
  }).filter((l) => l.ms !== null).map((l) => ({ ...l, nome: l.piloto, ms: l.ms! }));
  return { linhas, atualizadoEm: Math.max(0, ...rows.map((row) => row.atualizado_em)) };
}

// O app atualiza a cada 15 s e troca de filtro na hora. Guardar só os dias lidos (e não a resposta) evita reler e
// reprocessar o banco a cada pedido, sem misturar os filtros.
const CACHE_DIAS_MS = 30_000;
const cacheDias = new WeakMap<D1Database, Map<string, { em: number; valor: ReturnType<typeof linhasDosDias> }>>();

async function diasDoRanking(db: D1Database, de: string, ate: string) {
  const porBanco = cacheDias.get(db) ?? new Map<string, { em: number; valor: ReturnType<typeof linhasDosDias> }>();
  cacheDias.set(db, porBanco);
  const chave = `${de}|${ate}`;
  const guardado = porBanco.get(chave);
  if (guardado && Date.now() - guardado.em < CACHE_DIAS_MS) return guardado.valor;
  const { results } = await db.prepare('SELECT dados, atualizado_em FROM mobile_ranking WHERE chave >= ? AND chave <= ? ORDER BY chave')
    .bind('karts:' + de, 'karts:' + ate).all<{ dados: string; atualizado_em: number }>();
  const valor = linhasDosDias(results);
  porBanco.set(chave, { em: Date.now(), valor });
  return valor;
}

async function ranking(url: URL, env: MobileRankingEnv) {
  const r = await ler(env, 'ranking');
  if (!r) return json(503, { erro: 'O ranking ainda está sendo preparado. Tente de novo em alguns minutos.' });
  const periodos = (r.dados.periodos ?? {}) as Record<string, Periodo>;
  const pedidoPeriodo = url.searchParams.get('periodo') ?? 'semana';
  if (!['dia', 'semana', 'mes', 'geral'].includes(pedidoPeriodo)) return json(400, { erro: 'Período inválido.', codigo: 'INVALID_PERIOD' });
  const nome = pedidoPeriodo;
  const per = periodos[nome] ?? periodos.geral ?? { de: null, ate: null, tracados: [] };
  const diaPedido = url.searchParams.get('dia');
  const diaValido = diaPedido && /^\d{4}-\d{2}-\d{2}$/.test(diaPedido) && Number.isFinite(Date.parse(`${diaPedido}T12:00:00Z`)) && new Date(`${diaPedido}T12:00:00Z`).toISOString().slice(0, 10) === diaPedido;
  if (diaPedido && !diaValido) return json(400, { erro: 'Data inválida.', codigo: 'INVALID_DATE' });
  const dia = diaPedido || null;
  const categoriaBruta = categoriaNormalizada(url.searchParams.get('categoria'));
  if (categoriaBruta && categoriaBruta !== 'todos' && categoriaBruta !== 'indoor' && categoriaBruta !== 'super kart' && categoriaBruta !== 'superkart') return json(400, { erro: 'Categoria inválida.', codigo: 'INVALID_CATEGORY' });
  const categoria = categoriaBruta === 'superkart' ? 'super kart' : categoriaBruta;
  const registros = await diasDoRanking(env.MOBILE_DB!, per.de ?? '0000-01-01', per.ate ?? '9999-12-31');
  const diarias = registros.linhas;
  const diasCompletos = new Set(diarias.map(l => l.dia));
  const antigas = per.tracados.flatMap(t => (t.linhas as LinhaCompleta[]).map(l => ({ ...l, tracado: t.nome })))
    .filter(l => !diasCompletos.has(l.dia));
  const completo = montarRanking([...antigas, ...diarias], url);
  // Filtros são interativos: cache intermediário fazia dia, traçado e categoria
  // exibirem a resposta anterior por até um minuto.
  return json(200, {
    periodo: nome,
    de: per.de,
    ate: per.ate,
    ...completo,
    dia,
    categoria: categoria || null,
    atualizadoEm: new Date(Math.max(Date.parse(r.atualizadoEm), registros.atualizadoEm)).toISOString(),
  });
}

async function piloto(id: string, env: MobileRankingEnv, publico = true) {
  const r = await ler(env, 'piloto:' + id);
  if (!r) return json(404, { erro: 'Piloto sem corridas no ranking.' });
  const dados = await preencherPosicoes(env.MOBILE_DB!, id, r.dados);
  return json(200, { id, ...dados, atualizadoEm: r.atualizadoEm }, publico ? 60 : 0);
}

/** sessão do app → cliente vinculado (mesma regra do histórico: só conta vinculada ao cadastro do kartódromo) */
async function clienteDaSessao(request: Request, env: MobileRankingEnv) {
  const conta = await authenticateMobileRequest(request, env);
  if (!conta) return json(401, { erro: 'Sua sessão expirou. Entre novamente.', codigo: 'AUTH_REQUIRED' });
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
      if (cliente instanceof Response) return cliente;
      if (!cliente) return json(404, { erro: 'Sua conta ainda não está ligada ao seu cadastro no kartódromo.' });
      if (request.method === 'PUT') return await enviarFoto(request, env, cliente);
      if (request.method === 'DELETE') { await env.PRE?.delete(fotoChave(cliente)); return json(200, { ok: true }); }
      return json(405, { erro: 'Método não permitido.' });
    }
    if (p === '/api/mobile/v1/ranking/interno/clientes' && request.method === 'POST') {
      return await receberClientes(request, env, constantTimeEqual(request.headers.get('x-mobile-admin-token') ?? '', env.MOBILE_ADMIN_TOKEN!));
    }
    if (request.method !== 'GET') return json(405, { erro: 'Método não permitido.' });
    const mf = /^\/api\/mobile\/v1\/ranking\/pilotos\/(\d{1,12})\/foto$/.exec(p);
    if (mf) return await lerFoto(env, mf[1]);
    if (p === '/api/mobile/v1/ranking') return await ranking(url, env);
    if (p === '/api/mobile/v1/ranking/busca') {
      // busca de piloto por nome (comparação personalizada): até 20, com o XP na mesma conta do app
      const termo = (url.searchParams.get('nome') ?? '').trim().replace(/[%_]/g, '');
      if (termo.length < 3) return json(400, { erro: 'Digite pelo menos 3 letras do nome.' });
      await garantirTabela(env);
      const r = await env.MOBILE_DB!.prepare(
        `SELECT substr(chave, 8) id, json_extract(dados, '$.nome') nome,
                json_extract(dados, '$.baterias') * 50 + json_extract(dados, '$.podios') * 50 + json_extract(dados, '$.vitorias') * 100
                + json_extract(dados, '$.poles') * 50 + json_extract(dados, '$.voltasMaisRapidas') * 50 xp
           FROM mobile_ranking WHERE chave LIKE 'piloto:%' AND json_extract(dados, '$.nome') LIKE ? ORDER BY xp DESC LIMIT 20`,
      ).bind(`%${termo}%`).all<{ id: string; nome: string; xp: number }>();
      return json(200, { pilotos: r.results ?? [] }, 300);
    }
    if (p === '/api/mobile/v1/ranking/karts') {
      await garantirTabela(env);
      const catalogo = await env.MOBILE_DB.prepare("SELECT chave FROM mobile_ranking WHERE chave LIKE 'karts:%' ORDER BY chave DESC").all<{ chave: string }>();
      const dias = (catalogo.results ?? []).map((r) => r.chave.slice(6));
      if (dias.length) {
        let filtro: ReturnType<typeof filtrarKarts>;
        try { filtro = filtrarKarts([], url, dias); } catch (e) { return json(400, { erro: (e as Error).message }); }
        const registros = await env.MOBILE_DB.prepare('SELECT dados, atualizado_em FROM mobile_ranking WHERE chave >= ? AND chave <= ? ORDER BY chave').bind('karts:' + filtro.de, 'karts:' + filtro.ate).all<{ dados: string; atualizado_em: number }>();
        const linhas = (registros.results ?? []).flatMap((r) => (JSON.parse(r.dados) as { linhas: VoltaKart[] }).linhas);
        return json(200, { ...filtrarKarts(linhas, url, dias), atualizadoEm: new Date(Math.max(0, ...(registros.results ?? []).map((r) => r.atualizado_em))).toISOString() }, 60);
      }
      const r = await ler(env, 'ranking');
      return json(200, { ...((r?.dados.kartsDoDia as object | undefined) ?? { dia: null, karts: [] }), atualizadoEm: r?.atualizadoEm ?? null }, 60);
    }
    if (p === '/api/mobile/v1/ranking/me') {
      const cliente = await clienteDaSessao(request, env);
      if (cliente instanceof Response) return cliente;
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
