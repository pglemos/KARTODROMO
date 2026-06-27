import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { getR2Json, hasR2Store, putR2Json } from '@/lib/r2-client';

export type Tb50DisplayMode = 'live' | 'final-real' | 'final-demo';

export type Tb50DisplayModeState = {
  mode: Tb50DisplayMode;
  updatedAt: string | null;
  persistent: boolean;
};

const statePath = join(process.cwd(), '.runtime', 'tb50-display-mode.json');
const blobPath = process.env.TB50_DISPLAY_MODE_BLOB_PATH || 'tb50-display-mode/current.json';
let memoryState: Tb50DisplayModeState = {
  mode: 'live',
  updatedAt: null,
  persistent: false,
};
let lastBlobReadAt = 0;
let lastBlobReadFailedAt = 0;
let lastBlobWriteFailedAt = 0;

function hasBlobStore(): boolean {
  return hasR2Store();
}

function normalizeMode(value: unknown): Tb50DisplayMode {
  return value === 'final-real' || value === 'final-demo' || value === 'live' ? value : 'live';
}

function normalizeState(value: unknown, persistent: boolean): Tb50DisplayModeState {
  const input = value && typeof value === 'object' ? (value as Partial<Tb50DisplayModeState>) : {};

  return {
    mode: normalizeMode(input.mode),
    updatedAt: typeof input.updatedAt === 'string' ? input.updatedAt : null,
    persistent,
  };
}

export function readTb50DisplayMode(): Tb50DisplayModeState {
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

export async function readTb50DisplayModeFromStore(): Promise<Tb50DisplayModeState> {
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

  return readTb50DisplayMode();
}

export async function writeTb50DisplayMode(mode: unknown): Promise<Tb50DisplayModeState> {
  const state: Tb50DisplayModeState = {
    mode: normalizeMode(mode),
    updatedAt: new Date().toISOString(),
    persistent: false,
  };

  memoryState = state;

  if (hasBlobStore()) {
    try {
      await putR2Json(blobPath, { mode: state.mode, updatedAt: state.updatedAt });

      lastBlobReadAt = Date.now();
      memoryState = { ...state, persistent: true };
      return memoryState;
    } catch {
      lastBlobWriteFailedAt = Date.now();
    }
  }

  try {
    mkdirSync(dirname(statePath), { recursive: true });
    writeFileSync(statePath, JSON.stringify({ mode: state.mode, updatedAt: state.updatedAt }, null, 2));
    memoryState = { ...state, persistent: true };
  } catch {
    memoryState = state;
  }

  return memoryState;
}

export function tb50DisplayModeStoreStatus() {
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
