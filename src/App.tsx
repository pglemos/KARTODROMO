import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
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

const ScrollController = () => {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }

    if (hash) {
      let userInteracted = false;
      const scrollToTarget = () => {
        if (userInteracted) {
          return;
        }

        const target = document.querySelector(hash);
        if (target) {
          const top = target.getBoundingClientRect().top + window.scrollY - 92;
          window.scrollTo({ top: Math.max(top, 0), behavior: 'auto' });
        }
      };

      requestAnimationFrame(scrollToTarget);
      const timeouts = [300, 900, 1800, 3500, 7000, 12000, 18000].map((delay) =>
        window.setTimeout(scrollToTarget, delay),
      );
      const interval = window.setInterval(scrollToTarget, 400);
      const stopInterval = window.setTimeout(() => window.clearInterval(interval), 24000);
      const markInteracted = () => {
        userInteracted = true;
        window.clearInterval(interval);
      };

      window.addEventListener('wheel', markInteracted, { passive: true });
      window.addEventListener('touchstart', markInteracted, { passive: true });
      window.addEventListener('keydown', markInteracted);

      return () => {
        timeouts.forEach(window.clearTimeout);
        window.clearInterval(interval);
        window.clearTimeout(stopInterval);
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

function App() {
  return (
    <Router>
      <ScrollController />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/historia" element={<HistoryPage />} />
        <Route path="/duvidas" element={<FAQPage />} />
        <Route path="/eventos" element={<EventsPage />} />
        <Route path="/pista" element={<PistaPage />} />
        <Route path="/kart-locacao" element={<KartLocacaoPage />} />
        <Route path="/reservas" element={<ReservasPage />} />
        <Route path="/campeonatos" element={<ChampionshipsPage />} />
        <Route path="/campeonatos/kac" element={<KACPage />} />
        <Route path="/campeonatos/kac-super" element={<KACSuperPage />} />
        <Route path="/campeonatos/200-milhas" element={<TwoHundredMilesPage />} />
        <Route path="/campeonatos/500-milhas" element={<FiveHundredMilesPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Router>
  );
}

export default App;
