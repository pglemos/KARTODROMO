/**
 * D1 da Cloudflare em cima do SQLite nativo do Node (`node:sqlite`). É o mesmo motor do D1: as consultas dos Workers
 * rodam sem mudança. API coberta: prepare/bind/first/all/run/raw, batch (transação) e exec.
 */
import { DatabaseSync, type StatementSync } from 'node:sqlite';

type Valor = null | number | bigint | string | Uint8Array;

export interface D1Meta { duration: number; changes: number; last_row_id: number; rows_read: number; rows_written: number; changed_db: boolean; size_after?: number }
export interface D1Result<T = Record<string, unknown>> { success: true; results: T[]; meta: D1Meta }

function converte(v: unknown, i: number): Valor {
  if (v === null) return null;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (typeof v === 'number' || typeof v === 'bigint' || typeof v === 'string') return v;
  if (v instanceof Uint8Array) return v;
  if (v instanceof ArrayBuffer) return new Uint8Array(v);
  if (ArrayBuffer.isView(v)) return new Uint8Array(v.buffer, v.byteOffset, v.byteLength);
  // o D1 recusa undefined, objetos e datas: manter o mesmo erro evita gravar lixo calado
  throw new Error(`D1_TYPE_ERROR: Type '${v === undefined ? 'undefined' : typeof v}' not supported for value '${String(v)}' (parâmetro ${i + 1})`);
}

/** O D1 devolve BLOB como array de números. */
function linha<T>(r: Record<string, unknown> | undefined): T {
  if (!r) return r as T;
  for (const k of Object.keys(r)) if (r[k] instanceof Uint8Array) r[k] = Array.from(r[k] as Uint8Array);
  return { ...r } as T;
}

export class D1PreparedStatement {
  constructor(private readonly db: D1Database, readonly sql: string, private readonly params: Valor[] = []) {}

  bind(...valores: unknown[]): D1PreparedStatement {
    return new D1PreparedStatement(this.db, this.sql, valores.map(converte));
  }

  private stmt(): StatementSync {
    return this.db.compilar(this.sql);
  }

  async first<T = Record<string, unknown>>(coluna?: string): Promise<T | null> {
    const r = this.stmt().get(...this.params) as Record<string, unknown> | undefined;
    if (!r) return null;
    if (coluna === undefined) return linha<T>(r);
    if (!(coluna in r)) throw new Error(`D1_COLUMN_NOTFOUND: Column not found (${coluna})`);
    return linha<Record<string, T>>(r)[coluna] ?? null;
  }

  async all<T = Record<string, unknown>>(): Promise<D1Result<T>> {
    return this.executa<T>();
  }

  async run<T = Record<string, unknown>>(): Promise<D1Result<T>> {
    return this.executa<T>();
  }

  async raw<T = unknown[]>(opcoes?: { columnNames?: boolean }): Promise<T[]> {
    const st = this.stmt();
    const nomes = st.columns().map((c) => c.name);
    const linhas = (st.all(...this.params) as Record<string, unknown>[]).map((r) => nomes.map((n) => (r[n] instanceof Uint8Array ? Array.from(r[n] as Uint8Array) : r[n])));
    return (opcoes?.columnNames ? [nomes, ...linhas] : linhas) as T[];
  }

  /** Usado por all/run/batch: devolve linhas (SELECT/RETURNING) e o efeito (changes/last_row_id) como o D1. */
  executaSync<T>(): D1Result<T> {
    const t0 = performance.now();
    const st = this.stmt();
    let results: T[] = [];
    let changes = 0;
    let last = 0;
    if (st.columns().length > 0) {
      results = (st.all(...this.params) as Record<string, unknown>[]).map((r) => linha<T>(r));
      const c = this.db.compilar('select changes() c, last_insert_rowid() l').get() as { c: number; l: number };
      changes = /^\s*(insert|update|delete|replace|with)/i.test(this.sql) ? Number(c.c) : 0;
      last = Number(c.l);
    } else {
      const r = st.run(...this.params);
      changes = Number(r.changes);
      last = Number(r.lastInsertRowid);
    }
    return {
      success: true,
      results,
      meta: { duration: performance.now() - t0, changes, last_row_id: last, rows_read: results.length, rows_written: changes, changed_db: changes > 0 },
    };
  }

  private async executa<T>(): Promise<D1Result<T>> {
    return this.executaSync<T>();
  }
}

export class D1Database {
  private readonly db: DatabaseSync;
  private readonly cache = new Map<string, StatementSync>();

  constructor(readonly caminho: string) {
    this.db = new DatabaseSync(caminho);
    this.db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000; PRAGMA synchronous = NORMAL;');
  }

  /** Statements compilados ficam em cache (as mesmas consultas se repetem a cada requisição). */
  compilar(sql: string): StatementSync {
    let st = this.cache.get(sql);
    if (!st) {
      st = this.db.prepare(sql);
      if (this.cache.size > 2000) this.cache.clear();
      this.cache.set(sql, st);
    }
    return st;
  }

  prepare(sql: string): D1PreparedStatement {
    return new D1PreparedStatement(this, sql);
  }

  /** Todas as instruções numa transação só: ou tudo, ou nada (igual ao D1). */
  async batch<T = Record<string, unknown>>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]> {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const out = statements.map((s) => s.executaSync<T>());
      this.db.exec('COMMIT');
      return out;
    } catch (e) {
      try { this.db.exec('ROLLBACK'); } catch { /* já desfeita */ }
      throw e;
    }
  }

  async exec(sql: string): Promise<{ count: number; duration: number }> {
    const t0 = performance.now();
    this.db.exec(sql);
    return { count: sql.split(';').filter((x) => x.trim()).length, duration: performance.now() - t0 };
  }

  /** Sessões (leitura em réplica) não existem aqui: o próprio banco atende. */
  withSession(): D1Database {
    return this;
  }

  fechar(): void {
    this.db.close();
  }
}
