import { describe, expect, it } from 'vitest';
import type { Identidade, Perfil } from './auth';
import { criarAulasManutencao } from './aulas-manutencao';
import { abrirStore } from './store';

const quem = (perfil: Perfil, usuario = perfil.toLowerCase()): Identidade => ({ usuarioId: `id-${usuario}`, usuario, nome: usuario, perfil, sessaoId: 's', deviceId: 'd', expiraEm: Date.now() + 1e6 });
const pedido = (op: string, revisao: number, payload: object) => ({ operationId: op, expectedSessionRevision: revisao, payload, reason: 'teste' });

function montar() {
  const store = abrirStore(':memory:');
  let hora = new Date('2026-11-04T15:00:00Z');
  const m = criarAulasManutencao({ store, agora: () => hora });
  return { store, m, avancar: (dias: number) => { hora = new Date(hora.getTime() + dias * 86_400_000); } };
}

describe('aulas e recibos', () => {
  it('operação registra, recepção aceita e o resumo do dia soma só o dia atual', async () => {
    const { m } = montar();
    const op = quem('OPERACAO'), rec = quem('RECEPCAO');
    const r = await m.criarRecibo(op, pedido('a1', 0, { instrutor: 'Anderson', pilotos: 3, aulas: 2, valorCentavos: 15025 }));
    expect(r.status).toBe('APPLIED');
    const lista = m.aulas(rec);
    expect(lista.sessionRevision).toBe(1);
    expect(lista.resumoHoje.find((x) => x.instrutor === 'Anderson')).toEqual({ instrutor: 'Anderson', pilotos: 3, aulas: 2 });
    expect(lista.resumoHoje.find((x) => x.instrutor === 'Felisberto')).toEqual({ instrutor: 'Felisberto', pilotos: 0, aulas: 0 });
    const id = lista.recibos[0].id;
    expect((await m.aceitarRecibo(rec, id, pedido('a2', 1, {}))).status).toBe('APPLIED');
    expect(m.aulas(rec).recibos[0]).toMatchObject({ aceitoPor: 'recepcao', valorCentavos: 15025 });
  });

  it('recibo de ontem não entra no resumo de hoje', async () => {
    const { m, avancar } = montar();
    await m.criarRecibo(quem('OPERACAO'), pedido('a1', 0, { instrutor: 'Felisberto', pilotos: 1, aulas: 1, valorCentavos: 100 }));
    avancar(1);
    expect(m.aulas(quem('GERENCIA')).resumoHoje.every((x) => x.pilotos === 0)).toBe(true);
  });

  it('rejeita dados inválidos, aceite duplicado, revisão velha e perfil sem permissão', async () => {
    const { m } = montar();
    const op = quem('OPERACAO'), rec = quem('RECEPCAO');
    expect(() => m.criarRecibo(op, pedido('x', 0, { instrutor: 'Outro', pilotos: 1, aulas: 1, valorCentavos: 100 }))).toThrow('instrutor');
    expect(() => m.criarRecibo(op, pedido('x', 0, { instrutor: 'Anderson', pilotos: 0, aulas: 1, valorCentavos: 100 }))).toThrow('quantidade');
    expect(() => m.criarRecibo(op, pedido('x', 0, { instrutor: 'Anderson', pilotos: 1, aulas: 1, valorCentavos: 0 }))).toThrow('valor');
    await expect(m.criarRecibo(rec, pedido('y', 0, { instrutor: 'Anderson', pilotos: 1, aulas: 1, valorCentavos: 100 }))).rejects.toMatchObject({ http: 403 });
    await m.criarRecibo(op, pedido('a1', 0, { instrutor: 'Anderson', pilotos: 1, aulas: 1, valorCentavos: 100 }));
    await expect(m.criarRecibo(op, pedido('a3', 0, { instrutor: 'Anderson', pilotos: 1, aulas: 1, valorCentavos: 100 }))).rejects.toMatchObject({ codigo: 'REVISION_CONFLICT' });
    const id = m.aulas(rec).recibos[0].id;
    await m.aceitarRecibo(rec, id, pedido('a2', 1, {}));
    const segunda = await m.aceitarRecibo(rec, id, pedido('a4', 2, {}));
    expect(segunda.status).toBe('REJECTED');
    expect(segunda.erro).toContain('já foi aceito');
    await expect(m.aceitarRecibo(op, id, pedido('a5', 2, {}))).rejects.toMatchObject({ http: 403 });
  });

  it('reenvio com o mesmo operationId não duplica o recibo', async () => {
    const { m } = montar();
    const p = pedido('mesmo', 0, { instrutor: 'Anderson', pilotos: 1, aulas: 1, valorCentavos: 100 });
    await m.criarRecibo(quem('OPERACAO'), p);
    await m.criarRecibo(quem('OPERACAO'), p);
    expect(m.aulas(quem('GERENCIA')).recibos).toHaveLength(1);
  });
});

describe('ordens de serviço', () => {
  const kartNaOficina = (store: ReturnType<typeof montar>['store'], kart: string) =>
    store.db.prepare('INSERT INTO karts_fora (kart, motivo, usuario, em) VALUES (?, ?, ?, ?)').run(kart, 'sem freio', 'op', new Date().toISOString());

  it('só a gerência vê e cria; kart precisa estar na oficina e não duplica ordem aberta', async () => {
    const { m, store } = montar();
    const g = quem('GERENCIA');
    expect(() => m.ordens(quem('OPERACAO'))).toThrow('permissão');
    const semOficina = await m.criarOrdem(g, pedido('o1', 0, { kart: '12', motivo: 'freio', mecanico: 'Doidinho' }));
    expect(semOficina.status).toBe('REJECTED');
    kartNaOficina(store, '12');
    expect((await m.criarOrdem(g, pedido('o2', 0, { kart: '12', motivo: 'freio', mecanico: 'Doidinho' }))).status).toBe('APPLIED');
    const dup = await m.criarOrdem(g, pedido('o3', 1, { kart: '12', motivo: 'outro', mecanico: 'X' }));
    expect(dup.status).toBe('REJECTED');
    expect(dup.erro).toContain('já tem uma ordem');
    expect(m.ordens(g).ordens).toHaveLength(1);
  });

  it('segue aberta → em execução → concluída e bloqueia saltos e estados finais', async () => {
    const { m, store } = montar();
    const g = quem('GERENCIA');
    kartNaOficina(store, '7');
    await m.criarOrdem(g, pedido('o1', 0, { kart: '7', motivo: 'motor', mecanico: 'Zé' }));
    const id = m.ordens(g).ordens[0].id;
    expect((await m.mudarStatusOrdem(g, id, pedido('o2', 1, { status: 'concluida' }))).status).toBe('REJECTED');
    expect((await m.mudarStatusOrdem(g, id, pedido('o3', 1, { status: 'em_execucao' }))).status).toBe('APPLIED');
    expect((await m.mudarStatusOrdem(g, id, pedido('o4', 2, { status: 'concluida' }))).status).toBe('APPLIED');
    expect((await m.mudarStatusOrdem(g, id, pedido('o5', 3, { status: 'cancelada' }))).status).toBe('REJECTED');
    expect(m.ordens(g).ordens[0]).toMatchObject({ status: 'concluida', atualizadaPor: 'gerencia' });
    expect(() => m.mudarStatusOrdem(g, id, pedido('o6', 3, { status: 'xyz' }))).toThrow('inválida');
  });
});
