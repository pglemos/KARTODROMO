import Header from "../components/Header";
import Footer from "../components/Footer";
import QuickBooking from "../components/QuickBooking";

const ReservasPage = () => {
  return (
    <div className="min-h-screen bg-ink-950 text-white/80">
      <Header />

      <main>
        <QuickBooking surface="page" />
      </main>

      <Footer />
    </div>
  );
};

export default ReservasPage;
