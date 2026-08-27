import { humanizeAdminError, humanizeAdminResponseError } from '@/lib/admin-error-messages';

const BASE = '/api/admin/db';

function parseJson(text: string, fallback: unknown = null) {
  if (!text) return fallback;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return fallback;
  }
}

function errorCode(data: unknown) {
  return typeof data === 'object' && data !== null && 'error' in data && typeof data.error === 'string'
    ? data.error
    : undefined;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE}/${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers || {}) },
  });

  const text = await response.text();
  const data = parseJson(text);

  if (!response.ok) {
    throw new Error(humanizeAdminResponseError(response.status, errorCode(data)));
  }

  return data as T;
}

export const apiGet = <T>(path: string): Promise<T> => request<T>(path);

export async function apiGetWithMeta<T>(path: string): Promise<{ data: T; headers: Headers }> {
  const response = await fetch(`${BASE}/${path}`, { headers: { 'content-type': 'application/json' } });
  const text = await response.text();
  const data = parseJson(text);

  if (!response.ok) {
    throw new Error(humanizeAdminResponseError(response.status, errorCode(data)));
  }

  return { data: data as T, headers: response.headers };
}

export type Page<T> = { data: T[]; total: number };

export async function apiGetPage<T>(path: string): Promise<Page<T>> {
  const response = await fetch(`${BASE}/${path}`, { headers: { 'content-type': 'application/json' } });
  const text = await response.text();
  const data = parseJson(text, []);

  if (!response.ok) {
    throw new Error(humanizeAdminResponseError(response.status, errorCode(data)));
  }

  const totalHeader = response.headers.get('x-total-count');
  const total = totalHeader ? Number(totalHeader) : (data as T[]).length;
  return { data: data as T[], total };
}

export const apiPost = <T>(path: string, body: unknown): Promise<T> =>
  request<T>(path, { method: 'POST', body: JSON.stringify(body) });

export const apiPatch = <T>(path: string, body: unknown): Promise<T> =>
  request<T>(path, { method: 'PATCH', body: JSON.stringify(body) });

export const apiPut = <T>(path: string, body: unknown): Promise<T> =>
  request<T>(path, { method: 'PUT', body: JSON.stringify(body) });

export const apiDelete = (path: string): Promise<{ ok: boolean }> =>
  request<{ ok: boolean }>(path, { method: 'DELETE' });

export async function apiGetById<T>(table: string, id: string): Promise<T> {
  const rows = await apiGet<T[]>(`${table}?eq_id=${encodeURIComponent(id)}`);
  if (!rows.length) throw new Error(humanizeAdminError(`Registro não encontrado em ${table}.`));
  return rows[0];
}
