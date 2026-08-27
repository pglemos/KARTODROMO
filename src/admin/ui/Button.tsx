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
  primary: 'admin-button-primary',
  secondary: 'admin-button-secondary',
  ghost: 'admin-button-ghost',
  danger: 'admin-button-danger',
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
      'admin-button inline-flex h-11 items-center justify-center gap-2 rounded-lg px-3.5 text-sm font-semibold transition-colors focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 sm:h-9',
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
