import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { get, put } from '@vercel/blob';

export type TelaoPlaylistItemType = 'scoreboard' | 'image' | 'video' | 'youtube' | 'stream' | 'web';

export type TelaoPlaylistSchedule = {
  startTime?: string; // "HH:mm" (inclusive)
  endTime?: string; // "HH:mm" (exclusive)
  weekdays?: number[]; // 0=domingo .. 6=sabado; vazio/ausente = todos
  dateStart?: string; // "YYYY-MM-DD"
  dateEnd?: string; // "YYYY-MM-DD"
};

export type TelaoPlaylistItem = {
  id: string;
  type: TelaoPlaylistItemType;
  title?: string;
  source: string; // URL (youtube/stream/web) ou caminho/URL da midia local (imagem/video)
  durationSec: number; // duracao de exibicao
  repeat: number; // quantas vezes repete por rodada
  enabled: boolean;
  schedule?: TelaoPlaylistSchedule;
};

export type TelaoPlaylistState = {
  items: TelaoPlaylistItem[];
  updatedAt: string | null;
  persistent: boolean;
};

const ALLOWED_TYPES: readonly TelaoPlaylistItemType[] = [
  'scoreboard',
  'image',
  'video',
  'youtube',
  'stream',
  'web',
];

const statePath = join(process.cwd(), '.runtime', 'telao-playlist.json');
const blobPath = process.env.TELAO_PLAYLIST_BLOB_PATH || 'telao-playlist/current.json';

let memoryState: TelaoPlaylistState = {
  items: [{ id: 'scoreboard', type: 'scoreboard', title: 'Placar Cronometragem', source: 'scoreboard', durationSec: 9999, repeat: 1, enabled: true }],
  updatedAt: null,
  persistent: false,
};
let lastBlobReadAt = 0;
let lastBlobReadFailedAt = 0;
let lastBlobWriteFailedAt = 0;

function hasBlobStore(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

function playlistRemoteEndpoint(): string | undefined {
  if (process.env.TELAO_PLAYLIST_REMOTE_ENDPOINT) return process.env.TELAO_PLAYLIST_REMOTE_ENDPOINT;
  const layoutEndpoint = process.env.TELAO_LAYOUT_REMOTE_ENDPOINT;
  if (!layoutEndpoint) return undefined;
  return layoutEndpoint
    .replace('/api/telao-layout-local', '/api/telao-playlist-local')
    .replace('/api/telao-layout', '/api/telao-playlist');
}

function clampInt(value: unknown, fallback: number, min: number, max: number): number {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function normalizeSchedule(value: unknown): TelaoPlaylistSchedule | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const s = value as Record<string, unknown>;
  const out: TelaoPlaylistSchedule = {};
  const time = (v: unknown) => (typeof v === 'string' && /^\d{1,2}:\d{2}$/.test(v) ? v : undefined);
  const date = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);
  out.startTime = time(s.startTime);
  out.endTime = time(s.endTime);
  out.dateStart = date(s.dateStart);
  out.dateEnd = date(s.dateEnd);
  if (Array.isArray(s.weekdays)) {
    out.weekdays = s.weekdays.map((d) => Number(d)).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
  }
  const hasAny = Object.values(out).some((v) => v !== undefined && !(Array.isArray(v) && v.length === 0));
  return hasAny ? out : undefined;
}

function normalizeItem(value: unknown, index: number): TelaoPlaylistItem | null {
  if (!value || typeof value !== 'object') return null;
  const it = value as Record<string, unknown>;
  const type = ALLOWED_TYPES.includes(it.type as TelaoPlaylistItemType) ? (it.type as TelaoPlaylistItemType) : null;
  const source = typeof it.source === 'string' ? it.source.trim() : '';
  if (!type) return null;
  if (type !== 'scoreboard' && !source) return null;
  return {
    id: typeof it.id === 'string' && it.id ? it.id : `item-${index}-${Math.abs(hashString(source + type))}`,
    type,
    title: typeof it.title === 'string' ? it.title.slice(0, 120) : undefined,
    source: source || 'scoreboard',
    durationSec: clampInt(it.durationSec, type === 'scoreboard' ? 9999 : 15, 1, 86400),
    repeat: clampInt(it.repeat, 1, 1, 1000),
    enabled: it.enabled === undefined ? true : Boolean(it.enabled),
    schedule: normalizeSchedule(it.schedule),
  };
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h;
}

function normalizeState(value: unknown, persistent: boolean): TelaoPlaylistState {
  const input = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const rawItems = Array.isArray(input.items) ? input.items : Array.isArray(value) ? value : [];
  const items = rawItems.map((v, i) => normalizeItem(v, i)).filter((v): v is TelaoPlaylistItem => v !== null);
  return {
    items: items.length > 0 ? items : memoryState.items,
    updatedAt: typeof input.updatedAt === 'string' ? input.updatedAt : null,
    persistent,
  };
}

function serialize(state: TelaoPlaylistState): string {
  return JSON.stringify({ items: state.items, updatedAt: state.updatedAt }, null, 2);
}

