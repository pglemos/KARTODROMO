import { DesignerTelaoClient } from './DesignerTelaoClient';
import { AdminShell } from '@/components/admin/AdminShell';
import { requireAdminSession } from '@/lib/require-admin-session';

export const dynamic = 'force-dynamic';

export default async function DesignerTelaoPage() {
  const session = await requireAdminSession('/designer-telao');

  return (
    <AdminShell currentPath="/admin/telao" sessionEmail={session.email} title="Designer do telão">
      <DesignerTelaoClient />
    </AdminShell>
  );
}
