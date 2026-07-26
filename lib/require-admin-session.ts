import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { adminCookieName, readAdminSession } from '@/lib/admin-auth';

export async function requireAdminSession(nextPath: string) {
  try {
    const cookieStore = await cookies();
    const cookieVal = cookieStore.get(adminCookieName())?.value;
    const session = readAdminSession(cookieVal);

    if (session) {
      return session;
    }
  } catch {
    // Edge environment cookies fallback
  }

  // Redirect to login if no valid session
  const loginUrl = `/admin/login${nextPath && nextPath !== '/admin' ? `?next=${encodeURIComponent(nextPath)}` : ''}`;
  redirect(loginUrl);
}
