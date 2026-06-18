import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { DEFAULT_UID } from '@/lib/livetime/demo-data';
import { adminCookieName, verifyAdminSession } from '@/lib/admin-auth';
import { HomeDashboard } from '../../HomeDashboard';
import '../../home.css';

export default async function AdminTelaoPage() {
  const cookieStore = await cookies();
  const session = cookieStore.get(adminCookieName())?.value;

  if (!verifyAdminSession(session)) {
    redirect('/login?next=/admin/telao');
  }

  const uid = process.env.NEXT_PUBLIC_DEFAULT_UID || DEFAULT_UID;
  return <HomeDashboard uid={uid} />;
}
