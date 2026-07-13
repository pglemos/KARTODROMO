import React, { useState } from 'react';
import { HelpCircle, ChevronDown, MessageSquare, ShieldAlert } from 'lucide-react';
import SectionHeading from './site-ui/SectionHeading';

interface FAQItem {
  question: string;
  answer: React.ReactNode;
}

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggleFAQ = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  const faqItems: FAQItem[] = [
    {
      question: "Qual é a idade e altura mínimas para poder pilotar?",
      answer: (
        <p>
          Qualquer pessoa a partir de <strong>14 anos completos</strong>, com altura mínima de <strong>1,50 m</strong> e peso mínimo de <strong>50 kg</strong> pode pilotar no Kartódromo de Betim. É indispensável a apresentação de documento oficial com foto.
        </p>
      )
    },
    {
      question: "Preciso ter habilitação de trânsito (CNH) ou experiência prévia?",
      answer: (
        <p>
          <strong>Não!</strong> Não é necessária nenhuma carteira de habilitação ou experiência prévia em automobilismo. Antes de cada corrida, todos os pilotos passam por um treinamento técnico básico de segurança (briefing), onde aprendem o significado das bandeiras, regras de pista e o funcionamento dos pedais.
        </p>
      )
    },
    {
      question: "O kartódromo fornece os equipamentos de segurança ou preciso levar os meus?",
      answer: (
        <p>
          Nós fornecemos gratuitamente todo o equipamento básico necessário (capacete com viseira e macacão). O piloto deve, obrigatoriamente, comparecer utilizando <strong>calçado totalmente fechado</strong> (como tênis). Não é permitido correr usando chinelos, sandálias ou salto alto.
        </p>
      )
    },
    {
      question: "Como funciona a divisão do tempo em cada bateria de locação?",
      answer: (
        <p>
          As corridas têm duração total de <strong>30 minutos</strong> na pista, divididos em: 5 minutos de tomada de tempo para qualificação, 5 minutos de formação e alinhamento do grid de largada, e 20 minutos de corrida oficial com cronometragem eletrônica em tempo real.
        </p>
      )
    },
    {
      question: "Com quanta antecedência devo chegar no dia da corrida?",
      answer: (
        <p>
          É obrigatório que todo o grupo chegue com no mínimo <strong>1 hora de antecedência</strong> do horário agendado. Esse tempo é fundamental para preenchimento dos termos de responsabilidade no terminal eletrônico, retirada de equipamentos, pesagem e instrução técnica no briefing.
        </p>
      )
    },
    {
      question: "Como funciona a promoção de Aniversariante do Mês?",
      answer: (
        <p>
          Se você trouxer um grupo de no mínimo 10 convidados pagantes, a sua bateria de Kart Light sai por apenas <strong>R$ 90,00</strong>. Seus convidados pagam o preço promocional antecipado de R$ 145,00 cada. A promoção é válida para qualquer dia do mês do seu aniversário (desde que pré-agendada com antecedência mínima de 3 dias).
        </p>
      )
    },
    {
      question: "Qual o número mínimo e máximo de karts permitidos na pista?",
      answer: (
        <p>
          Você pode agendar individualmente ou em pequenos grupos sem limite mínimo (serão encaixados em baterias mistas). Para baterias exclusivas (pista fechada apenas para o seu grupo), o mínimo exigido é de <strong>25 pilotos</strong> de terça a sexta, e <strong>30 pilotos</strong> aos sábados, domingos e feriados. O limite máximo permitido por segurança na pista é de <strong>35 karts rodando simultaneamente</strong>.
        </p>
      )
    },
    {
      question: "Quais são as formas de pagamento disponíveis?",
      answer: (
        <p>
          No balcão de atendimento aceitamos dinheiro físico, Pix, cartões de débito e crédito (principais bandeiras). Para garantir tarifas com descontos promocionais (como compra coletiva ou pagamento antecipado do grupo), a quitação total pode ser realizada antecipadamente por Pix ou cartão de crédito.
        </p>
      )
    }
  ];

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

        <div className="mx-auto mb-16 mt-16 max-w-3xl space-y-3">
          {faqItems.map((item, index) => {
            const isOpen = openIndex === index;
            return (
              <div
                key={index}
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

        <div className="mx-auto max-w-3xl border border-primary-400/25 bg-ink-900 p-8 text-center">
          <ShieldAlert className="mx-auto mb-4 h-10 w-10 text-primary-400" />
          <h3 className="mb-2 font-display text-xl italic uppercase tracking-wide text-white">Ainda precisa de ajuda?</h3>
          <p className="mx-auto mb-6 max-w-xl text-sm font-light leading-relaxed text-white/65">
            Nossa equipe de suporte está à disposição no WhatsApp para esclarecer dúvidas sobre campeonatos, regulamentos específicos e cotações sob medida.
          </p>
          <a
            href="https://wa.me/553135112373?text=Ol%C3%A1!%20Tenho%20uma%20d%C3%BAvida%20que%20n%C3%A3o%20encontrei%20nas%20FAQ%20do%20site."
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-gradient-to-br from-primary-400 to-primary-600 px-6 py-3.5 font-race text-xs italic font-bold uppercase tracking-wider text-ink-950 [clip-path:polygon(7%_0,100%_0,93%_100%,0_100%)]"
          >
            <MessageSquare className="h-4 w-4" />
            Falar no WhatsApp
          </a>
        </div>
      </div>
    </section>
  );
}
