import { Gift, Users, AlertTriangle, Check, MessageCircle } from 'lucide-react';

const Promotions = () => {
  return (
    <section id="promocoes" className="py-24 bg-white border-t border-zinc-200/60">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-black text-zinc-950 mb-4 uppercase tracking-tight">
            Nossas <span className="text-primary-600">Promoções</span>
          </h2>
          <div className="w-20 h-1.5 bg-primary-500 mx-auto rounded-full mb-6"></div>
          <p className="text-lg text-zinc-600 max-w-3xl mx-auto font-light leading-relaxed">
            Aproveite nossos descontos especiais e traga sua turma para correr pagando menos!
          </p>
        </div>

        {/* Promo cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-5xl mx-auto mb-16">
          {/* Promoção Aniversariante */}
          <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-8 hover:border-primary-500/30 hover:shadow-md transition-all duration-300 flex flex-col justify-between relative overflow-hidden group">
            <div>
              <div className="flex items-center space-x-4 mb-6">
                <div className="w-14 h-14 bg-primary-50 border border-primary-500/20 rounded-2xl flex items-center justify-center text-primary-600 flex-shrink-0">
                  <Gift className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-zinc-900 uppercase tracking-tight">Aniversariante do Mês</h3>
                  <p className="text-xs text-primary-600 font-bold uppercase tracking-wider">Corrida com Preço Especial</p>
                </div>
              </div>

              {/* Price Details */}
              <div className="bg-white border border-zinc-200 rounded-2xl p-5 mb-6">
                <p className="text-zinc-600 text-sm font-light leading-relaxed mb-3">
                  Trazendo um grupo de no mínimo <strong className="text-zinc-900">10 amigos pagantes</strong>, a bateria do aniversariante sai por apenas:
                </p>
                <div className="flex items-baseline space-x-2">
                  <span className="text-4xl font-black text-primary-600">R$ 90,00</span>
                  <span className="text-xs text-zinc-500">para o aniversariante</span>
                </div>
                <p className="text-xs text-zinc-500 mt-2">
                  Os convidados pagam o valor promocional antecipado de <strong>R$ 145,00</strong> cada.
                </p>
              </div>

              {/* Conditions List */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-zinc-900 uppercase tracking-wider mb-2 flex items-center">
                  <AlertTriangle className="w-4 h-4 mr-1 text-primary-500" />
                  Regras e Condições
                </h4>
                <ul className="space-y-2 text-xs text-zinc-600 font-light">
                  <li className="flex items-start">
                    <Check className="w-3.5 h-3.5 mr-2 text-primary-500 mt-0.5 flex-shrink-0" />
                    <span>Válido para baterias exclusivas de <strong className="text-zinc-900">Kart Light</strong> durante todo o mês de aniversário.</span>
                  </li>
                  <li className="flex items-start">
                    <Check className="w-3.5 h-3.5 mr-2 text-primary-500 mt-0.5 flex-shrink-0" />
                    <span>Necessário solicitar a promoção no ato da reserva e agendamento prévio de no mínimo <strong className="text-zinc-900">3 dias</strong>.</span>
                  </li>
                  <li className="flex items-start">
                    <Check className="w-3.5 h-3.5 mr-2 text-primary-500 mt-0.5 flex-shrink-0" />
                    <span>Mínimo de <strong className="text-zinc-900">11 pilotos no total</strong> (aniversariante + 10 amigos) presentes no dia.</span>
                  </li>
                  <li className="flex items-start">
                    <Check className="w-3.5 h-3.5 mr-2 text-primary-500 mt-0.5 flex-shrink-0" />
                    <span>Necessário apresentar documento original com foto no balcão para validação.</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="pt-8">
              <a 
                href="https://wa.me/553135112373?text=Ol%C3%A1!%20Gostaria%20de%20agendar%20minha%20corrida%20de%20aniversariante%20do%20m%C3%AAs."
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3 bg-white border border-zinc-200 hover:border-primary-500/30 hover:bg-zinc-50 text-zinc-700 font-bold uppercase tracking-wider text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all duration-300 shadow-sm"
              >
                <MessageCircle className="w-4 h-4 text-primary-600" />
                Agendar Bateria de Aniversário
              </a>
            </div>
          </div>

          {/* Promoção Compra Coletiva */}
          <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-8 hover:border-primary-500/30 hover:shadow-md transition-all duration-300 flex flex-col justify-between relative overflow-hidden group">
            <div>
              <div className="flex items-center space-x-4 mb-6">
                <div className="w-14 h-14 bg-yellow-50 border border-yellow-500/30 rounded-2xl flex items-center justify-center text-yellow-600 flex-shrink-0">
                  <Users className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-zinc-900 uppercase tracking-tight">Compra Coletiva</h3>
                  <p className="text-xs text-yellow-600 font-bold uppercase tracking-wider">Desconto para Grupos</p>
                </div>
              </div>

              {/* Price Details */}
              <div className="bg-white border border-zinc-200 rounded-2xl p-5 mb-6">
                <p className="text-zinc-600 text-sm font-light leading-relaxed mb-3">
                  Para grupos fechados, organizando o pagamento de forma única via Pix ou transferência com antecedência:
                </p>
                <div className="flex items-baseline space-x-2">
                  <span className="text-4xl font-black text-yellow-600">R$ 145,00</span>
                  <span className="text-xs text-zinc-500">por pessoa</span>
                </div>
                <p className="text-xs text-zinc-500 mt-2">
                  Economia garantida de R$ 30,00 por piloto sobre o preço de balcão (R$ 175,00).
                </p>
              </div>

              {/* Conditions List */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-zinc-900 uppercase tracking-wider mb-2 flex items-center">
                  <AlertTriangle className="w-4 h-4 mr-1 text-yellow-500" />
                  Regras e Condições
                </h4>
                <ul className="space-y-2 text-xs text-zinc-600 font-light">
                  <li className="flex items-start">
                    <Check className="w-3.5 h-3.5 mr-2 text-yellow-500 mt-0.5 flex-shrink-0" />
                    <span>Aplicável apenas para agendamento prévio na categoria de <strong className="text-zinc-900">Kart Light</strong>.</span>
                  </li>
                  <li className="flex items-start">
                    <Check className="w-3.5 h-3.5 mr-2 text-yellow-500 mt-0.5 flex-shrink-0" />
                    <span>O pagamento total deve ser feito pelo organizador em uma transação única até <strong className="text-zinc-900">7 dias antes</strong> da corrida.</span>
                  </li>
                  <li className="flex items-start">
                    <Check className="w-3.5 h-3.5 mr-2 text-yellow-500 mt-0.5 flex-shrink-0" />
                    <span>Mínimo de <strong className="text-zinc-900">10 pilotos</strong> no grupo pagante para validar a promoção.</span>
                  </li>
                  <li className="flex items-start">
                    <Check className="w-3.5 h-3.5 mr-2 text-yellow-500 mt-0.5 flex-shrink-0" />
                    <span>Pilotos adicionais avulsos que pagarem no local no dia perdem o benefício e pagam preço cheio de balcão.</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="pt-8">
              <a 
                href="https://wa.me/553135112373?text=Ol%C3%A1!%20Gostaria%20de%20solicitar%20a%20promo%C3%A7%C3%A3o%20de%20compra%20coletiva%20para%20meu%20grupo."
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3 bg-white border border-zinc-200 hover:border-yellow-500/30 hover:bg-zinc-50 text-zinc-700 font-bold uppercase tracking-wider text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all duration-300 shadow-sm"
              >
                <MessageCircle className="w-4 h-4 text-yellow-600" />
                Agendar Compra Coletiva
              </a>
            </div>
          </div>
        </div>

        {/* Global Warnings Banner */}
        <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-6 md:p-8 max-w-5xl mx-auto">
          <div className="flex items-center space-x-3 mb-4">
            <AlertTriangle className="w-6 h-6 text-primary-600 flex-shrink-0" />
            <h4 className="text-base font-bold text-zinc-900 uppercase tracking-wider">Atenção ao Reservar Exclusividade</h4>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-zinc-600 font-light">
            <div className="space-y-2">
              <p>• <strong className="text-zinc-900 uppercase">Promoções Não Cumulativas:</strong> Os descontos de Aniversariante e Compra Coletiva não podem ser associados a outras ofertas vigentes.</p>
              <p>• <strong className="text-zinc-900 uppercase">Baterias Fechadas:</strong> Ao reservar uma bateria exclusiva, o grupo garante a pista inteira somente para si, necessitando honrar o pagamento das cotas mínimas acordadas na contratação.</p>
            </div>
            <div className="space-y-2">
              <p>• <strong className="text-zinc-900 uppercase">Política de Não Reembolso:</strong> Não haverá estornos caso compareçam menos participantes no dia do que o número de vagas previamente contratado.</p>
              <p>• <strong className="text-zinc-900 uppercase">Limite de Karts:</strong> A pista suporta o máximo de até 35 karts rodando simultaneamente por bateria para total integridade física dos competidores.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Promotions;
