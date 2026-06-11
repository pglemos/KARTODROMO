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
  Flag,
  Gauge,
  MapPin,
  Medal,
  MessageSquare,
  ShieldCheck,
  Sparkles,
  Timer,
  Trophy,
  Users,
  Weight,
} from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';

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
  ['Corridas', '8 no mês'],
  ['Ranking', '4 melhores'],
  ['Inscrição', 'R$ 50,00'],
  ['Corrida', 'R$ 145,00'],
  ['Peso mínimo', '90 kg'],
];

const calendarRows = [
  ['1', '06/06', 'Sábado', '11:10', '12:10', '1 Invertido'],
  ['2', '07/06', 'Domingo', '11:10', '12:10', '1 Invertido'],
  ['3', '13/06', 'Sábado', '11:10', '12:10', '1 Normal'],
  ['4', '14/06', 'Domingo', '11:10', '12:10', '1 Normal'],
  ['5', '20/06', 'Sábado', '11:10', '12:10', '1 Invertido'],
  ['6', '21/06', 'Domingo', '11:10', '12:10', '1 Invertido'],
  ['7', '27/06', 'Sábado', '11:10', '12:10', '11 Normal'],
  ['8', '28/06', 'Domingo', '11:10', '12:10', '11 Normal'],
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
    text: 'Até 8 corridas no mês, com as 4 melhores válidas para o ranking. As 4 piores são descartadas, incluindo faltas.',
  },
  {
    icon: Flag,
    title: 'Traçados oficiais',
    text: 'A bateria mensal utiliza os traçados 1 Normal, 1 Invertido e 11 Normal, publicados no calendário oficial da etapa.',
  },
  {
    icon: Weight,
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
  'Match race com 1 volta em 2 karts diferentes',
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
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    const revealNodes = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'));

    if (!('IntersectionObserver' in window)) {
      revealNodes.forEach((node) => node.classList.add('is-visible'));
      return undefined;
    }

    document.documentElement.classList.add('kac-reveal-ready');

    const revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            revealObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.16, rootMargin: '0px 0px -8% 0px' },
    );

    revealNodes.forEach((node) => revealObserver.observe(node));

    const sectionNodes = anchorLinks
      .map((link) => document.querySelector<HTMLElement>(link.href))
      .filter(Boolean) as HTMLElement[];
    const updateProgress = () => {
      const documentHeight = document.documentElement.scrollHeight - window.innerHeight;
      setScrollProgress(documentHeight > 0 ? window.scrollY / documentHeight : 0);

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
      revealObserver.disconnect();
      window.removeEventListener('scroll', updateProgress);
      document.documentElement.classList.remove('kac-reveal-ready');
    };
  }, []);

  return (
    <div className="kac-page min-h-screen bg-[#fbfcfa] text-zinc-900">
      <Header />

      <a href="#kac-main" className="kac-skip-link">
        Pular para o conteúdo
      </a>

      <div aria-hidden="true" className="kac-progress" style={{ transform: `scaleX(${scrollProgress})` }} />

      <main id="kac-main">
        <section className="kac-hero relative overflow-hidden">
          <div aria-hidden="true" className="kac-hero-grid" />
          <div aria-hidden="true" className="kac-speedline kac-speedline-a" />
          <div aria-hidden="true" className="kac-speedline kac-speedline-b" />

          <div className="relative mx-auto grid min-h-[760px] max-w-7xl grid-cols-1 items-center gap-14 px-4 py-20 md:grid-cols-[1.02fr_0.98fr] md:px-8">
            <div className="max-w-3xl" data-reveal>
              <a
                href="/campeonatos"
                className="kac-back-link mb-10 inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.22em] text-zinc-500"
              >
                <ArrowLeft className="h-4 w-4" />
                Campeonatos
              </a>

              <div className="kac-hero-mark mb-5 inline-flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                Regulamento oficial 2026
              </div>

              <h1 aria-label="KAC Iniciantes" className="kac-title max-w-4xl text-6xl font-black uppercase leading-[0.82] tracking-tight text-zinc-950 md:text-8xl lg:text-9xl">
                KAC{' '}
                <span className="block text-primary-500">Iniciantes</span>
              </h1>
              <p className="mt-8 max-w-2xl text-base leading-8 text-zinc-700 md:text-lg">
                Campeonato mensal de kart light para pilotos iniciantes no Kartódromo Internacional de Betim. O formato valoriza constância, evolução e tomada de decisão em pista.
              </p>

              <div className="mt-10 flex flex-col gap-3 sm:flex-row">
                <ActionLink href={whatsappUrl} external icon={MessageSquare}>
                  Inscrever pelo WhatsApp
                </ActionLink>
                <ActionLink href="/regulamentos/kac-iniciantes-betim-2026.pdf" external icon={Download} variant="secondary">
                  Baixar regulamento
                </ActionLink>
              </div>
            </div>

            <div className="relative" data-reveal style={{ transitionDelay: '140ms' }}>
              <div className="kac-orbit-card">
                <svg aria-hidden="true" focusable="false" className="kac-track-svg" viewBox="0 0 420 420">
                  <path
                    className="kac-track-path"
                    d="M92 247c-51-42-36-126 27-151 48-19 99 2 123 40 14 23 47 30 72 17 39-20 77 10 79 50 2 44-35 75-78 68-35-6-57 9-76 36-29 41-102 35-147-60Z"
                    fill="none"
                  />
                </svg>
                <div className="kac-logo-stage">
                  <img
                    src="/championships/5.png"
                    alt="Logo KAC Iniciantes"
                    className="kac-logo-img"
                  />
                </div>
                <div className="kac-spec-panel">
                  {seasonSpecs.map(([label, value], index) => (
                    <div key={label} className="kac-spec-row" style={{ transitionDelay: `${220 + index * 45}ms` }}>
                      <span>{label}</span>
                      <strong>{value}</strong>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <nav aria-label="Seções do KAC Iniciantes" className="kac-section-nav sticky top-[81px] z-30 border-y border-zinc-200 bg-[#fbfcfa]/92 backdrop-blur-md">
          <div className="mx-auto flex max-w-7xl gap-2 overflow-x-auto px-4 py-3 md:px-8">
            {anchorLinks.map((link) => {
              const id = link.href.slice(1);
              return (
                <a
                  key={link.href}
                  href={link.href}
                  aria-current={activeSection === id ? 'location' : undefined}
                  className={`kac-nav-pill ${activeSection === id ? 'is-active' : ''}`}
                >
                  {link.label}
                </a>
              );
            })}
          </div>
        </nav>

        <section id="inscricao" className="bg-[#f4f8f3] py-14">
          <div className="mx-auto grid max-w-7xl grid-cols-1 gap-4 px-4 md:grid-cols-3 md:px-8">
            <InfoTile icon={ShieldCheck} title="Edição oficial" value="Temporada 2026" />
            <InfoTile icon={MapPin} title="Sede" value="Kartódromo Internacional de Betim" />
            <InfoTile icon={Gauge} title="Modalidade" value="Mensal para iniciantes" />
          </div>
        </section>

        <Section id="estrutura" number="01" title="Estrutura do campeonato">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_390px]">
            <div className="grid gap-4">
              {rules.map((rule, index) => (
                <RuleRow key={rule.title} {...rule} delay={index * 70} />
              ))}
            </div>
            <div className="kac-price-board" data-reveal>
              <p className="kac-label">Valores oficiais</p>
              <PriceLine label="Inscrição" value="R$ 50,00" />
              <PriceLine label="Cada corrida" value="R$ 145,00" />
              <PriceLine label="Formato" value="8 corridas / 4 válidas" />
              <ActionLink href={whatsappUrl} external icon={MessageSquare} full>
                Reservar vaga
              </ActionLink>
            </div>
          </div>
        </Section>

        <Section id="calendario" number="02" title="Calendário oficial de provas">
          <div className="kac-calendar-heading" data-reveal>
            <div>
              <p className="kac-label">Horários do KAC Junho</p>
              <h3>Chegada às 11:10. Corrida às 12:10.</h3>
            </div>
            <CalendarDays className="h-12 w-12 text-primary-600" />
          </div>

          <div className="kac-table-wrap" data-reveal>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse text-left">
                <thead>
                  <tr>
                    {['Corrida', 'Data', 'Dia', 'Chegada', 'Largada', 'Traçado'].map((head) => (
                      <th key={head} scope="col">
                        {head}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {calendarRows.map((row) => (
                    <tr key={row[0]}>
                      {row.map((cell, index) => (
                        <td key={`${row[0]}-${index}`}>
                          {index === 0 ? <span className="kac-race-number">{cell}</span> : cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Section>

        <Section id="pontuacao" number="03" title="Sistema de pontuação">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            <FeatureCard icon={ClipboardList} title="Resultado individual" text="A pontuação respeita os resultados individuais de cada piloto." />
            <FeatureCard icon={Award} title="Queda por posição" text="A partir do 5º colocado, aplica-se -1 ponto por posição." />
            <FeatureCard icon={CheckCircle2} title="Regularidade" text="As 4 melhores contam e as 4 piores são descartadas." />
          </div>

          <div className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-[0.86fr_1.14fr]">
            <div className="kac-score-card" data-reveal>
              <div>
                <span>4</span>
                <strong>melhores corridas contam</strong>
              </div>
              <div>
                <span>4</span>
                <strong>piores corridas descartadas</strong>
              </div>
            </div>
            <div data-reveal>
              <p className="kac-label mb-4">Critérios de desempate</p>
              <div className="space-y-3">
                {tieBreakers.map((item, index) => (
                  <div key={item} className="kac-ranking-row">
                    <span>{index + 1}</span>
                    <p>{item}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Section>

        <Section id="regulamento" number="04" title="Regulamento oficial">
          <div className="grid grid-cols-1 gap-9 lg:grid-cols-[0.82fr_1.18fr]">
            <div className="kac-pdf-frame" data-reveal>
              <img src="/kac/regulamento-page-1.png" alt="Capa do regulamento KAC Iniciantes 2026" />
            </div>
            <div className="self-center" data-reveal style={{ transitionDelay: '120ms' }}>
              <p className="kac-label">Documento premium da temporada</p>
              <h3 className="mt-3 text-4xl font-black uppercase leading-none text-zinc-950 md:text-5xl">PDF oficial 2026 pronto para consulta</h3>
              <p className="mt-6 max-w-2xl text-base leading-8 text-zinc-700">
                O regulamento reúne estrutura, categoria, pontuação, desempate, premiação, calendário, punições, troca de kart, peso mínimo e disposições gerais.
              </p>
              <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {[
                  'Equipamentos de segurança obrigatórios',
                  'Datas sujeitas a aviso prévio',
                  'Casos omissos avaliados pela direção',
                  'Aceite integral para participar',
                ].map((item) => (
                  <div key={item} className="kac-note">
                    {item}
                  </div>
                ))}
              </div>
              <div className="mt-8">
                <ActionLink href="/regulamentos/kac-iniciantes-betim-2026.pdf" external icon={Download}>
                  Abrir PDF oficial
                </ActionLink>
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
            {penalties.map((penalty, index) => (
              <div key={penalty.title} className="kac-penalty" data-reveal style={{ transitionDelay: `${index * 80}ms` }}>
                <AlertTriangle className="h-8 w-8 text-primary-600" />
                <p>{penalty.title}</p>
                <h3>{penalty.label}</h3>
                <span>{penalty.text}</span>
              </div>
            ))}
          </div>

          <div className="kac-kart-swap" data-reveal>
            <Timer className="h-9 w-9 text-primary-600" />
            <div>
              <h3>Troca de kart</h3>
              <p>
                Nas 4 corridas válidas do mês, é permitida apenas 1 troca de kart por piloto. A solicitação só pode ser feita durante a tomada de tempo e o piloto larga da última posição.
              </p>
            </div>
          </div>
        </Section>

        <section id="contato-kac" className="kac-final-cta">
          <div className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-4 md:grid-cols-[1fr_0.85fr] md:px-8">
            <div data-reveal>
              <p className="kac-label">KAC Iniciantes Betim</p>
              <h2 className="mt-4 text-5xl font-black uppercase leading-[0.9] text-zinc-950 md:text-7xl">Pronto para entrar no grid?</h2>
              <p className="mt-6 max-w-2xl text-base leading-8 text-zinc-700">
                Fale com a equipe do Kartódromo de Betim para confirmar disponibilidade, tirar dúvidas sobre regulamento, pesos, lastro e garantir sua vaga.
              </p>
            </div>
            <div className="kac-contact-card" data-reveal style={{ transitionDelay: '120ms' }}>
              <p>Email: contato@kartodromodebetim.com.br</p>
              <p>Telefone: (31) 3511-2373</p>
              <p>WhatsApp: (31) 99884-2898</p>
              <p>Av. Adutora Várzea das Flores, 477 - Itacolomi, Betim - MG</p>
              <ActionLink href={whatsappUrl} external icon={MessageSquare} full>
                Chamar no WhatsApp
              </ActionLink>
            </div>
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

interface ActionLinkProps {
  href: string;
  children: React.ReactNode;
  icon: React.ComponentType<IconProps>;
  external?: boolean;
  full?: boolean;
  variant?: 'primary' | 'secondary';
}

const ActionLink = ({ href, children, icon: Icon, external, full, variant = 'primary' }: ActionLinkProps) => (
  <a
    href={href}
    target={external ? '_blank' : undefined}
    rel={external ? 'noopener noreferrer' : undefined}
    className={`kac-action ${variant === 'secondary' ? 'kac-action-secondary' : ''} ${full ? 'w-full' : ''}`}
  >
    <span>{children}</span>
    <Icon className="h-4 w-4" />
  </a>
);

interface SectionProps {
  id: string;
  number: string;
  title: string;
  children: React.ReactNode;
}

const Section = ({ id, number, title, children }: SectionProps) => (
  <section id={id} className="kac-section">
    <div className="mx-auto max-w-7xl px-4 md:px-8">
      <div className="kac-section-heading" data-reveal>
        <span>{number}</span>
        <h2>{title}</h2>
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
  <div className="kac-info-tile" data-reveal>
    <Icon className="h-8 w-8 text-primary-600" />
    <div>
      <p>{title}</p>
      <strong>{value}</strong>
    </div>
  </div>
);

interface RuleRowProps {
  icon: React.ComponentType<IconProps>;
  title: string;
  text: string;
  delay?: number;
}

const RuleRow = ({ icon: Icon, title, text, delay = 0 }: RuleRowProps) => (
  <div className="kac-rule-row" data-reveal style={{ transitionDelay: `${delay}ms` }}>
    <div className="kac-icon-box">
      <Icon className="h-7 w-7" />
    </div>
    <div>
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
    <ChevronRight className="kac-row-arrow h-5 w-5" />
  </div>
);

interface PriceLineProps {
  label: string;
  value: string;
}

const PriceLine = ({ label, value }: PriceLineProps) => (
  <div className="kac-price-line">
    <span>{label}</span>
    <strong>{value}</strong>
  </div>
);

interface FeatureCardProps {
  icon: React.ComponentType<IconProps>;
  title: string;
  text: string;
}

const FeatureCard = ({ icon: Icon, title, text }: FeatureCardProps) => (
  <div className="kac-feature-card" data-reveal>
    <Icon className="h-9 w-9 text-primary-600" />
    <h3>{title}</h3>
    <p>{text}</p>
  </div>
);

export default KACPage;
