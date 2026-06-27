import { apiGet, apiPatch } from '../../lib/api-client';
import type { AuditEntry, Profile, ProfileUpdate } from './administrativa.types';

export const listProfiles = async (): Promise<Profile[]> =>
  apiGet<Profile[]>('profiles?order=full_name');

export const updateProfile = async (id: string, payload: ProfileUpdate): Promise<Profile> =>
  apiPatch<Profile>(`profiles/${id}`, payload);

export const listAudit = async (limit: number): Promise<AuditEntry[]> =>
  apiGet<AuditEntry[]>(`audit_log?order=created_at&dir=desc&limit=${limit}`);
