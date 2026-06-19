import { DEFAULT_UID } from '@/lib/livetime/demo-data';
import { AdminShell } from '@/components/admin/AdminShell';
import { requireAdminSession } from '@/lib/require-admin-session';
import { HomeDashboard } from '../../HomeDashboard';
import '../../home.css';

export default async function AdminTelaoPage() {
  const session = await requireAdminSession('/admin/telao');
  const uid = process.env.NEXT_PUBLIC_DEFAULT_UID || DEFAULT_UID;
  return (
    <AdminShell currentPath="/admin/telao" sessionEmail={session.email} title="Telão">
      <HomeDashboard uid={uid} />
    </AdminShell>
  );
}
