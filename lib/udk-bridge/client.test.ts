import { describe, expect, it } from 'vitest';
import { UdkClient } from '@/lib/udk-bridge/client';
import type { UdkResultDraft, UdkResultEntryDraft } from '@/lib/udk-bridge/types';

type Row = Record<string, unknown>;
type TableState = Row[];

type Chain = {
  select: (cols: string) => Chain;
  eq: (col: string, value: unknown) => Chain;
  is: (col: string, value: unknown) => Chain;
  in: (col: string, values: unknown[]) => Chain;
  order: (col: string, opts?: Record<string, unknown>) => Chain;
  limit: (n: number) => Chain;
  insert: (row: Row) => Chain;
  update: (row: Row) => Chain;
  single: () => Promise<{ data: Row | null; error: null }>;
  then: unknown;
  [Symbol.toStringTag]: string;
};

function createMockSupabase() {
  const state: Record<string, TableState> = {
    results: [],
    result_entries: [],
    import_batches: [],
    drivers: [],
  };
  const calls: Array<{ table: string; kind: 'select' | 'insert' | 'update'; cols?: string; row?: Row; filters: Row }> = [];

  const chain = (table: string, kind: 'select' | 'insert' | 'update', initialRow?: Row): Chain => {
    const call: { table: string; kind: 'select' | 'insert' | 'update'; cols?: string; row?: Row; filters: Row } = {
      table,
      kind,
      filters: {} as Row,
      row: initialRow,
    };
    calls.push(call);

    const c: Chain = {
      select: (cols: string) => {
        call.cols = cols;
        return c;
      },
      eq: (col, value) => {
        call.filters[col] = value;
        return c;
      },
      is: (col, value) => {
        call.filters[`is:${col}`] = value;
        return c;
      },
      in: (col, values) => {
        call.filters[`in:${col}`] = values;
        return c;
      },
      order: () => c,
      limit: () => c,
      insert: (row: Row) => chain(table, 'insert', row),
      update: (row: Row) => chain(table, 'update', row),
      single: async () => {
        const rows = run();
        const row = rows[0] ?? null;
        return { data: row, error: null };
      },
      then: undefined,
      [Symbol.toStringTag]: 'Chain',
    };

    const matches = (row: Row): boolean =>
      Object.entries(call.filters).every(([col, value]) => {
        if (col.startsWith('is:')) return row[col.slice(3)] == null === (value === null);
        if (col.startsWith('in:')) return (value as unknown[]).includes(row[col.slice(3)]);
        return row[col] === value;
      });

    const run = (): Row[] => {
      const tableState = state[table];
      if (call.kind === 'select') {
        return tableState.filter(matches);
      }
      if (call.kind === 'insert') {
        const row = { id: `id-${tableState.length + 1}-${Math.random().toString(36).slice(2, 7)}`, ...(call.row || {}) };
        tableState.push(row);
        return [row];
      }
      if (call.kind === 'update') {
        const updated: Row[] = [];
        for (const row of tableState) {
          if (matches(row)) {
            Object.assign(row, call.row || {});
            updated.push(row);
          }
        }
        return updated;
      }
      return [];
    };

    // Promessa de execução: `.single()` e o padrão await `.from(...)...` precisam
    // de um objeto thenable. O Supabase real devolve Promise-like; simulamos
    // executando a consulta ao aguardar (sem `.single()`).
    const thenable = (resolve: (value: { data: Row[]; error: null }) => void): void => {
      resolve({ data: run(), error: null });
    };
    Object.defineProperty(c, 'then', { value: thenable, enumerable: false });

    return c;
  };

  return {
    client: { from: (table: string) => chain(table, 'select') } as never,
    state,
    calls,
  };
}

const draftPayload: UdkResultDraft = {
  stage_id: 'stage-1',
  session_id: 'session-1',
  category_id: null,
  title: 'ULTRAS I - FINAL',
  status: 'draft',
  version: 1,
  source_system: 'laptime',
  external_racing_id: 627099,
  external_imported_at: '2026-08-18T20:00:00.000Z',
  fastest_lap_ms: 81662,
};

const entry: UdkResultEntryDraft = {
  driver_id: 'driver-78',
  position: 1,
  kart_number: 78,
  laps: 14,
  total_time_ms: 1199146,
  best_lap_ms: 81662,
  status: 'classified',
  external_competitor_id: 864437,
};

function makeUdk(client: never): UdkClient {
  return new UdkClient({ client });
}

describe('UdkClient.upsertResultDraft', () => {
  it('cria resultado DRAFT quando não existe', async () => {
    const { client, state } = createMockSupabase();
    const udk = makeUdk(client);

    const outcome = await udk.upsertResultDraft(draftPayload);
    expect(outcome.kind).toBe('created');
    expect(state.results).toHaveLength(1);
    expect(state.results[0].status).toBe('draft');
    expect(state.results[0].source_system).toBe('laptime');
    expect(state.results[0].external_racing_id).toBe(627099);
  });

  it('atualiza (não duplica) quando o resultado já foi importado', async () => {
    const { client, state } = createMockSupabase();
    const udk = makeUdk(client);

    await udk.upsertResultDraft(draftPayload);
    const first = state.results[0];

    const outcome = await udk.upsertResultDraft({ ...draftPayload, title: 'ULTRAS I - FINAL (atualizado)' });
    expect(outcome.kind).toBe('updated');
    expect(state.results).toHaveLength(1);
    expect(state.results[0].id).toBe(first.id);
    expect(state.results[0].title).toBe('ULTRAS I - FINAL (atualizado)');
  });
});

