import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { D1Database } from '../../services/edge/src/d1';
import { R2Bucket } from '../../services/edge/src/r2';
import { DurableObjectNamespace, DurableObject } from '../../services/edge/src/durable';
import { WebSocketPair, EdgeResponse, type CfWebSocket } from '../../services/edge/src/websocket';
import { Assets } from '../../services/edge/src/assets';

const dir = mkdtempSync(join(tmpdir(), 'edge-teste-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe('D1 em SQLite', () => {
  const db = new D1Database(join(dir, 'teste.sqlite'));
  it('prepare/bind/run/first/all/raw como o D1', async () => {
    await db.exec('CREATE TABLE t (id INTEGER PRIMARY KEY AUTOINCREMENT, nome TEXT NOT NULL, ativo INTEGER, dado BLOB)');
    const r = await db.prepare('INSERT INTO t (nome, ativo) VALUES (?1, ?2)').bind('TESTE CODEX', true).run();
    expect(r.success).toBe(true);
    expect(r.meta.changes).toBe(1);
    expect(r.meta.last_row_id).toBe(1);
    expect(await db.prepare('SELECT nome, ativo FROM t WHERE id = ?').bind(1).first()).toEqual({ nome: 'TESTE CODEX', ativo: 1 });
    expect(await db.prepare('SELECT nome FROM t WHERE id = ?').bind(1).first('nome')).toBe('TESTE CODEX');
    expect(await db.prepare('SELECT nome FROM t WHERE id = ?').bind(99).first()).toBeNull();
    expect((await db.prepare('SELECT id, nome FROM t').all()).results).toEqual([{ id: 1, nome: 'TESTE CODEX' }]);
    expect(await db.prepare('SELECT id, nome FROM t').raw({ columnNames: true })).toEqual([['id', 'nome'], [1, 'TESTE CODEX']]);
    const ret = await db.prepare('INSERT INTO t (nome) VALUES (?) RETURNING id').bind('outro').all();
    expect(ret.results).toEqual([{ id: 2 }]);
    expect(ret.meta.changes).toBe(1);
  });
  it('recusa undefined como o D1', async () => {
    expect(() => db.prepare('SELECT ?').bind(undefined)).toThrow(/D1_TYPE_ERROR/);
  });
  it('batch é atômico', async () => {
    await expect(db.batch([
      db.prepare('INSERT INTO t (nome) VALUES (?)').bind('vai'),
      db.prepare('INSERT INTO t (nome) VALUES (?)').bind(null), // NOT NULL quebra
    ])).rejects.toThrow();
    expect(await db.prepare("SELECT count(*) n FROM t WHERE nome = 'vai'").first('n')).toBe(0);
    const ok = await db.batch([db.prepare('INSERT INTO t (nome) VALUES (?)').bind('a'), db.prepare('SELECT count(*) n FROM t')]);
    expect(ok[1].results[0]).toEqual({ n: 3 });
  });
});