export function readTelaoPlaylist(): TelaoPlaylistState {
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

export function writeTelaoPlaylistToFile(value: unknown): TelaoPlaylistState {
  const normalized = normalizeState(value, true);
  const state: TelaoPlaylistState = { ...normalized, updatedAt: new Date().toISOString(), persistent: true };
  memoryState = state;
  mkdirSync(dirname(statePath), { recursive: true });
  writeFileSync(statePath, serialize(state));
  return state;
}

export async function readTelaoPlaylistFromStore(): Promise<TelaoPlaylistState> {
  if (hasBlobStore()) {
    try {
      const blob = await get(blobPath, { access: 'private', useCache: false });
      if (blob?.statusCode === 200) {
        const state = normalizeState(await new Response(blob.stream).json(), true);
        memoryState = state;
        lastBlobReadAt = Date.now();
        return { ...state, persistent: true };
      }
    } catch {
      lastBlobReadFailedAt = Date.now();
    }
  }
  return readTelaoPlaylist();
}

export async function readTelaoPlaylistFromRemote(): Promise<TelaoPlaylistState> {
  const endpoint = playlistRemoteEndpoint();
  if (!endpoint) return readTelaoPlaylistFromStore();
  const timeoutMs = Number(process.env.TELAO_PLAYLIST_REMOTE_TIMEOUT_MS || process.env.TELAO_LAYOUT_REMOTE_TIMEOUT_MS || '1500');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${endpoint}${endpoint.includes('?') ? '&' : '?'}_ts=${Date.now()}`, {
      cache: 'no-store',
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Playlist HTTP ${response.status}`);
    const data = await response.json();
    const state = normalizeState(data?.playlist || data, true);
    memoryState = state;
    return state;
  } catch {
    return readTelaoPlaylistFromStore();
  } finally {
    clearTimeout(timeout);
  }
}

export async function writeTelaoPlaylist(value: unknown): Promise<TelaoPlaylistState> {
  const normalized = normalizeState(value, false);
  const state: TelaoPlaylistState = { ...normalized, updatedAt: new Date().toISOString(), persistent: false };
  memoryState = state;
  if (hasBlobStore()) {
    try {
      await put(blobPath, `${serialize(state)}\n`, {
        access: 'private',
        allowOverwrite: true,
        contentType: 'application/json',
        cacheControlMaxAge: 10,
      });
      lastBlobReadAt = Date.now();
      memoryState = { ...state, persistent: true };
      return memoryState;
    } catch {
      lastBlobWriteFailedAt = Date.now();
    }
  }
  try {
    mkdirSync(dirname(statePath), { recursive: true });
    writeFileSync(statePath, serialize(state));
    memoryState = { ...state, persistent: true };
  } catch {
    memoryState = state;
  }
  return memoryState;
}

export async function writeTelaoPlaylistRemote(value: unknown): Promise<TelaoPlaylistState & { remote?: boolean }> {
  const endpoint = playlistRemoteEndpoint();
  if (!endpoint) return writeTelaoPlaylist(value);
  try {
    const response = await fetch(endpoint, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: normalizeState(value, false).items }),
      cache: 'no-store',
    });
    if (!response.ok) throw new Error(`Playlist HTTP ${response.status}`);
    const data = await response.json();
    const state = normalizeState(data?.playlist || data, true);
    memoryState = state;
    return { ...state, remote: true };
  } catch {
    return writeTelaoPlaylist(value);
  }
}

export function telaoPlaylistStoreStatus() {
  const remoteEndpoint = playlistRemoteEndpoint();
  const storage = hasBlobStore() ? 'blob' : existsSync(statePath) ? 'file' : 'memory';
  return {
    storage,
    persistent: storage === 'blob' || storage === 'file',
    blobConfigured: hasBlobStore(),
    blobPath,
    lastBlobReadAt: lastBlobReadAt ? new Date(lastBlobReadAt).toISOString() : null,
    lastBlobReadFailedAt: lastBlobReadFailedAt ? new Date(lastBlobReadFailedAt).toISOString() : null,
    lastBlobWriteFailedAt: lastBlobWriteFailedAt ? new Date(lastBlobWriteFailedAt).toISOString() : null,
    ...(remoteEndpoint ? { remoteEndpoint } : {}),
  };
}

/** Resolve quais itens devem tocar agora, respeitando enabled + agendamento. */
export function resolveActivePlaylist(state: TelaoPlaylistState, now: Date = new Date()): TelaoPlaylistItem[] {
  const minutes = now.getHours() * 60 + now.getMinutes();
  const weekday = now.getDay();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const toMin = (t?: string) => {
    if (!t) return null;
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };
  const active = state.items.filter((item) => {
    if (!item.enabled) return false;
    const s = item.schedule;
    if (!s) return true;
    if (s.weekdays && s.weekdays.length > 0 && !s.weekdays.includes(weekday)) return false;
    if (s.dateStart && today < s.dateStart) return false;
    if (s.dateEnd && today > s.dateEnd) return false;
    const start = toMin(s.startTime);
    const end = toMin(s.endTime);
    if (start !== null && end !== null) {
      if (start <= end) {
        if (minutes < start || minutes >= end) return false;
      } else {
        // janela que cruza meia-noite
        if (minutes < start && minutes >= end) return false;
      }
    } else if (start !== null && minutes < start) {
      return false;
    } else if (end !== null && minutes >= end) {
      return false;
    }
    return true;
  });
  // garante que sempre haja algo (fallback placar)
  return active.length > 0 ? active : state.items.filter((i) => i.type === 'scoreboard');
}
