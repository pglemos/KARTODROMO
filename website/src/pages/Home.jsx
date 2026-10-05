import { useEffect, useRef, useState } from "react";
import { Pause, Play, ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import { BOOKING, championships } from "../data.js";
import { useRegistrationStatus } from "../hooks.js";
import {
  Button,
  TextLink,
  SectionTitle,
  Stats,
  CallToAction,
  Location,
} from "../components/UI.jsx";
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
    } else {
      video.current
        .play()
        .then(() => setPlaying(true))
        .catch(() => {});
    }
  };
  const c = championships[0];
  const status = useRegistrationStatus(c);
  return (
    <>
      <section className="home-hero">
        <img
          className="hero-poster"
          src="/media/action.webp"
          fetchPriority="high"
          alt="Pilotos em uma corrida no Kartódromo de Betim"
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
          <h1>
            A vida é melhor
            <br />
            <em>na pista.</em>
          </h1>
          <p>
            Troque a rotina por adrenalina. Viva a experiência
            <br className="desktop-break" /> de pilotar no Kartódromo
            Internacional de Betim.
          </p>
          <div className="actions">
            <Button href={BOOKING}>Reservar minha corrida</Button>
            <Button to="/pista" variant="outline">
              Conhecer a pista
            </Button>
          </div>
          <div className="hero-bottom">
            <Location />
            <div className="hero-price">
              <span>30 min de corrida</span>
              <span>
                A partir de <strong>R$ 145</strong>
              </span>
            </div>
            <button
              className="video-control"
              onClick={toggle}
              aria-label={
                playing ? "Pausar vídeo de fundo" : "Reproduzir vídeo de fundo"
              }
            >
              {playing ? <Pause size={16} /> : <Play size={16} />}
            </button>
          </div>
        </div>
      </section>
      <Stats
        items={[
          ["1.110 m", "de pista homologada"],
          ["13 HP", "de pura adrenalina"],
          ["30 min", "para sair da rotina"],
        ]}
      />
      <section className="container section experiences">
        <SectionTitle description="Da primeira volta ao próximo pódio.">
          Escolha como <em>acelerar.</em>
        </SectionTitle>
        <div className="experience-grid">
          {[
            {
              image: "action",
              title: "Kart de locação",
              text: "Sua primeira volta começa aqui.",
              cta: "Reservar corrida",
              to: "/kart-locacao",
            },
            {
              image: "grid",
              title: "Campeonatos",
              text: "Para quem quer ir além.",
              cta: "Ver calendário",
              to: "/campeonatos",
            },
            {
              image: "gourmet",
              title: "Eventos",
              text: "Momentos que ficam na memória.",
              cta: "Montar meu evento",
              to: "/eventos",
            },
          ].map((e) => (
            <Link className="experience" to={e.to} key={e.title}>
              <div className="experience-image">
                <img
                  src={`/media/${e.image}.webp`}
                  alt={
                    e.title === "Eventos"
                      ? "Espaço de eventos com vista para a pista"
                      : e.title === "Campeonatos"
                        ? "Piloto recebendo a bandeira quadriculada"
                        : "Pilotos disputando posição"
                  }
                  loading="lazy"
                />
              </div>
              <h3>{e.title}</h3>
              <p>{e.text}</p>
              <span className="text-link">
                {e.cta}
                <ArrowUpRight size={19} />
              </span>
            </Link>
          ))}
        </div>
      </section>
      <section className="race-highlight container">
        <div className="race-highlight-date">
          <strong>25</strong>
          <span>OUT · 2026</span>
        </div>
        <div>
          <span className="section-label">O próximo desafio</span>
          <h2>
            100 Milhas <em>Light.</em>
          </h2>
          <p>
            2h30 de corrida. De 1 a 3 pilotos por kart. Um time, um objetivo.
          </p>
        </div>
        <div className="race-highlight-action">
          <span>
            {status === "open"
              ? "Inscrições até 15 de outubro"
              : status === "closed"
                ? "Inscrições encerradas"
                : "Confira a edição"}
          </span>
          <Button to="/100-milhas-light" variant="outline">
            Conhecer a prova
          </Button>
        </div>
      </section>
      <section className="container section track-feature">
        <div>
          <h2>
            Cada curva,
            <br />
            uma nova <em>emoção.</em>
          </h2>
          <p>
            1.110 metros de pista homologada, traçados técnicos e estrutura
            completa em Betim. Aqui, cada volta tem uma história.
          </p>
          <TextLink to="/pista">Conhecer a pista</TextLink>
        </div>
        <Link
          to="/pista"
          className="track-feature-image"
          aria-label="Conhecer a pista do Kartódromo de Betim"
        >
          <img
            src="/media/aerial.webp"
            alt="Vista aérea do circuito real do Kartódromo Internacional de Betim"
            loading="lazy"
          />
          <span>
            O seu próximo destino <ArrowUpRight size={21} />
          </span>
        </Link>
      </section>
      <section className="container club-teaser">
        <div>
          <span className="section-label">Clube de Vantagens</span>
          <h2>
            A paixão pela pista
            <br />
            merece <em>mais.</em>
          </h2>
        </div>
        <div>
          <p>
            Conheça o programa de relacionamento para quem faz parte da nossa
            história. Pontos e benefícios previstos para as suas próximas
            corridas.
          </p>
          <TextLink to="/clube-vantagens">Conhecer o clube</TextLink>
        </div>
      </section>
      <CallToAction />
    </>
  );
}
