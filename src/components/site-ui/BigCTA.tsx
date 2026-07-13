import type { ReactNode } from 'react';

type BigCTAProps = {
  watermark: string;
  title: ReactNode;
  text: string;
  children: ReactNode;
};

const BigCTA = ({ watermark, title, text, children }: BigCTAProps) => {
  return (
    <div className="relative overflow-hidden border border-white/10 bg-gradient-to-br from-ink-700 to-ink-950 p-8 md:p-14">
      <span
        aria-hidden="true"
        className="absolute -bottom-6 right-0 select-none font-display text-[22vw] italic leading-none text-white/[0.03] md:text-[16vw]"
      >
        {watermark}
      </span>
      <div className="relative z-10 grid gap-8 md:grid-cols-[1.2fr_0.8fr] md:items-center">
        <div>
          <h2 className="font-display text-4xl italic uppercase leading-[0.85] tracking-tight text-white md:text-6xl">
            {title}
          </h2>
          <p className="mt-4 max-w-md text-base text-white/65">{text}</p>
        </div>
        <div className="grid gap-3">{children}</div>
      </div>
    </div>
  );
};

export default BigCTA;
