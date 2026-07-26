'use client';

import dynamic from 'next/dynamic';
import type { AdminModuleKey } from './navigation';

const LegacyAdminContentInner = dynamic(
  () => import('./LegacyAdminContent').then((mod) => mod.LegacyAdminContent),
  {
    ssr: false,
    loading: () => (
      <div className="admin-card mx-auto max-w-[1500px] p-5 text-sm font-bold text-[var(--admin-muted)]">
        Carregando módulo...
      </div>
    ),
  },
);

export function LegacyAdminContent({ moduleKey, sessionEmail }: { moduleKey: AdminModuleKey; sessionEmail: string }) {
  return <LegacyAdminContentInner moduleKey={moduleKey} sessionEmail={sessionEmail} />;
}
