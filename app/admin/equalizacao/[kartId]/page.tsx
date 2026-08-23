import { AdminShell } from '@/components/admin/AdminShell';
import { requireAdminSession } from '@/lib/require-admin-session';
import { LegacyAuthProvider } from '@/src/admin/auth/AuthContext';
import { EqualizacaoKartDetailPage } from '@/src/admin/modules/equalizacao/EqualizacaoKartDetailPage';
import { ToastProvider } from '@/src/admin/ui/useToast';

export const dynamic = 'force-dynamic';

export default async function EqualizacaoKartDetailRoute({
  params,
}: {
  params: Promise<{ kartId: string }>;
}) {
  const { kartId } = await params;
  const session = await requireAdminSession(`/admin/equalizacao/${kartId}`);

  return (
    <AdminShell currentPath="/admin/equalizacao" sessionEmail={session.email} title="Detalhe da equalização">
      <LegacyAuthProvider email={session.email}>
        <ToastProvider>
          <div className="mx-auto max-w-[1500px]">
            <EqualizacaoKartDetailPage kartId={kartId} />
          </div>
        </ToastProvider>
      </LegacyAuthProvider>
    </AdminShell>
  );
}
