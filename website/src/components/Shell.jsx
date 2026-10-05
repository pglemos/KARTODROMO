import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import {
  Menu,
  X,
  MessageCircle,
  MapPin,
  ArrowUpRight,
  Clock,
  Phone,
} from "lucide-react";
import { WA } from "../data.js";
import { Button } from "./UI.jsx";
const nav = [
  ["/pista", "A pista"],
  ["/kart-locacao", "Kart de locação"],
  ["/campeonatos", "Campeonatos"],
  ["/eventos", "Eventos"],
  ["/clube-vantagens", "Clube"],
  ["/duvidas", "Dúvidas"],
];
export function Header() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const button = useRef(null);
  const menu = useRef(null);
  useEffect(() => setOpen(false), [location.pathname]);
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    menu.current?.querySelector("a")?.focus();
    const close = () => {
      setOpen(false);
      button.current?.focus();
    };
    const key = (e) => {
      if (e.key === "Escape") close();
      if (e.key === "Tab") {
        const nodes = [
          button.current,
          ...menu.current.querySelectorAll("a"),
        ].filter(Boolean);
        const i = nodes.indexOf(document.activeElement);
        if (e.shiftKey && i === 0) {
          e.preventDefault();
          nodes.at(-1).focus();
        } else if (!e.shiftKey && i === nodes.length - 1) {
          e.preventDefault();
          nodes[0].focus();
        }
      }
    };
    const resize = () => {
      if (window.innerWidth > 1100) close();
    };
    window.addEventListener("keydown", key);
    window.addEventListener("resize", resize);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", key);
      window.removeEventListener("resize", resize);
    };
  }, [open]);
  return (
    <>
      <a className="skip-link" href="#conteudo">
        Pular para o conteúdo
      </a>
      <div className="utility-bar">
        <div className="container">
          <a
            href="https://www.google.com/maps/search/?api=1&query=Kartodromo+Internacional+de+Betim"
            target="_blank"
            rel="noopener noreferrer"
          >
            <MapPin size={13} />
            Betim, Minas Gerais
          </a>
          <span>
            <Clock size={13} />
            Ter–Sex 16h–22h · Sáb–Dom 08h–19h
          </span>
          <a href={WA}>
            <Phone size={13} />
            (31) 99884-2898
          </a>
        </div>
      </div>
      <header className="header">
        <div className="container header-inner">
          <Link
            to="/"
            className="brand"
            aria-label="Kartódromo Internacional de Betim — início"
          >
            <img
              src="/media/logo.png"
              width="212"
              height="59"
              alt="Kartódromo Internacional de Betim"
            />
          </Link>
          <nav className="desktop-nav" aria-label="Navegação principal">
            {nav.map(([to, label]) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  isActive ||
                  (to === "/clube-vantagens" &&
                    location.pathname.startsWith("/clube-")) ||
                  (to === "/campeonatos" &&
                    [
                      "/kac",
                      "/kac-super",
                      "/100-milhas-light",
                      "/200-milhas",
                      "/500-milhas",
                    ].includes(location.pathname))
                    ? "active"
                    : ""
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>
          <Button
            className="header-book"
            to="/reservas#planejar"
            aria-label="Reservar corrida"
          >
            <span>
              Reservar<span className="reservation-extra"> corrida</span>
            </span>
          </Button>
          <button
            className="menu-button"
            ref={button}
            aria-expanded={open}
            aria-controls="mobile-navigation"
            aria-label={open ? "Fechar menu" : "Abrir menu"}
            onClick={() => setOpen(!open)}
          >
            {open ? <X /> : <Menu />}
          </button>
        </div>
      </header>
      <div
        id="mobile-navigation"
        ref={menu}
        className={`mobile-menu ${open ? "is-open" : ""}`}
        inert={!open}
        aria-hidden={!open}
      >
        <nav aria-label="Navegação mobile">
          {nav.map(([to, label], i) => (
            <NavLink key={to} to={to}>
              <span className="menu-number">0{i + 1}</span>
              {label}
              <ArrowUpRight size={24} />
            </NavLink>
          ))}
          <Button to="/reservas">Planejar minha corrida</Button>
          <a className="mobile-contact" href={WA}>
            Falar com a equipe no WhatsApp
          </a>
        </nav>
      </div>
    </>
  );
}
export function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-promise">
          <span>Kartódromo Internacional de Betim</span>
          <strong>A vida acontece. A pista fica.</strong>
          <a href={WA}>
            Vamos conversar
            <ArrowUpRight size={22} />
          </a>
        </div>
        <div className="footer-top">
          <div className="footer-brand">
            <Link to="/">
              <img
                src="/media/logo.png"
                width="235"
                height="65"
                alt="Kartódromo Internacional de Betim"
                loading="lazy"
              />
            </Link>
            <p>
              Uma pista. Muitas histórias.
              <br />A sua próxima começa aqui.
            </p>
            <Link className="text-link" to="/historia">
              Conheça nossa história
              <ArrowUpRight size={16} />
            </Link>
          </div>
          <div>
            <h3>Explore</h3>
            <div className="footer-links">
              {nav.map(([to, label]) => (
                <Link key={to} to={to}>
                  {label}
                </Link>
              ))}
              <Link to="/reservas">Reservas</Link>
            </div>
          </div>
          <div>
            <h3>Venha acelerar</h3>
            <a
              href="https://www.google.com/maps/search/?api=1&query=Kartodromo+Internacional+de+Betim"
              target="_blank"
              rel="noopener noreferrer"
              className="footer-address"
            >
              <MapPin size={18} />
              <span>
                Av. Adutora Várzea das Flores, 477
                <br />
                Itacolomi · Betim, MG
              </span>
            </a>
            <a href={WA}>(31) 99884-2898</a>
            <a href="tel:+553135112373">(31) 3511-2373</a>
            <a href="mailto:contato@kartodromodebetim.com.br">
              contato@kartodromodebetim.com.br
            </a>
            <div className="hours">
              <span>
                Terça a sexta <b>16h–22h</b>
              </span>
              <span>
                Sábado e domingo <b>08h–19h</b>
              </span>
              <span>
                Segunda <b>Manutenção</b>
              </span>
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <span>
            © {new Date().getFullYear()} Kartódromo Internacional de Betim
          </span>
          <span>Feito para quem ama a pista.</span>
        </div>
      </div>
    </footer>
  );
}
export function WhatsApp() {
  return (
    <a
      className="whatsapp-float"
      href={WA}
      aria-label="Falar com o kartódromo pelo WhatsApp"
    >
      <MessageCircle size={24} />
    </a>
  );
}
