import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { resolve, extname } from "node:path";
const root = resolve("dist");
const routes = new Set(
  JSON.parse(await readFile("src/routes.json", "utf8")).map((r) => r.path),
);
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".woff2": "font/woff2",
  ".png": "image/png",
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".mp4": "video/mp4",
  ".pdf": "application/pdf",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
};
const port = Number(process.env.PORT || 4173);
createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(
      new URL(request.url, "http://localhost").pathname,
    );
    if (!["GET", "HEAD"].includes(request.method)) {
      response.writeHead(503, { "Content-Type": "application/json" });
      response.end(
        JSON.stringify({
          error: "Backend disponível no ambiente de produção.",
        }),
      );
      return;
    }
    const path = routes.has(pathname)
      ? `${pathname === "/" ? "" : pathname}/index.html`
      : pathname;
    const file = resolve(root, `.${path}`);
    if (!file.startsWith(root + "/")) {
      response.writeHead(404);
      response.end();
      return;
    }
    const info = await stat(file);
    if (!info.isFile()) {
      response.writeHead(404);
      response.end();
      return;
    }
    response.writeHead(200, {
      "Content-Type": types[extname(file)] || "application/octet-stream",
      "Content-Length": info.size,
      "Cache-Control": "no-cache",
    });
    if (request.method === "HEAD") response.end();
    else createReadStream(file).pipe(response);
  } catch {
    response.writeHead(404);
    response.end("Página não encontrada.");
  }
}).listen(port, "0.0.0.0", () =>
  console.log(`Prévia com HTML específico por rota: http://localhost:${port}`),
);
