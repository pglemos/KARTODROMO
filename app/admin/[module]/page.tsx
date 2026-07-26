import { notFound } from 'next/navigation';
import { AdminShell } from '@/components/admin/AdminShell';
import { LegacyAdminContent } from '@/components/admin/LegacyAdminContentWrapper';
import { getAdminModule } from '@/components/admin/navigation';
import { requireAdminSession } from '@/lib/require-admin-session';

export const dynamic = 'force-dynamic';

export default async function AdminModuleRoute({ params }: { params: Promise<{ module: string }> }) {
  const { module: moduleKey } = await params;
  const module = getAdminModule(moduleKey);

  if (!module || module.key === 'dashboard' || module.key === 'telao') {
    notFound();
  }

  const session = await requireAdminSession(module.href);

  return (
    <AdminShell currentPath={module.href} sessionEmail={session.email} title={module.title}>
      <LegacyAdminContent moduleKey={module.key} sessionEmail={session.email} />
    </AdminShell>
  );
}
