import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { abrirStore, StoreIndisponivel, type AppStore } from '../../lib/app-v1/store';

describe('armazenamento do app', () => {
  let dir: string;
  let store: AppStore;
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'appv1-')); store = abrirStore(join(dir, 'app.db')); });
  afterEach(() => { store.fechar(); rmSync(dir, { recursive: true, force: true }); });

  const auditoria = (id: string) => store.db.prepare(
    `INSERT INTO auditoria (auditId, action, status, timestampServerUTC) VALUES (?, 'x', 'APPLIED', '2026-11-01T00:00:00Z')`).run(id);

  it('cria tabelas uma vez', () => {
    store.fechar();
    store = abrirStore(join(dir, 'app.db'));
    const nomes = (store.db.prepare(`SELECT name FROM sqlite_master WHERE type='table'`).all() as { name: string }[]).map((t) => t.name);
    expect(nomes).toEqual(expect.arrayContaining(['usuarios', 'sessoes', 'operacoes', 'auditoria', 'revisoes']));
  });

  it('reabre sem perder dados', () => {
    auditoria('a1');
    store.fechar();
    store = abrirStore(join(dir, 'app.db'));
    expect(store.db.prepare('SELECT COUNT(*) n FROM auditoria').get()).toMatchObject({ n: 1 });
  });

  it('auditoria só aceita inserção', () => {
    auditoria('a1');
    expect(() => store.db.exec(`UPDATE auditoria SET status='y'`)).toThrow(/somente inser/);
    expect(() => store.db.exec('DELETE FROM auditoria')).toThrow(/somente inser/);
  });

  it('falha no meio da transação não grava operação nem auditoria', () => {
    expect(() => store.transacao(() => {
      store.db.prepare(`INSERT INTO operacoes (operationId, actorUserId, command, sessionId, payloadHash, status, criadoEm) VALUES ('o','u','c','s','h','PENDING','t')`).run();
      auditoria('a1');
      throw new Error('falhou');
    })).toThrow('falhou');
    expect(store.db.prepare('SELECT COUNT(*) n FROM operacoes').get()).toMatchObject({ n: 0 });
    expect(store.db.prepare('SELECT COUNT(*) n FROM auditoria').get()).toMatchObject({ n: 0 });
  });

  it('runtime sem suporte deixa o módulo indisponível, sem alternativa em JSON', () => {
    expect(() => abrirStore(join(dir, 'b.db'), () => { throw new Error('sem sqlite'); })).toThrow(StoreIndisponivel);
  });

  it('revisão persiste após reabrir', () => {
    expect(store.subirRevisao('s1')).toBe(1);
    expect(store.subirRevisao('s1')).toBe(2);
    store.fechar();
    store = abrirStore(join(dir, 'app.db'));
    expect(store.revisao('s1')).toBe(2);
    expect(store.subirRevisao('s1')).toBe(3);
  });
});
