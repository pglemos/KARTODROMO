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
  <Card className="p-5 transition-colors hover:border-zinc-700">
    <div className="flex items-center justify-between">
      <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">{label}</p>
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-500/10 text-brand-400">
        <Icon aria-hidden="true" size={18} />
      </span>
    </div>
    {loading ? (
      <div className="mt-3 h-8 w-24 animate-pulse rounded bg-zinc-800/70" />
    ) : (
      <p className="mt-3 text-3xl font-semibold tracking-tight text-zinc-50">{value}</p>
    )}
    {sub ? <p className="mt-1 text-xs text-zinc-400">{sub}</p> : null}
  </Card>
);
