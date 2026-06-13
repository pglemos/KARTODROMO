import { ArrowRight, Award, CheckCircle, Clock, MapPin, Shield } from 'lucide-react';

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
    <section id="sobre" className="border-t border-zinc-200/70 bg-[#fbfcf8] pb-16 pt-8 md:pb-24 md:pt-20">
      <div className="container mx-auto px-4">
        <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[0.94fr_1.06fr] lg:items-start">
          <div>
            <p className="mb-4 text-xs font-black uppercase tracking-[0.18em] text-primary-700">
              Desde 1996 em Betim
            </p>
            <h2 className="max-w-2xl text-3xl font-black uppercase leading-none tracking-tight text-zinc-950 md:text-5xl">
              Estrutura de corrida para lazer, treino e eventos.
            </h2>
            <p className="mt-6 max-w-[68ch] text-base leading-8 text-zinc-700 md:text-lg">
              O Kartódromo Internacional de Betim reúne pista homologada, karts de locação, Super Kart,
              cronometragem eletrônica e atendimento para quem quer correr com segurança, seja em bateria aberta,
              campeonato ou grupo fechado.
            </p>

            <div className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-zinc-200 bg-zinc-200 md:grid-cols-4">
              {facts.map((fact) => (
                <div key={fact.label} className="bg-[#f7faf4] p-4">
                  <strong className="block text-2xl font-black leading-none text-zinc-950">
                    {fact.value}
                  </strong>
                  <span className="mt-2 block text-[11px] font-bold uppercase leading-snug tracking-[0.08em] text-zinc-500">
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
                    <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-md border border-primary-500/20 bg-primary-50 text-primary-700">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <div>
                      <h3 className="text-base font-black text-zinc-950">{feature.title}</h3>
                      <p className="mt-2 text-sm leading-6 text-zinc-600">{feature.text}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            <a
              href="/historia"
              className="group mt-9 inline-flex items-center gap-2 text-sm font-black uppercase tracking-[0.12em] text-primary-700 transition-colors hover:text-primary-800"
            >
              Conheça nossa história
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
            </a>
          </div>

          <div className="space-y-5">
            <figure className="overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100 shadow-[0_24px_70px_rgba(17,20,18,0.10)]">
              <img
                src="/history/1.jpg"
                alt="Karts alinhados na pista do Kartódromo de Betim"
                className="aspect-[4/3] w-full object-cover"
                loading="lazy"
              />
            </figure>

            <div className="grid gap-5 rounded-lg border border-zinc-200 bg-[#f7faf4] p-5 md:grid-cols-[0.92fr_1.08fr] md:p-6">
              <div className="space-y-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-md bg-zinc-950 text-[#fbfcf8]">
                  <Clock className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="text-lg font-black uppercase tracking-tight text-zinc-950">
                    Funcionamento
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-zinc-600">
                    Abertura para reservas, baterias mistas e grupos fechados conforme disponibilidade.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {hours.map(([day, time, note]) => (
                  <div key={day} className="border-b border-zinc-200 pb-3 last:border-b-0 last:pb-0">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-sm font-black text-zinc-900">{day}</span>
                      <span className="text-sm font-black text-primary-700">{time}</span>
                    </div>
                    <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-zinc-500">
                      <CheckCircle className="h-3.5 w-3.5 text-primary-700" aria-hidden="true" />
                      {note}
                    </p>
                  </div>
                ))}
                <div className="flex items-center gap-2 pt-1 text-xs font-black uppercase tracking-[0.08em] text-red-700">
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