describe('R2 em disco', () => {
  const b = new R2Bucket(join(dir, 'r2'));
  it('put/get/head/list/delete', async () => {
    await b.put('fotos/a.jpg', new Uint8Array([1, 2, 3]), { httpMetadata: { contentType: 'image/jpeg' }, customMetadata: { dono: 'x' } });
    await b.put('fotos/b.jpg', 'texto');
    await b.put('outros/c.txt', 'c');
    const o = await b.get('fotos/a.jpg');
    expect(o?.size).toBe(3);
    expect(new Uint8Array(await o!.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
    expect(o?.httpMetadata.contentType).toBe('image/jpeg');
    expect(o?.customMetadata).toEqual({ dono: 'x' });
    const h = new Headers(); o!.writeHttpMetadata(h); expect(h.get('content-type')).toBe('image/jpeg');
    expect(await (await b.get('fotos/b.jpg'))!.text()).toBe('texto');
    expect(await new Response((await b.get('fotos/b.jpg'))!.body).text()).toBe('texto');
    expect((await b.list({ prefix: 'fotos/' })).objects.map((x) => x.key)).toEqual(['fotos/a.jpg', 'fotos/b.jpg']);
    const p1 = await b.list({ limit: 2 });
    expect(p1.truncated).toBe(true);
    const p2 = await b.list({ limit: 2, cursor: p1.cursor });
    expect(p2.objects.map((x) => x.key)).toEqual(['outros/c.txt']);
    expect((await b.list({ delimiter: '/' })).delimitedPrefixes).toEqual(['fotos/', 'outros/']);
    await b.delete(['fotos/a.jpg']);
    expect(await b.head('fotos/a.jpg')).toBeNull();
    expect(await b.get('nada')).toBeNull();
  });
});

describe('Durable Objects', () => {
  class Contador extends DurableObject {
    async fetch(req: Request) {
      const url = new URL(req.url);
      if (url.pathname === '/ws') {
        const par = new WebSocketPair();
        this.ctx.acceptWebSocket(par[1] as CfWebSocket);
        (par[1] as CfWebSocket).send('ola');
        return new EdgeResponse(null, { status: 101, webSocket: par[0] as unknown as WebSocket });
      }
      const n = ((await this.ctx.storage.get('n')) as number | undefined ?? 0) + 1;
      await this.ctx.storage.put('n', n);
      if (url.pathname === '/alarme') await this.ctx.storage.setAlarm(Date.now() + 30);
      return Response.json({ n });
    }
    disparos = 0;
    async alarm() { this.disparos++; await this.ctx.storage.put('alarmou', true); }
    recebidas: string[] = [];
    webSocketMessage(ws: CfWebSocket, m: string | ArrayBuffer) { this.recebidas.push(String(m)); ws.send(`eco:${m}`); }
  }
  const ns = new DurableObjectNamespace('Contador', join(dir, 'do.sqlite'));
  ns.vincular(Contador as never, {});
  it('mesmo nome = mesma instância, storage persiste', async () => {
    const a = ns.get(ns.idFromName('pista'));
    expect(await (await a.fetch('https://x/')).json()).toEqual({ n: 1 });
    expect(await (await ns.get(ns.idFromName('pista')).fetch('https://x/')).json()).toEqual({ n: 2 });
    expect(await (await ns.get(ns.idFromName('outra')).fetch('https://x/')).json()).toEqual({ n: 1 });
    // outra namespace sobre o mesmo arquivo (reinício do processo) enxerga o que foi gravado
    const ns2 = new DurableObjectNamespace('Contador', join(dir, 'do.sqlite'));
    ns2.vincular(Contador as never, {});
    expect(await (await ns2.get(ns2.idFromName('pista')).fetch('https://x/')).json()).toEqual({ n: 3 });
  });
  it('alarme dispara', async () => {
    await ns.get(ns.idFromName('alarme')).fetch('https://x/alarme');
    await new Promise((ok) => setTimeout(ok, 120));
    const r = await ns.get(ns.idFromName('alarme')).fetch('https://x/');
    expect(await r.json()).toEqual({ n: 2 });
  });
  it('WebSocket hibernado: 101 com webSocket, envio antes de ligar fica na fila, mensagens vão ao webSocketMessage', async () => {
    const r = await ns.get(ns.idFromName('ws')).fetch('https://x/ws') as EdgeResponse;
    expect(r.status).toBe(101);
    const cliente = r.webSocket as unknown as CfWebSocket;
    const enviados: unknown[] = [];
    const real = { readyState: 1, send: (d: unknown) => enviados.push(d), close: () => undefined, on: (ev: string, fn: (...a: unknown[]) => void) => { (real as unknown as Record<string, unknown>)[`_${ev}`] = fn; } };
    const { ligar } = await import('../../services/edge/src/websocket');
    ligar(cliente, real as never);
    expect(enviados).toEqual(['ola']);
    (real as unknown as { _message: (d: Buffer, b: boolean) => void })._message(Buffer.from('oi'), false);
    await new Promise((ok) => setTimeout(ok, 5));
    expect(enviados).toEqual(['ola', 'eco:oi']);
  });
});

describe('ASSETS', () => {
  it('auto-trailing-slash e bloqueio de ../', async () => {
    const { writeFileSync, mkdirSync } = await import('node:fs');
    const pub = join(dir, 'pub');
    mkdirSync(join(pub, 'sub'), { recursive: true });
    writeFileSync(join(pub, 'index.html'), '<h1>inicio</h1>');
    writeFileSync(join(pub, 'sobre.html'), 'sobre');
    writeFileSync(join(pub, 'sub', 'index.html'), 'sub');
    const a = new Assets({ directory: pub });
    expect(await (await a.fetch('https://x/')).text()).toBe('<h1>inicio</h1>');
    expect(await (await a.fetch('https://x/sobre')).text()).toBe('sobre');
    expect(await (await a.fetch('https://x/sub/')).text()).toBe('sub');
    expect((await a.fetch('https://x/sobre.html')).headers.get('content-type')).toMatch(/text\/html/);
    expect((await a.fetch('https://x/..%2F..%2Fetc%2Fpasswd')).status).toBe(404);
    expect((await a.fetch('https://x/nada')).status).toBe(404);
  });
});

describe('Cache API (caches.default)', async () => {
  const { EdgeCache, EdgeCacheStorage } = await import('../../services/edge/src/cache');
  it('guarda com max-age, expira e não guarda sem TTL — como o limite por IP do cadastro usa', async () => {
    let t = 1_000_000;
    const c = new EdgeCache(() => t);
    const k = new Request('https://limite.cadastro/cadastro/1.2.3.4');
    expect(await c.match(k)).toBeUndefined();
    await c.put(k, new Response('1', { headers: { 'cache-control': 'max-age=600' } }));
    expect(await (await c.match('https://limite.cadastro/cadastro/1.2.3.4'))?.text()).toBe('1');
    await c.put(k, new Response('2', { headers: { 'cache-control': 'max-age=600' } }));
    expect(await (await c.match(k))?.text()).toBe('2');
    t += 601_000;
    expect(await c.match(k)).toBeUndefined();
    await c.put(k, new Response('x'));
    expect(await c.match(k)).toBeUndefined();
    await c.put(k, new Response('{"pago":true}', { headers: { 'cache-control': 'max-age=60', 'content-type': 'application/json' } }));
    expect(await (await c.match(k))!.json()).toEqual({ pago: true });
    expect(await c.delete(k)).toBe(true);
    expect(await c.match(k)).toBeUndefined();
  });
  it('caches.default e caches.open', async () => {
    const s = new EdgeCacheStorage();
    expect(await s.open('a')).toBe(await s.open('a'));
    expect(s.default).not.toBe(await s.open('a'));
  });
});
