import { Check } from 'lucide-react';
import SectionHeading from './site-ui/SectionHeading';

const features = [
  { title: 'Maior kartódromo da região', text: 'Pista com 1.110m e estrutura consolidada.' },
  { title: 'Fácil acesso e estacionamento', text: 'Localização estratégica em Betim.' },
  { title: 'Karts potentes e seguros', text: 'Manutenção e equipe de alto padrão.' },
  { title: 'Atendimento especializado', text: 'Organização do evento do início ao fim.' },
  { title: 'Cronometragem individual', text: 'Resultado de cada piloto em tempo real.' },
  { title: 'Experiência para todos', text: 'Diversão para diferentes perfis e idades.' },
];

const WhyBetim = () => {
  return (
    <section className="border-t border-white/10 bg-ink-950 py-16 md:py-24">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <SectionHeading
              eyebrow="Por que Betim"
              title={
                <>
                  Seu evento sai
                  <br />
                  <span className="text-primary-400">do comum</span>
                </>
              }
            />
            <p className="mt-6 max-w-xl text-sm leading-7 text-white/65">
              Velocidade, disputa e comemoração em um dos espaços mais marcantes da região.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-2">
            {features.map((feature) => (
              <div key={feature.title} className="flex gap-3">
                <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border border-primary-400 text-primary-400">
                  <Check className="h-3 w-3" />
                </span>
                <div>
                  <strong className="font-race text-sm italic font-bold uppercase text-white">{feature.title}</strong>
                  <p className="mt-1 text-sm text-white/60">{feature.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default WhyBetim;
