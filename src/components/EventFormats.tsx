import SectionHeading from './site-ui/SectionHeading';
import PosterCard from './site-ui/PosterCard';

const formats = [
  {
    number: '01',
    image: '/gallery/action-1.png',
    alt: 'Pilotos disputando posição na pista do Kartódromo de Betim',
    title: 'Aniversariante',
    description: 'Traga 10 amigos pagantes e sua bateria de aniversário sai por preço especial, com pódio e fotos pra lembrar.',
    ctaLabel: 'Agendar aniversário',
    href: 'https://wa.me/553135112373?text=Ol%C3%A1!%20Gostaria%20de%20agendar%20minha%20corrida%20de%20aniversariante%20do%20m%C3%AAs.',
  },
  {
    number: '02',
    image: '/gallery/kart-grid.png',
    alt: 'Grid de karts alinhados para a largada',
    title: 'Grupo de Amigos',
    description: 'Compra coletiva com pagamento único: a turma corre por um preço fixo por pessoa, com desconto garantido.',
    ctaLabel: 'Montar grupo',
    href: 'https://wa.me/553135112373?text=Ol%C3%A1!%20Gostaria%20de%20solicitar%20a%20promo%C3%A7%C3%A3o%20de%20compra%20coletiva%20para%20meu%20grupo.',
  },
  {
    number: '03',
    image: '/gallery/finish-flag.png',
    alt: 'Bandeira quadriculada na chegada de uma corrida',
    title: 'Evento Corporativo',
    description: 'Integração, adrenalina e networking em um ambiente fora do convencional, com espaço para até 150 convidados.',
    ctaLabel: 'Falar com especialista',
    href: '/eventos',
  },
];

const EventFormats = () => {
  return (
    <section className="border-t border-white/10 bg-ink-950 py-16 md:py-24">
      <div className="container mx-auto px-4">
        <SectionHeading
          eyebrow="Escolha seu formato"
          title={
            <>
              Opções para grupos
              <br />
              <span className="text-primary-400">e comemorações</span>
            </>
          }
        />

        <div className="mt-14 grid grid-cols-1 gap-5 md:grid-cols-3">
          {formats.map((format) => (
            <PosterCard key={format.title} {...format} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default EventFormats;
