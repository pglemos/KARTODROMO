import Header from '../components/Header';
import Track from '../components/Track';
import Footer from '../components/Footer';

const PistaPage = () => {
  return (
    <div className="min-h-screen bg-white text-zinc-800">
      <Header />
      <main>
        <Track />
      </main>
      <Footer />
    </div>
  );
};

export default PistaPage;
