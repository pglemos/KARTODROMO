import React, { useState } from 'react';
import { HelpCircle, ChevronDown, MessageSquare, ShieldAlert } from 'lucide-react';

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
    <section className="py-24 bg-zinc-50 min-h-screen text-zinc-700">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-50 border border-primary-500/20 rounded-2xl mb-6 text-primary-600">
            <HelpCircle className="w-8 h-8" />
          </div>
          <h1 className="text-3xl md:text-5xl font-black text-zinc-950 mb-4 uppercase tracking-tight">
            Dúvidas <span className="text-primary-600">Frequentes</span>
          </h1>
          <div className="w-20 h-1.5 bg-primary-500 mx-auto rounded-full mb-6"></div>
          <p className="text-lg text-zinc-600 max-w-3xl mx-auto font-light leading-relaxed">
            Consulte regras de conduta, orientações de segurança e respostas para as dúvidas mais comuns antes de correr.
          </p>
        </div>

        {/* Accordion Layout */}
        <div className="max-w-3xl mx-auto space-y-4 mb-16">
          {faqItems.map((item, index) => {
            const isOpen = openIndex === index;
            return (
              <div 
                key={index}
                className="bg-white border border-zinc-200 rounded-2xl overflow-hidden hover:border-primary-500/30 hover:shadow-sm transition-all duration-300"
              >
                <button
                  onClick={() => toggleFAQ(index)}
                  className="w-full px-6 py-5 flex items-center justify-between text-left focus:outline-none transition-colors"
                >
                  <span className="font-bold text-zinc-900 text-sm md:text-base tracking-wide pr-4">
                    {item.question}
                  </span>
                  <div className={`w-8 h-8 rounded-lg bg-zinc-50 border border-zinc-200 flex items-center justify-center text-primary-600 flex-shrink-0 transition-transform duration-300 ${isOpen ? 'rotate-180 border-primary-500/30 text-primary-600' : ''}`}>
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </button>
                
                {isOpen && (
                  <div className="px-6 pb-6 pt-1 text-sm text-zinc-600 leading-relaxed font-light border-t border-zinc-100 animate-slideDown">
                    {item.answer}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Support Callout */}
        <div className="max-w-3xl mx-auto bg-white border border-primary-500/25 rounded-3xl p-8 text-center shadow-sm">
          <ShieldAlert className="w-10 h-10 text-primary-600 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-zinc-950 mb-2 uppercase tracking-wide">Ainda precisa de ajuda?</h3>
          <p className="text-zinc-600 text-sm max-w-xl mx-auto mb-6 font-light leading-relaxed">
            Nossa equipe de suporte está à disposição no WhatsApp para esclarecer dúvidas sobre campeonatos, regulamentos específicos e cotações sob medida.
          </p>
          <a
            href="https://wa.me/553135112373?text=Ol%C3%A1!%20Tenho%20uma%20d%C3%BAvida%20que%20n%C3%A3o%20encontrei%20nas%20FAQ%20do%20site."
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center px-6 py-3.5 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-400 hover:to-primary-500 text-zinc-950 font-bold uppercase tracking-wider text-xs rounded-xl transition-all duration-300 shadow-md"
          >
            <MessageSquare className="w-4 h-4 mr-2" />
            Falar no WhatsApp
          </a>
        </div>
      </div>
    </section>
  );
}
