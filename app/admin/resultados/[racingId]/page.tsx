import { AdminShell } from '@/components/admin/AdminShell';
import { requireAdminSession } from '@/lib/require-admin-session';
import { ResultadoRacingDetailPage } from '@/src/admin/modules/resultados/ResultadoRacingDetailPage';

export const dynamic = 'force-dynamic';

export default async function ResultadoRacingDetailRoute({
  params,
}: {
  params: Promise<{ racingId: string }>;
}) {
  const { racingId } = await params;
  const session = await requireAdminSession(`/admin/resultados/${racingId}`);

  return (
    <AdminShell currentPath="/admin/resultados" sessionEmail={session.email} title="Detalhe da corrida">
      <ResultadoRacingDetailPage racingId={racingId} />
    </AdminShell>
  );
}
