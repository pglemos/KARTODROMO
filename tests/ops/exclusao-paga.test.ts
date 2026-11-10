import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const db = vi.hoisted(() => ({ one: vi.fn(), query: vi.fn(), tx: vi.fn() }));
vi.mock('../../lib/ops/db', () => ({ ...db, CLIENTE_COLS: '', onlyDigits: vi.fn(), insertCliente: vi.fn(), isValidCpf: vi.fn(), updateCliente: vi.fn() }));
import { cancelarReserva, officeRoutes } from '../../lib/ops/office';
import { montar, gruposRoutes } from '../../lib/ops/grupos';
const sessao = { uid: 1, nome: 'TESTE CODEX', admin: true, exp: Date.now() + 60000 };
beforeEach(() => { vi.resetAllMocks(); });
describe('cancelamento com pagamento preservado', () => {
  it('cancela pela rota usada no web e na recepção e aceita repetição', async () => {
    db.one.mockResolvedValue({ Id: 42 });
    const send = vi.fn();
    for (let n = 0; n < 2; n++) await officeRoutes({ method: 'DELETE', url: new URL('http://ops/api/office/reservas/42'), sessao, body: async () => ({}) }, send);
    expect(send).toHaveBeenCalledWith(200, expect.anything());
    for (const [sql, params] of db.one.mock.calls) {
      expect(sql).toContain("SET Status = 'cancelada'");
      expect(sql).toContain('OUTPUT inserted.Id');
      expect(sql).not.toMatch(/SET[^]*?(Pago|VendaId|ValorCentavos)\s*=/);
      expect(sql).not.toContain('Pago = 0');
      expect(params).toEqual({ id: 42 });
    }
    expect(db.query).not.toHaveBeenCalled();
  });
  it('mantém 404 para inscrição inexistente', async () => {
    db.one.mockResolvedValue(null);
    await expect(cancelarReserva(42)).rejects.toMatchObject({ status: 404 });
  });
  it('remove participante pago responsável sem apagar os vínculos financeiros', async () => {
    db.query.mockResolvedValueOnce([{ id: 1, modo: 'individual', preco: 14500 }])
      .mockResolvedValueOnce([{ id: 2, grupoId: 1, inscricaoId: 42, responsavel: true, inscricaoPaga: true, inscricaoStatus: 'confirmada' }])
      .mockResolvedValueOnce([{ id: 3, grupoId: 1, pilotoId: 2, valor: 14500 }]).mockResolvedValueOnce([]).mockResolvedValueOnce([{ id: 1, modo: 'individual', preco: 14500 }]).mockResolvedValue([]);
    db.one.mockResolvedValue({ Id: 42 });
    const send = vi.fn();
    await gruposRoutes({ method: 'DELETE', url: new URL('http://ops/api/office/grupos/1/pilotos/2'), sessao, body: async () => ({}) }, send);
    expect(send).toHaveBeenCalledWith(200, expect.anything());
    expect(db.one).toHaveBeenCalledWith(expect.stringContaining("SET Status = 'cancelada'"), { id: 42 });
    expect(db.query.mock.calls.some(([sql]) => /DELETE FROM|SET Pago/.test(sql))).toBe(false);
  });
});

describe('pagamentos de vagas canceladas', () => {
  it('preserva o histórico sem quitar outro participante com o pagamento individual cancelado', () => {
    const g = montar({ preco: 14500, modo: 'individual' } as Parameters<typeof montar>[0], [
      { id: 1, nome: 'TESTE CODEX CANCELADO', inscricaoStatus: 'cancelada' },
      { id: 2, nome: 'TESTE CODEX ATIVO', inscricaoStatus: 'reservada' },
    ], [{ id: 3, pilotoId: 1, valor: 14500 }], []);
    expect(g.n).toBe(1);
    expect(g.pago).toBe(0);
    expect(g.falta).toBe(14500);
    expect(g.pagamentos[0]).toMatchObject({ id: 3, valor: 14500, pilotoNome: 'TESTE CODEX CANCELADO', pilotoCancelado: true });
    expect(g.pilotos[0].pago).toBe(false);
  });
});

describe('estorno posterior ao cancelamento', () => {
  it('mantém a vaga cancelada quando a venda for estornada depois', async () => {
    const run = vi.fn(async (sql: string) => {
      if (sql.startsWith('SELECT v.Id')) return [{ Id: 7, MovimentoId: 1, FechadoEm: null }];
      if (sql.startsWith('SELECT Id, LiquidoCentavos')) return [{ Id: 8, LiquidoCentavos: 14500, InscricaoId: 42, VoucherId: null, Estornado: false }];
      if (sql.startsWith('SELECT COUNT(*)')) return [{ n: 0 }];
      return [];
    });
    db.tx.mockImplementation(async (work) => work(run));
    await officeRoutes({ method: 'POST', url: new URL('http://ops/api/office/vendas/7/estorno'), sessao, body: async () => ({ itemIds: [8] }) }, () => {});
    expect(run).toHaveBeenCalledWith(expect.stringContaining("Status = CASE WHEN Status = 'cancelada' THEN 'cancelada' ELSE 'reservada' END"), { i: 42 });
  });
});

describe('web local da recepção', () => {
  it('envia exclusão paga depois de confirmar a preservação do pagamento', async () => {
    const source = readFileSync(new URL('../../services/ops-ui/office-app.js', import.meta.url), 'utf8');
    const start = source.indexOf('async function excluirReservas(sel)');
    const end = source.indexOf('async function imprimirTermo', start);
    const api = vi.fn();
    const confirmar = vi.fn(async () => true);
    const excluir = vm.runInNewContext(source.slice(start, end) + '\nexcluirReservas', { api, confirmar, recarregar: vi.fn() });
    await excluir([{ id: 42, pago: true }]);
    expect(confirmar).toHaveBeenCalledWith(expect.stringContaining('sem reembolso automático'));
    expect(api).toHaveBeenCalledWith('/api/office/reservas/42', { method: 'DELETE' });
  });
});
