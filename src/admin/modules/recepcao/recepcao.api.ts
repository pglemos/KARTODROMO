import { supabase } from '../../lib/supabase';
import type {
  Atendimento,
  AtendimentoPayload,
  AtendimentoStatus,
  AtendimentoUpdate,
  AtendimentoWithRelations,
  ClienteOption,
  ReservaOption,
} from './recepcao.types';

const queryError = (operation: string, message: string): Error =>
  new Error(`${operation}: ${message}`);

export const listAtendimentos = async (): Promise<AtendimentoWithRelations[]> => {
  const { data, error } = await supabase
    .from('recepcao_atendimentos')
    .select('*, clientes(nome), reservas(data_inicio, status)')
    .order('created_at', { ascending: true });

  if (error) {
    throw queryError('Não foi possível carregar os atendimentos', error.message);
  }

  return (data ?? []) as AtendimentoWithRelations[];
};

export const getAtendimentoById = async (
  id: string,
): Promise<AtendimentoWithRelations> => {
  const { data, error } = await supabase
    .from('recepcao_atendimentos')
    .select('*, clientes(nome), reservas(data_inicio, status)')
    .eq('id', id)
    .single();

  if (error) {
    throw queryError('Não foi possível carregar o atendimento', error.message);
  }

  return data as AtendimentoWithRelations;
};

export const createAtendimento = async (
  payload: AtendimentoPayload,
): Promise<Atendimento> => {
  const { data, error } = await supabase
    .from('recepcao_atendimentos')
    .insert(payload)
    .select()
    .single();

  if (error) {
    throw queryError('Não foi possível criar o atendimento', error.message);
  }

  return data as Atendimento;
};

export const updateAtendimento = async (
  id: string,
  payload: AtendimentoUpdate,
): Promise<Atendimento> => {
  const { data, error } = await supabase
    .from('recepcao_atendimentos')
    .update(payload)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw queryError('Não foi possível atualizar o atendimento', error.message);
  }

  return data as Atendimento;
};

export const removeAtendimento = async (id: string): Promise<void> => {
  const { error } = await supabase.from('recepcao_atendimentos').delete().eq('id', id);

  if (error) {
    throw queryError('Não foi possível excluir o atendimento', error.message);
  }
};

export const updateStatus = async (
  id: string,
  status: AtendimentoStatus,
): Promise<Atendimento> => updateAtendimento(id, { status });

export const listClientes = async (): Promise<ClienteOption[]> => {
  const { data, error } = await supabase
    .from('clientes')
    .select('id, nome')
    .order('nome');

  if (error) {
    throw queryError('Não foi possível carregar os clientes', error.message);
  }

  return (data ?? []) as ClienteOption[];
};

export const listReservas = async (): Promise<ReservaOption[]> => {
  const { data, error } = await supabase
    .from('reservas')
    .select('id, cliente_id, data_inicio, status')
    .order('data_inicio', { ascending: false });

  if (error) {
    throw queryError('Não foi possível carregar as reservas', error.message);
  }

  return (data ?? []) as ReservaOption[];
};
