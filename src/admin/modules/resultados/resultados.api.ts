import { apiDelete, apiGet, apiGetById, apiGetPage, apiPatch, apiPost, type Page } from '../../lib/api-client';
import type {
  Corrida,
  CorridaPayload,
  CorridaStatus,
  CorridaUpdate,
  CorridaWithRelations,
  Resultado,
  ResultadoPayload,
  ResultadoUpdate,
  ResultadoWithPiloto,
} from './resultados.types';

type CorridaFullRow = Corrida & { campeonato_nome: string | null; etapa_nome: string | null };

const toCorridaWithRelations = (row: CorridaFullRow): CorridaWithRelations => ({
  ...row,
  campeonatos: row.campeonato_nome ? { nome: row.campeonato_nome } : null,
  etapas: row.etapa_nome ? { nome: row.etapa_nome } : null,
});

export const listCorridas = async (): Promise<CorridaWithRelations[]> => {
  const rows = await apiGet<CorridaFullRow[]>('corridas_full');
  return rows.map(toCorridaWithRelations);
};

export type CorridasFilters = {
  campeonato_id?: string;
  status?: CorridaStatus | '';
  q?: string;
};

export const listCorridasPage = async (
  filters: CorridasFilters,
  page: number,
  pageSize: number,
): Promise<Page<CorridaWithRelations>> => {
  const params = new URLSearchParams();
  if (filters.campeonato_id) params.set('campeonato_id', filters.campeonato_id);
  if (filters.status) params.set('status', filters.status);
  if (filters.q) params.set('q', filters.q);
  params.set('limit', String(pageSize));
  params.set('offset', String(page * pageSize));

  const { data, total } = await apiGetPage<CorridaFullRow>(`corridas_full?${params.toString()}`);
  return { data: data.map(toCorridaWithRelations), total };
};

export const getCorridaById = async (id: string): Promise<Corrida> => apiGetById<Corrida>('corridas', id);

export const createCorrida = async (payload: CorridaPayload): Promise<Corrida> =>
  apiPost<Corrida>('corridas', payload);

export const updateCorrida = async (id: string, payload: CorridaUpdate): Promise<Corrida> =>
  apiPatch<Corrida>(`corridas/${id}`, payload);

export const removeCorrida = async (id: string): Promise<void> => {
  await apiDelete(`corridas/${id}`);
};

type ResultadoFullRow = Resultado & { piloto_numero: string | null; piloto_equipe: string | null };

export const listResultados = async (corridaId: string): Promise<ResultadoWithPiloto[]> => {
  const rows = await apiGet<ResultadoFullRow[]>(`resultados_full?corrida_id=${encodeURIComponent(corridaId)}`);
  return rows.map((row) => ({
    ...row,
    pilotos: row.piloto_numero || row.piloto_equipe ? { numero: row.piloto_numero, equipe: row.piloto_equipe } : null,
  }));
};

export const getResultadoById = async (id: string): Promise<Resultado> => apiGetById<Resultado>('resultados', id);

export const createResultado = async (payload: ResultadoPayload): Promise<Resultado> =>
  apiPost<Resultado>('resultados', payload);

export const updateResultado = async (id: string, payload: ResultadoUpdate): Promise<Resultado> =>
  apiPatch<Resultado>(`resultados/${id}`, payload);

export const removeResultado = async (id: string): Promise<void> => {
  await apiDelete(`resultados/${id}`);
};
