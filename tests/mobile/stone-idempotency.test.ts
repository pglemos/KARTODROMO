import { afterEach, describe, expect, it, vi } from 'vitest';

import { criarPedido, situacaoPedido, syncResultado, type EnvReservas } from '../../workers/pre-cadastro/src/reservas';
import type { Agenda } from '../../workers/pre-cadastro/src/validar';

function r2() {
  const data = new Map<string, string>();
  const bucket = {
    get: async (key: string) => (data.has(key)
      ? { key, json: async () => JSON.parse(data.get(key)!), text: async () => data.get(key)! }
      : null),
    put: async (key: string, value: string) => { data.set(key, value); },
    list: async ({ prefix = '' }: { prefix?: string } = {}) => ({
      objects: [...data.keys()].filter((key) => key.startsWith(prefix)).map((key) => ({ key })),
      truncated: false,
    }),
    delete: async (keys: string | string[]) => {
      for (const key of Array.isArray(keys) ? keys : [keys]) data.delete(key);
    },
  };
  return { data, bucket: bucket as unknown as R2Bucket };
}

function executionContext() {
  const tasks: Promise<unknown>[] = [];
  return {
    context: { waitUntil: (task: Promise<unknown>) => { tasks.push(task); } } as ExecutionContext,
    wait: () => Promise.all(tasks),
  };
}

const agenda: Agenda = {
  atualizadoEm: '2026-10-12T12:00:00.000Z',
  precoCentavos: 14500,
  maxPilotos: 10,
  prazoMin: 15,
  antecedenciaMin: 120,
  horarios: [{ id: 101, inicio: '2026-10-15T09:15', nome: 'BATERIA 09:15', livres: 4 }],
};

const validBody = {
  bateriaId: 101,
  quantidade: 1,
  forma: 'pix',
  politica: true,
  lgpd: true,
  documento: '529.982.247-25',
  nome: 'Maria da Silva',
  email: 'maria@example.com',
  instagram: '@maria.silva',
  telefone: '(31) 98888-7777',
  nascimento: '1990-05-20',
  pilotos: ['Maria da Silva'],
};

afterEach(() => vi.unstubAllGlobals());

describe('idempotência de cobrança Stone', () => {
  it('reutiliza pedido encontrado pelo code após timeout ambíguo', async () => {
    const { data, bucket } = r2();
    data.set('reservas/agenda.json', JSON.stringify(agenda));
    const env: EnvReservas = {
      PRE: bucket,
      STONE_API_KEY: 'sk_test_key',
      STONE_URL: 'https://sdx-api.pagar.me/core/v5',
      RESERVAS_ATIVAS: '1',
    };
    const calls: { path: string; method: string }[] = [];
    let storedPayment = false;
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
      const url = new URL(String(input));
      const method = init.method ?? 'GET';
      calls.push({ path: `${url.pathname}${url.search}`, method });
      const response = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
      const reused = { id: 'or_reused', code: url.searchParams.get('code') ?? '', status: 'pending', charges: [{ status: 'pending', payment_method: 'pix', last_transaction: { qr_code: '000201PIX' } }] };

      if (url.pathname === '/core/v5/orders' && method === 'POST') {
        storedPayment = true;
        throw new Error('timeout: conexão encerrada após aceitar a cobrança');
      }
      if (url.pathname === '/core/v5/orders' && method === 'GET') return response({ data: storedPayment ? [reused] : [] });
      if (url.pathname === '/core/v5/orders/or_reused') return response(reused);
      return new Response('{}', { status: 404 });
    }));

    const created = await criarPedido(
      new Request('https://reservas.kartodromodebetim.com.br/api/reservas', {
        method: 'POST',
        body: JSON.stringify({ ...validBody, t: Date.now() - 10_000 }),
      }),
      env,
      async () => false,
    );
    expect(created.status).toBe(201);
    const { id } = await created.json() as { id: string };
    const execution = executionContext();
    await syncResultado(
      new Request('https://x/api/sync/pedido', {
        method: 'POST',
        body: JSON.stringify([{ id, acao: 'reservado', valorCentavos: 14500, expiraEm: '2026-10-15T09:30:00-03:00', descricao: 'Bateria', inicio: '2026-10-15T09:15' }]),
      }),
      env,
      execution.context,
    );
    await execution.wait();

    expect(calls.filter((call) => call.path === '/core/v5/orders' && call.method === 'POST')).toHaveLength(1);
    expect(calls).toContainEqual({ path: `/core/v5/orders?code=${id}&size=1`, method: 'GET' });
    const stored = JSON.parse(data.get(`reservas/pedidos/${id}.json`)!) as { cobranca: { pagamentoId: string } };
    expect(stored.cobranca.pagamentoId).toBe('or_reused');
    const publicOrder = await (await situacaoPedido(env, id, execution.context)).json() as Record<string, unknown>;
    expect(publicOrder).toMatchObject({ status: 'aguardando_pagamento', pix: { payload: '000201PIX' } });
  });
});
