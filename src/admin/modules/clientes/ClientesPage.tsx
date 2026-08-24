import { useCallback, useEffect, useState } from 'react';
import { Card } from '../../ui/Card';
import { DataTable, type DataTableColumn } from '../../ui/DataTable';
import { PageHeader } from '../../ui/PageHeader';
import { Pagination } from '../../ui/Pagination';
import { listClientesPage } from './clientes.api';
import type { Cliente } from './clientes.types';

const PAGE_SIZE = 10;

const inputClassName =
  'w-full rounded-lg border border-zinc-700 bg-zinc-950 min-h-[44px] px-3 py-2 sm:min-h-0 sm:py-2.5 text-sm text-white placeholder:text-zinc-600 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20';

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'Ocorreu um erro inesperado.';

const dateFormatter = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' });

const columns: readonly DataTableColumn<Cliente>[] = [
  { key: 'nome', label: 'Nome' },
  { key: 'email', label: 'E-mail', render: (cliente) => cliente.email ?? '—' },
  { key: 'telefone', label: 'Telefone', render: (cliente) => cliente.telefone ?? '—' },
  { key: 'cpf', label: 'CPF', render: (cliente) => cliente.cpf ?? '—' },
  {
    key: 'cidade',
    label: 'Cidade/UF',
    render: (cliente) => [cliente.cidade, cliente.estado].filter(Boolean).join(' / ') || '—',
  },
  {
    key: 'created_at',
    label: 'Cadastrado em',
    render: (cliente) => (cliente.created_at ? dateFormatter.format(new Date(cliente.created_at)) : '—'),
  },
];

export const ClientesPage = () => {
  const [rows, setRows] = useState<Cliente[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [searchInput, setSearchInput] = useState('');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listClientesPage(query, page, PAGE_SIZE);
      setRows(result.data);
      setTotal(result.total);
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [query, page]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const handle = setTimeout(() => {
      setQuery(searchInput);
      setPage(0);
    }, 350);
    return () => clearTimeout(handle);
  }, [searchInput]);

  return (
    <section>
      <PageHeader subtitle="Cadastro completo de clientes." title="Clientes" />

      <div className="mt-6 space-y-4">
        <Card className="p-4">
          <p className="text-sm text-zinc-400">Total: {total.toLocaleString('pt-BR')}.</p>
          <input
            className={`${inputClassName} mt-3 sm:max-w-xs`}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Buscar por nome, e-mail, telefone ou CPF..."
            value={searchInput}
          />
        </Card>
        <DataTable
          columns={columns}
          emptyLabel="Nenhum cliente encontrado."
          error={error}
          loading={loading}
          onRetry={() => void load()}
          rows={rows}
        />
        <Pagination onPageChange={setPage} page={page} pageSize={PAGE_SIZE} total={total} />
      </div>
    </section>
  );
};
