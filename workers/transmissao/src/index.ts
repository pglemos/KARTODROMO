/**
 * API de transmissão ao vivo num Worker próprio e leve (antes passava pelo Next do site, que estourava o limite de
 * recursos do Cloudflare durante as corridas: ~7% dos envios do ORBITS voltavam HTTP 500).
 *
 *   POST /api/transmissao/v1/publicar  — o servidor da cronometragem (ORBITS) publica o retrato (chave de publicação)
 *   GET  /api/transmissao/v1/corrida   — o parceiro (ex.: Cosmo/YouTube) lê o retrato com a chave dele
 *
 * Mesmo contrato e mesmo arquivo no R2 (`transmissao/v1/corrida.json`) das rotas do Next (app/api/transmissao/v1/*),
 * que continuam lá como reserva. Documentação do parceiro: docs/api-transmissao.md.
 * Segredos (wrangler secret, nunca no código): TRANSMISSAO_CHAVES_SHA256, TRANSMISSAO_PUBLICACAO_SHA256.
 */
import { conferirChave, extrairChave, lerHashes, VERSAO_TRANSMISSAO, type Transmissao } from '../../../lib/timing/transmissao';

interface Env {
  TELAO: R2Bucket;
  TRANSMISSAO_CHAVES_SHA256?: string;
  TRANSMISSAO_PUBLICACAO_SHA256?: string;
}

const CHAVE_R2 = 'transmissao/v1/corrida.json';
const SEM_SINAL_APOS_MS = 90_000;
const TAMANHO_MAXIMO = 512 * 1024;
const SEM_CACHE: Record<string, string> = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-api-key, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

type Guardada = Transmissao & { recebidoEm: string };

/** cache curto por instância: muitos pedidos no mesmo segundo leem o R2 uma vez só */
let memoria: { lidoEm: number; dados: Guardada | null } | null = null;

const json = (corpo: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(corpo), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...SEM_CACHE, ...extra } });

function validar(corpo: unknown): Transmissao | null {
  if (!corpo || typeof corpo !== 'object') return null;
  const t = corpo as Partial<Transmissao>;
  if (t.versao !== VERSAO_TRANSMISSAO || typeof t.situacao !== 'string' || !Array.isArray(t.pilotos) || t.pilotos.length > 200) return null;
  return t as Transmissao;
}

async function publicar(request: Request, env: Env): Promise<Response> {
  if (!env.TRANSMISSAO_PUBLICACAO_SHA256) return json({ erro: 'Publicação não configurada.' }, 503);
  const chave = extrairChave((n) => request.headers.get(n), new URL('https://x/'));
  if ((await conferirChave(chave, lerHashes(env.TRANSMISSAO_PUBLICACAO_SHA256))) == null) return json({ erro: 'Chave de publicação inválida.' }, 401);
  if (Number(request.headers.get('content-length') ?? 0) > TAMANHO_MAXIMO) return json({ erro: 'Retrato grande demais.' }, 413);
  const texto = await request.text();
  if (texto.length > TAMANHO_MAXIMO) return json({ erro: 'Retrato grande demais.' }, 413);
  let corpo: unknown;
  try { corpo = JSON.parse(texto); } catch { return json({ erro: 'JSON inválido.' }, 400); }
  const retrato = validar(corpo);
  if (!retrato) return json({ erro: 'Formato inesperado (versão 1).' }, 400);
  const guardada: Guardada = { ...retrato, recebidoEm: new Date().toISOString() };
  try {
    await env.TELAO.put(CHAVE_R2, JSON.stringify(guardada), { httpMetadata: { contentType: 'application/json' } });
  } catch {
    return json({ erro: 'Não foi possível guardar o retrato.' }, 502);
  }
  memoria = { lidoEm: Date.now(), dados: guardada };
  return json({ ok: true });
}

async function ler(request: Request, env: Env): Promise<Response> {
  if (!env.TRANSMISSAO_CHAVES_SHA256) return json({ erro: 'API de transmissão ainda não configurada.' }, 503);
  const chave = extrairChave((n) => request.headers.get(n), new URL(request.url));
  if ((await conferirChave(chave, lerHashes(env.TRANSMISSAO_CHAVES_SHA256))) == null)
    return json({ erro: 'Chave ausente ou inválida. Envie no cabeçalho Authorization: Bearer <chave>.' }, 401, { 'WWW-Authenticate': 'Bearer' });
  try {
    const agora = Date.now();
    if (!memoria || agora - memoria.lidoEm > 700) {
      const obj = await env.TELAO.get(CHAVE_R2);
      memoria = { lidoEm: agora, dados: obj ? ((await obj.json()) as Guardada) : null };
    }
    const dados = memoria.dados;
    if (!dados) return json({ versao: 1, atualizadoEm: new Date().toISOString(), situacao: 'sem-bateria', sinal: 'sem-sinal', bateria: null, melhorVolta: null, pilotos: [] });
    const idade = agora - Date.parse(dados.recebidoEm);
    return json({ ...dados, sinal: Number.isFinite(idade) && idade <= SEM_SINAL_APOS_MS ? 'ao-vivo' : 'sem-sinal' });
  } catch {
    return json({ erro: 'Não foi possível ler os dados da corrida agora. Tente de novo em 1 s.' }, 502);
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: SEM_CACHE });
    if (pathname === '/api/transmissao/v1/publicar') return request.method === 'POST' ? publicar(request, env) : json({ erro: 'Use POST.' }, 405);
    if (pathname === '/api/transmissao/v1/corrida') return request.method === 'GET' ? ler(request, env) : json({ erro: 'Use GET.' }, 405);
    return json({ erro: 'Endereço não encontrado.' }, 404);
  },
};
