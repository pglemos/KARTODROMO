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

const { gruposRoutes, desvincularPilotoDoGrupo } = await import('../../lib/ops/grupos');
const office = await import('../../lib/ops/office');
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


/** Voucher de valor fixo (R$ 20) numa vaga de R$ 145. */
const voucher = { Id: 31, Codigo: 'VINTE', Tipo: 'valor', Valor: 2000, Ativo: true, VigenciaOk: 1, DescontoMaximoCentavos: null, PedidoMinimoCentavos: null, UsoUnico: true, UsoMaxTotal: null, UsoMaxCliente: 1, RestritoClientes: false };

function prepararBanco(usosNaTransacao: number) {
  const base = grupoIndividual(2);
  db.query.mockImplementation(async (sql: string) => {
    if (tem(sql, 'FROM kart.reserva_grupo g')) return [base];
    if (tem(sql, 'WHERE p.id = @pid')) return [{ clienteId: 7, doc: null, inscricaoId: 100 }];
    if (tem(sql, 'FROM kart.reserva_grupo_piloto p')) return base.pilotos.map((p) => ({ ...p, grupoId: 88 }));
    if (tem(sql, 'FROM kart.voucher WHERE')) return [voucher];
    return [];
  });
  db.one.mockResolvedValue({ n: 0, doCli: 0 });
  const run = vi.fn(async (sql: string, _p?: Record<string, unknown>) => {
    if (tem(sql, 'FROM kart.reserva_grupo WHERE id = @g')) return [{ Id: 88, ResponsavelId: 50 }];
    if (tem(sql, 'FROM kart.voucher v WHERE v.id')) return [{ UsoUnico: true, UsoMaxTotal: null, n: usosNaTransacao }];
    return [];
  });
  db.tx.mockImplementation(async (fn: (r: typeof run) => unknown) => fn(run));
  return run;
}

const pedido = (body: Record<string, unknown>) => ({
  method: 'POST',
  url: new URL('http://ops/api/office/grupos/88/pagamentos'),
  sessao,
  body: async () => body,
});

describe('recebimento com voucher (revisão de 19/11/2026)', () => {
  beforeEach(() => vi.resetAllMocks());

  it('voucher de R$ 20 grava R$ 20, não a vaga inteira de R$ 145', async () => {
    const run = prepararBanco(0);
    await gruposRoutes(pedido({ idempotencyKey: 'chave-voucher-1', forma: 'Voucher', voucherCodigo: 'VINTE', pilotoId: 1 }) as never, vi.fn());
    const insert = run.mock.calls.find(([sql]) => tem(sql, 'INSERT INTO kart.reserva_grupo_pagamento'));
    expect(insert?.[1]).toMatchObject({ v: 2000, f: 'Voucher', p: 1 });
    const uso = run.mock.calls.find(([sql]) => tem(sql, 'INSERT INTO kart.reserva_grupo_voucher_uso'));
    expect(uso?.[1]).toMatchObject({ d: 2000, vid: 31 });
  });

  it('voucher de uso único já consumido por outro recebimento simultâneo é recusado dentro da transação', async () => {
    const run = prepararBanco(1);
    await expect(
      gruposRoutes(pedido({ idempotencyKey: 'chave-voucher-2', forma: 'Voucher', voucherCodigo: 'VINTE', pilotoId: 1 }) as never, vi.fn()),
    ).rejects.toMatchObject({ status: 409 });
    expect(run.mock.calls.some(([sql]) => tem(sql, 'pg_advisory_xact_lock'))).toBe(true);
    expect(run.mock.calls.some(([sql]) => tem(sql, 'INSERT INTO kart.reserva_grupo_pagamento'))).toBe(false);
  });

  it('Pix comum continua gravando o valor informado', async () => {
    const run = prepararBanco(0);
    await gruposRoutes(pedido({ idempotencyKey: 'chave-pix-0001', forma: 'Pix', valorCentavos: 14500, pilotoId: 1 }) as never, vi.fn());
    const insert = run.mock.calls.find(([sql]) => tem(sql, 'INSERT INTO kart.reserva_grupo_pagamento'));
    expect(insert?.[1]).toMatchObject({ v: 14500, f: 'Pix' });
    expect(run.mock.calls.some(([sql]) => tem(sql, 'pg_advisory_xact_lock'))).toBe(false);
  });
});

describe('mover piloto do grupo (revisão de 19/11/2026)', () => {
  beforeEach(() => vi.resetAllMocks());

  function transacao(pago: number, cobrancas: number) {
    const run = vi.fn(async (sql: string, _p?: Record<string, unknown>) => {
      if (tem(sql, 'FROM kart.reserva_grupo WHERE id = @g')) return [{ id: 88, bateriaId: 9, responsavelId: 50, codigo: 'G1' }];
      if (tem(sql, 'FROM kart.reserva_grupo_piloto WHERE id = @pid')) return [{ id: 2, ordem: 2, nome: 'X', clienteId: 7, inscricaoId: 101, responsavel: false }];
      if (tem(sql, 'reserva_grupo_cobranca')) return [{ pago, cobrancas }];
      return [];
    });
    db.tx.mockImplementation(async (fn: (r: typeof run) => unknown) => fn(run));
    return run;
  }

  it('recusa mover quem já pagou: o pagamento ficaria valendo para a vaga que sobra', async () => {
    transacao(14500, 0);
    await expect(desvincularPilotoDoGrupo(88, 2, { destino: 'sozinho', novaBateriaId: 10 }, 1, vi.fn())).rejects.toMatchObject({ status: 409 });
    expect(office.moverReservas).not.toHaveBeenCalled();
  });

  it('recusa mover quem tem link de pagamento aberto', async () => {
    transacao(0, 1);
    await expect(desvincularPilotoDoGrupo(88, 2, { destino: 'sozinho', novaBateriaId: 10 }, 1, vi.fn())).rejects.toMatchObject({ status: 409 });
  });

  it('sem pagamento, move para outra bateria usando a MESMA transação (sem esperar 30 s pela trava)', async () => {
    const run = transacao(0, 0);
    vi.mocked(office.inscreverN).mockResolvedValue([555] as never);
    await desvincularPilotoDoGrupo(88, 2, { destino: 'sozinho', novaBateriaId: 10 }, 1, vi.fn()).catch(() => undefined);
    expect(office.moverReservas).toHaveBeenCalledWith([101], 10, undefined, { run });
  });
});
