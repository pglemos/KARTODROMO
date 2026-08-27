'use client';

import dynamic from 'next/dynamic';

const HomeDashboard = dynamic(
  () => import('@/app/HomeDashboard').then(({ HomeDashboard: Page }) => Page),
  {
    ssr: false,
    loading: () => (
      <section className="admin-telao-page grid gap-5 pb-10">
        <div className="admin-card flex min-h-40 items-center justify-center p-5 text-sm text-[var(--admin-muted)]" role="status">
          Carregando central do telão...
        </div>
      </section>
    ),
  },
);

export function AdminTelaoContent({ uid }: { uid: string }) {
  return <HomeDashboard uid={uid} />;
}
