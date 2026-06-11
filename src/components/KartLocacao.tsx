import { Phone, CreditCard, Coins, QrCode, ArrowLeft, ShieldAlert, Sparkles, MessageSquare, Info, ShieldCheck } from 'lucide-react';

const KartLocacao = () => {
  return (
    <section className="py-24 bg-white min-h-screen text-zinc-600">
      <div className="container mx-auto px-4">
        {/* Back Button */}
        <div className="mb-8 max-w-4xl mx-auto">
          <a href="/" className="inline-flex items-center text-zinc-500 hover:text-primary-600 font-semibold transition-colors">
            <ArrowLeft className="w-5 h-5 mr-2" />
            Voltar para a página inicial
          </a>
        </div>

        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-black text-zinc-950 mb-4 uppercase tracking-tight">
            Kart de <span className="text-primary-600">Locação</span>
          </h2>
          <div className="w-20 h-1.5 bg-primary-500 mx-auto rounded-full mb-6"></div>
          <p className="text-lg text-zinc-600 max-w-3xl mx-auto font-light leading-relaxed">
            Seja piloto por um dia! Confira todas as regras, requisitos e valores para vir correr na nossa pista.
          </p>
        </div>

        <div className="max-w-4xl mx-auto space-y-8">
          {/* Contact & Fast Booking */}
          <div className="bg-zinc-50 border border-zinc-200 rounded-3xl p-8 shadow-sm">
            <h3 className="text-xl font-bold text-zinc-900 uppercase tracking-wider mb-6">Como Agendar</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
              <div className="space-y-4">
                <p className="text-zinc-600 text-sm font-light leading-relaxed">
                  Para agendar sua bateria, basta entrar em contato com nossa central de reservas via WhatsApp ou telefone. Não é obrigatório ter um grupo mínimo para correr.
                </p>
                <div className="space-y-3.5">
                  <a href="tel:+553135112373" className="flex items-center space-x-3 text-sm hover:text-primary-600 transition-colors">
                    <Phone className="w-5 h-5 text-primary-500" />
                    <span className="text-zinc-700"><strong>Telefone:</strong> (31) 3511-2373</span>
                  </a>
                  <a href="https://wa.me/553135112373" target="_blank" rel="noopener noreferrer" className="flex items-center space-x-3 text-sm hover:text-primary-600 transition-colors">
                    <MessageSquare className="w-5 h-5 text-primary-500" />
                    <span className="text-zinc-700"><strong>WhatsApp:</strong> (31) 99884-2898</span>
                  </a>
                </div>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-3 md:justify-end">
                <a href="tel:+553135112373" className="px-5 py-3.5 bg-white border border-zinc-200 hover:border-zinc-300 text-zinc-700 font-bold uppercase tracking-wider text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-sm">
                  <Phone className="w-4 h-4 text-primary-600" />
                  Ligar no Fixo
                </a>
                <a href="https://wa.me/553135112373?text=Ol%C3%A1!%20Gostaria%20de%20reservar%20uma%20bateria%20de%20kart%20light." target="_blank" rel="noopener noreferrer" className="px-5 py-3.5 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-400 hover:to-primary-500 text-zinc-950 font-bold uppercase tracking-wider text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-md">
                  <MessageSquare className="w-4 h-4" />
                  Chamar no Whats
                </a>
              </div>
            </div>
          </div>

          {/* Race Info */}
          <div className="bg-zinc-50 border border-zinc-200 rounded-3xl p-8 shadow-sm">
            <div className="flex items-center space-x-3.5 mb-6">
              <div className="w-10 h-10 rounded-lg bg-white border border-zinc-200 flex items-center justify-center text-primary-600 shadow-sm">
                <Info className="w-5 h-5" />
              </div>
              <h3 className="text-xl font-bold text-zinc-900 uppercase tracking-wider">Estrutura da Bateria</h3>
            </div>
            <div className="space-y-4 text-sm text-zinc-600 font-light leading-relaxed">
              <p>
                Cada corrida/bateria tem duração total de <strong className="text-zinc-900 font-semibold">30 minutos</strong> dentro da pista, estruturada da seguinte forma:
              </p>
              <div className="grid grid-cols-3 gap-4 py-4 text-center">
                <div className="bg-white border border-zinc-200 p-4 rounded-2xl shadow-sm">
                  <div className="text-xl font-black text-primary-600 mb-1">5 MIN</div>
                  <div className="text-[10px] text-zinc-400 uppercase font-semibold">Tomada de Tempo (Qualify)</div>
                </div>
                <div className="bg-white border border-zinc-200 p-4 rounded-2xl shadow-sm">
                  <div className="text-xl font-black text-primary-600 mb-1">5 MIN</div>
                  <div className="text-[10px] text-zinc-400 uppercase font-semibold">Formação do Grid</div>
                </div>
                <div className="bg-white border border-zinc-200 p-4 rounded-2xl shadow-sm">
                  <div className="text-xl font-black text-primary-600 mb-1">20 MIN</div>
                  <div className="text-[10px] text-zinc-400 uppercase font-semibold">Corrida de Disputa</div>
                </div>
              </div>
              <p>
                <strong className="text-zinc-900 font-semibold">Importante:</strong> É obrigatório que todos os pilotos inscritos se apresentem no guichê do kartódromo com no mínimo <strong className="text-zinc-900 font-semibold">1 hora de antecedência</strong> do horário agendado. Esse período é necessário para validação do termo de responsabilidade nos tótens digitais, pesagem oficial, distribuição de macacões e capacetes, além da instrução de segurança (briefing).
              </p>
            </div>
          </div>

          {/* Requirements */}
          <div className="bg-zinc-50 border border-zinc-200 rounded-3xl p-8 shadow-sm">
            <div className="flex items-center space-x-3.5 mb-6">
              <div className="w-10 h-10 rounded-lg bg-white border border-zinc-200 flex items-center justify-center text-primary-600 shadow-sm">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <h3 className="text-xl font-bold text-zinc-900 uppercase tracking-wider">Requisitos Mínimos para Pilotar</h3>
            </div>
            <div className="space-y-4 text-sm text-zinc-600 font-light leading-relaxed">
              <p>
                O esporte é acessível a todos, não exigindo qualquer licença esportiva ou habilitação (CNH). Basta preencher os seguintes critérios físicos mínimos:
              </p>
              <ul className="grid grid-cols-1 md:grid-cols-3 gap-4 py-2 text-center">
                <li className="bg-white border border-zinc-200 p-4 rounded-2xl flex flex-col justify-center shadow-sm">
                  <span className="text-xs text-zinc-400 uppercase font-bold mb-1">Idade Mínima</span>
                  <span className="text-lg font-bold text-zinc-900">14 anos completos</span>
                </li>
                <li className="bg-white border border-zinc-200 p-4 rounded-2xl flex flex-col justify-center shadow-sm">
                  <span className="text-xs text-zinc-400 uppercase font-bold mb-1">Altura Mínima</span>
                  <span className="text-lg font-bold text-zinc-900">1,50 metros</span>
                </li>
                <li className="bg-white border border-zinc-200 p-4 rounded-2xl flex flex-col justify-center shadow-sm">
                  <span className="text-xs text-zinc-400 uppercase font-bold mb-1">Peso Mínimo</span>
                  <span className="text-lg font-bold text-zinc-900">50 quilogramas</span>
                </li>
              </ul>
              <p>
                <strong className="text-zinc-900 font-semibold">Vestimenta:</strong> É obrigatório correr de <strong className="text-zinc-900 font-semibold">calçado totalmente fechado</strong> (tênis). Os demais equipamentos de proteção (como capacete com viseira e macacão de corrida) são fornecidos sob regime de empréstimo gratuito pelo próprio kartódromo.
              </p>
            </div>
          </div>

          {/* Payment */}
          <div className="bg-zinc-50 border border-zinc-200 rounded-3xl p-8 shadow-sm">
            <h3 className="text-xl font-bold text-zinc-900 uppercase tracking-wider mb-6">Métodos de Pagamento</h3>
            <p className="text-sm text-zinc-500 font-light mb-8">
              Oferecemos flexibilidade de pagamento no local da corrida ou de forma antecipada para garantir as tarifas promocionais.
            </p>
            <div className="grid grid-cols-3 gap-4 text-center max-w-md mx-auto">
              <div className="flex flex-col items-center">
                <div className="w-12 h-12 bg-white border border-zinc-200 rounded-2xl flex items-center justify-center text-primary-600 mb-2 shadow-sm">
                  <Coins className="w-6 h-6" />
                </div>
                <span className="text-xs font-bold text-zinc-800 uppercase tracking-wider">Dinheiro</span>
              </div>
              <div className="flex flex-col items-center">
                <div className="w-12 h-12 bg-white border border-zinc-200 rounded-2xl flex items-center justify-center text-primary-600 mb-2 shadow-sm">
                  <QrCode className="w-6 h-6" />
                </div>
                <span className="text-xs font-bold text-zinc-800 uppercase tracking-wider">Pix</span>
              </div>
              <div className="flex flex-col items-center">
                <div className="w-12 h-12 bg-white border border-zinc-200 rounded-2xl flex items-center justify-center text-primary-600 mb-2 shadow-sm">
                  <CreditCard className="w-6 h-6" />
                </div>
                <span className="text-xs font-bold text-zinc-800 uppercase tracking-wider">Cartão</span>
              </div>
            </div>
          </div>

          {/* Safety */}
          <div className="bg-zinc-50 border border-zinc-200 rounded-3xl p-8 shadow-sm">
            <div className="flex items-center space-x-3.5 mb-6">
              <div className="w-10 h-10 rounded-lg bg-white border border-zinc-200 flex items-center justify-center text-primary-600 shadow-sm">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="text-xl font-bold text-zinc-900 uppercase tracking-wider">Segurança e Tecnologia da Frota</h3>
            </div>
            <div className="space-y-4 text-sm text-zinc-600 font-light leading-relaxed">
              <p>
                Contamos com uma frota de karts modernos e seguros, equipados com robustos motores <strong className="text-zinc-900 font-semibold">Honda GX390 de 13HP (400cc)</strong>. A frota é dividida em duas categorias:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-2">
                <div className="bg-white border border-zinc-200 p-5 rounded-2xl shadow-sm">
                  <h4 className="text-sm font-bold text-zinc-900 uppercase tracking-wide mb-1 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-primary-600" />
                    Kart Light
                  </h4>
                  <p className="text-xs text-zinc-500 font-light leading-normal">
                    Focado no público amador e iniciantes, garantindo aceleração suave e alto nível de proteção contra impactos laterais.
                  </p>
                </div>
                <div className="bg-white border border-zinc-200 p-5 rounded-2xl shadow-sm">
                  <h4 className="text-sm font-bold text-zinc-900 uppercase tracking-wide mb-1 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-primary-600" />
                    Super Kart
                  </h4>
                  <p className="text-xs text-zinc-500 font-light leading-normal">
                    Destinado a pilotos filiados e experientes que buscam tempos baixos, maior torque nas saídas de curva e regulagem de chassis.
                  </p>
                </div>
              </div>
              <p>
                O Kartódromo de Betim dispõe de ambulatório com atendimento de socorrista qualificado e UTI móvel de prontidão nos dias de funcionamento. Além disso, fiscais de pista e mecânicos coordenam a pista em tempo integral para que sua corrida ocorra em clima 100% esportivo.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default KartLocacao;
