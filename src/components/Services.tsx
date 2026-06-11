import { CreditCard, MessageCircle, Star, ArrowRight, ShieldCheck, CheckCircle, Gauge, Zap } from 'lucide-react';
import { MYLAPTIME_BOOKING_URL } from '../config/booking';

const Services = () => {
  return (
    <section id="servicos" className="py-24 bg-white border-t border-zinc-200/60">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-black text-zinc-950 mb-4 uppercase tracking-tight">
            Nossas <span className="text-primary-600">Modalidades</span>
          </h2>
          <div className="w-20 h-1.5 bg-primary-500 mx-auto rounded-full mb-6"></div>
          <p className="text-lg text-zinc-600 max-w-3xl mx-auto font-light leading-relaxed">
            Escolha o nível de adrenalina ideal e venha correr na pista profissional de kart mais tradicional do estado.
          </p>
        </div>

        {/* Modalidade Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {/* Kart Light */}
          <div className="bg-zinc-50 border border-zinc-200 rounded-2xl overflow-hidden hover:border-primary-500/40 hover:shadow-md transition-all duration-300 flex flex-col justify-between group">
            <div>
              {/* Header Card */}
              <div className="p-8 border-b border-zinc-200 bg-zinc-50 relative">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-primary-50 border border-primary-500/20 flex items-center justify-center">
                    <Gauge className="w-7 h-7 text-primary-700" aria-hidden="true" />
                  </div>
                  <span className="text-xs font-bold uppercase tracking-widest bg-primary-50 text-primary-700 border border-primary-500/30 px-3 py-1 rounded-full">
                    Aberto ao Público
                  </span>
                </div>
                <h3 className="text-2xl font-bold text-zinc-900 mb-2">Kart Light</h3>
                <p className="text-zinc-600 text-sm font-light">Ideal para iniciantes, grupos de amigos, aniversários e lazer geral.</p>
              </div>

              {/* Pricing & Info */}
              <div className="p-8 space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Online Pre-pay */}
                  <div className="bg-white border border-primary-500/30 rounded-2xl p-5 relative overflow-hidden group-hover:border-primary-500/50 transition-colors">
                    <div className="mb-2 flex items-center gap-1 text-xs font-semibold uppercase text-primary-600">
                      <CreditCard className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
                      Pix ou cartão de crédito
                    </div>
                    <div className="text-xs text-zinc-500 uppercase font-bold tracking-wider mb-1">Antecipado Online</div>
                    <div className="text-3xl font-black text-primary-600 tracking-tight">R$ 145,00</div>
                    <div className="text-xs text-primary-700 font-semibold mt-1">Economize R$ 30,00</div>
                  </div>

                  {/* Counter Price */}
                  <div className="bg-white border border-zinc-200 rounded-2xl p-5">
                    <div className="text-xs text-zinc-500 uppercase font-bold tracking-wider mb-1">No Balcão / Local</div>
                    <div className="text-3xl font-black text-zinc-800 tracking-tight">R$ 175,00</div>
                    <div className="text-xs text-zinc-500 mt-1">Crédito, Débito ou Pix</div>
                  </div>
                </div>

                {/* Requirements List */}
                <div className="space-y-3 pt-2">
                  <h4 className="text-sm font-bold text-zinc-900 uppercase tracking-wider mb-2 flex items-center">
                    <ShieldCheck className="w-4 h-4 mr-1.5 text-primary-600" />
                    Regras e Requisitos
                  </h4>
                  <ul className="space-y-2 text-sm text-zinc-600 font-light">
                    <li className="flex items-start">
                      <CheckCircle className="w-4 h-4 mr-2 text-primary-600 mt-0.5 flex-shrink-0" />
                      <span>Bateria de <strong className="text-zinc-900">30 min</strong> (5m tomada de tempo, 5m formação de grid, 20m corrida).</span>
                    </li>
                    <li className="flex items-start">
                      <CheckCircle className="w-4 h-4 mr-2 text-primary-600 mt-0.5 flex-shrink-0" />
                      <span>Idade mínima de <strong className="text-zinc-900">14 anos completos</strong>.</span>
                    </li>
                    <li className="flex items-start">
                      <CheckCircle className="w-4 h-4 mr-2 text-primary-600 mt-0.5 flex-shrink-0" />
                      <span>Altura mínima de <strong className="text-zinc-900">1,50 m</strong> e peso mínimo de <strong className="text-zinc-900">50 kg</strong>.</span>
                    </li>
                    <li className="flex items-start">
                      <CheckCircle className="w-4 h-4 mr-2 text-primary-600 mt-0.5 flex-shrink-0" />
                      <span>Obrigatório o uso de <strong className="text-zinc-900">calçado fechado</strong> (tênis).</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Action Footer */}
            <div className="p-8 border-t border-zinc-200 bg-zinc-100/50">
              <a 
                href={MYLAPTIME_BOOKING_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3.5 px-4 bg-white border border-zinc-200 hover:border-primary-500/40 hover:bg-zinc-50 text-zinc-700 font-bold uppercase tracking-wider text-sm rounded-xl flex items-center justify-center gap-2 transition-all duration-300 shadow-sm"
              >
                <span>Reservar Kart Light</span>
                <ArrowRight className="w-4 h-4 text-primary-600" />
              </a>
            </div>
          </div>

          {/* Super Kart */}
          <div className="bg-zinc-50 border border-zinc-200 rounded-2xl overflow-hidden hover:border-primary-500/40 hover:shadow-md transition-all duration-300 flex flex-col justify-between group">
            <div>
              {/* Header Card */}
              <div className="p-8 border-b border-zinc-200 bg-zinc-50 relative">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-yellow-50 border border-yellow-500/20 flex items-center justify-center">
                    <Zap className="w-7 h-7 text-yellow-700" aria-hidden="true" />
                  </div>
                  <span className="text-xs font-bold uppercase tracking-widest bg-yellow-50 text-yellow-700 border border-yellow-500/30 px-3 py-1 rounded-full">
                    Pilotos Experientes
                  </span>
                </div>
                <h3 className="text-2xl font-bold text-zinc-900 mb-2">Super Kart</h3>
                <p className="text-zinc-600 text-sm font-light">Reservado para pilotos frequentes, filiados, treinos avulsos e campeonatos.</p>
              </div>

              {/* Pricing & Info */}
              <div className="p-8 space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Counter Price */}
                  <div className="bg-white border border-zinc-200 rounded-2xl p-5">
                    <div className="text-xs text-zinc-500 uppercase font-bold tracking-wider mb-1">Valor Balcão Regular</div>
                    <div className="text-3xl font-black text-zinc-800 tracking-tight">R$ 200,00</div>
                    <div className="text-xs text-zinc-500 mt-1">Crédito, Débito ou Pix</div>
                  </div>

                  {/* Club Price */}
                  <div className="bg-white border border-yellow-500/30 rounded-2xl p-5 relative overflow-hidden group-hover:border-yellow-500/50 transition-colors">
                    <div className="absolute top-2 right-2 text-xs font-semibold text-yellow-600 flex items-center">
                      <Star className="w-3.5 h-3.5 mr-0.5 fill-yellow-500 text-yellow-500" />
                      CLUBE
                    </div>
                    <div className="text-xs text-zinc-500 uppercase font-bold tracking-wider mb-1">Com Carteirinha</div>
                    <div className="text-3xl font-black text-yellow-600 tracking-tight">R$ 185,00</div>
                    <div className="text-xs text-yellow-700 font-semibold mt-1">Desconto de R$ 15,00</div>
                  </div>
                </div>

                {/* Requirements List */}
                <div className="space-y-3 pt-2">
                  <h4 className="text-sm font-bold text-zinc-900 uppercase tracking-wider mb-2 flex items-center">
                    <ShieldCheck className="w-4 h-4 mr-1.5 text-yellow-600" />
                    Regras e Requisitos
                  </h4>
                  <ul className="space-y-2 text-sm text-zinc-600 font-light">
                    <li className="flex items-start">
                      <CheckCircle className="w-4 h-4 mr-2 text-yellow-600 mt-0.5 flex-shrink-0" />
                      <span>Karts de alta performance equipados com motores <strong className="text-zinc-900">Honda GX390 de 13HP (400cc)</strong>.</span>
                    </li>
                    <li className="flex items-start">
                      <CheckCircle className="w-4 h-4 mr-2 text-yellow-600 mt-0.5 flex-shrink-0" />
                      <span>Desconto de R$ 15,00 é válido apenas em baterias abertas e treinos avulsos de Super Kart.</span>
                    </li>
                    <li className="flex items-start">
                      <CheckCircle className="w-4 h-4 mr-2 text-yellow-600 mt-0.5 flex-shrink-0" />
                      <span>Necessário apresentar a carteirinha oficial do Super Kart no balcão de atendimento.</span>
                    </li>
                    <li className="flex items-start">
                      <CheckCircle className="w-4 h-4 mr-2 text-yellow-600 mt-0.5 flex-shrink-0" />
                      <span>Mesmos critérios de segurança básica e indumentária obrigatória da categoria Light.</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Action Footer */}
            <div className="p-8 border-t border-zinc-200 bg-zinc-100/50">
              <a 
                href="https://wa.me/553135112373?text=Ol%C3%A1!%20Gostaria%20de%20saber%20sobre%20os%20hor%C3%A1rios%20dispon%C3%ADveis%20para%20o%20Super%20Kart."
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3.5 px-4 bg-white border border-zinc-200 hover:border-yellow-500/40 hover:bg-zinc-50 text-zinc-700 font-bold uppercase tracking-wider text-sm rounded-xl flex items-center justify-center gap-2 transition-all duration-300 shadow-sm"
              >
                <span>Falar com Atendimento Super Kart</span>
                <ArrowRight className="w-4 h-4 text-yellow-600" />
              </a>
            </div>
          </div>
        </div>

        {/* Global Warning / CTA */}
        <div className="mt-16 bg-zinc-50 border border-zinc-200 rounded-2xl p-8 max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm relative overflow-hidden">
          <div className="space-y-2 text-center md:text-left">
            <h3 className="text-xl font-bold text-zinc-950 uppercase tracking-tight">Deseja uma bateria exclusiva para seu grupo?</h3>
            <p className="text-sm text-zinc-600 font-light max-w-xl">
              Terça a sexta-feira: mínimo de 25 pilotos para fechamento de bateria. Finais de semana e feriados: mínimo de 30 pilotos.
              Para grupos menores, agendamos baterias mistas.
            </p>
          </div>
          <a 
            href="https://wa.me/553135112373"
            target="_blank"
            rel="noopener noreferrer"
            className="px-6 py-3.5 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-400 hover:to-primary-500 text-zinc-950 font-bold uppercase tracking-wider text-xs rounded-xl flex items-center justify-center gap-2 transition-all duration-300 shadow-md"
          >
            <MessageCircle className="w-4 h-4" />
            Reservar via WhatsApp
          </a>
        </div>
      </div>
    </section>
  );
};

export default Services;
