import { useState, useCallback } from "react";
import { ChevronLeft, ChevronRight, Maximize2 } from "lucide-react";
import Dialog from "./Dialog.jsx";
const defaultItems = [
  ["action", "A disputa na pista"],
  ["sunset", "A luz do fim de tarde"],
  ["gourmet", "Um espaço para celebrar"],
  ["night", "A pista à noite"],
  ["karts", "A frota de karts"],
];
export default function Gallery({
  items = defaultItems,
  title = "De perto, é ainda melhor.",
}) {
  const [selected, setSelected] = useState(null);
  const close = useCallback(() => setSelected(null), []);
  const move = (direction) =>
    setSelected((i) => (i + direction + items.length) % items.length);
  return (
    <section className="container section venue-gallery">
      <div className="section-title">
        <h2>{title}</h2>
        <p>
          Imagens reais. Do lugar onde
          <br />a sua próxima história acontece.
        </p>
      </div>
      <div className="gallery-grid">
        {items.slice(0, 5).map(([image, label], index) => (
          <button
            key={image}
            onClick={() => setSelected(index)}
            aria-label={`Ampliar foto: ${label}`}
          >
            <img
              src={`/media/${image}.webp`}
              alt={label}
              loading="lazy"
              width="900"
              height="650"
            />
            <span>
              {label}
              <Maximize2 size={18} />
            </span>
          </button>
        ))}
      </div>
      {selected !== null && (
        <Dialog
          title={items[selected][1]}
          onClose={close}
          className="photo-dialog"
        >
          <img
            src={`/media/${items[selected][0]}.webp`}
            alt={items[selected][1]}
          />
          <div className="gallery-controls">
            <button
              className="icon-button"
              onClick={() => move(-1)}
              aria-label="Foto anterior"
            >
              <ChevronLeft />
            </button>
            <span aria-live="polite">
              {selected + 1} / {items.length}
            </span>
            <button
              className="icon-button"
              onClick={() => move(1)}
              aria-label="Próxima foto"
            >
              <ChevronRight />
            </button>
          </div>
        </Dialog>
      )}
    </section>
  );
}
