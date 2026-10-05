import { build } from "vite";
import { readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";
process.env.SITE_BUILD_TIME = String(Date.now());
await build();
await build({
  build: {
    ssr: "src/prerender.jsx",
    outDir: ".build",
    rollupOptions: { output: { entryFileNames: "prerender.mjs" } },
  },
});
const { render } = await import(resolve(".build/prerender.mjs"));
const routes = JSON.parse(await readFile("src/routes.json", "utf8"));
const template = await readFile("dist/index.html", "utf8");
const escape = (s) =>
  s.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");
for (const r of routes) {
  const dir = r.path === "/" ? "dist" : `dist${r.path}`;
  await mkdir(dir, { recursive: true });
  let html = template
    .replace('<div id="root"></div>', `<div id="root">${render(r.path)}</div>`)
    .replace(/<title>.*?<\/title>/, `<title>${escape(r.title)}</title>`)
    .replace(
      /(<meta name="description" content=")[^"]+/,
      `$1${escape(r.description)}`,
    )
    .replace(
      /(<link rel="canonical" href=")[^"]+/,
      `$1https://kartodromodebetim.com.br${r.path}`,
    )
    .replace(
      /(<meta property="og:title" content=")[^"]+/,
      `$1${escape(r.title)}`,
    )
    .replace(
      /(<meta property="og:description" content=")[^"]+/,
      `$1${escape(r.description)}`,
    )
    .replace(
      /(<meta property="og:url" content=")[^"]+/,
      `$1https://kartodromodebetim.com.br${r.path}`,
    );
  html = html.replace(
    "</head>",
    `<meta name="robots" content="${r.availability === "coming-soon" ? "noindex, follow" : "index, follow"}"/><script type="application/ld+json">${JSON.stringify({ "@context": "https://schema.org", "@type": "SportsActivityLocation", name: "Kartódromo Internacional de Betim", url: "https://kartodromodebetim.com.br", telephone: "+55-31-99884-2898", address: { "@type": "PostalAddress", streetAddress: "Av. Adutora Várzea das Flores, 477", addressLocality: "Betim", addressRegion: "MG", addressCountry: "BR" }, openingHours: ["Tu-Fr 16:00-22:00", "Sa-Su 08:00-19:00"] })}</script></head>`,
  );
  await writeFile(`${dir}/index.html`, html);
}
const sitemap = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${routes
  .filter((r) => r.availability === "active")
  .map((r) => `<url><loc>https://kartodromodebetim.com.br${r.path}</loc></url>`)
  .join("")}</urlset>`;
await writeFile("dist/sitemap.xml", sitemap);
await writeFile(
  "dist/robots.txt",
  "User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\nSitemap: https://kartodromodebetim.com.br/sitemap.xml\n",
);
await rm(".build", { recursive: true, force: true });
console.log(`Prerender concluído: ${routes.length} páginas.`);
