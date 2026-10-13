import { describe, expect, it, vi } from 'vitest';
import { canonicalizeTimingTracks, syncTimingTracks } from '../../lib/ops/tracado-sync';

describe('sincronização dos traçados da cronometragem', () => {
  it('mantém somente traçados válidos, ativos e com nomes únicos', () => {
    expect(canonicalizeTimingTracks([
      { id: 'b', name: 'Traçado 2 Normal', lengthMeters: 871 },
      { id: 'duplicado', name: ' Traçado 2 Normal ', lengthMeters: 871, active: true },
      { id: 'inativo', name: 'Traçado 9 Normal', lengthMeters: 500, active: false },
      { id: 'ruim', name: 'sem medida', lengthMeters: 0 },
      { id: 'a', name: 'Traçado 1 Invertido', lengthMeters: 1100 },
    ])).toEqual([
      { id: 'a', name: 'Traçado 1 Invertido', lengthMeters: 1100, active: true },
      { id: 'b', name: 'Traçado 2 Normal', lengthMeters: 871, active: true },
    ]);
  });

  it('cria e atualiza o espelho local sem apagar traçados históricos', async () => {
    const queryMock = vi.fn(async (sql: string) => {
      if (sql.includes('SELECT Id id, TimingTrackId timingId')) {
        return [{ id: 10, timingId: 'old' }];
      }
      if (sql.includes('SELECT Id id, Nome nome, Comprimento comprimento')) {
        return [{ id: 1, nome: 'Traçado 1', comprimento: 1100 }];
      }
      return [];
    });
    const oneMock = vi.fn(async () => ({ id: 22 }));
    const query = queryMock as unknown as <T = Record<string, unknown>>(sql: string, params?: Record<string, unknown>) => Promise<T[]>;
    const one = oneMock as unknown as <T = Record<string, unknown>>(sql: string, params?: Record<string, unknown>) => Promise<T | null>;
    const fetcher = vi.fn(async () => new Response(JSON.stringify([
      { id: 'old', name: 'Traçado 2 Normal', lengthMeters: 871, active: true },
      { id: 'new', name: 'Traçado 2 Invertido', lengthMeters: 871, active: true },
      { id: 'normal', name: 'Traçado 1 Normal', lengthMeters: 1100, active: true },
    ]), { status: 200, headers: { 'content-type': 'application/json' } }));

    const tracks = await syncTimingTracks({ timingUrl: 'http://crono.test', query, one, fetcher });

    expect(tracks.map((track) => track.name)).toEqual(['Traçado 1 Normal', 'Traçado 2 Invertido', 'Traçado 2 Normal']);
    expect(queryMock).toHaveBeenCalledWith(expect.stringContaining('ALTER TABLE dbo.Tracado'));
    expect(queryMock).toHaveBeenCalledWith(expect.stringContaining('UPDATE dbo.Tracado SET Nome'), expect.objectContaining({ id: 10, nome: 'Traçado 2 Normal' }));
    expect(oneMock).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO dbo.Tracado'), expect.objectContaining({ timingId: 'new' }));
    expect(queryMock).toHaveBeenCalledWith(expect.stringContaining('UPDATE dbo.Bateria SET TracadoId'), expect.objectContaining({ novo: 22, antigo: 1 }));
    expect(queryMock).not.toHaveBeenCalledWith(expect.stringContaining('DELETE FROM dbo.Tracado'), expect.anything());
  });
});
