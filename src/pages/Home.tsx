import Header from '../components/Header';
import Hero from '../components/Hero';
import About from '../components/About';
import Booking from '../components/Booking';
import Services from '../components/Services';
import Promotions from '../components/Promotions';
import Contact from '../components/Contact';
import Footer from '../components/Footer';

const Home = () => {
  return (
    <div className="min-h-screen bg-white text-zinc-800">
      <Header />
      <Hero />
      <About />
      <Booking />
      <Services />
      <Promotions />
      <Contact />
      <Footer />
    </div>
  );
};

export default Home;
