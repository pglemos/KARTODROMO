import type { PropsWithChildren } from 'react';

export type BadgeVariant = 'emerald' | 'amber' | 'red' | 'blue' | 'zinc';

const variantClasses: Record<BadgeVariant, string> = {
  emerald: 'bg-kib-sucesso-fundo text-kib-sucesso',
  amber: 'bg-kib-aviso-fundo text-kib-aviso',
  red: 'bg-kib-perigo-fundo text-kib-perigo',
  blue: 'bg-kib-info-fundo text-kib-info',
  zinc: 'bg-kib-campo text-kib-texto-2',
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
      'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
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
