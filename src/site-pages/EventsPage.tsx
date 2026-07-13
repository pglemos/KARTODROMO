import Header from '../components/Header';
import Events from '../components/Events';
import Footer from '../components/Footer';

const EventsPage = () => {
  return (
    <div className="min-h-screen bg-ink-950 text-white/80">
      <Header />
      <Events />
      <Footer />
    </div>
  );
};

export default EventsPage;
