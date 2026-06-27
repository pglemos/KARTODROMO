const BASE = '/api/admin/db';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE}/${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers || {}) },
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error((data && data.error) || `HTTP ${response.status}`);
  }

  return data as T;
}

export const apiGet = <T>(path: string): Promise<T> => request<T>(path);

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
  if (!rows.length) throw new Error(`Registro não encontrado em ${table}.`);
  return rows[0];
}
