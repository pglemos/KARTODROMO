/**
 * /200-milhas: página estática + ponte para o SRVKART (/api/campeonato-site, com a chave). A chave nunca vai ao navegador.
 * Busca de piloto e envio têm limite por IP; a busca só responde com documento + nascimento corretos.
 */
export interface Env { ASSETS: Fetcher; OPS_URL: string; OPS_KEY: string }

const SEGURANCA: Record<string, string> = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'x-frame-options': 'DENY',
  'permissions-policy': 'camera=(), microphone=(), geolocation=()',
};
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...SEGURANCA } });

async function excedeu(tipo: string, ip: string, max: number) {
  const cache = (caches as unknown as { default: Cache }).default;
  const chave = new Request(`https://limite.200milhas/${tipo}/${encodeURIComponent(ip)}`);
  const atual = Number((await (await cache.match(chave))?.text()) ?? 0);
  if (atual >= max) return true;
  await cache.put(chave, new Response(String(atual + 1), { headers: { 'cache-control': 'max-age=600' } }));
  return false;
}

async function ponte(req: Request, env: Env, resto: string) {
  const ip = req.headers.get('cf-connecting-ip') ?? 'x';
  let corpo: string | undefined;
  if (req.method === 'POST') {
    if (!req.headers.get('content-type')?.includes('application/json')) return json(415, { error: 'Envio inválido.' });
    corpo = await req.text();
    if (corpo.length > 60_000) return json(413, { error: 'Envio grande demais.' });
  }
  if (resto === '/piloto' && (await excedeu('busca', ip, 30))) return json(429, { error: 'Muitas buscas seguidas. Preencha os dados à mão ou aguarde alguns minutos.' });
  if (resto === '/inscricoes' && req.method === 'POST') {
    if (String((JSON.parse(corpo || '{}') as { site?: unknown }).site ?? '') !== '') return json(400, { error: 'Envio inválido.' });
    if (await excedeu('envio', ip, 8)) return json(429, { error: 'Muitos envios seguidos. Aguarde alguns minutos.' });
  }
  let r: Response;
  try {
    r = await fetch(`${env.OPS_URL}/api/campeonato-site/200-milhas${resto}`, {
      method: req.method, body: corpo,
      headers: { 'x-ops-key': env.OPS_KEY, ...(corpo ? { 'content-type': 'application/json' } : {}) },
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    return json(502, { error: 'Nosso sistema não respondeu agora. Seus dados continuam na tela: tente de novo em instantes.' });
  }
  return new Response(r.body, { status: r.status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...SEGURANCA } });
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const p = url.pathname;
    if (p === '/200-milhas/api' || p.startsWith('/200-milhas/api/')) {
      const resto = p.slice('/200-milhas/api'.length);
      if (!(resto === '' || resto === '/piloto' || resto === '/inscricoes' || /^\/inscricoes\/[\w-]{20,40}(\/pagar)?$/.test(resto))) return json(404, { error: 'Rota não encontrada.' });
      if (!['GET', 'POST'].includes(req.method)) return json(405, { error: 'Método não permitido.' });
      try { return await ponte(req, env, resto); } catch { return json(400, { error: 'Envio inválido.' }); }
    }
    const pagina = p === '/200-milhas' || p === '/200-milhas/' || p.startsWith('/200-milhas/inscricao/');
    const resp = await env.ASSETS.fetch(pagina ? new Request(new URL('/200-milhas/', url)) : req);
    const h = new Headers(resp.headers);
    for (const [k, v] of Object.entries(SEGURANCA)) h.set(k, v);
    if (pagina) h.set('cache-control', 'no-cache');
    if (p.startsWith('/200-milhas/inscricao/')) h.set('x-robots-tag', 'noindex');
    return new Response(resp.body, { status: resp.status, headers: h });
  },
};
