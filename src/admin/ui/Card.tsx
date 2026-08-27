import type { HTMLAttributes, PropsWithChildren } from 'react';

export const Card = ({
  children,
  className = '',
  ...props
}: PropsWithChildren<HTMLAttributes<HTMLDivElement>>) => (
  <div
    className={['admin-card', className].join(' ')}
    {...props}
  >
    {children}
  </div>
);
