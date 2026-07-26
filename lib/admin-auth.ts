const COOKIE_NAME = 'kartodromo_admin_session';
const SESSION_TTL_SECONDS = 60 * 60 * 12;

export type AdminSessionPayload = {
  email: string;
  exp: number;
};

type AdminConfig = { email: string; password: string; secret: string };

function getConfig(): AdminConfig {
  const email = process.env.ADMIN_EMAIL || '';
  const password = process.env.ADMIN_PASSWORD || '';
  const secret = process.env.ADMIN_SESSION_SECRET || '';

  if (!email || !password || !secret) {
    throw new Error('ADMIN_EMAIL, ADMIN_PASSWORD, and ADMIN_SESSION_SECRET environment variables are required');
  }

  return { email, password, secret };
}

function base64urlEncode(str: string): string {
  try {
    const base64 = btoa(
      encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, p1) =>
        String.fromCharCode(parseInt(p1, 16))
      )
    );
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  } catch {
    return '';
  }
}

function base64urlDecode(str: string): string {
  try {
    let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }
    const decoded = atob(base64);
    return decodeURIComponent(
      Array.prototype.map
        .call(decoded, (c: string) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
  } catch {
    return '';
  }
}

function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

function sign(payload: string, secret: string): string {
  const crypto = require('crypto');
  return crypto.createHmac('sha256', secret).update(payload).digest('base64url');
}

export function adminCookieName() {
  return COOKIE_NAME;
}

export function adminSessionTtlSeconds() {
  return SESSION_TTL_SECONDS;
}

export function adminAuthConfigured() {
  try {
    getConfig();
    return true;
  } catch {
    return false;
  }
}

export function validateAdminCredentials(email: string, password: string) {
  const config = getConfig();
  return email.toLowerCase() === config.email.toLowerCase() && password === config.password;
}

export function createAdminSession(email: string) {
  const { secret } = getConfig();
  const payload: AdminSessionPayload = {
    email,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  };

  const encodedPayload = base64urlEncode(JSON.stringify(payload));
  return `${encodedPayload}.${sign(encodedPayload, secret)}`;
}

export function readAdminSession(value?: string): AdminSessionPayload | null {
  if (!value) return null;
  const config = getConfig();

  const [payload, signature] = value.split('.');
  if (!payload || !signature) return null;

  try {
    const expected = sign(payload, config.secret);
    if (!safeCompare(signature, expected)) return null;

    const jsonStr = base64urlDecode(payload);
    if (!jsonStr) return null;

    const data = JSON.parse(jsonStr) as AdminSessionPayload;
    if (data.exp <= Math.floor(Date.now() / 1000)) return null;
    return data;
  } catch {
    return null;
  }
}

export function verifyAdminSession(value?: string) {
  return Boolean(readAdminSession(value));
}
