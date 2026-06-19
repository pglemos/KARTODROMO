import { AdminShell } from '@/components/admin/AdminShell';
import { LegacyAdminContent } from '@/components/admin/LegacyAdminContent';
import { requireAdminSession } from '@/lib/require-admin-session';

export default async function AdminPage() {
  const session = await requireAdminSession('/admin');

  return (
    <AdminShell currentPath="/admin" sessionEmail={session.email} title="Dashboard">
      <LegacyAdminContent moduleKey="dashboard" sessionEmail={session.email} />
    </AdminShell>
  );
}
