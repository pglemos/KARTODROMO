import type { TelaoState, TelaoStateUpdate } from './telao.types';
import { humanizeAdminResponseError } from '@/lib/admin-error-messages';

type LayoutResponse = {
  layout?: TelaoState['layout'];
  updatedAt?: string | null;
};

type PageResponse = {
  offset?: number;
  updatedAt?: string | null;
};

type DisplayModeResponse = {
  mode?: 'live' | 'final-real' | 'final-demo';
  updatedAt?: string | null;
};

async function readJson<T>(url: string): Promise<T> {
  const response = await fetch(`${url}${url.includes('?') ? '&' : '?'}_ts=${Date.now()}`, { cache: 'no-store' });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const value = data && typeof data === 'object' && 'error' in data ? data.error : undefined;
    throw new Error(humanizeAdminResponseError(response.status, value));
  }
  return data as T;
}

async function writeJson(url: string, body: unknown): Promise<void> {
  const response = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const value = data && typeof data === 'object' && 'error' in data ? data.error : undefined;
    throw new Error(humanizeAdminResponseError(response.status, value));
  }
}

function displayModeForLegacyState(mode: DisplayModeResponse['mode']): TelaoState['display_mode'] {
  return mode === 'final-real' ? 'final-real' : mode === 'final-demo' ? 'final' : 'live';
}

function latestUpdatedAt(values: Array<string | null | undefined>): string {
  const valid = values.filter((value): value is string => typeof value === 'string' && !Number.isNaN(Date.parse(value)));
  return valid.sort((left, right) => Date.parse(right) - Date.parse(left))[0] || new Date().toISOString();
}

export const getState = async (): Promise<TelaoState> => {
  const [layout, page, displayMode] = await Promise.all([
    readJson<LayoutResponse>('/api/telao-layout'),
    readJson<PageResponse>('/api/tb50-page'),
    readJson<DisplayModeResponse>('/api/tb50-display-mode'),
  ]);

  return {
    id: 1,
    layout: layout.layout ?? {},
    page_offset: typeof page.offset === 'number' && Number.isInteger(page.offset) ? page.offset : 0,
    display_mode: displayModeForLegacyState(displayMode.mode),
    updated_at: latestUpdatedAt([layout.updatedAt, page.updatedAt, displayMode.updatedAt]),
  };
};

export const updateState = async (patch: TelaoStateUpdate): Promise<TelaoState> => {
  const writes: Promise<void>[] = [];

  if (patch.layout !== undefined) writes.push(writeJson('/api/telao-layout', patch.layout));
  if (patch.page_offset !== undefined) writes.push(writeJson('/api/tb50-page', { offset: patch.page_offset }));
  if (patch.display_mode !== undefined) {
    writes.push(writeJson('/api/tb50-display-mode', {
      mode: patch.display_mode === 'final' ? 'final-real' : patch.display_mode,
    }));
  }

  await Promise.all(writes);
  return getState();
};
