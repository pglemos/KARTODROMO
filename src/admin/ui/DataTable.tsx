import { AlertCircle, Inbox, Pencil, RefreshCw, Trash2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from './Button';

export type DataTableColumn<T> = {
  key: keyof T;
  label: string;
  render?: (row: T) => ReactNode;
};

type DataTableProps<T extends { id: string | number }> = {
  columns: readonly DataTableColumn<T>[];
  rows: readonly T[];
  loading: boolean;
  error: string | null;
  emptyLabel: string;
  onEdit?: (row: T) => void;
  onDelete?: (row: T) => void;
  onRetry?: () => void;
};

const getCellValue = <T,>(row: T, key: keyof T): ReactNode => {
  const value = row[key];
  return value === null || value === undefined ? '—' : String(value);
};

const headClass =
  'whitespace-nowrap px-4 py-3 text-xs font-medium uppercase tracking-wider text-kib-texto-3';

export const DataTable = <T extends { id: string | number },>({
  columns,
  emptyLabel,
  error,
  loading,
  onDelete,
  onEdit,
  onRetry,
  rows,
}: DataTableProps<T>) => {
  const hasActions = Boolean(onEdit || onDelete);

  if (error) {
    return (
      <div className="flex min-h-52 flex-col items-center justify-center rounded-xl border border-kib-perigo/60 bg-kib-perigo-fundo p-8 text-center">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-kib-perigo-solido/10 text-kib-perigo">
          <AlertCircle aria-hidden="true" size={22} />
        </span>
        <p className="mt-3 text-sm text-kib-perigo" role="alert">
          {error}
        </p>
        {onRetry ? (
          <Button className="mt-4" onClick={onRetry} variant="ghost">
            <RefreshCw aria-hidden="true" size={15} />
            Tentar novamente
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-kib-borda bg-kib-superficie shadow-card">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left">
          <thead className="border-b border-kib-borda">
            <tr>
              {columns.map((column) => (
                <th className={headClass} key={String(column.key)} scope="col">
                  {column.label}
                </th>
              ))}
              {hasActions ? (
                <th className={`${headClass} text-right`} scope="col">
                  Ações
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 5 }, (_, rowIndex) => (
                  <tr
                    aria-hidden="true"
                    className="border-b border-kib-borda last:border-0"
                    key={`loading-${rowIndex}`}
                  >
                    {columns.map((column) => (
                      <td className="px-4 py-3.5" key={String(column.key)}>
                        <span className="block h-4 animate-pulse rounded bg-kib-campo" />
                      </td>
                    ))}
                    {hasActions ? (
                      <td className="px-4 py-3.5">
                        <span className="ml-auto block h-7 w-16 animate-pulse rounded bg-kib-campo" />
                      </td>
                    ) : null}
                  </tr>
                ))
              : rows.map((row) => (
                  <tr
                    className="border-b border-kib-borda transition-colors last:border-0 hover:bg-kib-campo"
                    key={row.id}
                  >
                    {columns.map((column) => (
                      <td
                        className="whitespace-nowrap px-4 py-3.5 text-sm text-kib-texto-2"
                        key={String(column.key)}
                      >
                        {column.render ? column.render(row) : getCellValue(row, column.key)}
                      </td>
                    ))}
                    {hasActions ? (
                      <td className="px-4 py-2.5">
                        <div className="flex justify-end gap-1">
                          {onEdit ? (
                            <button
                              aria-label="Editar registro"
                              className="flex h-8 w-8 items-center justify-center rounded-md text-kib-texto-2 transition-colors hover:bg-kib-campo hover:text-kib-texto"
                              onClick={() => onEdit(row)}
                              type="button"
                            >
                              <Pencil aria-hidden="true" size={15} />
                            </button>
                          ) : null}
                          {onDelete ? (
                            <button
                              aria-label="Excluir registro"
                              className="flex h-8 w-8 items-center justify-center rounded-md text-kib-texto-2 transition-colors hover:bg-kib-perigo-solido/10 hover:text-kib-perigo"
                              onClick={() => onDelete(row)}
                              type="button"
                            >
                              <Trash2 aria-hidden="true" size={15} />
                            </button>
                          ) : null}
                        </div>
                      </td>
                    ) : null}
                  </tr>
                ))}
          </tbody>
        </table>
      </div>

      {!loading && rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-kib-campo text-kib-texto-3">
            <Inbox aria-hidden="true" size={22} />
          </span>
          <p className="mt-3 text-sm text-kib-texto-2">{emptyLabel}</p>
        </div>
      ) : null}
    </div>
  );
};
