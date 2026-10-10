import PACOTE_POLITICA from "./site-politica.js.txt";
const JS_VELHO = "/ui-assets/index-B2k-39J7.js", JS_NOVO = "/ui-assets/index-politica-20261009.js";
var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/routes.json
var routes_default = [
  {
    key: "home",
    path: "/",
    title: "Kart\xF3dromo Internacional de Betim",
    description: "Kart de loca\xE7\xE3o, campeonatos, eventos e experi\xEAncias de velocidade no Kart\xF3dromo Internacional de Betim.",
    availability: "active"
  },
  {
    key: "pista",
    path: "/pista",
    title: "A Pista | Kart\xF3dromo Internacional de Betim",
    description: "Conhe\xE7a a pista homologada de 1.110 metros, os tra\xE7ados oficiais e a estrutura do Kart\xF3dromo de Betim.",
    availability: "active"
  },
  {
    key: "kart-locacao",
    path: "/kart-locacao",
    title: "Kart de Loca\xE7\xE3o em Betim | Reserve Online",
    description: "Reserve uma bateria de kart de loca\xE7\xE3o com equipamento e cronometragem no Kart\xF3dromo Internacional de Betim.",
    availability: "active"
  },
  {
    key: "reservas",
    path: "/reservas",
    title: "Reservas | Kart\xF3dromo Internacional de Betim",
    description: "Consulte hor\xE1rios, pre\xE7os, condi\xE7\xF5es e fa\xE7a sua reserva na plataforma oficial do Kart\xF3dromo de Betim.",
    availability: "active"
  },
  {
    key: "eventos",
    path: "/eventos",
    title: "Eventos, Anivers\xE1rios e Empresas | Kart\xF3dromo de Betim",
    description: "Organize anivers\xE1rios, encontros e eventos corporativos com kart, p\xF3dio e estrutura completa em Betim.",
    availability: "active"
  },
  {
    key: "campeonatos",
    path: "/campeonatos",
    title: "Campeonatos de Kart | Kart\xF3dromo de Betim",
    description: "Conhe\xE7a os campeonatos, calend\xE1rios, regulamentos e inscri\xE7\xF5es do Kart\xF3dromo Internacional de Betim.",
    availability: "active"
  },
  {
    key: "historia",
    path: "/historia",
    title: "Nossa Hist\xF3ria | Kart\xF3dromo Internacional de Betim",
    description: "Conhe\xE7a a hist\xF3ria, a evolu\xE7\xE3o e a ficha t\xE9cnica do Kart\xF3dromo Internacional de Betim.",
    availability: "active"
  },
  {
    key: "duvidas",
    path: "/duvidas",
    title: "D\xFAvidas Frequentes | Kart\xF3dromo de Betim",
    description: "Respostas sobre reservas, seguran\xE7a, kart de loca\xE7\xE3o, grupos, eventos e campeonatos.",
    availability: "active"
  },
  {
    key: "kac",
    path: "/kac",
    title: "KAC Iniciantes 2026 | Kart\xF3dromo de Betim",
    description: "Campeonato mensal de Kart Light para pilotos iniciantes no Kart\xF3dromo Internacional de Betim.",
    availability: "active"
  },
  {
    key: "kac-super",
    path: "/kac-super",
    title: "KAC Super Kart 2026 | Kart\xF3dromo de Betim",
    description: "Campeonato anual de Super Kart com calend\xE1rio, regulamento e pontua\xE7\xE3o acumulada.",
    availability: "active"
  },
  {
    key: "200-milhas",
    path: "/200-milhas",
    title: "200 Milhas de Betim | Endurance de Kart",
    description: "Informa\xE7\xF5es, regulamento e hist\xF3rico das 200 Milhas de Betim, endurance estrat\xE9gico em equipe.",
    availability: "active"
  },
  {
    key: "500-milhas",
    path: "/500-milhas",
    title: "500 Milhas de Betim | Ultra Endurance de Kart",
    description: "Informa\xE7\xF5es, regulamento e inscri\xE7\xF5es das 500 Milhas de Betim, a prova mais longa do calend\xE1rio.",
    availability: "active"
  },
  {
    key: "100-milhas-light",
    path: "/100-milhas-light",
    title: "100 Milhas Light de Betim 2026 | Endurance de Kart",
    description: "Regulamento, cronograma e inscri\xE7\xE3o de equipes das 100 Milhas Light de Betim, endurance de 2h30 em kart light no dia 25 de outubro de 2026.",
    availability: "active"
  },
  {
    key: "clube-vantagens",
    path: "/clube-vantagens",
    title: "Clube de Vantagens | Kart\xF3dromo de Betim",
    description: "Conhe\xE7a o programa de relacionamento e as vantagens planejadas para clientes frequentes do Kart\xF3dromo de Betim.",
    availability: "active"
  },
  {
    key: "clube-cadastro",
    path: "/clube-cadastro",
    title: "Cadastro no Clube de Vantagens | Kart\xF3dromo de Betim",
    description: "O cadastro do Clube de Vantagens est\xE1 em implanta\xE7\xE3o e ser\xE1 liberado ap\xF3s a integra\xE7\xE3o segura com o sistema de corridas.",
    availability: "coming-soon"
  },
  {
    key: "clube-consulta",
    path: "/clube-consulta",
    title: "Consultar Pontos | Clube de Vantagens",
    description: "A consulta autenticada de pontos do Clube de Vantagens est\xE1 em implanta\xE7\xE3o.",
    availability: "coming-soon"
  },
  {
    key: "clube-painel",
    path: "/clube-painel",
    title: "Meu Painel | Clube de Vantagens",
    description: "O portal autenticado do Clube de Vantagens est\xE1 em implanta\xE7\xE3o.",
    availability: "coming-soon"
  },
  {
    key: "clube-corridas",
    path: "/clube-corridas",
    title: "Hist\xF3rico de Corridas | Clube de Vantagens",
    description: "O hist\xF3rico autenticado de corridas do Clube de Vantagens est\xE1 em implanta\xE7\xE3o.",
    availability: "coming-soon"
  },
  {
    key: "clube-pontuacao",
    path: "/clube-pontuacao",
    title: "Minha Pontua\xE7\xE3o | Clube de Vantagens",
    description: "A pontua\xE7\xE3o autenticada do Clube de Vantagens est\xE1 em implanta\xE7\xE3o.",
    availability: "coming-soon"
  },
  {
    key: "clube-catalogo",
    path: "/clube-catalogo",
    title: "Cat\xE1logo de Recompensas | Clube de Vantagens",
    description: "O cat\xE1logo transacional do Clube de Vantagens est\xE1 em implanta\xE7\xE3o.",
    availability: "coming-soon"
  },
  {
    key: "clube-resgates",
    path: "/clube-resgates",
    title: "Hist\xF3rico de Resgates | Clube de Vantagens",
    description: "O hist\xF3rico autenticado de resgates do Clube de Vantagens est\xE1 em implanta\xE7\xE3o.",
    availability: "coming-soon"
  },
  {
    key: "clube-perfil",
    path: "/clube-perfil",
    title: "Meu Perfil | Clube de Vantagens",
    description: "A \xE1rea autenticada de perfil do Clube de Vantagens est\xE1 em implanta\xE7\xE3o.",
    availability: "coming-soon"
  },
  {
    key: "clube-regulamento",
    path: "/clube-regulamento",
    title: "Regulamento do Clube de Vantagens | Kart\xF3dromo de Betim",
    description: "Consulte as regras p\xFAblicas do Clube de Vantagens do Kart\xF3dromo Internacional de Betim.",
    availability: "active"
  },
  {
    key: "clube-campanhas",
    path: "/clube-campanhas",
    title: "Campanhas | Clube de Vantagens",
    description: "A \xE1rea autenticada de campanhas do Clube de Vantagens est\xE1 em implanta\xE7\xE3o.",
    availability: "coming-soon"
  }
];

