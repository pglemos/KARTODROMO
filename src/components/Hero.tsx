import { Calendar, Compass, Trophy, Zap } from 'lucide-react';
import { MYLAPTIME_BOOKING_URL } from '../config/booking';

const Hero = () => {
  return (
    <section id="home" className="home-hero relative flex min-h-[78vh] items-center overflow-hidden bg-[#fbfcfa] py-10 md:min-h-[88vh] md:py-16">
      <video
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        poster="/posters/home-karting.jpg"
        className="absolute inset-0 z-0 h-full w-full object-cover"
      >
        <source
          src="/videos/home-karting.mp4"
          type="video/mp4"
        />
      </video>

      <div aria-hidden="true" className="home-hero-wash absolute inset-0 z-10" />
      <div aria-hidden="true" className="home-speedline home-speedline-a" />
      <div aria-hidden="true" className="home-speedline home-speedline-b" />

      <div className="container relative z-20 mx-auto w-full px-4">
        <div className="max-w-5xl">
          <div className="home-eyebrow mb-5 inline-flex items-center gap-2 border border-primary-500/25 bg-white/85 px-3.5 py-1.5 text-xs font-black uppercase tracking-[0.18em] text-primary-700 shadow-sm backdrop-blur md:mb-6 md:tracking-[0.22em]">
            <Zap className="h-4 w-4" />
            <span>Pista padrão internacional</span>
          </div>

          <h1 className="home-title mb-5 max-w-5xl text-4xl font-black uppercase leading-[0.9] tracking-tight text-zinc-950 sm:text-5xl md:mb-6 md:text-7xl lg:text-8xl">
            Kartódromo Internacional de Betim
          </h1>

          <p className="mb-7 max-w-2xl text-sm leading-7 text-zinc-700 md:mb-10 md:text-lg md:leading-8">
            Sinta a velocidade pura em uma pista homologada de <strong className="font-semibold text-zinc-950">1.110 metros</strong> de extensão.
            Karts modernos, total segurança e a estrutura de lazer mais completa de Minas Gerais para você e sua família.
          </p>

          <div className="mb-8 flex flex-col gap-3 sm:flex-row md:mb-14 md:gap-4">
            <a
              href={MYLAPTIME_BOOKING_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="home-cta inline-flex min-h-12 items-center justify-center bg-primary-500 px-6 py-3.5 text-center text-xs font-black uppercase tracking-[0.14em] text-zinc-950 shadow-[0_16px_34px_rgba(0,200,83,0.24)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-primary-400 hover:shadow-[0_20px_42px_rgba(0,200,83,0.28)] md:min-h-14 md:px-8 md:py-4 md:tracking-[0.16em]"
            >
              Reservar corrida online
            </a>
            <a
              href="https://wa.me/553135112373"
              target="_blank"
              rel="noopener noreferrer"
              className="home-cta inline-flex min-h-12 items-center justify-center border border-zinc-200 bg-white/82 px-6 py-3.5 text-center text-xs font-black uppercase tracking-[0.14em] text-zinc-800 shadow-sm backdrop-blur transition-all duration-300 hover:-translate-y-0.5 hover:border-primary-500/40 hover:bg-white md:min-h-14 md:px-8 md:py-4 md:tracking-[0.16em]"
            >
              Falar no WhatsApp
            </a>
          </div>

          <div className="home-stat-grid grid grid-cols-2 gap-2 border-t border-zinc-200/85 pt-5 md:grid-cols-4 md:gap-4 md:pt-6">
            <div className="home-stat flex items-center gap-3 border border-zinc-200 bg-white/82 p-3 shadow-sm backdrop-blur">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center border border-primary-500/20 bg-primary-50 text-primary-700">
                <Compass className="h-5 w-5" />
              </div>
              <div>
                <div className="text-xl font-black leading-tight text-zinc-950">1.110m</div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Extensão da pista</div>
              </div>
            </div>

            <div className="home-stat flex items-center gap-3 border border-zinc-200 bg-white/82 p-3 shadow-sm backdrop-blur">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center border border-primary-500/20 bg-primary-50 text-primary-700">
                <Trophy className="h-5 w-5" />
              </div>
              <div>
                <div className="text-xl font-black leading-tight text-zinc-950">42</div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Traçados diferentes</div>
              </div>
            </div>

            <div className="home-stat flex items-center gap-3 border border-zinc-200 bg-white/82 p-3 shadow-sm backdrop-blur">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center border border-primary-500/20 bg-primary-50 text-primary-700">
                <Zap className="h-5 w-5" />
              </div>
              <div>
                <div className="text-xl font-black leading-tight text-zinc-950">400cc</div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Motores Super Kart</div>
              </div>
            </div>

            <div className="home-stat flex items-center gap-3 border border-zinc-200 bg-white/82 p-3 shadow-sm backdrop-blur">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center border border-primary-500/20 bg-primary-50 text-primary-700">
                <Calendar className="h-5 w-5" />
              </div>
              <div>
                <div className="text-xl font-black leading-tight text-zinc-950">25+ anos</div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Tradição e emoção</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
