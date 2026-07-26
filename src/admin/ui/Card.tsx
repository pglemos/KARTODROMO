import type { HTMLAttributes, PropsWithChildren } from 'react';

export const Card = ({
  children,
  className = '',
  ...props
}: PropsWithChildren<HTMLAttributes<HTMLDivElement>>) => (
  <div
    className={['rounded-xl border border-zinc-800 bg-zinc-900/60 shadow-card', className].join(' ')}
    {...props}
  >
    {children}
  </div>
);
