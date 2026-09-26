import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({ one: vi.fn(), query: vi.fn(), tx: vi.fn() }));

vi.mock('../../lib/ops/db', () => ({
  CLIENTE_COLS: '',
  insertCliente: vi.fn(),
  isValidCpf: vi.fn(() => true),
  onlyDigits: (value: unknown) => (typeof value === 'string' || typeof value === 'number' ? String(value).replace(/\D/g, '') : ''),
  one: db.one,
  query: db.query,
  tx: db.tx,
  updateCliente: vi.fn(),
}));

import { hashSenha } from '../../lib/ops/auth';
import { HttpError, officeRoutes } from '../../lib/ops/office';

const admin = { uid: 7, nome: 'Admin de teste', admin: true, exp: Date.now() + 60_000 };
const recepcionista = { ...admin, admin: false };

async function call(path: string, method = 'GET', body: Record<string, unknown> = {}, sessao = admin) {
  const received: { status: number; body: unknown }[] = [];
  const handled = await officeRoutes(
    { method, url: new URL(`http://ops/api/office${path}`), body: async () => body, sessao },
    (status, payload) => received.push({ status, body: payload }),
  );
  expect(handled).toBe(true);
  return received[0];
}

beforeEach(() => {
  db.one.mockReset();
  db.query.mockReset();
  db.tx.mockReset();
  db.one.mockResolvedValue(null);
  db.query.mockResolvedValue([]);
  db.tx.mockImplementation(async (work: (run: (sql: string, params?: Record<string, unknown>) => Promise<Record<string, unknown>[]>) => Promise<unknown>) => work(async () => []));
});

describe('Office: gravação de baterias com hora local', () => {
  const bateria = { nome: 'TESTE CODEX', inicio: '2026-09-27T10:45', vagas: 30, produtoId: 1, tracadoId: 1 };

  it('completa os segundos antes da consulta SQL ao criar uma bateria', async () => {
    db.one.mockResolvedValueOnce(null).mockResolvedValueOnce({ c: 'Indoor' }).mockResolvedValueOnce({ id: 20 });
    expect(await call('/baterias', 'POST', bateria)).toEqual({ status: 201, body: { id: 20 } });
    expect(db.one.mock.calls[0][1].inicio).toBe('2026-09-27T10:45:00');
    expect(db.one.mock.calls[2][1].inicio).toBe('2026-09-27T10:45:00');
  });

  it('grava uma edição com segundos sem converter o horário de Brasília para UTC', async () => {
    db.one.mockResolvedValueOnce({ data: '2026-09-27', n: 0, pagas: 0 }).mockResolvedValueOnce({ c: 'Indoor' });
    expect(await call('/baterias/20', 'PUT', bateria)).toEqual({ status: 200, body: { ok: true } });
    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('UPDATE dbo.Bateria'), expect.objectContaining({ inicio: '2026-09-27T10:45:00' }));
  });

  it.each(['2026-02-30T10:45', '2026-09-27T24:00', '2026-09-27T10:60'])('recusa data ou hora impossível: %s', async (inicio) => {
    await expect(call('/baterias', 'POST', { ...bateria, inicio })).rejects.toMatchObject({ status: 400 });
    expect(db.one).not.toHaveBeenCalled();
  });

  it('continua impedindo a mudança de dia de uma bateria com reservas pagas', async () => {
    db.one.mockResolvedValueOnce({ data: '2026-09-26', n: 1, pagas: 1 });
    await expect(call('/baterias/20', 'PUT', bateria)).rejects.toMatchObject({ status: 409 });
    expect(db.query).not.toHaveBeenCalled();
  });
});

