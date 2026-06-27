import { apiDelete, apiGet, apiGetById, apiPatch, apiPost } from '../../lib/api-client';
import type {
  Campeonato,
  CampeonatoPayload,
  CampeonatoUpdate,
  ClassificacaoWithPiloto,
  Etapa,
  EtapaPayload,
  EtapaUpdate,
  EtapaWithCampeonato,
  Piloto,
  PilotoPayload,
  PilotoUpdate,
} from './campeonatos.types';

export const listCampeonatos = async (): Promise<Campeonato[]> =>
  apiGet<Campeonato[]>('campeonatos?order=nome');

export const getCampeonatoById = async (id: string): Promise<Campeonato> =>
  apiGetById<Campeonato>('campeonatos', id);

export const createCampeonato = async (payload: CampeonatoPayload): Promise<Campeonato> =>
  apiPost<Campeonato>('campeonatos', payload);

export const updateCampeonato = async (id: string, payload: CampeonatoUpdate): Promise<Campeonato> =>
  apiPatch<Campeonato>(`campeonatos/${id}`, payload);

export const removeCampeonato = async (id: string): Promise<void> => {
  await apiDelete(`campeonatos/${id}`);
};

type EtapaFullRow = Etapa & { campeonato_nome: string | null };

export const listEtapas = async (campeonatoId?: string): Promise<EtapaWithCampeonato[]> => {
  const qs = campeonatoId ? `?campeonato_id=${encodeURIComponent(campeonatoId)}` : '';
  const rows = await apiGet<EtapaFullRow[]>(`etapas_full${qs}`);
  return rows.map((row) => ({ ...row, campeonatos: row.campeonato_nome ? { nome: row.campeonato_nome } : null }));
};

export const getEtapaById = async (id: string): Promise<Etapa> => apiGetById<Etapa>('etapas', id);

export const createEtapa = async (payload: EtapaPayload): Promise<Etapa> => apiPost<Etapa>('etapas', payload);

export const updateEtapa = async (id: string, payload: EtapaUpdate): Promise<Etapa> =>
  apiPatch<Etapa>(`etapas/${id}`, payload);

export const removeEtapa = async (id: string): Promise<void> => {
  await apiDelete(`etapas/${id}`);
};

export const listPilotos = async (): Promise<Piloto[]> => apiGet<Piloto[]>('pilotos?order=nome');

export const getPilotoById = async (id: string): Promise<Piloto> => apiGetById<Piloto>('pilotos', id);

export const createPiloto = async (payload: PilotoPayload): Promise<Piloto> => apiPost<Piloto>('pilotos', payload);

export const updatePiloto = async (id: string, payload: PilotoUpdate): Promise<Piloto> =>
  apiPatch<Piloto>(`pilotos/${id}`, payload);

export const removePiloto = async (id: string): Promise<void> => {
  await apiDelete(`pilotos/${id}`);
};

type ClassificacaoFullRow = {
  id: string;
  campeonato_id: string | null;
  piloto_id: string | null;
  pontos: number;
  posicao: number | null;
  piloto_nome: string | null;
  piloto_numero: string | null;
  piloto_equipe: string | null;
};

export const listClassificacao = async (campeonatoId: string): Promise<ClassificacaoWithPiloto[]> => {
  const rows = await apiGet<ClassificacaoFullRow[]>(
    `classificacao_full?campeonato_id=${encodeURIComponent(campeonatoId)}`,
  );
  return rows.map((row) => ({
    id: row.id,
    campeonato_id: row.campeonato_id,
    piloto_id: row.piloto_id,
    pontos: row.pontos,
    posicao: row.posicao,
    pilotos: row.piloto_nome
      ? { nome: row.piloto_nome, numero: row.piloto_numero, equipe: row.piloto_equipe }
      : null,
  }));
};
