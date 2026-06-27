import { ChevronLeft, ChevronRight } from 'lucide-react';

type PaginationProps = {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
};

export const Pagination = ({ page, pageSize, total, onPageChange }: PaginationProps) => {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : page * pageSize + 1;
  const end = Math.min(total, (page + 1) * pageSize);

  return (
    <div className="flex flex-col items-center justify-between gap-3 border-t border-zinc-800 px-4 py-3 text-sm text-zinc-400 sm:flex-row">
      <p>
        {total === 0 ? 'Nenhum registro' : `${start}–${end} de ${total}`}
      </p>
      <div className="flex items-center gap-2">
        <button
          aria-label="Página anterior"
          className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
          disabled={page <= 0}
          onClick={() => onPageChange(page - 1)}
          type="button"
        >
          <ChevronLeft aria-hidden="true" size={16} />
        </button>
        <span className="min-w-20 text-center text-xs font-medium text-zinc-300">
          Página {page + 1} de {totalPages}
        </span>
        <button
          aria-label="Próxima página"
          className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
          disabled={page + 1 >= totalPages}
          onClick={() => onPageChange(page + 1)}
          type="button"
        >
          <ChevronRight aria-hidden="true" size={16} />
        </button>
      </div>
    </div>
  );
};
