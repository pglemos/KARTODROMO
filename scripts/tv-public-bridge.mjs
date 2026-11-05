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

function isAllowedPath(pathname) {
  if (EXACT_PATHS.has(pathname)) return true;
  if (/^\/api\/sessions\/[\w-]+\/laps$/.test(pathname)) return true;
  return false;
}

function originHeaders(headers, remoteAddress) {
  const forwarded = {};
  for (const [key, value] of Object.entries(headers)) {
    const lower = key.toLowerCase();
    if (lower === 'host') continue;
    if (value !== undefined) forwarded[key] = value;
  }
  forwarded.host = `${ORIGIN_HOST}:${ORIGIN_PORT}`;
  forwarded['x-public-bridge'] = '1';
  const clientIp = headers['cf-connecting-ip'] || headers['x-forwarded-for'] || remoteAddress || '';
  if (clientIp) forwarded['x-forwarded-for'] = String(clientIp);
  return forwarded;
}

const server = http.createServer((req, res) => {
  const method = req.method || 'GET';
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  // aovivo.kartodromodebetim.com.br abre direto no placar
  if (url.pathname === '/') url.pathname = '/tv';

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
    },
    (upstreamRes) => {
      res.writeHead(upstreamRes.statusCode || 502, upstreamRes.headers);
      upstreamRes.pipe(res);
    }
  );

  upstream.on('error', () => {
    if (!res.headersSent) {
      res.writeHead(502, {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
      });
    }
    res.end(JSON.stringify({ error: 'Cronometragem indisponível.' }));
  });

  // na resposta, não no pedido: no Node atual o 'close' do pedido dispara ao terminar de lê-lo, o que cortava toda
  // ligação com a cronometragem antes da resposta (502 em tudo). Aqui só dispara quando o visitante sai (fluxo SSE).
  res.on('close', () => {
    if (!res.writableFinished) upstream.destroy();
  });

  req.pipe(upstream);
});

server.listen(LISTEN_PORT, LISTEN_HOST, () => {
  console.log(`[tv-public-bridge] http://${LISTEN_HOST}:${LISTEN_PORT} -> http://${ORIGIN_HOST}:${ORIGIN_PORT}`);
});
