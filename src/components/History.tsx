import { ArrowLeft, Calendar, Award, Users, Compass, Shield, Users2, CheckCircle, Camera } from 'lucide-react';

const History = () => {
  return (
    <section id="historia" className="py-24 bg-white min-h-screen text-zinc-700">
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
          <h1 className="text-3xl md:text-5xl font-black text-zinc-950 mb-4 uppercase tracking-tight">
            Nossa <span className="text-primary-600">História</span>
          </h1>
          <div className="w-20 h-1.5 bg-primary-500 mx-auto rounded-full mb-6"></div>
          <p className="text-lg text-zinc-600 max-w-3xl mx-auto font-light leading-relaxed">
            Mais de 25 anos acelerando corações e construindo o kartismo em Minas Gerais.
          </p>
        </div>

        <div className="max-w-4xl mx-auto space-y-8">
          {/* Como Tudo Começou */}
          <div className="bg-zinc-50 border border-zinc-200 rounded-3xl p-8 shadow-sm">
            <div className="flex items-center space-x-4 mb-6">
              <div className="w-12 h-12 bg-primary-50 border border-primary-500/20 rounded-xl flex items-center justify-center text-primary-600">
                <Calendar className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-zinc-900 uppercase tracking-tight">Como Tudo Começou</h3>
            </div>
            
            <div className="space-y-4 text-zinc-600 text-sm leading-relaxed font-light">
              <p>
                <strong className="text-zinc-900 font-semibold">Inaugurado em 1996</strong>, o Kartódromo Internacional de Betim foi construído para receber o kartismo mineiro.
                A ideia inicial partiu do então secretário de esportes de Betim, Wesley Silva, em parceria com os governos estadual e municipal, além do suporte estratégico da Fiat Automóveis (instalada no município desde os anos 70).
              </p>
              <p>
                Inicialmente planejado como um complexo esportivo composto por autódromo e kartódromo, o projeto foi readequado devido ao fim do mandato municipal da época. 
                Persistente e movido pela paixão por velocidade, Wesley buscou a viabilização do kartódromo por meio da iniciativa privada, captando investidores para tirar o circuito do papel.
              </p>
              <p>
                Dada a complexidade financeira de um autódromo, focou-se em desenvolver uma pista de kart de nível mundial. 
                Com a aquisição de um terreno de <strong className="text-zinc-900 font-semibold">70.000m²</strong>, Wesley iniciou as obras nos anos 90, contando com o apoio essencial de Correia, Clemente Faria, e Ronaldo Praça (histórico incentivador do automobilismo mineiro).
              </p>
            </div>
          </div>

          {/* A Inauguração */}
          <div className="bg-zinc-50 border border-zinc-200 rounded-3xl p-8 shadow-sm">
            <div className="flex items-center space-x-4 mb-6">
              <div className="w-12 h-12 bg-primary-50 border border-primary-500/20 rounded-xl flex items-center justify-center text-primary-600">
                <Award className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-zinc-900 uppercase tracking-tight">A Inauguração</h3>
            </div>
            
            <div className="space-y-4 text-zinc-600 text-sm leading-relaxed font-light">
              <p>
                Em 1996, após dois anos intensos de construção, era inaugurado o <strong className="text-zinc-900 font-semibold">Kartódromo Toninho da Matta</strong>, batizado em tributo ao piloto mineiro Toninho da Matta, 14 vezes campeão brasileiro de turismo. 
                Anos mais tarde, seu filho Cristiano da Matta se consagraria campeão da Fórmula CART (Indy) e correria na Fórmula 1.
              </p>
              <p>
                A pista logo se tornou o coração do kartismo regional. Sediou duas edições históricas do <strong className="text-zinc-900 font-semibold">Campeonato Brasileiro de Kart</strong> (1997 e 2001), servindo como passarela e berço para pilotos de calibre mundial, como <strong className="text-zinc-900">Nelsinho Piquet, Cristiano da Matta, Bruno Junqueira, Bia Figueiredo, Danilo Dirani</strong>, entre outros.
              </p>
            </div>
          </div>

          {/* Mudanças */}
          <div className="bg-zinc-50 border border-zinc-200 rounded-3xl p-8 shadow-sm">
            <div className="flex items-center space-x-4 mb-6">
              <div className="w-12 h-12 bg-primary-50 border border-primary-500/20 rounded-xl flex items-center justify-center text-primary-600">
                <Users className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-zinc-900 uppercase tracking-tight">Evolução e Modernização</h3>
            </div>
            
            <div className="space-y-4 text-zinc-600 text-sm leading-relaxed font-light">
              <p>
                No ano de <strong className="text-zinc-900 font-semibold">2007</strong>, o circuito foi adquirido pelo empresário Antônio da Silveira (Toninho da Prata) e passou a se chamar <strong className="text-zinc-900 font-semibold">Kartódromo Internacional de Betim</strong>. 
                A gestão familiar iniciou um amplo plano de modernização, expandindo as opções de traçados na pista e renovando a infraestrutura de boxes e recepção.
              </p>
              <p>
                A partir de <strong className="text-zinc-900 font-semibold">2018</strong>, novos investimentos foram injetados em melhorias de frota, sistemas eletrônicos de cronometragem eletrônica em tempo real e ampliação da área gourmet, focando no bem-estar total dos clientes e no fomento do automobilismo amador e profissional.
              </p>
            </div>
          </div>

          {/* Especificações Técnicas */}
          <div className="bg-gradient-to-r from-primary-50/50 via-zinc-50 to-primary-50/50 border border-primary-500/20 rounded-3xl p-8 shadow-sm">
            <h3 className="text-xl font-bold text-zinc-900 uppercase tracking-wider mb-6 text-center">Ficha Técnica do Complexo</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 text-sm text-zinc-600 font-light">
              <div className="space-y-3">
                <div className="flex items-center space-x-2.5">
                  <Compass className="w-4 h-4 text-primary-600 flex-shrink-0" />
                  <span>Extensão da pista: 1.110 metros de comprimento</span>
                </div>
                <div className="flex items-center space-x-2.5">
                  <Award className="w-4 h-4 text-primary-600 flex-shrink-0" />
                  <span>Largura constante do circuito: 8 metros</span>
                </div>
                <div className="flex items-center space-x-2.5">
                  <Shield className="w-4 h-4 text-primary-600 flex-shrink-0" />
                  <span>Segurança: Áreas de escape de 10 metros gramadas</span>
                </div>
                <div className="flex items-center space-x-2.5">
                  <Users2 className="w-4 h-4 text-primary-600 flex-shrink-0" />
                  <span>Capacidade máxima de grid: 35 karts simultâneos</span>
                </div>
                <div className="flex items-center space-x-2.5">
                  <CheckCircle className="w-4 h-4 text-primary-600 flex-shrink-0" />
                  <span>Frota de Kart Light: 60 unidades Honda GX390</span>
                </div>
              </div>
              
              <div className="space-y-3">
                <div className="flex items-center space-x-2.5">
                  <CheckCircle className="w-4 h-4 text-primary-600 flex-shrink-0" />
                  <span>Ambulatório e equipe de socorristas no local</span>
                </div>
                <div className="flex items-center space-x-2.5">
                  <CheckCircle className="w-4 h-4 text-primary-600 flex-shrink-0" />
                  <span>Painel digital de cronometragem eletrônica</span>
                </div>
                <div className="flex items-center space-x-2.5">
                  <CheckCircle className="w-4 h-4 text-primary-600 flex-shrink-0" />
                  <span>Espaço de eventos com buffet para até 150 convidados</span>
                </div>
                <div className="flex items-center space-x-2.5">
                  <CheckCircle className="w-4 h-4 text-primary-600 flex-shrink-0" />
                  <span>Acessibilidade para cadeirantes (karts adaptados)</span>
                </div>
                <div className="flex items-center space-x-2.5">
                  <CheckCircle className="w-4 h-4 text-primary-600 flex-shrink-0" />
                  <span>Sala de briefing climatizada com capacidade para 40 pessoas</span>
                </div>
              </div>
            </div>
          </div>

          {/* Galeria de Fotos */}
          <div className="bg-zinc-50 border border-zinc-200 rounded-3xl p-8 shadow-sm">
            <h3 className="text-xl font-bold text-zinc-950 uppercase tracking-wider mb-6 text-center">Imagens Históricas</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {[
                { url: "/history/1.jpg", alt: "Vista do Circuito" },
                { url: "/history/2.jpg", alt: "Pilotos em Bateria" },
                { url: "/history/3.jpg", alt: "Complexo Betim" },
                { url: "/history/4.jpg", alt: "Convivência" },
                { url: "/history/5.jpg", alt: "Vista Aérea" }
              ].map((img, index) => (
                <div key={index} className="relative rounded-xl overflow-hidden group h-36 bg-white border border-zinc-200">
                  <img
                    src={img.url}
                    alt={img.alt}
                    loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2.5 justify-center">
                    <span className="text-[10px] font-bold text-white uppercase tracking-wider">{img.alt}</span>
                  </div>
                </div>
              ))}
              <div className="border border-dashed border-zinc-300 rounded-xl flex items-center justify-center p-4 h-36 bg-white">
                <div className="text-center">
                  <Camera className="mx-auto mb-1.5 h-7 w-7 text-zinc-400" aria-hidden="true" />
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Mais fotos em breve</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default History;
