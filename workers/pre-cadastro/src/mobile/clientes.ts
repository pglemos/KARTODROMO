/**
 * Cadastro que já existe no kartódromo (recepção/totem), para o app reconhecer o piloto na hora do cadastro.
 * O SRVKART publica uma vez por dia só o mínimo: um código do CPF (HMAC com a chave de administração, não dá para
 * voltar ao CPF) e o e-mail mascarado ("p•••@gmail.com"). Fica num arquivo no R2 — nada no banco do app.
 *
 *   POST /api/mobile/v1/ranking/interno/clientes  (x-mobile-admin-token) { itens: [[codigo, emailMascarado | null], ...] }
 *   consulta: clienteExistente(env, cpf) — usada pelo cadastro (rota auth/cadastro-existente, com limite por IP)
 */
export interface MobileClientesEnv {
  PRE?: R2Bucket;
  MOBILE_ADMIN_TOKEN?: string;
}

const CHAVE_R2 = 'app/clientes-indice.json';
const encoder = new TextEncoder();
let cache: { em: number; mapa: Map<string, string | null> } | null = null;

export async function codigoDoCpf(segredo: string, cpf: string) {
  const k = await crypto.subtle.importKey('raw', encoder.encode(segredo), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', k, encoder.encode('cpf:' + cpf)));
  return Array.from(sig.slice(0, 16), (b) => b.toString(16).padStart(2, '0')).join('');
}

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
});

export async function receberClientes(request: Request, env: MobileClientesEnv, autorizado: boolean) {
  if (!autorizado) return json(401, { erro: 'Não autorizado.' });
  if (!env.PRE) return json(503, { erro: 'Serviço temporariamente indisponível.' });
  const corpo = (await request.json().catch(() => null)) as { itens?: unknown } | null;
  const itens = Array.isArray(corpo?.itens) ? corpo!.itens as unknown[] : [];
  const validos = itens.filter((i): i is [string, string | null] =>
    Array.isArray(i) && typeof i[0] === 'string' && /^[0-9a-f]{32}$/.test(i[0]) && (i[1] === null || (typeof i[1] === 'string' && i[1].length <= 80)));
  if (!validos.length) return json(400, { erro: 'Nada para gravar.' });
  await env.PRE.put(CHAVE_R2, JSON.stringify(validos), { httpMetadata: { contentType: 'application/json' } });
  cache = null;
  return json(200, { ok: true, gravados: validos.length });
}

/** null = não achou; string = e-mail mascarado do cadastro; '' = achou, mas sem e-mail no cadastro */
export async function clienteExistente(env: MobileClientesEnv, cpf: string) {
  if (!env.PRE || !env.MOBILE_ADMIN_TOKEN) return null;
  if (!cache || Date.now() - cache.em > 10 * 60_000) {
    const obj = await env.PRE.get(CHAVE_R2);
    const lista = obj ? (JSON.parse(await obj.text()) as [string, string | null][]) : [];
    cache = { em: Date.now(), mapa: new Map(lista) };
  }
  const codigo = await codigoDoCpf(env.MOBILE_ADMIN_TOKEN, cpf);
  return cache.mapa.has(codigo) ? cache.mapa.get(codigo) ?? '' : null;
}
