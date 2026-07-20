import type { CSSProperties } from 'react';
import type { Metadata, Viewport } from 'next';
import { Anton, Rajdhani } from 'next/font/google';
import '@/styles/globals.css';
import '@/styles/admin.css';
import '@/src/index.css';
import '@/src/styles/public-tokens.css';

const displayFont = Anton({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-display',
  display: 'swap',
});

const bodyFont = Rajdhani({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-body',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Kartódromo Internacional de Betim',
  description: 'Site oficial e painel administrativo do Kartódromo Internacional de Betim',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const fontAliases = {
    '--font-admin': 'var(--font-body)',
    '--font-race': 'var(--font-body)',
  } as CSSProperties;

  return (
    <html lang="pt-BR" className={`${displayFont.variable} ${bodyFont.variable}`}>
      <body style={fontAliases}>{children}</body>
    </html>
  );
}
