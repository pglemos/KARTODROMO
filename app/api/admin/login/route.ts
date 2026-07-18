import { NextRequest, NextResponse } from 'next/server';
import {
  adminAuthConfigured,
  adminCookieName,
  adminSessionTtlSeconds,
  createAdminSession,
  validateAdminCredentials,
} from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  if (!adminAuthConfigured()) {
    return NextResponse.json({ error: 'admin_auth_not_configured' }, { status: 503 });
  }

  const body = await request.json().catch(() => ({}));
  const email = String(body?.email || '').trim().toLowerCase();
  const password = String(body?.password || '');
  const remember = body?.remember !== false;

  if (!validateAdminCredentials(email, password)) {
    return NextResponse.json({ error: 'invalid_credentials' }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(adminCookieName(), createAdminSession(email), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    ...(remember ? { maxAge: adminSessionTtlSeconds() } : {}),
    path: '/',
  });
  return response;
}
