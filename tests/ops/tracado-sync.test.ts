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
      if (sql.includes('select id, timing_track_id "timingId"')) {
        return [{ id: 10, timingId: 'old' }];
      }
      if (sql.includes('select id, nome, comprimento from kart.tracado')) {
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
    // no Postgres a coluna timing_track_id vem da migration: nada de DDL em tempo de execução
    expect(queryMock).not.toHaveBeenCalledWith(expect.stringMatching(/alter table/i));
    expect(queryMock).toHaveBeenCalledWith(expect.stringContaining('update kart.tracado set nome'), expect.objectContaining({ id: 10, nome: 'Traçado 2 Normal' }));
    expect(oneMock).toHaveBeenCalledWith(expect.stringContaining('insert into kart.tracado'), expect.objectContaining({ timingId: 'new' }));
    expect(queryMock).toHaveBeenCalledWith(expect.stringContaining('update kart.bateria set tracado_id'), expect.objectContaining({ novo: 22, antigo: 1 }));
    expect(queryMock).not.toHaveBeenCalledWith(expect.stringMatching(/delete from kart\.tracado/i), expect.anything());
  });
});
