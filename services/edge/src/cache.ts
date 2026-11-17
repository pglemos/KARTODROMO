/**
 * Substituto do Cache API da Cloudflare (`caches.default` / `caches.open`) para os Workers na VPS.
 * Os Workers usam o cache para limites por IP (cadastro, busca de CPF, 200 Milhas) e para guardar consultas curtas
 * (situação de cobrança Asaas, ao vivo). Guarda em memória, por processo, respeitando `cache-control: max-age` /
 * `s-maxage` da resposta; sem max-age, não guarda (como a Cloudflare faz com respostas sem TTL).
 */

interface Guardado {
  status: number;
  statusText: string;
  headers: [string, string][];
  corpo: Uint8Array;
  expira: number;
}

const MAX_ITENS = 20_000;

function chave(req: RequestInfo | URL): string {
  if (typeof req === 'string') return new URL(req).toString();
  if (req instanceof URL) return req.toString();
  return new URL(req.url).toString();
}

function ttlSegundos(h: Headers): number {
  const cc = h.get('cache-control') ?? '';
  if (/(^|,)\s*(no-store|private)\b/i.test(cc)) return 0;
  const s = /s-maxage\s*=\s*(\d+)/i.exec(cc) ?? /max-age\s*=\s*(\d+)/i.exec(cc);
  return s ? Number(s[1]) : 0;
}

export class EdgeCache {
  private itens = new Map<string, Guardado>();

  constructor(private agora: () => number = Date.now) {}

  async match(req: RequestInfo | URL): Promise<Response | undefined> {
    const k = chave(req);
    const g = this.itens.get(k);
    if (!g) return undefined;
    if (g.expira <= this.agora()) {
      this.itens.delete(k);
      return undefined;
    }
    return new Response(g.corpo.byteLength ? g.corpo.slice() : null, { status: g.status, statusText: g.statusText, headers: g.headers });
  }

  async put(req: RequestInfo | URL, res: Response): Promise<void> {
    const ttl = ttlSegundos(res.headers);
    const corpo = new Uint8Array(await res.arrayBuffer());
    if (ttl <= 0) return;
    if (this.itens.size >= MAX_ITENS) this.limpar();
    const k = chave(req);
    this.itens.delete(k); // reinsere no fim (ordem de inserção = mais antigo primeiro)
    this.itens.set(k, { status: res.status, statusText: res.statusText, headers: [...res.headers.entries()], corpo, expira: this.agora() + ttl * 1000 });
  }

  async delete(req: RequestInfo | URL): Promise<boolean> {
    return this.itens.delete(chave(req));
  }

  /** Tira os vencidos; se ainda estiver cheio, descarta os mais antigos. */
  private limpar() {
    const t = this.agora();
    for (const [k, g] of this.itens) if (g.expira <= t) this.itens.delete(k);
    for (const k of this.itens.keys()) {
      if (this.itens.size < MAX_ITENS * 0.9) break;
      this.itens.delete(k);
    }
  }
}

export class EdgeCacheStorage {
  readonly default = new EdgeCache();
  private nomeados = new Map<string, EdgeCache>();
  async open(nome: string): Promise<EdgeCache> {
    let c = this.nomeados.get(nome);
    if (!c) this.nomeados.set(nome, (c = new EdgeCache()));
    return c;
  }
}