describe('UdkClient.syncEntries', () => {
  it('insere entradas com piloto mapeado por kart', async () => {
    const { client, state } = createMockSupabase();
    const udk = makeUdk(client);

    const sync = await udk.syncEntries('result-1', [entry], new Map([[78, 'driver-78']]));
    expect(sync.inserted).toBe(1);
    expect(sync.updated).toBe(0);
    expect(sync.unmatched).toBe(0);
    expect(state.result_entries).toHaveLength(1);
    expect(state.result_entries[0].driver_id).toBe('driver-78');
    expect(state.result_entries[0].external_competitor_id).toBe(864437);
    expect(state.result_entries[0].result_id).toBe('result-1');
  });

  it('registra unmatched quando não há piloto UDK com o kart', async () => {
    const { client, state } = createMockSupabase();
    const udk = makeUdk(client);

    const sync = await udk.syncEntries('result-1', [{ ...entry, driver_id: '' }], new Map());
    expect(sync.inserted).toBe(0);
    expect(sync.unmatched).toBe(1);
    expect(state.result_entries).toHaveLength(0);
  });

  it('atualiza entrada existente pelo external_competitor_id (idempotência)', async () => {
    const { client, state } = createMockSupabase();
    const udk = makeUdk(client);

    await udk.syncEntries('result-1', [entry], new Map([[78, 'driver-78']]));
    await udk.syncEntries('result-1', [{ ...entry, laps: 15 }], new Map([[78, 'driver-78']]));
    expect(state.result_entries).toHaveLength(1);
    expect(state.result_entries[0].laps).toBe(15);
  });
});

describe('UdkClient.findResultByExternalRacing', () => {
  it('retorna resultado existente com a versão', async () => {
    const { client, state } = createMockSupabase();
    const udk = makeUdk(client);

    state.results.push({ id: 'r1', version: 3, source_system: 'laptime', external_racing_id: 627099, deleted_at: null });
    const found = await udk.findResultByExternalRacing(627099);
    expect(found).toEqual({ id: 'r1', version: 3 });
  });

  it('retorna null quando não existe', async () => {
    const { client } = createMockSupabase();
    const udk = makeUdk(client);
    expect(await udk.findResultByExternalRacing(999)).toBeNull();
  });
});

describe('UdkClient.listDrivers', () => {
  it('mapeia pilotos ativos por número do kart', async () => {
    const { client, state } = createMockSupabase();
    const udk = makeUdk(client);

    state.drivers.push(
      { id: 'd-7', number: 7, season_id: 'season', status: 'approved', deleted_at: null },
      { id: 'd-44', number: 44, season_id: 'season', status: 'approved', deleted_at: null },
      { id: 'd-arq', number: 56, season_id: 'season', status: 'approved', deleted_at: '2026-08-18T21:44:00Z' },
    );

    const map = await udk.listDrivers({ championshipId: 'champ', seasonId: 'season', categoryMapping: {}, stages: {} });
    expect(map.size).toBe(2);
    expect(map.get(7)).toBe('d-7');
    expect(map.get(44)).toBe('d-44');
  });
});

describe('UdkClient.createImportBatch', () => {
  it('cria batch com source laptime', async () => {
    const { client, state } = createMockSupabase();
    const udk = makeUdk(client);

    const batchId = await udk.createImportBatch({
      stage_id: 'stage-1',
      source: 'laptime',
      status: 'imported',
      confidence: 1,
      diagnostics: { racingId: 627099 },
    });
    expect(batchId).toBeTruthy();
    expect(state.import_batches).toHaveLength(1);
    expect(state.import_batches[0].source).toBe('laptime');
  });
});

describe('UdkClient.syncRace', () => {
  it('cria resultado, entradas e batch no mesmo fluxo', async () => {
    const { client, state } = createMockSupabase();
    const udk = makeUdk(client);

    const outcome = await udk.syncRace(627099, draftPayload, [entry], new Map([[78, 'driver-78']]), {
      racingId: 627099,
      confidence: 1,
    });
    expect(outcome.result.kind).toBe('created');
    expect(state.results).toHaveLength(1);
    expect(state.result_entries).toHaveLength(1);
    expect(state.import_batches).toHaveLength(1);
  });

  it('não duplica entradas nem batches na reimportação (idempotência total)', async () => {
    const { client, state } = createMockSupabase();
    const udk = makeUdk(client);

    await udk.syncRace(627099, draftPayload, [entry], new Map([[78, 'driver-78']]), { racingId: 627099 });
    const outcome = await udk.syncRace(627099, draftPayload, [entry], new Map([[78, 'driver-78']]), { racingId: 627099 });

    expect(outcome.result.kind).toBe('updated');
    expect(state.results).toHaveLength(1);
    expect(state.result_entries).toHaveLength(1);
    expect(state.import_batches).toHaveLength(2); // cada ciclo audita um batch
  });
});