type AngledButtonProps = {
  children: React.ReactNode;
  variant?: 'primary' | 'outline';
  href?: string;
  onClick?: () => void;
  type?: 'button' | 'submit';
  external?: boolean;
  className?: string;
};

const baseClasses =
  'inline-flex min-h-[52px] items-center justify-center gap-2.5 px-7 font-race text-xs italic font-bold uppercase tracking-wide transition-transform duration-200 [clip-path:polygon(7%_0,100%_0,93%_100%,0_100%)] hover:-translate-y-1';

const variantClasses: Record<'primary' | 'outline', string> = {
  primary: 'bg-gradient-to-br from-primary-400 to-primary-600 text-ink-950 shadow-[0_18px_46px_rgba(0,230,118,0.25)]',
  outline: 'border border-white/25 bg-white/5 text-white backdrop-blur-md hover:border-primary-400 hover:text-primary-400',
};

const AngledButton = ({
  children,
  variant = 'primary',
  href,
  onClick,
  type = 'button',
  external = false,
  className = '',
}: AngledButtonProps) => {
  const classes = `${baseClasses} ${variantClasses[variant]} ${className}`;

  if (href) {
    return (
      <a
        href={href}
        className={classes}
        {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      >
        {children}
      </a>
    );
  }

  return (
    <button type={type} onClick={onClick} className={classes}>
      {children}
    </button>
  );
};

export default AngledButton;
