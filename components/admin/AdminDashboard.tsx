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
      <section className="grid gap-4 rounded-lg border border-kib-borda bg-kib-superficie p-5 md:grid-cols-[1.3fr_0.7fr] md:p-6">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-kib-acao">Central administrativa</p>
          <h2 className="mt-2 text-3xl font-black uppercase tracking-tight text-kib-texto md:text-4xl">
            Sistema do Kartódromo
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-kib-texto-2">
            Dashboard principal com os módulos da operação, competição e gestão. O telão é apenas um módulo dentro do
            sistema, junto com reservas, recepção, lanchonete, cronometragem, campeonatos, resultados, financeiro e
            administração.
          </p>
        </div>
        <div className="grid gap-2 rounded-lg border border-kib-acao/30 bg-kib-acao/10 p-4">
          <span className="text-xs font-black uppercase tracking-[0.16em] text-kib-acao">Acesso rápido</span>
          <a className="rounded-md bg-kib-acao px-4 py-3 text-center text-sm font-black uppercase text-kib-sobre-acao" href="/admin/telao">
            Abrir módulo Telão
          </a>
          <a className="rounded-md border border-kib-borda-forte px-4 py-3 text-center text-sm font-black uppercase text-kib-texto" href="/admin/reservas">
            Ver Reservas
          </a>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-4">
        {operationalStats.map((stat) => (
          <article className="rounded-lg border border-kib-borda bg-kib-superficie p-4" key={stat.label}>
            <span className="text-xs font-black uppercase tracking-[0.16em] text-kib-texto-3">{stat.label}</span>
            <strong className="mt-2 block text-2xl font-black text-kib-texto">{stat.value}</strong>
            <em className="mt-1 block text-sm not-italic text-kib-texto-2">{stat.detail}</em>
          </article>
        ))}
      </section>

      <section className="rounded-lg border border-kib-borda bg-kib-superficie p-5">
        <header className="mb-4 flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-kib-acao">Módulos</p>
            <h2 className="text-2xl font-black uppercase tracking-tight text-kib-texto">Páginas do sistema</h2>
          </div>
          <span className="text-sm font-bold text-kib-texto-2">Use a sidebar para navegar entre áreas.</span>
        </header>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {adminModules
            .filter((module) => module.key !== 'dashboard')
            .map((module) => (
              <a
                className="group rounded-lg border border-kib-borda bg-kib-fundo p-4 transition-colors hover:border-kib-acao/60"
                href={module.href}
                key={module.key}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-[11px] font-black uppercase tracking-[0.14em] text-kib-texto-3">{module.group}</span>
                    <strong className="mt-1 block text-lg font-black text-kib-texto group-hover:text-kib-acao">
                      {module.title}
                    </strong>
                  </div>
                  <em className="rounded-md bg-kib-superficie px-2 py-1 text-[11px] font-black not-italic uppercase tracking-[0.1em] text-kib-acao">
                    {module.status}
                  </em>
                </div>
                <p className="mt-3 text-sm leading-6 text-kib-texto-2">{module.summary}</p>
              </a>
            ))}
        </div>
      </section>
    </div>
  );
}
