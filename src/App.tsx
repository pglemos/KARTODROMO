import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import Home from './pages/Home';
import HistoryPage from './pages/HistoryPage';
import FAQPage from './pages/FAQPage';
import EventsPage from './pages/EventsPage';
import PistaPage from './pages/PistaPage';
import KartLocacaoPage from './pages/KartLocacaoPage';
import ReservasPage from './pages/ReservasPage';
import ChampionshipsPage from './pages/ChampionshipsPage';
import KACPage from './pages/KACPage';
import Header from './components/Header';
import Footer from './components/Footer';

const NotFoundPage = () => (
  <div className="min-h-screen bg-white text-zinc-800">
    <Header />
    <main className="container mx-auto px-4 py-24 text-center">
      <p className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-primary-700">Página não encontrada</p>
      <h1 className="text-4xl font-black uppercase tracking-tight text-zinc-950 md:text-6xl">Essa rota não existe</h1>
      <p className="mx-auto mt-5 max-w-xl text-sm leading-7 text-zinc-600">
        O endereço acessado não corresponde a uma página ativa do Kartódromo de Betim.
      </p>
      <a
        href="/"
        className="mt-8 inline-flex rounded-lg bg-primary-500 px-6 py-3 text-xs font-black uppercase tracking-[0.16em] text-zinc-950 transition-colors hover:bg-primary-400"
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
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Router>
  );
}

export default App;
