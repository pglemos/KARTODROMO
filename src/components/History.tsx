import { ArrowLeft, Calendar, Award, Users, Compass, Shield, Users2, CheckCircle, Camera } from 'lucide-react';
import SectionHeading from './site-ui/SectionHeading';

const History = () => {
  return (
    <section id="historia" className="border-t border-white/10 bg-ink-950 py-16 text-white/80 md:py-24">
      <div className="container mx-auto px-4">
        <div className="mx-auto mb-8 max-w-4xl">
          <a href="/" className="inline-flex items-center font-race text-sm italic font-bold text-white/60 transition-colors hover:text-primary-400">
            <ArrowLeft className="mr-2 h-5 w-5" />
            Voltar para a página inicial
          </a>
        </div>

        <SectionHeading
          align="center"
          eyebrow="25 anos de kartismo"
          title={
            <>
              Nossa <span className="text-primary-400">História</span>
            </>
          }
        />
        <p className="mx-auto mt-6 max-w-3xl text-center text-lg font-light leading-relaxed text-white/70">
          Mais de 25 anos acelerando corações e construindo o kartismo em Minas Gerais.
        </p>

        <div className="mx-auto mt-16 max-w-4xl space-y-8">
          <div className="border border-white/10 bg-ink-900 p-8">
            <div className="mb-6 flex items-center space-x-4">
              <div className="flex h-12 w-12 items-center justify-center border border-primary-400/30 bg-white/5 text-primary-400">
                <Calendar className="h-6 w-6" />
              </div>
              <h3 className="font-display text-xl italic uppercase tracking-tight text-white">Como Tudo Começou</h3>
            </div>

            <div className="space-y-4 text-sm leading-relaxed font-light text-white/65">
              <p>
                <strong className="font-semibold text-white">Inaugurado em 1996</strong>, o Kartódromo Internacional de Betim foi construído para receber o kartismo mineiro.
                A ideia inicial partiu do então secretário de esportes de Betim, Wesley Silva, em parceria com os governos estadual e municipal, além do suporte estratégico da Fiat Automóveis (instalada no município desde os anos 70).
              </p>
              <p>
                Inicialmente planejado como um complexo esportivo composto por autódromo e kartódromo, o projeto foi readequado devido ao fim do mandato municipal da época.
                Persistente e movido pela paixão por velocidade, Wesley buscou a viabilização do kartódromo por meio da iniciativa privada, captando investidores para tirar o circuito do papel.
              </p>
              <p>
                Dada a complexidade financeira de um autódromo, focou-se em desenvolver uma pista de kart de nível mundial.
                Com a aquisição de um terreno de <strong className="font-semibold text-white">70.000m²</strong>, Wesley iniciou as obras nos anos 90, contando com o apoio essencial de Correia, Clemente Faria, e Ronaldo Praça (histórico incentivador do automobilismo mineiro).
              </p>
            </div>
          </div>

          <div className="border border-white/10 bg-ink-900 p-8">
            <div className="mb-6 flex items-center space-x-4">
              <div className="flex h-12 w-12 items-center justify-center border border-primary-400/30 bg-white/5 text-primary-400">
                <Award className="h-6 w-6" />
              </div>
              <h3 className="font-display text-xl italic uppercase tracking-tight text-white">A Inauguração</h3>
            </div>

            <div className="space-y-4 text-sm leading-relaxed font-light text-white/65">
              <p>
                Em 1996, após dois anos intensos de construção, era inaugurado o <strong className="font-semibold text-white">Kartódromo Toninho da Matta</strong>, batizado em tributo ao piloto mineiro Toninho da Matta, 14 vezes campeão brasileiro de turismo.
                Anos mais tarde, seu filho Cristiano da Matta se consagraria campeão da Fórmula CART (Indy) e correria na Fórmula 1.
              </p>
              <p>
                A pista logo se tornou o coração do kartismo regional. Sediou duas edições históricas do <strong className="font-semibold text-white">Campeonato Brasileiro de Kart</strong> (1997 e 2001), servindo como passarela e berço para pilotos de calibre mundial, como <strong className="text-white">Nelsinho Piquet, Cristiano da Matta, Bruno Junqueira, Bia Figueiredo, Danilo Dirani</strong>, entre outros.
              </p>
            </div>
          </div>

          <div className="border border-white/10 bg-ink-900 p-8">
            <div className="mb-6 flex items-center space-x-4">
              <div className="flex h-12 w-12 items-center justify-center border border-primary-400/30 bg-white/5 text-primary-400">
                <Users className="h-6 w-6" />
              </div>
              <h3 className="font-display text-xl italic uppercase tracking-tight text-white">Evolução e Modernização</h3>
            </div>

            <div className="space-y-4 text-sm leading-relaxed font-light text-white/65">
              <p>
                No ano de <strong className="font-semibold text-white">2007</strong>, o circuito foi adquirido pelo empresário Antônio da Silveira (Toninho da Prata) e passou a se chamar <strong className="font-semibold text-white">Kartódromo Internacional de Betim</strong>.
                A gestão familiar iniciou um amplo plano de modernização, expandindo as opções de traçados na pista e renovando a infraestrutura de boxes e recepção.
              </p>
              <p>
                A partir de <strong className="font-semibold text-white">2018</strong>, novos investimentos foram injetados em melhorias de frota, sistemas eletrônicos de cronometragem eletrônica em tempo real e ampliação da área gourmet, focando no bem-estar total dos clientes e no fomento do automobilismo amador e profissional.
              </p>
            </div>
          </div>

          <div className="border border-primary-400/20 bg-ink-900 p-8">
            <h3 className="mb-6 text-center font-race text-lg italic font-bold uppercase tracking-wider text-white">Ficha Técnica do Complexo</h3>

            <div className="grid grid-cols-1 gap-x-8 gap-y-4 text-sm font-light text-white/65 md:grid-cols-2">
              <div className="space-y-3">
                <div className="flex items-center space-x-2.5">
                  <Compass className="h-4 w-4 flex-shrink-0 text-primary-400" />
                  <span>Extensão da pista: 1.110 metros de comprimento</span>
                </div>
                <div className="flex items-center space-x-2.5">
                  <Award className="h-4 w-4 flex-shrink-0 text-primary-400" />
                  <span>Largura constante do circuito: 8 metros</span>
                </div>
                <div className="flex items-center space-x-2.5">
                  <Shield className="h-4 w-4 flex-shrink-0 text-primary-400" />
                  <span>Segurança: Áreas de escape de 10 metros gramadas</span>
                </div>
                <div className="flex items-center space-x-2.5">
                  <Users2 className="h-4 w-4 flex-shrink-0 text-primary-400" />
                  <span>Capacidade máxima de grid: 35 karts simultâneos</span>
                </div>
                <div className="flex items-center space-x-2.5">
                  <CheckCircle className="h-4 w-4 flex-shrink-0 text-primary-400" />
                  <span>Frota de Kart Light: 60 unidades Honda GX390</span>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center space-x-2.5">
                  <CheckCircle className="h-4 w-4 flex-shrink-0 text-primary-400" />
                  <span>Ambulatório e equipe de socorristas no local</span>
                </div>
                <div className="flex items-center space-x-2.5">
                  <CheckCircle className="h-4 w-4 flex-shrink-0 text-primary-400" />
                  <span>Painel digital de cronometragem eletrônica</span>
                </div>
                <div className="flex items-center space-x-2.5">
                  <CheckCircle className="h-4 w-4 flex-shrink-0 text-primary-400" />
                  <span>Espaço de eventos com buffet para até 150 convidados</span>
                </div>
                <div className="flex items-center space-x-2.5">
                  <CheckCircle className="h-4 w-4 flex-shrink-0 text-primary-400" />
                  <span>Acessibilidade para cadeirantes (karts adaptados)</span>
                </div>
                <div className="flex items-center space-x-2.5">
                  <CheckCircle className="h-4 w-4 flex-shrink-0 text-primary-400" />
                  <span>Sala de briefing climatizada com capacidade para 40 pessoas</span>
                </div>
              </div>
            </div>
          </div>

          <div className="border border-white/10 bg-ink-900 p-8">
            <h3 className="mb-6 text-center font-race text-lg italic font-bold uppercase tracking-wider text-white">Imagens Históricas</h3>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              {[
                { url: '/history/1.jpg', alt: 'Vista do Circuito' },
                { url: '/history/2.jpg', alt: 'Pilotos em Bateria' },
                { url: '/history/3.jpg', alt: 'Complexo Betim' },
                { url: '/history/4.jpg', alt: 'Convivência' },
                { url: '/history/5.jpg', alt: 'Vista Aérea' },
              ].map((img) => (
                <div key={img.url} className="group relative h-36 overflow-hidden border border-white/10 bg-ink-950">
                  <img
                    src={img.url}
                    alt={img.alt}
                    loading="lazy"
                    className="h-full w-full object-cover brightness-[0.8] transition-transform duration-500 group-hover:scale-105 group-hover:brightness-100"
                  />
                  <div className="absolute inset-0 flex items-end justify-center bg-gradient-to-t from-ink-950/90 via-ink-950/20 to-transparent p-2.5 opacity-0 transition-opacity group-hover:opacity-100">
                    <span className="font-race text-[10px] italic font-bold uppercase tracking-wider text-white">{img.alt}</span>
                  </div>
                </div>
              ))}
              <div className="flex h-36 items-center justify-center border border-dashed border-white/15 bg-ink-950 p-4">
                <div className="text-center">
                  <Camera className="mx-auto mb-1.5 h-7 w-7 text-white/30" aria-hidden="true" />
                  <p className="font-race text-[10px] italic font-bold uppercase tracking-widest text-white/40">Mais fotos em breve</p>
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
