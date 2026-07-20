const PREMIUM_ROUTES = new Map([
  ["/", "/index.html"],
  ["/pista", "/pista.html"],
  ["/kart-locacao", "/kart-locacao.html"],
  ["/campeonatos", "/campeonatos.html"],
  ["/eventos", "/eventos.html"],
  ["/duvidas", "/duvidas.html"],
  ["/kac", "/kac.html"],
  ["/kac-super", "/kac-super.html"],
  ["/200-milhas", "/200-milhas.html"],
  ["/500-milhas", "/500-milhas.html"],
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

const withSecurityHeaders = (response) => {
  const headers = new Headers(response.headers);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  headers.set("X-Premium-Site", "preview-v1");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};

const fetchAsset = async (request, env, assetPath) => {
  const url = new URL(request.url);
  url.pathname = assetPath;
  const response = await env.ASSETS.fetch(new Request(url, request));
  return withSecurityHeaders(response);
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = normalizePath(url.pathname);

    const redirect = PERMANENT_REDIRECTS.get(path);
    if (redirect) {
      const target = new URL(redirect, url);
      return Response.redirect(target, 308);
    }

    const premiumAsset = PREMIUM_ROUTES.get(path);
    if (premiumAsset) {
      return fetchAsset(request, env, premiumAsset);
    }

    if (path === "/sitemap.xml" || path === "/robots.txt") {
      return fetchAsset(request, env, path);
    }

    if (path.startsWith("/assets/")) {
      return withSecurityHeaders(await env.ASSETS.fetch(request));
    }

    if (env.LEGACY && typeof env.LEGACY.fetch === "function") {
      return env.LEGACY.fetch(request);
    }

    return fetchAsset(request, env, "/404.html");
  },
};
