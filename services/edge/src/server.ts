/**
 * kart-edge: roda os Workers da Cloudflare na VPS, sem mudar o código deles.
 * Lê dist/manifest.json (gerado por build.mjs a partir dos wrangler.jsonc), monta os bindings (D1, R2, Durable Objects,
 * ASSETS, e-mail, serviços) e atende por hostname/rota como a Cloudflare. Fica atrás do Caddy, que termina o TLS.
 *
 * Variáveis: EDGE_PORTA (8787), EDGE_DADOS (/dados), EDGE_DIST (pasta do build), EDGE_SMTP_URL, EDGE_LOG_ACESSO=1.
 * Segredos de cada Worker: $EDGE_DADOS/segredos/<worker>.env (CHAVE=valor), fora do repositório.
 */
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { pathToFileURL } from 'node:url';
import { WebSocketServer } from 'ws';
import { D1Database } from './d1';
import { R2Bucket } from './r2';
import { DurableObjectNamespace } from './durable';
import { Assets } from './assets';
import { EnvioEmail } from './email';
import { EdgeResponse, WebSocketPair, ligar, type CfWebSocket } from './websocket';

const NativeResponse = globalThis.Response;
Object.defineProperty(EdgeResponse, Symbol.hasInstance, { value: (o: unknown) => o instanceof NativeResponse });

/**
 * Na Cloudflare, o fetch de saída de um Worker não leva `host`, `cf-*` nem `cdn-loop` do pedido original (o Worker
 * costuma repassar `req.headers` inteiro). Sem isso, a chamada para outro hostname atrás da Cloudflare volta 403/1000.
 */
const fetchNativo = globalThis.fetch;
export function limparSaida(input: RequestInfo | URL, init?: RequestInit): Request {
  const r = new Request(input, init);
  const sujos = [...r.headers.keys()].filter((k) => k === 'host' || k.startsWith('cf-') || k === 'cdn-loop' || k === 'x-forwarded-host');
  if (!sujos.length) return r;
  const h = new Headers(r.headers);
  for (const k of sujos) h.delete(k);
  return new Request(r, { headers: h });
}
Object.assign(globalThis, {
  Response: EdgeResponse,
  WebSocketPair,
  fetch: (input: RequestInfo | URL, init?: RequestInit) => fetchNativo(limparSaida(input, init)),
});

export interface Rota { host: string; caminho: string; exato: boolean; dominio: boolean }
export interface WorkerManifest {
  nome: string;
  modulo: string;
  rotas: Rota[];
  vars: Record<string, unknown>;
  d1: { binding: string; database_name: string }[];
  r2: { binding: string; bucket_name: string }[];
  dos: { name: string; class_name: string; script_name?: string }[];
  servicos: { binding: string; service: string }[];
  email: { name: string; allowed_sender_addresses?: string[] }[];
  assets?: { directory: string; binding?: string; run_worker_first?: boolean | string[]; html_handling?: string; not_found_handling?: string };
}

type Handler = { fetch(req: Request, env: Record<string, unknown>, ctx: unknown): Promise<Response> | Response };
interface Carregado { m: WorkerManifest; env: Record<string, unknown>; handler: Handler; assets: Assets | null }

const DIST = resolve(process.env.EDGE_DIST ?? join(import.meta.dirname, '..', 'dist'));
const DADOS = resolve(process.env.EDGE_DADOS ?? '/dados');
const LOG = process.env.EDGE_LOG_ACESSO === '1';

