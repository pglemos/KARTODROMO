'use client';

import { useEffect, useState, type ComponentType } from 'react';
import { usePathname } from 'next/navigation';
import Home from './site-pages/Home';
import HistoryPage from './site-pages/HistoryPage';
import FAQPage from './site-pages/FAQPage';
import EventsPage from './site-pages/EventsPage';
import PistaPage from './site-pages/PistaPage';
import KartLocacaoPage from './site-pages/KartLocacaoPage';
import ReservasPage from './site-pages/ReservasPage';
import ChampionshipsPage from './site-pages/ChampionshipsPage';
import KACPage from './site-pages/KACPage';
import KACSuperPage from './site-pages/KACSuperPage';
import TwoHundredMilesPage from './site-pages/TwoHundredMilesPage';
import FiveHundredMilesPage from './site-pages/FiveHundredMilesPage';
import Header from './components/Header';
import Footer from './components/Footer';
import ClubPage, { type ClubPageKey } from './site-pages/ClubPages';
import { findPublicRoute, type PublicRouteKey } from './config/publicRoutes';

const standardPages: Partial<Record<PublicRouteKey, ComponentType>> = {
  home: Home,
  historia: HistoryPage,
  duvidas: FAQPage,
  eventos: EventsPage,
  pista: PistaPage,
  'kart-locacao': KartLocacaoPage,
  reservas: ReservasPage,
  campeonatos: ChampionshipsPage,
  kac: KACPage,
  'kac-super': KACSuperPage,
  '200-milhas': TwoHundredMilesPage,
  '500-milhas': FiveHundredMilesPage,
};

const NotFoundPage = () => (
  <div className="min-h-screen bg-ink-950 text-white/80">
    <Header />
    <main className="container mx-auto px-4 py-24 text-center">
      <p className="mb-3 font-race text-xs italic font-bold uppercase tracking-[0.18em] text-primary-400">Página não encontrada</p>
      <h1 className="font-display text-4xl italic uppercase tracking-tight text-white md:text-6xl">Essa rota não existe</h1>
      <p className="mx-auto mt-5 max-w-xl text-sm leading-7 text-white/65">
        O endereço acessado não corresponde a uma página ativa do Kartódromo de Betim.
      </p>
      <a
        href="/"
        className="mt-8 inline-flex bg-gradient-to-br from-primary-400 to-primary-600 px-6 py-3 font-race text-xs italic font-bold uppercase tracking-[0.16em] text-ink-950 [clip-path:polygon(7%_0,100%_0,93%_100%,0_100%)] transition-transform hover:-translate-y-1"
      >
        Voltar para a Home
      </a>
    </main>
    <Footer />
  </div>
);

function useLocationHash(pathname: string): string {
  const [hash, setHash] = useState('');

  useEffect(() => {
    const updateHash = () => setHash(window.location.hash);
    updateHash();
    window.addEventListener('hashchange', updateHash);
    return () => window.removeEventListener('hashchange', updateHash);
  }, [pathname]);

  return hash;
}

const ScrollController = ({ pathname, hash }: { pathname: string; hash: string }) => {
  useEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }

    if (hash) {
      let userInteracted = false;
      const scrollToTarget = () => {
        if (userInteracted) return;

        const target = document.querySelector(hash);
        if (target) {
          const top = target.getBoundingClientRect().top + window.scrollY - 92;
          window.scrollTo({ top: Math.max(top, 0), behavior: 'auto' });
        }
      };

      requestAnimationFrame(scrollToTarget);
      const timeouts = [300, 900, 1800].map((delay) => window.setTimeout(scrollToTarget, delay));
      const markInteracted = () => {
        userInteracted = true;
      };

      window.addEventListener('wheel', markInteracted, { passive: true });
      window.addEventListener('touchstart', markInteracted, { passive: true });
      window.addEventListener('keydown', markInteracted);

      return () => {
        timeouts.forEach(window.clearTimeout);
        window.removeEventListener('wheel', markInteracted);
        window.removeEventListener('touchstart', markInteracted);
        window.removeEventListener('keydown', markInteracted);
      };
    }

    window.scrollTo({ top: 0 });
    return undefined;
  }, [pathname, hash]);

  return null;
};

function RouteContent({ routeKey }: { routeKey: PublicRouteKey }) {
  if (routeKey.startsWith('clube-')) {
    return <ClubPage page={routeKey.slice('clube-'.length) as ClubPageKey} />;
  }

  const Page = standardPages[routeKey];
  return Page ? <Page /> : <NotFoundPage />;
}

function App() {
  const pathname = usePathname() || '/';
  const hash = useLocationHash(pathname);
  const route = findPublicRoute(pathname);

  return (
    <div className="public-site">
      <ScrollController pathname={pathname} hash={hash} />
      {route ? <RouteContent routeKey={route.key} /> : <NotFoundPage />}
    </div>
  );
}

export default App;
