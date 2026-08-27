import { AdminShell } from '@/components/admin/AdminShell';
import { requireAdminSession } from '@/lib/require-admin-session';
import { ResultadoRacingDetailPage } from '@/src/admin/modules/resultados/ResultadoRacingDetailPage';
import { canAccess } from '@/src/admin/lib/rbac';
import { AdminAccessDenied } from '@/components/admin/AdminAccessDenied';

export const dynamic = 'force-dynamic';

export default async function ResultadoRacingDetailRoute({
  params,
}: {
  params: Promise<{ racingId: string }>;
}) {
  const { racingId } = await params;
  const session = await requireAdminSession(`/admin/resultados/${racingId}`);

  return (
    <AdminShell currentPath="/admin/resultados" sessionEmail={session.email} sessionRole={session.role} title="Detalhe da corrida">
      {canAccess(session.role, 'resultados') ? <ResultadoRacingDetailPage racingId={racingId} /> : <AdminAccessDenied role={session.role} />}
    </AdminShell>
  );
}
