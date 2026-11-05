import { describe, expect, it } from 'vitest';
import type { Identidade } from './auth';
import { criarOperacao } from './operacao';
import { abrirStore } from './store';

const q: Identidade = { usuarioId: 'u1', usuario: 'op', nome: 'Op', perfil: 'OPERACAO', sessaoId: 's', deviceId: 'd', expiraEm: Date.now() + 1e6 };
const pedido = (op: string, rev: number, payload: object) => ({ operationId: op, expectedSessionRevision: rev, payload, reason: 'teste' });

function montar(state: string) {
  const store = abrirStore(':memory:');
  const chamadas: { m: string; c: string; corpo?: unknown }[] = [];
  const sessao = { id: 'b1', name: 'B', state, competitors: [
    { kart: '10', name: 'Ana', customerId: 'a', detalhes: {} }, { kart: '12', name: 'Beto', customerId: 'b', detalhes: {} },
  ] };
  const op = criarOperacao({
    store, verSessao: () => sessao, inscricoes: async () => [], listarSessoes: () => [],
    legado: async (m, c, corpo) => { chamadas.push({ m, c, corpo }); return {}; },
  } as never);
  return { op, chamadas, store };
}

describe('pesagem', () => {
  it('pós-corrida: aceita bateria encerrada, só registra observação e não altera peso', async () => {
    const { op, chamadas } = montar('encerrada');
    const r = await op.peso(q, 'b1', pedido('p1', 0, { customerId: 'a', nome: 'Ana', pesoKg: 95, postRace: true }));
    expect(r.status).toBe('APPLIED');
    expect(chamadas).toHaveLength(1);
    expect(chamadas[0].c).toContain('/observations');
    expect(JSON.stringify(chamadas[0].corpo)).toContain('Pesagem pós-corrida');
  });

  it('lastro antes da largada continua recusado em bateria encerrada', async () => {
    const { op } = montar('encerrada');
    const r = await op.peso(q, 'b1', pedido('p2', 0, { customerId: 'a', nome: 'Ana', pesoKg: 70, lastroConferido: true }));
    expect(r.status).toBe('REJECTED');
    expect(r.erro).toContain('estado atual');
  });

  it('lote: confere todos de uma vez, grava a conferência e recusa peso inválido', async () => {
    const { op, chamadas, store } = montar('preparando');
    expect(() => op.pesoLote(q, 'b1', pedido('l0', 0, { pilotos: [{ customerId: 'a', nome: 'Ana', pesoKg: 5 }] }))).toThrow('peso válido');
    const r = await op.pesoLote(q, 'b1', pedido('l1', 0, { pilotos: [{ customerId: 'a', nome: 'Ana', pesoKg: 70 }, { customerId: 'b', nome: 'Beto', pesoKg: 88 }] }));
    expect(r.status).toBe('APPLIED');
    expect(chamadas.filter((c) => c.m === 'PUT')).toHaveLength(2);
    expect(store.db.prepare('SELECT COUNT(*) n FROM lastros_conferidos').get()).toEqual({ n: 2 });
  });
});

describe('desclassificação por subpeso', () => {
  it('app antigo manda penalidade "desclassificacao": vira bandeira preta no kart', async () => {
    const { op, chamadas } = montar('encerrada');
    const r = await op.penalidade(q, 'b1', pedido('d1', 0, { kart: '10', tipo: 'desclassificacao', motivo: 'Subpeso pós-corrida' }));
    expect(r.status).toBe('APPLIED');
    expect(chamadas[0].c).toContain('/flag/10');
    expect(JSON.stringify(chamadas[0].corpo)).toContain('black');
  });
});
