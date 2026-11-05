import {
  PageHero,
  Stats,
  CallToAction,
  TextLink,
  Breadcrumb,
} from "../components/UI.jsx";
export default function History() {
  return (
    <>
      <div className="container">
        <Breadcrumb current="Nossa história" />
      </div>
      <PageHero
        title="A paixão vem"
        accent="de muitas voltas."
        description="Desde 1996, uma história construída por quem ama a velocidade. Conheça o circuito que ajudou a formar o kartismo em Minas Gerais."
        image="history"
      />
      <Stats
        items={[
          ["1996", "inauguração do circuito"],
          ["1997 e 2001", "Campeonato Brasileiro de Kart"],
          ["1.110 m", "de histórias na pista"],
        ]}
      />
      <section className="container section history-intro">
        <div>
          <span className="section-label">
            Kartódromo Internacional de Betim
          </span>
          <h2>
            Uma ideia.
            <br />
            Uma pista.
            <br />
            <em>Muitas gerações.</em>
          </h2>
        </div>
        <div className="prose">
          <p>
            A ideia de construir um circuito em Betim partiu de Wesley Silva,
            então secretário de esportes do município. Com apoio dos governos
            estadual e municipal, da Fiat e de investidores, o projeto ganhou
            forma em um terreno de 70.000 m².
          </p>
          <p>
            Depois de dois anos de obras, em 1996 era inaugurado o Kartódromo
            Toninho da Matta, em homenagem ao piloto mineiro. A pista se tornou
            um ponto de encontro do kartismo e sediou edições do Campeonato
            Brasileiro em 1997 e 2001.
          </p>
          <p>
            Ao longo dessa trajetória, o circuito recebeu pilotos como Nelsinho
            Piquet, Cristiano da Matta, Bruno Junqueira, Bia Figueiredo e Danilo
            Dirani.
          </p>
        </div>
      </section>
      <section className="container history-timeline">
        {[
          [
            "1996",
            "A primeira bandeirada",
            "Inauguração do Kartódromo Toninho da Matta. O circuito passa a receber o kartismo mineiro.",
          ],
          [
            "1997 · 2001",
            "Palco do Brasileiro",
            "Duas edições do Campeonato Brasileiro de Kart marcam a trajetória do circuito.",
          ],
          [
            "2007",
            "Um novo capítulo",
            "Antônio da Silveira, o Toninho da Prata, adquire o circuito. Nasce o Kartódromo Internacional de Betim, com gestão familiar e um plano de modernização.",
          ],
          [
            "2018",
            "Evolução constante",
            "Novos investimentos na frota, na cronometragem eletrônica e no espaço gourmet ampliam a experiência dos pilotos e visitantes.",
          ],
        ].map(([year, title, text]) => (
          <article key={year}>
            <strong>{year}</strong>
            <div>
              <h3>{title}</h3>
              <p>{text}</p>
            </div>
          </article>
        ))}
      </section>
      <section className="container section track-feature">
        <div>
          <h2>
            O próximo capítulo
            <br />
            pode ser <em>seu.</em>
          </h2>
          <p>
            Do kart de locação às provas de endurance, a pista segue conectando
            pessoas à paixão pela velocidade.
          </p>
          <TextLink to="/pista">Conhecer o circuito</TextLink>
        </div>
        <img
          className="history-photo"
          src="/media/aerial.webp"
          alt="Vista aérea do kartódromo"
          loading="lazy"
        />
      </section>
      <CallToAction />
    </>
  );
}
