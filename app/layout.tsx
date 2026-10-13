import type { Metadata, Viewport } from 'next';
import { Rajdhani } from 'next/font/google';
// design tokens (--kib-*): gerado de tokens/kib.tokens.json; só declara variáveis, não muda nenhuma tela
import '@/styles/tokens.css';
import '@/styles/globals.css';
import '@/styles/admin.css';
import '@/src/index.css';

const adminFont = Rajdhani({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-admin',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Kartódromo Internacional de Betim',
  description: 'Site oficial e painel administrativo do Kartódromo Internacional de Betim',
  icons: {
    icon: [{ url: '/icon.svg', type: 'image/svg+xml' }],
    shortcut: ['/icon.svg'],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body className={adminFont.variable}>{children}</body>
    </html>
  );
}
