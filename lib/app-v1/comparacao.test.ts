import { describe, expect, it } from 'vitest';
import { compararKarts } from './comparacao';

const AGORA = Date.parse('2026-11-04T16:00:00Z');
const h = (sessionId: string, melhorMs: number, voltas = 6) => ({ sessionId, data: '2026-11-03', hora: '19:20', melhorMs, voltas });

describe('compararKarts', () => {
  it('pega as 5 melhores, ordena e soma as voltas; filtra janela, tipos e traçado', async () => {
    const pedidos: string[] = [];
    const legado = async (_m: string, caminho: string) => {
      pedidos.push(caminho);
      return caminho.endsWith('kart=7') ? [h('a', 60_000), h('b', 58_000), h('c', 61_000), h('d', 59_000), h('e', 62_000), h('f', 57_000)] : [h('x', 70_000, 3)];
    };
    const r = await compararKarts(legado, { kart: '7', referencia: '9', trackId: 't1', agora: AGORA });
    expect(r.kart.voltas.map((v) => v.lapMs)).toEqual([57_000, 58_000, 59_000, 60_000, 61_000]);
    expect(r.kart.amostra).toBe(36);
    expect(r.referencia).toMatchObject({ numero: '9', amostra: 3 });
    expect(r.kart.voltas[0].em).toBe(Date.parse('2026-11-03T22:20:00Z'));
    expect(pedidos[0]).toContain('de=2026-10-20');
    expect(pedidos[0]).toContain('ate=2026-11-04');
    expect(pedidos[0]).toContain('trackId=t1');
    expect(pedidos[0]).toContain('tipos=classificacao%2Ccorrida%2Ctreino');
  });

  it('recusa kart igual, número inválido e frotas diferentes', async () => {
    const legado = async () => [];
    await expect(compararKarts(legado, { kart: '7', referencia: '7' })).rejects.toMatchObject({ http: 400 });
    await expect(compararKarts(legado, { kart: 'x', referencia: '7' })).rejects.toMatchObject({ http: 400 });
    await expect(compararKarts(legado, { kart: '7', referencia: '101' })).rejects.toThrow('mesma frota');
  });

  it('ignora tempos zerados e responde vazio quando não há histórico', async () => {
    const r = await compararKarts(async () => [h('a', 0), h('b', Number.NaN)], { kart: '1', referencia: '2', agora: AGORA });
    expect(r.kart).toEqual({ numero: '1', amostra: 0, voltas: [] });
  });
});
