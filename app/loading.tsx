export default function Loading() {
  return (
    <div className="min-h-screen bg-ink-950 text-white/80">
      <div className="h-20 border-b border-white/10 bg-ink-900/60" />
      <main className="container mx-auto px-4 py-24 md:py-36">
        <div className="mx-auto max-w-xl text-center">
          <div className="mx-auto mb-4 h-4 w-32 animate-pulse rounded bg-white/10" />
          <div className="mx-auto mb-6 h-12 w-3/4 animate-pulse rounded bg-white/20" />
          <div className="mx-auto mb-3 h-4 w-full animate-pulse rounded bg-white/10" />
          <div className="mx-auto h-4 w-2/3 animate-pulse rounded bg-white/10" />
          <div className="mt-8 flex justify-center">
            <div className="h-10 w-40 animate-pulse rounded bg-primary-500/20" />
          </div>
        </div>
      </main>
    </div>
  );
}
