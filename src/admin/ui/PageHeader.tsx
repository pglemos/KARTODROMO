import { Plus } from 'lucide-react';
import { Button } from './Button';

type PageHeaderProps = {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  actionLabel?: string;
  onAction?: () => void;
};

export const PageHeader = ({ actionLabel, onAction, subtitle, title }: PageHeaderProps) => (
  <header className="admin-page-header flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
    <div>
      <h2 className="text-xl font-bold tracking-tight text-[var(--admin-text)]">{title}</h2>
      {subtitle ? <p className="mt-1.5 max-w-2xl text-sm text-zinc-400">{subtitle}</p> : null}
    </div>
    {actionLabel && onAction ? (
      <Button className="shrink-0" onClick={onAction}>
        <Plus aria-hidden="true" size={16} />
        {actionLabel}
      </Button>
    ) : null}
  </header>
);
