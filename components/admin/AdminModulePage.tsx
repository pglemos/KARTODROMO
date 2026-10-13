import type { AdminModule } from './navigation';

export function AdminModulePage({ module }: { module: AdminModule }) {
  return (
    <div className="mx-auto grid max-w-[1500px] gap-5">
      <section className="rounded-lg border border-kib-borda bg-kib-superficie p-5 md:p-6">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-kib-acao">{module.group}</p>
        <h2 className="mt-2 text-3xl font-black uppercase tracking-tight text-kib-texto">{module.title}</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-kib-texto-2">{module.summary}</p>
      </section>

      <section className="grid gap-4 md:grid-cols-[0.8fr_1.2fr]">
        <article className="rounded-lg border border-kib-borda bg-kib-superficie p-5">
          <span className="text-xs font-black uppercase tracking-[0.16em] text-kib-texto-3">Status</span>
          <strong className="mt-2 block text-2xl font-black text-kib-texto">{module.status}</strong>
          <p className="mt-3 text-sm leading-6 text-kib-texto-2">
            A página voltou para a navegação principal do sistema. A integração operacional profunda deste módulo fica
            preservada como área própria, sem transformar o telão no dashboard inteiro.
          </p>
        </article>

        <article className="rounded-lg border border-kib-borda bg-kib-superficie p-5">
          <span className="text-xs font-black uppercase tracking-[0.16em] text-kib-texto-3">Recursos do módulo</span>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {module.features.map((feature) => (
              <div className="rounded-md border border-kib-borda bg-kib-fundo p-4" key={feature}>
                <strong className="block text-sm font-black uppercase text-kib-texto">{feature}</strong>
                <span className="mt-2 block text-xs leading-5 text-kib-texto-3">Área disponível no sistema administrativo.</span>
              </div>
            ))}
          </div>
        </article>
      </section>
    </div>
  );
}
