import { apiDelete, apiGet, apiGetById, apiPatch, apiPost } from '../../lib/api-client';
import type {
  Corrida,
  CorridaPayload,
  CorridaUpdate,
  CorridaWithRelations,
  Resultado,
  ResultadoPayload,
  ResultadoUpdate,
  ResultadoWithPiloto,
} from './resultados.types';

type CorridaFullRow = Corrida & { campeonato_nome: string | null; etapa_nome: string | null };

export const listCorridas = async (): Promise<CorridaWithRelations[]> => {
  const rows = await apiGet<CorridaFullRow[]>('corridas_full');
  return rows.map((row) => ({
    ...row,
    campeonatos: row.campeonato_nome ? { nome: row.campeonato_nome } : null,
    etapas: row.etapa_nome ? { nome: row.etapa_nome } : null,
  }));
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
