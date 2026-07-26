import { Anton, Oswald, Rajdhani } from 'next/font/google';
import MobileStickyBar from '@/src/components/site-ui/MobileStickyBar';
import ScrollProgressBar from '@/src/components/site-ui/ScrollProgressBar';
import WhatsAppFloat from '@/src/components/site-ui/WhatsAppFloat';

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
    <div className={`${anton.variable} ${oswald.variable} ${rajdhani.variable} bg-ink-950 pb-16 font-body text-white md:pb-0`}>
      <ScrollProgressBar />
      {children}
      <WhatsAppFloat />
      <MobileStickyBar />
    </div>
  );
}
