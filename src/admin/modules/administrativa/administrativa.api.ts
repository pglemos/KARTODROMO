import { supabase } from '../../lib/supabase';
import type { AuditEntry, Profile, ProfileUpdate } from './administrativa.types';

const queryError = (operation: string, message: string): Error =>
  new Error(`${operation}: ${message}`);

export const listProfiles = async (): Promise<Profile[]> => {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, role, phone, active, created_at')
    .order('full_name', { ascending: true });

  if (error) {
    throw queryError('Não foi possível carregar os usuários', error.message);
  }

  return (data ?? []) as Profile[];
};

export const updateProfile = async (
  id: string,
  payload: ProfileUpdate,
): Promise<Profile> => {
  const { data, error } = await supabase
    .from('profiles')
    .update(payload)
    .eq('id', id)
    .select('id, email, full_name, role, phone, active, created_at')
    .single();

  if (error) {
    throw queryError('Não foi possível atualizar o usuário', error.message);
  }

  return data as Profile;
};

export const listAudit = async (limit: number): Promise<AuditEntry[]> => {
  const { data, error } = await supabase
    .from('audit_log')
    .select('id, actor, action, entity, entity_id, details, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw queryError('Não foi possível carregar a auditoria', error.message);
  }

  return (data ?? []) as AuditEntry[];
};
