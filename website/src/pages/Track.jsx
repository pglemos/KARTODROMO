import { useState, useCallback } from "react";
import { Search, Maximize2, ChevronLeft, ChevronRight } from "lucide-react";
import { trackNumbers, trackVariants, BOOKING, whatsapp } from "../data.js";
import {
  PageHero,
  Button,
  Stats,
  SectionTitle,
  CallToAction,
  Breadcrumb,
} from "../components/UI.jsx";
import Dialog from "../components/Dialog.jsx";
import Gallery from "../components/Gallery.jsx";
export default function Track() {
  const [variant, setVariant] = useState("normal");
  const [selected, setSelected] = useState(null);
  const close = useCallback(() => setSelected(null), []);
  const tracks = trackNumbers.flatMap((n) =>
    trackVariants
      .filter(([key]) => variant === "todos" || key === variant)
      .map(([key, label]) => ({
        n,
        label,
        id: `${n}-${key}`,
        url: `/media/tracados/tracado-${String(n).padStart(2, "0")}-${key}.webp`,
      })),
  );
  return (
    <>
      <div className="container">
        <Breadcrumb current="A pista" />
      </div>
      <PageHero
        title="Cada curva conta."
        accent="Cada volta transforma."
        description="Conheça o circuito que faz parte da história do kartismo mineiro. Uma pista homologada, técnica e feita para viver a velocidade."
        image="aerial"
      >
        <Button href="#tracados">Explorar os traçados</Button>
        <Button href={BOOKING} variant="outline">
          Reservar corrida
        </Button>
      </PageHero>
      <Stats
        items={[
          ["1.110 m", "de pista homologada"],
          ["8 m", "de largura do circuito"],
          ["30", "configurações mapeadas"],
        ]}
      />
      <section className="container section track-intro">
        <div>
          <span className="section-label">Muito além da reta</span>
          <h2>
            O desafio muda.
            <br />A paixão <em>continua.</em>
          </h2>
          <p>
            Frenagem, tangência e saída de curva. Cada configuração pede um
            olhar diferente sobre a pista. Explore os mapas oficiais e descubra
            os caminhos do circuito.
          </p>
          <p className="muted">
            Nas baterias de lazer, treinos e eventos, o kartódromo define o
            traçado ativo. Alterações de sentido e configurações com chicane são
            realizadas exclusivamente em campeonatos.
          </p>
        </div>
        <img
          className="track-sunset"
          src="/media/sunset.webp"
          alt="Pista iluminada ao pôr do sol em Betim"
          loading="lazy"
        />
      </section>
      <section className="container section" id="tracados">
        <SectionTitle description="Mapas oficiais do circuito. Selecione a configuração para explorar.">
          Encontre seu <em>traçado.</em>
        </SectionTitle>
        <div className="tabs" aria-label="Filtrar traçados">
          {[["todos", "Todos"], ...trackVariants].map(([key, label]) => (
            <button
              key={key}
              aria-pressed={variant === key}
              className={variant === key ? "selected" : ""}
              onClick={() => setVariant(key)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="result-count" aria-live="polite">
          {tracks.length} traçados · Clique em um mapa para ampliar
        </div>
        <div className="track-grid">
          {tracks.map((t) => (
            <button
              className="track-card"
              key={t.id}
              onClick={() => setSelected(t)}
              aria-label={`Ampliar traçado ${t.n} ${t.label}`}
            >
              <div className="track-map">
                <img
                  src={t.url}
                  alt={`Mapa oficial do traçado ${t.n} ${t.label}`}
                  loading="lazy"
                />
                <Maximize2 size={18} />
              </div>
              <div className="track-card-title">
                <strong>Traçado {String(t.n).padStart(2, "0")}</strong>
                <span>{t.label}</span>
              </div>
            </button>
          ))}
        </div>
        <div className="info-note">
          <Search size={22} />
          <p>
            Quer saber qual traçado estará ativo no dia da sua corrida?{" "}
            <a
              href={whatsapp(
                "Olá! Qual traçado estará ativo no dia da minha corrida?",
              )}
            >
              Consulte a equipe no WhatsApp.
            </a>
          </p>
        </div>
      </section>
      <Gallery
        items={[
          ["aerial", "O circuito visto de cima"],
          ["sunset", "O pôr do sol na pista"],
          ["night", "O circuito iluminado"],
          ["action", "A disputa em cada curva"],
          ["grid", "A bandeirada"],
        ]}
        title="Um circuito. Muitos olhares."
      />
      <CallToAction title="Sua próxima volta começa aqui." />
      {selected && (
        <Dialog
          title={`Traçado ${selected.n} · ${selected.label}`}
          onClose={close}
          className="map-dialog"
        >
          <img
            src={selected.url}
            alt={`Mapa ampliado do traçado ${selected.n} ${selected.label}`}
          />
          <div className="gallery-controls">
            <button
              className="icon-button"
              aria-label="Traçado anterior"
              onClick={() =>
                setSelected(
                  tracks[
                    (tracks.findIndex((t) => t.id === selected.id) +
                      tracks.length -
                      1) %
                      tracks.length
                  ],
                )
              }
            >
              <ChevronLeft />
            </button>
            <span aria-live="polite">
              {tracks.findIndex((t) => t.id === selected.id) + 1} /{" "}
              {tracks.length} · {selected.label}
            </span>
            <button
              className="icon-button"
              aria-label="Próximo traçado"
              onClick={() =>
                setSelected(
                  tracks[
                    (tracks.findIndex((t) => t.id === selected.id) + 1) %
                      tracks.length
                  ],
                )
              }
            >
              <ChevronRight />
            </button>
          </div>
          <p className="muted small">
            Mapa oficial do Kartódromo Internacional de Betim. Configurações
            diferentes são exclusivas para campeonatos.
          </p>
        </Dialog>
      )}
    </>
  );
}
