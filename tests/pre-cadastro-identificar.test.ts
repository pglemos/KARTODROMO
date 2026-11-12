import { beforeEach, describe, expect, it, vi } from 'vitest';
import worker from '../workers/pre-cadastro/src/index';

describe('busca autônoma de clientes no pré-cadastro (/api/cliente/identificar)', () => {
  // caches.default do Workers (limite de buscas por IP) não existe no Node: cache em memória por teste
  beforeEach(() => {
    const mem = new Map<string, string>();
    vi.stubGlobal('caches', { default: {
      match: async (r: Request) => (mem.has(r.url) ? new Response(mem.get(r.url)) : undefined),
      put: async (r: Request, res: Response) => { mem.set(r.url, await res.text()); },
    } });
  });

  it('retorna cliente: null para consultas curtas (< 5 caracteres)', async () => {
    const env = {
      PRE: { get: vi.fn(), list: vi.fn(), put: vi.fn(), delete: vi.fn() },
      SYNC_KEY: 'test-sync-key',
    } as any;
    const ctx = { waitUntil: vi.fn(), passThroughOnException: vi.fn() } as any;

    const req = new Request('https://cadastro.kartodromodebetim.com.br/api/cliente/identificar?q=123');
    const res = await worker.fetch(req, env, ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true, cliente: null });
  });

  it('busca do servidor operacional se disponível', async () => {
    const fakeClient = {
      id: 68579,
      nome: 'Filipe Silva Machado',
      tipoDocumento: 'CPF',
      documento: '12345678901',
      email: 'filipe@exemplo.com',
      instagram: '@filipe.machado',
      telefone: '(31) 98765-4321',
      nascimento: '1990-05-15',
      peso: '75',
      cep: '32600-000',
      rua: 'Av. das Américas',
      endereco: 'Av. das Américas, 100, Apto 201',
      numero: '100',
      complemento: 'Apto 201',
      bairro: 'Centro',
      cidade: 'Betim',
      estado: 'MG',
    };

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ cliente: fakeClient, dependentes: [] }), { status: 200, headers: { 'content-type': 'application/json' } })
    );

    const env = {
      PRE: { get: vi.fn(), list: vi.fn(), put: vi.fn(), delete: vi.fn() },
      SYNC_KEY: 'test-sync-key',
      OPS_URL: 'https://ops-teste.kartodromodebetim.com.br',
    } as any;
    const ctx = { waitUntil: vi.fn(), passThroughOnException: vi.fn() } as any;

    const req = new Request('https://cadastro.kartodromodebetim.com.br/api/cliente/identificar?cpf=12345678901');
    const res = await worker.fetch(req, env, ctx);
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.ok).toBe(true);
    expect(body.origem).toBe('servidor');
    expect(body.cliente.nome).toBe('Filipe Silva Machado');
    expect(body.cliente.telefone).toBe('(31) 98765-4321');
    expect(body.cliente.cidade).toBe('Betim');

    fetchSpy.mockRestore();
  });

  it('faz fallback para R2 pendentes quando o servidor operacional não encontra', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ cliente: null }), { status: 200, headers: { 'content-type': 'application/json' } })
    );

    const pendingInR2 = {
      tipoDocumento: 'CPF',
      documento: '98765432100',
      nome: 'Lucas Oliveira Santos',
      email: 'lucas@exemplo.com',
      instagram: '@lucas.santos',
      telefone: '(31) 99999-1234',
      nascimento: '1995-10-20',
      peso: '80',
      cep: '32000-000',
      endereco: 'Rua das Flores',
      numero: '50',
      complemento: '',
      bairro: 'Jardim',
      cidade: 'Betim',
      estado: 'MG',
      menores: [{ nome: 'Lucas Jr', nascimento: '2015-01-01', documento: 'MG123' }],
    };

    const env = {
      PRE: {
        get: vi.fn().mockImplementation(async (key: string) => {
          if (key === 'pendentes/98765432100.json') {
            return {
              json: async () => pendingInR2,
            };
          }
          return null;
        }),
        list: vi.fn(),
        put: vi.fn(),
        delete: vi.fn(),
      },
      SYNC_KEY: 'test-sync-key',
    } as any;
    const ctx = { waitUntil: vi.fn(), passThroughOnException: vi.fn() } as any;

    const req = new Request('https://cadastro.kartodromodebetim.com.br/api/cliente/identificar', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ documento: '987.654.321-00' }),
    });
    const res = await worker.fetch(req, env, ctx);
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.ok).toBe(true);
    expect(body.origem).toBe('pendente');
    expect(body.cliente.nome).toBe('Lucas Oliveira Santos');
    expect(body.dependentes.length).toBe(1);
    expect(body.dependentes[0].nome).toBe('Lucas Jr');

    fetchSpy.mockRestore();
  });
});
