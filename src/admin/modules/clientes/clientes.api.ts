import { apiGetPage, type Page } from '../../lib/api-client';
import type { ClienteLapTime, ClienteLocal } from './clientes.types';

export const listClientesLocalPage = async (
  q: string,
  page: number,
  pageSize: number,
): Promise<Page<ClienteLocal>> => {
  const params = new URLSearchParams({ order: 'nome', limit: String(pageSize), offset: String(page * pageSize) });
  if (q) params.set('q', q);
  return apiGetPage<ClienteLocal>(`clientes?${params.toString()}`);
};

export const listClientesLapTimePage = async (
  q: string,
  page: number,
  pageSize: number,
): Promise<Page<ClienteLapTime>> => {
  const params = new URLSearchParams({ limit: String(pageSize), offset: String(page * pageSize) });
  if (q) params.set('q', q);

  const response = await fetch(`/api/admin/laptime-clientes?${params.toString()}`, {
    headers: { 'content-type': 'application/json' },
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : [];

  if (!response.ok) {
    throw new Error((data && data.error) || `HTTP ${response.status}`);
  }

  const totalHeader = response.headers.get('x-total-count');
  const total = totalHeader ? Number(totalHeader) : (data as ClienteLapTime[]).length;
  return { data: data as ClienteLapTime[], total };
};
