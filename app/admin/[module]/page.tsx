import { notFound } from 'next/navigation';
import { AdminShell } from '@/components/admin/AdminShell';
import { LegacyAdminContent } from '@/components/admin/LegacyAdminContent';
import { getAdminModule } from '@/components/admin/navigation';
import { requireAdminSession } from '@/lib/require-admin-session';
import { canAccess } from '@/src/admin/lib/rbac';
import { AdminAccessDenied } from '@/components/admin/AdminAccessDenied';

export default async function AdminModuleRoute({ params }: { params: Promise<{ module: string }> }) {
  const { module: moduleKey } = await params;
  const module = getAdminModule(moduleKey);

  if (!module || module.key === 'dashboard' || module.key === 'telao') {
    notFound();
  }

  const session = await requireAdminSession(module.href);

  return (
    <AdminShell currentPath={module.href} sessionEmail={session.email} sessionRole={session.role} title={module.title}>
      {canAccess(session.role, module.key) ? (
        <LegacyAdminContent moduleKey={module.key} sessionEmail={session.email} sessionRole={session.role} />
      ) : (
        <AdminAccessDenied role={session.role} />
      )}
    </AdminShell>
  );
}
