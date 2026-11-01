/**
 * Porta pública do app operacional. Só repassa /api/app/v1/ pelo túnel; quem autentica e autoriza é a origem.
 * O segredo do gateway identifica o caminho, mas nunca dá privilégio.
 */
export interface Env { ORIGEM_URL: string; GATEWAY_SEGREDO: string }

const PREFIXO = '/api/app/v1/';
const json = (status: number, corpo: unknown, extra: Record<string, string> = {}) => new Response(JSON.stringify(corpo), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...extra },
});

export function criarGateway(origem: typeof fetch, opcoes: { loginPorMinuto?: number } = {}) {
  const limite = opcoes.loginPorMinuto ?? 10;
  const tentativas = new Map<string, { n: number; ate: number }>();
  const liberarLogin = (ip: string) => {
    const agora = Date.now();
    const t = tentativas.get(ip);
    if (!t || t.ate <= agora) { tentativas.set(ip, { n: 1, ate: agora + 60_000 }); return true; }
    return ++t.n <= limite;
  };

  return async function gateway(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (!url.pathname.startsWith(PREFIXO)) return json(404, { codigo: 'NOT_FOUND', erro: 'Rota desconhecida.' });
    if (!env.ORIGEM_URL || !env.GATEWAY_SEGREDO) return json(503, { codigo: 'UNAVAILABLE', erro: 'Serviço indisponível.' });
    if (url.pathname.replace(/\/+$/, '') === `${PREFIXO}auth/login` && !liberarLogin(req.headers.get('cf-connecting-ip') ?? '?'))
      return json(429, { codigo: 'RATE_LIMITED', erro: 'Muitas tentativas. Aguarde um pouco.' }, { 'retry-after': '60' });
    const destino = new URL(url.pathname + url.search, env.ORIGEM_URL);
    const headers = new Headers(req.headers);
    headers.set('x-app-v1-gateway', env.GATEWAY_SEGREDO);
    headers.set('x-app-v1-cliente-ip', req.headers.get('cf-connecting-ip') ?? '?');
    try {
      const r = await origem(new Request(destino, { method: req.method, headers, body: req.body, redirect: 'manual', ...(req.body ? { duplex: 'half' } : {}) } as RequestInit));
      const saida = new Headers(r.headers);
      saida.set('cache-control', 'no-store');
      return new Response(r.body, { status: r.status, headers: saida });
    } catch {
      return json(503, { codigo: 'UNAVAILABLE', erro: 'Servidor do kartódromo fora do ar.' });
    }
  };
}

const gateway = criarGateway((...a) => fetch(...a));
export default { fetch: (req: Request, env: Env) => gateway(req, env) };
