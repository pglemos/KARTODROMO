import { useRef, useState } from "react";
import { Check, CheckCircle2, ArrowLeft } from "lucide-react";
import { whatsapp } from "../data.js";
import {
  PageHero,
  Button,
  Stats,
  SectionTitle,
  Breadcrumb,
} from "../components/UI.jsx";
export default function Events() {
  const [kind, setKind] = useState("Aniversário");
  const [message, setMessage] = useState("");
  const result = useRef(null);
  const choose = (value) => {
    setKind(value);
    document
      .querySelector("#orcamento")
      ?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
      });
  };
  const submit = (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.currentTarget));
    setMessage(
      `Olá! Quero organizar um evento no Kartódromo de Betim.\nNome: ${d.nome}\nTipo: ${d.tipo}\nConvidados: ${d.pessoas}\nData desejada: ${d.data.split("-").reverse().join("/")}\nMensagem: ${d.mensagem || "Gostaria de receber os formatos e a disponibilidade."}`,
    );
    setTimeout(() => result.current?.focus(), 0);
  };
  return (
    <>
      <div className="container">
        <Breadcrumb current="Eventos" />
      </div>
      <PageHero
        title="Um encontro."
        accent="Muitas histórias."
        description="Aniversários, amigos e empresas. Transforme o próximo encontro em uma experiência com kart, pódio e um espaço feito para comemorar."
        image="gourmet"
      >
        <Button href="#orcamento">Montar meu evento</Button>
        <Button href="tel:+553135112373" variant="outline" arrow={false}>
          Ligar para a equipe
        </Button>
      </PageHero>
      <Stats
        items={[
          ["150", "convidados no espaço gourmet"],
          ["100", "convidados no salão inferior"],
          ["1.110 m", "de pista para acelerar"],
        ]}
      />
      <section className="container section">
        <SectionTitle description="O formato certo para a sua turma.">
          Motivos para <em>comemorar.</em>
        </SectionTitle>
        <div className="event-types">
          {[
            [
              "Aniversário",
              "Um novo ano. Uma nova volta.",
              "Troque a festa de sempre por disputa, risadas e uma comemoração no pódio.",
            ],
            [
              "Grupo de amigos",
              "A amizade entra no grid.",
              "Reúna a turma para descobrir quem é mais rápido e compartilhar uma experiência diferente.",
            ],
            [
              "Evento corporativo",
              "Conexões fora do escritório.",
              "Integração, desafio e confraternização com apoio para organizar o encontro da sua equipe.",
            ],
          ].map(([k, t, d], i) => (
            <button className="event-type" key={k} onClick={() => choose(k)}>
              <span className="step-number">0{i + 1}</span>
              <h3>{k}</h3>
              <strong>{t}</strong>
              <p>{d}</p>
              <span className="text-link">Solicitar orçamento</span>
            </button>
          ))}
        </div>
      </section>
      <section className="surface section">
        <div className="container">
          <SectionTitle description="Ambientes para receber, integrar e celebrar.">
            A pista é só <em>o começo.</em>
          </SectionTitle>
          <div className="spaces">
            {[
              [
                "gourmet",
                "Espaço Gourmet",
                "Até 150 convidados",
                "Segundo pavimento com vista para o circuito, cozinha e churrasqueira. Espaço para recepção e confraternização.",
              ],
              [
                "salao",
                "Salão Inferior",
                "Até 100 convidados",
                "Ambiente no térreo, com boa circulação e layout flexível para aniversários, reuniões e encontros corporativos.",
              ],
            ].map(([im, t, c, d]) => (
              <article key={t}>
                <img src={`/media/${im}.webp`} alt={t} loading="lazy" />
                <div className="space-copy">
                  <div>
                    <h3>{t}</h3>
                    <p>{d}</p>
                  </div>
                  <span>{c}</span>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
      <section className="container section quote-section" id="orcamento">
        <div>
          <span className="section-label">Vamos organizar juntos</span>
          <h2>
            O seu evento
            <br />
            começa <em>aqui.</em>
          </h2>
          <p>
            Conte o que você imagina. A equipe retorna no WhatsApp com os
            formatos, a disponibilidade e os próximos passos.
          </p>
          <ul className="check-list">
            {[
              "Data e formato definidos com você",
              "Equipe de apoio do início à bandeirada",
              "Estrutura para receber sua turma",
            ].map((t) => (
              <li key={t}>
                <Check size={18} />
                {t}
              </li>
            ))}
          </ul>
          <p className="small muted">
            Baterias exclusivas: mínimo de 25 pilotos de terça a sexta, ou 30
            nos finais de semana e feriados. Consulte as condições do seu
            evento.
          </p>
        </div>
        {message && (
          <div
            className="quote-result"
            ref={result}
            tabIndex={-1}
            role="status"
          >
            <CheckCircle2 size={40} />
            <h3>Seu pedido está pronto.</h3>
            <p>
              Abra o WhatsApp e envie a mensagem para que a equipe receba seu
              pedido de orçamento.
            </p>
            <Button href={whatsapp(message)}>Enviar no WhatsApp</Button>
            <button className="back-button" onClick={() => setMessage("")}>
              <ArrowLeft size={16} />
              Revisar informações
            </button>
          </div>
        )}
        <form hidden={!!message} className="form-panel" onSubmit={submit}>
          <label>
            Seu nome
            <input
              name="nome"
              autoComplete="name"
              required
              maxLength="100"
              placeholder="Como podemos chamar você?"
            />
          </label>
          <label>
            Tipo de evento
            <select
              name="tipo"
              value={kind}
              onChange={(e) => setKind(e.target.value)}
            >
              <option>Aniversário</option>
              <option>Grupo de amigos</option>
              <option>Evento corporativo</option>
            </select>
          </label>
          <div className="form-row">
            <label>
              Quantidade de pessoas
              <input
                type="number"
                name="pessoas"
                min="1"
                max="1000"
                required
                placeholder="Ex.: 30"
              />
            </label>
            <label>
              Data desejada
              <input
                type="date"
                name="data"
                required
                min={new Date().toLocaleDateString("en-CA", {
                  timeZone: "America/Sao_Paulo",
                })}
              />
            </label>
          </div>
          <label>
            Conte um pouco mais <span className="muted">(opcional)</span>
            <textarea
              name="mensagem"
              rows="3"
              maxLength="1000"
              placeholder="Horário, comemoração, ideias para o evento..."
            />
          </label>
          <button type="submit" className="button">
            Preparar pedido de orçamento
          </button>
          <p className="small muted">
            O próximo passo abre uma mensagem pronta no WhatsApp. Envie para
            solicitar o orçamento.
          </p>
        </form>
      </section>
    </>
  );
}
