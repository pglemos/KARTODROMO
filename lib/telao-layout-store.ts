import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { getR2Json, hasR2Store, putR2Json } from '@/lib/r2-client';
import { DEFAULT_TELAO_LAYOUT, normalizeTelaoLayoutConfig, type TelaoLayoutConfig } from '@/lib/telao-layout-config';

const configPath = join(process.cwd(), '.runtime', 'telao-layout.json');
const blobPath = process.env.TELAO_LAYOUT_BLOB_PATH || 'telao-layout/current.json';

let memoryConfig: TelaoLayoutConfig = DEFAULT_TELAO_LAYOUT;
let lastBlobReadAt = 0;
let lastBlobReadFailedAt = 0;
let lastBlobWriteFailedAt = 0;

function hasBlobStore(): boolean {
  return hasR2Store();
}

export function readTelaoLayoutConfig(): TelaoLayoutConfig {
  try {
    if (!existsSync(configPath)) return memoryConfig;
    return normalizeTelaoLayoutConfig(JSON.parse(readFileSync(configPath, 'utf8')));
  } catch {
    return memoryConfig;
  }
}

export function writeTelaoLayoutConfigToFile(input: unknown): TelaoLayoutConfig {
  const config = normalizeTelaoLayoutConfig(input);
  memoryConfig = config;
  mkdirSync(dirname(configPath), { recursive: true });
  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
  return config;
}

export async function readTelaoLayoutConfigFromStore(): Promise<TelaoLayoutConfig> {
  if (hasBlobStore()) {
    try {
      const stored = await getR2Json<unknown>(blobPath);
      if (stored !== null) {
        const config = normalizeTelaoLayoutConfig(stored);
        memoryConfig = config;
        lastBlobReadAt = Date.now();
        return config;
      }
    } catch {
      lastBlobReadFailedAt = Date.now();
    }
  }

  return readTelaoLayoutConfig();
}

export async function readTelaoLayoutConfigFromRemote(): Promise<TelaoLayoutConfig> {
  const endpoint = process.env.TELAO_LAYOUT_REMOTE_ENDPOINT;
  if (!endpoint) return readTelaoLayoutConfigFromStore();

  const timeoutMs = Number(process.env.TELAO_LAYOUT_REMOTE_TIMEOUT_MS || '1500');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${endpoint}${endpoint.includes('?') ? '&' : '?'}_ts=${Date.now()}`, {
      cache: 'no-store',
      signal: controller.signal,
    });

    if (!response.ok) throw new Error(`Layout HTTP ${response.status}`);

    const data = await response.json();
    const config = normalizeTelaoLayoutConfig(data?.layout || data);
    memoryConfig = config;
    return config;
  } catch {
    return readTelaoLayoutConfigFromStore();
  } finally {
    clearTimeout(timeout);
  }
}

export type TelaoLayoutWriteResult = {
  layout: TelaoLayoutConfig;
  storage: 'blob' | 'file' | 'memory';
  persistent: boolean;
  error?: string;
};

export async function writeTelaoLayoutConfig(input: unknown): Promise<TelaoLayoutWriteResult> {
  const config = normalizeTelaoLayoutConfig(input);
  memoryConfig = config;

  if (hasBlobStore()) {
    try {
      await putR2Json(blobPath, config);

      lastBlobReadAt = Date.now();
      return { layout: config, storage: 'blob', persistent: true };
    } catch (error) {
      lastBlobWriteFailedAt = Date.now();
      if (process.env.NODE_ENV === 'production') {
        return {
          layout: config,
          storage: 'memory',
          persistent: false,
          error: error instanceof Error ? error.message : 'Blob write failed',
        };
      }
    }
  }

  try {
    mkdirSync(dirname(configPath), { recursive: true });
    writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
    return { layout: config, storage: 'file', persistent: true };
  } catch {
    // On read-only/serverless hosts the in-memory config still works until the instance is recycled.
  }

  return { layout: config, storage: 'memory', persistent: false };
}

export function telaoLayoutStoreStatus() {
  const storage = hasBlobStore() ? 'blob' : existsSync(configPath) ? 'file' : 'memory';

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
