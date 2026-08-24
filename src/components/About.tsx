import { ArrowRight, Award, CheckCircle, Clock, MapPin, Shield } from 'lucide-react';
import SectionHeading from './site-ui/SectionHeading';

const facts = [
  { value: '1996', label: 'início da operação' },
  { value: '1.110m', label: 'de pista homologada' },
  { value: '42', label: 'traçados mapeados' },
  { value: '50K+', label: 'corridas realizadas' },
];

const features = [
  {
    icon: Award,
    title: 'Pista profissional',
    text: 'Circuito técnico com áreas de escape gramadas, zebras e leitura clara para pilotos de níveis diferentes.',
  },
  {
    icon: Shield,
    title: 'Operação assistida',
    text: 'Indumentária inclusa, equipe de pista, fiscais e ambulatório com socorrista durante as baterias.',
  },
];

const hours = [
  ['Terça a sexta-feira', '16h às 22h', 'Primeira bateria: 17h00 | Última: 21h40'],
  ['Sábado', '08h às 19h', 'Primeira bateria: 09h15 | Última: 18h35'],
  ['Domingo', '08h às 19h', 'Primeira bateria: 09h15 | Última: 18h00'],
];

const About = () => {
  return (
    <section id="sobre" className="border-t border-white/10 bg-ink-950 py-16 md:py-24">
      <div className="container mx-auto px-4">
        <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[0.94fr_1.06fr] lg:items-start">
          <div>
            <SectionHeading eyebrow="Desde 1996 em Betim" title="Estrutura de corrida para lazer, treino e eventos." />
            <p className="mt-6 max-w-[68ch] text-base leading-8 text-white/75 md:text-lg">
              O Kartódromo Internacional de Betim reúne pista homologada, karts de locação, Super Kart,
              cronometragem eletrônica e atendimento para quem quer correr com segurança, seja em bateria aberta,
              campeonato ou grupo fechado.
            </p>

            <div className="mt-8 grid grid-cols-2 gap-px border border-white/10 bg-white/10 md:grid-cols-4">
              {facts.map((fact) => (
                <div key={fact.label} className="bg-ink-900 p-4">
                  <strong className="block font-display text-2xl italic leading-none text-primary-400">
                    {fact.value}
                  </strong>
                  <span className="mt-2 block font-race text-[11px] italic font-bold uppercase leading-snug tracking-[0.08em] text-white/60">
                    {fact.label}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-8 grid gap-5 sm:grid-cols-2">
              {features.map((feature) => {
                const Icon = feature.icon;

                return (
                  <div key={feature.title} className="flex gap-4">
                    <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center border border-primary-400/30 bg-white/5 text-primary-400">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <div>
                      <h3 className="font-race text-base italic font-bold text-white">{feature.title}</h3>
                      <p className="mt-2 text-sm leading-6 text-white/65">{feature.text}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            <a
              href="/historia"
              className="group mt-9 inline-flex items-center gap-2 font-race text-sm italic font-bold uppercase tracking-[0.12em] text-primary-400 transition-colors hover:text-primary-300"
            >
              Conheça nossa história
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
            </a>
          </div>

          <div className="space-y-5">
            <figure className="overflow-hidden border border-white/10 [clip-path:polygon(4%_0,100%_0,96%_100%,0_100%)]">
              <img
                src="/history/1.jpg"
                alt="Karts alinhados na pista do Kartódromo de Betim"
                className="aspect-[4/3] w-full object-cover brightness-[0.85] contrast-[1.1]"
                loading="lazy"
                decoding="async"
              />
            </figure>

            <div className="grid gap-5 border border-white/10 bg-ink-900 p-5 md:grid-cols-[0.92fr_1.08fr] md:p-6">
              <div className="space-y-3">
                <div className="flex h-11 w-11 items-center justify-center bg-primary-400 text-ink-950">
                  <Clock className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="font-display text-lg italic uppercase tracking-tight text-white">
                    Funcionamento
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-white/65">
                    Abertura para reservas, baterias mistas e grupos fechados conforme disponibilidade.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {hours.map(([day, time, note]) => (
                  <div key={day} className="border-b border-white/10 pb-3 last:border-b-0 last:pb-0">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-race text-sm italic font-bold text-white">{day}</span>
                      <span className="font-race text-sm italic font-bold text-primary-400">{time}</span>
                    </div>
                    <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-white/55">
                      <CheckCircle className="h-3.5 w-3.5 text-primary-400" aria-hidden="true" />
                      {note}
                    </p>
                  </div>
                ))}
                <div className="flex items-center gap-2 pt-1 font-race text-xs italic font-bold uppercase tracking-[0.08em] text-red-400">
                  <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                  Segunda-feira fechado para manutenção
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default About;
