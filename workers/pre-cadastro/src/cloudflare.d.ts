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
  body: ReadableStream;
  httpEtag: string;
}

interface R2Objects {
  objects: { key: string }[];
  truncated: boolean;
}

interface R2Bucket {
  get(key: string): Promise<R2ObjectBody | null>;
  put(key: string, value: string | ArrayBuffer | Uint8Array, options?: { httpMetadata?: { contentType?: string }; customMetadata?: Record<string, string> }): Promise<unknown>;
  list(options?: { prefix?: string; limit?: number }): Promise<R2Objects>;
  delete(keys: string | string[]): Promise<void>;
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(columnName?: string): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ success: boolean; results: T[]; meta: { changes: number } }>;
  run(): Promise<{ success: boolean; meta: { changes: number } }>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch(statements: D1PreparedStatement[]): Promise<unknown[]>;
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

// Durable Objects e WebSocket do Workers (só o que o tempo real do app usa)
interface DurableObjectId { toString(): string }
interface DurableObjectStub { fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> }
interface DurableObjectNamespace { idFromName(name: string): DurableObjectId; get(id: DurableObjectId): DurableObjectStub }
interface DurableObjectStorage { getAlarm(): Promise<number | null>; setAlarm(time: number | Date): Promise<void> }
interface DurableObjectState { storage: DurableObjectStorage; acceptWebSocket(ws: WebSocket, tags?: string[]): void; getWebSockets(tag?: string): WebSocket[] }
interface DurableObject { fetch(request: Request): Promise<Response> | Response; alarm?(): Promise<void> | void }
declare const WebSocketPair: { new (): { 0: WebSocket; 1: WebSocket } };
interface ResponseInit { webSocket?: WebSocket | null }
