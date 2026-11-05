import { scryptSync } from 'node:crypto';

import { cpfValido, digitos } from '../validar';
import { clienteExistente, type MobileClientesEnv } from './clientes';
import {
  mobileEmailConfigured,
  sendMobileAccountDeletionEmail, sendMobileAuthEmail,
  type MobileEmailEnv,
  type MobileEmailPurpose,
} from './email';

export interface MobileAuthEnv extends MobileEmailEnv {
  MOBILE_DB?: D1Database;
  MOBILE_LOOKUP_KEY?: string;
  MOBILE_DATA_KEY?: string;
}

export interface MobileAccountAdminEnv extends MobileAuthEnv {
  MOBILE_ADMIN_TOKEN?: string;
  MOBILE_PUBLISH_TOKEN?: string;
}

export interface MobileAccount {
  id: string;
  name: string;
  email: string;
  cpf: string;
  phone: string;
}

interface CryptoContext {
  db: D1Database;
  lookupKey: CryptoKey;
  dataKey: CryptoKey;
}

interface AccountRow {
  id: string;
  name_cipher: string;
  email_lookup: string;
  email_cipher: string;
  cpf_lookup: string;
  cpf_cipher: string;
  phone_cipher: string;
  password_salt: string;
  password_hash: string;
  password_iterations: number;
  password_scheme: string;
  email_verified_at: number | null;
  deleted_at: number | null;
}

const ITERATIONS = 600_000;
const PASSWORD_SCHEME = 'scrypt-32768-8-3-v1';
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 128;
const ACCESS_TTL = 15 * 60_000;
const REFRESH_TTL = 30 * 24 * 60 * 60_000;
const RATE_WINDOW = 10 * 60_000;
const DELETION_GRACE = 30 * 24 * 60 * 60 * 1000;
const RATE_LIMIT = 6;
// o Wi-Fi do kartódromo põe todo mundo atrás do mesmo IP: o limite por IP é bem mais alto que o por conta
const RATE_LIMIT_IP = 60;
const TOKEN_TTL = 30 * 60_000;
const encoder = new TextEncoder();
const authError = 'E-mail/CPF ou senha inválidos.';
const genericMessage = 'Se os dados puderem ser processados, enviaremos as instruções ao e-mail informado.';

const json = (status: number, value: unknown) =>
  new Response(JSON.stringify(value), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });

function encodeBase64Url(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function decodeBase64Url(value: string) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (value.length % 4)) % 4);
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
}

async function createContext(env: MobileAuthEnv): Promise<CryptoContext | null> {
  if (!env.MOBILE_DB || !env.MOBILE_LOOKUP_KEY || !env.MOBILE_DATA_KEY) return null;
  if (encoder.encode(env.MOBILE_LOOKUP_KEY).length < 32) return null;

  const dataKeyBytes = decodeBase64Url(env.MOBILE_DATA_KEY);
  if (dataKeyBytes.length !== 32) return null;

  const [lookupKey, dataKey] = await Promise.all([
    crypto.subtle.importKey(
      'raw',
      encoder.encode(env.MOBILE_LOOKUP_KEY),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    ),
    crypto.subtle.importKey('raw', dataKeyBytes, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']),
  ]);
  return { db: env.MOBILE_DB, lookupKey, dataKey };
}

async function hmac(context: CryptoContext, value: string) {
  return encodeBase64Url(new Uint8Array(await crypto.subtle.sign('HMAC', context.lookupKey, encoder.encode(value))));
}

async function sha256(value: string) {
  return encodeBase64Url(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value))));
}

function randomToken() {
  return encodeBase64Url(crypto.getRandomValues(new Uint8Array(32)));
}

async function encrypt(context: CryptoContext, value: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    context.dataKey,
    encoder.encode(value),
  );
  const packed = new Uint8Array(iv.length + ciphertext.byteLength);
  packed.set(iv);
  packed.set(new Uint8Array(ciphertext), iv.length);
  return encodeBase64Url(packed);
}

async function decrypt(context: CryptoContext, value: string) {
  const packed = decodeBase64Url(value);
  const clear = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: packed.slice(0, 12) },
    context.dataKey,
    packed.slice(12),
  );
  return new TextDecoder().decode(clear);
}

export async function mobileAccountCpf(env: MobileAuthEnv, accountId: string): Promise<string | null> {
  const context = await createContext(env);
  if (!context) return null;
  const row = await context.db.prepare('SELECT cpf_cipher FROM mobile_accounts WHERE id = ? LIMIT 1')
    .bind(accountId).first<{ cpf_cipher: string }>();
  return row ? decrypt(context, row.cpf_cipher) : null;
}

/**
 * Contas com e-mail confirmado e ainda sem vínculo com um cliente da recepção. Só o SRVKART pede (chave de
 * administração): ele procura o cliente pelo CPF e só vincula se o e-mail ou o telefone também baterem.
 */
