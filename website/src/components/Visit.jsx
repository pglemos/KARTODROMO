import { MapPin, ArrowUpRight, Phone, Clock } from "lucide-react";
import { Button } from "./UI.jsx";
import { WA } from "../data.js";
export const MAPS =
  "https://www.google.com/maps/search/?api=1&query=Kartodromo+Internacional+de+Betim";
export default function Visit() {
  return (
    <section className="visit-section container section">
      <div className="visit-image">
        <img
          src="/media/sunset.webp"
          width="900"
          height="700"
          alt="O pôr do sol e a pista iluminada do Kartódromo de Betim"
          loading="lazy"
        />
        <a href={MAPS} target="_blank" rel="noopener noreferrer">
          <MapPin size={19} />
          Betim, Minas Gerais
          <ArrowUpRight size={19} />
        </a>
      </div>
      <div className="visit-copy">
        <h2>
          O caminho
          <br />
          termina <em>no grid.</em>
        </h2>
        <p>Prepare a sua visita ao Kartódromo Internacional de Betim.</p>
        <div className="visit-address">
          <MapPin size={20} />
          <div>
            <strong>Av. Adutora Várzea das Flores, 477</strong>
            <span>Itacolomi · Betim, MG</span>
          </div>
        </div>
        <div className="visit-hours">
          <Clock size={20} />
          <dl>
            <div>
              <dt>Terça a sexta</dt>
              <dd>16h às 22h</dd>
            </div>
            <div>
              <dt>Sábado e domingo</dt>
              <dd>08h às 19h</dd>
            </div>
            <div>
              <dt>Segunda-feira</dt>
              <dd>Manutenção</dd>
            </div>
          </dl>
        </div>
        <div className="actions">
          <Button href={MAPS} target="_blank" rel="noopener noreferrer">
            Traçar minha rota
          </Button>
          <a className="text-link" href={WA}>
            <Phone size={17} />
            Falar com a equipe
          </a>
        </div>
      </div>
    </section>
  );
}
