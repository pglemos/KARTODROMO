import crypto from 'node:crypto';
import { getCloudflareAdminDb } from '@/lib/cloudflare-admin-db';
import { isRole, type Role } from '@/src/admin/lib/rbac';

const COOKIE_NAME = 'kartodromo_admin_session';
const SESSION_TTL_SECONDS = 60 * 60 * 12;

export type AdminSessionPayload = {
  email: string;
  role: Role;
  exp: number;
};

function getConfig() {
  return {
    email: process.env.ADMIN_EMAIL,
    password: process.env.ADMIN_PASSWORD,
    secret: process.env.ADMIN_SESSION_SECRET,
    defaultRole: process.env.ADMIN_DEFAULT_ROLE,
  };
}

export function configuredAdminRole(): Role {
  const candidate = getConfig().defaultRole;
  return isRole(candidate) ? candidate : 'owner';
}

function base64url(value: string) {
  return Buffer.from(value).toString('base64url');
}

function sign(payload: string, secret: string) {
  return crypto.createHmac('sha256', secret).update(payload).digest('base64url');
}

export function adminCookieName() {
  return COOKIE_NAME;
}

export function adminSessionTtlSeconds() {
  return SESSION_TTL_SECONDS;
}

export function adminAuthConfigured() {
  const { email, password, secret } = getConfig();
  return Boolean(email && password && secret);
}

export function validateAdminCredentials(email: string, password: string) {
  const config = getConfig();
  return Boolean(config.email && config.password && email === config.email && password === config.password);
}

export function createAdminSession(email: string, role = configuredAdminRole()) {
  const { secret } = getConfig();
  if (!secret) throw new Error('ADMIN_SESSION_SECRET is not configured');

  const payload: AdminSessionPayload = {
    email,
    role,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  };

  const encodedPayload = base64url(JSON.stringify(payload));
  return `${encodedPayload}.${sign(encodedPayload, secret)}`;
}

export function readAdminSession(value?: string): AdminSessionPayload | null {
  const { email, secret } = getConfig();
  if (!value || !email || !secret) return null;

  const [payload, signature] = value.split('.');
  if (!payload || !signature) return null;

  const expected = sign(payload, secret);
  const validSignature =
    signature.length === expected.length && crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  if (!validSignature) return null;

  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Partial<AdminSessionPayload>;
    if (
      typeof data.email !== 'string' ||
      typeof data.exp !== 'number' ||
      data.email !== email ||
      data.exp <= Math.floor(Date.now() / 1000)
    ) return null;
    return { email: data.email, role: isRole(data.role) ? data.role : configuredAdminRole(), exp: data.exp };
  } catch {
    return null;
  }
}

export function verifyAdminSession(value?: string) {
  return Boolean(readAdminSession(value));
}

/**
 * Resolve o papel pelo perfil persistido quando a base estiver disponível.
 * O fallback configurável mantém o login funcional em ambientes sem D1.
 */
export async function resolveAdminRole(email: string): Promise<Role> {
  const fallback = configuredAdminRole();

  try {
    const db = await getCloudflareAdminDb();
    const profile = await db?.prepare('SELECT role, active FROM profiles WHERE lower(email) = lower(?) LIMIT 1').bind(email).first<{ role?: unknown; active?: unknown }>();
    if (profile && Boolean(profile.active) && isRole(profile.role)) return profile.role;
  } catch {
    // A sessão ainda pode ser criada com o papel configurado durante uma indisponibilidade do banco.
  }

  return fallback;
}
