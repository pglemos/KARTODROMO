import { adminModules } from './navigation';

const operationalStats = [
  { label: 'Módulos', value: '10', detail: 'Sistema administrativo restaurado' },
  { label: 'Telão', value: 'Online', detail: 'Controle LED dentro do sistema' },
  { label: 'Acesso', value: 'Admin', detail: 'Sessão protegida por cookie assinado' },
  { label: 'Produção', value: 'Vercel', detail: 'Projeto consolidado em KARTODROMO' },
];

export function AdminDashboard() {
  return (
    <div className="mx-auto grid max-w-[1500px] gap-5">
      <section className="grid gap-4 rounded-lg border border-zinc-800 bg-zinc-900/70 p-5 md:grid-cols-[1.3fr_0.7fr] md:p-6">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-primary-300">Central administrativa</p>
          <h2 className="mt-2 text-3xl font-black uppercase tracking-tight text-white md:text-4xl">
            Sistema do Kartódromo
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-300">
            Dashboard principal com os módulos da operação, competição e gestão. O telão é apenas um módulo dentro do
            sistema, junto com reservas, recepção, lanchonete, cronometragem, campeonatos, resultados, financeiro e
            administração.
          </p>
        </div>
        <div className="grid gap-2 rounded-lg border border-primary-500/30 bg-primary-500/10 p-4">
          <span className="text-xs font-black uppercase tracking-[0.16em] text-primary-300">Acesso rápido</span>
          <a className="rounded-md bg-primary-500 px-4 py-3 text-center text-sm font-black uppercase text-zinc-950" href="/admin/telao">
            Abrir módulo Telão
          </a>
          <a className="rounded-md border border-zinc-700 px-4 py-3 text-center text-sm font-black uppercase text-zinc-200" href="/admin/reservas">
            Ver Reservas
          </a>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-4">
        {operationalStats.map((stat) => (
          <article className="rounded-lg border border-zinc-800 bg-zinc-900 p-4" key={stat.label}>
            <span className="text-xs font-black uppercase tracking-[0.16em] text-zinc-500">{stat.label}</span>
            <strong className="mt-2 block text-2xl font-black text-white">{stat.value}</strong>
            <em className="mt-1 block text-sm not-italic text-zinc-400">{stat.detail}</em>
          </article>
        ))}
      </section>

      <section className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-5">
        <header className="mb-4 flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-primary-300">Módulos</p>
            <h2 className="text-2xl font-black uppercase tracking-tight text-white">Páginas do sistema</h2>
          </div>
          <span className="text-sm font-bold text-zinc-400">Use a sidebar para navegar entre áreas.</span>
        </header>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {adminModules
            .filter((module) => module.key !== 'dashboard')
            .map((module) => (
              <a
                className="group rounded-lg border border-zinc-800 bg-zinc-950 p-4 transition-colors hover:border-primary-500/60"
                href={module.href}
                key={module.key}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-[11px] font-black uppercase tracking-[0.14em] text-zinc-500">{module.group}</span>
                    <strong className="mt-1 block text-lg font-black text-white group-hover:text-primary-300">
                      {module.title}
                    </strong>
                  </div>
                  <em className="rounded-md bg-zinc-900 px-2 py-1 text-[11px] font-black not-italic uppercase tracking-[0.1em] text-primary-300">
                    {module.status}
                  </em>
                </div>
                <p className="mt-3 text-sm leading-6 text-zinc-400">{module.summary}</p>
              </a>
            ))}
        </div>
      </section>
    </div>
  );
}
