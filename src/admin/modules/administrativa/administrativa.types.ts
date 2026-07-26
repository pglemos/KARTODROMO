import type { Role } from '../../lib/rbac';

export type Profile = {
  id: string;
  email: string | null;
  full_name: string;
  role: Role;
  phone: string | null;
  active: boolean;
  created_at: string;
};

export type ProfileUpdate = Pick<Profile, 'full_name' | 'role' | 'phone' | 'active'>;

export type AuditEntry = {
  id: number;
  actor: string | null;
  action: string;
  entity: string | null;
  entity_id: string | null;
  details: unknown;
  created_at: string;
};
