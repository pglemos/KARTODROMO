import { apiGet, apiPatch, apiPost } from '../../lib/api-client';
import { buildKartHistoryWindows } from '@/lib/equalizacao/history';
import type {
  Kart,
  KartEqualization,
  KartHistoryItem,
  KartHistoryResponse,
  KartIdentityEvent,
  KartMaintenance,
} from './equalizacao.types';

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

export const createKart = (payload: Partial<Kart>): Promise<Kart> => apiPost<Kart>('karts', payload);

export const updateKart = (id: string, payload: Partial<Kart>): Promise<Kart> => apiPatch<Kart>(`karts/${encodeURIComponent(id)}`, payload);

export const listKartEqualizations = (kartId: string): Promise<KartEqualization[]> =>
  apiGet<KartEqualization[]>(`karts_equalizacoes?eq_kart_id=${encodeURIComponent(kartId)}&limit=100&order=data&dir=desc`);

export const createKartEqualization = (payload: Record<string, unknown>): Promise<KartEqualization> =>
  apiPost<KartEqualization>('karts_equalizacoes', payload);

export const listKartMaintenances = (kartId: string): Promise<KartMaintenance[]> =>
  apiGet<KartMaintenance[]>(`karts_manutencao?eq_kart_id=${encodeURIComponent(kartId)}&limit=100&order=data&dir=desc`);

export const createKartMaintenance = (payload: Record<string, unknown>): Promise<KartMaintenance> =>
  apiPost<KartMaintenance>('karts_manutencao', payload);

export const listKartIdentityEvents = (kartId: string): Promise<KartIdentityEvent[]> =>
  apiGet<KartIdentityEvent[]>(`karts_identidade_historico?eq_kart_id=${encodeURIComponent(kartId)}&limit=100&order=data&dir=desc`);

export const createKartIdentityEvent = (payload: Record<string, unknown>): Promise<KartIdentityEvent> =>
  apiPost<KartIdentityEvent>('karts_identidade_historico', payload);

export const getKartHistory = async (kart: Pick<Kart, 'numero' | 'sensor_numero' | 'sensor_numero_fonte'>): Promise<KartHistoryResponse> => {
  const params = new URLSearchParams({ limit: '60' });
  const sensor = kart.sensor_numero?.trim() || kart.sensor_numero_fonte?.trim();
  if (sensor) params.set('sensor', sensor);
  else params.set('plate', kart.numero);
  const rows = await jsonRequest<KartHistoryItem[]>(`/api/admin/laptime/kart-history?${params.toString()}`);
  return { rows, windows: buildKartHistoryWindows(rows) };
};
