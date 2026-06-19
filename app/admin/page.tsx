import { AdminDashboard } from '@/components/admin/AdminDashboard';
import { AdminShell } from '@/components/admin/AdminShell';
import { requireAdminSession } from '@/lib/require-admin-session';

export default async function AdminPage() {
  const session = await requireAdminSession('/admin');

  return (
    <AdminShell currentPath="/admin" sessionEmail={session.email} title="Dashboard">
      <AdminDashboard />
    </AdminShell>
  );
}
