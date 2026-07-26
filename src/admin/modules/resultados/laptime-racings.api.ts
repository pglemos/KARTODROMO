import type { Page } from '../../lib/api-client';

export type LapTimeRacing = {
  id: string;
  nome: string;
  tipo: string | null;
  dataHora: string;
  inicio: string | null;
  estado: number;
  finalizada: boolean;
  participantes: number;
};

export type LapTimeRacingCompetitor = {
  id: string;
  posicao: number | null;
  numero: string | null;
  nome: string;
  voltas: number | null;
  melhorVolta: string | null;
  tempoTotal: string | null;
  status: number;
};

export type LapTimeRacingsFilters = {
  q?: string;
  status?: 'finalizada' | 'aberta' | '';
  from?: string;
  to?: string;
};

async function fetchLapTimeJson<T>(path: string): Promise<{ data: T; total: number }> {
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

export const listLapTimeRacingsPage = async (
  filters: LapTimeRacingsFilters,
  page: number,
  pageSize: number,
): Promise<Page<LapTimeRacing>> => {
  const params = new URLSearchParams({ limit: String(pageSize), offset: String(page * pageSize) });
  if (filters.q) params.set('q', filters.q);
  if (filters.status) params.set('status', filters.status);
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);

  const { data, total } = await fetchLapTimeJson<LapTimeRacing[]>(
    `/api/admin/laptime/racings?${params.toString()}`,
  );
  return { data, total };
};

export const listLapTimeRacingCompetitors = async (racingId: string): Promise<LapTimeRacingCompetitor[]> => {
  const { data } = await fetchLapTimeJson<LapTimeRacingCompetitor[]>(
    `/api/admin/laptime/racing-competitors?racingId=${encodeURIComponent(racingId)}`,
  );
  return data;
};

export type LapTimePassing = {
  id: string;
  lapNumber: number | null;
  lapTime: string | null;
  passTime: string | null;
  speed: number | null;
  pos: number | null;
};

export const listLapTimePassings = async (competitorId: string, racingId: string): Promise<LapTimePassing[]> => {
  const { data } = await fetchLapTimeJson<LapTimePassing[]>(
    `/api/admin/laptime/passings?competitorId=${encodeURIComponent(competitorId)}&racingId=${encodeURIComponent(racingId)}`,
  );
  return data;
};
