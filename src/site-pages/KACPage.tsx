import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Award,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Download,
  Gauge,
  MapPin,
  Medal,
  MessageSquare,
  ShieldCheck,
  Timer,
  Trophy,
  Users,
} from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import AngledButton from '../components/site-ui/AngledButton';
import GlassPanel from '../components/site-ui/GlassPanel';

const anchorLinks = [
  { label: 'Inscrição', href: '#inscricao' },
  { label: 'Estrutura', href: '#estrutura' },
  { label: 'Calendário', href: '#calendario' },
  { label: 'Pontuação', href: '#pontuacao' },
  { label: 'Regulamento', href: '#regulamento' },
  { label: 'Premiação', href: '#premiacao' },
  { label: 'Punições', href: '#punicoes' },
  { label: 'Contato', href: '#contato-kac' },
];

const seasonSpecs = [
  ['Formato', 'Mensal'],
  ['Corridas', '7 no mês'],
  ['Ranking', '4 melhores'],
  ['Inscrição', 'R$ 50,00'],
  ['Corrida', 'R$ 145,00'],
  ['Peso mínimo', '90 kg'],
];

const calendarRows = [
  ['1', '04/07', 'Julho', '11:10', '12:10'],
  ['2', '05/07', 'Julho', '11:10', '12:10'],
  ['3', '12/07', 'Julho', '11:10', '12:10'],
  ['4', '18/07', 'Julho', '11:10', '12:10'],
  ['5', '19/07', 'Julho', '11:10', '12:10'],
  ['6', '25/07', 'Julho', '11:10', '12:10'],
  ['7', '26/07', 'Julho', '11:10', '12:10'],
];

const rules = [
  {
    icon: Users,
    title: 'Categoria única',
    text: 'O KAC Iniciantes é disputado em 1 categoria. Pilotos do Super Kart podem participar sem pontuar quando autorizados pela organização.',
  },
  {
    icon: ClipboardList,
    title: 'Classificação mensal',
    text: 'Até 7 corridas no mês, com as 4 melhores válidas para o ranking. As 3 piores são descartadas, incluindo faltas.',
  },
  {
    icon: Award,
    title: 'Traçados oficiais',
    text: 'Todas as corridas de julho seguem o calendário oficial divulgado pela organização.',
  },
  {
    icon: Gauge,
    title: 'Peso e lastro',
    text: 'Peso mínimo de 90 kg com equipamentos de segurança. Pilotos abaixo do peso utilizam lastro adicional no kart.',
  },
];

const tieBreakers = [
  'Maior número de vitórias (P1)',
  'Maior número de segundos lugares (P2)',
  'Maior número de terceiros lugares (P3)',
  'Maior número de quartos lugares (P4)',
  'Soma dos 5 melhores resultados',
];

const penalties = [
  {
    title: '1ª infração',
    label: 'Preta e branca',
    text: 'Perda de 10 pontos por atitude antidesportiva ou desrespeito.',
  },
  {
    title: '2ª infração',
    label: 'Bandeira preta',
    text: 'Desclassificação da prova, 0 ponto e corrida sem descarte.',
  },
  {
    title: '3ª infração',
    label: 'Reincidência',
    text: 'Exclusão do campeonato conforme decisão da direção de prova.',
  },
];

const whatsappUrl =
  'https://wa.me/5531998842898?text=Ol%C3%A1!%20Gostaria%20de%20me%20inscrever%20no%20KAC%20Iniciantes%202026%20do%20Kart%C3%B3dromo%20de%20Betim.';

