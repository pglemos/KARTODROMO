import { Plus } from "lucide-react";
import { faq } from "../data.js";
import { TextLink } from "./UI.jsx";
export default function QuickFAQ({ indices = [0, 1, 3] }) {
  return (
    <section className="container section quick-faq">
      <div>
        <h2>
          Antes da
          <br />
          <em>primeira volta.</em>
        </h2>
        <p>O essencial para chegar com tranquilidade.</p>
        <TextLink to="/duvidas">Todas as dúvidas</TextLink>
      </div>
      <div className="faq-list">
        {indices.map((i) => (
          <details key={faq[i].q}>
            <summary>
              {faq[i].q}
              <Plus size={20} />
            </summary>
            <div className="faq-answer">
              <p>{faq[i].a}</p>
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
