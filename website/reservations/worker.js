// The deployed cadastro service remains the owner of reservations, R2 and Asaas.
// Only the reservation document and our namespaced assets belong to this worker.
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const document = [
      "/",
      "/reservar",
      "/reservar/",
      "/reservar.html",
      "/index.html",
    ].includes(url.pathname);
    const asset =
      url.pathname.startsWith("/booking-assets/") ||
      url.pathname.startsWith("/booking-media/");
    if ((document || asset) && ["GET", "HEAD"].includes(request.method)) {
      if (document) url.pathname = "/index.html";
      const response = await env.ASSETS.fetch(new Request(url, request));
      const headers = new Headers(response.headers);
      headers.set("X-Content-Type-Options", "nosniff");
      headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
      headers.set(
        "Permissions-Policy",
        "camera=(), microphone=(), geolocation=()",
      );
      headers.set(
        "Cache-Control",
        document ? "no-cache" : "public, max-age=86400",
      );
      if (url.pathname.startsWith("/booking-assets/"))
        headers.set("Cache-Control", "public, max-age=31536000, immutable");
      return new Response(response.body, { status: response.status, headers });
    }
    url.hostname = "reservas.kartodromodebetim.com.br";
    url.protocol = "https:";
    url.port = "";
    return env.LEGACY.fetch(new Request(url, request));
  },
};
