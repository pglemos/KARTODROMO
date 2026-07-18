import React, { useState } from 'react';
import { HelpCircle, ChevronDown, Flag, MessageSquare, ShieldAlert } from 'lucide-react';
import BigCTA from './site-ui/BigCTA';
import AngledButton from './site-ui/AngledButton';
import SectionHeading from './site-ui/SectionHeading';

type FAQCategory = 'seguranca' | 'reserva' | 'grupos';

interface FAQItem {
  question: string;
  answer: React.ReactNode;
  category: FAQCategory;
}

const categoryLabels: Record<'all' | FAQCategory, string> = {
  all: 'Todas',
  seguranca: 'Segurança',
  reserva: 'Reserva',
  grupos: 'Grupos',
};

const safetyRules = [
  {
    title: 'Respeite as bandeiras',
    text: 'A sinalização da equipe de pista orienta redução, parada, ultrapassagem e encerramento.',
  },
  {
    title: 'Evite contato intencional',
    text: 'Kart não é bate-bate. Condução agressiva pode gerar advertência, punição ou retirada da bateria.',
  },
  {
    title: 'Ouça o briefing',
    text: 'As regras de segurança, operação do kart e comportamento são explicadas antes da entrada na pista.',
  },
];

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [activeCategory, setActiveCategory] = useState<'all' | FAQCategory>('all');

  const toggleFAQ = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  const faqItems: FAQItem[] = [
    {
      category: 'seguranca',
      question: "Qual é a idade e altura mínimas para poder pilotar?",
      answer: (
        <p>
          Qualquer pessoa a partir de <strong>14 anos completos</strong>, com altura mínima de <strong>1,50 m</strong> e peso mínimo de <strong>50 kg</strong> pode pilotar no Kartódromo de Betim. É indispensável a apresentação de documento oficial com foto.
        </p>
      )
    },
    {
      category: 'seguranca',
      question: "Preciso ter habilitação de trânsito (CNH) ou experiência prévia?",
      answer: (
        <p>
          <strong>Não!</strong> Não é necessária nenhuma carteira de habilitação ou experiência prévia em automobilismo. Antes de cada corrida, todos os pilotos passam por um treinamento técnico básico de segurança (briefing), onde aprendem o significado das bandeiras, regras de pista e o funcionamento dos pedais.
        </p>
      )
    },
    {
      category: 'seguranca',
      question: "O kartódromo fornece os equipamentos de segurança ou preciso levar os meus?",
      answer: (
        <p>
          Nós fornecemos gratuitamente todo o equipamento básico necessário (capacete com viseira e macacão). O piloto deve, obrigatoriamente, comparecer utilizando <strong>calçado totalmente fechado</strong> (como tênis). Não é permitido correr usando chinelos, sandálias ou salto alto.
        </p>
      )
    },
    {
      category: 'reserva',
      question: "Como funciona a divisão do tempo em cada bateria de locação?",
      answer: (
        <p>
          As corridas têm duração total de <strong>30 minutos</strong> na pista, divididos em: 5 minutos de tomada de tempo para qualificação, 5 minutos de formação e alinhamento do grid de largada, e 20 minutos de corrida oficial com cronometragem eletrônica em tempo real.
        </p>
      )
    },
    {
      category: 'reserva',
      question: "Com quanta antecedência devo chegar no dia da corrida?",
      answer: (
        <p>
          É obrigatório que todo o grupo chegue com no mínimo <strong>1 hora de antecedência</strong> do horário agendado. Esse tempo é fundamental para preenchimento dos termos de responsabilidade no terminal eletrônico, retirada de equipamentos, pesagem e instrução técnica no briefing.
        </p>
      )
    },
    {
      category: 'grupos',
      question: "Como funciona a promoção de Aniversariante do Mês?",
      answer: (
        <p>
          Se você trouxer um grupo de no mínimo 10 convidados pagantes, a sua bateria de Kart Light sai por apenas <strong>R$ 90,00</strong>. Seus convidados pagam o preço promocional antecipado de R$ 145,00 cada. A promoção é válida para qualquer dia do mês do seu aniversário (desde que pré-agendada com antecedência mínima de 3 dias).
        </p>
      )
    },
    {
      category: 'grupos',
      question: "Qual o número mínimo e máximo de karts permitidos na pista?",
      answer: (
        <p>
          Você pode agendar individualmente ou em pequenos grupos sem limite mínimo (serão encaixados em baterias mistas). Para baterias exclusivas (pista fechada apenas para o seu grupo), o mínimo exigido é de <strong>25 pilotos</strong> de terça a sexta, e <strong>30 pilotos</strong> aos sábados, domingos e feriados. O limite máximo permitido por segurança na pista é de <strong>35 karts rodando simultaneamente</strong>.
        </p>
      )
    },
    {
      category: 'reserva',
      question: "Quais são as formas de pagamento disponíveis?",
      answer: (
        <p>
          No balcão de atendimento aceitamos dinheiro físico, Pix, cartões de débito e crédito (principais bandeiras). Para garantir tarifas com descontos promocionais (como compra coletiva ou pagamento antecipado do grupo), a quitação total pode ser realizada antecipadamente por Pix ou cartão de crédito.
        </p>
      )
    }
  ];

  const visibleItems = activeCategory === 'all' ? faqItems : faqItems.filter((item) => item.category === activeCategory);

  return (
    <section className="border-t border-white/10 bg-ink-950 py-16 text-white/70 md:py-24">
      <div className="container mx-auto px-4">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center border border-primary-400/30 bg-white/5 text-primary-400">
          <HelpCircle className="h-8 w-8" />
        </div>
        <SectionHeading
          align="center"
          eyebrow="Antes de correr"
          title={
            <>
              Dúvidas <span className="text-primary-400">Frequentes</span>
            </>
          }
        />
        <p className="mx-auto mt-6 max-w-3xl text-center text-lg font-light leading-relaxed text-white/70">
          Consulte regras de conduta, orientações de segurança e respostas para as dúvidas mais comuns antes de correr.
        </p>

        <div className="mt-16 grid grid-cols-1 gap-10 lg:grid-cols-[220px_1fr]">
          <div className="flex gap-2 overflow-x-auto lg:sticky lg:top-28 lg:flex-col lg:overflow-visible">
            {(Object.keys(categoryLabels) as Array<'all' | FAQCategory>).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => {
                  setActiveCategory(cat);
                  setOpenIndex(null);
                }}
                aria-pressed={activeCategory === cat}
                className={`whitespace-nowrap border px-4 py-3 text-left font-race text-xs italic font-bold uppercase tracking-wide transition-colors ${
                  activeCategory === cat
                    ? 'border-primary-400 bg-primary-400 text-ink-950'
                    : 'border-white/15 bg-white/5 text-white/60 hover:border-primary-400/40 hover:text-primary-400'
                }`}
              >
                {categoryLabels[cat]}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            {visibleItems.map((item) => {
              const index = faqItems.indexOf(item);
              const isOpen = openIndex === index;
              return (
                <div
                  key={item.question}
                  className="border border-white/10 bg-ink-900 transition-colors hover:border-primary-400/30"
                >
                  <button
                    type="button"
                    onClick={() => toggleFAQ(index)}
                    aria-expanded={isOpen}
                    className="flex w-full items-center justify-between px-6 py-5 text-left focus:outline-none"
                  >
                    <span className="pr-4 font-race text-sm italic font-bold uppercase tracking-wide text-white md:text-base">
                      {item.question}
                    </span>
                    <div
                      className={`flex h-8 w-8 flex-shrink-0 items-center justify-center border border-white/15 bg-white/5 text-primary-400 transition-transform duration-300 ${
                        isOpen ? 'rotate-180 border-primary-400/40' : ''
                      }`}
                    >
                      <ChevronDown className="h-4 w-4" />
                    </div>
                  </button>

                  {isOpen && (
                    <div className="border-t border-white/10 px-6 pb-6 pt-4 text-sm font-light leading-relaxed text-white/65">
                      {item.answer}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-20">
          <p className="mb-4 font-race text-xs italic font-bold uppercase tracking-[0.17em] text-primary-400 after:ml-3 after:content-['///']">
            Três regras essenciais
          </p>
          <h2 className="mb-10 font-display text-3xl italic uppercase leading-[0.85] tracking-tight text-white md:text-5xl">
            Segurança também faz parte da corrida
          </h2>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            {safetyRules.map((rule, index) => (
              <article key={rule.title} className="relative overflow-hidden border border-white/10 bg-ink-900 p-6">
                <span
                  aria-hidden="true"
                  className="absolute -bottom-6 right-3 font-display text-[110px] italic leading-none text-white/[0.04]"
                >
                  {String(index + 1).padStart(2, '0')}
                </span>
                <Flag className="relative z-10 mb-4 h-6 w-6 text-primary-400" />
                <h3 className="relative z-10 font-race text-base italic font-bold uppercase text-white">{rule.title}</h3>
                <p className="relative z-10 mt-2 text-sm leading-6 text-white/65">{rule.text}</p>
              </article>
            ))}
          </div>
        </div>

        <div className="mt-16">
          <BigCTA
            watermark="FAQ"
            title={<>Ainda precisa<br /><span className="text-primary-400">de ajuda?</span></>}
            text="A equipe esclarece dúvidas sobre horários, grupos, campeonatos e regulamentos."
          >
            <AngledButton href="https://wa.me/5531998842898?text=Ol%C3%A1!%20Tenho%20uma%20d%C3%BAvida%20que%20n%C3%A3o%20encontrei%20nas%20FAQ%20do%20site." external>
              <MessageSquare className="h-4 w-4" />
              Falar com suporte
            </AngledButton>
            <AngledButton href="https://wa.me/5531998842898" variant="outline" external>
              <ShieldAlert className="h-4 w-4" />
              Falar no WhatsApp
            </AngledButton>
          </BigCTA>
        </div>
      </div>
    </section>
  );
}
