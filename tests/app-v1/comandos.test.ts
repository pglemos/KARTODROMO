import { beforeEach, describe, expect, it, vi } from 'vitest';
import { abrirStore, type AppStore } from '../../lib/app-v1/store';
import { consultarOperacao, executar, filaPorBateria, marcarPendentesComoDesconhecidas, type Pedido } from '../../lib/app-v1/comandos';
import type { Identidade } from '../../lib/app-v1/auth';

const ID: Identidade = { usuarioId: 'u1', usuario: 'ana', nome: 'Ana', perfil: 'OPERACAO', sessaoId: 's', deviceId: 'tablet', expiraEm: 0 };
const pedido = (extra: Partial<Pedido> = {}): Pedido => ({
  operationId: 'op-1', sessionId: 'b1', expectedSessionRevision: 0, command: 'teste', payload: { a: 1 }, reason: 'motivo', ...extra,
});

describe('motor de comandos', () => {
  let store: AppStore;
  const ctx = () => ({ store, identidade: ID, routeMode: 'internet', capacidade: 'sessoes.ver' });
  beforeEach(() => { store = abrirStore(':memory:'); });

  it('três envios iguais aplicam uma vez (T19)', async () => {
    const h = vi.fn(async () => ({ ok: true }));
    const rs = [await executar(ctx(), pedido(), h), await executar(ctx(), pedido(), h), await executar(ctx(), pedido(), h)];
    expect(h).toHaveBeenCalledOnce();
    expect(rs.map((r) => r.status)).toEqual(['APPLIED', 'APPLIED', 'APPLIED']);
  });

  it('envios simultâneos aplicam uma vez', async () => {
    const h = vi.fn(async () => ({ ok: true }));
    await Promise.all([executar(ctx(), pedido(), h), executar(ctx(), pedido(), h)]);
    expect(h).toHaveBeenCalledOnce();
  });

  it('PENDING encontrado no reinício vira UNKNOWN (T20) e não reexecuta', async () => {
    store.db.prepare(`INSERT INTO operacoes (operationId, actorUserId, command, sessionId, payloadHash, status, criadoEm) VALUES ('op-1','u1','teste','b1',?, 'PENDING','t')`)
      .run('x');
    marcarPendentesComoDesconhecidas(store);
    expect(consultarOperacao(store, 'op-1', ID)?.status).toBe('UNKNOWN');
    const h = vi.fn(async () => ({}));
    const r = await executar(ctx(), pedido(), h).catch((e) => e);
    expect(h).not.toHaveBeenCalled();
    expect(r.codigo ?? r.status).toMatch(/IDEMPOTENCY_PAYLOAD_MISMATCH|UNKNOWN/);
  });

  it('UNKNOWN com o mesmo corpo não executa e devolve o estado para reconciliar', async () => {
    const h = vi.fn(async () => { throw Object.assign(new Error('caiu'), { desconhecido: true }); });
    const r1 = await executar(ctx(), pedido(), h);
    expect(r1.status).toBe('UNKNOWN');
    const h2 = vi.fn(async () => ({}));
    const r2 = await executar(ctx(), pedido(), h2);
    expect(h2).not.toHaveBeenCalled();
    expect(r2.status).toBe('UNKNOWN');
  });

  it('corpo diferente com o mesmo id é recusado sem efeito (T21)', async () => {
    const h = vi.fn(async () => ({}));
    await executar(ctx(), pedido(), h);
    await expect(executar(ctx(), pedido({ payload: { a: 2 } }), h)).rejects.toMatchObject({ codigo: 'IDEMPOTENCY_PAYLOAD_MISMATCH', http: 409 });
    expect(h).toHaveBeenCalledOnce();
  });

  it('revisão antiga é recusada (T35)', async () => {
    store.subirRevisao('b1');
    const h = vi.fn(async () => ({}));
    await expect(executar(ctx(), pedido(), h)).rejects.toMatchObject({ codigo: 'REVISION_CONFLICT', http: 409 });
    expect(h).not.toHaveBeenCalled();
  });

  it('dois comandos da mesma bateria rodam em série e o segundo recebe conflito', async () => {
    const ordem: string[] = [];
    const h = (n: string) => async () => { ordem.push(`${n}-ini`); await new Promise((r) => setTimeout(r, 5)); store.subirRevisao('b1'); ordem.push(`${n}-fim`); return {}; };
    const [a, b] = await Promise.allSettled([
      executar(ctx(), pedido({ operationId: 'a' }), h('a')),
      executar(ctx(), pedido({ operationId: 'b' }), h('b')),
    ]);
    expect(ordem).toEqual(['a-ini', 'a-fim']);
    expect(a.status).toBe('fulfilled');
    expect(b).toMatchObject({ status: 'rejected', reason: { codigo: 'REVISION_CONFLICT' } });
  });

  it('a fila segue depois de uma falha', async () => {
    await filaPorBateria('b1', async () => { throw new Error('x'); }).catch(() => null);
    await expect(filaPorBateria('b1', async () => 7)).resolves.toBe(7);
  });

  it('recusa do handler vira REJECTED e fica registrada', async () => {
    const r = await executar(ctx(), pedido(), async () => { throw new Error('Kart ocupado.'); });
    expect(r).toMatchObject({ status: 'REJECTED', erro: 'Kart ocupado.' });
  });

  it('sem capacidade é recusado antes de qualquer gravação', async () => {
    const h = vi.fn(async () => ({}));
    await expect(executar({ ...ctx(), capacidade: 'usuarios.gerir' }, pedido(), h)).rejects.toMatchObject({ http: 403 });
    expect(store.db.prepare('SELECT COUNT(*) n FROM operacoes').get()).toMatchObject({ n: 0 });
  });

  it('cada resultado gera uma linha de auditoria com os campos do PRD', async () => {
    await executar(ctx(), pedido(), async () => ({ ok: 1 }));
    const a = store.db.prepare('SELECT * FROM auditoria').all() as Record<string, unknown>[];
    expect(a).toHaveLength(1);
    expect(a[0]).toMatchObject({ operationId: 'op-1', actorUserId: 'u1', actorRole: 'OPERACAO', deviceId: 'tablet', sessionId: 'b1', routeMode: 'internet', action: 'teste', reason: 'motivo', status: 'APPLIED', sourceSystem: 'app-v1' });
    expect(a[0].requestHash).toBeTruthy();
  });

  it('outro usuário não vê a operação; gerência vê', async () => {
    await executar(ctx(), pedido(), async () => ({}));
    expect(consultarOperacao(store, 'op-1', { ...ID, usuarioId: 'u2' })).toBeNull();
    expect(consultarOperacao(store, 'op-1', { ...ID, usuarioId: 'u2', perfil: 'GERENCIA' })?.status).toBe('APPLIED');
  });
});
