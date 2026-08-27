import { DesignerTelaoClient } from './DesignerTelaoClient';
import { AdminShell } from '@/components/admin/AdminShell';
import { requireAdminSession } from '@/lib/require-admin-session';
import { canAccess } from '@/src/admin/lib/rbac';
import { AdminAccessDenied } from '@/components/admin/AdminAccessDenied';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Designer do telão',
};

export const dynamic = 'force-dynamic';

export default async function DesignerTelaoPage() {
  const session = await requireAdminSession('/designer-telao');

  return (
    <AdminShell currentPath="/admin/telao" sessionEmail={session.email} sessionRole={session.role} title="Designer do telão">
      {canAccess(session.role, 'telao') ? <DesignerTelaoClient /> : <AdminAccessDenied role={session.role} />}
    </AdminShell>
  );
}
