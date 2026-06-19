import { supabase } from '../../lib/supabase';
import type {
  Cliente,
  Pista,
  Reserva,
  ReservaPayload,
  ReservaUpdate,
  ReservaWithRelations,
} from './reservas.types';

const queryError = (operation: string, message: string): Error =>
  new Error(`${operation}: ${message}`);

export const listReservas = async (): Promise<ReservaWithRelations[]> => {
  const { data, error } = await supabase
    .from('reservas')
    .select('*, clientes(nome), pistas(nome)')
    .order('data_inicio', { ascending: false });

  if (error) {
    throw queryError('Não foi possível carregar as reservas', error.message);
  }

  return (data ?? []) as ReservaWithRelations[];
};

export const createReserva = async (payload: ReservaPayload): Promise<Reserva> => {
  const { data, error } = await supabase
    .from('reservas')
    .insert(payload)
    .select()
    .single();

  if (error) {
    throw queryError('Não foi possível criar a reserva', error.message);
  }

  return data as Reserva;
};

export const updateReserva = async (
  id: string,
  payload: ReservaUpdate,
): Promise<Reserva> => {
  const { data, error } = await supabase
    .from('reservas')
    .update(payload)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw queryError('Não foi possível atualizar a reserva', error.message);
  }

  return data as Reserva;
};

export const removeReserva = async (id: string): Promise<void> => {
  const { error } = await supabase.from('reservas').delete().eq('id', id);

  if (error) {
    throw queryError('Não foi possível excluir a reserva', error.message);
  }
};

export const listClientes = async (): Promise<Cliente[]> => {
  const { data, error } = await supabase
    .from('clientes')
    .select('id, nome, email, telefone, cpf, notes')
    .order('nome');

  if (error) {
    throw queryError('Não foi possível carregar os clientes', error.message);
  }

  return (data ?? []) as Cliente[];
};

export const listPistas = async (): Promise<Pista[]> => {
  const { data, error } = await supabase
    .from('pistas')
    .select('id, nome, descricao, ativa')
    .order('nome');

  if (error) {
    throw queryError('Não foi possível carregar as pistas', error.message);
  }

  return (data ?? []) as Pista[];
};
