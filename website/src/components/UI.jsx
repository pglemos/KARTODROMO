import { Link } from "react-router-dom";
import { ArrowUpRight, ArrowRight, MapPin } from "lucide-react";
import { BOOKING, whatsapp } from "../data.js";
export function Button({
  to,
  href,
  onClick,
  children,
  variant = "",
  className = "",
  arrow = true,
  ...props
}) {
  const content = (
    <>
      {children}
      {arrow && <ArrowUpRight size={19} aria-hidden="true" />}
    </>
  );
  const p = { className: `button ${variant} ${className}`, onClick, ...props };
  return to ? (
    <Link to={to} {...p}>
      {content}
    </Link>
  ) : href ? (
    <a href={href} {...p}>
      {content}
    </a>
  ) : (
    <button type="button" {...p}>
      {content}
    </button>
  );
}
export function TextLink({ to, href, children, ...props }) {
  return to ? (
    <Link className="text-link" to={to} {...props}>
      {children}
      <ArrowUpRight size={19} aria-hidden="true" />
    </Link>
  ) : (
    <a className="text-link" href={href} {...props}>
      {children}
      <ArrowUpRight size={19} aria-hidden="true" />
    </a>
  );
}
export function SectionTitle({ children, description }) {
  return (
    <div className="section-title">
      <h2>{children}</h2>
      {description && <p>{description}</p>}
    </div>
  );
}
export function Breadcrumb({ current, parent }) {
  return (
    <div className="breadcrumb">
      <Link to="/">Início</Link>
      <ArrowRight size={12} />
      {parent && (
        <>
          <Link to={parent.to}>{parent.label}</Link>
          <ArrowRight size={12} />
        </>
      )}
      <span>{current}</span>
    </div>
  );
}
export function PageHero({
  title,
  accent,
  description,
  image = "hero",
  children,
  compact = false,
}) {
  return (
    <section className={`page-hero ${compact ? "compact" : ""}`}>
      <img className="page-hero-image" src={`/media/${image}.webp`} alt="" />
      <div className="container page-hero-inner">
        <h1>
          {title}
          {accent && (
            <>
              <br />
              <em>{accent}</em>
            </>
          )}
        </h1>
        {description && <p>{description}</p>}
        {children && <div className="actions">{children}</div>}
      </div>
    </section>
  );
}
export function Stats({ items }) {
  return (
    <div className="stats">
      <div className="container stats-inner">
        {items.map(([value, label]) => (
          <div key={label}>
            <strong>{value}</strong>
            <span>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
export function CallToAction({ title = "Nos vemos no grid.", text, children }) {
  return (
    <section className="cta-band">
      <div className="container">
        <div>
          <h2>{title}</h2>
          {text && <p>{text}</p>}
        </div>
        {children || (
          <Button href={BOOKING} variant="dark">
            Reservar corrida
          </Button>
        )}
      </div>
    </section>
  );
}
export function ContactBand({
  title = "Qual é o seu desafio?",
  text = "Fale com a nossa equipe e encontre a melhor forma de acelerar.",
}) {
  return (
    <section className="container contact-band">
      <h2>{title}</h2>
      <p>{text}</p>
      <Button
        href={whatsapp(
          "Olá! Gostaria de saber mais sobre o Kartódromo de Betim.",
        )}
        variant="outline"
      >
        Conversar no WhatsApp
      </Button>
    </section>
  );
}
export function Location() {
  return (
    <span className="location">
      <MapPin size={18} aria-hidden="true" />
      Betim, Minas Gerais
    </span>
  );
}
