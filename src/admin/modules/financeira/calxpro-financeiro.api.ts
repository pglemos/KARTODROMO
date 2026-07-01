import type { Page } from '../../lib/api-client';

export type CalXProReceita = {
  id: string;
  descricao: string;
  cliente: string | null;
  valor: number;
  dataLancamento: string | null;
  dataVencimento: string | null;
};

export type CalXProCredito = {
  id: string;
  clienteId: string;
  documento: string | null;
  valor: number;
  status: string | null;
  data: string | null;
  cancelado: boolean;
};

async function fetchCalXProJson<T>(path: string): Promise<{ data: T; total: number }> {
  const response = await fetch(path, { headers: { 'content-type': 'application/json' } });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error((data && data.error) || `HTTP ${response.status}`);
  }

  const totalHeader = response.headers.get('x-total-count');
  const total = totalHeader ? Number(totalHeader) : Array.isArray(data) ? data.length : 0;
  return { data: data as T, total };
}

export const listCalXProReceitasPage = async (
  q: string,
  page: number,
  pageSize: number,
): Promise<Page<CalXProReceita>> => {
  const params = new URLSearchParams({ limit: String(pageSize), offset: String(page * pageSize) });
  if (q) params.set('q', q);

  const { data, total } = await fetchCalXProJson<CalXProReceita[]>(
    `/api/admin/calxpro/receitas?${params.toString()}`,
  );
  return { data, total };
};

export const listCalXProCreditosPage = async (page: number, pageSize: number): Promise<Page<CalXProCredito>> => {
  const params = new URLSearchParams({ limit: String(pageSize), offset: String(page * pageSize) });

  const { data, total } = await fetchCalXProJson<CalXProCredito[]>(
    `/api/admin/calxpro/creditos?${params.toString()}`,
  );
  return { data, total };
};
