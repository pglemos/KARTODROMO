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

const Home = () => {
  return (
    <div className="min-h-screen bg-ink-950 text-white">
      <Header />
      <Hero />
      <Ticker items={['Velocidade', 'Amigos', 'Pódio', 'Adrenalina', 'Aniversários']} />
      <EventFormats />
      <About />
      <Booking />
      <Services />
      <Promotions />
      <Gallery />
      <Contact />
      <Footer />
    </div>
  );
};

export default Home;
