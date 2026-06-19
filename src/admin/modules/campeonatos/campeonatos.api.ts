import { supabase } from '../../lib/supabase';
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

const queryError = (operation: string, message: string): Error =>
  new Error(`${operation}: ${message}`);

export const listCampeonatos = async (): Promise<Campeonato[]> => {
  const { data, error } = await supabase
    .from('campeonatos')
    .select('id, nome, slug, temporada, status')
    .order('temporada', { ascending: false })
    .order('nome');

  if (error) {
    throw queryError('Não foi possível carregar os campeonatos', error.message);
  }

  return (data ?? []) as Campeonato[];
};

export const getCampeonatoById = async (id: string): Promise<Campeonato> => {
  const { data, error } = await supabase
    .from('campeonatos')
    .select('id, nome, slug, temporada, status')
    .eq('id', id)
    .single();

  if (error) {
    throw queryError('Não foi possível carregar o campeonato', error.message);
  }

  return data as Campeonato;
};

export const createCampeonato = async (
  payload: CampeonatoPayload,
): Promise<Campeonato> => {
  const { data, error } = await supabase
    .from('campeonatos')
    .insert(payload)
    .select()
    .single();

  if (error) {
    throw queryError('Não foi possível criar o campeonato', error.message);
  }

  return data as Campeonato;
};

export const updateCampeonato = async (
  id: string,
  payload: CampeonatoUpdate,
): Promise<Campeonato> => {
  const { data, error } = await supabase
    .from('campeonatos')
    .update(payload)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw queryError('Não foi possível atualizar o campeonato', error.message);
  }

  return data as Campeonato;
};

export const removeCampeonato = async (id: string): Promise<void> => {
  const { error } = await supabase.from('campeonatos').delete().eq('id', id);

  if (error) {
    throw queryError('Não foi possível excluir o campeonato', error.message);
  }
};

export const listEtapas = async (
  campeonatoId?: string,
): Promise<EtapaWithCampeonato[]> => {
  let query = supabase
    .from('etapas')
    .select('id, campeonato_id, nome, data, round, status, campeonatos(nome)')
    .order('data', { ascending: false })
    .order('round');

  if (campeonatoId) {
    query = query.eq('campeonato_id', campeonatoId);
  }

  const { data, error } = await query;

  if (error) {
    throw queryError('Não foi possível carregar as etapas', error.message);
  }

  return (data ?? []) as unknown as EtapaWithCampeonato[];
};

export const getEtapaById = async (id: string): Promise<Etapa> => {
  const { data, error } = await supabase
    .from('etapas')
    .select('id, campeonato_id, nome, data, round, status')
    .eq('id', id)
    .single();

  if (error) {
    throw queryError('Não foi possível carregar a etapa', error.message);
  }

  return data as Etapa;
};

export const createEtapa = async (payload: EtapaPayload): Promise<Etapa> => {
  const { data, error } = await supabase.from('etapas').insert(payload).select().single();

  if (error) {
    throw queryError('Não foi possível criar a etapa', error.message);
  }

  return data as Etapa;
};

export const updateEtapa = async (
  id: string,
  payload: EtapaUpdate,
): Promise<Etapa> => {
  const { data, error } = await supabase
    .from('etapas')
    .update(payload)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw queryError('Não foi possível atualizar a etapa', error.message);
  }

  return data as Etapa;
};

export const removeEtapa = async (id: string): Promise<void> => {
  const { error } = await supabase.from('etapas').delete().eq('id', id);

  if (error) {
    throw queryError('Não foi possível excluir a etapa', error.message);
  }
};

export const listPilotos = async (): Promise<Piloto[]> => {
  const { data, error } = await supabase
    .from('pilotos')
    .select('id, nome, numero, equipe, cliente_id')
    .order('nome');

  if (error) {
    throw queryError('Não foi possível carregar os pilotos', error.message);
  }

  return (data ?? []) as Piloto[];
};

export const getPilotoById = async (id: string): Promise<Piloto> => {
  const { data, error } = await supabase
    .from('pilotos')
    .select('id, nome, numero, equipe, cliente_id')
    .eq('id', id)
    .single();

  if (error) {
    throw queryError('Não foi possível carregar o piloto', error.message);
  }

  return data as Piloto;
};

export const createPiloto = async (payload: PilotoPayload): Promise<Piloto> => {
  const { data, error } = await supabase.from('pilotos').insert(payload).select().single();

  if (error) {
    throw queryError('Não foi possível criar o piloto', error.message);
  }

  return data as Piloto;
};

export const updatePiloto = async (
  id: string,
  payload: PilotoUpdate,
): Promise<Piloto> => {
  const { data, error } = await supabase
    .from('pilotos')
    .update(payload)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw queryError('Não foi possível atualizar o piloto', error.message);
  }

  return data as Piloto;
};

export const removePiloto = async (id: string): Promise<void> => {
  const { error } = await supabase.from('pilotos').delete().eq('id', id);

  if (error) {
    throw queryError('Não foi possível excluir o piloto', error.message);
  }
};

export const listClassificacao = async (
  campeonatoId: string,
): Promise<ClassificacaoWithPiloto[]> => {
  const { data, error } = await supabase
    .from('classificacao')
    .select('id, campeonato_id, piloto_id, pontos, posicao, pilotos(nome, numero, equipe)')
    .eq('campeonato_id', campeonatoId)
    .order('pontos', { ascending: false })
    .order('posicao');

  if (error) {
    throw queryError('Não foi possível carregar a classificação', error.message);
  }

  return (data ?? []) as unknown as ClassificacaoWithPiloto[];
};
