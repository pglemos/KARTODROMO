import type { Page } from '../../lib/api-client';

export type CalXProCorrida = {
  id: string;
  nome: string;
  dataHora: string;
  participantes: number;
};

export type CalXProCorridaCompetidor = {
  id: string;
  posicao: number | null;
  nome: string;
  cidade: string | null;
  voltas: number | null;
  melhorVolta: string | null;
  tempoTotal: string | null;
};

export type CalXProCorridasFilters = {
  q?: string;
  from?: string;
  to?: string;
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

export const listCalXProCorridasPage = async (
  filters: CalXProCorridasFilters,
  page: number,
  pageSize: number,
): Promise<Page<CalXProCorrida>> => {
  const params = new URLSearchParams({ limit: String(pageSize), offset: String(page * pageSize) });
  if (filters.q) params.set('q', filters.q);
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);

  const { data, total } = await fetchCalXProJson<CalXProCorrida[]>(
    `/api/admin/calxpro/corridas?${params.toString()}`,
  );
  return { data, total };
};

export const listCalXProCorridaCompetidores = async (corridaId: string): Promise<CalXProCorridaCompetidor[]> => {
  const { data } = await fetchCalXProJson<CalXProCorridaCompetidor[]>(
    `/api/admin/calxpro/corrida-competidores?corridaId=${encodeURIComponent(corridaId)}`,
  );
  return data;
};
