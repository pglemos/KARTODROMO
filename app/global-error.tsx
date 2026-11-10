'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="pt-BR">
      <body className="flex min-h-screen items-center justify-center bg-black text-white p-6 font-sans">
        <div className="max-w-md text-center">
          <p className="text-xs uppercase tracking-widest text-red-500 font-bold mb-2">Erro Crítico</p>
          <h1 className="text-3xl font-extrabold uppercase tracking-tight mb-4">Falha no Carregamento</h1>
          <p className="text-sm text-neutral-400 mb-6">
            Ocorreu um erro no nível raiz da aplicação.
          </p>
          {error?.digest && (
            <p className="text-xs font-mono text-neutral-600 mb-6">Ref: {error.digest}</p>
          )}
          <button
            type="button"
            onClick={() => reset()}
            className="rounded bg-red-600 px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-red-700"
          >
            Recarregar aplicação
          </button>
        </div>
      </body>
    </html>
  );
}
