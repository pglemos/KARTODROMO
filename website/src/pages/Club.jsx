import { Link, NavLink } from "react-router-dom";
import {
  LockKeyhole,
  CalendarDays,
  LayoutDashboard,
  Trophy,
  Flag,
  ShoppingBag,
  Gift,
  Megaphone,
  UserRound,
  FileText,
  ArrowUpRight,
  CircleUserRound,
} from "lucide-react";
import { clubNav, clubRules, whatsapp } from "../data.js";
import {
  PageHero,
  Button,
  SectionTitle,
  TextLink,
  Breadcrumb,
} from "../components/UI.jsx";
const icons = [
  LayoutDashboard,
  Trophy,
  Flag,
  ShoppingBag,
  Gift,
  Megaphone,
  UserRound,
  FileText,
];
const states = {
  painel: [
    "Meu painel",
    "Seu clube está chegando.",
    "Estamos preparando a integração com as suas corridas. Em breve, você poderá acompanhar seus pontos e benefícios por aqui.",
  ],
  consulta: [
    "Consultar pontos",
    "Cada volta terá seu valor.",
    "A consulta de pontos será liberada com a integração segura ao cadastro de pilotos e às corridas confirmadas. Você poderá consultar seu saldo real aqui.",
  ],
  pontuacao: [
    "Minha pontuação",
    "Pontos que contam a sua história.",
    "Sua pontuação será calculada a partir das corridas elegíveis confirmadas pelo kartódromo. A consulta autenticada ainda está em implantação.",
  ],
  corridas: [
    "Histórico de corridas",
    "Suas voltas, em um só lugar.",
    "O histórico será conectado à cronometragem e ao cadastro de pilotos. Quando a integração estiver pronta, suas corridas reais aparecerão aqui.",
  ],
  catalogo: [
    "Catálogo de recompensas",
    "Novas experiências no horizonte.",
    "O catálogo será publicado com as recompensas disponíveis, os pontos necessários e as condições de retirada. Não há resgates disponíveis neste momento.",
  ],
  resgates: [
    "Meus resgates",
    "Suas conquistas vão aparecer aqui.",
    "O histórico de resgates será liberado junto com o catálogo e o fluxo de retirada. Nenhum resgate é processado nesta página neste momento.",
  ],
  campanhas: [
    "Campanhas",
    "Mais motivos para voltar.",
    "Campanhas especiais serão publicadas com período, critérios e benefícios definidos. Acompanhe os canais oficiais para conhecer os próximos lançamentos.",
  ],
  perfil: [
    "Meu perfil",
    "Seu lugar no clube.",
    "A edição de perfil será liberada com a conta autenticada e a integração segura ao cadastro. Nenhuma alteração de dados é processada por esta tela.",
  ],
  cadastro: [
    "Cadastro no clube",
    "A próxima largada está chegando.",
    "O cadastro gratuito será liberado após a integração segura com o sistema de corridas. Fale com a equipe para saber mais sobre o lançamento.",
  ],
};
function PointRules() {
  return (
    <div className="points-rules">
      {[
        ["20", "Corridas de terça a sexta"],
        ["10", "Sábados, domingos e feriados"],
      ].map(([n, t]) => (
        <div key={n}>
          <CalendarDays size={26} />
          <div>
            <strong>{n} pontos</strong>
            <span>{t}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
export function ClubLanding() {
  return (
    <>
      <div className="container">
        <Breadcrumb current="Clube de Vantagens" />
      </div>
      <PageHero
        title="Quem ama a pista"
        accent="merece mais."
        description="Conheça o Clube de Vantagens, o programa de relacionamento para reconhecer quem faz parte da nossa história. Quanto mais você corre, mais a história continua."
        image="grid"
      >
        <Button to="/clube-painel">Conhecer a área do piloto</Button>
        <Button to="/clube-regulamento" variant="outline">
          Ver regulamento
        </Button>
      </PageHero>
      <section className="container section club-intro">
        <div>
          <span className="section-label">Programa em implantação</span>
          <h2>
            Sua paixão,
            <br />
            novas <em>conquistas.</em>
          </h2>
          <p>
            Estamos preparando o clube para conectar suas corridas a pontos,
            experiências e benefícios. A adesão prevista é gratuita.
          </p>
          <p className="muted">
            Cadastro, pontuação e resgates serão liberados após a integração com
            o sistema real de corridas.
          </p>
          <TextLink
            href={whatsapp(
              "Olá! Gostaria de saber sobre o lançamento do Clube de Vantagens.",
            )}
          >
            Saber mais com a equipe
          </TextLink>
        </div>
        <div>
          <h3>Regras previstas de pontuação</h3>
          <p className="muted">
            Os pontos serão creditados após a confirmação das corridas
            elegíveis, quando a integração estiver disponível.
          </p>
          <PointRules />
        </div>
      </section>
      <section className="surface section">
        <div className="container">
          <SectionTitle>
            Seu próximo <em>capítulo.</em>
          </SectionTitle>
          <div className="steps">
            {[
              [
                "01",
                "Entre para o clube",
                "Cadastro gratuito, disponível após a liberação do programa.",
              ],
              [
                "02",
                "Acumule pontos",
                "Corra nas baterias elegíveis e acompanhe a pontuação confirmada.",
              ],
              [
                "03",
                "Escolha uma recompensa",
                "Consulte o catálogo e as condições de resgate quando forem publicados.",
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
        <SectionTitle description="Uma área pensada para acompanhar a sua experiência.">
          Tudo sobre <em>o seu clube.</em>
        </SectionTitle>
        <div className="club-links">
          {clubNav.map(([key, label], i) => {
            const Icon = icons[i];
            return (
              <Link to={`/clube-${key}`} key={key}>
                <Icon size={22} />
                <span>{label}</span>
                <ArrowUpRight size={20} />
              </Link>
            );
          })}
        </div>
      </section>
    </>
  );
}
export function ClubPortal({ section = "painel" }) {
  const s = states[section] || states.painel;
  const regulation = section === "regulamento";
  return (
    <div className="container club-shell">
      <aside className="club-sidebar">
        <Link to="/clube-vantagens" className="club-sidebar-title">
          Clube de Vantagens
        </Link>
        <nav aria-label="Menu do clube">
          {clubNav.map(([key, label], i) => {
            const Icon = icons[i];
            return (
              <NavLink to={`/clube-${key}`} key={key}>
                <Icon size={19} />
                {label}
              </NavLink>
            );
          })}
          <NavLink to="/clube-cadastro">
            <CircleUserRound size={19} />
            Cadastro
          </NavLink>
          <NavLink to="/clube-consulta">
            <Trophy size={19} />
            Consultar pontos
          </NavLink>
        </nav>
        <Link className="club-back" to="/clube-vantagens">
          Voltar ao programa
          <ArrowUpRight size={16} />
        </Link>
      </aside>
      <div className="club-main">
        <Breadcrumb
          current={regulation ? "Regulamento" : s[0]}
          parent={{ to: "/clube-vantagens", label: "Clube" }}
        />
        <div className="club-page-hero">
          <h1>
            {regulation ? "As regras do" : "Sua história"}
            <br />
            <em>{regulation ? "seu clube." : "na pista continua."}</em>
          </h1>
        </div>
        {regulation ? (
          <div className="club-regulation">
            <p className="info-note">
              O programa está em implantação. As regras abaixo descrevem os
              benefícios previstos; cadastro, pontos e resgates dependem da
              liberação da integração.
            </p>
            {clubRules.map(([title, items]) => (
              <section key={title}>
                <h2>{title}</h2>
                {items.map((t) => (
                  <p key={t}>{t}</p>
                ))}
              </section>
            ))}
            <Button
              href={whatsapp(
                "Olá! Tenho uma dúvida sobre o regulamento do Clube de Vantagens.",
              )}
            >
              Tirar uma dúvida
            </Button>
          </div>
        ) : (
          <>
            <section className="club-empty">
              <div className="lock-icon">
                <LockKeyhole size={29} />
              </div>
              <span className="section-label">{s[0]}</span>
              <h2>{s[1]}</h2>
              <p>{s[2]}</p>
              <div className="actions">
                <Button
                  href={whatsapp(
                    "Olá! Gostaria de saber sobre o lançamento do Clube de Vantagens.",
                  )}
                >
                  Falar com a equipe
                </Button>
                <TextLink to="/clube-vantagens">Conhecer o programa</TextLink>
              </div>
            </section>
            <section className="club-planned">
              <h2>Regras previstas do programa</h2>
              <p>
                O Clube de Vantagens ainda não foi lançado. Confira as regras
                previstas de pontuação, sujeitas às condições do regulamento.
              </p>
              <PointRules />
              <TextLink to="/clube-regulamento">Ler o regulamento</TextLink>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
