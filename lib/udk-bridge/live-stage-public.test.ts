import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchPublicStageSnapshot } from './live-stage-public';

const snapshot = {
  stageId: 'stage-1',
  title: 'Etapa Ultras',
  source: 'LapTime' as const,
  provisional: true,
  complete: false,
  points: { baseWinnerPerRace: 50 as const, baseMaximum: 100 as const, positionPoints: { '1': 50 }, pole: 1, fastestLap: 1 },
  unresolved: [],
  heats: [],
  categories: [],
};

describe('leitura pública do snapshot Ultras', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('envia somente a chave pública e normaliza a linha persistida', async () => {
    vi.stubEnv('UDK_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('UDK_PUBLIC_ANON_KEY', 'public-key');
    vi.stubEnv('UDK_SERVICE_ROLE_KEY', '');
    let requestUrl = '';

    const result = await fetchPublicStageSnapshot('stage-1', async (input, init) => {
      requestUrl = String(input);
      expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer public-key');
      return new Response(JSON.stringify([{ stage_id: 'stage-1', captured_at: '2026-09-08T21:00:00.000Z', payload: snapshot }]));
    });

    expect(requestUrl).toContain('live_stage_snapshots');
    expect(result).toMatchObject({ ...snapshot, capturedAt: '2026-09-08T21:00:00.000Z', updatedAt: '2026-09-08T21:00:00.000Z' });
  });

  it('transforma tabela ausente em erro operacional explícito', async () => {
    vi.stubEnv('UDK_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('UDK_PUBLIC_ANON_KEY', 'public-key');
    await expect(fetchPublicStageSnapshot('stage-1', async () => new Response('', { status: 404 }))).rejects.toMatchObject({
      code: 'snapshot_store_missing',
      status: 503,
    });
  });
});
