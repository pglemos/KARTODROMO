import { useState } from 'react';
import { Menu, X, Phone, MapPin, Clock, Facebook, Instagram, Youtube } from 'lucide-react';
import { SITE_BOOKING_ANCHOR } from '../config/booking';

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <>
      {/* Top Bar */}
      <div className="border-b border-white/15 bg-[#087f67] px-4 py-3 text-white shadow-sm">
        <div className="container mx-auto flex flex-wrap items-center justify-between gap-x-7 gap-y-2.5 text-[13px] leading-none md:text-sm">
          <div className="flex flex-wrap items-center gap-x-7 gap-y-2.5">
            <a href="tel:+553135112373" className="flex items-center space-x-2 text-white transition-colors hover:text-white/75">
              <Phone className="h-[18px] w-[18px] text-white" />
              <span className="font-semibold">(31) 3511-2373</span>
            </a>
            <div className="flex items-center space-x-2 text-white/95">
              <MapPin className="h-[18px] w-[18px] text-white" />
              <span className="md:hidden">Betim - MG</span>
              <span className="hidden md:inline">Av. Adutora Várzea das Flores, 477 - Betim, MG</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2.5">
            <div className="flex items-center space-x-2 text-white/95">
              <Clock className="h-[18px] w-[18px] text-white" />
              <span className="hidden lg:inline">Funcionamento:</span>
              <span className="font-medium">Ter-Sex: 16h-22h | Sáb-Dom: 08h-19h</span>
            </div>
            <div className="ml-2 hidden space-x-4 border-l border-white/25 pl-5 lg:flex">
              <a href="https://www.facebook.com/kartodromodebetim" target="_blank" rel="noopener noreferrer" aria-label="Facebook do Kartódromo de Betim" className="text-white/80 transition-colors hover:text-white">
                <Facebook className="h-[18px] w-[18px]" />
              </a>
              <a href="https://www.instagram.com/kartodromobetim/" target="_blank" rel="noopener noreferrer" aria-label="Instagram do Kartódromo de Betim" className="text-white/80 transition-colors hover:text-white">
                <Instagram className="h-[18px] w-[18px]" />
              </a>
              <a href="https://www.youtube.com/kartodromodebetim31" target="_blank" rel="noopener noreferrer" aria-label="YouTube do Kartódromo de Betim" className="text-white/80 transition-colors hover:text-white">
                <Youtube className="h-[18px] w-[18px]" />
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Main Header */}
      <header className="sticky top-0 z-50 border-b border-zinc-200/80 bg-white shadow-sm">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-center py-4">
            {/* Logo */}
            <a href="/" className="flex items-center">
              <img
                src="/brand/kib-logo.png"
                alt="Logo Kartódromo de Betim"
                className="h-12 w-auto filter brightness-100 drop-shadow-[0_2px_4px_rgba(0,0,0,0.05)]"
              />
            </a>

            {/* Desktop Menu */}
            <nav className="hidden lg:flex items-center gap-4 xl:gap-6 text-xs xl:text-sm font-bold tracking-wide">
              <a href="/#home" className="text-zinc-700 hover:text-primary-600 transition-colors py-1">Home</a>
              <a href="/#sobre" className="text-zinc-700 hover:text-primary-600 transition-colors py-1">Sobre</a>
              <a href="/#servicos" className="text-zinc-700 hover:text-primary-600 transition-colors py-1">Modalidades</a>
              <a href="/#promocoes" className="text-zinc-700 hover:text-primary-600 transition-colors py-1 flex items-center">
                <span className="w-1.5 h-1.5 bg-yellow-500 rounded-full mr-1.5 animate-pulse"></span>
                Promoções
              </a>
              <a href="/pista" className="text-zinc-700 hover:text-primary-600 transition-colors py-1">A Pista</a>
              <a href="/kart-locacao" className="text-zinc-700 hover:text-primary-600 transition-colors py-1">Locação</a>
              <a 
                href={SITE_BOOKING_ANCHOR}
                className="text-zinc-700 hover:text-primary-600 transition-colors py-1 flex items-center"
              >
                <span className="w-1.5 h-1.5 bg-yellow-500 rounded-full mr-1.5 animate-pulse"></span>
                Reservas Online
              </a>
              <a href="/campeonatos" className="text-zinc-700 hover:text-primary-600 transition-colors py-1 flex items-center">
                <span className="w-1.5 h-1.5 bg-primary-500 rounded-full mr-1.5 animate-pulse"></span>
                Campeonatos
              </a>
              <a href="/eventos" className="text-zinc-700 hover:text-primary-600 transition-colors py-1">Eventos</a>
              <a href="/duvidas" className="text-zinc-700 hover:text-primary-600 transition-colors py-1">Dúvidas</a>
              <a href="/#contato" className="text-zinc-700 hover:text-primary-600 transition-colors py-1">Contato</a>
            </nav>

            {/* Mobile Menu Button */}
            <button
              className="lg:hidden text-zinc-700 hover:text-primary-600 transition-colors focus:outline-none p-1.5"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              aria-label="Alternar Menu"
              aria-expanded={isMenuOpen}
              aria-controls="mobile-navigation"
            >
              {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>

          {/* Mobile Menu */}
          {isMenuOpen && (
            <div id="mobile-navigation" className="lg:hidden pb-6 pt-2 border-t border-zinc-200/80 animate-fadeIn">
              <nav className="flex flex-col space-y-3 text-base font-semibold">
                <a href="/#home" onClick={() => setIsMenuOpen(false)} className="text-zinc-700 hover:text-primary-600 py-1 transition-colors">Home</a>
                <a href="/#sobre" onClick={() => setIsMenuOpen(false)} className="text-zinc-700 hover:text-primary-600 py-1 transition-colors">Sobre</a>
                <a href="/#servicos" onClick={() => setIsMenuOpen(false)} className="text-zinc-700 hover:text-primary-600 py-1 transition-colors">Modalidades</a>
                <a href="/#promocoes" onClick={() => setIsMenuOpen(false)} className="text-zinc-700 hover:text-primary-600 py-1 transition-colors flex items-center">
                  <span className="w-2 h-2 bg-yellow-500 rounded-full mr-2"></span>
                  Promoções
                </a>
                <a href="/pista" onClick={() => setIsMenuOpen(false)} className="text-zinc-700 hover:text-primary-600 py-1 transition-colors">A Pista</a>
                <a href="/kart-locacao" onClick={() => setIsMenuOpen(false)} className="text-zinc-700 hover:text-primary-600 py-1 transition-colors">Locação</a>
                <a 
                  href={SITE_BOOKING_ANCHOR}
                  onClick={() => setIsMenuOpen(false)} 
                  className="text-zinc-700 hover:text-primary-600 py-1 transition-colors flex items-center"
                >
                  <span className="w-2 h-2 bg-yellow-500 rounded-full mr-2"></span>
                  Reservas Online
                </a>
                <a href="/campeonatos" onClick={() => setIsMenuOpen(false)} className="text-zinc-700 hover:text-primary-600 py-1 transition-colors flex items-center">
                  <span className="w-2 h-2 bg-primary-500 rounded-full mr-2"></span>
                  Campeonatos
                </a>
                <a href="/eventos" onClick={() => setIsMenuOpen(false)} className="text-zinc-700 hover:text-primary-600 py-1 transition-colors">Eventos</a>
                <a href="/duvidas" onClick={() => setIsMenuOpen(false)} className="text-zinc-700 hover:text-primary-600 py-1 transition-colors">Dúvidas</a>
                <a href="/#contato" onClick={() => setIsMenuOpen(false)} className="text-zinc-700 hover:text-primary-600 py-1 transition-colors">Contato</a>
              </nav>
            </div>
          )}
        </div>
      </header>
    </>
  );
};

export default Header;
