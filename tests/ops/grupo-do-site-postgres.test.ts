import { describe, expect, it, vi } from 'vitest';

/**
 * Reserva BPQXHS (20/11/2026): "cada um paga o seu" pago, e o grupo com o link dos amigos NUNCA foi criado:
 * `coluna "menor" é do tipo boolean mas expressão é do tipo integer`. O INSERT tinha o literal `0` (herança do
 * SQL Server, onde a coluna era bit); no Postgres, literal inteiro em coluna boolean é erro. Parâmetro (@m) passa
 * porque o Postgres converte o texto '0'/'1'; literal não.
 */

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

const { grupoDaReservaOnline } = await import('../../lib/ops/grupos');

describe('grupo do "cada um paga o seu" no Postgres', () => {
  it('⭐ nenhum INSERT de piloto grava literal inteiro em coluna boolean', async () => {
    const sqls: string[] = [];
    let primeiraBusca = true;
    db.one.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM kart.reserva_grupo WHERE origem')) {
        if (primeiraBusca) { primeiraBusca = false; return null; }
      }
      if (sql.includes('JOIN kart.reserva_grupo_piloto p ON p.grupo_id = g.id AND p.responsavel = true')) return { codigo: 'GTESTE', token: 'tok' };
      return { id: 1, Id: 1, c: 501 };
    });
    db.query.mockResolvedValue([]);
    db.tx.mockImplementation(async (cb: (run: (sql: string, p?: Record<string, unknown>) => Promise<unknown[]>) => Promise<unknown>) =>
      cb(async (sql: string) => {
        sqls.push(sql);
        if (sql.includes('INSERT INTO kart.reserva_grupo ')) return [{ id: 77 }];
        if (sql.includes('INSERT INTO kart.cliente')) return [{ id: 900 }];
        return [{ id: 1, Id: 1 }];
      }),
    );
    await grupoDaReservaOnline(
      { codigoReserva: 'BPQXHS', bateriaId: 616, responsavelId: 82510, inscricoes: [1, 2, 3], compradorPilota: true, precoCentavos: 14500, valorPagoCentavos: 14500 },
      () => undefined,
    );
    const pilotos = sqls.filter((s) => s.includes('INSERT INTO kart.reserva_grupo_piloto'));
    expect(pilotos.length).toBeGreaterThan(0);
    for (const s of pilotos) {
      const valores = s.slice(s.indexOf('VALUES'));
      // menor é a 5ª coluna: grupo_id, ordem, nome, telefone, MENOR
      expect(valores).not.toMatch(/VALUES \(@g, @o, NULL, NULL, [01],/);
    }
  });
});
