import { X } from 'lucide-react';
import { useEffect, useId, type PropsWithChildren, type ReactNode } from 'react';

type ModalProps = PropsWithChildren<{
  isOpen: boolean;
  title: string;
  onClose: () => void;
  footer?: ReactNode;
}>;

export const Modal = ({ children, footer, isOpen, onClose, title }: ModalProps) => {
  const titleId = useId();

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fade-in"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section
        aria-labelledby={titleId}
        aria-modal="true"
        className="flex max-h-[calc(100vh-2rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 shadow-elevated animate-scale-in"
        role="dialog"
      >
        <header className="flex items-center justify-between gap-4 border-b border-zinc-800 px-5 py-4 md:px-6">
          <h2 className="text-base font-semibold text-zinc-50" id={titleId}>
            {title}
          </h2>
          <button
            aria-label="Fechar modal"
            className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
            onClick={onClose}
            type="button"
          >
            <X aria-hidden="true" size={20} />
          </button>
        </header>

        <div className="overflow-y-auto px-5 py-5 md:px-6">{children}</div>

        {footer ? (
          <footer className="flex flex-wrap justify-end gap-3 border-t border-zinc-800 px-5 py-4 md:px-6">
            {footer}
          </footer>
        ) : null}
      </section>
    </div>
  );
};
