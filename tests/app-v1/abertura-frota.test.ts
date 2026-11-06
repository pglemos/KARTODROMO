import { afterEach, describe, expect, it } from 'vitest';
import { criarAberturaFrota, invalidarAbertura, kartLiberadoHoje } from '../../lib/app-v1/abertura-frota';
import { abrirStore, type AppStore } from '../../lib/app-v1/store';
import type { Identidade } from '../../lib/app-v1/auth';
const stores: AppStore[] = [];
afterEach(() => stores.splice(0).forEach(s => s.fechar()));
const operador: Identidade = { usuarioId: 'op', usuario: 'TESTE CODEX', nome: 'Teste', perfil: 'OPERACAO', sessaoId: 's', deviceId: 'd', expiraEm: Date.now() + 100000 };
const gerente = { ...operador, usuarioId: 'ger', perfil: 'GERENCIA' as const };
const itens = ['freioAcelerador', 'pneus', 'corrente', 'combustivel'];
function montar() {
  const store = abrirStore(':memory:'); stores.push(store);
  let agora = new Date('2026-11-05T02:59:00Z');
  const abertura = criarAberturaFrota({ store, kartsCadastrados: () => ['1', '2'], agora: () => agora });
  let id = 0;
  const enviar = (acao: string, payload: object, quem = operador, reason = 'TESTE CODEX') => abertura.comandar(quem, acao,
    { operationId: `teste-${++id}`, expectedSessionRevision: store.revisao('frota'), reason, payload: { dia: abertura.resumo().dia, ...payload } });
  return { store, abertura, enviar, agora: () => agora, avancar: () => { agora = new Date('2026-11-05T03:01:00Z'); } };
}
describe('abertura diária da frota', () => {
  it('bloqueia por padrão, exige quatro itens e aceite do gerente', async () => {
    const c = montar();
    expect(kartLiberadoHoje(c.store, '1', c.agora())).toBe(false);
    expect((await c.enviar('conferir', { karts: ['1'], itens: itens.slice(1) })).status).toBe('REJECTED');
    expect((await c.enviar('conferir', { karts: ['1'], itens })).status).toBe('APPLIED');
    expect(c.abertura.resumo().aguardando).toBe(1);
    expect(kartLiberadoHoje(c.store, '1', c.agora())).toBe(false);
    expect(() => c.enviar('aceitar', { karts: ['1'] })).toThrow('gerência');
    expect((await c.enviar('aceitar', { karts: ['1'] }, gerente)).status).toBe('APPLIED');
    expect(kartLiberadoHoje(c.store, '1', c.agora())).toBe(true);
    c.avancar();
    expect(c.abertura.resumo().pendentes).toBe(2);
    expect(kartLiberadoHoje(c.store, '1', c.agora())).toBe(false);
  });
  it('oficina invalida o ciclo e a devolução não reativa o aceite antigo', async () => {
    const c = montar();
    await c.enviar('excecao', { karts: ['1'] }, gerente);
    c.store.db.prepare('INSERT INTO karts_fora (kart, motivo, usuario, em) VALUES (?, ?, ?, ?)').run('1', 'freio', 'TESTE CODEX', c.agora().toISOString());
    expect((await c.enviar('excecao', { karts: ['1'] }, gerente)).status).toBe('REJECTED');
    c.store.db.prepare('DELETE FROM karts_fora').run();
    expect(kartLiberadoHoje(c.store, '1', c.agora())).toBe(false);
  });
  it('aceite em lote é atômico e exceção exige motivo auditado', async () => {
    const c = montar();
    await c.enviar('conferir', { karts: ['1'], itens });
    expect((await c.enviar('aceitar', { karts: ['1', '2'] }, gerente)).status).toBe('REJECTED');
    expect(c.abertura.resumo().liberados).toBe(0);
    expect((await c.enviar('excecao', { karts: ['2'] }, gerente, '')).status).toBe('REJECTED');
    await c.enviar('excecao', { karts: ['2'] }, gerente, 'Inspeção extraordinária TESTE CODEX');
    const audit = c.store.db.prepare("SELECT reason FROM auditoria WHERE action = 'fleet-opening-excecao' AND status = 'APPLIED'").get();
    expect(audit).toEqual({ reason: 'Inspeção extraordinária TESTE CODEX' });
  });
  it('ordem de serviço ativa impede exceção mesmo após remoção do bloqueio de frota', async () => {
    const c = montar();
    c.store.db.prepare('INSERT INTO ordens_servico (id, kart, motivo, mecanico, status, criadaEm, criadaPor, atualizadaEm, atualizadaPor, observacao) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run('os', '1', 'Freio', 'TESTE CODEX', 'aberta', c.agora().toISOString(), 'TESTE CODEX', c.agora().toISOString(), 'TESTE CODEX', null);
    expect((await c.enviar('excecao', { karts: ['1'] }, gerente)).status).toBe('REJECTED');
    expect(c.abertura.resumo().karts[0].estado).toBe('bloqueado');
  });
  it('equalização invalida o aceite e a conferência anterior', async () => {
    const c = montar();
    await c.enviar('excecao', { karts: ['1'] }, gerente);
    invalidarAbertura(c.store, ['1']);
    expect(c.abertura.resumo().pendentes).toBe(2);
    expect(kartLiberadoHoje(c.store, '1', c.agora())).toBe(false);
  });
  it('recusa dia antigo, kart desconhecido e permite escala de fim de semana', async () => {
    const c = montar();
    expect((await c.enviar('conferir', { dia: '2026-11-03', karts: ['1'], itens })).status).toBe('REJECTED');
    expect((await c.enviar('excecao', { karts: ['99'] }, gerente)).status).toBe('REJECTED');
    expect((await c.enviar('escala', { data: '2026-11-07', operador: 'TESTE CODEX' }, gerente)).status).toBe('APPLIED');
    expect(c.abertura.resumo().escala).toEqual([{ dia: '2026-11-07', operador: 'TESTE CODEX' }]);
  });

  it('permite conferência em lote (Check list finalizado) e ciclo a cada 2 e 4 baterias', async () => {
    const c = montar();
    // 1 etapa e 4 etapa: conferir karts 1 e 2 em lote na abertura
    const resAbertura = await c.enviar('conferir', {
      karts: ['1', '2'],
      itens: ['freioAcelerador', 'calibragemPneus', 'pneusLonados', 'correnteEngraxada'],
      ciclo: 'abertura',
    });
    expect(resAbertura.status).toBe('APPLIED');
    expect(c.abertura.resumo().aguardando).toBe(2);

    // Ciclo a cada 2 baterias: exige pneus lonados
    const res2Bat = await c.enviar('conferir', {
      karts: ['1'],
      itens: ['pneusLonados'],
      ciclo: 'cada_2_baterias',
    });
    expect(res2Bat.status).toBe('APPLIED');

    // Ciclo a cada 4 baterias: exige pneus lonados + corrente engraxada
    const res4BatIncompleto = await c.enviar('conferir', {
      karts: ['1'],
      itens: ['pneusLonados'],
      ciclo: 'cada_4_baterias',
    });
    expect(res4BatIncompleto.status).toBe('REJECTED');

    const res4BatCompleto = await c.enviar('conferir', {
      karts: ['1'],
      itens: ['pneusLonados', 'correnteEngraxada'],
      ciclo: 'cada_4_baterias',
    });
    expect(res4BatCompleto.status).toBe('APPLIED');
  });

  it('aponta defeito por exceção (Etapa 3) encaminhando kart para oficina e retirando do galpão', async () => {
    const c = montar();
    const resDefeito = await c.enviar('defeito', {
      kart: '1',
      motivo: 'Pneu lonado',
    });
    expect(resDefeito.status).toBe('APPLIED');

    // Kart 1 está na oficina por defeito
    const fora = c.store.db.prepare('SELECT kart, motivo, estado FROM karts_fora WHERE kart = ?').get('1') as { kart: string; motivo: string; estado: string };
    expect(fora).toBeDefined();
    expect(fora.motivo).toBe('Pneu lonado');
    expect(fora.estado).toBe('oficina');
    expect(c.abertura.resumo().karts[0].estado).toBe('bloqueado');
  });
});
