import type { Metadata, Viewport } from 'next';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: 'Placar Telão Kartódromo',
  description: 'Placar intermediário 2048x512 para NovaStar TB50',
};

export const viewport: Viewport = {
  width: 2048,
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
