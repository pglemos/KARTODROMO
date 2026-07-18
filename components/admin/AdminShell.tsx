import type { ReactNode } from 'react';
import {
  CalendarDays,
  ConciergeBell,
  Flag,
  LayoutDashboard,
  Monitor,
  ShieldCheck,
  Timer,
  Trophy,
  Users,
  BadgePercent,
  UtensilsCrossed,
  WalletCards,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { adminModules, adminNavigationGroups, type AdminModuleKey } from './navigation';
import { LogoutButton } from './LogoutButton';

const iconMap: Record<AdminModuleKey, LucideIcon> = {
  dashboard: LayoutDashboard,
  reservas: CalendarDays,
  recepcao: ConciergeBell,
  lanchonete: UtensilsCrossed,
  cronometragem: Timer,
  campeonatos: Trophy,
  resultados: Flag,
  telao: Monitor,
  financeira: WalletCards,
  clientes: Users,
  administrativa: ShieldCheck,
  clube: BadgePercent,
};

function isActive(currentPath: string, href: string) {
  if (href === '/admin') return currentPath === href;
  return currentPath === href || currentPath.startsWith(`${href}/`);
}

export function AdminShell({
  children,
  currentPath,
  sessionEmail,
  title,
}: {
  children: ReactNode;
  currentPath: string;
  sessionEmail: string;
  title: string;
}) {
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-zinc-800 bg-zinc-950 lg:flex">
        <div className="flex h-16 items-center gap-3 border-b border-zinc-800 px-5">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-500 text-zinc-950">
            <Zap aria-hidden="true" size={21} />
          </span>
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-primary-300">Sistema</p>
            <strong className="block text-sm font-black uppercase tracking-tight text-white">Kartódromo Betim</strong>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-5" aria-label="Módulos do sistema">
          {adminNavigationGroups.map((group) => {
            const items = adminModules.filter((module) => module.group === group);
            return (
              <section className="mb-6" key={group}>
                <h2 className="mb-2 px-3 text-[11px] font-black uppercase tracking-[0.16em] text-zinc-500">{group}</h2>
                <div className="grid gap-1">
                  {items.map((item) => {
                    const Icon = iconMap[item.key];
                    const active = isActive(currentPath, item.href);
                    return (
                      <a
                        aria-current={active ? 'page' : undefined}
                        className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-bold transition-colors ${
                          active
                            ? 'bg-primary-500 text-zinc-950'
                            : 'text-zinc-300 hover:bg-zinc-900 hover:text-primary-300'
                        }`}
                        href={item.href}
                        key={item.key}
                      >
                        <Icon aria-hidden="true" size={18} />
                        {item.title}
                      </a>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </nav>

        <div className="border-t border-zinc-800 p-4">
          <p className="truncate text-xs font-bold text-zinc-400">{sessionEmail}</p>
          <div className="mt-3">
            <LogoutButton />
          </div>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 border-b border-zinc-800 bg-zinc-950/95 px-4 py-3 backdrop-blur md:px-6">
          <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-primary-300">Administração</p>
              <h1 className="text-xl font-black uppercase tracking-tight text-white md:text-2xl">{title}</h1>
            </div>
            <div className="flex items-center gap-3">
              <a
                className="hidden rounded-md border border-zinc-700 px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-zinc-300 transition-colors hover:border-primary-400/70 hover:text-primary-300 md:inline-flex"
                href="/"
              >
                Site
              </a>
              <LogoutButton />
            </div>
          </div>
        </header>

        <nav className="border-b border-zinc-800 bg-zinc-950 px-4 py-3 lg:hidden" aria-label="Módulos do sistema">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {adminModules.map((item) => {
              const active = isActive(currentPath, item.href);
              return (
                <a
                  className={`shrink-0 rounded-md px-3 py-2 text-xs font-black uppercase tracking-[0.1em] ${
                    active ? 'bg-primary-500 text-zinc-950' : 'bg-zinc-900 text-zinc-300'
                  }`}
                  href={item.href}
                  key={item.key}
                >
                  {item.title}
                </a>
              );
            })}
          </div>
        </nav>

        <div className="px-4 py-5 md:px-6">{children}</div>
      </div>
    </main>
  );
}
