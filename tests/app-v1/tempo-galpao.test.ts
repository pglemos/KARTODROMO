import { criarOperacao } from '../../lib/app-v1/operacao';
import type { Identidade } from '../../lib/app-v1/auth';
import { afterEach, describe, expect, it } from 'vitest';
import { abrirStore, type AppStore } from '../../lib/app-v1/store';
import { tempoGalpao } from '../../lib/app-v1/tempo-galpao';
const stores: AppStore[] = [];
afterEach(() => stores.splice(0).forEach(s => s.fechar()));
function montar() {
  const store = abrirStore(':memory:'); stores.push(store);
  const etapa = { atualizar: true, todosAptos: true, concluido: false, quantidade: 12 };
  const em = (segundos: number) => new Date(Date.UTC(2026, 10, 5, 12, 0, segundos));
  const atualizar = (segundos: number, patch: Partial<typeof etapa> = {}) => tempoGalpao(store, 'agenda-1', { ...etapa, ...patch }, em(segundos));
  return { store, atualizar };
}
describe('tempo de sorteio e lastro', () => {
  it('só começa após todos aptos, não reinicia com consultas ou reconexão e congela ao concluir', () => {
    const { store, atualizar } = montar();
    expect(atualizar(0, { todosAptos: false })).toBeNull();
    expect(atualizar(10)?.decorridoMs).toBe(0);
    expect(atualizar(40)?.decorridoMs).toBe(30000);
    const final = atualizar(100, { concluido: true });
    expect(final).toMatchObject({ iniciadoEm: '2026-11-05T12:00:10.000Z', concluidoEm: '2026-11-05T12:01:40.000Z', decorridoMs: 90000, quantidadeKarts: 12 });
    expect(atualizar(200, { concluido: true })).toEqual(final);
    expect(tempoGalpao(store, 'agenda-1', { atualizar: false, todosAptos: false, concluido: false, quantidade: 0 }, new Date('2026-11-06'))).toEqual(final);
    expect(store.db.prepare('SELECT action FROM auditoria ORDER BY timestampServerUTC').all()).toEqual([{ action: 'galpao-start' }, { action: 'galpao-complete' }]);
  });
  it('falha na consulta não apaga conclusão e novo piloto reabre sem zerar início', () => {
    const { atualizar } = montar();
    atualizar(0); atualizar(60, { concluido: true });
    expect(atualizar(90, { atualizar: false, todosAptos: false })?.concluidoEm).toBeTruthy();
    expect(atualizar(120, { todosAptos: false, quantidade: 13 })).toMatchObject({ concluidoEm: null, decorridoMs: 120000 });
    expect(atualizar(180, { concluido: true, quantidade: 13 })?.decorridoMs).toBe(180000);
  });
  it('não inventa tempo anterior à instalação em bateria já concluída nem começa com lista vazia', () => {
    const { atualizar } = montar();
    expect(atualizar(0, { concluido: true })).toBeNull();
    expect(atualizar(0, { todosAptos: false, quantidade: 0 })).toBeNull();
  });
});

it('fluxo real inicia automaticamente com recepção apta, compartilha tomada/corrida e termina na última conferência', async () => {
  const store = abrirStore(':memory:'); stores.push(store);
  const q: Identidade = { usuarioId: 'u', usuario: 'TESTE CODEX', nome: 'Teste', perfil: 'OPERACAO', sessaoId: 's', deviceId: 'd', expiraEm: 0 };
  const pilotos = [{ kart: '1', name: 'TESTE CODEX Ana', customerId: 'a', detalhes: { peso: 80 } }, { kart: '2', name: 'TESTE CODEX Bia', customerId: 'b', detalhes: { peso: 80 } }];
  const tomada = { id: 'tomada', name: 'TESTE CODEX', agendaId: 1, state: 'preparando', competitors: pilotos };
  const corrida = { ...tomada, id: 'corrida' };
  let pago = false;
  const op = criarOperacao({ store, verSessao: id => id === 'tomada' ? tomada : corrida, listarSessoes: () => [tomada, corrida],
    inscricoes: async () => pilotos.map(c => ({ clienteId: c.customerId, nome: c.name, aprovada: true, pago, termo: true, totalCentavos: 100, endurance: false })),
    legado: async (metodo, rota) => metodo === 'GET' && rota.endsWith('/sorteio') ? { programa: [{ id: 'tomada' }, { id: 'corrida' }], karts: ['1','2'], tipoKart: 'LIGHT', pilotos: pilotos.map((c, indice) => ({ indice, nome: c.name, customerId: c.customerId, kartAtual: c.kart, excecoes: [], pesoKg: 80 })) } : {},
  });
  await op.atualizarTemposGalpao();
  expect(store.db.prepare('SELECT * FROM tempos_galpao').all()).toHaveLength(0);
  pago = true;
  await op.atualizarTemposGalpao();
  expect(store.db.prepare('SELECT * FROM tempos_galpao').all()).toHaveLength(1);
  const inicio = (await op.painelSorteio(q, 'corrida')).processoGalpao?.iniciadoEm;
  for (const [i, c] of pilotos.entries()) {
    const r = await op.peso(q, 'tomada', { operationId: `peso-${i}`, expectedSessionRevision: store.revisao('tomada'), payload: { customerId: c.customerId, nome: c.name, pesoKg: 80, lastroConferido: true } });
    expect(r.status).toBe('APPLIED');
    if (i === 0) expect((store.db.prepare('SELECT concluidoEm FROM tempos_galpao').get() as { concluidoEm: string | null }).concluidoEm).toBeNull();
  }
  expect((store.db.prepare('SELECT concluidoEm FROM tempos_galpao').get() as { concluidoEm: string | null }).concluidoEm).toBeTruthy();
  const final = (await op.painelSorteio(q, 'corrida')).processoGalpao;
  expect(final?.iniciadoEm).toBe(inicio);
  expect(final?.concluidoEm).toBeTruthy();
  expect(store.db.prepare('SELECT * FROM tempos_galpao').all()).toHaveLength(1);
});
