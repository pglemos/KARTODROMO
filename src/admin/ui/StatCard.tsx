import type { LucideIcon } from 'lucide-react';
import { Card } from './Card';

type StatCardProps = {
  label: string;
  value: string;
  sub?: string;
  icon: LucideIcon;
  loading?: boolean;
};

export const StatCard = ({ icon: Icon, label, loading = false, sub, value }: StatCardProps) => (
  <Card className="p-5 transition-colors hover:border-kib-borda-forte">
    <div className="flex items-center justify-between">
      <p className="text-xs font-medium uppercase tracking-wider text-kib-texto-3">{label}</p>
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-kib-acao/10 text-kib-acao">
        <Icon aria-hidden="true" size={18} />
      </span>
    </div>
    {loading ? (
      <div className="mt-3 h-8 w-24 animate-pulse rounded bg-kib-campo" />
    ) : (
      <p className="mt-3 text-3xl font-semibold tracking-tight text-kib-texto">{value}</p>
    )}
    {sub ? <p className="mt-1 text-xs text-kib-texto-2">{sub}</p> : null}
  </Card>
);