export async function mobileIdentityCandidates(env: MobileAuthEnv, limit = 50) {
  const context = await createContext(env);
  if (!context) return null;
  // sem vínculo, ou com vínculo só por CPF (pode subir para 'completo' quando a recepção corrigir e-mail/telefone)
  const { results } = await context.db.prepare(
    `SELECT a.email_cipher, a.cpf_cipher, a.phone_cipher, l.nivel nivel FROM mobile_accounts a
       LEFT JOIN mobile_identity_links l ON l.account_id = a.id
      WHERE a.email_verified_at IS NOT NULL
        AND a.deleted_at IS NULL
        AND (l.account_id IS NULL OR l.nivel = 'cpf')
      ORDER BY (l.account_id IS NOT NULL), a.email_verified_at DESC LIMIT ?`,
  ).bind(limit).all<{ email_cipher: string; cpf_cipher: string; phone_cipher: string; nivel: string | null }>();
  return Promise.all(results.map(async (row) => ({
    email: await decrypt(context, row.email_cipher),
    cpf: await decrypt(context, row.cpf_cipher),
    phone: await decrypt(context, row.phone_cipher),
    nivel: row.nivel,
  })));
}

async function passwordHash(password: string, salt: Uint8Array, scheme = PASSWORD_SCHEME) {
  if (scheme === PASSWORD_SCHEME) {
    return encodeBase64Url(scryptSync(password, salt, 32, { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 }));
  }
  if (scheme !== 'pbkdf2-sha256-v1') throw new Error('Unsupported password scheme');
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const saltBuffer = new ArrayBuffer(salt.byteLength);
  new Uint8Array(saltBuffer).set(salt);
  const derived = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: saltBuffer, iterations: ITERATIONS },
    key,
    256,
  );
  return encodeBase64Url(new Uint8Array(derived));
}

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index++) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function normalizeIdentifier(value: string) {
  const trimmed = value.trim();
  return trimmed.includes('@') ? normalizeEmail(trimmed) : digitos(trimmed);
}

function clientIp(request: Request) {
  return request.headers.get('cf-connecting-ip') ?? 'unknown';
}

async function overLimit(context: CryptoContext, scope: string, limit = RATE_LIMIT) {
  const now = Date.now();
  const key = await hmac(context, scope);
  const row = await context.db
    .prepare(
      `INSERT INTO mobile_auth_attempts(scope_hash, window_started_at, attempt_count)
       VALUES (?, ?, 1)
       ON CONFLICT(scope_hash) DO UPDATE SET
         attempt_count = CASE
           WHEN mobile_auth_attempts.window_started_at + ? <= ? THEN 1
           ELSE mobile_auth_attempts.attempt_count + 1
         END,
         window_started_at = CASE
           WHEN mobile_auth_attempts.window_started_at + ? <= ? THEN ?
           ELSE mobile_auth_attempts.window_started_at
         END
       RETURNING attempt_count`,
    )
    .bind(key, now, RATE_WINDOW, now, RATE_WINDOW, now, now)
    .first<{ attempt_count: number }>();
  await context.db
    .prepare('DELETE FROM mobile_auth_attempts WHERE window_started_at + ? < ?')
    .bind(24 * 60 * 60_000, now)
    .run();
  return Number(row?.attempt_count ?? limit + 1) > limit;
}

async function rateLimited(context: CryptoContext, request: Request, route: string, identifier = '') {
  const ipLimit = await overLimit(context, `${route}:ip:${clientIp(request)}`, RATE_LIMIT_IP);
  if (ipLimit) return true;
  return identifier ? overLimit(context, `${route}:id:${identifier}`) : false;
}

async function requestBody(request: Request): Promise<Record<string, unknown> | null> {
  const contentType = request.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase();
  const contentLength = Number(request.headers.get('content-length'));
  if (contentType !== 'application/json' || contentLength > 16_384 || !request.body) return null;

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 16_384) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } catch {
    return null;
  }

  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    const value: unknown = JSON.parse(new TextDecoder().decode(bytes));
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function value(input: Record<string, unknown>, key: string) {
  return typeof input[key] === 'string' ? (input[key] as string) : '';
}

function acceptedRegistration() {
  return json(202, { mensagem: genericMessage });
}

async function validateRegistration(input: Record<string, unknown>) {
  const name = value(input, 'name').replace(/\s+/g, ' ').trim();
  const email = normalizeEmail(value(input, 'email'));
  const cpf = digitos(value(input, 'cpf'));
  const phone = digitos(value(input, 'phone'));
  const password = value(input, 'password');

  if (password.length < PASSWORD_MIN) return { error: 'A senha deve ter pelo menos 8 caracteres.' } as const;
  if (password.length > PASSWORD_MAX) return { error: 'A senha deve ter no máximo 128 caracteres.' } as const;
  if (
    name.length < 3 ||
    name.length > 120 ||
    name.split(' ').length < 2 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) ||
    !cpfValido(cpf) ||
    phone.length < 10 ||
    phone.length > 13 ||
    input.privacyAccepted !== true
  ) {
    return { error: 'Revise os dados informados e aceite a política de privacidade.' } as const;
  }

  return { value: { name, email, cpf, phone, password } } as const;
}

