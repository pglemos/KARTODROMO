import Header from '@/src/components/Header';
import Footer from '@/src/components/Footer';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-ink-950 text-white/80">
      <Header />
      <main className="container mx-auto px-4 py-24 text-center md:py-36">
        <p className="mb-3 font-race text-xs italic font-bold uppercase tracking-[0.18em] text-primary-400">
          Página não encontrada
        </p>
        <h1 className="font-display text-4xl italic uppercase tracking-tight text-white md:text-6xl">
          Essa rota não existe
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-sm leading-7 text-white/65 md:text-base">
          O endereço acessado não corresponde a uma página ativa do Kartódromo Internacional de Betim.
        </p>
        <a
          href="/"
          className="mt-8 inline-flex min-h-12 items-center bg-gradient-to-br from-primary-400 to-primary-600 px-6 py-3 font-race text-xs italic font-bold uppercase tracking-[0.16em] text-ink-950 [clip-path:polygon(7%_0,100%_0,93%_100%,0_100%)] transition-transform hover:-translate-y-1"
        >
          Voltar para a Home
        </a>
      </main>
      <Footer />
    </div>
  );
}
