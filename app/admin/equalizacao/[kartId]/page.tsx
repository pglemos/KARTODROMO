import { AdminShell } from '@/components/admin/AdminShell';
import { requireAdminSession } from '@/lib/require-admin-session';
import { LegacyAuthProvider } from '@/src/admin/auth/AuthContext';
import { EqualizacaoKartDetailPage } from '@/src/admin/modules/equalizacao/EqualizacaoKartDetailPage';
import { ToastProvider } from '@/src/admin/ui/useToast';
import { canAccess } from '@/src/admin/lib/rbac';
import { AdminAccessDenied } from '@/components/admin/AdminAccessDenied';

export const dynamic = 'force-dynamic';

export default async function EqualizacaoKartDetailRoute({
  params,
}: {
  params: Promise<{ kartId: string }>;
}) {
  const { kartId } = await params;
  const session = await requireAdminSession(`/admin/equalizacao/${kartId}`);

  return (
    <AdminShell currentPath="/admin/equalizacao" sessionEmail={session.email} sessionRole={session.role} title="Detalhe da equalização">
      {canAccess(session.role, 'equalizacao') ? (
        <LegacyAuthProvider email={session.email} role={session.role}>
          <ToastProvider>
            <div className="mx-auto max-w-[1500px]">
              <EqualizacaoKartDetailPage kartId={kartId} />
            </div>
          </ToastProvider>
        </LegacyAuthProvider>
      ) : <AdminAccessDenied role={session.role} />}
    </AdminShell>
  );
}
