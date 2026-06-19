import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { adminCookieName, readAdminSession } from '@/lib/admin-auth';

export async function requireAdminSession(nextPath: string) {
  const cookieStore = await cookies();
  const session = readAdminSession(cookieStore.get(adminCookieName())?.value);

  if (!session) {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }

  return session;
}
