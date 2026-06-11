import { Award, Shield, Clock, CheckCircle, ArrowRight } from 'lucide-react';

const About = () => {
  return (
    <section id="sobre" className="py-24 bg-white border-t border-zinc-200/60">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-black text-zinc-950 mb-4 uppercase tracking-tight">
            Sobre o <span className="text-primary-600">Kartódromo</span>
          </h2>
          <div className="w-20 h-1.5 bg-primary-500 mx-auto rounded-full mb-6"></div>
          <p className="text-lg text-zinc-600 max-w-3xl mx-auto font-light leading-relaxed">
            Desde 1996, o Kartódromo Internacional de Betim recebe pilotos, famílias, campeonatos e eventos em uma pista de 1.110 metros.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start max-w-6xl mx-auto">
          {/* Text & Stats */}
          <div className="lg:col-span-6 space-y-6">
            <h3 className="text-2xl md:text-3xl font-bold text-zinc-900 tracking-tight">
              Mais de 25 Anos de Tradição e Velocidade
            </h3>
            <p className="text-zinc-600 leading-relaxed font-light">
              Inaugurado em 1996, o Kartódromo Internacional de Betim possui pista homologada de 1.110 metros,
              áreas de escape gramadas e estrutura para kart de locação, treinos e campeonatos.
            </p>
            <p className="text-zinc-600 leading-relaxed font-light">
              O complexo também recebe famílias, grupos e eventos, com área gourmet, salões e atendimento dedicado.
            </p>
            
            <div className="pt-2">
              <a href="/historia" className="inline-flex items-center text-primary-600 hover:text-primary-700 font-semibold transition-colors group">
                <span>Conheça nossa história completa</span>
                <ArrowRight className="w-4 h-4 ml-2 transform group-hover:translate-x-1 transition-transform" />
              </a>
            </div>
            
            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 gap-4 pt-6 border-t border-zinc-200">
              <div className="bg-zinc-50 border border-zinc-200/80 rounded-xl p-4 text-center">
                <div className="text-3xl font-extrabold text-primary-600 mb-1">25+</div>
                <div className="text-xs text-zinc-500 uppercase tracking-widest font-bold">Anos de Experiência</div>
              </div>
              <div className="bg-zinc-50 border border-zinc-200/80 rounded-xl p-4 text-center">
                <div className="text-3xl font-extrabold text-primary-600 mb-1">50K+</div>
                <div className="text-xs text-zinc-500 uppercase tracking-widest font-bold">Corridas Realizadas</div>
              </div>
              <div className="bg-zinc-50 border border-zinc-200/80 rounded-xl p-4 text-center">
                <div className="text-3xl font-extrabold text-primary-600 mb-1">1.110m</div>
                <div className="text-xs text-zinc-500 uppercase tracking-widest font-bold">Pista Homologada</div>
              </div>
              <div className="bg-zinc-50 border border-zinc-200/80 rounded-xl p-4 text-center">
                <div className="text-3xl font-extrabold text-primary-600 mb-1">100%</div>
                <div className="text-xs text-zinc-500 uppercase tracking-widest font-bold">Foco em Segurança</div>
              </div>
            </div>
          </div>

          {/* Cards Features & Hours */}
          <div className="lg:col-span-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="bg-zinc-50 border border-zinc-200/80 p-6 rounded-2xl hover:border-primary-500/30 hover:shadow-md transition-all duration-300">
              <div className="w-12 h-12 bg-primary-50 border border-primary-500/20 rounded-xl flex items-center justify-center mb-4 text-primary-600">
                <Award className="w-6 h-6" />
              </div>
              <h4 className="text-lg font-bold text-zinc-900 mb-2">Pista Profissional</h4>
              <p className="text-sm text-zinc-600 leading-relaxed font-light">
                Circuito oficial homologado, áreas de escape gramadas e traçados técnicos dinâmicos.
              </p>
            </div>

            <div className="bg-zinc-50 border border-zinc-200/80 p-6 rounded-2xl hover:border-primary-500/30 hover:shadow-md transition-all duration-300">
              <div className="w-12 h-12 bg-primary-50 border border-primary-500/20 rounded-xl flex items-center justify-center mb-4 text-primary-600">
                <Shield className="w-6 h-6" />
              </div>
              <h4 className="text-lg font-bold text-zinc-900 mb-2">Equipe e Segurança</h4>
              <p className="text-sm text-zinc-600 leading-relaxed font-light">
                Indumentária inclusa, ambulatório com socorrista e fiscais acompanhando todas as baterias.
              </p>
            </div>

            <div className="bg-zinc-50 border border-zinc-200/80 p-6 rounded-2xl hover:border-primary-500/30 transition-all duration-300 sm:col-span-2 space-y-4">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-primary-50 border border-primary-500/20 rounded-xl flex items-center justify-center text-primary-600">
                  <Clock className="w-6 h-6" />
                </div>
                <h4 className="text-lg font-bold text-zinc-900">Horários de Funcionamento</h4>
              </div>
              <div className="space-y-3 pt-2 text-sm text-zinc-600">
                <div className="border-b border-zinc-200/60 pb-2">
                  <div className="flex justify-between font-bold text-zinc-800 mb-1">
                    <span>Terça a Sexta-feira</span>
                    <span className="text-primary-600 font-extrabold">16h às 22h</span>
                  </div>
                  <div className="flex items-center text-xs text-zinc-500">
                    <CheckCircle className="w-3.5 h-3.5 mr-1.5 text-primary-600" />
                    <span>Primeira bateria: 17h00 | Última bateria: 21h40</span>
                  </div>
                </div>

                <div className="border-b border-zinc-200/60 pb-2">
                  <div className="flex justify-between font-bold text-zinc-800 mb-1">
                    <span>Sábado</span>
                    <span className="text-primary-600 font-extrabold">08h às 19h</span>
                  </div>
                  <div className="flex items-center text-xs text-zinc-500">
                    <CheckCircle className="w-3.5 h-3.5 mr-1.5 text-primary-600" />
                    <span>Primeira bateria: 09h15 | Última bateria: 18h35</span>
                  </div>
                </div>

                <div className="border-b border-zinc-200/60 pb-2">
                  <div className="flex justify-between font-bold text-zinc-800 mb-1">
                    <span>Domingo</span>
                    <span className="text-primary-600 font-extrabold">08h às 19h</span>
                  </div>
                  <div className="flex items-center text-xs text-zinc-500">
                    <CheckCircle className="w-3.5 h-3.5 mr-1.5 text-primary-600" />
                    <span>Primeira bateria: 09h15 | Última bateria: 18h00</span>
                  </div>
                </div>

                <div className="flex justify-between font-bold text-red-600/90 text-xs pt-1">
                  <span>Segunda-feira</span>
                  <span>Fechado para manutenção interna</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default About;
