import { afterEach, describe, expect, it, vi } from 'vitest';
import { dividirValor, documentosDasVagas, primeiraVez, produtoDaBateria, configOnline } from '../lib/ops/reserva-online';

afterEach(() => vi.unstubAllEnvs());

describe('Happy Hour online (10/11/2026)', () => {
  it('padrão: vende produtos 11, 4 e 67; Happy Hour pelo preço próprio e R$ 89,90 na primeira vez', () => {
    const c = configOnline();
    expect(c.produtosBateria).toEqual([11, 4, 67]);
    expect(c.primeiraVez).toEqual({ 67: 8990 });
    expect(produtoDaBateria(67, c)).toBe(67);
    expect(produtoDaBateria(11, c)).toBe(4);
    expect(produtoDaBateria(null, c)).toBe(4);
  });
  it('configurável pelo .env', () => {
    vi.stubEnv('OPS_ONLINE_PRIMEIRA_VEZ', '');
    vi.stubEnv('OPS_ONLINE_PRECO_PROPRIO', '');
    const c = configOnline();
    expect(c.primeiraVez).toEqual({});
    expect(produtoDaBateria(67, c)).toBe(4);
  });
  it('CPF de cada vaga: comprador primeiro; pedido antigo cai tudo no comprador', () => {
    const cliente = { documento: '52998224725' } as never;
    expect(documentosDasVagas({ cliente, acompanhantes: [{ documento: '11144477735' } as never] }, 2)).toEqual(['52998224725', '11144477735']);
    expect(documentosDasVagas({ cliente, compradorPilota: false, acompanhantes: [{ documento: '11144477735' } as never] }, 1)).toEqual(['11144477735']);
    expect(documentosDasVagas({ cliente }, 3)).toEqual(['52998224725', '52998224725', '52998224725']);
  });
  it('primeira vez = nenhum cadastro com histórico; CPF inválido nunca ganha o desconto', async () => {
    const read = vi.fn(async (_sql: string, p?: Record<string, unknown>) => ({ n: p?.doc === '52998224725' ? 1 : 0 }));
    expect(await primeiraVez(['529.982.247-25', '111.444.777-35', '123'], read)).toEqual([false, true, false]);
    expect(read).toHaveBeenCalledTimes(2);
    expect(read.mock.calls[0][0]).toMatch(/laptime/);
  });
  it('divide o valor pago na proporção dos preços e fecha no total', () => {
    expect(dividirValor(18980, [8990, 9990])).toEqual([8990, 9990]);
    const v = dividirValor(10000, [8990, 9990, 9990]);
    expect(v.reduce((a, b) => a + b, 0)).toBe(10000);
    expect(dividirValor(1000, [0, 0, 0])).toEqual([333, 333, 334]);
  });
});
