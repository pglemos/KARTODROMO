import type { Metadata, Viewport } from 'next';
import '@/styles/globals.css';
import '@/src/index.css';

export const metadata: Metadata = {
  title: 'Kartódromo Internacional de Betim',
  description: 'Site oficial e painel administrativo do Kartódromo Internacional de Betim',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
