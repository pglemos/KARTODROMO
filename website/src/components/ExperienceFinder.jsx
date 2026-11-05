import { useRef, useState } from "react";
import { ArrowUpRight, Flag, Users, Trophy } from "lucide-react";
import { Button } from "./UI.jsx";
const experiences = [
  {
    title: "Quero correr",
    name: "Sua primeira volta. Ou a próxima.",
    text: "Você não precisa ser piloto para sentir a emoção de uma corrida. Equipamentos, briefing e cronometragem fazem parte da experiência.",
    image: "action",
    alt: "Pilotos disputando uma bateria no circuito de Betim",
    to: "/kart-locacao",
    cta: "Conhecer o kart de locação",
    detail: "30 minutos · Honda GX390 · 13 HP",
    icon: Flag,
  },
  {
    title: "Quero competir",
    name: "Um objetivo. Cada vez mais perto.",
    text: "Do campeonato para iniciantes às provas de resistência em equipe. Encontre o formato que combina com o seu momento na pista.",
    image: "grid",
    alt: "Piloto recebendo a bandeirada no kartódromo",
    to: "/campeonatos",
    cta: "Encontrar meu campeonato",
    detail: "Kart Light · Super Kart · Endurance",
    icon: Trophy,
  },
  {
    title: "Quero reunir a turma",
    name: "A melhor história é compartilhada.",
    text: "Aniversário, encontro de amigos ou confraternização da empresa. Combine a disputa na pista com um espaço para comemorar.",
    image: "gourmet",
    alt: "Espaço gourmet com vista para o circuito",
    to: "/eventos",
    cta: "Planejar meu evento",
    detail: "Espaço Gourmet · Salão Inferior",
    icon: Users,
  },
];
export default function ExperienceFinder() {
  const [index, setIndex] = useState(0);
  const tabs = useRef([]);
  const e = experiences[index];
  const key = (event, i) => {
    let next;
    if (event.key === "ArrowRight") next = (i + 1) % experiences.length;
    if (event.key === "ArrowLeft")
      next = (i + experiences.length - 1) % experiences.length;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = experiences.length - 1;
    if (next !== undefined) {
      event.preventDefault();
      setIndex(next);
      tabs.current[next].focus();
    }
  };
  return (
    <section className="container section experience-finder">
      <div className="section-title">
        <h2>
          Seu jeito de
          <br />
          <em>viver a pista.</em>
        </h2>
        <p>
          Uma volta por diversão.
          <br />
          Uma disputa de verdade.
          <br />
          Um dia para lembrar.
        </p>
      </div>
      <div
        className="experience-tabs"
        role="tablist"
        aria-label="Escolha sua experiência"
      >
        {experiences.map((item, i) => {
          const Icon = item.icon;
          return (
            <button
              key={item.title}
              id={`experience-tab-${i}`}
              role="tab"
              aria-selected={index === i}
              aria-controls="experience-panel"
              tabIndex={index === i ? 0 : -1}
              ref={(el) => (tabs.current[i] = el)}
              onClick={() => setIndex(i)}
              onKeyDown={(event) => key(event, i)}
            >
              <Icon size={20} />
              <span>{item.title}</span>
              <ArrowUpRight size={20} />
            </button>
          );
        })}
      </div>
      <div
        className="experience-panel"
        id="experience-panel"
        role="tabpanel"
        aria-labelledby={`experience-tab-${index}`}
        tabIndex={0}
      >
        <div className="experience-scene">
          <img
            key={e.image}
            src={`/media/${e.image}.webp`}
            alt={e.alt}
            loading="lazy"
            width="900"
            height="650"
          />
          <span>{e.detail}</span>
        </div>
        <div className="experience-story">
          <h3>{e.name}</h3>
          <p>{e.text}</p>
          <Button to={e.to}>{e.cta}</Button>
        </div>
      </div>
    </section>
  );
}
