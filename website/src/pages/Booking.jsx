import { useState } from "react";
import {
  Clock,
  ShieldCheck,
  Flag,
  Minus,
  Plus,
  Check,
  ArrowRight,
} from "lucide-react";
import { BOOKING, money, whatsapp } from "../data.js";
import { Button, Breadcrumb, TextLink } from "../components/UI.jsx";
import QuickFAQ from "../components/QuickFAQ.jsx";
import Visit from "../components/Visit.jsx";
export default function Booking() {
  const [pilots, setPilots] = useState(1);
  const [kind, setKind] = useState("regular");
  const exclusive = kind === "exclusive";
  return (
    <>
      <div className="container">
        <Breadcrumb current="Reservas" />
      </div>
      <section className="container booking-page">
        <div className="booking-story">
          <h1>
            Seu próximo
            <br />
            <em>grande momento.</em>
          </h1>
          <p>
            Encontre seu lugar no grid. Da primeira experiência à disputa entre
            amigos, a próxima corrida começa com a sua reserva.
          </p>
          <div className="booking-photo">
            <img
              src="/media/action.webp"
              alt="Uma bateria de kart em disputa no Kartódromo de Betim"
              fetchPriority="high"
              width="1000"
              height="700"
            />
            <span>
              <Flag size={18} />
              30 minutos para mudar o seu dia.
            </span>
          </div>
          <div className="booking-included">
            <span>
              <ShieldCheck size={19} />
              Equipamentos
            </span>
            <span>
              <Clock size={19} />
              Briefing
            </span>
            <span>
              <Flag size={19} />
              Cronometragem
            </span>
          </div>
        </div>
        <section
          id="planejar"
          tabIndex={-1}
          className="booking-builder"
          aria-labelledby="booking-title"
        >
          <h2 id="booking-title">Vamos para a pista?</h2>
          <p>Planeje sua corrida e consulte os horários na agenda oficial.</p>
          <fieldset className="booking-kind">
            <legend>Como você quer correr?</legend>
            <button
              type="button"
              aria-pressed={!exclusive}
              onClick={() => setKind("regular")}
            >
              <strong>Bateria aberta</strong>
              <span>Você e seus amigos, junto de outros pilotos</span>
              <Check size={18} />
            </button>
            <button
              type="button"
              aria-pressed={exclusive}
              onClick={() => setKind("exclusive")}
            >
              <strong>Bateria exclusiva</strong>
              <span>Uma corrida só para o seu grupo</span>
              <Check size={18} />
            </button>
          </fieldset>
          {!exclusive ? (
            <>
              <div className="pilot-quantity">
                <label htmlFor="booking-pilots">Quantos pilotos?</label>
                <div>
                  <button
                    className="icon-button"
                    aria-label="Diminuir pilotos"
                    disabled={pilots <= 1}
                    onClick={() => setPilots(Math.max(1, pilots - 1))}
                  >
                    <Minus size={17} />
                  </button>
                  <input
                    id="booking-pilots"
                    type="number"
                    min="1"
                    max="30"
                    value={pilots}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      setPilots(
                        Math.min(
                          30,
                          Math.max(1, Number.isFinite(n) ? Math.round(n) : 1),
                        ),
                      );
                    }}
                  />
                  <button
                    className="icon-button"
                    aria-label="Aumentar pilotos"
                    disabled={pilots >= 30}
                    onClick={() => setPilots(Math.min(30, pilots + 1))}
                  >
                    <Plus size={17} />
                  </button>
                </div>
              </div>
              <div className="booking-estimate" aria-live="polite">
                <span>Estimativa com pagamento antecipado</span>
                <strong>{money(pilots * 145)}</strong>
                <small>
                  {pilots} {pilots === 1 ? "piloto" : "pilotos"} × R$ 145 · 30
                  minutos de bateria
                </small>
              </div>
              <Button href={BOOKING}>Escolher dia e horário</Button>
              <p className="booking-note">
                Você continuará na agenda oficial. Preço, vagas e pagamento são
                confirmados na reserva.
              </p>
            </>
          ) : (
            <div className="exclusive-booking">
              <h3>A pista para a sua turma.</h3>
              <dl>
                <div>
                  <dt>Terça a sexta</dt>
                  <dd>Mínimo de 25 pilotos</dd>
                </div>
                <div>
                  <dt>Finais de semana e feriados</dt>
                  <dd>Mínimo de 30 pilotos</dd>
                </div>
              </dl>
              <p>
                O formato, os valores e a disponibilidade são combinados com a
                equipe.
              </p>
              <Button
                href={whatsapp(
                  "Olá! Quero organizar uma bateria exclusiva no Kartódromo de Betim. Podem me informar os formatos e a disponibilidade?",
                )}
              >
                Consultar bateria exclusiva
              </Button>
              <TextLink to="/eventos">
                Incluir um espaço para comemorar
              </TextLink>
            </div>
          )}
        </section>
      </section>
      <section className="container booking-preparation">
        <h2>
          Chegue com tudo <em>pronto.</em>
        </h2>
        <div>
          <article>
            <Clock size={24} />
            <h3>Uma hora antes</h3>
            <p>Chegue com antecedência para cadastro, pesagem e equipamento.</p>
          </article>
          <article>
            <ShieldCheck size={24} />
            <h3>Requisitos do piloto</h3>
            <p>
              14 anos, 1,50 m e 50 kg mínimos. Use calçado fechado. Menores
              devem vir com responsável.
            </p>
          </article>
          <article>
            <ArrowRight size={24} />
            <h3>Do briefing à bandeirada</h3>
            <p>
              Orientação de segurança, tomada de tempo, grid e corrida
              cronometrada.
            </p>
          </article>
        </div>
      </section>
      <QuickFAQ indices={[0, 2, 3]} />
      <Visit />
    </>
  );
}
