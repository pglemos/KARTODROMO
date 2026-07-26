import type { AdminModule } from './navigation';

export function AdminModulePage({ module }: { module: AdminModule }) {
  return (
    <div className="mx-auto grid max-w-[1500px] gap-5">
      <section className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-5 md:p-6">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-primary-300">{module.group}</p>
        <h2 className="mt-2 text-3xl font-black uppercase tracking-tight text-white">{module.title}</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-300">{module.summary}</p>
      </section>

      <section className="grid gap-4 md:grid-cols-[0.8fr_1.2fr]">
        <article className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
          <span className="text-xs font-black uppercase tracking-[0.16em] text-zinc-500">Status</span>
          <strong className="mt-2 block text-2xl font-black text-white">{module.status}</strong>
          <p className="mt-3 text-sm leading-6 text-zinc-400">
            A página voltou para a navegação principal do sistema. A integração operacional profunda deste módulo fica
            preservada como área própria, sem transformar o telão no dashboard inteiro.
          </p>
        </article>

        <article className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
          <span className="text-xs font-black uppercase tracking-[0.16em] text-zinc-500">Recursos do módulo</span>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {module.features.map((feature) => (
              <div className="rounded-md border border-zinc-800 bg-zinc-950 p-4" key={feature}>
                <strong className="block text-sm font-black uppercase text-white">{feature}</strong>
                <span className="mt-2 block text-xs leading-5 text-zinc-500">Área disponível no sistema administrativo.</span>
              </div>
            ))}
          </div>
        </article>
      </section>
    </div>
  );
}
