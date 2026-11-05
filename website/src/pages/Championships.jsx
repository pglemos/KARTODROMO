import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Download, Flag, Check } from "lucide-react";
import { championships, money, whatsapp } from "../data.js";
import {
  PageHero,
  Button,
  Stats,
  SectionTitle,
  ContactBand,
  Breadcrumb,
  TextLink,
} from "../components/UI.jsx";
import { useRegistrationStatus } from "../hooks.js";
import Registration from "../components/Registration.jsx";
import { downloadCalendar } from "../calendar.mjs";
export function Championships() {
  const [filter, setFilter] = useState("Todos");
  const events = championships.filter(
    (c) => filter === "Todos" || c.type === filter,
  );
  return (
    <>
      <div className="container">
        <Breadcrumb current="Campeonatos" />
      </div>
      <PageHero
        title="O próximo pódio"
        accent="pode ser seu."
        description="Do primeiro grid às provas de endurance. Escolha seu desafio e venha competir em Betim."
        image="grid"
        compact
      />
      <section className="container featured-championship">
        <img
          src="/media/championships/100-milhas-light-logo.png"
          alt="Logo oficial 100 Milhas Light"
          width="180"
          height="110"
        />
        <div>
          <span>25 OUTUBRO · 2026</span>
          <h2>O desafio das 100 Milhas Light.</h2>
          <p>
            Monte sua equipe. 2h30 de prova, três paradas e uma estratégia até a
            bandeirada.
          </p>
        </div>
        <Button to="/100-milhas-light">Conhecer a prova</Button>
      </section>
      <section className="container championship-list-section">
        <div className="tabs" aria-label="Filtrar campeonatos">
          {["Todos", "Kart Light", "Super Kart", "Endurance"].map((t) => (
            <button
              key={t}
              aria-pressed={t === filter}
              className={t === filter ? "selected" : ""}
              onClick={() => setFilter(t)}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="race-list" aria-live="polite">
          {events.map((c) => (
            <Link
              className={`race-row ${c.past ? "past" : ""}`}
              key={c.id}
              to={`/${c.id}`}
            >
              <div className={`race-date ${!c.month ? "recurring" : ""}`}>
                <strong>{c.day}</strong>
                {c.month && (
                  <span>
                    <b>{c.month}</b>
                    {c.year}
                  </span>
                )}
              </div>
              <div className="race-title">
                <h2>{c.name}</h2>
                <p>{c.description}</p>
              </div>
              <div className="race-category">
                <span>{c.type}</span>
                {c.price && !c.past && <small>{money(c.price)} por kart</small>}
              </div>
              <span className="race-row-action">
                {c.past
                  ? "Ver edição"
                  : c.team
                    ? "Ver prova"
                    : "Ver campeonato"}
                <ArrowUpRight size={18} />
              </span>
            </Link>
          ))}
        </div>
        <div className="archived-race">
          <span>08 AGO · 2026</span>
          <div>
            <strong>Desafio 2 Horas de Betim</strong>
            <p>
              Edição realizada. Consulte a equipe para resultados e próximas
              edições.
            </p>
          </div>
          <a
            className="text-link"
            href={whatsapp(
              "Olá! Gostaria de saber sobre o Desafio 2 Horas de Betim.",
            )}
          >
            Saber mais
            <ArrowUpRight size={17} />
          </a>
        </div>
      </section>
      <ContactBand />
    </>
  );
}
export function Championship({ id }) {
  const c = championships.find((x) => x.id === id);
  const status = useRegistrationStatus(c);
  const pdf = `/media/regulamentos/${c.pdf}`;
  return (
    <>
      <div className="container">
        <Breadcrumb
          current={c.name}
          parent={{ to: "/campeonatos", label: "Campeonatos" }}
        />
      </div>
      <PageHero
        title={c.name}
        accent={c.team ? "Um time. Um desafio." : "Encontre seu ritmo."}
        description={c.intro}
        image="grid"
      >
        <Button
          href={
            status === "open"
              ? "#formulario"
              : whatsapp(`Olá! Gostaria de saber sobre ${c.name}.`)
          }
        >
          {status === "past"
            ? "Avisem-me da próxima edição"
            : status === "soon"
              ? "Consultar abertura"
              : status === "closed"
                ? "Consultar próxima edição"
                : c.team
                  ? "Inscrever minha equipe"
                  : "Inscrever como piloto"}
        </Button>
        <Button
          href={pdf}
          variant="outline"
          target="_blank"
          rel="noopener noreferrer"
          arrow={false}
        >
          <Download size={18} />
          Regulamento oficial
        </Button>
      </PageHero>
      {c.month && !c.past && (
        <div className="container calendar-download">
          <span>
            {c.date} · {c.name}
          </span>
          <button onClick={() => downloadCalendar(c)}>
            <Download size={17} />
            Adicionar a data ao meu calendário
          </button>
        </div>
      )}
      <Stats
        items={[
          [c.date, "data / temporada"],
          [c.duration, "formato da competição"],
          [c.stops, c.team ? "estratégia de prova" : "disputa na pista"],
        ]}
      />
      <section className="container section race-overview">
        <div>
          <span className="section-label">
            {c.type} · {c.year || "2026"}
          </span>
          <h2>
            {c.team ? "Resistência é" : "Cada etapa é"}
            <br />
            <em>{c.team ? "estratégia." : "evolução."}</em>
          </h2>
          <p>
            {c.team
              ? "O ritmo importa tanto quanto a velocidade. Monte sua equipe, planeje as trocas e esteja pronto para tomar decisões até a última volta."
              : "Aprenda com cada corrida. O campeonato tem regulamento próprio, critérios de pontuação, lastro, penalidades e premiação. Conheça as regras antes de entrar no grid."}
          </p>
          <ul className="check-list">
            {(c.id === "100-milhas-light"
              ? [
                  "1 a 3 pilotos por kart · até 5 karts por equipe",
                  "Traçado 11 invertido com chicane · 961 metros",
                  "3 paradas obrigatórias de no mínimo 7 minutos",
                  "Troféus para as 5 melhores equipes",
                ]
              : c.id === "200-milhas"
                ? [
                    "Equipe com pelo menos 2 pilotos",
                    "5 paradas obrigatórias de no mínimo 7 minutos",
                    "Transferência, Pix ou cartão em até 5x sem juros",
                    "Prova sujeita ao mínimo de 20 equipes",
                  ]
                : c.id === "kac-super"
                  ? [
                      "10 etapas de fevereiro a novembro de 2026",
                      "Os 9 melhores resultados compõem a pontuação",
                      "Formato Super Pole para definir o grid",
                      "Confira o calendário no regulamento oficial",
                    ]
                  : c.id === "kac"
                    ? [
                        "Categoria Kart Light para pilotos iniciantes",
                        "Campeonato com disputa e classificação mensal",
                        "Pontuação e lastro conforme regulamento",
                        "Inscrição e disponibilidade com a organização",
                      ]
                    : [
                        "Edição 2026 realizada em 29 de agosto",
                        "Operação de equipe e estratégia de longa duração",
                        "Regras específicas no regulamento oficial",
                        "Próxima edição: consulte a organização",
                      ]
            ).map((t) => (
              <li key={t}>
                <Check size={18} />
                {t}
              </li>
            ))}
          </ul>
        </div>
        <div className="race-summary">
          <img
            src={`/media/championships/${c.logo}`}
            alt={`Logo oficial ${c.name}`}
            loading="lazy"
          />
          <div>
            <span>
              {c.past
                ? "Edição realizada"
                : status === "soon"
                  ? "Abertura das inscrições"
                  : status === "closed"
                    ? "Inscrições encerradas"
                    : "Inscrições e valores"}
            </span>
            <h3>{c.price ? money(c.price) : "Entre no grid"}</h3>
            <p>
              {c.price
                ? c.past
                  ? "Valor da edição 2026 por equipe"
                  : "por kart"
                : "Consulte vagas e valores com a organização."}
            </p>
            {c.deadline && (
              <p className="deadline">
                {status === "soon"
                  ? "Abertura em 05/10/2026, às 10h de Brasília."
                  : `Prazo de inscrição: ${new Date(c.deadline).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}.`}
              </p>
            )}
            <TextLink href={pdf} target="_blank" rel="noopener noreferrer">
              Ler o regulamento completo
            </TextLink>
          </div>
        </div>
      </section>
      {c.schedule && (
        <section className="surface section">
          <div className="container schedule-section">
            <div>
              <span className="section-label">Cronograma oficial</span>
              <h2>
                Da chegada
                <br />à <em>bandeirada.</em>
              </h2>
              <p>
                Horários conforme o regulamento. Pelo menos um piloto de cada
                equipe deve participar do briefing.
              </p>
            </div>
            <div className="schedule-list">
              {c.schedule.map(([time, label]) => (
                <div key={time}>
                  <time>{time}</time>
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
      {!c.team && (
        <section className="container standings section">
          <SectionTitle>
            Classificação <em>oficial.</em>
          </SectionTitle>
          <div className="info-note">
            <TrophyIcon />
            <p>
              Para consultar a classificação atualizada e as próximas etapas,
              fale com a organização. Os resultados seguem os critérios do
              regulamento oficial.
            </p>
            <Button
              href={whatsapp(
                `Olá! Quero consultar o calendário e a classificação do ${c.name}.`,
              )}
              variant="outline"
            >
              Consultar organização
            </Button>
          </div>
        </section>
      )}
      {c.id === "100-milhas-light" && (
        <section className="container section endurance-rules">
          <SectionTitle>
            O plano começa <em>no box.</em>
          </SectionTitle>
          <div className="steps">
            <div>
              <span className="step-number">01</span>
              <h3>3 paradas obrigatórias</h3>
              <p>
                Cada parada deve ter ao menos 7 minutos, com troca de kart e
                piloto. Até 2 paradas extras são permitidas.
              </p>
            </div>
            <div>
              <span className="step-number">02</span>
              <h3>Janela de estratégia</h3>
              <p>
                O box abre aos 5 minutos de prova e fecha aos 2h10. Os últimos
                20 minutos são disputados com o box fechado.
              </p>
            </div>
            <div>
              <span className="step-number">03</span>
              <h3>Equipe preparada</h3>
              <p>
                Pilotos a partir de 14 anos, acima de 1,50 m e de 50 kg. Menores
                de 18 anos precisam de responsável adulto.
              </p>
            </div>
          </div>
          <p className="small muted">
            Não é permitido levar alimentos ou bebidas no dia do evento. Regras
            de peso, lastro, punições e premiação estão no regulamento.
          </p>
        </section>
      )}
      {status === "open" ? (
        <Registration key={c.id} championship={c} />
      ) : (
        <section
          id="formulario"
          className="container section registration-closed"
        >
          <h2>
            {status === "past"
              ? "A bandeirada já aconteceu."
              : status === "soon"
                ? "A próxima largada está chegando."
                : "Esta janela de inscrição terminou."}
          </h2>
          <p>
            {status === "soon"
              ? "As inscrições das 200 Milhas abrem em 05 de outubro de 2026, às 10h, horário de Brasília."
              : status === "past"
                ? "A edição 2026 foi realizada. Fale com a equipe para acompanhar a próxima edição."
                : "Consulte a organização sobre as próximas edições e oportunidades para competir."}
          </p>
          <Button
            href={whatsapp(`Olá! Quero acompanhar as inscrições de ${c.name}.`)}
          >
            Falar com a organização
          </Button>
        </section>
      )}
    </>
  );
}
function TrophyIcon() {
  return <Flag size={28} />;
}
