'use client';

import { useCallback, useRef, useState } from 'react';
import { ArrowRight, Clock, MapPin, Menu, Phone } from 'lucide-react';
import { usePathname } from 'next/navigation';
import MobileNavigation, { type PublicNavItem } from './site-ui/MobileNavigation';

const exact = (path: string) => (pathname: string) => pathname === path;
const startsWithAny = (...prefixes: string[]) => (pathname: string) => prefixes.some((prefix) => pathname.startsWith(prefix));

const navItems: readonly PublicNavItem[] = [
  { href: '/pista', label: 'A Pista', isActive: exact('/pista') },
  { href: '/kart-locacao', label: 'Locação', isActive: exact('/kart-locacao') },
  {
    href: '/campeonatos',
    label: 'Campeonatos',
    isActive: startsWithAny('/campeonatos', '/kac', '/200-milhas', '/500-milhas'),
  },
  { href: '/eventos', label: 'Eventos', isActive: exact('/eventos') },
  { href: '/historia', label: 'História', isActive: exact('/historia') },
  { href: '/duvidas', label: 'Dúvidas', isActive: exact('/duvidas') },
  { href: '/clube-vantagens', label: 'Clube', isActive: startsWithAny('/clube-') },
];

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const pathname = usePathname() || '/';
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const closeMenu = useCallback(() => setIsMenuOpen(false), []);

  return (
    <>
      <div className="border-b border-white/10 bg-[#070b08] px-4 text-white">
        <div className="mx-auto flex min-h-9 max-w-[92rem] items-center justify-between gap-4 font-body text-[13px] font-semibold leading-none text-white/72">
          <div className="flex min-w-0 items-center gap-4 sm:gap-6">
            <a
              href="tel:+553135112373"
              className="flex shrink-0 items-center gap-2 text-white transition-colors hover:text-primary-400"
            >
              <Phone aria-hidden="true" className="h-4 w-4 text-primary-400" />
              <span>(31) 3511-2373</span>
            </a>
            <span className="hidden items-center gap-2 md:flex">
              <MapPin aria-hidden="true" className="h-4 w-4 text-primary-400" />
              Av. Adutora Várzea das Flores, 477 · Betim
            </span>
          </div>

          <span className="flex shrink-0 items-center gap-2 text-white/68">
            <Clock aria-hidden="true" className="hidden h-4 w-4 text-primary-400 sm:block" />
            <span className="sm:hidden">Ter–Sex 16h–22h</span>
            <span className="hidden sm:inline">Ter–Sex 16h–22h · Sáb–Dom 08h–19h</span>
          </span>
        </div>
      </div>

      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#030504]/94 backdrop-blur-xl">
        <div className="mx-auto flex min-h-[4.5rem] max-w-[92rem] items-center justify-between gap-6 px-4 md:px-6 xl:min-h-20">
          <a href="/" className="flex shrink-0 items-center" aria-label="Kartódromo Internacional de Betim — página inicial">
            <img
              src="/brand/kib-logo.png"
              alt="Kartódromo Internacional de Betim"
              className="h-11 w-auto drop-shadow-[0_5px_18px_rgba(0,0,0,.5)] xl:h-12"
            />
          </a>

          <nav
            aria-label="Navegação principal"
            className="hidden min-w-0 items-center justify-end gap-5 font-body text-sm font-bold uppercase tracking-[0.08em] xl:flex 2xl:gap-7"
          >
            {navItems.map((item) => {
              const active = item.isActive(pathname);
              return (
                <a
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={`relative py-2 transition-colors after:absolute after:inset-x-0 after:bottom-0 after:h-px after:origin-left after:bg-primary-400 after:transition-transform ${
                    active
                      ? 'text-white after:scale-x-100'
                      : 'text-white/68 after:scale-x-0 hover:text-white hover:after:scale-x-100'
                  }`}
                >
                  {item.label}
                </a>
              );
            })}

            <a
              href="/reservas"
              aria-current={pathname === '/reservas' ? 'page' : undefined}
              className="group inline-flex min-h-11 items-center justify-center gap-2 bg-gradient-to-br from-primary-400 to-primary-600 px-5 font-display text-base uppercase tracking-[0.04em] text-ink-950 shadow-[0_14px_34px_rgba(0,230,118,.2)] [clip-path:polygon(7%_0,100%_0,93%_100%,0_100%)] transition-transform hover:-translate-y-0.5"
            >
              Reservar agora
              <ArrowRight aria-hidden="true" className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </a>
          </nav>

          <button
            ref={menuTriggerRef}
            type="button"
            aria-label="Abrir menu"
            aria-expanded={isMenuOpen}
            aria-controls="mobile-navigation"
            onClick={() => setIsMenuOpen(true)}
            className="grid h-11 w-11 shrink-0 place-items-center border border-white/15 bg-white/[.035] text-white transition-colors hover:border-primary-400 hover:text-primary-400 xl:hidden"
          >
            <Menu aria-hidden="true" className="h-6 w-6" />
          </button>
        </div>
      </header>

      <MobileNavigation
        isOpen={isMenuOpen}
        items={navItems}
        onClose={closeMenu}
        pathname={pathname}
        triggerRef={menuTriggerRef}
      />
    </>
  );
};

export default Header;
