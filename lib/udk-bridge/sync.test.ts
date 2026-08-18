import { describe, expect, it, vi } from 'vitest';
import { syncFinishedUltrasToUdk } from '@/lib/udk-bridge/sync';
import type { UdkClient } from '@/lib/udk-bridge/client';
import type { UdkBridgeConfig } from '@/lib/udk-bridge/types';

const config: UdkBridgeConfig = {
  championshipId: 'champ',
  seasonId: 'season',
  categoryMapping: {},
  stages: {
    stage1: [{ sessionId: 'session1', name: 'Corrida 1', kind: 'race' }],
  },
};

const sqlSource = {
  server: 'localhost',
  database: 'LapTimeMirror',
  user: 'u',
  password: 'p',
  instanceName: 'SQLEXPRESS',
  timeoutMs: 5000,
};

function makeUdkMock(overrides: Partial<UdkClient> = {}): UdkClient {
  return {
    listDrivers: vi.fn(async () => new Map([[78, 'driver-78']])),
    syncRace: vi.fn(async () => ({
      racingId: 627099,
      result: { kind: 'created' as const, resultId: 'result-1' },
      batchId: 'batch-1',
    })),
    ...overrides,
  } as unknown as UdkClient;
}

// Stub do leitor SQL: retorna corridas fake que já passaram no filtro.
vi.mock('@/lib/udk-bridge/laptime-reader', () => ({
  fetchFinishedUltrasRacings: vi.fn(async () => [
    {
      racing: {
        Id_Racing: 627099,
        RacingState: 5,
        Name: 'CORRIDA',
        Id_RacingType: 4,
        RacingTypeName: 'Corrida',
        Id_RacingGroup: 220296,
        RacingGroupName: 'ULTRAS I - FINAL',
        Id_RacingEvent: 380462,
        RacingEventName: 'Baterias 18/08/2026',
      },
      competitors: [
        {
          Id_RacingCompetitor: 1,
          Id_Racing: 627099,
          Number: '78',
          Competitor: 'Cristiano Miranda',
          Pos: 1,
          Lap: 14,
          BestLapTime: new Date('1970-01-01T00:01:21.662Z'),
          TotalTime: new Date('2026-08-18T00:19:59.146Z'),
          RacingStatus: 0,
          IsHidden: false,
        },
      ],
      finishedByFlag: true,
    },
  ]),
}));

describe('syncFinishedUltrasToUdk', () => {
  it('importa corrida ULTRAS finalizada como DRAFT', async () => {
    const udk = makeUdkMock();
    const result = await syncFinishedUltrasToUdk({ sqlSource, config, udk });
    expect(result.scanned).toBe(1);
    expect(result.imported).toBe(1);
    expect(result.skipped).toBe(0);
    expect(udk.syncRace).toHaveBeenCalledOnce();
    const payload = vi.mocked(udk.syncRace).mock.calls[0][1];
    expect(payload.status).toBe('draft');
    expect(payload.source_system).toBe('laptime');
    expect(payload.external_racing_id).toBe(627099);
  });

  it('registra falha sem abortar o ciclo', async () => {
    const udk = makeUdkMock({
      syncRace: vi.fn(async () => {
        throw new Error('supabase timeout');
      }),
    });
    const result = await syncFinishedUltrasToUdk({ sqlSource, config, udk });
    expect(result.imported).toBe(0);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0].racingId).toBe(627099);
  });

  it('usa o filtro com allowTextOnly', async () => {
    const udk = makeUdkMock();
    const result = await syncFinishedUltrasToUdk({ sqlSource, config, udk, filter: { allowTextOnly: true } });
    expect(result.imported).toBe(1);
  });
});