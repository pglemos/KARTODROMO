import { describe, expect, it, vi } from 'vitest';
import worker from '../workers/pre-cadastro/src/index';

// A busca de cadastro por CPF/e-mail foi retirada (12/11/2026): devolvia dados pessoais de qualquer pessoa sem
// confirmação. Este teste garante que a rota não volta a responder com dados.
describe('busca de clientes no pré-cadastro (/api/cliente/identificar) desativada', () => {
  it('não responde dados de cliente para nenhuma consulta', async () => {
    const env = {
      PRE: { get: vi.fn(), list: vi.fn(async () => ({ objects: [] })), put: vi.fn(), delete: vi.fn() },
      SYNC_KEY: 'test-sync-key',
    } as never;
    const ctx = { waitUntil: vi.fn(), passThroughOnException: vi.fn() } as never;
    for (const q of ['123', '529.982.247-25', 'ana@example.com']) {
      const res = await worker.fetch(new Request(`https://cadastro.kartodromodebetim.com.br/api/cliente/identificar?q=${encodeURIComponent(q)}`), env, ctx);
      expect(res.status).toBe(404);
      expect(await res.text()).not.toMatch(/"cliente"\s*:\s*\{/);
    }
  });
});
