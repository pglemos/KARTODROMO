/**
 * Durable Objects num processo só: cada nome vira uma instância em memória, com `storage` gravado em SQLite
 * (valores serializados pelo v8, como o structured clone da Cloudflare), alarmes persistidos e WebSockets com hibernação.
 * Como há um processo só, a garantia de "uma instância por id" vale naturalmente.
 */
import { createHash, randomBytes } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { serialize, deserialize } from 'node:v8';
import type { CfWebSocket, DonoHibernado } from './websocket';

type Classe = new (state: DurableObjectState, env: Record<string, unknown>) => {
  fetch?(req: Request): Promise<Response> | Response;
  alarm?(): Promise<void> | void;
} & DonoHibernado;

export class DurableObjectId {
  constructor(private readonly hex: string, readonly name?: string) {}
  toString(): string { return this.hex; }
  equals(o: DurableObjectId): boolean { return o.toString() === this.hex; }
}

class Storage {
  constructor(private readonly db: DatabaseSync, private readonly id: string, private readonly agendar: (t: number | null) => void) {}
  async get(chave: string | string[]): Promise<unknown> {
    if (Array.isArray(chave)) {
      const m = new Map<string, unknown>();
      for (const k of chave) { const v = await this.get(k); if (v !== undefined) m.set(k, v); }
      return m;
    }
    const r = this.db.prepare('SELECT valor FROM kv WHERE obj = ? AND chave = ?').get(this.id, chave) as { valor: Uint8Array } | undefined;
    return r ? deserialize(r.valor) : undefined;
  }
  async put(chave: string | Record<string, unknown>, valor?: unknown): Promise<void> {
    const pares = typeof chave === 'string' ? [[chave, valor]] as [string, unknown][] : Object.entries(chave);
    const st = this.db.prepare('INSERT INTO kv (obj, chave, valor) VALUES (?, ?, ?) ON CONFLICT(obj, chave) DO UPDATE SET valor = excluded.valor');
    this.db.exec('BEGIN');
    try { for (const [k, v] of pares) st.run(this.id, k, serialize(v)); this.db.exec('COMMIT'); } catch (e) { this.db.exec('ROLLBACK'); throw e; }
  }
  async delete(chave: string | string[]): Promise<boolean | number> {
    const ks = Array.isArray(chave) ? chave : [chave];
    let n = 0;
    for (const k of ks) n += Number(this.db.prepare('DELETE FROM kv WHERE obj = ? AND chave = ?').run(this.id, k).changes);
    return Array.isArray(chave) ? n : n > 0;
  }
  async deleteAll(): Promise<void> {
    this.db.prepare('DELETE FROM kv WHERE obj = ?').run(this.id);
  }
  async list(op: { prefix?: string; start?: string; end?: string; limit?: number; reverse?: boolean } = {}): Promise<Map<string, unknown>> {
    const p = op.prefix ?? '';
    const rows = this.db.prepare(`SELECT chave, valor FROM kv WHERE obj = ? AND chave >= ? AND chave < ? AND chave >= ? ${op.end ? 'AND chave < ?' : ''}
      ORDER BY chave ${op.reverse ? 'DESC' : 'ASC'} LIMIT ?`)
      .all(...([this.id, p, p + '￿', op.start ?? '', ...(op.end ? [op.end] : []), op.limit ?? 1e9] as (string | number)[])) as { chave: string; valor: Uint8Array }[];
    return new Map(rows.map((r) => [r.chave, deserialize(r.valor)]));
  }
  async transaction<T>(fn: (txn: Storage) => Promise<T>): Promise<T> { return fn(this); }
  async getAlarm(): Promise<number | null> {
    const r = this.db.prepare('SELECT quando FROM alarme WHERE obj = ?').get(this.id) as { quando: number } | undefined;
    return r ? r.quando : null;
  }
  async setAlarm(t: number | Date): Promise<void> {
    const quando = typeof t === 'number' ? t : t.getTime();
    this.db.prepare('INSERT INTO alarme (obj, quando) VALUES (?, ?) ON CONFLICT(obj) DO UPDATE SET quando = excluded.quando').run(this.id, quando);
    this.agendar(quando);
  }
  async deleteAlarm(): Promise<void> {
    this.db.prepare('DELETE FROM alarme WHERE obj = ?').run(this.id);
    this.agendar(null);
  }
  async sync(): Promise<void> { /* gravação já é síncrona */ }
}

export class DurableObjectState {
  readonly storage: Storage;
  private pronto: Promise<unknown> = Promise.resolve();
  private readonly sockets = new Set<CfWebSocket>();
  constructor(readonly id: DurableObjectId, storage: Storage) {
    this.storage = storage;
  }
  blockConcurrencyWhile<T>(fn: () => Promise<T>): Promise<T> {
    const p = fn();
    this.pronto = p.catch(() => undefined);
    return p;
  }
  aguardar(): Promise<unknown> { return this.pronto; }
  waitUntil(p: Promise<unknown>): void { p.catch((e) => console.error('[edge] DO waitUntil', (e as Error).message)); }
  acceptWebSocket(ws: CfWebSocket, tags: string[] = []): void {
    ws.tags = tags;
    ws.dono = this.instancia as DonoHibernado;
    this.sockets.add(ws);
    ws.addEventListener('close', () => this.sockets.delete(ws));
  }
  getWebSockets(tag?: string): CfWebSocket[] {
    for (const s of this.sockets) if (s.readyState >= 2) this.sockets.delete(s);
    return [...this.sockets].filter((s) => !tag || s.tags.includes(tag));
  }
  getTags(ws: CfWebSocket): string[] { return ws.tags; }
  instancia: unknown = null;
}

