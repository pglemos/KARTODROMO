import { Anton, Oswald, Rajdhani } from 'next/font/google';

const anton = Anton({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-display',
  display: 'swap',
});

const oswald = Oswald({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-race',
  display: 'swap',
});

const rajdhani = Rajdhani({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-body',
  display: 'swap',
});

export default function PublicSiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${anton.variable} ${oswald.variable} ${rajdhani.variable} bg-ink-950 font-body text-white`}>
      {children}
    </div>
  );
}