// worker.js
var publicRoutes = new Set(routes_default.map((r) => r.path));
var localAsset = /* @__PURE__ */ __name((path) => path.startsWith("/media/") || path.startsWith("/ui-assets/") || path === "/sitemap.xml" || path === "/robots.txt", "localAsset");
var securityHeaders = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "X-Frame-Options": "SAMEORIGIN"
};
var worker_default = {
  async fetch(request, env) {
    const url = new URL(request.url);
    // política de cancelamento (09/10/2026): pacote do site com a seção na página /reservas
    if (url.pathname === JS_NOVO) return new Response(PACOTE_POLITICA, { headers: { "Content-Type": "application/javascript; charset=utf-8", "Cache-Control": "public, max-age=31536000, immutable", ...securityHeaders } });
    const raw = url.pathname;
    const path = raw.replace(/\/$/, "") || "/";
    const legacyAlias = path === "/home" || path === "/home.html" ? "/" : path.endsWith(".html") || path.endsWith(".dc") ? path.replace(/\.(html|dc)$/, "") : null;
    if (legacyAlias && publicRoutes.has(legacyAlias))
      return Response.redirect(
        `${url.origin}${legacyAlias}${url.search}${url.hash}`,
        301
      );
    if ((publicRoutes.has(path) || localAsset(path)) && ["GET", "HEAD"].includes(request.method)) {
      if (publicRoutes.has(path) && url.hostname === "www.kartodromodebetim.com.br")
        return Response.redirect(
          `https://kartodromodebetim.com.br${path}${url.search}`,
          301
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
      const resposta = new Response(asset.body, { status: asset.status, headers });
      if (publicRoutes.has(path) && asset.status === 200) return new HTMLRewriter().on('script[src="' + JS_VELHO + '"]', { element(e) { e.setAttribute("src", JS_NOVO); } }).transform(resposta);
      return resposta;
    }
    const originURL = new URL(request.url);
    originURL.hostname = "kartodromodebetim.com.br";
    originURL.protocol = "https:";
    originURL.port = "";
    return env.LEGACY.fetch(new Request(originURL, request));
  }
};
export {
  worker_default as default
};
