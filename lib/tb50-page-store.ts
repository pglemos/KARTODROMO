import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { getR2Json, hasR2Store, putR2Json } from '@/lib/r2-client';

export type Tb50PageState = {
  offset: number;
  updatedAt: string | null;
  persistent: boolean;
};

const PAGE_STEP = 10;
const MAX_OFFSET = 90;
const statePath = join(process.cwd(), '.runtime', 'tb50-page.json');
const blobPath = process.env.TB50_PAGE_BLOB_PATH || 'tb50-page/current.json';

let memoryState: Tb50PageState = {
  offset: 0,
  updatedAt: null,
  persistent: false,
};
let lastBlobReadAt = 0;
let lastBlobReadFailedAt = 0;
let lastBlobWriteFailedAt = 0;

function hasBlobStore(): boolean {
  return hasR2Store();
}

function pageRemoteEndpoint(): string | undefined {
  if (process.env.TB50_PAGE_REMOTE_ENDPOINT) return process.env.TB50_PAGE_REMOTE_ENDPOINT;
  const layoutEndpoint = process.env.TELAO_LAYOUT_REMOTE_ENDPOINT;
  if (!layoutEndpoint) return undefined;
  return layoutEndpoint
    .replace('/api/telao-layout-local', '/api/tb50-page-local')
    .replace('/api/telao-layout', '/api/tb50-page');
}

function normalizeOffset(value: unknown): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  const stepped = Math.floor(Math.max(0, numeric) / PAGE_STEP) * PAGE_STEP;
  return Math.min(stepped, MAX_OFFSET);
}

function normalizeState(value: unknown, persistent: boolean): Tb50PageState {
  const input = value && typeof value === 'object' ? (value as Partial<Tb50PageState>) : {};

  return {
    offset: normalizeOffset(input.offset),
    updatedAt: typeof input.updatedAt === 'string' ? input.updatedAt : null,
    persistent,
  };
}

export function readTb50Page(): Tb50PageState {
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

export function writeTb50PageToFile(offset: unknown): Tb50PageState {
  const state: Tb50PageState = {
    offset: normalizeOffset(offset),
    updatedAt: new Date().toISOString(),
    persistent: true,
  };

  memoryState = state;
  mkdirSync(dirname(statePath), { recursive: true });
  writeFileSync(statePath, JSON.stringify({ offset: state.offset, updatedAt: state.updatedAt }, null, 2));
  return state;
}

export async function readTb50PageFromStore(): Promise<Tb50PageState> {
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

  return readTb50Page();
}

export async function readTb50PageFromRemote(): Promise<Tb50PageState> {
  const endpoint = pageRemoteEndpoint();
  if (!endpoint) return readTb50PageFromStore();

  const timeoutMs = Number(process.env.TB50_PAGE_REMOTE_TIMEOUT_MS || process.env.TELAO_LAYOUT_REMOTE_TIMEOUT_MS || '1500');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${endpoint}${endpoint.includes('?') ? '&' : '?'}_ts=${Date.now()}`, {
      cache: 'no-store',
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Page HTTP ${response.status}`);
    const data = await response.json();
    const state = normalizeState(data?.page || data, true);
    memoryState = state;
    return state;
  } catch {
    return readTb50PageFromStore();
  } finally {
    clearTimeout(timeout);
  }
}

export async function writeTb50Page(offset: unknown): Promise<Tb50PageState> {
  const state: Tb50PageState = {
    offset: normalizeOffset(offset),
    updatedAt: new Date().toISOString(),
    persistent: false,
  };

  memoryState = state;

  if (hasBlobStore()) {
    try {
      await putR2Json(blobPath, { offset: state.offset, updatedAt: state.updatedAt });

      lastBlobReadAt = Date.now();
      memoryState = { ...state, persistent: true };
      return memoryState;
    } catch {
      lastBlobWriteFailedAt = Date.now();
    }
  }

  try {
    mkdirSync(dirname(statePath), { recursive: true });
    writeFileSync(statePath, JSON.stringify({ offset: state.offset, updatedAt: state.updatedAt }, null, 2));
    memoryState = { ...state, persistent: true };
  } catch {
    memoryState = state;
  }

  return memoryState;
}

export async function writeTb50PageRemote(offset: unknown): Promise<Tb50PageState & { remote?: boolean }> {
  const endpoint = pageRemoteEndpoint();
  if (!endpoint) return writeTb50Page(offset);

  try {
    const response = await fetch(endpoint, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ offset }),
      cache: 'no-store',
    });
    if (!response.ok) throw new Error(`Page HTTP ${response.status}`);
    const data = await response.json();
    const state = normalizeState(data?.page || data, true);
    memoryState = state;
    return { ...state, remote: true };
  } catch {
    return writeTb50Page(offset);
  }
}

export function tb50PageStoreStatus() {
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
