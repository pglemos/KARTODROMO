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
  situacao: 'finalizada' | 'em_andamento' | 'agendada';
};

export type LapTimeRacingPitStopStatus = 'mandatory' | 'additional' | 'short' | 'invalid' | 'outside-window';

export type LapTimeRacingPitSummary = {
  required: number;
  minimumStopMs: number;
  currentLap: number | null;
  currentRaceTime: string | null;
  currentRaceTimeMs: number | null;
  mandatory: number;
  remaining: number;
  short: number;
  total: number;
  additional: number;
  excess: number;
  penaltyLaps: number;
  outsideWindow: number;
  stops: Array<{
    id: string;
    lap: number | null;
    stopTime: string | null;
    raceTime: string | null;
    position: number | null;
    status: LapTimeRacingPitStopStatus;
    mandatoryNumber?: number;
  }>;
};

export type LapTimeRacingDetailCompetitor = LapTimeRacingCompetitor & {
  startPosition: number | null;
  positionRecovery: number | null;
  averageLap: string | null;
  worstLap: string | null;
  normalLaps: number;
  validLaps: number;
  invalidLaps: number;
  penaltyLaps: number | null;
  penaltyTime: string | null;
  stopAndGo: number | null;
  statusLabel: string;
  pitStops: LapTimeRacingPitSummary;
};

export type LapTimeRacingDetailLap = LapTimeRacingLap & {
  competitorId: string;
  kart: string | null;
  nome: string;
  parada: boolean;
  statusParada: LapTimeRacingPitStopStatus | null;
};

export type LapTimeRacingDetail = {
  race: LapTimeRacing & {
    evento: string | null;
    grupo: string | null;
    pista: string | null;
    encerradaEm: string | null;
    duracaoEncerramento: string | null;
    voltaFinal: number | null;
    tempoFinal: string | null;
    tipoEncerramento: number | null;
    tempoTotal: string | null;
    observacao: string | null;
  };
  competitors: LapTimeRacingDetailCompetitor[];
  stops: Array<{
    competitorId: string;
    kart: string | null;
    nome: string;
    id: string;
    lap: number | null;
    stopTime: string | null;
    raceTime: string | null;
    position: number | null;
    status: LapTimeRacingPitStopStatus;
    mandatoryNumber?: number;
  }>;
  laps: LapTimeRacingDetailLap[];
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

export type LapTimeRacingLap = {
  id: string;
  volta: number | null;
  tempoVolta: string | null;
  tempoTotal: string | null;
  posicao: number | null;
  invalida: boolean;
  excluida: boolean;
  manual: boolean;
  bandeira: number | null;
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

export const getLapTimeRacingDetail = async (racingId: string): Promise<LapTimeRacingDetail> => {
  const { data } = await fetchLapTimeJson<LapTimeRacingDetail>(
    `/api/admin/laptime/racing-detail?racingId=${encodeURIComponent(racingId)}`,
  );
  return data;
};

export const listLapTimeRacingLaps = async (
  racingId: string,
  racingCompetitorId: string,
  page: number,
  pageSize: number,
): Promise<Page<LapTimeRacingLap>> => {
  const params = new URLSearchParams({
    racingId,
    racingCompetitorId,
    limit: String(pageSize),
    offset: String(page * pageSize),
  });
  const { data, total } = await fetchLapTimeJson<LapTimeRacingLap[]>(
    `/api/admin/laptime/racing-laps?${params.toString()}`,
  );
  return { data, total };
};
