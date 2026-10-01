/**
 * Só o pedaço dos tipos do Cloudflare Workers que o pré-cadastro usa. O wrangler compila sem checar tipos;
 * isto é para o `tsc` da raiz do projeto entender o Worker (antes dava 4 erros) sem instalar @cloudflare/workers-types.
 */
interface Fetcher {
  fetch(req: Request): Promise<Response>;
}

interface R2ObjectBody {
  key: string;
  json<T>(): Promise<T>;
  text(): Promise<string>;
}

interface R2Objects {
  objects: { key: string }[];
  truncated: boolean;
}

interface R2Bucket {
  get(key: string): Promise<R2ObjectBody | null>;
  put(key: string, value: string, options?: { httpMetadata?: { contentType?: string } }): Promise<unknown>;
  list(options?: { prefix?: string; limit?: number }): Promise<R2Objects>;
  delete(keys: string | string[]): Promise<void>;
}

interface CacheStorage {
  readonly default: Cache;
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
}

interface ExportedHandler<E = unknown> {
  fetch?(req: Request, env: E, ctx: ExecutionContext): Promise<Response>;
}
