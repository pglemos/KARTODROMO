import type { HTMLAttributes, PropsWithChildren } from 'react';

export const Card = ({
  children,
  className = '',
  ...props
}: PropsWithChildren<HTMLAttributes<HTMLDivElement>>) => (
  <div
    className={['rounded-xl border border-kib-borda bg-kib-superficie shadow-card', className].join(' ')}
    {...props}
  >
    {children}
  </div>
);
