import { Calendar, Flag, Trophy, Users } from 'lucide-react';
import SectionHeading from './site-ui/SectionHeading';

const stats = [
  { value: '4', label: 'Etapas claras' },
  { value: '30min', label: 'de bateria' },
  { value: '1º', label: 'pódio da turma' },
  { value: '100%', label: 'memória' },
];

const steps = [
  { icon: Calendar, title: 'Escolha a data', text: 'Consulte a agenda e escolha o melhor horário para o grupo.' },
  { icon: Users, title: 'Reúna a turma', text: 'Convide amigos, familiares ou colegas para formar o grid.' },
  { icon: Flag, title: 'Corra e compita', text: 'Briefing, equipamento, tomada de tempo e corrida com segurança.' },
  { icon: Trophy, title: 'Celebre a vitória', text: 'Pódio, fotos e histórias para lembrar muito depois da bandeirada.' },
];

const HowItWorks = () => {
  return (
    <section className="border-t border-white/10 bg-ink-900 py-16 md:py-24">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <SectionHeading
              eyebrow="Como funciona"
              title={
                <>
                  Simples, rápido
                  <br />
                  <span className="text-primary-400">e cheio de adrenalina</span>
                </>
              }
            />
            <p className="mt-6 max-w-xl text-sm leading-7 text-white/65">
              Do primeiro contato ao pódio, a equipe organiza cada etapa para seu grupo aproveitar o que importa: a corrida e a comemoração.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-px border border-white/10 bg-white/10 md:grid-cols-4">
            {stats.map((stat) => (
              <div key={stat.label} className="bg-ink-950 p-6 text-center">
                <strong className="block font-display text-4xl italic text-primary-400">{stat.value}</strong>
                <span className="mt-1 block text-xs text-white/55">{stat.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-px border border-white/10 bg-white/10 md:grid-cols-4">
          {steps.map((step) => (
            <div key={step.title} className="bg-ink-950 p-7">
              <div className="flex h-11 w-11 items-center justify-center border border-primary-400/30 bg-white/5 text-primary-400">
                <step.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-6 font-race text-base italic font-bold uppercase text-white">{step.title}</h3>
              <p className="mt-2 text-sm leading-6 text-white/65">{step.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
