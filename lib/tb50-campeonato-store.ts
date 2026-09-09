import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { getR2Json, hasR2Store, putR2Json } from '@/lib/r2-client';

export type Tb50CampeonatoState = {
  campeonato_id: string | null;
  updatedAt: string | null;
  persistent: boolean;
};

const statePath = join(process.cwd(), '.runtime', 'tb50-campeonato.json');
const blobPath = process.env.TB50_CAMPEONATO_BLOB_PATH || 'tb50-campeonato/current.json';

let memoryState: Tb50CampeonatoState = {
  campeonato_id: null,
  updatedAt: null,
  persistent: false,
};
let lastBlobReadAt = 0;
let lastBlobReadFailedAt = 0;
let lastBlobWriteFailedAt = 0;

function hasBlobStore(): boolean {
  return hasR2Store();
}

function normalizeState(value: unknown, persistent: boolean): Tb50CampeonatoState {
  const input = value && typeof value === 'object' ? (value as Partial<Tb50CampeonatoState>) : {};

  return {
    campeonato_id: typeof input.campeonato_id === 'string' ? input.campeonato_id : null,
    updatedAt: typeof input.updatedAt === 'string' ? input.updatedAt : null,
    persistent,
  };
}

export function readTb50Campeonato(): Tb50CampeonatoState {
  if (existsSync(statePath)) {
    try {
      const state = normalizeState(JSON.parse(readFileSync(statePath, 'utf8')), true);
      memoryState = state;
      return state;
    } catch {
      return memoryState;
    }
  }

  return memoryState;
}

export async function readTb50CampeonatoFromStore(): Promise<Tb50CampeonatoState> {
  if (hasBlobStore()) {
    try {
      const stored = await getR2Json<unknown>(blobPath);
      if (stored !== null) {
        const state = normalizeState(stored, true);
        memoryState = state;
        lastBlobReadAt = Date.now();
        return { ...state, persistent: true };
      }
    } catch {
      lastBlobReadFailedAt = Date.now();
    }
  }

  return readTb50Campeonato();
}

export async function writeTb50Campeonato(input: unknown): Promise<Tb50CampeonatoState> {
  const current = readTb50Campeonato();
  const patch: Record<string, unknown> =
    typeof input === 'string'
      ? { campeonato_id: input }
      : input && typeof input === 'object'
        ? (input as Record<string, unknown>)
        : {};

  const state: Tb50CampeonatoState = {
    campeonato_id: patch.campeonato_id !== undefined ? (patch.campeonato_id as string | null) : current.campeonato_id,
    updatedAt: new Date().toISOString(),
    persistent: false,
  };

  memoryState = state;
  const payload = JSON.stringify({ campeonato_id: state.campeonato_id, updatedAt: state.updatedAt }, null, 2);

  if (hasBlobStore()) {
    try {
      await putR2Json(blobPath, { campeonato_id: state.campeonato_id, updatedAt: state.updatedAt });

      lastBlobReadAt = Date.now();
      memoryState = { ...state, persistent: true };
      return memoryState;
    } catch {
      lastBlobWriteFailedAt = Date.now();
    }
  }

  try {
    mkdirSync(dirname(statePath), { recursive: true });
    writeFileSync(statePath, payload);
    memoryState = { ...state, persistent: true };
  } catch {
    memoryState = state;
  }

  return memoryState;
}

export function tb50CampeonatoStoreStatus() {
  const storage = hasBlobStore() ? 'blob' : existsSync(statePath) ? 'file' : 'memory';

  return {
    storage,
    persistent: storage === 'blob' || storage === 'file',
    blobConfigured: hasBlobStore(),
    blobPath,
    lastBlobReadAt: lastBlobReadAt ? new Date(lastBlobReadAt).toISOString() : null,
    lastBlobReadFailedAt: lastBlobReadFailedAt ? new Date(lastBlobReadFailedAt).toISOString() : null,
    lastBlobWriteFailedAt: lastBlobWriteFailedAt ? new Date(lastBlobWriteFailedAt).toISOString() : null,
  };
}