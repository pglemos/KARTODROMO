import { beforeEach, describe, expect, it, vi } from 'vitest';

// Reserva online de grupo: cada vaga vira a inscrição de UMA pessoa (comprador + cadastros dos outros pilotos).
const chamadas = vi.hoisted(() => ({ inscrever: [] as unknown[][], acompanhantes: [] as unknown[] }));

vi.mock('../../lib/ops/db', () => ({
  one: vi.fn(async (sql: string) => {
    if (sql.includes('FROM dbo.ReservaOnline WHERE PedidoId')) return chamadas.inscrever.length ? { expira: '2026-10-09T18:35:00' } : null;
    if (sql.includes('FROM dbo.Bateria b')) return { nome: 'BATERIA 19:20', inicio: '2026-10-09T19:20', ok: 1 };
    if (sql.includes('FROM dbo.Produto')) return { preco: 14500 };
    return null;
  }),
  query: vi.fn(async () => []),
  tx: vi.fn(),
}));
vi.mock('../../lib/ops/office', () => ({
  inscreverN: vi.fn(async (...args: unknown[]) => { chamadas.inscrever.push(args); return [501, 502, 503]; }),
}));
vi.mock('../../lib/ops/pre-cadastro', () => ({
  preCadastroLigado: () => true,
  gravarPreCadastro: vi.fn(async () => 10),
  gravarAcompanhante: vi.fn(async (a: { documento: string }) => { chamadas.acompanhantes.push(a); return ({ '111.444.777-35': 11, '390.533.447-05': 12, '153.509.460-56': 13 } as Record<string, number>)[a.documento]; }),
}));

const { reservarPedido } = await import('../../lib/ops/reserva-online');

const pedido = (extra: Record<string, unknown>) => ({
  id: 'p1', codigo: 'ABC234', status: 'novo' as const, criadoEm: '2026-10-09T18:20:00Z', bateriaId: 900, quantidade: 3, forma: 'pix' as const,
  pilotos: ['Maria da Silva', 'João Silva', 'Ana Silva'],
  cliente: { tipoDocumento: 'CPF', documento: '529.982.247-25', nome: 'Maria da Silva', email: '', telefone: '31988887777', nascimento: '1990-05-20', peso: '', cep: '', endereco: '', numero: '', complemento: '', bairro: '', cidade: '', estado: '', menores: [], chave: '52998224725' },
  ...extra,
});
const outros = [{ nome: 'João Silva', documento: '111.444.777-35', nascimento: '2008-03-10' }, { nome: 'Ana Silva', documento: '390.533.447-05', nascimento: '1995-06-15' }];

describe('reserva online de grupo no SRVKART', () => {
  beforeEach(() => { chamadas.inscrever.length = 0; chamadas.acompanhantes.length = 0; process.env.OPS_RESERVA_ONLINE = '1'; });

  it('3 vagas = comprador + 2 cadastros, uma inscrição para cada pessoa', async () => {
    const r = await reservarPedido(pedido({ acompanhantes: outros }) as never, () => undefined);
    expect(r.acao).toBe('reservado');
    expect(chamadas.acompanhantes).toHaveLength(2);
    const [bateria, responsavel, n, , , , , opcoes] = chamadas.inscrever[0] as [number, number, number, unknown, unknown, unknown, unknown, { clientes?: number[] }];
    expect([bateria, responsavel, n]).toEqual([900, 10, 3]);
    expect(opcoes.clientes).toEqual([10, 11, 12]);
  });

  it('quem compra não pilota: as 3 vagas são dos 3 cadastrados', async () => {
    const tres = [...outros, { nome: 'Lia Silva', documento: '153.509.460-56', nascimento: '2009-02-20' }];
    await reservarPedido(pedido({ acompanhantes: tres, compradorPilota: false }) as never, () => undefined);
    const opcoes = (chamadas.inscrever[0] as unknown[])[7] as { clientes?: number[] };
    expect(opcoes.clientes).toHaveLength(3);
    expect(opcoes.clientes).toEqual([11, 12, 13]);
  });

  it('pedido antigo sem a lista: continua tudo no comprador', async () => {
    await reservarPedido(pedido({}) as never, () => undefined);
    const opcoes = (chamadas.inscrever[0] as unknown[])[7] as { clientes?: number[] };
    expect(opcoes.clientes).toBeUndefined();
  });
});
