import { Check, Clock, ShieldCheck, Flag } from "lucide-react";
import { whatsapp } from "../data.js";
import Gallery from "../components/Gallery.jsx";
import QuickFAQ from "../components/QuickFAQ.jsx";
import {
  PageHero,
  Button,
  Stats,
  SectionTitle,
  TextLink,
  CallToAction,
  Breadcrumb,
} from "../components/UI.jsx";
export default function Rental() {
  return (
    <>
      <div className="container">
        <Breadcrumb current={"Kart de locação"} />
      </div>
      <PageHero
        title={"Entre no grid."}
        accent={"Saia da rotina."}
        description="30 minutos de adrenalina, cronometragem e disputa em uma pista de 1.110 metros. Você só precisa chegar com vontade de acelerar."
      >
        <Button to="/reservas">Reservar minha corrida</Button>
        <Button
          href={whatsapp(
            "Olá! Quero tirar uma dúvida sobre o kart de locação.",
          )}
          variant="outline"
        >
          Tirar uma dúvida
        </Button>
      </PageHero>
      <Stats
        items={[
          ["R$ 145", "por piloto · pagamento antecipado"],
          ["30 min", "de bateria completa"],
          ["13 HP", "Honda GX390"],
        ]}
      />
      <section className="container section rental-booking">
        <div>
          <span className="section-label">O seu lugar no grid</span>
          <h2>
            Menos rotina.
            <br />
            Mais <em>adrenalina.</em>
          </h2>
          <p>
            Uma experiência completa para iniciantes e pilotos habituais. Kart,
            capacete, macacão, cronometragem e briefing de segurança fazem parte
            da sua bateria.
          </p>
          <ul className="check-list">
            {[
              "Reserve na agenda online por Pix ou cartão.",
              "Chegue com 1 hora de antecedência.",
              "Receba os equipamentos e as orientações.",
              "Entre na pista e descubra o seu melhor tempo.",
            ].map((t) => (
              <li key={t}>
                <Check size={18} />
                {t}
              </li>
            ))}
          </ul>
        </div>
        <div className="price-panel">
          <div className="price-panel-top">
            <span>Reserva online</span>
            <span>Pagamento antecipado</span>
          </div>
          <strong className="price">
            <span>R$</span>145<small>/ piloto</small>
          </strong>
          <p>
            Preço normal <s>R$ 175</s> · Economia de R$ 30
          </p>
          <div className="price-includes">
            <span>
              <Clock size={18} />
              30 minutos
            </span>
            <span>
              <ShieldCheck size={18} />
              Equipamento incluso
            </span>
            <span>
              <Flag size={18} />
              Cronometragem
            </span>
          </div>
          <Button to="/reservas">Ver horários disponíveis</Button>
          <span className="price-note">
            A disponibilidade e a confirmação são feitas na agenda oficial.
          </span>
        </div>
      </section>
      <section className="section surface">
        <div className="container">
          <SectionTitle description="Da primeira orientação à bandeira quadriculada.">
            Sua corrida, <em>passo a passo.</em>
          </SectionTitle>
          <div className="steps">
            {[
              [
                "01",
                "Prepare-se",
                "Cadastro, pesagem, equipamento e briefing. Chegue com 1 hora de antecedência.",
              ],
              [
                "02",
                "Monte o grid",
                "Tomada de tempo de 5 minutos e organização da largada em 5 minutos.",
              ],
              [
                "03",
                "Acelere",
                "20 minutos de corrida cronometrada. Encontre seu ritmo e dispute cada curva.",
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
      <section className="container section">
        <SectionTitle description="Confira antes de reservar. Menores de idade devem vir com um responsável.">
          Pronto para <em>pilotar?</em>
        </SectionTitle>
        <div className="requirements">
          {[
            ["14 anos", "Idade mínima"],
            ["1,50 m", "Altura mínima"],
            ["50 kg", "Peso mínimo"],
            ["Tênis", "Calçado fechado"],
          ].map(([v, l]) => (
            <div key={l}>
              <strong>{v}</strong>
              <span>{l}</span>
            </div>
          ))}
        </div>
        <p className="muted small">
          As condições variam conforme a categoria. Consulte a equipe se tiver
          dúvidas sobre os requisitos ou precisar de atendimento adaptado.
        </p>
      </section>
      <section className="container group-band">
        <div>
          <h2>
            A turma toda
            <br />
            no <em>mesmo grid.</em>
          </h2>
          <p>
            Baterias fechadas: mínimo de 25 pilotos de terça a sexta, ou 30 aos
            finais de semana e feriados. Sempre conforme disponibilidade.
          </p>
        </div>
        <TextLink to="/eventos">Organizar meu grupo</TextLink>
      </section>
      <Gallery
        items={[
          ["karts", "A frota de karts"],
          ["action", "A experiência na pista"],
          ["grid", "A bandeirada"],
          ["night", "Corrida à noite"],
          ["driver", "O piloto e a pista"],
        ]}
        title="Essa emoção tem endereço."
      />
      <QuickFAQ />
      <CallToAction title="Seu lugar é na pista." />
    </>
  );
}