function lerSegredos(nome: string): Record<string, string> {
  const f = join(DADOS, 'segredos', `${nome}.env`);
  if (!existsSync(f)) return {};
  const out: Record<string, string> = {};
  for (const l of readFileSync(f, 'utf8').split(/\r?\n/)) {
    const m = l.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return out;
}

function casaGlob(padrao: string, caminho: string): boolean {
  if (padrao.endsWith('*')) return caminho.startsWith(padrao.slice(0, -1));
  return caminho === padrao;
}

const carregados = new Map<string, Carregado>();
const dbs = new Map<string, D1Database>();
const buckets = new Map<string, R2Bucket>();

export async function carregar(manifesto: WorkerManifest[]): Promise<void> {
  for (const d of ['d1', 'r2', 'do', 'segredos']) mkdirSync(join(DADOS, d), { recursive: true });
  const namespaces: { ns: DurableObjectNamespace; classe: string; worker: string }[] = [];
  // 1º monta os envs (serviços resolvem depois, porque um Worker pode chamar outro)
  for (const m of manifesto) {
    const env: Record<string, unknown> = { ...m.vars, ...lerSegredos(m.nome) };
    for (const d of m.d1) {
      if (!dbs.has(d.database_name)) dbs.set(d.database_name, new D1Database(join(DADOS, 'd1', `${d.database_name}.sqlite`)));
      env[d.binding] = dbs.get(d.database_name);
    }
    for (const b of m.r2) {
      if (!buckets.has(b.bucket_name)) buckets.set(b.bucket_name, new R2Bucket(join(DADOS, 'r2', b.bucket_name)));
      env[b.binding] = buckets.get(b.bucket_name);
    }
    for (const o of m.dos) {
      const ns = new DurableObjectNamespace(o.class_name, join(DADOS, 'do', `${o.script_name ?? m.nome}-${o.class_name}.sqlite`));
      env[o.name] = ns;
      namespaces.push({ ns, classe: o.class_name, worker: o.script_name ?? m.nome });
    }
    for (const e of m.email) env[e.name] = new EnvioEmail(process.env.EDGE_SMTP_URL, e.allowed_sender_addresses ?? []);
    const assets = m.assets ? new Assets({ ...m.assets, directory: resolve(DIST, m.assets.directory) }) : null;
    if (assets && m.assets?.binding) env[m.assets.binding] = assets;
    const mod = await import(pathToFileURL(resolve(DIST, m.modulo)).href);
    carregados.set(m.nome, { m, env, handler: mod.default as Handler, assets });
    (carregados.get(m.nome) as Carregado & { mod?: Record<string, unknown> }).mod = mod;
  }
  for (const c of carregados.values()) {
    for (const s of c.m.servicos) {
      c.env[s.binding] = {
        fetch: (input: Request | string | URL, init?: RequestInit) => {
          const alvo = carregados.get(s.service);
          if (!alvo) return Promise.resolve(new Response(`serviço ${s.service} não está na VPS`, { status: 502 }));
          return atender(alvo, input instanceof Request && !init ? input : new Request(input, init));
        },
      };
    }
  }
  for (const n of namespaces) {
    const c = carregados.get(n.worker) as (Carregado & { mod?: Record<string, unknown> }) | undefined;
    const classe = c?.mod?.[n.classe];
    if (!c || typeof classe !== 'function') throw new Error(`classe ${n.classe} não exportada por ${n.worker}`);
    n.ns.vincular(classe as never, c.env);
  }
}

/** Escolhe o Worker: rota de zona mais específica primeiro, depois domínio próprio (igual à Cloudflare). */
export function escolher(host: string, caminho: string): Carregado | null {
  let melhor: { c: Carregado; peso: number } | null = null;
  for (const c of carregados.values()) {
    for (const r of c.m.rotas) {
      if (r.host !== host) continue;
      if (!r.dominio && !(r.exato ? caminho === r.caminho : caminho.startsWith(r.caminho))) continue;
      const peso = r.dominio ? 0 : 1 + r.caminho.length + (r.exato ? 0.5 : 0);
      if (!melhor || peso > melhor.peso) melhor = { c, peso };
    }
  }
  return melhor?.c ?? null;
}

async function atender(c: Carregado, req: Request): Promise<Response> {
  const url = new URL(req.url);
  if (c.assets) {
    const rwf = c.m.assets?.run_worker_first;
    const workerPrimeiro = rwf === true || (Array.isArray(rwf) && rwf.some((p) => casaGlob(p, url.pathname)));
    if (!workerPrimeiro && ['GET', 'HEAD'].includes(req.method) && c.assets.resolver(url.pathname)) return c.assets.fetch(req);
  }
  const pendentes: Promise<unknown>[] = [];
  const ctx = {
    waitUntil: (p: Promise<unknown>) => { pendentes.push(p.catch((e) => console.error(`[edge] ${c.m.nome} waitUntil`, (e as Error)?.message ?? e))); },
    passThroughOnException: () => undefined,
    props: {},
  };
  return c.handler.fetch(req, c.env, ctx);
}

function montarRequest(req: IncomingMessage): Request {
  const host = String(req.headers['x-forwarded-host'] ?? req.headers.host ?? '').split(',')[0].trim().replace(/:\d+$/, '').toLowerCase();
  const h = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (v === undefined || k.startsWith('cf-') || k === 'x-forwarded-host') continue;
    for (const x of Array.isArray(v) ? v : [v]) h.append(k, x);
  }
  // IP real do cliente: o Caddy põe em X-Forwarded-For; ninguém de fora consegue forjar cf-connecting-ip
  const ip = String(req.headers['x-forwarded-for'] ?? '').split(',')[0].trim() || req.socket.remoteAddress || '';
  h.set('cf-connecting-ip', ip);
  h.set('host', host);
  const metodo = req.method ?? 'GET';
  const corpo = ['GET', 'HEAD'].includes(metodo) ? undefined : (Readable.toWeb(req) as ReadableStream);
  return new Request(`https://${host}${req.url ?? '/'}`, { method: metodo, headers: h, body: corpo, duplex: 'half' } as RequestInit);
}

