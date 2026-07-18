import type { ComponentType } from 'react';
import { ArrowLeft, Download, MessageSquare } from 'lucide-react';
import Header from './Header';
import Footer from './Footer';
import AngledButton from './site-ui/AngledButton';
import BigCTA from './site-ui/BigCTA';
import GlassPanel from './site-ui/GlassPanel';

type Spec = [label: string, value: string];

type Rule = {
  icon: ComponentType<{ className?: string }>;
  title: string;
  text: string;
};

type PrimaryAction =
  | { kind: 'form'; championshipId: string; label: string }
  | { kind: 'whatsapp'; text: string; label: string };

type ChampionshipDetailLayoutProps = {
  eyebrow: string;
  titleLine1: string;
  titleLine2: string;
  lead: string;
  logo: string;
  logoAlt: string;
  watermark: string;
  watermarkCaption: string;
  specs: Spec[];
  primaryAction: PrimaryAction;
  regulationPdf?: string;
  rulesTitle: string;
  rules: Rule[];
  ctaTitleLine1: string;
  ctaTitleLine2: string;
  ctaText: string;
};

const ChampionshipDetailLayout = ({
  eyebrow,
  titleLine1,
  titleLine2,
  lead,
  logo,
  logoAlt,
  watermark,
  watermarkCaption,
  specs,
  primaryAction,
  regulationPdf,
  rulesTitle,
  rules,
  ctaTitleLine1,
  ctaTitleLine2,
  ctaText,
}: ChampionshipDetailLayoutProps) => {
  const primaryHref =
    primaryAction.kind === 'form'
      ? `/campeonatos#inscricao-${primaryAction.championshipId}`
      : `https://wa.me/5531998842898?text=${encodeURIComponent(primaryAction.text)}`;
  const primaryExternal = primaryAction.kind === 'whatsapp';

  return (
    <div className="min-h-screen bg-ink-950 text-white/80">
      <Header />

      <main>
        <section className="relative overflow-hidden border-b border-white/10 bg-ink-900">
          <div className="relative mx-auto grid min-h-[560px] max-w-7xl grid-cols-1 items-center gap-12 px-4 py-16 md:grid-cols-[1.02fr_0.98fr] md:px-8">
            <div className="max-w-3xl">
              <a href="/campeonatos" className="mb-8 inline-flex items-center gap-2 font-race text-xs italic font-bold uppercase tracking-[0.2em] text-white/55 hover:text-primary-400">
                <ArrowLeft className="h-4 w-4" />
                Campeonatos
              </a>

              <div className="mb-5 flex items-center gap-3 font-race text-xs italic font-bold uppercase tracking-[0.16em] text-primary-400">
                <span aria-hidden="true" className="h-px w-10 bg-primary-400" />
                {eyebrow}
              </div>

              <h1 className="max-w-2xl font-display text-6xl italic uppercase leading-[0.8] tracking-tight text-white md:text-8xl">
                {titleLine1} <span className="block text-primary-400">{titleLine2}</span>
              </h1>
              <p className="mt-7 max-w-2xl text-base leading-8 text-white/70 md:text-lg">{lead}</p>

              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <AngledButton href={primaryHref} external={primaryExternal}>
                  <MessageSquare className="h-4 w-4" />
                  {primaryAction.label}
                </AngledButton>
                {regulationPdf && (
                  <AngledButton href={regulationPdf} variant="outline" external>
                    <Download className="h-4 w-4" />
                    Baixar regulamento
                  </AngledButton>
                )}
              </div>
            </div>

            <GlassPanel className="mx-auto w-full max-w-md p-6">
              <div className="mb-5 flex items-center justify-center">
                <img src={logo} alt={logoAlt} className="h-28 w-28 object-contain" />
              </div>
              <div className="divide-y divide-white/10">
                {specs.map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between py-2.5 text-sm">
                    <span className="text-white/55">{label}</span>
                    <strong className="font-race italic text-white">{value}</strong>
                  </div>
                ))}
              </div>
            </GlassPanel>
          </div>

          <div className="border-t border-white/10 bg-ink-950/60 py-8 text-right">
            <span aria-hidden="true" className="block font-display text-[16vw] italic leading-[0.65] text-transparent [-webkit-text-stroke:1px_rgba(0,230,118,0.35)] md:text-[8vw]">
              {watermark}
            </span>
            <span className="mr-4 block font-race text-xs italic font-bold uppercase tracking-[0.18em] text-primary-400 md:mr-8">
              {watermarkCaption}
            </span>
          </div>
        </section>

        <section className="border-b border-white/10 bg-ink-950 py-16 md:py-24">
          <div className="mx-auto max-w-7xl px-4 md:px-8">
            <p className="mb-4 font-race text-xs italic font-bold uppercase tracking-[0.17em] text-primary-400 after:ml-3 after:content-['///']">
              Regulamento resumido
            </p>
            <h2 className="mb-10 font-display text-3xl italic uppercase leading-[0.85] tracking-tight text-white md:text-5xl">
              {rulesTitle}
            </h2>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
              {rules.map((rule) => (
                <article key={rule.title} className="border border-white/10 bg-ink-900 p-6">
                  <rule.icon className="h-8 w-8 text-primary-400" />
                  <h3 className="mt-4 font-race text-base italic font-bold uppercase text-white">{rule.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-white/65">{rule.text}</p>
                </article>
              ))}
            </div>
            {regulationPdf && (
              <div className="mt-8">
                <AngledButton href={regulationPdf} variant="outline" external>
                  <Download className="h-4 w-4" />
                  Abrir PDF completo
                </AngledButton>
              </div>
            )}
          </div>
        </section>

        <section className="bg-ink-900 py-16 md:py-24">
          <div className="mx-auto max-w-7xl px-4 md:px-8">
            <BigCTA
              watermark={watermark}
              title={<>{ctaTitleLine1}<br /><span className="text-primary-400">{ctaTitleLine2}</span></>}
              text={ctaText}
            >
              <AngledButton href={primaryHref} external={primaryExternal}>
                <MessageSquare className="h-4 w-4" />
                {primaryAction.label}
              </AngledButton>
              <AngledButton href="https://wa.me/5531998842898" variant="outline" external>
                Falar no WhatsApp
              </AngledButton>
            </BigCTA>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default ChampionshipDetailLayout;
