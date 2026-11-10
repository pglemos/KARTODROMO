// worker.js de kartodromo-reservas-2026
const ASSET_PATHS = new Set(['/', '/reservar', '/reservar/', '/reservar.html', '/index.html']);

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const isDoc = ASSET_PATHS.has(url.pathname);
    const isAsset = url.pathname.startsWith('/booking-assets/') || url.pathname.startsWith('/booking-media/');

    if ((isDoc || isAsset) && ['GET', 'HEAD'].includes(request.method)) {
      if (isDoc) url.pathname = '/index.html';
      const response = await env.ASSETS.fetch(new Request(url, request));
      const headers = new Headers(response.headers);
      headers.set('X-Content-Type-Options', 'nosniff');
      headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
      headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
      headers.set('Cache-Control', isDoc ? 'no-cache, no-store, must-revalidate' : 'public, max-age=86400');
      if (url.pathname.startsWith('/booking-assets/')) {
        headers.set('Cache-Control', 'public, max-age=31536000, immutable');
      }
      headers.set('X-Kib-Deploy', 'autonomo-2026-11');
      return new Response(response.body, { status: response.status, headers });
    }

    url.hostname = 'reservas.kartodromodebetim.com.br';
    url.protocol = 'https:';
    url.port = '';
    return env.LEGACY.fetch(new Request(url, request));
  },
};
