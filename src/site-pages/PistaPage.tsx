import Header from '../components/Header';
import Track from '../components/Track';
import Footer from '../components/Footer';

const PistaPage = () => {
  return (
    <div className="min-h-screen bg-ink-950 text-white/80">
      <Header />
      <main>
        <Track />
      </main>
      <Footer />
    </div>
  );
};

export default PistaPage;
