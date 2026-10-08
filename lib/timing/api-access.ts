import { timingSafeEqual } from 'node:crypto';
import type { IncomingMessage } from 'node:http';

/**
 * Valida a chave de acesso da API de cronometragem.
 * A chave deve ser fornecida via header 'x-timing-key'.
 * Se TIMING_API_KEY não estiver configurada no servidor ou for vazia, o acesso privado é negado.
 */
export function validarChaveTiming(req: IncomingMessage): boolean {
  const serverKey = process.env.TIMING_API_KEY?.trim();
  if (!serverKey) {
    return false; // Chave não configurada no servidor: nega acesso irrestrito
  }
  const rawHeader = req.headers['x-timing-key'];
  const clientKey = (Array.isArray(rawHeader) ? rawHeader[0] : rawHeader)?.trim() ?? '';
  if (!clientKey) return false;

  const bufServer = Buffer.from(serverKey, 'utf8');
  const bufClient = Buffer.from(clientKey, 'utf8');
  if (bufServer.length !== bufClient.length) return false;
  return timingSafeEqual(bufServer, bufClient);
}

/**
 * Verifica se uma origem HTTP (header Origin) é permitida para CORS.
 */
export function isOrigemPermitida(origin: string | undefined): boolean {
  if (!origin) return false;
  try {
    const u = new URL(origin);
    const host = u.hostname;
    // Permite localhost e loopback
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1') return true;
    // Permite rede local (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
    if (/^192\.168\.\d+\.\d+$/.test(host)) return true;
    if (/^10\.\d+\.\d+\.\d+$/.test(host)) return true;
    if (/^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/.test(host)) return true;

    // Origens adicionais configuradas
    const permitidas = (process.env.TIMING_ALLOWED_ORIGINS || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (permitidas.includes(origin) || permitidas.includes(host)) return true;
  } catch {
    return false;
  }
  return false;
}

/**
 * Retorna os headers de CORS apropriados para a requisição.
 */
export function corsHeaders(origin: string | undefined): Record<string, string> {
  if (origin && isOrigemPermitida(origin)) {
    return {
      'access-control-allow-origin': origin,
      'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
      'access-control-allow-headers': 'content-type, x-timing-key',
      'vary': 'Origin',
    };
  }
  return {
    'vary': 'Origin',
  };
}

/**
 * Remove dados sensíveis (PII: e-mail, telefone, peso, cpf) de objetos de competidores
 * expostos em endpoints públicos.
 */
export function sanitizarCompetidoresPublicos<T extends { detalhes?: Record<string, unknown> | null }>(competitors: T[]): T[] {
  return competitors.map((c) => {
    if (!c.detalhes) return c;
    const { email, telefone, peso, cpf, ...publicDetalhes } = c.detalhes as Record<string, unknown>;
    return {
      ...c,
      detalhes: publicDetalhes,
    };
  });
}

/**
 * Determina se a rota solicitada exige autenticação por chave de API.
 * Mutações (POST/PUT/PATCH/DELETE) e leituras privadas exigem chave.
 * Leituras públicas e painéis (GET /api/sessions, /api/state, /healthz) não exigem chave.
 */
export function rotaExigeChave(method: string, pathname: string): boolean {
  const m = method.toUpperCase();
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(m)) {
    if (pathname === '/api/tb50-ping') return false;
    return true;
  }
  if (pathname === '/api/clientes' || pathname.startsWith('/api/clientes/')) return true;
  if (pathname.startsWith('/api/catalog/backups')) return true;
  if (pathname === '/api/email-config') return true;
  return false;
}

