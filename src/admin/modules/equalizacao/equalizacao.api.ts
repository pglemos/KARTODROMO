import { apiGet, apiPatch, apiPost } from '../../lib/api-client';
import { buildKartHistoryWindows } from '@/lib/equalizacao/history';
import type {
  Kart,
  KartEqualization,
  KartEqualizationCapture,
  KartEqualizationSession,
  KartHistoryItem,
  KartHistoryResponse,
  KartIdentityEvent,
  KartMaintenance,
} from './equalizacao.types';
import type { EqualizacaoLiveSnapshot } from '@/lib/equalizacao/equalizacao-live.types';

export type EqualizacaoBeforeResponse = {
  session: KartEqualizationSession;
  capture: KartEqualizationCapture;
  candidate: EqualizacaoLiveSnapshot['candidates'][number];
  snapshot: EqualizacaoLiveSnapshot;
};

export type EqualizacaoAfterResponse = EqualizacaoBeforeResponse & {
  measurement: KartEqualization;
};

const jsonRequest = async <T>(url: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(url, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers || {}) },
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error((data && data.error) || `HTTP ${response.status}`);
  return data as T;
};

export const listKarts = async (): Promise<Kart[]> => {
  const rows = await apiGet<Kart[]>('karts_full?eq_ativo=1&limit=500&order=numero&dir=asc');
  return rows.filter((kart) => kart.ativo);
};

export const getKart = async (id: string): Promise<Kart> => {
  const rows = await apiGet<Kart[]>(`karts_full?eq_id=${encodeURIComponent(id)}&limit=1`);
  if (!rows[0]) throw new Error('Kart não encontrado na frota real.');
  return rows[0];
};

export const createKart = (payload: Partial<Kart>): Promise<Kart> => apiPost<Kart>('karts', payload);

export const updateKart = (id: string, payload: Partial<Kart>): Promise<Kart> => apiPatch<Kart>(`karts/${encodeURIComponent(id)}`, payload);

export const updateKartPhysicalData = (id: string, payload: Pick<Kart, 'chassi_numero' | 'redutor_antigo' | 'redutor_novo'>): Promise<Kart> =>
  updateKart(id, payload);

export const listKartEqualizations = (kartId: string): Promise<KartEqualization[]> =>
  apiGet<KartEqualization[]>(`karts_equalizacoes?eq_kart_id=${encodeURIComponent(kartId)}&limit=100&order=data&dir=desc`);

export const createKartEqualization = (payload: Record<string, unknown>): Promise<KartEqualization> =>
  apiPost<KartEqualization>('karts_equalizacoes', payload);

export const fetchEqualizacaoLive = (): Promise<EqualizacaoLiveSnapshot> =>
  jsonRequest<EqualizacaoLiveSnapshot>('/api/admin/laptime/equalizacao-live');

export const startEqualizacaoSession = (): Promise<{
  session: KartEqualizationSession;
  snapshot: EqualizacaoLiveSnapshot;
  reused: boolean;
}> => jsonRequest('/api/admin/equalizacao/sessions', { method: 'POST', body: JSON.stringify({}) });

export const getEqualizacaoSession = (sessionId: string): Promise<{
  session: KartEqualizationSession;
  captures: KartEqualizationCapture[];
}> => jsonRequest(`/api/admin/equalizacao/sessions/${encodeURIComponent(sessionId)}`);

export const captureEqualizacaoBefore = (sessionId: string, kartId: string, competitorId?: string): Promise<EqualizacaoBeforeResponse> =>
  jsonRequest<EqualizacaoBeforeResponse>(`/api/admin/equalizacao/sessions/${encodeURIComponent(sessionId)}/before`, {
    method: 'POST',
    body: JSON.stringify({ kartId, ...(competitorId ? { competitorId } : {}) }),
  });

export const captureEqualizacaoAfter = (sessionId: string, captureId: string): Promise<EqualizacaoAfterResponse> =>
  jsonRequest<EqualizacaoAfterResponse>(`/api/admin/equalizacao/sessions/${encodeURIComponent(sessionId)}/after`, {
    method: 'POST',
    body: JSON.stringify({ captureId }),
  });

export const closeEqualizacaoSession = (sessionId: string): Promise<{
  session: KartEqualizationSession;
  captures: KartEqualizationCapture[];
}> => jsonRequest(`/api/admin/equalizacao/sessions/${encodeURIComponent(sessionId)}/close`, {
    method: 'POST',
    body: JSON.stringify({}),
  });

export const listKartMaintenances = (kartId: string): Promise<KartMaintenance[]> =>
  apiGet<KartMaintenance[]>(`karts_manutencao?eq_kart_id=${encodeURIComponent(kartId)}&limit=100&order=data&dir=desc`);

export const createKartMaintenance = (payload: Record<string, unknown>): Promise<KartMaintenance> =>
  apiPost<KartMaintenance>('karts_manutencao', payload);

export const listKartIdentityEvents = (kartId: string): Promise<KartIdentityEvent[]> =>
  apiGet<KartIdentityEvent[]>(`karts_identidade_historico?eq_kart_id=${encodeURIComponent(kartId)}&limit=100&order=data&dir=desc`);

export const createKartIdentityEvent = (payload: Record<string, unknown>): Promise<KartIdentityEvent> =>
  apiPost<KartIdentityEvent>('karts_identidade_historico', payload);

export const getKartHistory = async (kart: Pick<Kart, 'numero' | 'sensor_numero' | 'sensor_numero_fonte'>): Promise<KartHistoryResponse> => {
  const sensor = kart.sensor_numero?.trim() || kart.sensor_numero_fonte?.trim();
  const fetchRows = (query: Record<string, string>) => jsonRequest<KartHistoryItem[]>(
    `/api/admin/laptime/kart-history?${new URLSearchParams({ ...query, limit: '60' }).toString()}`,
  );
  const sensorRows = sensor ? await fetchRows({ sensor }) : [];
  const rows = sensorRows.length ? sensorRows : await fetchRows({ plate: kart.numero });
  return { rows, windows: buildKartHistoryWindows(rows) };
};
