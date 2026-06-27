import { useCallback, useEffect, useState } from 'react';
import { Card } from '../../ui/Card';
import { DataTable, type DataTableColumn } from '../../ui/DataTable';
import { PageHeader } from '../../ui/PageHeader';
import { Pagination } from '../../ui/Pagination';
import { Tabs } from '../../ui/Tabs';
import { listClientesLapTimePage, listClientesLocalPage } from './clientes.api';
import type { ClienteLapTime, ClienteLocal } from './clientes.types';

type TabKey = 'local' | 'laptime';

const PAGE_SIZE = 10;

const inputClassName =
  'w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20';

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'Ocorreu um erro inesperado.';

const dateFormatter = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' });

const localColumns: readonly DataTableColumn<ClienteLocal>[] = [
  { key: 'nome', label: 'Nome' },
  { key: 'email', label: 'E-mail', render: (cliente) => cliente.email ?? '—' },
  { key: 'telefone', label: 'Telefone', render: (cliente) => cliente.telefone ?? '—' },
  { key: 'cpf', label: 'CPF', render: (cliente) => cliente.cpf ?? '—' },
];

const laptimeColumns: readonly DataTableColumn<ClienteLapTime>[] = [
  { key: 'nome', label: 'Nome' },
  { key: 'email', label: 'E-mail', render: (cliente) => cliente.email ?? '—' },
  { key: 'telefone', label: 'Telefone', render: (cliente) => cliente.telefone ?? '—' },
  { key: 'documento', label: 'Documento', render: (cliente) => cliente.documento ?? '—' },
  {
    key: 'cidade',
    label: 'Cidade/UF',
    render: (cliente) => [cliente.cidade, cliente.estado].filter(Boolean).join(' / ') || '—',
  },
  {
    key: 'criadoEm',
    label: 'Cadastrado em',
    render: (cliente) => (cliente.criadoEm ? dateFormatter.format(new Date(cliente.criadoEm)) : '—'),
  },
];

export const ClientesPage = () => {
  const [activeTab, setActiveTab] = useState<TabKey>('local');

  const [localRows, setLocalRows] = useState<ClienteLocal[]>([]);
  const [localTotal, setLocalTotal] = useState(0);
  const [localPage, setLocalPage] = useState(0);
  const [localSearchInput, setLocalSearchInput] = useState('');
  const [localQuery, setLocalQuery] = useState('');
  const [localLoading, setLocalLoading] = useState(true);
  const [localError, setLocalError] = useState<string | null>(null);

  const [laptimeRows, setLaptimeRows] = useState<ClienteLapTime[]>([]);
  const [laptimeTotal, setLaptimeTotal] = useState(0);
  const [laptimePage, setLaptimePage] = useState(0);
  const [laptimeSearchInput, setLaptimeSearchInput] = useState('');
  const [laptimeQuery, setLaptimeQuery] = useState('');
  const [laptimeLoading, setLaptimeLoading] = useState(true);
  const [laptimeError, setLaptimeError] = useState<string | null>(null);

  const loadLocal = useCallback(async () => {
    setLocalLoading(true);
    setLocalError(null);
    try {
      const page = await listClientesLocalPage(localQuery, localPage, PAGE_SIZE);
      setLocalRows(page.data);
      setLocalTotal(page.total);
    } catch (error: unknown) {
      setLocalError(getErrorMessage(error));
    } finally {
      setLocalLoading(false);
    }
  }, [localQuery, localPage]);

  const loadLaptime = useCallback(async () => {
    setLaptimeLoading(true);
    setLaptimeError(null);
    try {
      const page = await listClientesLapTimePage(laptimeQuery, laptimePage, PAGE_SIZE);
      setLaptimeRows(page.data);
      setLaptimeTotal(page.total);
    } catch (error: unknown) {
      setLaptimeError(getErrorMessage(error));
    } finally {
      setLaptimeLoading(false);
    }
  }, [laptimeQuery, laptimePage]);

  useEffect(() => {
    void loadLocal();
  }, [loadLocal]);

  useEffect(() => {
    void loadLaptime();
  }, [loadLaptime]);

  useEffect(() => {
    const handle = setTimeout(() => {
      setLocalQuery(localSearchInput);
      setLocalPage(0);
    }, 350);
    return () => clearTimeout(handle);
  }, [localSearchInput]);

  useEffect(() => {
    const handle = setTimeout(() => {
      setLaptimeQuery(laptimeSearchInput);
      setLaptimePage(0);
    }, 350);
    return () => clearTimeout(handle);
  }, [laptimeSearchInput]);

  return (
    <section>
      <PageHeader
        subtitle="Base unificada de clientes cadastrados no sistema local (SRVKART) e no LapTime (CRONO1)."
        title="Clientes"
      />

      <div className="mt-6">
        <Tabs
          items={[
            { key: 'local', label: 'Local (SRVKART)' },
            { key: 'laptime', label: 'LapTime (CRONO1)' },
          ]}
          onChange={(key) => setActiveTab(key as TabKey)}
          value={activeTab}
        />
      </div>

      {activeTab === 'local' ? (
        <div className="mt-5 space-y-4">
          <Card className="p-4">
            <p className="text-sm text-zinc-400">
              Clientes cadastrados via reservas e atendimentos neste sistema. Total: {localTotal.toLocaleString('pt-BR')}.
            </p>
            <input
              className={`${inputClassName} mt-3 sm:max-w-xs`}
              onChange={(event) => setLocalSearchInput(event.target.value)}
              placeholder="Buscar por nome, e-mail, telefone ou CPF..."
              value={localSearchInput}
            />
          </Card>
          <DataTable
            columns={localColumns}
            emptyLabel="Nenhum cliente encontrado."
            error={localError}
            loading={localLoading}
            onRetry={() => void loadLocal()}
            rows={localRows}
          />
          <Pagination onPageChange={setLocalPage} page={localPage} pageSize={PAGE_SIZE} total={localTotal} />
        </div>
      ) : null}

      {activeTab === 'laptime' ? (
        <div className="mt-5 space-y-4">
          <Card className="p-4">
            <p className="text-sm text-zinc-400">
              Clientes cadastrados na cronometragem (banco LapTime, servidor CRONO1). Total:{' '}
              {laptimeTotal.toLocaleString('pt-BR')}.
            </p>
            <input
              className={`${inputClassName} mt-3 sm:max-w-xs`}
              onChange={(event) => setLaptimeSearchInput(event.target.value)}
              placeholder="Buscar por nome, e-mail, telefone ou documento..."
              value={laptimeSearchInput}
            />
          </Card>
          <DataTable
            columns={laptimeColumns}
            emptyLabel="Nenhum cliente encontrado."
            error={laptimeError}
            loading={laptimeLoading}
            onRetry={() => void loadLaptime()}
            rows={laptimeRows}
          />
          <Pagination onPageChange={setLaptimePage} page={laptimePage} pageSize={PAGE_SIZE} total={laptimeTotal} />
        </div>
      ) : null}
    </section>
  );
};