describe('Office: fidelidade e parceiros', () => {
  it('cria conta de fidelidade idempotente por cliente', async () => {
    db.tx.mockImplementation(async (work) => work(async (sql: string) => {
      if (sql.includes('FROM dbo.Cliente')) return [{ Id: 21 }];
      if (sql.includes('FROM dbo.FidelidadeConta WITH')) return [{ id: 44 }];
      throw new Error('SQL inesperado no teste');
    }));

    const response = await call('/fidelidade/contas', 'POST', { clienteId: 21 });
    expect(response).toEqual({ status: 200, body: { id: 44, existente: true } });
  });

  it('não permite que ajuste negativo deixe o saldo abaixo de zero', async () => {
    db.tx.mockImplementation(async (work) => work(async (sql: string) => {
      if (sql.includes('SELECT Id, SaldoPontos')) return [{ Id: 9, SaldoPontos: 4 }];
      if (sql.includes('IdempotencyKey')) return [];
      if (sql.startsWith('UPDATE dbo.FidelidadeConta')) return [];
      throw new Error('SQL inesperado no teste');
    }));

    await expect(call('/fidelidade/contas/9/ajustes', 'POST', { pontos: -5, motivo: 'Correção', idempotencyKey: 'adjust-0001' }))
      .rejects.toMatchObject({ status: 409 });
  });

  it('exige autorização administrativa para ajustes de pontos', async () => {
    await expect(call('/fidelidade/contas/9/ajustes', 'POST', { pontos: 10, motivo: 'Correção', idempotencyKey: 'adjust-0001' }, recepcionista))
      .rejects.toBeInstanceOf(HttpError);
    expect(db.tx).not.toHaveBeenCalled();
  });

  it('registra pagamento de comissão uma vez e com lançamento negativo no livro', async () => {
    const statements: { sql: string; params: Record<string, unknown> }[] = [];
    db.one.mockResolvedValue({ id: 2 });
    db.tx.mockImplementation(async (work) => work(async (sql: string, params: Record<string, unknown> = {}) => {
      statements.push({ sql, params });
      if (sql.includes('FROM dbo.ParceiroComissao WITH')) return [{ Id: 13, ValorCentavos: 1750, Estado: 'pendente' }];
      if (sql.includes('FROM dbo.ParceiroComissaoTransacao WHERE')) return [];
      return [];
    }));

    const response = await call('/parceiros/comissoes/13/pagar', 'POST', { idempotencyKey: 'pay-000013', formaPagamentoId: 2 });
    expect(response).toEqual({ status: 201, body: { id: 13, estado: 'paga', repetido: false } });
    expect(statements.find((x) => x.sql.includes('INSERT INTO dbo.ParceiroComissaoTransacao'))?.params).toMatchObject({
      tipo: 'pagamento', valor: -1750, formaPagamentoId: 2, uid: admin.uid,
    });
  });

  it('marca uma chave repetida de pagamento sem criar novo lançamento', async () => {
    let inserted = 0;
    db.one.mockResolvedValue({ id: 2 });
    db.tx.mockImplementation(async (work) => work(async (sql: string) => {
      if (sql.includes('FROM dbo.ParceiroComissao WITH')) return [{ Id: 13, ValorCentavos: 1750, Estado: 'paga' }];
      if (sql.includes('FROM dbo.ParceiroComissaoTransacao WHERE')) return [{ id: 99, tipo: 'pagamento', motivo: 'Pagamento de comissão', formaPagamentoId: 2 }];
      if (sql.includes('INSERT INTO dbo.ParceiroComissaoTransacao')) inserted++;
      return [];
    }));

    const response = await call('/parceiros/comissoes/13/pagar', 'POST', { idempotencyKey: 'pay-000013', formaPagamentoId: 2 });
    expect(response).toEqual({ status: 200, body: { id: 13, estado: 'paga', repetido: true } });
    expect(inserted).toBe(0);
  });

  it('rejects reusing a loyalty idempotency key with a different point delta', async () => {
    db.tx.mockImplementation(async (work) => work(async (sql: string) => {
      if (sql.includes('SELECT Id, SaldoPontos')) return [{ Id: 9, SaldoPontos: 4 }];
      if (sql.includes('IdempotencyKey')) return [{ id: 4, pontos: 10, saldoApos: 14, motivo: 'Bonus' }];
      throw new Error('Unexpected SQL in test');
    }));

    await expect(call('/fidelidade/contas/9/ajustes', 'POST', { pontos: 11, motivo: 'Bonus', idempotencyKey: 'adjust-0001' }))
      .rejects.toMatchObject({ status: 409 });
  });

  it('deactivate voucher uses a soft delete', async () => {
    db.one.mockResolvedValue({ id: 5 });
    const response = await call('/vouchers/5', 'DELETE');
    expect(response).toEqual({ status: 200, body: { id: 5, ok: true, desativado: true } });
    expect(db.query).toHaveBeenCalledWith('UPDATE dbo.Voucher SET Ativo = 0 WHERE Id = @id', { id: 5 });
  });

  it('updates a voucher without deleting its use history', async () => {
    db.one.mockResolvedValue({
      Id: 5, Origem: 'manual', Referencia: 'Campaign', ParceiroId: null, FidelidadeContaId: null,
      Tipo: 'percentual', Valor: 10, InicioEm: '2026-09-01', FimEm: '2026-09-30',
    });
    const response = await call('/vouchers/5', 'PUT', { valor: 15, fim: '2026-10-31' });
    expect(response).toEqual({ status: 200, body: { id: 5, ok: true } });
    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('UPDATE dbo.Voucher SET'), expect.objectContaining({ Valor: 15, FimEm: '2026-10-31' }));
  });

  it('requires the current password before changing it', async () => {
    db.one.mockResolvedValue({ hash: hashSenha('senha-correta'), ativo: true });
    await expect(call('/senha', 'POST', { senhaAtual: 'senha-incorreta', nova: 'outra-senha' }))
      .rejects.toMatchObject({ status: 403 });
    expect(db.query).not.toHaveBeenCalled();
  });

  it('requires at least eight characters for a new password', async () => {
    await expect(call('/senha', 'POST', { senhaAtual: 'old-password', nova: '1234567' }))
      .rejects.toMatchObject({ status: 400 });
    expect(db.one).not.toHaveBeenCalled();
  });

  it('reports only services that were actually probed', async () => {
    const previous = process.env.OPS_SERVICOS_ONLINE;
    delete process.env.OPS_SERVICOS_ONLINE;
    db.one.mockResolvedValue({ agora: '2026-09-26T12:00:00' });
    try {
      const response = await call('/servicos-online');
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        acoes: {
          publicarAgenda: { disponivel: false },
          enviarLembreteWhatsApp: { disponivel: false },
          sincronizarAgora: { disponivel: false },
        },
      });
      const serviceRows = (response.body as { servicos: { id: string; online: boolean | null; status: string; verificadoEm: string | null }[] }).servicos;
      expect(serviceRows).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: 'office-api', online: true, status: 'online' }),
        expect.objectContaining({ id: 'ops-sql', online: true, status: 'online', verificadoEm: '2026-09-26T12:00:00' }),
        expect.objectContaining({ id: 'site', online: null, status: 'indisponivel' }),
        expect.objectContaining({ id: 'whatsapp', online: null, status: 'indisponivel' }),
      ]));
    } finally {
      if (previous === undefined) delete process.env.OPS_SERVICOS_ONLINE;
      else process.env.OPS_SERVICOS_ONLINE = previous;
    }
  });
});
