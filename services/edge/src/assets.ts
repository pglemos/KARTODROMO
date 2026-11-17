/** `env.ASSETS` (Workers Static Assets): arquivos da pasta `assets.directory` do Worker, com o html_handling da Cloudflare. */
import { createReadStream, statSync } from 'node:fs';
import { extname, join, normalize, sep } from 'node:path';
import { Readable } from 'node:stream';

const TIPOS: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.htm': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.avif': 'image/avif',
  '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.otf': 'font/otf', '.mp4': 'video/mp4', '.webm': 'video/webm',
  '.mp3': 'audio/mpeg', '.pdf': 'application/pdf', '.webmanifest': 'application/manifest+json', '.map': 'application/json', '.wasm': 'application/wasm',
};

export interface OpcoesAssets { directory: string; html_handling?: string; not_found_handling?: string }

function arquivo(raiz: string, caminho: string): string | null {
  const alvo = normalize(join(raiz, decodeURIComponent(caminho)));
  if (alvo !== raiz && !alvo.startsWith(raiz + sep)) return null; // ../ para fora da pasta
  try { return statSync(alvo).isFile() ? alvo : null; } catch { return null; }
}

export class Assets {
  constructor(private readonly op: OpcoesAssets) {}

  /** Resolve o caminho como a Cloudflare: exato, depois .html e /index.html (auto-trailing-slash). */
  resolver(pathname: string): string | null {
    const raiz = this.op.directory;
    const modo = this.op.html_handling ?? 'auto-trailing-slash';
    const exato = arquivo(raiz, pathname);
    if (exato && !pathname.endsWith('/')) return exato;
    if (modo === 'none') return exato;
    const base = pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
    return (pathname.endsWith('/') ? arquivo(raiz, `${base}/index.html`) : null)
      ?? arquivo(raiz, `${base}.html`) ?? arquivo(raiz, `${base}/index.html`) ?? exato;
  }

  async fetch(input: Request | string | URL, init?: RequestInit): Promise<Response> {
    const req = input instanceof Request ? input : new Request(input, init);
    const url = new URL(req.url);
    let alvo = this.resolver(url.pathname);
    let status = 200;
    if (!alvo) {
      if (this.op.not_found_handling === 'single-page-application') alvo = arquivo(this.op.directory, '/index.html');
      else if (this.op.not_found_handling === '404-page') { alvo = arquivo(this.op.directory, '/404.html'); status = 404; }
    }
    if (!alvo) return new Response(null, { status: 404 }); // a Cloudflare devolve 404 vazio
    const st = statSync(alvo);
    const etag = `"${st.size.toString(16)}-${Math.floor(st.mtimeMs).toString(16)}"`;
    const h = new Headers({ 'content-type': TIPOS[extname(alvo).toLowerCase()] ?? 'application/octet-stream', etag, 'cache-control': 'public, max-age=0, must-revalidate' });
    if (req.headers.get('if-none-match') === etag) return new Response(null, { status: 304, headers: h });
    h.set('content-length', String(st.size));
    if (req.method === 'HEAD') return new Response(null, { status, headers: h });
    return new Response(Readable.toWeb(createReadStream(alvo)) as ReadableStream, { status, headers: h });
  }
}
