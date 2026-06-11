import { Phone, Mail, MapPin, Clock, Facebook, Instagram, Youtube } from 'lucide-react';

const Footer = () => {
  return (
    <footer className="bg-zinc-100 text-zinc-600 py-16 border-t border-zinc-200">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 max-w-6xl mx-auto">
          {/* Logo e Descrição */}
          <div className="col-span-1 md:col-span-2 space-y-6">
            <div>
              <img 
                src="/brand/kib-logo.png" 
                alt="Logo Kartódromo de Betim" 
                className="h-10 w-auto filter brightness-100"
              />
            </div>
            <p className="text-zinc-600 text-sm font-light leading-relaxed max-w-md">
              Pista homologada de 1.110 metros, kart de locação, campeonatos e estrutura para eventos em Betim.
            </p>
            <div className="flex space-x-3 pt-2">
              <a href="https://www.facebook.com/kartodromodebetim" target="_blank" rel="noopener noreferrer" aria-label="Facebook do Kartódromo de Betim" className="w-10 h-10 bg-white border border-zinc-200 text-zinc-500 rounded-xl flex items-center justify-center hover:bg-primary-500 hover:text-zinc-950 hover:border-primary-500 transition-all duration-300 shadow-sm">
                <Facebook className="w-5 h-5" />
              </a>
              <a href="https://www.instagram.com/kartodromobetim/" target="_blank" rel="noopener noreferrer" aria-label="Instagram do Kartódromo de Betim" className="w-10 h-10 bg-white border border-zinc-200 text-zinc-500 rounded-xl flex items-center justify-center hover:bg-primary-500 hover:text-zinc-950 hover:border-primary-500 transition-all duration-300 shadow-sm">
                <Instagram className="w-5 h-5" />
              </a>
              <a href="https://www.youtube.com/kartodromodebetim31" target="_blank" rel="noopener noreferrer" aria-label="YouTube do Kartódromo de Betim" className="w-10 h-10 bg-white border border-zinc-200 text-zinc-500 rounded-xl flex items-center justify-center hover:bg-primary-500 hover:text-zinc-950 hover:border-primary-500 transition-all duration-300 shadow-sm">
                <Youtube className="w-5 h-5" />
              </a>
            </div>
          </div>

          {/* Contato */}
          <div className="space-y-4">
            <h4 className="text-sm font-bold text-zinc-950 uppercase tracking-wider">Canais de Contato</h4>
            <div className="space-y-3 text-xs font-light">
              <div className="flex items-center space-x-2.5">
                <Mail className="w-4 h-4 text-primary-600 flex-shrink-0" />
                <a href="mailto:contato@kartodromodebetim.com.br" className="hover:text-primary-600 transition-colors text-zinc-700">contato@kartodromodebetim.com.br</a>
              </div>
              <div className="flex items-center space-x-2.5">
                <Phone className="w-4 h-4 text-primary-600 flex-shrink-0" />
                <a href="tel:+553135112373" className="hover:text-primary-600 transition-colors text-zinc-700">(31) 3511-2373</a>
              </div>
              <div className="flex items-center space-x-2.5">
                <Phone className="w-4 h-4 text-primary-600 flex-shrink-0" />
                <a href="https://wa.me/5531998842898" target="_blank" rel="noopener noreferrer" className="hover:text-primary-600 transition-colors text-zinc-700">(31) 99884-2898</a>
              </div>
              <div className="flex items-start space-x-2.5 text-zinc-600">
                <MapPin className="w-4 h-4 text-primary-600 flex-shrink-0 mt-0.5" />
                <span>
                  Av. Adutora Várzea das Flores, 477 - Itacolomi, Betim - MG, 32672-586
                </span>
              </div>
            </div>
          </div>

          {/* Funcionamento */}
          <div className="space-y-4">
            <h4 className="text-sm font-bold text-zinc-950 uppercase tracking-wider">Horários da Pista</h4>
            <div className="space-y-3 text-xs font-light">
              <div className="flex items-start space-x-2.5 text-zinc-600">
                <Clock className="w-4 h-4 text-primary-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-zinc-800">Terça a Sexta-feira</p>
                  <p className="text-zinc-500">16h00 às 22h00</p>
                  <p className="font-semibold text-zinc-800 mt-2">Sábado e Domingo</p>
                  <p className="text-zinc-500">08h00 às 19h00</p>
                  <p className="font-semibold text-red-600 mt-2">Segunda-feira</p>
                  <p className="text-zinc-500">Fechado para manutenção</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Links Rápidos */}
        <div className="border-t border-zinc-200 mt-12 pt-8">
          <div className="flex flex-wrap justify-center gap-x-8 gap-y-3 text-xs font-bold uppercase tracking-wider">
            <a href="/#home" className="text-zinc-500 hover:text-primary-600 transition-colors">Home</a>
            <a href="/#sobre" className="text-zinc-500 hover:text-primary-600 transition-colors">Sobre</a>
            <a href="/#servicos" className="text-zinc-500 hover:text-primary-600 transition-colors">Modalidades</a>
            <a href="/#promocoes" className="text-zinc-500 hover:text-primary-600 transition-colors">Promoções</a>
            <a href="/pista" className="text-zinc-500 hover:text-primary-600 transition-colors">A Pista</a>
            <a href="/kart-locacao" className="text-zinc-500 hover:text-primary-600 transition-colors">Locação</a>
            <a href="/campeonatos" className="text-zinc-500 hover:text-primary-600 transition-colors">Campeonatos</a>
            <a href="/eventos" className="text-zinc-500 hover:text-primary-600 transition-colors">Eventos</a>
            <a href="/duvidas" className="text-zinc-500 hover:text-primary-600 transition-colors">Dúvidas</a>
            <a href="/#contato" className="text-zinc-500 hover:text-primary-600 transition-colors">Contato</a>
          </div>
        </div>

        {/* Copyright */}
        <div className="border-t border-zinc-200 mt-8 pt-8 text-center text-xs text-zinc-500 font-light">
          <p>© {new Date().getFullYear()} Kartódromo Internacional de Betim. Todos os direitos reservados.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
