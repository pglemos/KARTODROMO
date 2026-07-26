import SectionHeading from './site-ui/SectionHeading';

const galleryItems = [
  { url: '/gallery/action-1.png', title: 'Disputa na pista', caption: 'Emoção do início ao fim' },
  { url: '/gallery/finish-flag.png', title: 'Chegada', caption: 'A bandeira quadriculada de todo piloto' },
  { url: '/gallery/kart-grid.png', title: 'Grid completo', caption: 'Karts prontos para a largada' },
  { url: '/gallery/driver-portrait.png', title: 'Nossos pilotos', caption: 'De iniciantes a campeões' },
  { url: '/gallery/night-timing.png', title: 'Cronometragem em tempo real', caption: 'Resultado de cada volta na pista' },
];

const Gallery = () => {
  return (
    <section className="border-t border-white/10 bg-ink-900 py-16 md:py-24">
      <div className="container mx-auto px-4">
        <SectionHeading
          eyebrow="Viva essa experiência"
          title={
            <>
              Adrenalina que
              <br />
              <span className="text-primary-400">conecta</span>
            </>
          }
        />

        <div className="mt-14 grid grid-cols-2 gap-3 md:grid-cols-5">
          {galleryItems.map((item, index) => (
            <figure
              key={item.url}
              className={`group relative h-[260px] overflow-hidden border border-white/10 [clip-path:polygon(8%_0,100%_0,92%_100%,0_100%)] ${
                index === 0 ? 'col-span-2 md:col-span-1' : ''
              }`}
            >
              <img
                src={item.url}
                alt={item.title}
                loading="lazy"
                className="h-full w-full object-cover brightness-[0.7] contrast-[1.1] grayscale-[0.2] transition-all duration-500 group-hover:scale-105 group-hover:brightness-90 group-hover:grayscale-0"
              />
              <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink-950/95 to-transparent p-4">
                <strong className="block font-race text-xs italic font-bold uppercase tracking-wide text-white">{item.title}</strong>
                <span className="mt-0.5 block text-[11px] text-white/60">{item.caption}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Gallery;
