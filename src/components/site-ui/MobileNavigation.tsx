'use client';

import { useRef, type RefObject } from 'react';
import { ArrowUpRight, Phone, X } from 'lucide-react';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { WHATSAPP_BOOKING_URL } from '../../config/booking';

export type PublicNavItem = {
  href: string;
  label: string;
  isActive: (pathname: string) => boolean;
};

type MobileNavigationProps = {
  isOpen: boolean;
  items: readonly PublicNavItem[];
  onClose: () => void;
  pathname: string;
  triggerRef: RefObject<HTMLButtonElement | null>;
};

export default function MobileNavigation({
  isOpen,
  items,
  onClose,
  pathname,
  triggerRef,
}: MobileNavigationProps) {
  const panelRef = useRef<HTMLElement>(null);

  useFocusTrap({
    active: isOpen,
    containerRef: panelRef,
    onEscape: onClose,
    returnFocusRef: triggerRef,
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[90] xl:hidden">
      <button
        type="button"
        aria-label="Fechar menu"
        className="absolute inset-0 h-full w-full cursor-default bg-black/75 backdrop-blur-sm"
        onClick={onClose}
      />

      <aside
        id="mobile-navigation"
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Menu principal"
        tabIndex={-1}
        className="absolute inset-y-0 right-0 flex w-[min(92vw,420px)] flex-col border-l border-white/12 bg-[#070b08] shadow-[-30px_0_80px_rgba(0,0,0,.52)]"
      >
        <header className="flex min-h-20 items-center justify-between border-b border-white/10 px-5">
          <a href="/" onClick={onClose} className="inline-flex items-center" aria-label="Ir para a página inicial">
            <img src="/brand/kib-logo.png" alt="Kartódromo Internacional de Betim" className="h-11 w-auto" />
          </a>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar menu"
            className="grid h-11 w-11 place-items-center border border-white/15 bg-white/[.035] text-white transition-colors hover:border-primary-400 hover:text-primary-400"
          >
            <X aria-hidden="true" className="h-6 w-6" />
          </button>
        </header>

        <nav aria-label="Navegação mobile" className="flex-1 overflow-y-auto px-5 py-5">
          <div className="grid gap-1">
            {items.map((item, index) => {
              const active = item.isActive(pathname);
              return (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  aria-current={active ? 'page' : undefined}
                  className={`group grid min-h-14 grid-cols-[2rem_1fr_auto] items-center gap-3 border-b px-1 font-display text-[1.55rem] uppercase leading-none transition-colors ${
                    active
                      ? 'border-primary-400/45 text-primary-400'
                      : 'border-white/10 text-white hover:border-primary-400/35 hover:text-primary-400'
                  }`}
                >
                  <span className="font-body text-xs font-bold tracking-[0.16em] text-white/35">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span>{item.label}</span>
                  <ArrowUpRight aria-hidden="true" className="h-5 w-5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </a>
              );
            })}
          </div>

          <a
            href="/reservas"
            onClick={onClose}
            className="mt-7 inline-flex min-h-14 w-full items-center justify-center bg-gradient-to-br from-primary-400 to-primary-600 px-6 font-display text-lg uppercase text-ink-950 shadow-[0_18px_44px_rgba(0,230,118,.22)] [clip-path:polygon(7%_0,100%_0,93%_100%,0_100%)]"
          >
            Reservar agora
          </a>
        </nav>

        <footer className="border-t border-white/10 px-5 py-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <a
              href="tel:+553135112373"
              className="flex min-h-12 items-center justify-center gap-2 border border-white/15 bg-white/[.035] px-4 text-sm font-bold text-white hover:border-primary-400 hover:text-primary-400"
            >
              <Phone aria-hidden="true" className="h-4 w-4" />
              (31) 3511-2373
            </a>
            <a
              href={WHATSAPP_BOOKING_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-12 items-center justify-center gap-2 border border-white/15 bg-white/[.035] px-4 text-sm font-bold text-white hover:border-primary-400 hover:text-primary-400"
            >
              WhatsApp
              <ArrowUpRight aria-hidden="true" className="h-4 w-4" />
            </a>
          </div>
        </footer>
      </aside>
    </div>
  );
}
