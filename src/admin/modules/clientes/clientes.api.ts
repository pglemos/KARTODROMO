import type { Page } from '../../lib/api-client';
import { humanizeAdminResponseError } from '@/lib/admin-error-messages';
import type { Cliente } from './clientes.types';

export const listClientesPage = async (q: string, page: number, pageSize: number): Promise<Page<Cliente>> => {
  const params = new URLSearchParams({ limit: String(pageSize), offset: String(page * pageSize) });
  if (q) params.set('q', q);

  const response = await fetch(`/api/admin/clientes?${params.toString()}`, {
    headers: { 'content-type': 'application/json' },
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : [];

  if (!response.ok) {
    throw new Error(humanizeAdminResponseError(response.status, data && typeof data === 'object' && 'error' in data ? data.error : undefined));
  }

  const totalHeader = response.headers.get('x-total-count');
  const total = totalHeader ? Number(totalHeader) : (data as Cliente[]).length;
  return { data: data as Cliente[], total };
};
