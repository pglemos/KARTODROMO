import { Calendar, Compass, Trophy, Zap } from 'lucide-react';
import { MYLAPTIME_BOOKING_URL, WHATSAPP_BOOKING_URL } from '../config/booking';

const WhatsAppIcon = () => (
  <svg
    aria-hidden="true"
    className="h-5 w-5 flex-shrink-0 fill-current"
    viewBox="0 0 24 24"
  >
    <path d="M12.04 2a9.84 9.84 0 0 0-8.42 14.93L2 22l5.23-1.58A9.95 9.95 0 1 0 12.04 2Zm0 17.92a8.08 8.08 0 0 1-4.12-1.13l-.3-.18-3.1.94.96-3.02-.2-.31a8.02 8.02 0 1 1 6.76 3.7Zm4.42-6.04c-.24-.12-1.43-.7-1.65-.78-.22-.08-.38-.12-.54.12-.16.24-.62.78-.76.94-.14.16-.28.18-.52.06-.24-.12-1.02-.38-1.94-1.2a7.27 7.27 0 0 1-1.34-1.67c-.14-.24-.02-.37.1-.49.11-.11.24-.28.36-.42.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.54-1.3-.74-1.78-.2-.47-.4-.4-.54-.41h-.46c-.16 0-.42.06-.64.3-.22.24-.84.82-.84 2s.86 2.32.98 2.48c.12.16 1.7 2.6 4.12 3.64.58.25 1.03.4 1.38.51.58.18 1.1.16 1.52.1.46-.07 1.43-.59 1.63-1.15.2-.56.2-1.04.14-1.14-.06-.1-.22-.16-.46-.28Z" />
  </svg>
);

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
              href={WHATSAPP_BOOKING_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="home-cta inline-flex min-h-12 items-center justify-center gap-2.5 border border-[#087f3e] bg-[#087f3e] px-6 py-3.5 text-center text-xs font-black uppercase tracking-[0.14em] text-white shadow-[0_16px_34px_rgba(8,127,62,0.24)] transition-all duration-300 hover:-translate-y-0.5 hover:border-[#066c35] hover:bg-[#066c35] hover:shadow-[0_20px_42px_rgba(8,127,62,0.3)] md:min-h-14 md:px-8 md:py-4 md:tracking-[0.16em]"
            >
              <WhatsAppIcon />
              Reservar pelo WhatsApp
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
