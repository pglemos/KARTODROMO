import Header from '../components/Header';
import Hero from '../components/Hero';
import About from '../components/About';
import Booking from '../components/Booking';
import Services from '../components/Services';
import Promotions from '../components/Promotions';
import Contact from '../components/Contact';
import Footer from '../components/Footer';
import Ticker from '../components/site-ui/Ticker';
import EventFormats from '../components/EventFormats';
import Gallery from '../components/Gallery';
import HowItWorks from '../components/HowItWorks';
import WhyBetim from '../components/WhyBetim';
import AngledButton from '../components/site-ui/AngledButton';
import BigCTA from '../components/site-ui/BigCTA';
import { SITE_BOOKING_ANCHOR, WHATSAPP_BOOKING_URL } from '../config/booking';

const Home = () => {
  return (
    <div className="min-h-screen bg-ink-950 text-white">
      <Header />
      <Hero />
      <Ticker items={['Velocidade', 'Amigos', 'Pódio', 'Adrenalina', 'Aniversários']} />
      <EventFormats />
      <HowItWorks />
      <About />
      <Booking />
      <Services />
      <Promotions />
      <Gallery />
      <WhyBetim />
      <Contact />
      <section className="border-t border-white/10 bg-ink-950 py-16 md:py-24">
        <div className="container mx-auto px-4">
          <BigCTA
            watermark="READY"
            title={<>Pronto para acelerar<br /><span className="text-primary-400">emoções?</span></>}
            text="Reserve seu grupo e transforme a próxima comemoração em uma corrida inesquecível."
          >
            <AngledButton href={SITE_BOOKING_ANCHOR}>Reservar meu grupo</AngledButton>
            <AngledButton href={WHATSAPP_BOOKING_URL} variant="outline" external>
              Falar no WhatsApp
            </AngledButton>
          </BigCTA>
        </div>
      </section>
      <Footer />
    </div>
  );
};

export default Home;
