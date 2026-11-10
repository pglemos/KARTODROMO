'use client';

import { useEffect } from 'react';
import Header from '@/src/components/Header';
import Footer from '@/src/components/Footer';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[AppRouter Error Boundary]', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-ink-950 text-white/80">
      <Header />
      <main className="container mx-auto px-4 py-24 text-center md:py-36">
        <p className="mb-3 font-race text-xs italic font-bold uppercase tracking-[0.18em] text-red-500">
          Erro Inesperado
        </p>
        <h1 className="font-display text-4xl italic uppercase tracking-tight text-white md:text-6xl">
          Ops! Algo deu errado
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-sm leading-7 text-white/65 md:text-base">
          Ocorreu uma falha inesperada ao carregar esta página. Tente novamente ou retorne para o início.
        </p>
        {error?.digest && (
          <p className="mx-auto mt-2 text-xs font-mono text-white/40">
            Código: {error.digest}
          </p>
        )}
        <div className="mt-8 flex flex-wrap justify-center gap-4">
          <button
            type="button"
            onClick={() => reset()}
            className="inline-flex min-h-12 items-center bg-gradient-to-br from-primary-400 to-primary-600 px-6 py-3 font-race text-xs italic font-bold uppercase tracking-[0.16em] text-ink-950 [clip-path:polygon(7%_0,100%_0,93%_100%,0_100%)] transition-transform hover:-translate-y-1"
          >
            Tentar novamente
          </button>
          <a
            href="/"
            className="inline-flex min-h-12 items-center border border-white/20 bg-white/5 px-6 py-3 font-race text-xs italic font-bold uppercase tracking-[0.16em] text-white transition-colors hover:bg-white/10"
          >
            Voltar para a Home
          </a>
        </div>
      </main>
      <Footer />
    </div>
  );
}
