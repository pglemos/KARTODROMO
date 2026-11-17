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

const { montar, gruposRoutes, puxarPagamentosDiretoDoAsaas } = await import('../../lib/ops/grupos');
const sessao = { uid: 1, nome: 'TESTE CODEX', admin: true, exp: Date.now() + 60_000 };

const grupoIndividual = (n: number) => ({
  id: 88,
  codigo: 'G6FFF18E',
  bateriaId: 9,
  vagas: 22,
  disponiveis: 0,
  inicio: '2026-11-15T18:00',
  bateria: 'BATERIA 18:00',
  responsavelId: 50,
  responsavel: 'Junior Pereira',
  responsavelTelefone: null,
  origem: 'whatsapp',
  modo: 'individual',
  preco: 14500,
  sinalPct: 0,
  observacao: null,
  status: 'ativa',
  criadoEm: '',
  criadoPor: null,
  pilotos: Array.from({ length: n }, (_, i) => ({
    id: i + 1,
    ordem: i + 1,
    responsavel: i === 0 ? 1 : 0,
    token: 't' + i,
    inscricaoId: 100 + i,
    inscricaoStatus: 'reservada',
    inscricaoPaga: 0,
    pagoPeloGrupo: 0,
  })),
});

describe('grupo modo individual: blindagem contra rateio e R$ 140,91', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.PRECADASTRO_URL = 'https://reservas.example';
    process.env.PRECADASTRO_KEY = 'chave-teste';
  });

  it('pagamento sem piloto em grupo individual nunca é rateado em R$ 140,91', () => {
    const base = grupoIndividual(22);
    const m = montar(
      base as never,
      base.pilotos,
      [
        { id: 1, grupoId: 88, pilotoId: 5, valor: 14500 },
        { id: 2, grupoId: 88, pilotoId: 10, valor: 14500 },
        { id: 3, grupoId: 88, pilotoId: null, valor: 9000 },
      ],
      [],
    );

    expect(m.pagos).toBe(2);
    expect(m.pagamentosSemPiloto).toBe(9000);
    expect(m.falta).toBe(20 * 14500);
    expect(m.pago).toBe(2 * 14500);

    for (const p of m.pilotos) {
      if (p.id === 5 || p.id === 10) {
        expect(p).toMatchObject({ pago: true, valorPago: 14500, falta_centavos: 0 });
      } else {
        expect(p).toMatchObject({ pago: false, valorPago: 0, falta_centavos: 14500 });
        expect(p.falta_centavos).not.toBe(14091);
      }
    }
  });

  it('pagamentos múltiplos de vagas inteiras (sem piloto ou excedente no piloto) quitam vagas inteiras em ordem', () => {
    const base = grupoIndividual(6);
    const mSemPiloto = montar(
      base as never,
      base.pilotos,
      [{ id: 1, grupoId: 88, pilotoId: null, valor: 29000 }],
      [],
    );
    expect(mSemPiloto.pagos).toBe(2);
    expect(mSemPiloto.pago).toBe(29000);
    expect(mSemPiloto.falta).toBe(4 * 14500);
    expect(mSemPiloto.pagamentosSemPiloto).toBe(0);
    expect(mSemPiloto.pilotos.slice(0, 2).every((p) => p.pago && p.valorPago === 14500 && p.falta_centavos === 0)).toBe(true);
    expect(mSemPiloto.pilotos.slice(2).every((p) => !p.pago && p.valorPago === 0 && p.falta_centavos === 14500)).toBe(true);

    const mExcedente = montar(
      base as never,
      base.pilotos,
      [
        { id: 1, grupoId: 88, pilotoId: 1, valor: 72500 },
        { id: 2, grupoId: 88, pilotoId: 2, valor: 14500 },
      ],
      [],
    );
    expect(mExcedente.pagos).toBe(6);
    expect(mExcedente.pago).toBe(6 * 14500);
    expect(mExcedente.falta).toBe(0);
    expect(mExcedente.pagamentosSemPiloto).toBe(0);
    expect(mExcedente.pilotos.every((p) => p.pago && p.valorPago === 14500 && p.falta_centavos === 0)).toBe(true);
  });

  it('modo sinal continua rateando o sinal entre os pilotos normalmente', () => {
    const base = { ...grupoIndividual(10), modo: 'sinal', sinalPct: 30 };
    const m = montar(
      base as never,
      base.pilotos,
      [{ id: 1, grupoId: 88, pilotoId: null, valor: 43500 }],
      [],
    );
    expect(m.pagamentosSemPiloto).toBe(0);
    expect(m.pago).toBe(43500);
    expect(m.pilotos.every((p) => p.valorPago === 4350 && p.falta_centavos === 10150)).toBe(true);
  });

  it('recusa gerar cobrança avulsa sem piloto no modo individual', async () => {
    const base = grupoIndividual(2);
    db.query
      .mockResolvedValueOnce([base])
      .mockResolvedValueOnce(base.pilotos.map((p) => ({ ...p, grupoId: 88 })))
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    await expect(
      gruposRoutes(
        {
          method: 'POST',
          url: new URL('http://ops/api/office/grupos/88/cobrancas'),
          sessao,
          body: async () => ({ pilotoId: null }),
        },
        vi.fn(),
      ),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('permite vincular pagamento sem piloto a um piloto específico via PATCH e recusa desvincular no modo individual', async () => {
    const base = grupoIndividual(2);
    db.query.mockImplementation(async (sql: string) => {
      if (tem(sql, 'FROM kart.reserva_grupo g')) return [base];
      if (tem(sql, 'FROM kart.reserva_grupo_piloto p')) return base.pilotos.map((p) => ({ ...p, grupoId: 88 }));
      return [];
    });

    await expect(
      gruposRoutes(
        {
          method: 'PATCH',
          url: new URL('http://ops/api/office/grupos/88/pagamentos/9'),
          sessao,
          body: async () => ({ pilotoId: null }),
        },
        vi.fn(),
      ),
    ).rejects.toMatchObject({ status: 400 });

    db.one.mockResolvedValueOnce({ Id: 9 });
    const send = vi.fn();
    await gruposRoutes(
      {
        method: 'PATCH',
        url: new URL('http://ops/api/office/grupos/88/pagamentos/9'),
        sessao,
        body: async () => ({ pilotoId: 2 }),
      },
      send,
    );

    expect(db.one).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE kart.reserva_grupo_pagamento SET piloto_id = @p'),
      { p: 2, pg: 9, g: 88 },
    );
    expect(send).toHaveBeenCalledWith(200, expect.objectContaining({ id: 88 }));
  });

  it('ignora notificação de webhook sem valor válido em vez de inventar R$ 145,00', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify([{ asaasId: 'pay_semvalor123', externalReference: 'grupo-88-g', billingType: 'PIX' }]), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);
    db.one.mockResolvedValueOnce(null);

    const n = await puxarPagamentosDiretoDoAsaas(vi.fn(), undefined, true);
    expect(n).toBe(0);
    expect(db.query.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO dbo.ReservaGrupoPagamento'))).toBe(false);
    vi.unstubAllGlobals();
  });
});

describe('diferença da troca de serviço (grupo "cada um paga o seu")', () => {
  it('quem já pagou no site deve só a diferença; o pagamento antigo conta para a própria vaga', () => {
    const g = { id: 1, codigo: 'GTESTE', modo: 'individual', preco: 14500, sinalPct: 0, responsavelId: 10, inicio: '2026-11-20T14:40', bateria: 'BATERIA 14:40' };
    const piloto = (id: number, resp: boolean) => ({ id, ordem: id, responsavel: resp, clienteId: 10 + id, inscricaoId: 100 + id, token: 'T' + id, precoProprio: 14500, inscricaoPaga: false, pagoPeloGrupo: false, inscricaoStatus: 'reservada' });
    const m = montar(g as never, [piloto(1, true), piloto(2, false)], [
      { grupoId: 1, pilotoId: 1, valor: 9990 },
      { grupoId: 1, pilotoId: 2, valor: 8990 },
    ], []);
    expect(m.pilotos.map((p) => p.falta_centavos)).toEqual([4510, 5510]);
    expect(m.falta).toBe(10020);
    expect(m.pilotos.every((p) => !p.pago)).toBe(true);
  });
});
