/**
 * R2 da Cloudflare em disco: cada bucket é uma pasta com os arquivos (nome = sha256 da chave) e um índice SQLite com
 * chave, tamanho, etag e metadados. API coberta: put/get/head/delete/list (com prefixo, cursor e delimitador).
 */
import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, existsSync, createReadStream, statSync } from 'node:fs';
import { writeFile, rename, rm, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { DatabaseSync } from 'node:sqlite';

interface HttpMetadata { contentType?: string; contentLanguage?: string; contentDisposition?: string; contentEncoding?: string; cacheControl?: string; cacheExpiry?: Date }
interface Linha { key: string; size: number; etag: string; uploaded: number; http: string | null; custom: string | null; arquivo: string; version: string }

export class R2Object {
  readonly key: string;
  readonly size: number;
  readonly etag: string;
  readonly httpEtag: string;
  readonly uploaded: Date;
  readonly version: string;
  readonly httpMetadata: HttpMetadata;
  readonly customMetadata: Record<string, string>;
  readonly checksums = { toJSON: () => ({}) };
  readonly storageClass = 'Standard';
  constructor(l: Linha) {
    this.key = l.key;
    this.size = l.size;
    this.etag = l.etag;
    this.httpEtag = `"${l.etag}"`;
    this.uploaded = new Date(l.uploaded);
    this.version = l.version;
    this.httpMetadata = l.http ? JSON.parse(l.http) : {};
    this.customMetadata = l.custom ? JSON.parse(l.custom) : {};
  }
  writeHttpMetadata(h: Headers): void {
    const m = this.httpMetadata;
    if (m.contentType) h.set('content-type', m.contentType);
    if (m.contentLanguage) h.set('content-language', m.contentLanguage);
    if (m.contentDisposition) h.set('content-disposition', m.contentDisposition);
    if (m.contentEncoding) h.set('content-encoding', m.contentEncoding);
    if (m.cacheControl) h.set('cache-control', m.cacheControl);
  }
}

export class R2ObjectBody extends R2Object {
  private usado = false;
  constructor(l: Linha, private readonly caminho: string, private readonly faixa?: { offset: number; length: number }) {
    super(l);
  }
  get body(): ReadableStream<Uint8Array> {
    this.usado = true;
    const op = this.faixa ? { start: this.faixa.offset, end: this.faixa.offset + this.faixa.length - 1 } : {};
    return Readable.toWeb(createReadStream(this.caminho, op)) as ReadableStream<Uint8Array>;
  }
  get bodyUsed(): boolean { return this.usado; }
  async arrayBuffer(): Promise<ArrayBuffer> {
    this.usado = true;
    const b = await readFile(this.caminho);
    const s = this.faixa ? b.subarray(this.faixa.offset, this.faixa.offset + this.faixa.length) : b;
    return s.buffer.slice(s.byteOffset, s.byteOffset + s.byteLength) as ArrayBuffer;
  }
  async bytes(): Promise<Uint8Array> { return new Uint8Array(await this.arrayBuffer()); }
  async text(): Promise<string> { return new TextDecoder().decode(await this.arrayBuffer()); }
  async json<T>(): Promise<T> { return JSON.parse(await this.text()) as T; }
  async blob(): Promise<Blob> { return new Blob([await this.arrayBuffer()], { type: this.httpMetadata.contentType }); }
}

async function paraBytes(v: unknown): Promise<Uint8Array> {
  if (v === null || v === undefined) return new Uint8Array();
  if (typeof v === 'string') return new TextEncoder().encode(v);
  if (v instanceof Uint8Array) return v;
  if (v instanceof ArrayBuffer) return new Uint8Array(v);
  if (ArrayBuffer.isView(v)) return new Uint8Array(v.buffer, v.byteOffset, v.byteLength);
  if (v instanceof Blob) return new Uint8Array(await v.arrayBuffer());
  if (v instanceof ReadableStream) return new Uint8Array(await new Response(v).arrayBuffer());
  throw new Error('R2: tipo de valor não suportado no put');
}

function httpMeta(m: unknown): HttpMetadata | null {
  if (!m) return null;
  if (m instanceof Headers) {
    const o: HttpMetadata = {};
    if (m.get('content-type')) o.contentType = m.get('content-type')!;
    if (m.get('content-disposition')) o.contentDisposition = m.get('content-disposition')!;
    if (m.get('content-encoding')) o.contentEncoding = m.get('content-encoding')!;
    if (m.get('content-language')) o.contentLanguage = m.get('content-language')!;
    if (m.get('cache-control')) o.cacheControl = m.get('cache-control')!;
    return o;
  }
  return m as HttpMetadata;
}

export class R2Bucket {
  private readonly db: DatabaseSync;
  constructor(readonly pasta: string) {
    mkdirSync(join(pasta, 'obj'), { recursive: true });
    this.db = new DatabaseSync(join(pasta, 'indice.sqlite'));
    this.db.exec(`PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;
      CREATE TABLE IF NOT EXISTS objeto (key TEXT PRIMARY KEY, size INTEGER NOT NULL, etag TEXT NOT NULL, uploaded INTEGER NOT NULL,
        http TEXT, custom TEXT, arquivo TEXT NOT NULL, version TEXT NOT NULL)`);
  }

  private linha(key: string): Linha | undefined {
    return this.db.prepare('SELECT * FROM objeto WHERE key = ?').get(key) as Linha | undefined;
  }

  async head(key: string): Promise<R2Object | null> {
    const l = this.linha(key);
    return l ? new R2Object(l) : null;
  }

  async get(key: string, opcoes?: { range?: { offset?: number; length?: number; suffix?: number } | Headers; onlyIf?: unknown }): Promise<R2ObjectBody | null> {
    const l = this.linha(key);
    if (!l) return null;
    const caminho = join(this.pasta, 'obj', l.arquivo);
    if (!existsSync(caminho)) return null;
    let faixa: { offset: number; length: number } | undefined;
    const r = opcoes?.range;
    if (r && !(r instanceof Headers)) {
      if (r.suffix !== undefined) faixa = { offset: Math.max(0, l.size - r.suffix), length: Math.min(r.suffix, l.size) };
      else { const off = r.offset ?? 0; faixa = { offset: off, length: Math.min(r.length ?? l.size - off, l.size - off) }; }
    }
    return new R2ObjectBody(l, caminho, faixa);
  }

  /** `uploaded` não existe na Cloudflare: só a importação usa, para manter a data original do objeto. */
  async put(key: string, valor: unknown, opcoes?: { httpMetadata?: HttpMetadata | Headers; customMetadata?: Record<string, string>; uploaded?: Date }): Promise<R2Object> {
    const bytes = await paraBytes(valor);
    const arquivo = createHash('sha256').update(key).digest('hex');
    const destino = join(this.pasta, 'obj', arquivo);
    const tmp = `${destino}.${randomUUID()}.tmp`;
    await writeFile(tmp, bytes);
    await rename(tmp, destino);
    const l: Linha = {
      key,
      size: bytes.byteLength,
      etag: createHash('md5').update(bytes).digest('hex'),
      uploaded: opcoes?.uploaded?.getTime() ?? Date.now(),
      http: opcoes?.httpMetadata ? JSON.stringify(httpMeta(opcoes.httpMetadata)) : null,
      custom: opcoes?.customMetadata ? JSON.stringify(opcoes.customMetadata) : null,
      arquivo,
      version: randomUUID().replace(/-/g, ''),
    };
    this.db.prepare(`INSERT INTO objeto (key, size, etag, uploaded, http, custom, arquivo, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET size = excluded.size, etag = excluded.etag, uploaded = excluded.uploaded, http = excluded.http,
        custom = excluded.custom, arquivo = excluded.arquivo, version = excluded.version`)
      .run(l.key, l.size, l.etag, l.uploaded, l.http, l.custom, l.arquivo, l.version);
    return new R2Object(l);
  }

  async delete(keys: string | string[]): Promise<void> {
    for (const key of Array.isArray(keys) ? keys : [keys]) {
      const l = this.linha(key);
      if (!l) continue;
      this.db.prepare('DELETE FROM objeto WHERE key = ?').run(key);
      await rm(join(this.pasta, 'obj', l.arquivo), { force: true });
    }
  }

  async list(opcoes: { prefix?: string; limit?: number; cursor?: string; delimiter?: string; startAfter?: string; include?: string[] } = {}) {
    const prefixo = opcoes.prefix ?? '';
    const limite = Math.min(Math.max(opcoes.limit ?? 1000, 1), 1000);
    const depois = opcoes.cursor ? Buffer.from(opcoes.cursor, 'base64url').toString() : opcoes.startAfter ?? '';
    // prefixo por faixa (key >= p AND key < p + U+FFFF) usa o índice da chave; GLOB/LIKE com '%' no prefixo não serviriam
    const rows = this.db.prepare(`SELECT * FROM objeto WHERE key >= ? AND key < ? AND key > ? ORDER BY key LIMIT ?`)
      .all(prefixo, prefixo + '￿', depois, opcoes.delimiter ? 100_000 : limite + 1) as unknown as Linha[];
    const objects: R2Object[] = [];
    const delimitedPrefixes: string[] = [];
    let ultimo = '';
    for (const l of rows) {
      if (objects.length + delimitedPrefixes.length >= limite) break;
      if (opcoes.delimiter) {
        const resto = l.key.slice(prefixo.length);
        const i = resto.indexOf(opcoes.delimiter);
        if (i >= 0) {
          const p = prefixo + resto.slice(0, i + opcoes.delimiter.length);
          if (!delimitedPrefixes.includes(p)) delimitedPrefixes.push(p);
          ultimo = l.key;
          continue;
        }
      }
      objects.push(new R2Object(l));
      ultimo = l.key;
    }
    const truncated = opcoes.delimiter ? rows.findIndex((r) => r.key === ultimo) < rows.length - 1 : rows.length > limite;
    return { objects, delimitedPrefixes, truncated, ...(truncated ? { cursor: Buffer.from(ultimo).toString('base64url') } : {}) };
  }

  /** Tamanho em disco (para o painel/monitor). */
  tamanho(): number {
    return (this.db.prepare('SELECT coalesce(sum(size), 0) s FROM objeto').get() as { s: number }).s;
  }
}

export function existeArquivo(p: string): boolean {
  try { return statSync(p).isFile(); } catch { return false; }
}
