import { useState } from 'react';
import { Menu, X, Phone, MapPin, Clock } from 'lucide-react';
import { SITE_BOOKING_ANCHOR } from '../config/booking';
import { FacebookIcon, InstagramIcon, YoutubeIcon } from './site-ui/SocialIcons';

const navLinks = [
  { href: '/#home', label: 'Home' },
  { href: '/#sobre', label: 'Sobre' },
  { href: '/#servicos', label: 'Modalidades' },
  { href: '/#promocoes', label: 'Promoções' },
  { href: '/pista', label: 'A Pista' },
  { href: '/kart-locacao', label: 'Locação' },
  { href: SITE_BOOKING_ANCHOR, label: 'Reservas Online' },
  { href: '/campeonatos', label: 'Campeonatos' },
  { href: '/eventos', label: 'Eventos' },
  { href: '/clube-vantagens', label: 'Benefícios', featured: true },
  { href: '/duvidas', label: 'Dúvidas' },
  { href: '/#contato', label: 'Contato' },
];

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <>
      {/* Top Bar */}
      <div className="border-b border-white/10 bg-ink-900 px-4 py-3 text-white">
        <div className="container mx-auto flex flex-wrap items-center justify-between gap-x-7 gap-y-2.5 font-race text-[13px] italic leading-none md:text-sm">
          <div className="flex flex-wrap items-center gap-x-7 gap-y-2.5">
            <a href="tel:+553135112373" className="flex items-center space-x-2 text-white transition-colors hover:text-primary-400">
              <Phone className="h-[18px] w-[18px] text-primary-400" />
              <span className="font-bold not-italic">(31) 3511-2373</span>
            </a>
            <div className="flex items-center space-x-2 text-white/80">
              <MapPin className="h-[18px] w-[18px] text-primary-400" />
              <span className="md:hidden">Betim - MG</span>
              <span className="hidden md:inline">Av. Adutora Várzea das Flores, 477 - Betim, MG</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2.5">
            <div className="flex items-center space-x-2 text-white/80">
              <Clock className="h-[18px] w-[18px] text-primary-400" />
              <span className="hidden lg:inline">Funcionamento:</span>
              <span className="font-semibold">Ter-Sex: 16h-22h | Sáb-Dom: 08h-19h</span>
            </div>
            <div className="ml-2 hidden space-x-4 border-l border-white/15 pl-5 lg:flex">
              <a href="https://www.facebook.com/kartodromodebetim" target="_blank" rel="noopener noreferrer" aria-label="Facebook do Kartódromo de Betim" className="text-white/70 transition-colors hover:text-primary-400">
                <FacebookIcon className="h-[18px] w-[18px]" />
              </a>
              <a href="https://www.instagram.com/kartodromobetim/" target="_blank" rel="noopener noreferrer" aria-label="Instagram do Kartódromo de Betim" className="text-white/70 transition-colors hover:text-primary-400">
                <InstagramIcon className="h-[18px] w-[18px]" />
              </a>
              <a href="https://www.youtube.com/kartodromodebetim31" target="_blank" rel="noopener noreferrer" aria-label="YouTube do Kartódromo de Betim" className="text-white/70 transition-colors hover:text-primary-400">
                <YoutubeIcon className="h-[18px] w-[18px]" />
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Main Header */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-ink-950/90 backdrop-blur-xl">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between py-4">
            <a href="/" className="flex items-center">
              <img
                src="/brand/kib-logo.png"
                alt="Logo Kartódromo de Betim"
                className="h-12 w-auto drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)]"
              />
            </a>

            <nav aria-label="Navegação principal" className="hidden items-center gap-4 font-race text-[11px] italic font-bold uppercase tracking-wide lg:flex xl:gap-6 xl:text-xs">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className={link.featured
                    ? 'relative inline-flex min-h-9 items-center border border-primary-400/60 bg-primary-400/10 px-4 text-primary-300 [clip-path:polygon(9px_0,100%_0,calc(100%_-_9px)_100%,0_100%)] transition-[color,background-color,transform,box-shadow] duration-200 after:ml-2 after:h-1.5 after:w-1.5 after:rotate-45 after:bg-current after:shadow-[0_0_10px_currentColor] hover:-translate-y-0.5 hover:bg-primary-400 hover:text-ink-950 hover:shadow-[0_10px_28px_rgba(0,230,118,.24)]'
                    : 'relative py-1 text-white/80 transition-colors after:absolute after:inset-x-0 after:bottom-0 after:h-[2px] after:origin-left after:scale-x-0 after:bg-primary-400 after:transition-transform after:duration-200 hover:text-white hover:after:scale-x-100'}
                >
                  {link.label}
                </a>
              ))}
            </nav>

            <button
              className="p-1.5 text-white transition-colors hover:text-primary-400 focus:outline-none lg:hidden"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              aria-label="Alternar Menu"
              aria-expanded={isMenuOpen}
              aria-controls="mobile-navigation"
            >
              {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>

          {isMenuOpen && (
            <div id="mobile-navigation" className="border-t border-white/10 pb-6 pt-2 lg:hidden">
              <nav className="flex flex-col space-y-1 font-display text-2xl italic uppercase">
                {navLinks.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    onClick={() => setIsMenuOpen(false)}
                    className={link.featured
                      ? 'mt-2 flex items-center justify-between border border-primary-400/60 bg-primary-400/10 px-5 py-4 text-primary-300 [clip-path:polygon(12px_0,100%_0,calc(100%_-_12px)_100%,0_100%)] after:text-sm after:content-["◆"] hover:bg-primary-400 hover:text-ink-950'
                      : 'border-b border-white/10 py-3 text-white transition-colors hover:text-primary-400'}
                  >
                    {link.label}
                  </a>
                ))}
              </nav>
            </div>
          )}
        </div>
      </header>
    </>
  );
};

export default Header;
