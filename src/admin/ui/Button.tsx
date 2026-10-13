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
  primary: 'bg-kib-acao text-kib-sobre-acao hover:bg-kib-acao-forte shadow-soft',
  secondary: 'bg-kib-campo text-kib-texto hover:bg-kib-borda-forte',
  ghost: 'border border-kib-borda bg-transparent text-kib-texto-2 hover:bg-kib-campo hover:text-kib-texto',
  danger: 'bg-kib-perigo-solido text-kib-inverso hover:bg-kib-perigo-solido/90',
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
