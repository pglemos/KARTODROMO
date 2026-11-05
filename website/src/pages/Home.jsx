import { useEffect, useRef, useState } from "react";
import {
  Pause,
  Play,
  ArrowUpRight,
  ArrowDown,
  Clock,
  Flag,
  CalendarDays,
} from "lucide-react";
import { Link } from "react-router-dom";
import { championships, money } from "../data.js";
import { useRegistrationStatus } from "../hooks.js";
import { Button, TextLink, CallToAction, Location } from "../components/UI.jsx";
import ExperienceFinder from "../components/ExperienceFinder.jsx";
import QuickFAQ from "../components/QuickFAQ.jsx";
import Visit from "../components/Visit.jsx";
export default function Home() {
  const video = useRef(null);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const reduce = () => {
      if (mq.matches) {
        video.current?.pause();
        setPlaying(false);
      }
    };
    mq.addEventListener("change", reduce);
    return () => mq.removeEventListener("change", reduce);
  }, []);
  const toggle = () => {
    if (playing) {
      video.current.pause();
      setPlaying(false);
    } else
      video.current
        .play()
        .then(() => setPlaying(true))
        .catch(() => {});
  };
  const c = championships[0];
  const status = useRegistrationStatus(c);
  return (
    <>
      <section className="home-hero home-hero-v2">
        <img
          className="hero-poster"
          src="/media/action.webp"
          fetchPriority="high"
          alt="Pilotos disputando uma corrida no Kartódromo Internacional de Betim"
          width="1800"
          height="1000"
        />
        <video
          className={`hero-video ${playing ? "playing" : ""}`}
          ref={video}
          loop
          muted
          playsInline
          preload="none"
          poster="/media/hero.webp"
          aria-hidden="true"
        >
          <source src="/media/racing.mp4" type="video/mp4" />
        </video>
        <div className="hero-shade" />
        <div className="container home-hero-content">
          <div className="hero-location">
            <Location />
            <span>Desde 1996</span>
          </div>
          <h1>
            A vida é melhor
            <br />
            <em>na pista.</em>
          </h1>
          <p>
            O coração acelera. A rotina fica para trás.
            <br />
            Viva sua próxima grande história em Betim.
          </p>
          <div className="actions">
            <Button to="/reservas">Quero correr</Button>
            <a className="hero-discover" href="#experiencias">
              Encontrar minha experiência
              <ArrowDown size={18} />
            </a>
          </div>
          <div className="hero-film">
            <button
              className="video-control"
              onClick={toggle}
              aria-label={
                playing ? "Pausar vídeo de fundo" : "Reproduzir vídeo de fundo"
              }
            >
              {playing ? <Pause size={17} /> : <Play size={17} />}
            </button>
            <span>{playing ? "Pausar o filme" : "Sinta o ritmo da pista"}</span>
          </div>
        </div>
        <div className="hero-photo-caption" aria-hidden="true">
          KARTÓDROMO INTERNACIONAL DE BETIM
          <br />A EXPERIÊNCIA É REAL.
        </div>
      </section>
      <div className="home-reservation-strip">
        <div className="container">
          <span>
            <Flag size={20} />
            <strong>Kart de locação</strong>
          </span>
          <span>
            <Clock size={20} />
            30 minutos de bateria
          </span>
          <span>
            Pagamento antecipado
            <strong>
              R$ 145 <small>/ piloto</small>
            </strong>
          </span>
          <Link to="/reservas">
            Planejar minha corrida
            <ArrowUpRight size={21} />
          </Link>
        </div>
      </div>
      <div id="experiencias">
        <ExperienceFinder />
      </div>
      <section className="home-circuit">
        <div className="container circuit-layout">
          <div className="circuit-photo">
            <img
              src="/media/aerial.webp"
              alt="Vista aérea real do circuito de Betim, com suas curvas, retas e boxes"
              loading="lazy"
              width="900"
              height="1600"
            />
            <span>
              O mesmo lugar.
              <br />
              Uma emoção diferente a cada volta.
            </span>
          </div>
          <div className="circuit-story">
            <h2>
              Aqui, a próxima
              <br />
              curva é <em>sua.</em>
            </h2>
            <p>
              Um circuito técnico. Uma estrutura que recebe iniciantes, grupos e
              pilotos de competição. E muita história para fazer parte.
            </p>
            <dl className="circuit-facts">
              <div>
                <dt>Extensão do circuito</dt>
                <dd>
                  1.110 <span>metros</span>
                </dd>
              </div>
              <div>
                <dt>Largura da pista</dt>
                <dd>
                  8 <span>metros</span>
                </dd>
              </div>
              <div>
                <dt>Mapas para explorar</dt>
                <dd>
                  30 <span>configurações</span>
                </dd>
              </div>
            </dl>
            <TextLink to="/pista">Explore o circuito e os traçados</TextLink>
            <TextLink to="/historia">Uma história que começou em 1996</TextLink>
          </div>
        </div>
      </section>
      <section className="container section home-racing">
        <div className="section-title">
          <h2>
            O próximo
            <br />
            <em>desafio é seu.</em>
          </h2>
          <TextLink to="/campeonatos">Ver todos os campeonatos</TextLink>
        </div>
        <div className="race-feature">
          <Link
            to="/100-milhas-light"
            className="race-feature-photo"
            aria-label="Conhecer a prova 100 Milhas Light"
          >
            <img
              src="/media/grid.webp"
              alt="Piloto de kart recebe a bandeira quadriculada"
              loading="lazy"
              width="1000"
              height="700"
            />
            <div>
              <span>25 de outubro</span>
              <strong>2026</strong>
            </div>
          </Link>
          <div className="race-feature-story">
            <div className="race-status">
              <CalendarDays size={17} />
              {status === "open"
                ? "Inscrições até 15 de outubro"
                : status === "closed"
                  ? "Inscrições encerradas"
                  : "Confira esta edição"}
            </div>
            <h3>
              100 Milhas
              <br />
              <em>Light.</em>
            </h3>
            <p>
              Estratégia, resistência e um objetivo compartilhado. Monte sua
              equipe para 2h30 de disputa.
            </p>
            <dl>
              <div>
                <dt>Equipe</dt>
                <dd>1 a 3 pilotos por kart</dd>
              </div>
              <div>
                <dt>Inscrição</dt>
                <dd>{money(c.price)} por kart</dd>
              </div>
            </dl>
            <Button to="/100-milhas-light">Conhecer a prova</Button>
          </div>
        </div>
        <div className="next-races">
          {championships.slice(1, 4).map((r) => (
            <Link to={`/${r.id}`} key={r.id}>
              <img
                src={`/media/championships/${r.logo}`}
                alt=""
                loading="lazy"
                width="90"
                height="60"
              />
              <div>
                <span>{r.date}</span>
                <strong>{r.name}</strong>
              </div>
              <ArrowUpRight size={20} />
            </Link>
          ))}
        </div>
      </section>
      <section className="home-club container">
        <div>
          <h2>
            A pista aproxima.
            <br />
            <em>A história continua.</em>
          </h2>
          <p>
            Estamos preparando o Clube de Vantagens para quem sempre encontra um
            motivo para voltar.
          </p>
          <TextLink to="/clube-vantagens">Conhecer o programa</TextLink>
        </div>
        <div
          className="club-membership"
          aria-label="Clube de Vantagens, programa em implantação"
        >
          <img
            src="/media/logo.png"
            alt=""
            width="155"
            height="44"
            loading="lazy"
          />
          <strong>
            CLUBE
            <br />
            DE VANTAGENS.
          </strong>
          <span>
            Programa em implantação
            <ArrowUpRight size={20} />
          </span>
        </div>
      </section>
      <QuickFAQ />
      <Visit />
      <CallToAction
        title="A próxima volta é sua."
        text="Comece pela reserva. O resto vira história."
      />
    </>
  );
}
