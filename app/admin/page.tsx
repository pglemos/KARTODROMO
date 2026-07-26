import { AdminShell } from '@/components/admin/AdminShell';
import { LegacyAdminContent } from '@/components/admin/LegacyAdminContentWrapper';
import { requireAdminSession } from '@/lib/require-admin-session';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const session = await requireAdminSession('/admin');

  return (
    <AdminShell currentPath="/admin" sessionEmail={session.email} title="Dashboard">
      <LegacyAdminContent moduleKey="dashboard" sessionEmail={session.email} />
    </AdminShell>
  );
}
