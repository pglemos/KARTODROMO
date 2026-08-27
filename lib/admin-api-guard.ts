import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { adminCookieName, readAdminSession } from '@/lib/admin-auth';
import { canAccess, canWrite, type ModuleKey } from '@/src/admin/lib/rbac';

export async function requireAdminPermission(moduleKey: ModuleKey, write = false, request?: NextRequest) {
  const cookieStore = request?.cookies || await cookies();
  const session = readAdminSession(cookieStore.get(adminCookieName())?.value);

  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!canAccess(session.role, moduleKey) || (write && !canWrite(session.role, moduleKey))) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  return null;
}