export class DurableObjectNamespace {
  private readonly instancias = new Map<string, { obj: InstanceType<Classe>; state: DurableObjectState; timer?: NodeJS.Timeout }>();
  private readonly db: DatabaseSync;
  private classe: Classe | null = null;
  private env: Record<string, unknown> = {};

  constructor(readonly nomeClasse: string, arquivoSqlite: string) {
    this.db = new DatabaseSync(arquivoSqlite);
    this.db.exec(`PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;
      CREATE TABLE IF NOT EXISTS kv (obj TEXT NOT NULL, chave TEXT NOT NULL, valor BLOB NOT NULL, PRIMARY KEY (obj, chave));
      CREATE TABLE IF NOT EXISTS alarme (obj TEXT PRIMARY KEY, quando INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS nome (obj TEXT PRIMARY KEY, nome TEXT)`);
  }

  /** Liga a classe exportada pelo Worker e o env (depois que o módulo carrega) e reagenda os alarmes guardados. */
  vincular(classe: Classe, env: Record<string, unknown>): void {
    this.classe = classe;
    this.env = env;
    const alarmes = this.db.prepare('SELECT a.obj, a.quando, n.nome FROM alarme a LEFT JOIN nome n ON n.obj = a.obj').all() as { obj: string; quando: number; nome: string | null }[];
    for (const a of alarmes) this.instancia(new DurableObjectId(a.obj, a.nome ?? undefined)).agendar(a.quando);
  }

  idFromName(nome: string): DurableObjectId {
    const hex = createHash('sha256').update(`${this.nomeClasse}:${nome}`).digest('hex');
    this.db.prepare('INSERT OR IGNORE INTO nome (obj, nome) VALUES (?, ?)').run(hex, nome);
    return new DurableObjectId(hex, nome);
  }
  idFromString(hex: string): DurableObjectId { return new DurableObjectId(hex); }
  newUniqueId(): DurableObjectId { return new DurableObjectId(randomBytes(32).toString('hex')); }

  get(id: DurableObjectId): { id: DurableObjectId; name?: string; fetch(req: Request | string, init?: RequestInit): Promise<Response> } {
    return {
      id,
      name: id.name,
      fetch: async (req, init) => {
        const r = req instanceof Request && !init ? req : new Request(req, init);
        const inst = this.instancia(id);
        await inst.state.aguardar();
        if (!inst.obj.fetch) throw new Error(`Durable Object ${this.nomeClasse} sem fetch()`);
        return inst.obj.fetch(r);
      },
    };
  }
  getByName(nome: string) { return this.get(this.idFromName(nome)); }

  private instancia(id: DurableObjectId) {
    const chave = id.toString();
    let i = this.instancias.get(chave);
    if (i) return { ...i, agendar: (t: number | null) => this.agendar(chave, t) };
    if (!this.classe) throw new Error(`Durable Object ${this.nomeClasse} ainda não vinculado`);
    const storage = new Storage(this.db, chave, (t) => this.agendar(chave, t));
    const state = new DurableObjectState(id, storage);
    // ctx.id/ctx.storage (DurableObject moderno) e state.storage (antigo) apontam para o mesmo objeto
    const obj = new this.classe(state, this.env);
    state.instancia = obj;
    i = { obj, state };
    this.instancias.set(chave, i);
    return { ...i, agendar: (t: number | null) => this.agendar(chave, t) };
  }

  private agendar(chave: string, quando: number | null): void {
    const i = this.instancias.get(chave);
    if (!i) return;
    if (i.timer) clearTimeout(i.timer);
    i.timer = undefined;
    if (quando === null) return;
    const espera = Math.max(0, Math.min(quando - Date.now(), 2_147_000_000));
    i.timer = setTimeout(() => void this.disparar(chave, 0), espera);
  }

  private async disparar(chave: string, tentativa: number): Promise<void> {
    const i = this.instancias.get(chave);
    if (!i) return;
    i.timer = undefined;
    // o alarme sai da tabela antes de rodar: se o handler agendar outro, ele fica
    this.db.prepare('DELETE FROM alarme WHERE obj = ?').run(chave);
    try {
      await i.state.aguardar();
      await i.obj.alarm?.();
    } catch (e) {
      console.error(`[edge] alarme ${this.nomeClasse}`, (e as Error).message);
      if (tentativa < 6) {
        const prox = Date.now() + 2 ** tentativa * 1000;
        this.db.prepare('INSERT OR IGNORE INTO alarme (obj, quando) VALUES (?, ?)').run(chave, prox);
        i.timer = setTimeout(() => void this.disparar(chave, tentativa + 1), prox - Date.now());
      }
    }
  }
}

/** Base `DurableObject` de `cloudflare:workers`. */
export class DurableObject {
  constructor(readonly ctx: DurableObjectState, readonly env: Record<string, unknown>) {}
}
