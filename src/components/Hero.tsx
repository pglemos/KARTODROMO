import { Calendar, Compass, MapPin, Trophy, Zap } from 'lucide-react';
import { SITE_BOOKING_ANCHOR, WHATSAPP_BOOKING_URL } from '../config/booking';
import AngledButton from './site-ui/AngledButton';
import StatCounter from './site-ui/StatCounter';

const WhatsAppIcon = () => (
  <svg
    aria-hidden="true"
    className="h-5 w-5 flex-shrink-0 fill-current"
    viewBox="0 0 24 24"
  >
    <path d="M12.04 2a9.84 9.84 0 0 0-8.42 14.93L2 22l5.23-1.58A9.95 9.95 0 1 0 12.04 2Zm0 17.92a8.08 8.08 0 0 1-4.12-1.13l-.3-.18-3.1.94.96-3.02-.2-.31a8.02 8.02 0 1 1 6.76 3.7Zm4.42-6.04c-.24-.12-1.43-.7-1.65-.78-.22-.08-.38-.12-.54.12-.16.24-.62.78-.76.94-.14.16-.28.18-.52.06-.24-.12-1.02-.38-1.94-1.2a7.27 7.27 0 0 1-1.34-1.67c-.14-.24-.02-.37.1-.49.11-.11.24-.28.36-.42.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.54-1.3-.74-1.78-.2-.47-.4-.4-.54-.41h-.46c-.16 0-.42.06-.64.3-.22.24-.84.82-.84 2s.86 2.32.98 2.48c.12.16 1.7 2.6 4.12 3.64.58.25 1.03.4 1.38.51.58.18 1.1.16 1.52.1.46-.07 1.43-.59 1.63-1.15.2-.56.2-1.04.14-1.14-.06-.1-.22-.16-.46-.28Z" />
  </svg>
);

const stats = [
  { icon: Compass, target: 1110, suffix: 'm', label: 'Extensão da pista' },
  { icon: Trophy, target: 42, suffix: '', label: 'Configurações mapeadas' },
  { icon: Zap, target: 400, suffix: 'cc', label: 'Motores Super Kart' },
  { icon: Calendar, target: 25, suffix: '+ anos', label: 'Em operação desde 1996' },
];

const Hero = () => {
  return (
    <section id="home" className="relative flex min-h-[92svh] items-center overflow-hidden bg-ink-950 pt-24">
      <video
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        poster="/posters/home-karting.jpg"
        className="absolute inset-0 z-0 h-full w-full object-cover brightness-[0.45] contrast-[1.15] grayscale-[0.15]"
      >
        <source src="/videos/home-karting.mp4" type="video/mp4" />
      </video>

      <div aria-hidden="true" className="absolute inset-0 z-10 bg-gradient-to-t from-ink-950 via-ink-950/60 to-ink-950/20" />

      <div className="container relative z-20 mx-auto w-full px-4 py-10">
        <div className="max-w-6xl">
          <div className="mb-6 inline-flex items-center gap-2 border border-primary-400/30 bg-white/5 px-4 py-2 font-race text-[11px] italic font-bold uppercase tracking-[0.18em] text-primary-400 backdrop-blur-md">
            <Zap className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Pista padrão internacional</span>
          </div>

          <h1 className="mb-6 max-w-[13ch] font-display text-[2.7rem] italic uppercase leading-[0.82] tracking-tight text-white sm:text-6xl md:text-7xl lg:text-8xl">
            Kartódromo Internacional de Betim
          </h1>

          <p className="mb-9 max-w-2xl text-base leading-7 text-white/75 md:text-lg md:leading-8">
            Pista homologada de <strong className="font-black text-white">1.110 metros</strong>, cronometragem eletrônica,
            equipe de pista e estrutura para pilotos, famílias e grupos.
          </p>

          <div className="mb-6 flex flex-col gap-3 sm:flex-row md:gap-4">
            <AngledButton href={SITE_BOOKING_ANCHOR}>Reservar corrida online</AngledButton>
            <AngledButton href={WHATSAPP_BOOKING_URL} variant="outline" external>
              <WhatsAppIcon />
              Reservar pelo WhatsApp
            </AngledButton>
          </div>

          <div className="mb-10 flex items-center gap-2 text-sm font-semibold text-white/70">
            <MapPin className="h-4 w-4 text-primary-400" aria-hidden="true" />
            <span>Betim, MG, a poucos minutos da região metropolitana de Belo Horizonte</span>
          </div>

          <div className="grid max-w-5xl grid-cols-2 border border-white/10 bg-ink-900/80 backdrop-blur-md md:grid-cols-4">
            {stats.map((stat) => (
              <StatCounter key={stat.label} target={stat.target} suffix={stat.suffix} label={stat.label} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
