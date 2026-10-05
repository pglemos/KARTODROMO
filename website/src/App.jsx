import { useEffect, useRef } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import { Header, Footer, WhatsApp } from "./components/Shell.jsx";
import { Button } from "./components/UI.jsx";
import Home from "./pages/Home.jsx";
import Rental from "./pages/Rental.jsx";
import Booking from "./pages/Booking.jsx";
import Track from "./pages/Track.jsx";
import Events from "./pages/Events.jsx";
import FAQ from "./pages/FAQ.jsx";
import History from "./pages/History.jsx";
import { ClubLanding, ClubPortal } from "./pages/Club.jsx";
import { Championships, Championship } from "./pages/Championships.jsx";
import routes from "./routes.json";
function NavigationEffects() {
  const location = useLocation();
  const previous = useRef(location.pathname);
  useEffect(() => {
    const route = routes.find((r) => r.path === location.pathname);
    if (route) {
      document.title = route.title;
      document
        .querySelector('meta[name="description"]')
        ?.setAttribute("content", route.description);
      document
        .querySelector('link[rel="canonical"]')
        ?.setAttribute("href", `https://kartodromodebetim.com.br${route.path}`);
      document
        .querySelector('meta[property="og:title"]')
        ?.setAttribute("content", route.title);
      document
        .querySelector('meta[property="og:description"]')
        ?.setAttribute("content", route.description);
      document
        .querySelector('meta[property="og:url"]')
        ?.setAttribute(
          "content",
          `https://kartodromodebetim.com.br${route.path}`,
        );
      let robots = document.querySelector('meta[name="robots"]');
      if (!robots) {
        robots = document.createElement("meta");
        robots.name = "robots";
        document.head.append(robots);
      }
      robots.content =
        route.availability === "coming-soon"
          ? "noindex, follow"
          : "index, follow";
    }
    if (location.hash) {
      setTimeout(() => {
        const target = document.getElementById(location.hash.slice(1));
        target?.scrollIntoView({ behavior: "auto" });
        if (target?.hasAttribute("tabindex"))
          target.focus({ preventScroll: true });
      }, 0);
    } else if (previous.current !== location.pathname) {
      window.scrollTo(0, 0);
      document.getElementById("conteudo")?.focus({ preventScroll: true });
    }
    previous.current = location.pathname;
  }, [location.pathname, location.hash]);
  return null;
}
export default function App() {
  return (
    <>
      <NavigationEffects />
      <Header />
      <main id="conteudo" tabIndex={-1}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/pista" element={<Track />} />
          <Route path="/kart-locacao" element={<Rental />} />
          <Route path="/reservas" element={<Booking />} />
          <Route path="/eventos" element={<Events />} />
          <Route path="/duvidas" element={<FAQ />} />
          <Route path="/historia" element={<History />} />
          <Route path="/campeonatos" element={<Championships />} />
          {[
            "kac",
            "kac-super",
            "100-milhas-light",
            "200-milhas",
            "500-milhas",
          ].map((id) => (
            <Route
              key={id}
              path={`/${id}`}
              element={<Championship id={id} />}
            />
          ))}
          <Route path="/clube-vantagens" element={<ClubLanding />} />
          {[
            "cadastro",
            "consulta",
            "painel",
            "corridas",
            "pontuacao",
            "catalogo",
            "resgates",
            "perfil",
            "regulamento",
            "campanhas",
          ].map((section) => (
            <Route
              key={section}
              path={`/clube-${section}`}
              element={<ClubPortal section={section} />}
            />
          ))}
          <Route
            path="*"
            element={
              <section className="not-found">
                <h1>404</h1>
                <h2>Fora do traçado.</h2>
                <p>
                  Esta página não foi encontrada. Vamos voltar para a pista.
                </p>
                <div className="actions">
                  <Button to="/">Voltar ao início</Button>
                  <Button to="/campeonatos" variant="outline">
                    Ver campeonatos
                  </Button>
                </div>
              </section>
            }
          />
        </Routes>
      </main>
      <Footer />
      <WhatsApp />
    </>
  );
}
