import { beforeEach, describe, expect, it, vi } from 'vitest';

// Simulação de banco em memória para testar transações e concorrência
interface LinhaManutencao {
  id: number;
  kart: string;
  categoria: string;
  item: number;
  minutos: number;
  realizada: number;
  ultima: string | null;
}

interface LinhaCronoUso {
  id: number;
  sessaoId: string;
  agendaId: number | null;
  categoria: string;
  kart: string;
  minutos: number;
  payloadHash: string;
}

let tabelaManutencao: LinhaManutencao[] = [];
let tabelaCronoUso: LinhaCronoUso[] = [];
let failOnKart: string | null = null;
let proximoIdManutencao = 1;
let proximoIdCronoUso = 1;

const dbMock = vi.hoisted(() => ({
  one: vi.fn(),
  query: vi.fn(),
  tx: vi.fn(),
}));

vi.mock('../../lib/ops/db', () => ({
  one: dbMock.one,
  query: dbMock.query,
  tx: dbMock.tx,
}));

import { registrarUsoKarts, type UsoKartsPayload } from '../../lib/ops/uso-karts';
import { HttpError } from '../../lib/ops/office';

beforeEach(() => {
  tabelaManutencao = [
    { id: 1, kart: '4', categoria: 'Indoor', item: 1, minutos: 0, realizada: 0, ultima: null },
    { id: 2, kart: '5', categoria: 'Indoor', item: 1, minutos: 0, realizada: 0, ultima: null },
  ];
  tabelaCronoUso = [];
  failOnKart = null;
  proximoIdManutencao = 3;
  proximoIdCronoUso = 1;

  dbMock.one.mockImplementation(async (sqlText: string, params: Record<string, unknown> = {}) => {
    if (sqlText.includes('SELECT p.Categoria c FROM dbo.Bateria')) {
      if (params.id === 10) return { c: 'Indoor' };
      return null;
    }
    return null;
  });

  dbMock.query.mockImplementation(async () => []);

  dbMock.tx.mockImplementation(async (work: (run: (sqlText: string, params?: Record<string, unknown>) => Promise<Record<string, unknown>[]>) => Promise<unknown>) => {
    // Snapshot em memória para permitir rollback em caso de exceção na transação
    const snapshotManutencao = tabelaManutencao.map((m) => ({ ...m }));
    const snapshotCronoUso = tabelaCronoUso.map((c) => ({ ...c }));

    const run = async (sqlText: string, params: Record<string, unknown> = {}) => {
      // Falha injetada para teste de rollback
      if (failOnKart && params.kart === failOnKart) {
        throw new Error(`Falha injetada de banco para kart ${failOnKart}`);
      }

      if (sqlText.includes('FROM dbo.CronoUsoKarts')) {
        const found = tabelaCronoUso.filter((c) => c.sessaoId === params.sessaoId);
        return found.map((f) => ({
          id: f.id,
          categoria: f.categoria,
          kart: f.kart,
          minutos: f.minutos,
          payloadHash: f.payloadHash,
        }));
      }

      if (sqlText.includes('SELECT Id id, Categoria categoria, ItemId item, MinutosUso minutos')) {
        const num = Number(params.n);
        const rows = tabelaManutencao.filter((m) => Number(m.kart) === num);
        return rows.map((r) => ({
          id: r.id,
          categoria: r.categoria,
          item: r.item,
          minutos: r.minutos,
          ultima: r.ultima,
        }));
      }

      if (sqlText.includes('UPDATE dbo.Manutencao SET MinutosUso = MinutosUso + @m')) {
        const id = Number(params.id);
        const m = Number(params.m);
        const row = tabelaManutencao.find((r) => r.id === id);
        if (row) {
          row.minutos += m;
          row.realizada = 0;
        }
        return [];
      }

      if (sqlText.includes('INSERT dbo.Manutencao')) {
        const novo = {
          id: proximoIdManutencao++,
          kart: String(params.k),
          categoria: String(params.c),
          item: 1,
          minutos: Number(params.m),
          realizada: 0,
          ultima: null,
        };
        tabelaManutencao.push(novo);
        return [];
      }

      if (sqlText.includes('INSERT INTO dbo.CronoUsoKarts')) {
        // Simula restrição UNIQUE (SessaoId, Kart, Categoria)
        const dup = tabelaCronoUso.find(
          (c) => c.sessaoId === params.sessaoId && c.kart === params.kart && c.categoria === params.categoria
        );
        if (dup) {
          const err: any = new Error('Violation of UNIQUE KEY constraint');
          err.number = 2627;
          throw err;
        }
        tabelaCronoUso.push({
          id: proximoIdCronoUso++,
          sessaoId: String(params.sessaoId),
          agendaId: params.agendaId != null ? Number(params.agendaId) : null,
          categoria: String(params.categoria),
          kart: String(params.kart),
          minutos: Number(params.minutos),
          payloadHash: String(params.payloadHash),
        });
        return [];
      }

      return [];
    };

    try {
      const result = await work(run);
      return result;
    } catch (err) {
      // Rollback da transação restaura os snapshots
      tabelaManutencao = snapshotManutencao;
      tabelaCronoUso = snapshotCronoUso;
      throw err;
    }
  });
});

