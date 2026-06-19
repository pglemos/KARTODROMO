import { supabase } from '../../lib/supabase';
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

const queryError = (operation: string, message: string): Error =>
  new Error(`${operation}: ${message}`);

export const listCorridas = async (): Promise<CorridaWithRelations[]> => {
  const { data, error } = await supabase
    .from('corridas')
    .select(
      'id, etapa_id, campeonato_id, titulo, data, status, source, campeonatos(nome), etapas(nome)',
    )
    .order('data', { ascending: false });

  if (error) {
    throw queryError('Não foi possível carregar as corridas', error.message);
  }

  return (data ?? []) as unknown as CorridaWithRelations[];
};

export const getCorridaById = async (id: string): Promise<Corrida> => {
  const { data, error } = await supabase
    .from('corridas')
    .select('id, etapa_id, campeonato_id, titulo, data, status, source')
    .eq('id', id)
    .single();

  if (error) {
    throw queryError('Não foi possível carregar a corrida', error.message);
  }

  return data as Corrida;
};

export const createCorrida = async (payload: CorridaPayload): Promise<Corrida> => {
  const { data, error } = await supabase.from('corridas').insert(payload).select().single();

  if (error) {
    throw queryError('Não foi possível criar a corrida', error.message);
  }

  return data as Corrida;
};

export const updateCorrida = async (
  id: string,
  payload: CorridaUpdate,
): Promise<Corrida> => {
  const { data, error } = await supabase
    .from('corridas')
    .update(payload)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw queryError('Não foi possível atualizar a corrida', error.message);
  }

  return data as Corrida;
};

export const removeCorrida = async (id: string): Promise<void> => {
  const { error } = await supabase.from('corridas').delete().eq('id', id);

  if (error) {
    throw queryError('Não foi possível excluir a corrida', error.message);
  }
};

export const listResultados = async (
  corridaId: string,
): Promise<ResultadoWithPiloto[]> => {
  const { data, error } = await supabase
    .from('resultados')
    .select(
      'id, corrida_id, piloto_id, piloto_nome, posicao, melhor_volta, voltas, pontos, gap, pilotos(numero, equipe)',
    )
    .eq('corrida_id', corridaId)
    .order('posicao');

  if (error) {
    throw queryError('Não foi possível carregar os resultados', error.message);
  }

  return (data ?? []) as unknown as ResultadoWithPiloto[];
};

export const getResultadoById = async (id: string): Promise<Resultado> => {
  const { data, error } = await supabase
    .from('resultados')
    .select(
      'id, corrida_id, piloto_id, piloto_nome, posicao, melhor_volta, voltas, pontos, gap',
    )
    .eq('id', id)
    .single();

  if (error) {
    throw queryError('Não foi possível carregar o resultado', error.message);
  }

  return data as Resultado;
};

export const createResultado = async (
  payload: ResultadoPayload,
): Promise<Resultado> => {
  const { data, error } = await supabase
    .from('resultados')
    .insert(payload)
    .select()
    .single();

  if (error) {
    throw queryError('Não foi possível criar o resultado', error.message);
  }

  return data as Resultado;
};

export const updateResultado = async (
  id: string,
  payload: ResultadoUpdate,
): Promise<Resultado> => {
  const { data, error } = await supabase
    .from('resultados')
    .update(payload)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw queryError('Não foi possível atualizar o resultado', error.message);
  }

  return data as Resultado;
};

export const removeResultado = async (id: string): Promise<void> => {
  const { error } = await supabase.from('resultados').delete().eq('id', id);

  if (error) {
    throw queryError('Não foi possível excluir o resultado', error.message);
  }
};
