import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { abrirStore, type AppStore } from '../../lib/app-v1/store';
import { criarUsuario, bloquearUsuario } from '../../lib/app-v1/auth';
import { criarModuloApp, type ModuloApp } from '../../lib/app-v1/rotas';

const SEGREDO = 'segredo-de-teste-com-tamanho-suficiente';
const SENHA = 'senha-de-teste-123';
const bateria = { id: 'b1', name: 'Bateria', type: 'corrida', state: 'preparando', createdAt: Date.now(), startedAt: null, competitors: [{ kart: '4', name: 'Ana', customerId: '10', detalhes: { email: 'a@b.c', peso: 70 } }] };

describe('rotas /api/app/v1', () => {
  let store: AppStore; let mod: ModuloApp; let srv: http.Server; let base: string;
  let assinantes: Set<() => void>;
  const mutacao = vi.fn();

  const f = (path: string, init: RequestInit = {}) => fetch(`${base}/api/app/v1${path}`, init);
  const json = (corpo: unknown, token?: string, extra: Record<string, string> = {}): RequestInit => ({ method: 'POST', body: JSON.stringify(corpo), headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}), ...extra } });
  const entrar = async (usuario: string) => {
    const r = await f('/auth/login', json({ usuario, senha: SENHA, deviceId: 't' }));
    expect(r.status).toBe(200);
    return (await r.json() as { accessToken: string; refreshToken: string });
  };
  const auth = (t: string) => ({ headers: { authorization: `Bearer ${t}` } });

  beforeEach(async () => {
    store = abrirStore(':memory:');
    assinantes = new Set();
    mutacao.mockClear();
    for (const [usuario, perfil] of [['rec', 'RECEPCAO'], ['op', 'OPERACAO'], ['ger', 'GERENCIA']] as const)
      await criarUsuario({ store, segredo: SEGREDO }, { usuario, nome: usuario, perfil, senha: SENHA });
    mod = criarModuloApp({
      store, segredo: SEGREDO, batidaMs: 20, limiteLoginPorMinuto: 500, limitePor10s: 2000,
      listarSessoes: () => [bateria], verSessao: (id) => (id === 'b1' ? bateria : undefined),
      assinarMudancas: (cb) => { assinantes.add(cb); return () => assinantes.delete(cb); },
    });
    srv = http.createServer((req, res) => {
      const url = new URL(req.url!, 'http://x');
      void mod.tratar(req, res, url).then((tratou) => { if (!tratou) { mutacao(); res.statusCode = 418; res.end(); } });
    });
    await new Promise<void>((r) => srv.listen(0, '127.0.0.1', r));
    base = `http://127.0.0.1:${(srv.address() as AddressInfo).port}`;
  });
  afterEach(async () => { srv.closeAllConnections(); await new Promise((r) => srv.close(r)); store.fechar(); });

  it('ignora o que não é da API nova', async () => {
    expect((await fetch(`${base}/api/state`)).status).toBe(418);
  });

  it('sem token responde 401 (T25)', async () => {
    expect((await f('/me')).status).toBe(401);
    expect((await f('/sessions')).status).toBe(401);
  });

  it('cabeçalhos cf-* e x-app-v1-gateway sem token dão 401', async () => {
    const r = await f('/sessions', { headers: { 'cf-connecting-ip': '1.1.1.1', 'cf-ray': 'x', 'x-app-v1-gateway': SEGREDO, 'x-public-bridge': '1' } });
    expect(r.status).toBe(401);
  });

  it('/me traz perfil e capacidades, sem hash', async () => {
    const t = await entrar('op');
    const me = await (await f('/me', auth(t.accessToken))).json() as Record<string, unknown>;
    expect(me).toMatchObject({ usuario: 'op', perfil: 'OPERACAO' });
    expect(JSON.stringify(me)).not.toMatch(/senhaHash/);
    expect(me.capacidades).toEqual(expect.arrayContaining(['sessoes.ver']));
  });

  it('Recepção em /users recebe 403 (T22); Gerência lista e cria', async () => {
    const rec = await entrar('rec');
    expect((await f('/users', auth(rec.accessToken))).status).toBe(403);
    expect((await f('/users', json({ usuario: 'x', nome: 'X', perfil: 'OPERACAO', senha: SENHA }, rec.accessToken))).status).toBe(403);
    const ger = await entrar('ger');
    expect((await f('/users', json({ usuario: 'novo', nome: 'Novo', perfil: 'OPERACAO', senha: SENHA }, ger.accessToken))).status).toBe(201);
    const lista = await (await f('/users', auth(ger.accessToken))).text();
    expect(lista).toContain('novo');
    expect(lista).not.toMatch(/senhaHash|scrypt/);
  });

  it('usuário bloqueado perde o acesso no pedido seguinte (T24)', async () => {
    const op = await entrar('op'); const ger = await entrar('ger');
    expect((await f('/me', auth(op.accessToken))).status).toBe(200);
    expect((await f('/users/op/block', json({ bloqueado: true }, ger.accessToken))).status).toBe(200);
    expect((await f('/me', auth(op.accessToken))).status).toBe(401);
  });

  it('/sessions/{id} traz revisão e não expõe dados pessoais', async () => {
    const t = await entrar('rec');
    const r = await (await f('/sessions/b1', auth(t.accessToken))).json() as { sessionRevision: number };
    expect(r.sessionRevision).toBe(0);
    mod.aoSalvarSessao('b1');
    const r2 = await f('/sessions/b1', auth(t.accessToken));
    const texto = await r2.text();
    expect(JSON.parse(texto).sessionRevision).toBe(1);
    expect(texto).not.toMatch(/a@b\.c|customerId|peso/);
    expect((await f('/sessions/nada', auth(t.accessToken))).status).toBe(404);
  });

  it('revisão sobrevive à reinicialização', () => {
    mod.aoSalvarSessao('b1'); mod.aoSalvarSessao('b1');
    expect(store.revisao('b1')).toBe(2);
  });

  it('falha ao gravar revisão não derruba a cronometragem e deixa o módulo indisponível', async () => {
    const t = await entrar('op');
    const original = store.subirRevisao;
    store.subirRevisao = () => { throw new Error('disco'); };
    expect(() => mod.aoSalvarSessao('b1')).not.toThrow();
    store.subirRevisao = original;
    expect((await f('/me', auth(t.accessToken))).status).toBe(503);
  });

  it('passagem de kart não sobe a revisão; mudança de composição sobe', () => {
    mod.aoSalvarSessao('b1', 'a'); mod.aoSalvarSessao('b1', 'a'); mod.aoSalvarSessao('b1', 'a');
    expect(store.revisao('b1')).toBe(1);
    mod.aoSalvarSessao('b1', 'b');
    expect(store.revisao('b1')).toBe(2);
  });

  it('falha de revisão se recupera sozinha e não perde a mudança', async () => {
    const t = await entrar('op');
    const original = store.registrarAssinatura;
    store.registrarAssinatura = () => { throw new Error('busy'); };
    mod.aoSalvarSessao('b1', 'x');
    expect((await f('/me', auth(t.accessToken))).status).toBe(503);
    store.registrarAssinatura = original;
    mod.aoSalvarSessao('b2', 'y');
    expect((await f('/me', auth(t.accessToken))).status).toBe(200);
    expect(store.revisao('b1')).toBe(1);
  });

  it('erro de banco durante /events não sobe para a cronometragem', async () => {
    const t = await entrar('rec');
    await f('/events', auth(t.accessToken));
    const original = store.revisao;
    store.revisao = () => { throw new Error('io'); };
    expect(() => { for (const a of assinantes) a(); }).not.toThrow();
    store.revisao = original;
    expect((await f('/me', auth(t.accessToken))).status).toBe(503);
  });

  it('cf-connecting-ip não escapa do limite; IP do gateway só vale com o segredo', async () => {
    const m = criarModuloApp({ store, segredo: SEGREDO, gatewaySegredo: 'gw', limiteLoginPorMinuto: 1, limitePor10s: 2000, listarSessoes: () => [], verSessao: () => undefined, assinarMudancas: () => () => undefined });
    const s = http.createServer((req, res) => void m.tratar(req, res, new URL(req.url!, 'http://x')));
    await new Promise<void>((r) => s.listen(0, '127.0.0.1', r));
    const u = `http://127.0.0.1:${(s.address() as AddressInfo).port}/api/app/v1/auth/login`;
    const ten = (h: Record<string, string>) => fetch(u, json({ usuario: 'z', senha: 'errada-errada' }, undefined, h)).then((r) => r.status);
    expect(await ten({ 'cf-connecting-ip': '1.1.1.1' })).toBe(401);
    expect(await ten({ 'cf-connecting-ip': '2.2.2.2', 'x-app-v1-cliente-ip': '3.3.3.3', 'x-app-v1-gateway': 'falso' })).toBe(429);
    expect(await ten({ 'x-app-v1-cliente-ip': '4.4.4.4', 'x-app-v1-gateway': 'gw' })).toBe(401);
    s.closeAllConnections(); await new Promise((r) => s.close(r));
  });

  it('nenhum comando de prova existe na F1, em nenhum perfil', async () => {
    const caminhos = ['/sessions/b1/draw', '/sessions/b1/prepare', '/sessions/b1/late-assignments', '/sessions/b1/weight-checks', '/sessions/b1/kart-swaps', '/sessions/b1/swap-kart',
      '/sessions/b1/penalties', '/sessions/b1/flags', '/sessions/b1/commands', '/sessions/b1/start', '/sessions/b1/restart', '/sessions/b1/cancel', '/sessions/b1/close', '/sessions/b1/passage-corrections',
      '/fleet/4/maintenance', '/equalization/commands', '/sessions/b1'];
    const antes = JSON.stringify(bateria);
    for (const u of ['rec', 'op', 'ger']) {
      const t = await entrar(u);
      for (const c of caminhos) {
        for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
          const r = await f(c, { method, headers: { authorization: `Bearer ${t.accessToken}`, 'content-type': 'application/json' }, body: '{}' });
          expect([404, 405], `${u} ${method} ${c}`).toContain(r.status);
        }
      }
    }
    expect(JSON.stringify(bateria)).toBe(antes);
    expect(mutacao).not.toHaveBeenCalled();
  });

  it('limite na origem responde 429', async () => {
    const m = criarModuloApp({ store, segredo: SEGREDO, limiteLoginPorMinuto: 2, limitePor10s: 2000, listarSessoes: () => [], verSessao: () => undefined, assinarMudancas: () => () => undefined });
    const s = http.createServer((req, res) => void m.tratar(req, res, new URL(req.url!, 'http://x')));
    await new Promise<void>((r) => s.listen(0, '127.0.0.1', r));
    const u = `http://127.0.0.1:${(s.address() as AddressInfo).port}/api/app/v1/auth/login`;
    const st: number[] = [];
    for (let i = 0; i < 3; i++) st.push((await fetch(u, json({ usuario: 'z', senha: 'errada-errada', deviceId: 'd' }))).status);
    s.closeAllConnections(); await new Promise((r) => s.close(r));
    expect(st).toEqual([401, 401, 429]);
  });

  it('segredo curto deixa o módulo indisponível', async () => {
    const m = criarModuloApp({ store, segredo: '', listarSessoes: () => [], verSessao: () => undefined, assinarMudancas: () => () => undefined });
    const res = { statusCode: 0, setHeader: vi.fn(), end: vi.fn(), writeHead: vi.fn() } as unknown as http.ServerResponse;
    await m.tratar({ method: 'GET', headers: {}, socket: {} } as unknown as http.IncomingMessage, res, new URL('http://x/api/app/v1/me'));
    expect(res.writeHead).toHaveBeenCalledWith(503, expect.anything());
  });

  const lerEventos = async (r: Response, ate: (t: string) => boolean) => {
    const leitor = r.body!.getReader(); const dec = new TextDecoder(); let t = '';
    while (!ate(t)) { const { value, done } = await leitor.read(); if (done) break; t += dec.decode(value); }
    await leitor.cancel().catch(() => null);
    return t;
  };

  it('/events manda estado completo com revisão ao conectar e a cada mudança', async () => {
    const t = await entrar('rec');
    mod.aoSalvarSessao('b1');
    const r = await f('/events', auth(t.accessToken));
    expect(r.headers.get('content-type')).toContain('text/event-stream');
    setTimeout(() => { mod.aoSalvarSessao('b1'); for (const a of assinantes) a(); }, 30);
    const txt = await lerEventos(r, (x) => (x.match(/event: state/g) ?? []).length >= 2);
    expect(txt).toContain('"sessionRevision":1');
    expect(txt).toContain('"sessionRevision":2');
    expect(txt).toContain('"seq":1');
    expect(txt).toContain('"seq":2');
    expect(txt).not.toMatch(/a@b\.c/);
  });

  it('/events fecha com auth-expired ao bloquear o usuário', async () => {
    const op = await entrar('op');
    const r = await f('/events', auth(op.accessToken));
    bloquearUsuario({ store, segredo: SEGREDO }, 'op', true);
    expect(await lerEventos(r, (x) => x.includes('auth-expired'))).toContain('event: auth-expired');
  });

  it('o servidor só desvia /api/app/v1/ do bloqueio de internet e salva a revisão', () => {
    const fonte = readFileSync('services/timing-server.ts', 'utf8');
    const iBloqueio = fonte.indexOf('Acesso só pela rede do kartódromo.');
    const iApp = fonte.indexOf("url.pathname.startsWith('/api/app/v1/')");
    expect(iApp).toBeGreaterThan(0);
    expect(iApp).toBeLessThan(iBloqueio);
    const salvar = fonte.slice(fonte.indexOf('function saveSession'), fonte.indexOf('function archiveOldSessions'));
    expect(salvar).toContain('moduloApp?.aoSalvarSessao(s.id, assinaturaDeComando(s))');
    expect(fonte).toContain("try { avisar(); } catch");
  });
});
