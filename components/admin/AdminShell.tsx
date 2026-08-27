'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  BadgePercent,
  CalendarDays,
  ConciergeBell,
  Flag,
  Gauge,
  LayoutDashboard,
  Menu,
  Monitor,
  Moon,
  ShieldCheck,
  Sun,
  Timer,
  Trophy,
  Users,
  UtensilsCrossed,
  WalletCards,
  X,
  type LucideIcon,
} from 'lucide-react';
import { adminModules, adminNavigationGroups, type AdminModuleKey } from './navigation';
import { LogoutButton } from './LogoutButton';
import { canAccess, type Role } from '@/src/admin/lib/rbac';
import Image from 'next/image';

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
  equalizacao: Gauge,
  administrativa: ShieldCheck,
  clube: BadgePercent,
};

function isActive(currentPath: string, href: string) {
  if (href === '/admin') return currentPath === href;
  return currentPath === href || currentPath.startsWith(`${href}/`);
}

function Navigation({ currentPath, onNavigate, role }: { currentPath: string; onNavigate?: () => void; role: Role }) {
  return (
    <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Módulos do sistema">
      {adminNavigationGroups.map((group) => {
        const items = adminModules.filter((module) => module.group === group && canAccess(role, module.key));
        if (!items.length) return null;
        return (
          <section className="mb-[22px]" key={group}>
            <h2 className="mb-1.5 px-2.5 text-[10.5px] font-bold uppercase tracking-[.1em] text-[var(--admin-faint)]">{group}</h2>
            <div className="grid gap-0.5">
              {items.map((item) => {
                const Icon = iconMap[item.key];
                const active = isActive(currentPath, item.href);
                return (
                  <a
                    aria-current={active ? 'page' : undefined}
                    className="admin-nav-link"
                    href={item.href}
                    key={item.key}
                    onClick={onNavigate}
                  >
                    <Icon aria-hidden="true" size={17} strokeWidth={1.8} />
                    {item.title}
                  </a>
                );
              })}
            </div>
          </section>
        );
      })}
    </nav>
  );
}

export function AdminShell({
  children,
  currentPath,
  sessionRole,
  sessionEmail,
  title,
}: {
  children: ReactNode;
  currentPath: string;
  sessionEmail: string;
  sessionRole: Role;
  title: string;
}) {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const mobileDrawerRef = useRef<HTMLElement>(null);
  const mobileMenuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    try {
      setTheme(localStorage.getItem('kib-admin-theme') === 'dark' ? 'dark' : 'light');
    } catch {
      // Local storage can be disabled without preventing admin usage.
    }
  }, []);

  useEffect(() => {
    if (!mobileNavOpen) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileNavOpen(false);
        window.setTimeout(() => mobileMenuButtonRef.current?.focus(), 0);
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = Array.from(
        mobileDrawerRef.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])') ?? [],
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    window.setTimeout(() => mobileDrawerRef.current?.querySelector<HTMLElement>('button, a[href]')?.focus(), 0);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [mobileNavOpen]);

  function closeMobileNav() {
    setMobileNavOpen(false);
    window.setTimeout(() => mobileMenuButtonRef.current?.focus(), 0);
  }

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    try {
      localStorage.setItem('kib-admin-theme', next);
    } catch {
      // Theme persistence is progressive enhancement.
    }
  }

  const Brand = () => (
    <a className="flex items-center gap-2.5 border-b border-[var(--admin-border)] px-[18px] py-5 no-underline" href="/admin">
      <span className="admin-brand-lockup">
        <Image alt="Kartódromo Internacional de Betim" className="admin-brand-logo" height={52} priority src="/brand/kib-logo.png" width={188} />
      </span>
      <span className="min-w-0">
        <span className="block text-[10px] font-bold uppercase tracking-[.12em] text-[var(--admin-accent)]">Painel interno</span>
        <strong className="block text-sm font-bold text-[var(--admin-text)]">Operação</strong>
      </span>
    </a>
  );

  return (
    <main className="admin-root" data-theme={theme}>
      <aside className="admin-sidebar">
        <Brand />
        <Navigation currentPath={currentPath} role={sessionRole} />
        <div className="border-t border-[var(--admin-border)] px-[18px] py-3.5">
          <p className="mb-2 truncate text-xs font-semibold text-[var(--admin-muted)]">{sessionEmail}</p>
          <LogoutButton />
        </div>
      </aside>

      <button
        aria-label="Fechar menu"
        className="admin-mobile-overlay"
        data-open={mobileNavOpen}
        onClick={closeMobileNav}
        type="button"
      />
      <aside aria-hidden={!mobileNavOpen} className="admin-mobile-drawer" data-open={mobileNavOpen} id="admin-mobile-navigation" inert={!mobileNavOpen} ref={mobileDrawerRef}>
        <div className="flex items-center justify-between border-b border-[var(--admin-border)] px-[18px] py-4">
          <strong className="text-sm font-bold text-[var(--admin-text)]">Menu</strong>
          <button className="admin-icon-button" onClick={closeMobileNav} type="button" aria-label="Fechar menu">
            <X aria-hidden="true" size={18} />
          </button>
        </div>
        <Navigation currentPath={currentPath} onNavigate={closeMobileNav} role={sessionRole} />
        <div className="border-t border-[var(--admin-border)] px-[18px] py-3.5">
          <p className="mb-2 truncate text-xs font-semibold text-[var(--admin-muted)]">{sessionEmail}</p>
          <LogoutButton />
        </div>
      </aside>

      <div className="admin-content">
        <header className="admin-topbar">
          <div className="flex min-w-0 items-center gap-3.5">
            <button ref={mobileMenuButtonRef} className="admin-icon-button min-[1081px]:hidden" type="button" onClick={() => setMobileNavOpen(true)} aria-label="Abrir menu" aria-expanded={mobileNavOpen} aria-controls="admin-mobile-navigation">
              <Menu aria-hidden="true" size={20} />
            </button>
            <div className="min-w-0">
              <p className="mb-0.5 text-[10.5px] font-bold uppercase tracking-[.14em] text-[var(--admin-accent)]">Administração</p>
              <h1 className="m-0 truncate text-[22px] font-bold leading-tight text-[var(--admin-text)]">{title}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <button className="admin-icon-button" type="button" onClick={toggleTheme} aria-label="Alternar tema">
              {theme === 'dark' ? <Sun aria-hidden="true" size={17} /> : <Moon aria-hidden="true" size={17} />}
            </button>
            <a className="hidden h-[38px] items-center rounded-[9px] border border-[var(--admin-border)] px-3.5 text-xs font-bold text-[var(--admin-muted)] no-underline transition-colors hover:border-[var(--admin-accent-border)] hover:text-[var(--admin-accent)] sm:inline-flex" href="/">
              Ver site
            </a>
          </div>
        </header>

        <div className="admin-main">{children}</div>
      </div>
    </main>
  );
}