const KACPage = () => {
  const [activeSection, setActiveSection] = useState('inscricao');

  useEffect(() => {
    const sectionNodes = anchorLinks
      .map((link) => document.querySelector<HTMLElement>(link.href))
      .filter(Boolean) as HTMLElement[];

    const updateProgress = () => {
      const anchorOffset = window.innerWidth < 768 ? 190 : 170;
      const current = [...sectionNodes]
        .reverse()
        .find((node) => node.offsetTop <= window.scrollY + anchorOffset);

      if (current?.id) {
        setActiveSection(current.id);
      }
    };

    updateProgress();
    window.addEventListener('scroll', updateProgress, { passive: true });

    return () => {
      window.removeEventListener('scroll', updateProgress);
    };
  }, []);

  return (
    <div className="min-h-screen bg-ink-950 text-white/80">
      <Header />

      <main>
        <section className="relative overflow-hidden border-b border-white/10 bg-ink-900">
          <div className="relative mx-auto grid min-h-[600px] max-w-7xl grid-cols-1 items-center gap-12 px-4 py-16 md:grid-cols-[1.02fr_0.98fr] md:px-8">
            <div className="max-w-3xl">
              <a href="/campeonatos" className="mb-8 inline-flex items-center gap-2 font-race text-xs italic font-bold uppercase tracking-[0.2em] text-white/55 hover:text-primary-400">
                <ArrowLeft className="h-4 w-4" />
                Campeonatos
              </a>

              <div className="mb-5 flex items-center gap-3 font-race text-xs italic font-bold uppercase tracking-[0.16em] text-primary-400">
                <span aria-hidden="true" className="h-px w-10 bg-primary-400" />
                Regulamento oficial 2026
              </div>

              <h1 className="max-w-2xl font-display text-6xl italic uppercase leading-[0.8] tracking-tight text-white md:text-8xl">
                KAC <span className="block text-primary-400">Iniciantes</span>
              </h1>
              <p className="mt-7 max-w-2xl text-base leading-8 text-white/70 md:text-lg">
                Campeonato mensal de kart light para pilotos iniciantes no Kartódromo Internacional de Betim. O formato valoriza constância, evolução e tomada de decisão em pista.
              </p>

              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <AngledButton href={whatsappUrl} external>
                  <MessageSquare className="h-4 w-4" />
                  Inscrever pelo WhatsApp
                </AngledButton>
                <AngledButton href="/regulamentos/kac-iniciantes-betim-2026.pdf" variant="outline" external>
                  <Download className="h-4 w-4" />
                  Baixar regulamento
                </AngledButton>
              </div>
            </div>

            <GlassPanel className="mx-auto w-full max-w-md p-6">
              <div className="mb-5 flex items-center justify-center">
                <img src="/championships/5.png" alt="Logo KAC Iniciantes" className="h-28 w-28 object-contain" />
              </div>
              <div className="divide-y divide-white/10">
                {seasonSpecs.map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between py-2.5 text-sm">
                    <span className="text-white/55">{label}</span>
                    <strong className="font-race italic text-white">{value}</strong>
                  </div>
                ))}
              </div>
            </GlassPanel>
          </div>
        </section>

        <nav aria-label="Seções do KAC Iniciantes" className="sticky top-[81px] z-30 border-y border-white/10 bg-ink-950/95 backdrop-blur-md">
          <div className="mx-auto flex max-w-7xl gap-2 overflow-x-auto px-4 py-3 md:px-8 [mask-image:linear-gradient(to_right,black_92%,transparent)] [-webkit-mask-image:linear-gradient(to_right,black_92%,transparent)] md:[mask-image:none] md:[-webkit-mask-image:none]">
            {anchorLinks.map((link) => {
              const id = link.href.slice(1);
              return (
                <a
                  key={link.href}
                  href={link.href}
                  aria-current={activeSection === id ? 'location' : undefined}
                  className={`whitespace-nowrap px-4 py-2 font-race text-xs italic font-bold uppercase tracking-wide transition-colors ${
                    activeSection === id ? 'bg-primary-400 text-ink-950' : 'text-white/55 hover:text-primary-400'
                  }`}
                >
                  {link.label}
                </a>
              );
            })}
          </div>
        </nav>

        <section id="inscricao" className="border-b border-white/10 bg-ink-900 py-14">
          <div className="mx-auto grid max-w-7xl grid-cols-1 gap-4 px-4 md:grid-cols-3 md:px-8">
            <InfoTile icon={ShieldCheck} title="Edição oficial" value="Temporada 2026" />
            <InfoTile icon={MapPin} title="Sede" value="Kartódromo Internacional de Betim" />
            <InfoTile icon={Gauge} title="Modalidade" value="Mensal para iniciantes" />
          </div>
        </section>

        <Section id="estrutura" number="01" title="Estrutura do campeonato">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_390px]">
            <div className="grid gap-4">
              {rules.map((rule) => (
                <RuleRow key={rule.title} {...rule} />
              ))}
            </div>
            <GlassPanel className="p-6">
              <p className="mb-4 font-race text-xs italic font-bold uppercase tracking-widest text-white/50">Valores oficiais</p>
              <PriceLine label="Inscrição" value="R$ 50,00" />
              <PriceLine label="Cada corrida" value="R$ 145,00" />
              <PriceLine label="Formato" value="7 corridas / 4 válidas" />
              <div className="mt-5">
                <AngledButton href={whatsappUrl} external className="w-full">
                  Reservar vaga
                </AngledButton>
              </div>
            </GlassPanel>
          </div>
        </Section>

        <Section id="calendario" number="02" title="Calendário oficial de provas">
          <div className="mb-8 flex items-center justify-between gap-4">
            <div>
              <p className="mb-2 font-race text-xs italic font-bold uppercase tracking-widest text-white/50">Horários do KAC Julho</p>
              <h3 className="font-race text-lg italic font-bold text-white">Confira os horários de chegada e corrida de cada etapa.</h3>
            </div>
            <CalendarDays className="h-12 w-12 flex-shrink-0 text-primary-400" />
          </div>

          <p className="mb-2 font-race text-[10px] italic font-bold uppercase tracking-wide text-white/40 sm:hidden">
            Arraste para o lado para ver todas as colunas →
          </p>
          <div className="overflow-x-auto border border-white/10 bg-ink-900 [mask-image:linear-gradient(to_right,black_94%,transparent)] [-webkit-mask-image:linear-gradient(to_right,black_94%,transparent)] sm:[mask-image:none] sm:[-webkit-mask-image:none]">
            <table className="w-full min-w-[720px] border-collapse text-left">
              <thead>
                <tr>
                  {['Corrida', 'Data', 'Mês', 'Horário de chegada', 'Horário da corrida'].map((head) => (
                    <th key={head} className="border-b border-white/10 bg-ink-950 px-5 py-4 font-race text-[11px] italic font-bold uppercase text-primary-400">
                      {head}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {calendarRows.map((row) => (
                  <tr key={row[0]}>
                    {row.map((cell, index) => (
                      <td key={`${row[0]}-${index}`} className="border-b border-white/10 px-5 py-4 text-white/75">
                        {index === 0 ? <span className="font-display text-2xl italic text-primary-400">{cell}</span> : cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section id="pontuacao" number="03" title="Sistema de pontuação">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            <FeatureCard icon={ClipboardList} title="Resultado individual" text="A pontuação respeita os resultados individuais de cada piloto." />
            <FeatureCard icon={Award} title="Queda por posição" text="A partir do 5º colocado, aplica-se -1 ponto por posição." />
            <FeatureCard icon={CheckCircle2} title="Regularidade" text="As 4 melhores contam e as 3 piores são descartadas." />
          </div>

          <div className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-[0.86fr_1.14fr]">
            <div className="grid grid-cols-2 gap-px border border-white/10 bg-white/10">
              <div className="bg-ink-900 p-6 text-center">
                <span className="block font-display text-4xl italic text-primary-400">4</span>
                <strong className="mt-2 block font-race text-xs italic font-bold uppercase text-white">melhores corridas contam</strong>
              </div>
              <div className="bg-ink-900 p-6 text-center">
                <span className="block font-display text-4xl italic text-primary-400">3</span>
                <strong className="mt-2 block font-race text-xs italic font-bold uppercase text-white">piores corridas descartadas</strong>
              </div>
            </div>
            <div>
              <p className="mb-4 font-race text-xs italic font-bold uppercase tracking-widest text-white/50">Critérios de desempate</p>
              <div className="space-y-2">
                {tieBreakers.map((item, index) => (
                  <div key={item} className="flex items-center gap-4 border border-white/10 bg-ink-900 px-4 py-3">
                    <span className="font-display text-lg italic text-primary-400">{index + 1}</span>
                    <p className="text-sm text-white/70">{item}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Section>

        <Section id="regulamento" number="04" title="Regulamento oficial">
          <div className="grid grid-cols-1 gap-9 lg:grid-cols-[0.82fr_1.18fr]">
            <div className="border border-white/10 bg-ink-900 p-3">
              <img src="/kac/regulamento-page-1.png" alt="Capa do regulamento KAC Iniciantes 2026" className="w-full" />
            </div>
            <div className="self-center">
              <p className="font-race text-xs italic font-bold uppercase tracking-widest text-white/50">Documento oficial da temporada</p>
              <h3 className="mt-3 font-display text-4xl italic uppercase leading-none text-white md:text-5xl">PDF oficial 2026 pronto para consulta</h3>
              <p className="mt-6 max-w-2xl text-base leading-8 text-white/70">
                O regulamento reúne estrutura, categoria, pontuação, desempate, premiação, calendário, punições, troca de kart, peso mínimo e disposições gerais.
              </p>
              <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {[
                  'Equipamentos de segurança obrigatórios',
                  'Calendário oficial mensal atualizado no site',
                  'Casos omissos avaliados pela direção',
                  'Aceite integral para participar',
                ].map((item) => (
                  <div key={item} className="border border-white/10 bg-ink-900 px-4 py-3 text-xs text-white/65">
                    {item}
                  </div>
                ))}
              </div>
              <div className="mt-8">
                <AngledButton href="/regulamentos/kac-iniciantes-betim-2026.pdf" external>
                  <Download className="h-4 w-4" />
                  Abrir PDF oficial
                </AngledButton>
              </div>
            </div>
          </div>
        </Section>

        <Section id="premiacao" number="05" title="Premiação">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            <FeatureCard icon={Trophy} title="Troféus" text="Do 1º ao 5º colocado recebem troféu ao final do campeonato." />
            <FeatureCard icon={Medal} title="Super Kart" text="O 1º colocado recebe a carteirinha de Super Kart." />
            <FeatureCard icon={Users} title="Final do ano" text="Torneio Campeão dos Campeões com churrasco, troféus e confraternização." />
          </div>
        </Section>

        <Section id="punicoes" number="06" title="Punições e troca de kart">
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            {penalties.map((penalty) => (
              <div key={penalty.title} className="relative overflow-hidden border border-white/10 bg-ink-900 p-6">
                <AlertTriangle className="h-8 w-8 text-primary-400" />
                <p className="mt-4 font-race text-xs italic font-bold uppercase text-white/50">{penalty.title}</p>
                <h3 className="mt-1 font-display text-2xl italic uppercase text-white">{penalty.label}</h3>
                <span className="mt-2 block text-sm text-white/65">{penalty.text}</span>
              </div>
            ))}
          </div>

          <div className="mt-8 flex items-start gap-5 border border-white/10 bg-ink-900 p-6">
            <Timer className="h-9 w-9 flex-shrink-0 text-primary-400" />
            <div>
              <h3 className="font-race text-base italic font-bold uppercase text-white">Troca de kart</h3>
              <p className="mt-2 text-sm leading-6 text-white/65">
                Nas 4 corridas válidas do mês, é permitida apenas 1 troca de kart por piloto. A solicitação só pode ser feita durante a tomada de tempo e o piloto larga da última posição.
              </p>
            </div>
          </div>
        </Section>

        <section id="contato-kac" className="border-t border-white/10 bg-ink-900 py-16 md:py-24">
          <div className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-4 md:grid-cols-[1fr_0.85fr] md:px-8">
            <div>
              <p className="mb-4 font-race text-xs italic font-bold uppercase tracking-widest text-primary-400">KAC Iniciantes Betim</p>
              <h2 className="font-display text-5xl italic uppercase leading-[0.85] text-white md:text-7xl">Pronto para entrar no grid?</h2>
              <p className="mt-6 max-w-2xl text-base leading-8 text-white/70">
                Fale com a equipe do Kartódromo de Betim para confirmar disponibilidade, tirar dúvidas sobre regulamento, pesos, lastro e garantir sua vaga.
              </p>
            </div>
            <GlassPanel className="p-6">
              <div className="space-y-2 text-sm text-white/70">
                <p>Email: contato@kartodromodebetim.com.br</p>
                <p>Telefone: (31) 3511-2373</p>
                <p>WhatsApp: (31) 99884-2898</p>
                <p>Av. Adutora Várzea das Flores, 477 - Itacolomi, Betim - MG</p>
              </div>
              <div className="mt-6">
                <AngledButton href={whatsappUrl} external className="w-full">
                  <MessageSquare className="h-4 w-4" />
                  Chamar no WhatsApp
                </AngledButton>
              </div>
            </GlassPanel>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

interface IconProps {
  className?: string;
}

interface SectionProps {
  id: string;
  number: string;
  title: string;
  children: React.ReactNode;
}

const Section = ({ id, number, title, children }: SectionProps) => (
  <section id={id} className="border-t border-white/10 bg-ink-950 py-16 md:py-24">
    <div className="mx-auto max-w-7xl px-4 md:px-8">
      <div className="mb-10 flex items-baseline gap-5">
        <span className="font-display text-4xl italic text-primary-400">{number}</span>
        <h2 className="font-display text-3xl italic uppercase leading-none tracking-tight text-white md:text-5xl">{title}</h2>
      </div>
      {children}
    </div>
  </section>
);

interface InfoTileProps {
  icon: React.ComponentType<IconProps>;
  title: string;
  value: string;
}

const InfoTile = ({ icon: Icon, title, value }: InfoTileProps) => (
  <div className="flex items-center gap-4 border border-white/10 bg-ink-950 p-5">
    <Icon className="h-8 w-8 flex-shrink-0 text-primary-400" />
    <div>
      <p className="text-xs text-white/50">{title}</p>
      <strong className="font-race italic text-white">{value}</strong>
    </div>
  </div>
);

interface RuleRowProps {
  icon: React.ComponentType<IconProps>;
  title: string;
  text: string;
}

const RuleRow = ({ icon: Icon, title, text }: RuleRowProps) => (
  <div className="group flex items-start gap-5 border border-white/10 bg-ink-900 p-6">
    <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center border border-primary-400/30 bg-white/5 text-primary-400">
      <Icon className="h-7 w-7" />
    </div>
    <div className="flex-1">
      <h3 className="font-race text-base italic font-bold uppercase text-white">{title}</h3>
      <p className="mt-1 text-sm leading-6 text-white/65">{text}</p>
    </div>
    <ChevronRight className="h-5 w-5 flex-shrink-0 text-white/30 transition-transform group-hover:translate-x-1" />
  </div>
);

interface PriceLineProps {
  label: string;
  value: string;
}

const PriceLine = ({ label, value }: PriceLineProps) => (
  <div className="flex items-center justify-between border-b border-white/10 py-3 last:border-b-0">
    <span className="text-sm text-white/60">{label}</span>
    <strong className="font-display text-xl italic text-primary-400">{value}</strong>
  </div>
);

interface FeatureCardProps {
  icon: React.ComponentType<IconProps>;
  title: string;
  text: string;
}

const FeatureCard = ({ icon: Icon, title, text }: FeatureCardProps) => (
  <div className="border border-white/10 bg-ink-900 p-6">
    <Icon className="h-9 w-9 text-primary-400" />
    <h3 className="mt-4 font-race text-base italic font-bold uppercase text-white">{title}</h3>
    <p className="mt-2 text-sm leading-6 text-white/65">{text}</p>
  </div>
);

export default KACPage;
