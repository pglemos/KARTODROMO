import { beforeEach, describe, expect, it, vi } from 'vitest';

// Pix pago dentro do prazo cujo aviso chegou depois (13/10, ACEXRJ): as vagas já estavam canceladas.
// Têm que voltar as MESMAS inscrições — inscrição nova deixava o piloto duas vezes na bateria para a recepção.
const estado = vi.hoisted(() => ({ livres: 5, sqls: [] as string[], inscrever: 0 }));

vi.mock('../../lib/ops/db', () => ({
  one: vi.fn(async (sql: string) =>
    sql.includes('FROM dbo.ReservaOnline') ? { Id: 44, Status: 'expirado', InscricaoIds: '69066,69067', ValorCentavos: 29000, BateriaId: 900, Quantidade: 2, ClienteId: 10, Codigo: 'ACEXRJ', expira: '2026-10-12T19:21:00' } : null),
  query: vi.fn(async (sql: string) => (sql.includes("Status = 'cancelada' ORDER BY") ? [{ ClienteId: 10 }, { ClienteId: 11 }] : [])),
  tx: vi.fn(async (fn: (run: (sql: string) => Promise<unknown[]>) => Promise<unknown>) =>
    fn(async (sql: string) => {
      estado.sqls.push(sql);
      if (sql.includes('livres')) return [{ livres: estado.livres, ok: 1 }];
      if (sql.includes('OUTPUT inserted.Id')) return [{ Id: 69066 }, { Id: 69067 }];
      return [];
    })),
}));
vi.mock('../../lib/ops/office', () => ({ inscreverN: vi.fn(async () => { estado.inscrever++; return [70001, 70002]; }) }));
vi.mock('../../lib/ops/pre-cadastro', () => ({ preCadastroLigado: () => true, gravarPreCadastro: vi.fn(), gravarAcompanhante: vi.fn() }));

const { confirmarPagamento } = await import('../../lib/ops/reserva-online');
const pedido = { id: 'ec490ed2', codigo: 'ACEXRJ', pagamento: { asaasId: 'pay_x', billingType: 'PIX' } } as never;

describe('pagamento que chega depois do prazo', () => {
  beforeEach(() => { estado.livres = 5; estado.sqls.length = 0; estado.inscrever = 0; });

  it('com vaga: as mesmas inscrições voltam, pagas, e nenhuma nova é criada', async () => {
    const r = await confirmarPagamento(pedido, () => undefined);
    expect(r).toEqual({ id: 'ec490ed2', acao: 'confirmado', codigo: 'ACEXRJ' });
    expect(estado.inscrever).toBe(0);
    expect(estado.sqls.some((s) => s.includes("SET Status = 'confirmada'") && s.includes('69066,69067'))).toBe(true);
    expect(estado.sqls.some((s) => s.includes('SET Pago = 1') && s.includes('69066,69067'))).toBe(true);
  });

  it('sem vaga para as mesmas linhas: cai no caminho antigo (tenta segurar de novo)', async () => {
    estado.livres = 1;
    await confirmarPagamento(pedido, () => undefined);
    expect(estado.inscrever).toBe(1);
  });
});
