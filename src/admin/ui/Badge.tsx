import type { PropsWithChildren } from 'react';

export type BadgeVariant = 'emerald' | 'amber' | 'red' | 'blue' | 'zinc';

const variantClasses: Record<BadgeVariant, string> = {
  emerald: 'admin-badge-emerald',
  amber: 'admin-badge-amber',
  red: 'admin-badge-red',
  blue: 'admin-badge-blue',
  zinc: 'admin-badge-zinc',
};

const statusVariant: Record<string, BadgeVariant> = {
  confirmada: 'emerald',
  confirmado: 'emerald',
  realizada: 'emerald',
  finalizado: 'emerald',
  ativo: 'emerald',
  disponivel: 'emerald',
  live: 'emerald',
  pendente: 'amber',
  aguardando: 'amber',
  previsto: 'amber',
  agendada: 'amber',
  manutencao: 'amber',
  waiting: 'amber',
  rascunho: 'zinc',
  cancelada: 'red',
  cancelado: 'red',
  inativo: 'red',
  error: 'red',
  encerrado: 'red',
  concluida: 'blue',
  em_atendimento: 'blue',
  publicada: 'blue',
};

export const badgeVariantForStatus = (status?: string | null): BadgeVariant =>
  (status && statusVariant[status.toLowerCase()]) || 'zinc';

const labelize = (value: string) =>
  value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, ' ');

export const Badge = ({
  children,
  variant = 'zinc',
  className = '',
}: PropsWithChildren<{ variant?: BadgeVariant; className?: string }>) => (
  <span
    className={[
      'admin-badge inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold',
      variantClasses[variant],
      className,
    ].join(' ')}
  >
    {children}
  </span>
);

export const StatusBadge = ({ status }: { status: string }) => (
  <Badge variant={badgeVariantForStatus(status)}>{labelize(status)}</Badge>
);