async function escrever(res: ServerResponse, r: Response): Promise<void> {
  const cookies = r.headers.getSetCookie();
  const h: Record<string, string | string[]> = {};
  r.headers.forEach((v, k) => { if (k !== 'set-cookie') h[k] = v; });
  if (cookies.length) h['set-cookie'] = cookies;
  res.writeHead(r.status, h);
  if (!r.body) { res.end(); return; }
  const leitor = r.body.getReader();
  try {
    for (;;) {
      const { done, value } = await leitor.read();
      if (done) break;
      if (!res.write(value)) await new Promise((ok) => res.once('drain', ok));
    }
  } finally { res.end(); }
}

async function despachar(req: IncomingMessage): Promise<{ r: Response; nome: string }> {
  const request = montarRequest(req);
  const url = new URL(request.url);
  if (url.pathname === '/__edge/saude') {
    return { r: Response.json({ ok: true, workers: [...carregados.keys()] }), nome: '-' };
  }
  const c = escolher(url.hostname, url.pathname);
  if (!c) return { r: new Response('Not Found', { status: 404 }), nome: '-' };
  return { r: await atender(c, request), nome: c.m.nome };
}

export function iniciar(porta: number) {
  const wss = new WebSocketServer({ noServer: true });
  const servidor = createServer(async (req, res) => {
    const t0 = Date.now();
    try {
      const { r, nome } = await despachar(req);
      if (r.status === 101) throw new Error('resposta 101 sem pedido de upgrade');
      await escrever(res, r);
      if (LOG) console.log(`${r.status} ${Date.now() - t0}ms ${nome} ${req.method} ${req.headers.host}${req.url}`);
    } catch (e) {
      console.error(`[edge] erro ${req.method} ${req.headers.host}${req.url}:`, (e as Error).stack ?? e);
      if (!res.headersSent) res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('Erro interno');
    }
  });
  servidor.on('upgrade', async (req, socket, head) => {
    try {
      const { r } = await despachar(req);
      const ws = (r as EdgeResponse).webSocket as unknown as CfWebSocket | null;
      if (r.status === 101 && ws) {
        wss.handleUpgrade(req, socket, head, (real) => ligar(ws, real));
        return;
      }
      const corpo = Buffer.from(await r.arrayBuffer());
      socket.end(`HTTP/1.1 ${r.status} ${r.statusText || 'Erro'}\r\ncontent-type: ${r.headers.get('content-type') ?? 'text/plain'}\r\ncontent-length: ${corpo.length}\r\nconnection: close\r\n\r\n` + corpo.toString());
    } catch (e) {
      console.error('[edge] erro no upgrade', (e as Error).message);
      socket.destroy();
    }
  });
  servidor.keepAliveTimeout = 65_000;
  servidor.headersTimeout = 70_000;
  servidor.listen(porta, () => console.log(`[edge] ouvindo na porta ${porta}; workers: ${[...carregados.keys()].join(', ')}`));
  return servidor;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const manifesto = JSON.parse(readFileSync(join(DIST, 'manifest.json'), 'utf8')) as WorkerManifest[];
  const ativos = (process.env.EDGE_WORKERS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  await carregar(ativos.length ? manifesto.filter((m) => ativos.includes(m.nome)) : manifesto);
  iniciar(Number(process.env.EDGE_PORTA ?? 8787));
  for (const s of ['SIGTERM', 'SIGINT']) process.on(s, () => { for (const d of dbs.values()) d.fechar(); process.exit(0); });
}
