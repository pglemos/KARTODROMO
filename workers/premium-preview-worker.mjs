const PREMIUM_ROUTES = new Map([
  ["/", "/site/index.html"],
  ["/pista", "/site/pista.html"],
  ["/kart-locacao", "/site/kart-locacao.html"],
  ["/campeonatos", "/site/campeonatos.html"],
  ["/eventos", "/site/eventos.html"],
  ["/duvidas", "/site/duvidas.html"],
  ["/kac", "/site/kac.html"],
  ["/kac-super", "/site/kac-super.html"],
  ["/200-milhas", "/site/200-milhas.html"],
  ["/500-milhas", "/site/500-milhas.html"],
]);

const PERMANENT_REDIRECTS = new Map([
  ["/valores", "/kart-locacao"],
  ["/campeonatos/kac", "/kac"],
  ["/campeonatos/kac-super", "/kac-super"],
  ["/campeonatos/200-milhas", "/200-milhas"],
  ["/campeonatos/500-milhas", "/500-milhas"],
]);

const normalizePath = (pathname) => {
  if (pathname === "/") return pathname;
  return pathname.replace(/\/+$/, "") || "/";
};

const withSecurityHeaders = (response, { reference = false, html = false } = {}) => {
  const headers = new Headers(response.headers);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  headers.set("X-Premium-Site", "zip-final-v1");

  if (html) {
    headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
    headers.set("CDN-Cache-Control", "no-store");
    headers.set("Cloudflare-CDN-Cache-Control", "no-store");
    headers.set("Pragma", "no-cache");
    headers.set("Expires", "0");
  }

  if (reference) headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};

const fetchAsset = async (env, assetPath, options = {}) => {
  const assetURL = new URL(assetPath, "https://assets.local");
  const response = await env.ASSETS.fetch(new Request(assetURL));
  return withSecurityHeaders(response, options);
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = normalizePath(url.pathname);

    const redirect = PERMANENT_REDIRECTS.get(path);
    if (redirect) return Response.redirect(new URL(redirect, url), 308);

    const premiumAsset = PREMIUM_ROUTES.get(path);
    if (premiumAsset) return fetchAsset(env, premiumAsset, { html: true });

    if (path === "/sitemap.xml" || path === "/robots.txt") {
      return fetchAsset(env, path);
    }

    if (path.startsWith("/assets/")) return fetchAsset(env, path);

    if (path.startsWith("/site/")) {
      return fetchAsset(env, path, {
        reference: true,
        html: path.endsWith(".html"),
      });
    }

    if (env.LEGACY && typeof env.LEGACY.fetch === "function") {
      return env.LEGACY.fetch(request);
    }

    return fetchAsset(env, "/404.html", { reference: true, html: true });
  },
};
