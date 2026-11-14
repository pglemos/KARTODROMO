import { afterEach, describe, expect, it, vi } from 'vitest';
import { calcularCancelamento, cancelarReserva } from '../workers/pre-cadastro/src/cancelamento';

function loja(inicial: Record<string, unknown>) {
  const m = new Map<string, string>(Object.entries(inicial).map(([k, v]) => [k, typeof v === 'string' ? v : JSON.stringify(v)]));
  return {
    m,
    get: async (k: string) => (m.has(k) ? { json: async () => JSON.parse(m.get(k)!), text: async () => m.get(k)! } : null),
    put: async (k: string, v: string) => { m.set(k, v); },
    delete: async (k: string) => { m.delete(k); },
    list: async ({ prefix }: { prefix: string }) => ({ objects: [...m.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })) }),
  };
}
const ID = '11111111-2222-3333-4444-555555555555';
const AGORA = Date.parse('2026-11-10T12:00:00-03:00');
const pedido = (inicio: string, extra: Record<string, unknown> = {}) => ({
  id: ID, codigo: 'AB12CD', status: 'confirmado', quantidade: 2, forma: 'pix', criadoEm: '2026-11-01',
  cliente: { nome: 'Maria Silva', documento: '529.982.247-25', email: 'm@x.com' },
  servidor: { valorCentavos: 30000, expiraEm: '', descricao: 'Rental', inicio },
  pagamento: { asaasId: 'pay_abc123', billingType: 'PIX', pagoEm: '', valorCentavos: 30000 }, ...extra,
});
const env = (p: unknown) => ({ PRE: loja({ [`reservas/pedidos/${ID}.json`]: p, 'reservas/por-codigo/AB12CD': ID, [`reservas/por-cpf/52998224725/${ID}`]: '1', 'grupos/todos.json': [] }), ASAAS_API_KEY: 'k' });
const corpo = { cpf: '52998224725', codigo: 'AB12CD', pedidoId: ID, confirmo: true };

afterEach(() => vi.unstubAllGlobals());

describe('cancelamento pelo site', () => {
  it('calcula 90% com 48 h ou mais', () => {
    expect(calcularCancelamento({ valorCentavos: 30000, inicio: '2026-11-12T12:00:00' }, AGORA)).toMatchObject({ comReembolso: true, reembolsoCentavos: 27000 });
    expect(calcularCancelamento({ valorCentavos: 30000, inicio: '2026-11-12T11:00:00' }, AGORA)).toMatchObject({ comReembolso: false, reembolsoCentavos: 0 });
  });

  it('estorna no Asaas, cancela e enfileira para o SRVKART', async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ id: 'pay_abc123', status: 'REFUNDED' }), { status: 200 }));
    vi.stubGlobal('fetch', f);
    const e = env(pedido('2026-11-15T18:00:00'));
    const r = await cancelarReserva(e as never, corpo, AGORA);
    expect(r.status).toBe(200);
    expect(((await r.json()) as { reembolsoCentavos: number }).reembolsoCentavos).toBe(27000);
    expect(String((f.mock.calls[0] as unknown[])[0])).toContain('/payments/pay_abc123/refund');
    expect(JSON.parse(e.PRE.m.get(`reservas/pedidos/${ID}.json`)!).status).toBe('cancelado');
    expect(JSON.parse(e.PRE.m.get(`cancelamentos/${ID}.json`)!).state).toBe('pending');
    expect((await cancelarReserva(e as never, corpo, AGORA)).status).toBe(200);
    expect(f.mock.calls.filter((c) => String((c as unknown[])[0]).includes('/refund')).length).toBe(1);
  });

  it('sem reembolso a menos de 48 h, sem chamar o Asaas', async () => {
    const f = vi.fn(async () => new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', f);
    const r = await cancelarReserva(env(pedido('2026-11-11T18:00:00')) as never, corpo, AGORA);
    expect(((await r.json()) as { reembolsoCentavos: number }).reembolsoCentavos).toBe(0);
    expect(f.mock.calls.some((c) => String((c as unknown[])[0]).includes('/refund'))).toBe(false);
  });

  it('falha do estorno não cancela', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ errors: [{ description: 'saldo insuficiente' }] }), { status: 400 })));
    const e = env(pedido('2026-11-15T18:00:00'));
    expect((await cancelarReserva(e as never, corpo, AGORA)).status).toBe(502);
    expect(JSON.parse(e.PRE.m.get(`reservas/pedidos/${ID}.json`)!).status).toBe('confirmado');
    expect(e.PRE.m.has(`cancelamentos/${ID}.json`)).toBe(false);
    expect((await cancelarReserva(e as never, corpo, AGORA)).status).toBe(502);
  });

  it('recusa cada um paga o seu, CPF errado e bateria passada', async () => {
    expect((await cancelarReserva(env(pedido('2026-11-15T18:00:00', { modo: 'individual' })) as never, corpo, AGORA)).status).toBe(409);
    expect((await cancelarReserva(env(pedido('2026-11-15T18:00:00')) as never, { ...corpo, cpf: '11144477735' }, AGORA)).status).toBe(404);
    expect((await cancelarReserva(env(pedido('2026-11-09T18:00:00')) as never, corpo, AGORA)).status).toBe(409);
  });
});