async function findAccount(context: CryptoContext, identifier: string) {
  if (identifier.includes('@')) {
    const lookup = await hmac(context, `email:${normalizeEmail(identifier)}`);
    return context.db
      .prepare(
        `SELECT id, name_cipher, email_lookup, email_cipher, cpf_lookup, cpf_cipher,
                phone_cipher, password_salt, password_hash, password_iterations, password_scheme, email_verified_at, deleted_at
         FROM mobile_accounts WHERE email_lookup = ? LIMIT 1`,
      )
      .bind(lookup)
      .first<AccountRow>();
  }

  const lookup = await hmac(context, `cpf:${digitos(identifier)}`);
  return context.db
    .prepare(
      `SELECT id, name_cipher, email_lookup, email_cipher, cpf_lookup, cpf_cipher,
              phone_cipher, password_salt, password_hash, password_iterations, password_scheme, email_verified_at, deleted_at
       FROM mobile_accounts WHERE cpf_lookup = ? LIMIT 1`,
    )
    .bind(lookup)
    .first<AccountRow>();
}

async function createEmailToken(context: CryptoContext, accountId: string, purpose: MobileEmailPurpose) {
  const now = Date.now();
  const token = randomToken();
  const tokenHash = await sha256(token);
  await context.db.prepare('DELETE FROM mobile_email_tokens WHERE expires_at <= ?').bind(now).run();
  await context.db
    .prepare(
      `INSERT INTO mobile_email_tokens(token_hash, account_id, purpose, expires_at, used_at, created_at)
       VALUES (?, ?, ?, ?, NULL, ?)`,
    )
    .bind(tokenHash, accountId, purpose, now + TOKEN_TTL, now)
    .run();
  return token;
}

async function deliverEmail(
  env: MobileAuthEnv,
  context: CryptoContext,
  account: Pick<AccountRow, 'id' | 'email_cipher'>,
  purpose: MobileEmailPurpose,
) {
  const email = await decrypt(context, account.email_cipher);
  const token = await createEmailToken(context, account.id, purpose);
  const delivered = await sendMobileAuthEmail(env, email, purpose, token);
  if (!delivered) throw new Error('Mobile email delivery unavailable');
}

