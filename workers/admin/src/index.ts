/**
 * Painel administrativo web (admin.kartodromodebetim.com.br).
 *
 * Só serve as telas e repassa os pedidos para os sistemas do kartódromo:
 *  - /api/login e /api/office/*  → servidor da operação no SRVKART (ops.kartodromodebetim.com.br, login dos usuários da Recepção)
 *  - /api/crono/ao-vivo          → placar ao vivo da cronometragem do ORBITS (crono.kartodromodebetim.com.br, só leitura)
 * Nada fica guardado aqui: o banco é o KartodromoOps do SRVKART, o mesmo da Recepção, dos totens e da crono.
 */

interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
  OPS_URL: string;
  CRONO_URL: string;
}

const SEGURANCA: Record<string, string> = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'same-origin',
  'x-frame-options': 'DENY',
  'permissions-policy': 'camera=(), microphone=(), geolocation=()',
};

// Só estes caminhos do servidor da operação passam pela ponte (nada do totem nem das rotas da cronometragem com chave).
const PERMITIDO = /^\/api\/(login|office\/[a-z0-9\-/]+|publico\/endurance\/[\w.-]{3,60})$/;

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...SEGURANCA } });
}

async function repassar(req: Request, env: Env, url: URL): Promise<Response> {
  if (!PERMITIDO.test(url.pathname)) return json(404, { error: 'Rota não encontrada.' });
  if (!['GET', 'POST', 'PUT', 'DELETE'].includes(req.method)) return json(405, { error: 'Método não permitido.' });
  const destino = new URL(url.pathname + url.search, env.OPS_URL);
  const headers = new Headers();
  const auth = req.headers.get('authorization');
  if (auth) headers.set('authorization', auth);
  if (req.method !== 'GET') headers.set('content-type', 'application/json');
  headers.set('x-admin-web', '1');
  let resp: Response;
  try {
    resp = await fetch(destino.toString(), {
      method: req.method,
      headers,
      body: req.method === 'GET' ? undefined : await req.text(),
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    return json(502, { error: 'O servidor do kartódromo não respondeu. Confira a internet do kartódromo.' });
  }
  const out = new Headers({ 'content-type': resp.headers.get('content-type') ?? 'application/json; charset=utf-8', 'cache-control': 'no-store', ...SEGURANCA });
  const novo = resp.headers.get('x-novo-token');
  if (novo) out.set('x-novo-token', novo);
  return new Response(resp.body, { status: resp.status, headers: out });
}

async function aoVivo(env: Env): Promise<Response> {
  try {
    const resp = await fetch(`${env.CRONO_URL}/api/livetime-snapshot`, { signal: AbortSignal.timeout(8_000) });
    if (!resp.ok) return json(502, { error: `A cronometragem respondeu HTTP ${resp.status}.` });
    return new Response(resp.body, { status: 200, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...SEGURANCA } });
  } catch {
    return json(502, { error: 'A cronometragem não respondeu.' });
  }
}

async function saude(env: Env): Promise<Response> {
  const testar = async (u: string) => {
    const t0 = Date.now();
    try {
      const r = await fetch(u, { signal: AbortSignal.timeout(6_000) });
      return { ok: r.ok || r.status === 401, ms: Date.now() - t0, status: r.status };
    } catch {
      return { ok: false, ms: Date.now() - t0, status: 0 };
    }
  };
  const [ops, crono] = await Promise.all([testar(`${env.OPS_URL}/api/office/apoio`), testar(`${env.CRONO_URL}/healthz`)]);
  return json(200, { ops, crono, em: new Date().toISOString() });
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname === '/api/crono/ao-vivo') return aoVivo(env);
    if (url.pathname === '/api/saude') return saude(env);
    if (url.pathname.startsWith('/api/')) return repassar(req, env, url);
    // página do chefe de equipe do endurance: /equipe/<token> abre a mesma página (o token fica no endereço)
    const resp = url.pathname.startsWith('/equipe/') ? await env.ASSETS.fetch(new Request(new URL('/equipe.html', url), req)) : await env.ASSETS.fetch(req);
    const h = new Headers(resp.headers);
    for (const [k, v] of Object.entries(SEGURANCA)) h.set(k, v);
    if (url.pathname === '/' || url.pathname.endsWith('.html') || url.pathname.startsWith('/equipe/')) h.set('cache-control', 'no-cache');
    return new Response(resp.body, { status: resp.status, headers: h });
  },
};
