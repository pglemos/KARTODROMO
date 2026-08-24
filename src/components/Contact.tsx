import { Phone, Mail, MapPin, Clock, Compass, ArrowUpRight, MessageCircle } from 'lucide-react';
import SectionHeading from './site-ui/SectionHeading';
import { FacebookIcon, InstagramIcon, YoutubeIcon } from './site-ui/SocialIcons';

const Contact = () => {
  return (
    <section id="contato" className="border-t border-white/10 bg-ink-950 py-16 md:py-24">
      <div className="container mx-auto px-4">
        <SectionHeading
          align="center"
          eyebrow="Estamos aqui"
          title={
            <>
              Fale <span className="text-primary-400">Conosco</span>
            </>
          }
        />
        <p className="mx-auto mt-6 max-w-3xl text-center text-lg font-light leading-relaxed text-white/70">
          Estamos prontos para atender você, sua equipe ou sua empresa. Tire suas dúvidas e agende sua corrida.
        </p>

        <div className="mx-auto mb-16 mt-16 max-w-5xl">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div className="group border border-white/10 bg-ink-900 p-6 text-center transition-all hover:border-primary-400/40">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center border border-primary-400/30 bg-white/5 text-primary-400 transition-transform group-hover:scale-110">
                <Phone className="h-5 w-5" />
              </div>
              <h4 className="mb-2 font-race text-sm italic font-bold uppercase tracking-wider text-white">Telefone / Fixo</h4>
              <p className="mb-1 text-xs font-light text-white/60">(31) 3511-2373</p>
              <a href="tel:+553135112373" className="mt-2 flex items-center justify-center text-xs font-semibold text-primary-400 hover:underline">
                Ligar agora
                <ArrowUpRight className="ml-0.5 h-3 w-3" />
              </a>
            </div>

            <div className="group border border-white/10 bg-ink-900 p-6 text-center transition-all hover:border-primary-400/40">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center border border-primary-400/30 bg-white/5 text-primary-400 transition-transform group-hover:scale-110">
                <MessageCircle className="h-5 w-5" />
              </div>
              <h4 className="mb-2 font-race text-sm italic font-bold uppercase tracking-wider text-white">WhatsApp</h4>
              <p className="mb-1 text-xs font-light text-white/60">(31) 3511-2373</p>
              <a href="https://wa.me/5531998842898" target="_blank" rel="noopener noreferrer" className="mt-2 flex items-center justify-center text-xs font-semibold text-primary-400 hover:underline">
                Enviar mensagem
                <ArrowUpRight className="ml-0.5 h-3 w-3" />
              </a>
            </div>

            <div className="group border border-white/10 bg-ink-900 p-6 text-center transition-all hover:border-primary-400/40">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center border border-primary-400/30 bg-white/5 text-primary-400 transition-transform group-hover:scale-110">
                <Mail className="h-5 w-5" />
              </div>
              <h4 className="mb-2 font-race text-sm italic font-bold uppercase tracking-wider text-white">E-mail Oficial</h4>
              <p className="truncate text-xs font-light text-white/60">contato@kartodromodebetim.com.br</p>
              <a href="mailto:contato@kartodromodebetim.com.br" className="mt-2 flex items-center justify-center text-xs font-semibold text-primary-400 hover:underline">
                Escrever e-mail
                <ArrowUpRight className="ml-0.5 h-3 w-3" />
              </a>
            </div>

            <div className="group border border-white/10 bg-ink-900 p-6 text-center transition-all hover:border-primary-400/40">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center border border-primary-400/30 bg-white/5 text-primary-400 transition-transform group-hover:scale-110">
                <Clock className="h-5 w-5" />
              </div>
              <h4 className="mb-2 font-race text-sm italic font-bold uppercase tracking-wider text-white">Atendimento</h4>
              <p className="text-xs font-light text-white/60">Ter-Sex: 16h às 22h</p>
              <p className="text-xs font-light text-white/60">Sáb-Dom: 08h às 19h</p>
            </div>
          </div>

          <div className="mt-8 flex flex-col items-center justify-between gap-4 border border-white/10 bg-ink-900 p-6 text-center sm:flex-row">
            <span className="text-sm font-semibold text-white/75">Siga-nos e fique por dentro dos grids e novidades:</span>
            <div className="flex justify-center space-x-3">
              <a href="https://www.facebook.com/kartodromodebetim" target="_blank" rel="noopener noreferrer" aria-label="Facebook do Kartódromo de Betim" className="flex h-10 w-10 items-center justify-center border border-white/15 bg-white/5 text-white/70 transition-all hover:border-primary-400 hover:text-primary-400">
                <FacebookIcon className="h-5 w-5" />
              </a>
              <a href="https://www.instagram.com/kartodromobetim/" target="_blank" rel="noopener noreferrer" aria-label="Instagram do Kartódromo de Betim" className="flex h-10 w-10 items-center justify-center border border-white/15 bg-white/5 text-white/70 transition-all hover:border-primary-400 hover:text-primary-400">
                <InstagramIcon className="h-5 w-5" />
              </a>
              <a href="https://www.youtube.com/kartodromodebetim31" target="_blank" rel="noopener noreferrer" aria-label="YouTube do Kartódromo de Betim" className="flex h-10 w-10 items-center justify-center border border-white/15 bg-white/5 text-white/70 transition-all hover:border-primary-400 hover:text-primary-400">
                <YoutubeIcon className="h-5 w-5" />
              </a>
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-5xl border border-white/10 bg-ink-900 p-6 md:p-8">
          <h3 className="mb-6 text-center font-race text-xl italic font-bold uppercase tracking-wider text-white">Como Chegar ao Circuito</h3>
          <div className="relative overflow-hidden border border-white/10">
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
          <div className="mt-6 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-6 md:flex-row">
            <div className="flex items-center text-sm text-white/70">
              <MapPin className="mr-2 h-5 w-5 flex-shrink-0 text-primary-400" />
              <span>Av. Adutora Várzea das Flores, 477 - Itacolomi, Betim - MG, 32672-586</span>
            </div>
            <a
              href="https://maps.google.com/maps?q=Av.+Adutora+Várzea+das+Flores,+477+-+Itacolomi,+Betim+-+MG,+32672-586"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center border border-white/15 bg-white/5 px-4 py-2 font-race text-[11px] italic font-bold uppercase tracking-wider text-white transition-all hover:border-primary-400/40"
            >
              <span>Traçar rota no Waze / Maps</span>
              <Compass className="ml-1.5 h-3.5 w-3.5 text-primary-400" />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Contact;
