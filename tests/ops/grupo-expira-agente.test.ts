import { beforeEach, describe, expect, it, vi } from 'vitest';

/** O SQL do Postgres mistura maiúsculas e minúsculas: compara sem diferenciar. */
const tem = (sql: unknown, trecho: string) => String(sql).toLowerCase().includes(trecho.toLowerCase());

const db = vi.hoisted(() => ({ one: vi.fn(), query: vi.fn(), tx: vi.fn() }));
vi.mock('../../lib/ops/db', () => ({
  ...db,
  CLIENTE_COLS: '',
  onlyDigits: (v: unknown) => String(v ?? '').replace(/\D/g, ''),
  insertCliente: vi.fn(),
  isValidCpf: vi.fn(),
  updateCliente: vi.fn(),
}));
vi.mock('../../lib/ops/office', () => ({
  HttpError: class extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  },
  cancelarReserva: vi.fn(),
  exigePodeFecharBateria: vi.fn(),
  exigePermissaoOffice: vi.fn(),
  inscreverN: vi.fn(),
  moverReservas: vi.fn(),
}));

const { expirarGruposDoAgente, MARCA_DO_AGENTE, PRAZO_DO_AGENTE_MIN } = await import('../../lib/ops/grupos');

type Chamada = { sql: string; params: Record<string, unknown> };
let rodadas: Chamada[];
let vencidos: { id: number; codigo: string }[];
let cobrancas: { id: number; asaasId: string }[];
let pagoNaHora: boolean;
let pagamentoNoGrupo: boolean;
let siteFalha: boolean;
const fetchMock = vi.fn();

beforeEach(() => {
  rodadas = [];
  vencidos = [{ id: 7, codigo: 'GAGENTE1' }];
  cobrancas = [];
  pagoNaHora = false;
  pagamentoNoGrupo = false;
  siteFalha = false;
  vi.stubEnv('PRECADASTRO_URL', 'https://cadastro.teste');
  vi.stubEnv('PRECADASTRO_KEY', 'chave-de-teste');
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (_url: string, init?: RequestInit) => {
    if (siteFalha) throw new Error('fora do ar');
    const corpo = init?.method === 'DELETE' ? { cancelada: true } : { pago: pagoNaHora, status: pagoNaHora ? 'RECEIVED' : 'PENDING' };
    return new Response(JSON.stringify(corpo), { status: 200, headers: { 'content-type': 'application/json' } });
  });
  vi.stubGlobal('fetch', fetchMock);
  db.query.mockReset();
  db.query.mockImplementation(async (sql: string) => {
    if (tem(sql, 'FROM kart.reserva_grupo g JOIN kart.bateria b')) return vencidos;
    if (tem(sql, 'FROM kart.reserva_grupo_cobranca WHERE grupo_id')) return cobrancas;
    return [];
  });
  db.tx.mockReset();
  db.tx.mockImplementation(async (cb: (run: (sql: string, params?: Record<string, unknown>) => Promise<unknown[]>) => Promise<unknown>) => {
    const run = async (sql: string, params: Record<string, unknown> = {}) => {
      rodadas.push({ sql, params });
      if (tem(sql, 'FROM kart.reserva_grupo WHERE id = @id AND status')) return [{ Id: 7 }];
      if (tem(sql, 'FROM kart.reserva_grupo_pagamento')) return pagamentoNoGrupo ? [{ x: 1 }] : [];
      return [];
    };
    return cb(run);
  });
});

describe('reservas do agente sem pagamento no prazo (regra do dono, 20/11/2026)', () => {
  it('procura só grupos com a marca do agente, com 2 h de prazo e sem pagamento', async () => {
    await expirarGruposDoAgente(() => undefined);
    const [sql, params] = db.query.mock.calls[0] as [string, Record<string, unknown>];
    expect(params.marca).toBe(`${MARCA_DO_AGENTE}%`);
    expect(params.prazo).toBe(PRAZO_DO_AGENTE_MIN);
    expect(PRAZO_DO_AGENTE_MIN).toBe(120);
    expect(tem(sql, 'g.observacao LIKE @marca')).toBe(true);
    expect(tem(sql, 'b.inicio - make_interval(mins => 60)')).toBe(true);
    expect(tem(sql, 'NOT EXISTS (SELECT 1 FROM kart.reserva_grupo_pagamento')).toBe(true);
    expect(tem(sql, 'i.pago = true OR i.venda_id IS NOT NULL')).toBe(true);
  });

  it('cancela as vagas e o grupo vencido', async () => {
    const soltos = await expirarGruposDoAgente(() => undefined);
    expect(soltos).toBe(1);
    expect(rodadas.some((r) => tem(r.sql, "UPDATE kart.inscricao SET status = 'cancelada'") && tem(r.sql, 'pago = false'))).toBe(true);
    expect(rodadas.some((r) => tem(r.sql, "UPDATE kart.reserva_grupo SET status = 'cancelada'"))).toBe(true);
  });

  it('cancela a cobrança aberta no Asaas antes de soltar as vagas', async () => {
    cobrancas = [{ id: 3, asaasId: 'pay_abc123' }];
    const soltos = await expirarGruposDoAgente(() => undefined);
    expect(soltos).toBe(1);
    expect(fetchMock.mock.calls.some(([, init]) => (init as RequestInit | undefined)?.method === 'DELETE')).toBe(true);
    expect(db.query.mock.calls.some(([sql]) => tem(sql, "UPDATE kart.reserva_grupo_cobranca SET status = 'cancelada'"))).toBe(true);
  });

  it('não solta quando a cobrança acabou de ser paga', async () => {
    cobrancas = [{ id: 3, asaasId: 'pay_abc123' }];
    pagoNaHora = true;
    expect(await expirarGruposDoAgente(() => undefined)).toBe(0);
    expect(rodadas).toHaveLength(0);
  });

  it('não solta quando não deu para cancelar a cobrança (tenta no próximo ciclo)', async () => {
    cobrancas = [{ id: 3, asaasId: 'pay_abc123' }];
    siteFalha = true;
    expect(await expirarGruposDoAgente(() => undefined)).toBe(0);
    expect(rodadas).toHaveLength(0);
  });

  it('não solta quando um pagamento entrou entre a busca e a trava', async () => {
    pagamentoNoGrupo = true;
    expect(await expirarGruposDoAgente(() => undefined)).toBe(0);
    expect(rodadas.some((r) => tem(r.sql, "UPDATE kart.reserva_grupo SET status = 'cancelada'"))).toBe(false);
  });
});
