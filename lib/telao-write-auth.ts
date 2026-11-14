import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { adminCookieName, verifyAdminSession } from '@/lib/admin-auth';

/**
 * Quem pode gravar nas rotas do telão (layout, playlist, modo do TB50, página, programas do Viplex, upload).
 *
 * Antes de 13/11/2026 qualquer pessoa na internet podia mudar o telão ou enviar arquivos para o R2.
 * Agora só passa:
 *   1. o painel, com a sessão do admin (cookie);
 *   2. um serviço com o cabeçalho x-telao-key igual a TELAO_WRITE_KEY (se a variável existir);
 *   3. um script na própria máquina (127.0.0.1/localhost), sem passar por túnel ou proxy.
 *
 * No Cloudflare o host nunca é local e cf-connecting-ip sempre vem, então a regra 3 só vale
 * para o Next que roda dentro do kartódromo.
 */

const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]', '::1']);
const PROXY_HEADERS = ['cf-connecting-ip', 'cf-ray', 'x-forwarded-for', 'x-forwarded-host', 'x-real-ip', 'forwarded'];

function hostname(host: string) {
  const value = host.trim().toLowerCase();
  if (value.startsWith('[')) return value.slice(0, value.indexOf(']') + 1);
  return value.split(':')[0];
}

function isLocalRequest(headers: Headers) {
  if (PROXY_HEADERS.some((name) => headers.has(name))) return false;
  return LOOPBACK_HOSTS.has(hostname(headers.get('host') ?? ''));
}

function hasWriteKey(headers: Headers) {
  const expected = process.env.TELAO_WRITE_KEY;
  const received = headers.get('x-telao-key');
  if (!expected || !received) return false;
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function sessionCookie(headers: Headers) {
  const prefix = `${adminCookieName()}=`;
  for (const part of (headers.get('cookie') ?? '').split(';')) {
    const item = part.trim();
    if (item.startsWith(prefix)) return decodeURIComponent(item.slice(prefix.length));
  }
  return undefined;
}

export function canWriteTelao(request: Request) {
  const { headers } = request;
  return verifyAdminSession(sessionCookie(headers)) || hasWriteKey(headers) || isLocalRequest(headers);
}

/** Devolve a resposta 401 quando a gravação não é permitida; null quando pode seguir. */
export function denyTelaoWrite(request: Request) {
  if (canWriteTelao(request)) return null;
  return NextResponse.json({ error: 'unauthorized' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
}
