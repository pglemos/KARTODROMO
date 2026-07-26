import { apiGet, apiPatch } from '../../lib/api-client';
import { supabase } from '../../lib/supabase';
import type { TelaoState, TelaoStateUpdate } from './telao.types';

const SINGLETON_ID = 1;

const queryError = (operation: string, message: string): Error =>
  new Error(`${operation}: ${message}`);

export const getState = async (): Promise<TelaoState> => {
  try {
    const rows = await apiGet<TelaoState[]>(`telao_state?eq_id=${SINGLETON_ID}`);
    if (rows.length > 0) return rows[0];
  } catch {
    // fallback to supabase
  }

  const { data, error } = await supabase
    .from('telao_state')
    .select('id, layout, page_offset, display_mode, updated_at')
    .eq('id', SINGLETON_ID)
    .single();

  if (error) {
    throw queryError('Não foi possível carregar o estado do telão', error.message);
  }

  return data as TelaoState;
};

export const updateState = async (patch: TelaoStateUpdate): Promise<TelaoState> => {
  try {
    return await apiPatch<TelaoState>(`telao_state/${SINGLETON_ID}`, patch);
  } catch {
    const { data, error } = await supabase
      .from('telao_state')
      .update(patch)
      .eq('id', SINGLETON_ID)
      .select('id, layout, page_offset, display_mode, updated_at')
      .single();

    if (error) {
      throw queryError('Não foi possível atualizar o estado do telão', error.message);
    }

    return data as TelaoState;
  }
};
