import { mobileRequest } from '../src/api/client';
import { reservationsApi } from '../src/features/reservations/api';

jest.mock('../src/session/secure-storage', () => ({ readSession: jest.fn() }));

const originalFetch = globalThis.fetch;
const validAgenda = {
  atualizadoEm: '2026-10-19T12:00:00Z', precoCentavos: 10000, maxPilotos: 10,
  prazoMin: 15, antecedenciaMin: 30, pagamentoOnline: true,
  horarios: [{ id: 1, inicio: '2026-10-20T10:00', nome: 'TESTE CODEX', livres: 3 }],
};

afterEach(() => { globalThis.fetch = originalFetch; jest.useRealTimers(); });

it('encerra uma conexão que não responde e permite tentar novamente', async () => {
  jest.useFakeTimers();
  globalThis.fetch = jest.fn((_url, options) => new Promise((_resolve, reject) => {
    options?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
  })) as typeof fetch;
  const result = expect(mobileRequest('/test')).rejects.toThrow(/demorou/i);
  await jest.advanceTimersByTimeAsync(15000);
  await result;
  expect(jest.getTimerCount()).toBe(0);
});

it('encerra também uma resposta cujo corpo fica travado', async () => {
  jest.useFakeTimers();
  globalThis.fetch = jest.fn(async (_url, options) => ({
    ok: true, status: 200,
    json: () => new Promise((_resolve, reject) => options?.signal?.addEventListener('abort', () => reject(new Error('aborted')))),
  })) as unknown as typeof fetch;
  const result = expect(mobileRequest('/test')).rejects.toThrow(/demorou/i);
  await jest.advanceTimersByTimeAsync(15000);
  await result;
});

it('libera o temporizador depois de uma resposta válida', async () => {
  jest.useFakeTimers();
  globalThis.fetch = jest.fn(async () => ({ ok: true, status: 200, json: async () => ({ ok: true }) })) as unknown as typeof fetch;
  expect(await mobileRequest('/test')).toEqual({ ok: true });
  expect(jest.getTimerCount()).toBe(0);
});

it('usa a agenda pública oficial somente quando a rota mobile não existe', async () => {
  const request = jest.fn()
    .mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({ erro: 'Rota desconhecida.' }) })
    .mockResolvedValueOnce({ ok: true, status: 200, json: async () => validAgenda });
  globalThis.fetch = request;
  expect(await reservationsApi.agenda()).toEqual({ ...validAgenda, bookingChannel: 'site' });
  expect(String(request.mock.calls[1][0])).toMatch(/\/api\/agenda$/);
});

it('não contorna um bloqueio de acesso usando a rota pública', async () => {
  const request = jest.fn().mockResolvedValue({ ok: false, status: 403, json: async () => ({ erro: 'Reserva indisponível.' }) });
  globalThis.fetch = request;
  await expect(reservationsApi.agenda()).rejects.toThrow('Reserva indisponível.');
  expect(request).toHaveBeenCalledTimes(1);
});

it('aceita disponibilidade maior que o limite de vagas por pedido', async () => {
  const data = { ...validAgenda, horarios: [{ ...validAgenda.horarios[0], livres: 30 }] };
  globalThis.fetch = jest.fn(async () => ({ ok: true, status: 200, json: async () => data })) as unknown as typeof fetch;
  expect((await reservationsApi.agenda()).horarios[0].livres).toBe(30);
});

it.each([
  null,
  { ...validAgenda, precoCentavos: -1 },
  { ...validAgenda, precoCentavos: 1.5 },
  { ...validAgenda, maxPilotos: 0 },
  { ...validAgenda, horarios: [{ ...validAgenda.horarios[0], livres: -1 }] },
  { ...validAgenda, horarios: [{ ...validAgenda.horarios[0], inicio: '2026-02-30T10:00' }] },
  { ...validAgenda, horarios: [validAgenda.horarios[0], validAgenda.horarios[0]] },
])('rejeita uma agenda inválida sem disponibilizar suas vagas: %j', async (data) => {
  globalThis.fetch = jest.fn(async () => ({ ok: true, status: 200, json: async () => data })) as unknown as typeof fetch;
  await expect(reservationsApi.agenda()).rejects.toThrow(/agenda.*inválid/i);
});
