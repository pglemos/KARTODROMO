import { Phone, Mail, MapPin, Clock, Facebook, Instagram, Youtube, Compass, ArrowUpRight, MessageCircle } from 'lucide-react';

const Contact = () => {
  return (
    <section id="contato" className="py-24 bg-white border-t border-zinc-200/60">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-black text-zinc-950 mb-4 uppercase tracking-tight">
            Fale <span className="text-primary-600">Conosco</span>
          </h2>
          <div className="w-20 h-1.5 bg-primary-500 mx-auto rounded-full mb-6"></div>
          <p className="text-lg text-zinc-600 max-w-3xl mx-auto font-light leading-relaxed">
            Estamos prontos para atender você, sua equipe ou sua empresa. Tire suas dúvidas e agende sua corrida.
          </p>
        </div>

        {/* Info Grid */}
        <div className="max-w-5xl mx-auto mb-16">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Phone */}
            <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-6 text-center group hover:border-primary-500/30 transition-all duration-300">
              <div className="w-12 h-12 bg-primary-50 border border-primary-500/20 rounded-xl flex items-center justify-center mx-auto mb-4 text-primary-600 group-hover:scale-110 transition-transform">
                <Phone className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-zinc-900 mb-2 uppercase text-sm tracking-wider">Telefone / Fixo</h4>
              <p className="text-zinc-600 text-xs font-light mb-1">(31) 3511-2373</p>
              <a href="tel:+553135112373" className="text-xs text-primary-700 font-semibold hover:underline flex items-center justify-center mt-2">
                Ligar agora
                <ArrowUpRight className="w-3 h-3 ml-0.5" />
              </a>
            </div>

            {/* WhatsApp */}
            <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-6 text-center group hover:border-primary-500/30 transition-all duration-300">
              <div className="w-12 h-12 bg-primary-50 border border-primary-500/20 rounded-xl flex items-center justify-center mx-auto mb-4 text-primary-600 group-hover:scale-110 transition-transform">
                <MessageCircle className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-zinc-900 mb-2 uppercase text-sm tracking-wider">WhatsApp</h4>
              <p className="text-zinc-600 text-xs font-light mb-1">(31) 3511-2373</p>
              <a href="https://wa.me/553135112373" target="_blank" rel="noopener noreferrer" className="text-xs text-primary-700 font-semibold hover:underline flex items-center justify-center mt-2">
                Enviar mensagem
                <ArrowUpRight className="w-3 h-3 ml-0.5" />
              </a>
            </div>

            {/* Email */}
            <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-6 text-center group hover:border-primary-500/30 transition-all duration-300">
              <div className="w-12 h-12 bg-primary-50 border border-primary-500/20 rounded-xl flex items-center justify-center mx-auto mb-4 text-primary-600 group-hover:scale-110 transition-transform">
                <Mail className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-zinc-900 mb-2 uppercase text-sm tracking-wider">E-mail Oficial</h4>
              <p className="text-zinc-600 text-xs font-light truncate">contato@kartodromodebetim.com.br</p>
              <a href="mailto:contato@kartodromodebetim.com.br" className="text-xs text-primary-700 font-semibold hover:underline flex items-center justify-center mt-2">
                Escrever e-mail
                <ArrowUpRight className="w-3 h-3 ml-0.5" />
              </a>
            </div>

            {/* Hours */}
            <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-6 text-center group hover:border-primary-500/30 transition-all duration-300">
              <div className="w-12 h-12 bg-primary-50 border border-primary-500/20 rounded-xl flex items-center justify-center mx-auto mb-4 text-primary-600 group-hover:scale-110 transition-transform">
                <Clock className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-zinc-900 mb-2 uppercase text-sm tracking-wider">Atendimento</h4>
              <p className="text-zinc-600 text-xs font-light">Ter-Sex: 16h às 22h</p>
              <p className="text-zinc-600 text-xs font-light">Sáb-Dom: 08h às 19h</p>
            </div>
          </div>

          {/* Social Links Callout */}
          <div className="mt-8 text-center bg-zinc-50 border border-zinc-200 rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <span className="text-sm font-semibold text-zinc-700">Siga-nos e fique por dentro dos grids e novidades:</span>
            <div className="flex justify-center space-x-3">
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
        </div>

        {/* Map Section */}
        <div className="max-w-5xl mx-auto bg-zinc-50 border border-zinc-200 rounded-3xl p-6 md:p-8 shadow-sm">
          <h3 className="text-xl font-bold text-zinc-950 uppercase tracking-wider mb-6 text-center">Como Chegar ao Circuito</h3>
          <div className="rounded-2xl overflow-hidden border border-zinc-200 shadow-md relative">
            <iframe
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3751.2!2d-44.1980!3d-19.9676!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zMTnCsDU4JzAzLjQiUyA0NMKwMTEnNTIuOCJX!5e0!3m2!1spt-BR!2sbr!4v1"
              width="100%"
              height="350"
              style={{ border: 0 }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title="Localização do Kartódromo de Betim"
            ></iframe>
          </div>
          <div className="mt-6 flex flex-col md:flex-row items-center justify-between gap-4 border-t border-zinc-200 pt-6">
            <div className="flex items-center text-zinc-600 text-sm">
              <MapPin className="w-5 h-5 mr-2 text-primary-600 flex-shrink-0" />
              <span>Av. Adutora Várzea das Flores, 477 - Itacolomi, Betim - MG, 32672-586</span>
            </div>
            <a 
              href="https://maps.google.com/maps?q=Av.+Adutora+Várzea+das+Flores,+477+-+Itacolomi,+Betim+-+MG,+32672-586" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center px-4 py-2 bg-white border border-zinc-200 hover:border-primary-500/20 text-zinc-700 font-bold uppercase tracking-wider text-[10px] rounded-xl transition-all duration-300 shadow-sm"
            >
              <span>Traçar rota no Waze / Maps</span>
              <Compass className="w-3.5 h-3.5 ml-1.5 text-primary-600" />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Contact;
