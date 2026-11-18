import { afterEach, describe, expect, it } from 'vitest';
import { abrirStore, type AppStore } from '../../lib/app-v1/store';
import { criarOperacao } from '../../lib/app-v1/operacao';
import type { Identidade } from '../../lib/app-v1/auth';

const stores: AppStore[] = [];
afterEach(() => stores.splice(0).forEach(s => s.fechar()));
const ger: Identidade = { usuarioId: 'g', usuario: 'teste', nome: 'Teste', perfil: 'GERENCIA', sessaoId: 's', deviceId: 'd', expiraEm: 0 };

/** Cronometragem de mentira: o mapa de sensores muda quando o app chama PUT /api/transponders. */
function montar() {
  const store = abrirStore(':memory:'); stores.push(store);
  const mapa: Record<string, string> = { '2908214': '133', '1111111': '7' };
  const chamadas: unknown[] = [];
  const op = criarOperacao({
    store, verSessao: () => undefined, inscricoes: async () => [],
    legado: async (metodo, caminho, corpo) => {
      chamadas.push([metodo, caminho, corpo]);
      if (metodo === 'PUT' && caminho === '/api/transponders') { const c = corpo as { raw: string; kart: string }; mapa[c.raw] = c.kart; }
      return { ok: true };
    },
    kartsCadastrados: () => [...new Set(Object.values(mapa))],
    sensorDoKart: (k) => Object.entries(mapa).find(([, v]) => v === k)?.[0] ?? null,
    kartDoSensor: (raw) => mapa[raw] ?? null,
    sensoresSemKart: () => [{ transponder: '5550001', em: new Date().toISOString(), leituras: 2 }],
  });
  return { op, mapa, chamadas, store };
}
const pedido = (id: string, payload: Record<string, unknown>) => ({ operationId: id, expectedSessionRevision: 0, payload, reason: 'Cadastro de kart novo' });

describe('cadastro de kart novo pelo app', () => {
  it('kart 112 com sensor e chassi 133: entra na cronometragem e o chassi fica ligado', async () => {
    const { op, mapa, chamadas } = montar();
    const r = await op.cadastrarKart(ger, pedido('k1', { kart: '112', transponder: '5550001', chassi: '133' }));
    expect(r).toMatchObject({ status: 'APPLIED', resultado: { kart: '112', chassi: '133', transponder: '5550001' } });
    expect(mapa['5550001']).toBe('112');
    expect(chamadas).toEqual([['PUT', '/api/transponders', { raw: '5550001', kart: '112' }]]);
    expect(op.frota()).toMatchObject({ chassis: { '112': '133' }, sensoresSemKart: [{ transponder: '5550001' }] });
  });
  it('zero à esquerda vira o número da placa ("012" → 12)', async () => {
    const { op, mapa } = montar();
    await op.cadastrarKart(ger, pedido('k2', { kart: '012', transponder: '5550002', chassi: 'A-9' }));
    expect(mapa['5550002']).toBe('12');
  });
  it('recusa sensor que já está em outro kart e kart que já tem outro sensor', async () => {
    const { op, chamadas } = montar();
    await expect(op.cadastrarKart(ger, pedido('k3', { kart: '112', transponder: '2908214', chassi: '133' }))).rejects.toThrow('já está no kart 133');
    await expect(op.cadastrarKart(ger, pedido('k4', { kart: '7', transponder: '5550003', chassi: '1' }))).rejects.toThrow('já está cadastrado com o sensor 1111111');
    expect(chamadas).toEqual([]);
  });
  it('recusa dados faltando', async () => {
    const { op } = montar();
    await expect(op.cadastrarKart(ger, pedido('k5', { kart: '112', transponder: '', chassi: '133' }))).rejects.toThrow('sensor');
    await expect(op.cadastrarKart(ger, pedido('k6', { kart: '112', transponder: '5550001', chassi: ' ' }))).rejects.toThrow('chassi');
    await expect(op.cadastrarKart(ger, pedido('k7', { kart: '0', transponder: '5550001', chassi: '1' }))).rejects.toThrow('inválido');
  });
  it('recepção não cadastra kart', async () => {
    const { op } = montar();
    expect(await op.cadastrarKart({ ...ger, perfil: 'RECEPCAO' }, pedido('k8', { kart: '112', transponder: '5550001', chassi: '133' })).catch(e => e)).toMatchObject({ http: 403 });
  });
  it('kart que já tem o mesmo sensor só liga o chassi (repetir não quebra)', async () => {
    const { op, chamadas } = montar();
    expect(await op.cadastrarKart(ger, pedido('k9', { kart: '133', transponder: '2908214', chassi: 'X1' }))).toMatchObject({ status: 'APPLIED' });
    expect(chamadas).toEqual([]);
  });
  it('ligar chassi em kart sem sensor explica o que fazer', async () => {
    const { op } = montar();
    const r = await op.chassiKart(ger, '112', { operationId: 'c1', expectedSessionRevision: 0, payload: { chassi: '133' }, reason: 'x' });
    expect(r).toMatchObject({ status: 'REJECTED' });
    expect(JSON.stringify(r)).toContain('Cadastrar kart novo');
  });
});
