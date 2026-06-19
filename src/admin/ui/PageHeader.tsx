import { Plus } from 'lucide-react';
import { Button } from './Button';

type PageHeaderProps = {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  actionLabel?: string;
  onAction?: () => void;
};

export const PageHeader = ({ actionLabel, eyebrow, onAction, subtitle, title }: PageHeaderProps) => (
  <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
    <div>
      {eyebrow ? (
        <p className="text-xs font-medium uppercase tracking-wider text-brand-400">{eyebrow}</p>
      ) : null}
      <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-50">{title}</h1>
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
