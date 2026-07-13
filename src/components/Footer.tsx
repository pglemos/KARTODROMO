import { Phone, Mail, MapPin, Clock, Users as Facebook, Camera as Instagram, Video as Youtube } from 'lucide-react';

const quickLinks = [
  { href: '/#home', label: 'Home' },
  { href: '/#sobre', label: 'Sobre' },
  { href: '/#servicos', label: 'Modalidades' },
  { href: '/#promocoes', label: 'Promoções' },
  { href: '/pista', label: 'A Pista' },
  { href: '/kart-locacao', label: 'Locação' },
  { href: '/campeonatos', label: 'Campeonatos' },
  { href: '/eventos', label: 'Eventos' },
  { href: '/duvidas', label: 'Dúvidas' },
  { href: '/#contato', label: 'Contato' },
];

const Footer = () => {
  return (
    <footer className="border-t border-white/10 bg-ink-900 py-16 text-white/70">
      <div className="container mx-auto px-4">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-12 md:grid-cols-4">
          <div className="col-span-1 space-y-6 md:col-span-2">
            <img src="/brand/kib-logo.png" alt="Logo Kartódromo de Betim" className="h-10 w-auto" />
            <p className="max-w-md text-sm font-light leading-relaxed text-white/60">
              Pista homologada de 1.110 metros, kart de locação, campeonatos e estrutura para eventos em Betim.
            </p>
            <div className="flex space-x-3 pt-2">
              <a href="https://www.facebook.com/kartodromodebetim" target="_blank" rel="noopener noreferrer" aria-label="Facebook do Kartódromo de Betim" className="flex h-10 w-10 items-center justify-center border border-white/15 bg-white/5 text-white/70 transition-all hover:border-primary-400 hover:text-primary-400">
                <Facebook className="h-5 w-5" />
              </a>
              <a href="https://www.instagram.com/kartodromobetim/" target="_blank" rel="noopener noreferrer" aria-label="Instagram do Kartódromo de Betim" className="flex h-10 w-10 items-center justify-center border border-white/15 bg-white/5 text-white/70 transition-all hover:border-primary-400 hover:text-primary-400">
                <Instagram className="h-5 w-5" />
              </a>
              <a href="https://www.youtube.com/kartodromodebetim31" target="_blank" rel="noopener noreferrer" aria-label="YouTube do Kartódromo de Betim" className="flex h-10 w-10 items-center justify-center border border-white/15 bg-white/5 text-white/70 transition-all hover:border-primary-400 hover:text-primary-400">
                <Youtube className="h-5 w-5" />
              </a>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="font-race text-sm italic font-bold uppercase tracking-wider text-white">Canais de Contato</h4>
            <div className="space-y-3 text-xs font-light">
              <div className="flex items-center space-x-2.5">
                <Mail className="h-4 w-4 flex-shrink-0 text-primary-400" />
                <a href="mailto:contato@kartodromodebetim.com.br" className="text-white/70 transition-colors hover:text-primary-400">
                  contato@kartodromodebetim.com.br
                </a>
              </div>
              <div className="flex items-center space-x-2.5">
                <Phone className="h-4 w-4 flex-shrink-0 text-primary-400" />
                <a href="tel:+553135112373" className="text-white/70 transition-colors hover:text-primary-400">(31) 3511-2373</a>
              </div>
              <div className="flex items-center space-x-2.5">
                <Phone className="h-4 w-4 flex-shrink-0 text-primary-400" />
                <a href="https://wa.me/5531998842898" target="_blank" rel="noopener noreferrer" className="text-white/70 transition-colors hover:text-primary-400">
                  (31) 99884-2898
                </a>
              </div>
              <div className="flex items-start space-x-2.5 text-white/70">
                <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary-400" />
                <span>Av. Adutora Várzea das Flores, 477 - Itacolomi, Betim - MG, 32672-586</span>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="font-race text-sm italic font-bold uppercase tracking-wider text-white">Horários da Pista</h4>
            <div className="flex items-start space-x-2.5 text-xs font-light text-white/70">
              <Clock className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary-400" />
              <div>
                <p className="font-semibold text-white">Terça a Sexta-feira</p>
                <p className="text-white/60">16h00 às 22h00</p>
                <p className="mt-2 font-semibold text-white">Sábado e Domingo</p>
                <p className="text-white/60">08h00 às 19h00</p>
                <p className="mt-2 font-semibold text-red-400">Segunda-feira</p>
                <p className="text-white/60">Fechado para manutenção</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-12 border-t border-white/10 pt-8">
          <div className="flex flex-wrap justify-center gap-x-8 gap-y-3 font-race text-xs italic font-bold uppercase tracking-wider">
            {quickLinks.map((link) => (
              <a key={link.href} href={link.href} className="text-white/60 transition-colors hover:text-primary-400">
                {link.label}
              </a>
            ))}
          </div>
        </div>

        <div className="mt-8 border-t border-white/10 pt-8 text-center text-xs font-light text-white/50">
          <p>© {new Date().getFullYear()} Kartódromo Internacional de Betim. Todos os direitos reservados.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
