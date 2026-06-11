import Header from "../components/Header";
import Footer from "../components/Footer";
import QuickBooking from "../components/QuickBooking";

const ReservasPage = () => {
  return (
    <div className="min-h-screen bg-white text-zinc-800">
      <Header />

      <main>
        <QuickBooking surface="page" />
      </main>

      <Footer />
    </div>
  );
};

export default ReservasPage;
