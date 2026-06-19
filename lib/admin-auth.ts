import crypto from 'node:crypto';

const COOKIE_NAME = 'kartodromo_admin_session';
const SESSION_TTL_SECONDS = 60 * 60 * 12;

export type AdminSessionPayload = {
  email: string;
  exp: number;
};

function getConfig() {
  return {
    email: process.env.ADMIN_EMAIL,
    password: process.env.ADMIN_PASSWORD,
    secret: process.env.ADMIN_SESSION_SECRET,
  };
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

export function createAdminSession(email: string) {
  const { secret } = getConfig();
  if (!secret) throw new Error('ADMIN_SESSION_SECRET is not configured');

  const payload: AdminSessionPayload = {
    email,
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
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as AdminSessionPayload;
    if (data.email !== email || data.exp <= Math.floor(Date.now() / 1000)) return null;
    return data;
  } catch {
    return null;
  }
}

export function verifyAdminSession(value?: string) {
  return Boolean(readAdminSession(value));
}
