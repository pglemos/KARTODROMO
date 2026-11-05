import routes from "./src/routes.json" with { type: "json" };
const publicRoutes = new Set(routes.map((r) => r.path));
const localAsset = (path) =>
  path.startsWith("/media/") ||
  path.startsWith("/ui-assets/") ||
  path === "/sitemap.xml" ||
  path === "/robots.txt";
const securityHeaders = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "X-Frame-Options": "SAMEORIGIN",
};
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const raw = url.pathname;
    const path = raw.replace(/\/$/, "") || "/";
    const legacyAlias =
      path === "/home" || path === "/home.html"
        ? "/"
        : path.endsWith(".html") || path.endsWith(".dc")
          ? path.replace(/\.(html|dc)$/, "")
          : null;
    if (legacyAlias && publicRoutes.has(legacyAlias))
      return Response.redirect(
        `${url.origin}${legacyAlias}${url.search}${url.hash}`,
        301,
      );
    if (
      (publicRoutes.has(path) || localAsset(path)) &&
      ["GET", "HEAD"].includes(request.method)
    ) {
      if (
        publicRoutes.has(path) &&
        url.hostname === "www.kartodromodebetim.com.br"
      )
        return Response.redirect(
          `https://kartodromodebetim.com.br${path}${url.search}`,
          301,
        );
      if (publicRoutes.has(path) && path !== raw)
        return Response.redirect(`${url.origin}${path}${url.search}`, 301);
      const assetURL = new URL(url);
      if (publicRoutes.has(path))
        assetURL.pathname = path === "/" ? "/index.html" : `${path}/index.html`;
      const asset = await env.ASSETS.fetch(new Request(assetURL, request));
      const headers = new Headers(asset.headers);
      for (const [k, v] of Object.entries(securityHeaders)) headers.set(k, v);
      if (publicRoutes.has(path)) {
        headers.set("Cache-Control", "no-cache");
        if (url.hostname.endsWith(".workers.dev"))
          headers.set("X-Robots-Tag", "noindex");
      } else if (path.startsWith("/ui-assets/"))
        headers.set("Cache-Control", "public, max-age=31536000, immutable");
      return new Response(asset.body, { status: asset.status, headers });
    }
    const originURL = new URL(request.url);
    originURL.hostname = "kartodromodebetim.com.br";
    originURL.protocol = "https:";
    originURL.port = "";
    return env.LEGACY.fetch(new Request(originURL, request));
  },
};
