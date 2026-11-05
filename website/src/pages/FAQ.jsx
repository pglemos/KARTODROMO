import { useState } from "react";
import { Search, Plus, ArrowUpRight } from "lucide-react";
import { faq } from "../data.js";
import {
  PageHero,
  Breadcrumb,
  SectionTitle,
  ContactBand,
} from "../components/UI.jsx";
export default function FAQ() {
  const [cat, setCat] = useState("Todas");
  const [query, setQuery] = useState("");
  const normalized = (s) =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  const items = faq.filter(
    (f) =>
      (cat === "Todas" || f.cat === cat) &&
      normalized(f.q + " " + f.a).includes(normalized(query)),
  );
  return (
    <>
      <div className="container">
        <Breadcrumb current="Dúvidas" />
      </div>
      <PageHero
        title="Tudo pronto"
        accent="para acelerar?"
        description="Encontre as respostas para chegar à pista com tranquilidade. Do primeiro agendamento às regras da corrida."
        image="karts"
        compact
      />
      <section className="container section faq-section">
        <aside>
          <h2>
            Dúvidas
            <br />
            <em>frequentes.</em>
          </h2>
          <p>Escolha um assunto ou busque a sua dúvida.</p>
          <div className="faq-categories" aria-label="Categorias de dúvidas">
            {[
              "Todas",
              "Locação",
              "Reservas",
              "Segurança",
              "Eventos",
              "Campeonatos",
              "Clube",
            ].map((c) => (
              <button
                key={c}
                aria-pressed={cat === c}
                className={cat === c ? "selected" : ""}
                onClick={() => setCat(c)}
              >
                {c}
                <ArrowUpRight size={16} />
              </button>
            ))}
          </div>
        </aside>
        <div>
          <label className="search-field">
            <Search size={20} />
            <input
              type="search"
              aria-label="Buscar nas dúvidas frequentes"
              placeholder="O que você quer saber?"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <span className="result-count" aria-live="polite">
            {items.length}{" "}
            {items.length === 1
              ? "resposta encontrada"
              : "respostas encontradas"}
          </span>
          <div className="faq-list">
            {items.map((f) => (
              <details key={f.q}>
                <summary>
                  {f.q}
                  <Plus size={20} />
                </summary>
                <div className="faq-answer">
                  <p>{f.a}</p>
                  {f.q === "Como faço a minha reserva?" && (
                    <a
                      className="text-link"
                      href="https://reservas.kartodromodebetim.com.br"
                    >
                      Abrir agenda online
                      <ArrowUpRight size={16} />
                    </a>
                  )}
                </div>
              </details>
            ))}
          </div>
          {!items.length && (
            <div className="empty-search">
              <h3>Nenhuma resposta por aqui.</h3>
              <p>Tente outra palavra ou escolha uma categoria diferente.</p>
              <button
                className="button outline"
                onClick={() => {
                  setQuery("");
                  setCat("Todas");
                }}
              >
                Ver todas as respostas
              </button>
            </div>
          )}
        </div>
      </section>
      <section className="surface section">
        <div className="container">
          <SectionTitle>
            Respeito também <em>faz parte.</em>
          </SectionTitle>
          <div className="steps">
            {[
              [
                "01",
                "Ouça o briefing",
                "As regras de segurança e a operação do kart são explicadas antes de entrar na pista.",
              ],
              [
                "02",
                "Respeite as bandeiras",
                "A sinalização orienta redução, parada, ultrapassagem e encerramento da bateria.",
              ],
              [
                "03",
                "Dispute com cuidado",
                "Contato intencional e condução agressiva podem gerar advertência ou retirada da corrida.",
              ],
            ].map(([n, t, d]) => (
              <div key={n}>
                <span className="step-number">{n}</span>
                <h3>{t}</h3>
                <p>{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <ContactBand
        title="Ainda ficou alguma dúvida?"
        text="A equipe está pronta para ajudar com horários, grupos, requisitos e campeonatos."
      />
    </>
  );
}