async function register(
  request: Request,
  input: Record<string, unknown>,
  env: MobileAuthEnv,
  context: CryptoContext,
) {
  if (!mobileEmailConfigured(env)) return json(503, { erro: 'Cadastro temporariamente indisponível.' });

  const checked = await validateRegistration(input);
  if ('error' in checked) return json(400, { erro: checked.error });
  if (await rateLimited(context, request, 'register', checked.value.email)) {
    return json(429, { erro: 'Muitas tentativas. Aguarde alguns minutos.' });
  }

  const { name, email, cpf, phone, password } = checked.value;
  const [nameCipher, emailCipher, cpfCipher, phoneCipher, emailLookup, cpfLookup] = await Promise.all([
    encrypt(context, name),
    encrypt(context, email),
    encrypt(context, cpf),
    encrypt(context, phone),
    hmac(context, `email:${email}`),
    hmac(context, `cpf:${cpf}`),
  ]);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const passwordDigest = await passwordHash(password, salt);
  const id = crypto.randomUUID();
  const now = Date.now();

  try {
    await context.db
      .prepare(
        `INSERT INTO mobile_accounts(
          id, name_cipher, email_lookup, email_cipher, cpf_lookup, cpf_cipher, phone_cipher,
          password_salt, password_hash, password_iterations, password_scheme, email_verified_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
      )
      .bind(
        id,
        nameCipher,
        emailLookup,
        emailCipher,
        cpfLookup,
        cpfCipher,
        phoneCipher,
        encodeBase64Url(salt),
        passwordDigest,
        ITERATIONS,
        PASSWORD_SCHEME,
        now,
      )
      .run();
  } catch (error) {
    if (String(error).includes('UNIQUE constraint failed')) {
      const existing = await findAccount(context, email);
      if (existing?.cpf_lookup === cpfLookup && existing.email_verified_at === null) {
        await deliverEmail(env, context, existing, 'verify');
      }
      return acceptedRegistration();
    }
    throw error;
  }

  await deliverEmail(env, context, { id, email_cipher: emailCipher }, 'verify');
  return acceptedRegistration();
}

async function createSession(context: CryptoContext, accountId: string) {
  const now = Date.now();
  const accessToken = randomToken();
  const refreshToken = randomToken();
  const accessExpiresAt = now + ACCESS_TTL;
  const refreshExpiresAt = now + REFRESH_TTL;
  await context.db
    .prepare(
      `INSERT INTO mobile_sessions(
        id, account_id, access_token_hash, refresh_token_hash,
        access_expires_at, refresh_expires_at, created_at, revoked_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL)`,
    )
    .bind(
      crypto.randomUUID(),
      accountId,
      await sha256(accessToken),
      await sha256(refreshToken),
      accessExpiresAt,
      refreshExpiresAt,
      now,
    )
    .run();
  await context.db
    .prepare('DELETE FROM mobile_sessions WHERE refresh_expires_at <= ? OR revoked_at < ?')
    .bind(now, now - REFRESH_TTL)
    .run();
  return {
    accessToken,
    refreshToken,
    accessTokenExpiresAt: new Date(accessExpiresAt).toISOString(),
    refreshTokenExpiresAt: new Date(refreshExpiresAt).toISOString(),
  };
}

async function passwordMatches(account: AccountRow, password: string) {
  if (password.length === 0 || password.length > PASSWORD_MAX) return false;
  const salt = decodeBase64Url(account.password_salt);
  const scheme = account.password_scheme ?? PASSWORD_SCHEME;
  if (constantTimeEqual(await passwordHash(password, salt, scheme), account.password_hash)) return true;
  // mesma tolerância do login: senhas antigas podem ter sido gravadas sem os espaços das pontas
  const limpa = password.trim();
  return limpa !== password && limpa.length >= PASSWORD_MIN && constantTimeEqual(await passwordHash(limpa, salt, scheme), account.password_hash);
}

async function auditDeletion(
  context: CryptoContext,
  request: Request,
  accountId: string,
  action: 'requested' | 'restored' | 'purged',
  sessionId: string | null,
  now: number,
) {
  const ip = action === 'purged' ? null : await hmac(context, `ip:${clientIp(request)}`);
  const agent = action === 'purged' ? null : (request.headers.get('user-agent') ?? '').slice(0, 200) || null;
  return context.db
    .prepare('INSERT INTO mobile_account_deletion_audit(id, account_id, action, session_id, ip_hash, user_agent, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(crypto.randomUUID(), accountId, action, sessionId, ip, agent, now);
}

/** O Worker não tem cron: quem vence o prazo é apagado na próxima exclusão ou login. */
async function purgeExpiredAccounts(context: CryptoContext, request: Request) {
  const now = Date.now();
  const { results } = await context.db
    .prepare('SELECT id FROM mobile_accounts WHERE deleted_at IS NOT NULL AND deleted_at <= ? LIMIT 20')
    .bind(now - DELETION_GRACE)
    .all<{ id: string }>();
  for (const { id } of results) {
    await context.db.batch([
      await auditDeletion(context, request, id, 'purged', null, now),
      context.db.prepare('DELETE FROM mobile_sessions WHERE account_id = ?').bind(id),
      context.db.prepare('DELETE FROM mobile_email_tokens WHERE account_id = ?').bind(id),
      context.db.prepare('DELETE FROM mobile_coupon_previews WHERE account_id = ?').bind(id),
      context.db.prepare('DELETE FROM mobile_identity_links WHERE account_id = ?').bind(id),
      context.db.prepare('DELETE FROM mobile_orders WHERE account_id = ?').bind(id),
      context.db.prepare('DELETE FROM mobile_accounts WHERE id = ?').bind(id),
    ]);
    console.info('mobile-account-purged', { accountId: id, purgedAt: now });
  }
}

async function restoreAccount(request: Request, input: Record<string, unknown>, context: CryptoContext) {
  const identifier = normalizeIdentifier(value(input, 'identifier'));
  if (await rateLimited(context, request, 'restore', identifier)) {
    return json(429, { erro: 'Muitas tentativas. Aguarde alguns minutos.' });
  }
  const account = identifier ? await findAccount(context, identifier) : null;
  const now = Date.now();
  if (!account || !(await passwordMatches(account, value(input, 'password')))
    || account.deleted_at === null || account.deleted_at + DELETION_GRACE <= now) {
    return json(401, { erro: authError });
  }
  await context.db.batch([
    context.db.prepare('UPDATE mobile_accounts SET deleted_at = NULL WHERE id = ?').bind(account.id),
    await auditDeletion(context, request, account.id, 'restored', null, now),
  ]);
  console.info('mobile-account-restored', { accountId: account.id, restoredAt: now });
  if (account.email_verified_at === null) return json(403, { erro: 'Conta restaurada. Confirme seu e-mail para entrar.' });
  return json(200, await createSession(context, account.id));
}

async function login(request: Request, input: Record<string, unknown>, env: MobileAuthEnv, context: CryptoContext) {
  await purgeExpiredAccounts(context, request);
  const identifier = normalizeIdentifier(value(input, 'identifier'));
  if (await rateLimited(context, request, 'login', identifier)) {
    return json(429, { erro: 'Muitas tentativas. Aguarde alguns minutos.' });
  }

  const password = value(input, 'password');
  if (password.length === 0 || password.length > PASSWORD_MAX) return json(401, { erro: authError });

  const account = await findAccount(context, identifier);
  const salt = account ? decodeBase64Url(account.password_salt) : new Uint8Array(16);
  const candidate = await passwordHash(password, salt, account?.password_scheme ?? PASSWORD_SCHEME);
  let valid = Boolean(account && constantTimeEqual(candidate, account.password_hash));
  if (!valid && account && password.trim() !== password && password.trim().length >= PASSWORD_MIN) {
    const candidateTrimmed = await passwordHash(password.trim(), salt, account.password_scheme ?? PASSWORD_SCHEME);
    valid = constantTimeEqual(candidateTrimmed, account.password_hash);
  }
  if (!valid || !account) return json(401, { erro: authError });
  if (account.deleted_at !== null) {
    if (account.deleted_at + DELETION_GRACE <= Date.now()) return json(401, { erro: authError });
    return json(409, {
      codigo: 'CONTA_EM_EXCLUSAO',
      erro: 'Esta conta está marcada para exclusão. Restaure a conta para voltar a entrar.',
    });
  }
  if (account.email_verified_at === null) {
    // senha certa mas e-mail ainda não confirmado: reenvia o link em vez de dizer "senha inválida"
    if (mobileEmailConfigured(env)) await deliverEmail(env, context, account, 'verify');
    return json(403, { erro: 'Confirme seu e-mail para entrar. Reenviamos o link de confirmação; confira também o spam.' });
  }
  return json(200, await createSession(context, account.id));
}

async function verifyEmail(input: Record<string, unknown>, context: CryptoContext) {
  const token = value(input, 'token');
  if (!token) return json(400, { erro: 'Link inválido ou expirado.' });
  const now = Date.now();
  const tokenHash = await sha256(token);
  const tokenRow = await context.db
    .prepare(
      `UPDATE mobile_email_tokens SET used_at = ?
       WHERE token_hash = ? AND purpose = 'verify' AND used_at IS NULL AND expires_at > ?
       RETURNING account_id`,
    )
    .bind(now, tokenHash, now)
    .first<{ account_id: string }>();
  if (!tokenRow) return json(400, { erro: 'Link inválido ou expirado.' });
  await context.db
    .prepare('UPDATE mobile_accounts SET email_verified_at = ? WHERE id = ?')
    .bind(now, tokenRow.account_id)
    .run();
  await context.db
    .prepare("UPDATE mobile_email_tokens SET used_at = ? WHERE account_id = ? AND purpose = 'verify' AND used_at IS NULL")
    .bind(now, tokenRow.account_id)
    .run();
  return json(200, { ok: true });
}

async function forgotPassword(
  request: Request,
  input: Record<string, unknown>,
  env: MobileAuthEnv,
  context: CryptoContext,
) {
  if (!mobileEmailConfigured(env)) return json(503, { erro: 'Recuperação temporariamente indisponível.' });

  const identifier = normalizeIdentifier(value(input, 'identifier'));
  if (await rateLimited(context, request, 'forgot', identifier)) {
    return json(429, { erro: 'Muitas tentativas. Aguarde alguns minutos.' });
  }
  const account = identifier ? await findAccount(context, identifier) : null;
  if (account) await deliverEmail(env, context, account, account.email_verified_at === null ? 'verify' : 'reset');
  // "esqueci o e-mail": pedido pelo CPF mostra para onde foi (mascarado). Se não for o dele, o app oferece
  // "errei meu e-mail" (conta não confirmada) ou a recepção. Pelo e-mail continua a resposta genérica.
  if (account && /^\d{11}$/.test(identifier)) {
    const email = await decrypt(context, account.email_cipher);
    return json(202, {
      mensagem: `Enviamos o link para ${mascararEmail(email)}. Confira também o spam.`,
      emailMascarado: mascararEmail(email),
      emailConfirmado: account.email_verified_at !== null,
    });
  }
  return json(202, { mensagem: genericMessage });
}

export function mascararEmail(email: string) {
  const [usuario, dominio] = email.trim().toLowerCase().split('@');
  if (!usuario || !dominio) return '•••';
  return `${usuario.slice(0, Math.min(2, usuario.length - 1) || 1)}•••@${dominio}`;
}

async function resetPassword(input: Record<string, unknown>, context: CryptoContext) {
  const token = value(input, 'token');
  const password = value(input, 'password').trim();
  if (password.length < PASSWORD_MIN) {
    return json(400, { erro: 'A senha deve ter pelo menos 8 caracteres.' });
  }
  if (password.length > PASSWORD_MAX) {
    return json(400, { erro: 'A senha deve ter no máximo 128 caracteres.' });
  }
  if (!token) return json(400, { erro: 'Link inválido ou expirado.' });

  const now = Date.now();
  const tokenRow = await context.db
    .prepare(
      `UPDATE mobile_email_tokens SET used_at = ?
       WHERE token_hash = ? AND purpose = 'reset' AND used_at IS NULL AND expires_at > ?
       RETURNING account_id`,
    )
    .bind(now, await sha256(token), now)
    .first<{ account_id: string }>();
  if (!tokenRow) return json(400, { erro: 'Link inválido ou expirado.' });

  const salt = crypto.getRandomValues(new Uint8Array(16));
  await context.db
    .prepare(
      `UPDATE mobile_accounts
       SET password_salt = ?, password_hash = ?, password_iterations = ?, password_scheme = ?
       WHERE id = ?`,
    )
    .bind(encodeBase64Url(salt), await passwordHash(password, salt), ITERATIONS, PASSWORD_SCHEME, tokenRow.account_id)
    .run();
  await context.db
    .prepare('UPDATE mobile_sessions SET revoked_at = ? WHERE account_id = ? AND revoked_at IS NULL')
    .bind(now, tokenRow.account_id)
    .run();
  await context.db
    .prepare("UPDATE mobile_email_tokens SET used_at = ? WHERE account_id = ? AND purpose = 'reset' AND used_at IS NULL")
    .bind(now, tokenRow.account_id)
    .run();
  return json(200, { ok: true });
}

async function refreshSession(input: Record<string, unknown>, context: CryptoContext) {
  const refreshToken = value(input, 'refreshToken');
  if (!refreshToken) return json(401, { erro: 'Sessão inválida ou expirada.' });
  const now = Date.now();
  const rotated = await context.db
    .prepare(
      `UPDATE mobile_sessions SET revoked_at = ?
       WHERE refresh_token_hash = ? AND revoked_at IS NULL AND refresh_expires_at > ?
       RETURNING account_id`,
    )
    .bind(now, await sha256(refreshToken), now)
    .first<{ account_id: string }>();
  if (!rotated) return json(401, { erro: 'Sessão inválida ou expirada.' });
  return json(200, await createSession(context, rotated.account_id));
}

async function logout(request: Request, context: CryptoContext) {
  const match = /^Bearer\s+(.+)$/i.exec(request.headers.get('authorization') ?? '');
  if (match?.[1]) {
    await context.db
      .prepare('UPDATE mobile_sessions SET revoked_at = ? WHERE access_token_hash = ? AND revoked_at IS NULL')
      .bind(Date.now(), await sha256(match[1]))
      .run();
  }
  return new Response(null, {
    status: 204,
    headers: { 'cache-control': 'no-store' },
  });
}

async function deleteAccount(request: Request, input: Record<string, unknown>, env: MobileAuthEnv, context: CryptoContext) {
  const match = /^Bearer\s+(.+)$/i.exec(request.headers.get('authorization') ?? '');
  if (!match?.[1]) return json(401, { erro: 'Você precisa estar conectado.' });

  const tokenHash = await sha256(match[1]);
  const now = Date.now();
  const session = await context.db
    .prepare(
      `SELECT id, account_id FROM mobile_sessions
       WHERE access_token_hash = ? AND revoked_at IS NULL AND access_expires_at > ?
       LIMIT 1`,
    )
    .bind(tokenHash, now)
    .first<{ id: string; account_id: string }>();

  if (!session) return json(401, { erro: 'Sessão inválida ou expirada.' });
  if (await rateLimited(context, request, 'delete', session.account_id)) {
    return json(429, { erro: 'Muitas tentativas. Aguarde alguns minutos.' });
  }

  const accountId = session.account_id;
  const account = await context.db
    .prepare('SELECT id, email_cipher, password_salt, password_hash, password_scheme FROM mobile_accounts WHERE id = ? LIMIT 1')
    .bind(accountId)
    .first<AccountRow>();
  // sessão roubada ou aparelho destravado não bastam: excluir exige a senha
  if (!account || !(await passwordMatches(account, value(input, 'password')))) {
    return json(403, { codigo: 'SENHA_INCORRETA', erro: 'Senha incorreta. Sua conta não foi excluída.' });
  }

  await context.db.batch([
    context.db.prepare('UPDATE mobile_accounts SET deleted_at = ? WHERE id = ?').bind(now, accountId),
    await auditDeletion(context, request, accountId, 'requested', session.id, now),
    context.db.prepare('DELETE FROM mobile_sessions WHERE account_id = ?').bind(accountId),
    context.db.prepare('DELETE FROM mobile_email_tokens WHERE account_id = ?').bind(accountId),
  ]);

  console.info('mobile-account-deleted', {
    accountId, deletedAt: now, requestId: request.headers.get('cf-ray'),
  });
  // o aviso não pode desfazer a marcação: falha no envio fica só no log
  await sendMobileAccountDeletionEmail(env, await decrypt(context, account.email_cipher), new Date(now + DELETION_GRACE))
    .then((enviado) => { if (!enviado) console.error('mobile-account-deletion-email', 'not delivered'); })
    .catch(() => console.error('mobile-account-deletion-email', 'failed'));
  await purgeExpiredAccounts(context, request);

  return new Response(null, {
    status: 204,
    headers: { 'cache-control': 'no-store' },
  });
}

/** Corrige o endereço de uma conta ainda não confirmada, sem tocar na senha ou no histórico. */
export async function handleMobileAccountEmail(request: Request, env: MobileAccountAdminEnv) {
  if (request.method !== 'POST') return json(405, { erro: 'Método não permitido.' });
  if (!env.MOBILE_DB || !env.MOBILE_ADMIN_TOKEN || env.MOBILE_ADMIN_TOKEN === env.MOBILE_PUBLISH_TOKEN) {
    return json(503, { erro: 'Serviço temporariamente indisponível.' });
  }
  if (!constantTimeEqual(request.headers.get('x-mobile-admin-token') ?? '', env.MOBILE_ADMIN_TOKEN)) {
    return json(401, { erro: 'Não autorizado.' });
  }

  const context = await createContext(env);
  if (!context || !mobileEmailConfigured(env)) return json(503, { erro: 'Serviço temporariamente indisponível.' });
  const input = await requestBody(request);
  if (!input) return json(400, { erro: 'Envio inválido.' });

  const cpf = digitos(value(input, 'cpf'));
  const email = normalizeEmail(value(input, 'email'));
  if (!cpfValido(cpf) || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return json(400, { erro: 'Informe um CPF e um e-mail válidos.' });
  }

  const account = await findAccount(context, cpf);
  if (!account) return json(404, { erro: 'Conta não encontrada.' });
  return trocarEmailNaoConfirmado(env, context, account, email);
}

/**
 * Troca o e-mail de uma conta que nunca foi confirmada e manda o link de confirmação para o endereço novo.
 * Usado pela recepção (chave de administração) e pelo próprio cliente (CPF + senha: rota email/corrigir).
 */
async function trocarEmailNaoConfirmado(env: MobileAuthEnv, context: CryptoContext, account: AccountRow, email: string) {
  if (account.email_verified_at !== null) {
    return json(409, { codigo: 'EMAIL_JA_CONFIRMADO', erro: 'Esta conta já foi confirmada. Entre com seu CPF e senha.' });
  }
  const emailLookup = await hmac(context, `email:${email}`);
  const other = await context.db.prepare(
    'SELECT id FROM mobile_accounts WHERE email_lookup = ? AND id <> ? LIMIT 1',
  ).bind(emailLookup, account.id).first<{ id: string }>();
  if (other) return json(409, { erro: 'Este e-mail já está em outra conta.' });

  const emailCipher = await encrypt(context, email);
  try {
    await context.db.batch([
      context.db.prepare(
        'UPDATE mobile_accounts SET email_lookup = ?, email_cipher = ?, email_verified_at = NULL WHERE id = ? AND email_verified_at IS NULL',
      ).bind(emailLookup, emailCipher, account.id),
      context.db.prepare('DELETE FROM mobile_email_tokens WHERE account_id = ?').bind(account.id),
    ]);
  } catch (error) {
    if (String(error).includes('UNIQUE constraint failed')) return json(409, { erro: 'Este e-mail já está em outra conta.' });
    throw error;
  }

  await deliverEmail(env, context, { id: account.id, email_cipher: emailCipher }, 'verify');
  return json(202, { mensagem: `Pronto! Enviamos o link de confirmação para ${email}. Confira também o spam.` });
}

/**
 * "Errei meu e-mail": o cliente cadastrou um e-mail errado e o link de confirmação nunca chegou.
 * Prova que é dono da conta com CPF + senha (quem criou a conta sabe a senha) e informa o e-mail certo.
 * Só para conta ainda não confirmada: conta confirmada já entra com CPF e senha e não perde nada.
 */
async function corrigirEmail(request: Request, input: Record<string, unknown>, env: MobileAuthEnv, context: CryptoContext) {
  if (!mobileEmailConfigured(env)) return json(503, { erro: 'Serviço temporariamente indisponível.' });
  const cpf = digitos(value(input, 'cpf'));
  const email = normalizeEmail(value(input, 'email'));
  const password = value(input, 'password');
  if (await rateLimited(context, request, 'email-corrigir', cpf)) {
    return json(429, { erro: 'Muitas tentativas. Aguarde alguns minutos.' });
  }
  if (!cpfValido(cpf) || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return json(400, { erro: 'Informe o CPF da conta e o e-mail certo.' });
  }
  if (password.length === 0 || password.length > PASSWORD_MAX) return json(401, { erro: 'CPF ou senha inválidos.' });
  const account = await findAccount(context, cpf);
  // mesmo custo com ou sem conta (não revela se o CPF tem conta)
  const salt = account ? decodeBase64Url(account.password_salt) : new Uint8Array(16);
  const candidate = await passwordHash(password, salt, account?.password_scheme ?? PASSWORD_SCHEME);
  let valid = Boolean(account && constantTimeEqual(candidate, account.password_hash));
  if (!valid && account && password.trim() !== password && password.trim().length >= PASSWORD_MIN) {
    valid = constantTimeEqual(await passwordHash(password.trim(), salt, account.password_scheme ?? PASSWORD_SCHEME), account.password_hash);
  }
  if (!valid || !account || account.deleted_at !== null) return json(401, { erro: 'CPF ou senha inválidos.' });
  return trocarEmailNaoConfirmado(env, context, account, email);
}

export async function authenticateMobileRequest(
  request: Request,
  env: MobileAuthEnv,
): Promise<MobileAccount | null> {
  const match = /^Bearer\s+(.+)$/i.exec(request.headers.get('authorization') ?? '');
  if (!match?.[1]) return null;
  const context = await createContext(env);
  if (!context) return null;
  const now = Date.now();
  const row = await context.db
    .prepare(
      `SELECT a.id, a.name_cipher, a.email_cipher, a.cpf_cipher, a.phone_cipher
       FROM mobile_sessions s
       JOIN mobile_accounts a ON a.id = s.account_id
       WHERE s.access_token_hash = ? AND s.revoked_at IS NULL
         AND s.access_expires_at > ? AND a.email_verified_at IS NOT NULL
       LIMIT 1`,
    )
    .bind(await sha256(match[1]), now)
    .first<Pick<AccountRow, 'id' | 'name_cipher' | 'email_cipher' | 'cpf_cipher' | 'phone_cipher'>>();
  if (!row) return null;
  const [name, email, cpf, phone] = await Promise.all([
    decrypt(context, row.name_cipher),
    decrypt(context, row.email_cipher),
    decrypt(context, row.cpf_cipher),
    decrypt(context, row.phone_cipher),
  ]);
  return { id: row.id, name, email, cpf, phone };
}

export async function handleMobileAuth(request: Request, env: MobileAuthEnv) {
  const route = new URL(request.url).pathname.slice('/api/mobile/v1/auth/'.length);
  if (request.method !== 'POST') return json(405, { erro: 'Método não permitido.' });

  let context: CryptoContext | null;
  try {
    context = await createContext(env);
  } catch {
    context = null;
  }
  if (!context) return json(503, { erro: 'Serviço temporariamente indisponível.' });

  const input = await requestBody(request);
  if (!input) return json(400, { erro: 'Envio inválido.' });

  try {
    switch (route) {
      case 'cadastro-existente': {
        // cadastro do app: o CPF já tem conta no app ou cadastro no kartódromo? (não devolve e-mail, nem mascarado: a consulta é pública)
        if (await rateLimited(context, request, 'lookup')) return json(429, { erro: 'Muitas tentativas. Aguarde alguns minutos.' });
        const cpf = digitos(String(input.cpf ?? ''));
        if (!cpfValido(cpf)) return json(400, { erro: 'CPF inválido.' });
        const conta = await context.db.prepare('SELECT 1 FROM mobile_accounts WHERE cpf_lookup = ? LIMIT 1').bind(await hmac(context, `cpf:${cpf}`)).first();
        const cadastro = await clienteExistente(env as MobileClientesEnv, cpf).catch(() => null);
        return json(200, { contaApp: Boolean(conta), cadastro: cadastro !== null, email: null });
      }
      case 'register':
        return await register(request, input, env, context);
      case 'login':
        return await login(request, input, env, context);
      case 'email/verify':
        if (await rateLimited(context, request, 'verify')) {
          return json(429, { erro: 'Muitas tentativas. Aguarde alguns minutos.' });
        }
        return await verifyEmail(input, context);
      case 'email/corrigir':
        return await corrigirEmail(request, input, env, context);
      case 'password/forgot':
        return await forgotPassword(request, input, env, context);
      case 'password/reset':
        if (await rateLimited(context, request, 'reset')) {
          return json(429, { erro: 'Muitas tentativas. Aguarde alguns minutos.' });
        }
        return await resetPassword(input, context);
      case 'session/refresh':
        if (await rateLimited(context, request, 'refresh')) {
          return json(429, { erro: 'Muitas tentativas. Aguarde alguns minutos.' });
        }
        return await refreshSession(input, context);
      case 'session/logout':
        return await logout(request, context);
      case 'account/delete':
        return await deleteAccount(request, input, env, context);
      case 'account/restore':
        return await restoreAccount(request, input, context);
      default:
        return json(404, { erro: 'Rota desconhecida.' });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    console.error('mobile-auth', /iteration counts above \d+ are not supported/i.test(message)
      ? 'PBKDF2 iteration limit' : message.startsWith('D1_ERROR:') ? 'D1 operation failed' : 'Authentication operation failed');
    return json(503, { erro: 'Serviço temporariamente indisponível.' });
  }
}
