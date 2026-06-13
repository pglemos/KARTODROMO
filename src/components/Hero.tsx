import { Calendar, Compass, MapPin, Trophy, Zap } from 'lucide-react';
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
    <section id="home" className="home-hero relative flex min-h-[70svh] items-center overflow-hidden bg-[#fbfcf8] py-4 md:min-h-[78vh] md:py-12">
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
        <div className="max-w-6xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary-500/30 bg-[#fbfcf8]/92 px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-primary-800 shadow-sm md:mb-6">
            <Zap className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Pista padrão internacional</span>
          </div>

          <h1 className="home-title mb-4 max-w-[11ch] text-[2.55rem] font-black uppercase leading-[0.86] tracking-tight text-zinc-950 sm:text-6xl md:mb-6 md:text-7xl lg:text-8xl">
            Kartódromo Internacional de Betim
          </h1>

          <p className="mb-5 max-w-2xl text-base leading-7 text-zinc-700 md:mb-9 md:text-lg md:leading-8">
            Pista homologada de <strong className="font-black text-zinc-950">1.110 metros</strong>, cronometragem eletrônica,
            equipe de pista e estrutura para pilotos, famílias e grupos.
          </p>

          <div className="mb-4 flex flex-col gap-3 sm:flex-row md:gap-4">
            <a
              href={MYLAPTIME_BOOKING_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="home-cta inline-flex min-h-12 items-center justify-center bg-primary-500 px-6 py-3.5 text-center text-xs font-black uppercase tracking-[0.14em] text-zinc-950 shadow-[0_18px_38px_rgba(0,200,83,0.22)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-primary-400 hover:shadow-[0_22px_46px_rgba(0,200,83,0.26)] md:min-h-14 md:px-8 md:py-4 md:tracking-[0.16em]"
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

          <div className="mb-6 flex items-center gap-2 text-sm font-semibold text-zinc-700 md:mb-12">
            <MapPin className="h-4 w-4 text-primary-700" aria-hidden="true" />
            <span>Betim, MG, a poucos minutos da região metropolitana de Belo Horizonte</span>
          </div>

          <div className="home-stat-grid grid max-w-5xl grid-cols-2 gap-px overflow-hidden rounded-lg border border-zinc-200/80 bg-zinc-200/80 shadow-sm md:grid-cols-4">
            <div className="home-stat flex items-center gap-3 bg-[#fbfcf8]/92 p-2.5 md:p-3.5">
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md border border-primary-500/20 bg-primary-50 text-primary-700 md:h-10 md:w-10">
                <Compass className="h-5 w-5" />
              </div>
              <div>
                <div className="text-lg font-black leading-tight text-zinc-950 md:text-xl">1.110m</div>
                <div className="text-[9px] font-bold uppercase tracking-wider text-zinc-500 md:text-[10px]">Extensão da pista</div>
              </div>
            </div>

            <div className="home-stat flex items-center gap-3 bg-[#fbfcf8]/92 p-2.5 md:p-3.5">
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md border border-primary-500/20 bg-primary-50 text-primary-700 md:h-10 md:w-10">
                <Trophy className="h-5 w-5" />
              </div>
              <div>
                <div className="text-lg font-black leading-tight text-zinc-950 md:text-xl">42</div>
                <div className="text-[9px] font-bold uppercase tracking-wider text-zinc-500 md:text-[10px]">Configurações mapeadas</div>
              </div>
            </div>

            <div className="home-stat flex items-center gap-3 bg-[#fbfcf8]/92 p-2.5 md:p-3.5">
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md border border-primary-500/20 bg-primary-50 text-primary-700 md:h-10 md:w-10">
                <Zap className="h-5 w-5" />
              </div>
              <div>
                <div className="text-lg font-black leading-tight text-zinc-950 md:text-xl">400cc</div>
                <div className="text-[9px] font-bold uppercase tracking-wider text-zinc-500 md:text-[10px]">Motores Super Kart</div>
              </div>
            </div>

            <div className="home-stat flex items-center gap-3 bg-[#fbfcf8]/92 p-2.5 md:p-3.5">
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md border border-primary-500/20 bg-primary-50 text-primary-700 md:h-10 md:w-10">
                <Calendar className="h-5 w-5" />
              </div>
              <div>
                <div className="text-lg font-black leading-tight text-zinc-950 md:text-xl">25+ anos</div>
                <div className="text-[9px] font-bold uppercase tracking-wider text-zinc-500 md:text-[10px]">Em operação desde 1996</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
