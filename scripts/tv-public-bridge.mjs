import http from 'node:http';

const LISTEN_HOST = process.env.TV_PUBLIC_BRIDGE_HOST || '127.0.0.1';
const LISTEN_PORT = Number(process.env.TV_PUBLIC_BRIDGE_PORT || 4051);
const ORIGIN_HOST = process.env.TV_PUBLIC_ORIGIN_HOST || '127.0.0.1';
const ORIGIN_PORT = Number(process.env.TV_PUBLIC_ORIGIN_PORT || 4050);

const EXACT_PATHS = new Set([
  '/tv',
  '/tv-classica',
  '/tb50',
  '/tokens.css',
  '/kib-logo.png',
  '/favicon.ico',
  '/healthz',
  '/api/events',
  '/api/state',
  '/api/livetime-snapshot',
  '/api/livetime-snapshot/eventos',
]);

const SSE_PATHS = new Set(['/api/events', '/api/livetime-snapshot/eventos']);

function isAllowedPath(pathname) {
  if (EXACT_PATHS.has(pathname)) return true;
  if (/^\/api\/sessions\/[\w-]+\/laps$/.test(pathname)) return true;
  return false;
}

function originHeaders(headers, remoteAddress) {
  const forwarded = {};
  for (const [key, value] of Object.entries(headers)) {
    const lower = key.toLowerCase();
    if (lower === 'host' || lower === 'connection') continue;
    if (value !== undefined) forwarded[key] = value;
  }
  forwarded.host = `${ORIGIN_HOST}:${ORIGIN_PORT}`;
  forwarded['x-public-bridge'] = '1';
  const clientIp = headers['cf-connecting-ip'] || headers['x-forwarded-for'] || remoteAddress || '';
  if (clientIp) forwarded['x-forwarded-for'] = String(clientIp);
  return forwarded;
}

// Item 31: Agente dedicado com keepAlive e limite de sockets para evitar vazamento
const upstreamAgent = new http.Agent({
  keepAlive: true,
  maxSockets: 64,
  timeout: 30_000,
});

const server = http.createServer((req, res) => {
  const method = req.method || 'GET';
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const isSse = SSE_PATHS.has(url.pathname);

  if ((method !== 'GET' && method !== 'HEAD') || !isAllowedPath(url.pathname)) {
    res.writeHead(403, {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    });
    res.end(JSON.stringify({ error: 'Rota pública de TV não permitida.' }));
    return;
  }

  const upstream = http.request(
    {
      hostname: ORIGIN_HOST,
      port: ORIGIN_PORT,
      method,
      path: `${url.pathname}${url.search}`,
      headers: originHeaders(req.headers, req.socket.remoteAddress),
      agent: isSse ? false : upstreamAgent,
      timeout: isSse ? 0 : 15_000,
    },
    (upstreamRes) => {
      res.writeHead(upstreamRes.statusCode || 502, upstreamRes.headers);
      upstreamRes.pipe(res);
      upstreamRes.on('error', () => {
        upstream.destroy();
        if (!res.writableEnded) res.end();
      });
    }
  );

  upstream.on('timeout', () => {
    if (!isSse) {
      upstream.destroy(new Error('Gateway timeout upstream'));
    }
  });

  upstream.on('error', () => {
    if (!res.headersSent) {
      res.writeHead(502, {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
      });
    }
    if (!res.writableEnded) {
      res.end(JSON.stringify({ error: 'Cronometragem indisponível.' }));
    }
  });

  req.on('close', () => {
    upstream.destroy();
  });

  res.on('close', () => {
    upstream.destroy();
  });

  req.pipe(upstream);
});

server.keepAliveTimeout = 65_000;
server.headersTimeout = 66_000;

server.listen(LISTEN_PORT, LISTEN_HOST, () => {
  console.log(`[tv-public-bridge] http://${LISTEN_HOST}:${LISTEN_PORT} -> http://${ORIGIN_HOST}:${ORIGIN_PORT}`);
});