describe('Tarefa 5 [F04]: Uso SQL idempotente/transacional', () => {
  it('retry_mesma_sessao_nao_incrementa_novamente', async () => {
    const payload: UsoKartsPayload = {
      sessaoId: 'sess-abc-123',
      agendaId: 10,
      karts: [{ kart: '4', minutos: 10 }],
    };

    // 1º envio: deve aplicar e incrementar 10 minutos
    const res1 = await registrarUsoKarts(payload);
    expect(res1.ok).toBe(true);
    expect(res1.jaAplicado).toBe(false);
    expect(res1.somados).toBe(1);

    const kart4AposEnvio1 = tabelaManutencao.find((m) => m.kart === '4');
    expect(kart4AposEnvio1?.minutos).toBe(10);

    // 2º envio (retry da mesma sessão com mesmo payload): NÃO deve incrementar novamente
    const res2 = await registrarUsoKarts(payload);
    expect(res2.ok).toBe(true);
    expect(res2.jaAplicado).toBe(true);
    expect(res2.somados).toBe(0);

    const kart4AposEnvio2 = tabelaManutencao.find((m) => m.kart === '4');
    expect(kart4AposEnvio2?.minutos).toBe(10); // Permanece 10, não 20!

    // Duas requisições concorrentes da mesma sessão devem resultar em 1 lançamento
    const payload2: UsoKartsPayload = {
      sessaoId: 'sess-concorrente-999',
      agendaId: 10,
      karts: [{ kart: '4', minutos: 10 }],
    };

    const [paralelo1, paralelo2] = await Promise.all([
      registrarUsoKarts(payload2),
      registrarUsoKarts(payload2),
    ]);

    // Um deles aplica e o outro identifica que já foi aplicado
    expect([paralelo1.jaAplicado, paralelo2.jaAplicado]).toContain(true);
    expect([paralelo1.jaAplicado, paralelo2.jaAplicado]).toContain(false);
    // Kart 4 tinha 10 min, deve agora ter 20 (apenas +10 somados, não +20)
    expect(tabelaManutencao.find((m) => m.kart === '4')?.minutos).toBe(20);
  });

  it('falha_no_segundo_kart_reverte_tudo', async () => {
    const payload: UsoKartsPayload = {
      sessaoId: 'sess-falha-456',
      agendaId: 10,
      karts: [
        { kart: '4', minutos: 10 },
        { kart: '5', minutos: 15 },
      ],
    };

    // Injeta falha no banco de dados quando for gravar o kart 5
    failOnKart = '5';

    await expect(registrarUsoKarts(payload)).rejects.toThrow('Falha injetada de banco para kart 5');

    // NENHUM incremento parcial deve permanecer: kart 4 deve continuar com 0 minutos
    expect(tabelaManutencao.find((m) => m.kart === '4')?.minutos).toBe(0);
    expect(tabelaManutencao.find((m) => m.kart === '5')?.minutos).toBe(0);
    // Nenhum registro na tabela de deduplicação
    expect(tabelaCronoUso.filter((c) => c.sessaoId === 'sess-falha-456').length).toBe(0);
  });

  it('mudanca_de_payload_de_sessao_ja_aplicada_e_conflito', async () => {
    const payload: UsoKartsPayload = {
      sessaoId: 'sess-conflito-789',
      agendaId: 10,
      karts: [{ kart: '4', minutos: 10 }],
    };

    await registrarUsoKarts(payload);

    // Mesma sessão com payload alterado (minutos diferentes)
    const payloadAlterado: UsoKartsPayload = {
      sessaoId: 'sess-conflito-789',
      agendaId: 10,
      karts: [{ kart: '4', minutos: 15 }],
    };

    await expect(registrarUsoKarts(payloadAlterado)).rejects.toThrow(HttpError);
    await expect(registrarUsoKarts(payloadAlterado)).rejects.toMatchObject({
      status: 409,
    });
  });

  it('sessaoId_obrigatorio', async () => {
    await expect(registrarUsoKarts({} as UsoKartsPayload)).rejects.toMatchObject({
      status: 400,
    });
    await expect(registrarUsoKarts({ sessaoId: '   ' } as UsoKartsPayload)).rejects.toMatchObject({
      status: 400,
    });
  });
});
