import { Loader2 } from 'lucide-react';
import type { ButtonHTMLAttributes, PropsWithChildren } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

type ButtonProps = PropsWithChildren<
  ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: ButtonVariant;
    loading?: boolean;
  }
>;

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-brand-500 text-zinc-950 hover:bg-brand-400 shadow-soft',
  secondary: 'bg-zinc-800 text-zinc-100 hover:bg-zinc-700',
  ghost: 'border border-zinc-800 bg-transparent text-zinc-300 hover:bg-zinc-800/70 hover:text-zinc-100',
  danger: 'bg-red-500/90 text-white hover:bg-red-500',
};

export const Button = ({
  children,
  className = '',
  disabled,
  loading = false,
  type = 'button',
  variant = 'primary',
  ...props
}: ButtonProps) => (
  <button
    aria-busy={loading}
    className={[
      'inline-flex h-11 items-center justify-center gap-2 rounded-lg px-3.5 text-sm font-medium transition-colors focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 sm:h-9',
      variantClasses[variant],
      className,
    ].join(' ')}
    disabled={disabled || loading}
    type={type}
    {...props}
  >
    {loading ? <Loader2 aria-hidden="true" className="animate-spin" size={16} /> : null}
    {children}
  </button>
);
