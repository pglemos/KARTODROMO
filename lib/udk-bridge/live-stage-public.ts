import type { StageSnapshot } from './live-stage';

export type PublicStageSnapshot = StageSnapshot & {
  capturedAt: string;
  updatedAt: string;
};

type StoredSnapshotRow = {
  stage_id: string;
  captured_at: string;
  updated_at?: string | null;
  payload: unknown;
};

export class StageSnapshotReadError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, status: number, message: string) {
    super(message);
    this.name = 'StageSnapshotReadError';
    this.code = code;
    this.status = status;
  }
}

function configuredSupabase(): { url: string; apiKey: string } {
  const url = process.env.UDK_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const publicKey =
    process.env.UDK_PUBLIC_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY;
  const serverKey = process.env.UDK_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  const apiKey = serverKey || publicKey;

  if (!url || !apiKey) {
    throw new StageSnapshotReadError(
      'public_snapshot_not_configured',
      503,
      'A leitura pública da etapa Ultras ainda não foi configurada.',
    );
  }

  return { url: url.replace(/\/$/, ''), apiKey };
}

function isStageSnapshot(value: unknown): value is StageSnapshot {
  if (!value || typeof value !== 'object') return false;
  const snapshot = value as Partial<StageSnapshot>;
  return (
    typeof snapshot.stageId === 'string' &&
    snapshot.source === 'LapTime' &&
    typeof snapshot.complete === 'boolean' &&
    typeof snapshot.provisional === 'boolean' &&
    Array.isArray(snapshot.heats) &&
    Array.isArray(snapshot.categories) &&
    Array.isArray(snapshot.unresolved)
  );
}

export async function fetchPublicStageSnapshot(
  stageId: string,
  fetcher: typeof fetch = fetch,
): Promise<PublicStageSnapshot> {
  const { url, apiKey } = configuredSupabase();
  const endpoint = new URL(`${url}/rest/v1/live_stage_snapshots`);
  endpoint.searchParams.set('select', 'stage_id,captured_at,updated_at,payload');
  endpoint.searchParams.set('stage_id', `eq.${stageId}`);
  endpoint.searchParams.set('limit', '1');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    let response: Response;
    try {
      response = await fetcher(endpoint, {
        cache: 'no-store',
        headers: {
          // This key is used only inside this server route and is never
          // returned to the browser. A public key can be supplied through
          // UDK_PUBLIC_ANON_KEY when the deployment has one available.
          apikey: apiKey,
          Authorization: `Bearer ${apiKey}`,
        },
        signal: controller.signal,
      });
    } catch {
      throw new StageSnapshotReadError('public_snapshot_unreachable', 503, 'O resultado Ultras está temporariamente indisponível.');
    }

    if (response.status === 404) {
      throw new StageSnapshotReadError(
        'snapshot_store_missing',
        503,
        'A persistência pública da etapa Ultras ainda não foi aplicada no UDK.',
      );
    }
    if (!response.ok) {
      throw new StageSnapshotReadError('public_snapshot_query_failed', 502, 'Não foi possível ler o resultado Ultras no UDK.');
    }

    const rows = (await response.json().catch(() => null)) as unknown;
    const row = Array.isArray(rows) ? (rows[0] as StoredSnapshotRow | undefined) : undefined;
    if (!row) {
      throw new StageSnapshotReadError('snapshot_not_available', 404, 'Aguardando o primeiro snapshot da etapa Ultras.');
    }
    if (!isStageSnapshot(row.payload) || row.payload.stageId !== stageId) {
      throw new StageSnapshotReadError('snapshot_invalid', 502, 'O snapshot da etapa Ultras está inconsistente.');
    }

    return {
      ...row.payload,
      capturedAt: row.captured_at,
      updatedAt: row.updated_at || row.captured_at,
    };
  } finally {
    clearTimeout(timeout);
  }
}
