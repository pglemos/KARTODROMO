import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('../../workers/admin/public/agenda-acoes.js', import.meta.url), 'utf8');

function tela(reservas: Record<string, unknown>[], falhaIds: number[] = []) {
  const els = new Map<string, { disabled: boolean; value: string; textContent: string; innerHTML: string; onchange?: (event: { target: { name: string; value: string } }) => void; onclick?: () => Promise<void> }>();
  const el = (id: string) => { if (!els.has(id)) els.set(id, { disabled: false, value: '', textContent: '', innerHTML: '' }); return els.get(id)!; };
  const modal = { style: {}, innerHTML: '', querySelector: el, addEventListener() {} };
  const chamadas: number[] = [];
  const destino = { id: 8, dataHora: '2099-11-03T19:55', status: 'aberta', disponiveis: 2, produtoId: 11, preco: 17500, tipoKart: 'light' };
  const context = {
    modal: () => modal, esc: String, hojeIso: () => '2099-11-03', horaDe: (s: string) => s.slice(11, 16),
    deIso: (s: string) => new Date(s), DIAS: [], MESES: [], svg: () => '', IC: {}, brl: String,
    toast() {}, fecharCamada() {}, testContext: { A: {}, recarregar: async () => {} },
    office: async (path: string) => {
      if (path.startsWith('/baterias?')) return [{ ...destino }];
      const id = Number(path.split('/')[2]); chamadas.push(id);
      if (falhaIds.includes(id)) throw new Error('Sem vagas');
      return {};
    },
  };
  const api = vm.runInNewContext(source.replace('return { montar, gaveta };', 'C = testContext; return { montar, gaveta, mover };') + '\nAgendaAcoes', context);
  const origem = { id: 7, dataHora: '2099-11-03T19:20', tipoKart: 'light' };
  return { el, chamadas, destino, abrir: async () => { await api.mover(origem, reservas); await Promise.resolve(); await Promise.resolve(); }, escolher: () => el('#mvLista').onchange!({ target: { name: 'dest', value: '8' } }), mover: () => el('#mvOk').onclick!() };
}

describe('Agenda: mover participantes', () => {
  it('oferece outro horário de Light para antecipado pago sem exigir a tarifa atual', async () => {
    const t = tela([{ id: 1, cliente: 'TESTE CODEX', pago: true, produtoId: 4, preco: 14500 }]);
    await t.abrir();
    expect(t.el('#mvLista').innerHTML).not.toContain('value="8" disabled');
    t.escolher();
    expect(t.el('#mvOk').disabled).toBe(false);
    expect(t.el('#mvAviso').textContent).toContain('já pago');
  });

  it('repete somente as pessoas que falharam, mesmo quando não são as últimas da lista', async () => {
    const t = tela([1, 2, 3].map((id) => ({ id, cliente: 'TESTE CODEX ' + id, pago: false, produtoId: 11, preco: 17500 })), [1]);
    t.destino.disponiveis = 5;
    await t.abrir(); t.escolher(); await t.mover();
    expect(t.chamadas).toEqual([1, 2, 3]);
    await t.mover();
    expect(t.chamadas).toEqual([1, 2, 3, 1]);
  });
});
