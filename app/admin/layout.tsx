import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: {
    default: 'Administração',
    template: '%s · Administração · Kartódromo Betim',
  },
};

export default function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
