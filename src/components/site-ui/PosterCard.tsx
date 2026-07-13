type PosterCardProps = {
  number: string;
  image: string;
  alt: string;
  title: string;
  description: string;
  ctaLabel: string;
  onCtaClick?: () => void;
  href?: string;
};

const PosterCard = ({ number, image, alt, title, description, ctaLabel, onCtaClick, href }: PosterCardProps) => {
  return (
    <article className="group relative isolate min-h-[460px] overflow-hidden border border-white/10 bg-ink-800 [clip-path:polygon(7%_0,100%_0,93%_100%,0_100%)] transition-transform duration-500 hover:-translate-y-3 hover:border-primary-400/60">
      <img
        src={image}
        alt={alt}
        className="absolute inset-0 -z-20 h-full w-full object-cover brightness-[0.55] contrast-[1.15] grayscale-[0.2] transition-all duration-700 group-hover:scale-105 group-hover:brightness-[0.65] group-hover:grayscale-0"
      />
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-ink-950 via-ink-950/70 to-transparent" />
      <span
        aria-hidden="true"
        className="absolute right-6 top-3 font-display text-[80px] italic text-transparent [-webkit-text-stroke:1px_rgba(255,255,255,0.2)]"
      >
        {number}
      </span>
      <div className="absolute inset-x-0 bottom-0 p-8">
        <h3 className="max-w-[8ch] font-display text-[clamp(34px,4vw,56px)] italic uppercase leading-[0.8] tracking-tight text-white">
          {title}
        </h3>
        <p className="mt-4 text-sm leading-relaxed text-white/70">{description}</p>
        {href ? (
          <a
            href={href}
            className="mt-5 inline-flex min-h-[44px] items-center gap-2 bg-gradient-to-br from-primary-400 to-primary-600 px-5 font-race text-[11px] italic font-bold uppercase tracking-wide text-ink-950 [clip-path:polygon(7%_0,100%_0,93%_100%,0_100%)]"
          >
            {ctaLabel}
          </a>
        ) : (
          <button
            type="button"
            onClick={onCtaClick}
            className="mt-5 inline-flex min-h-[44px] items-center gap-2 bg-gradient-to-br from-primary-400 to-primary-600 px-5 font-race text-[11px] italic font-bold uppercase tracking-wide text-ink-950 [clip-path:polygon(7%_0,100%_0,93%_100%,0_100%)]"
          >
            {ctaLabel}
          </button>
        )}
      </div>
    </article>
  );
};

export default PosterCard;
