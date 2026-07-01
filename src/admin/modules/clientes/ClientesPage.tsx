import { useCallback, useEffect, useState } from 'react';
import { Card } from '../../ui/Card';
import { DataTable, type DataTableColumn } from '../../ui/DataTable';
import { PageHeader } from '../../ui/PageHeader';
import { Pagination } from '../../ui/Pagination';
import { Tabs } from '../../ui/Tabs';
import {
  listClientesCalXProPage,
  listClientesLapTimePage,
  listClientesLocalPage,
  listContatosCalXProPage,
} from './clientes.api';
import type { ClienteCalXPro, ClienteLapTime, ClienteLocal, ContatoCalXPro } from './clientes.types';

type TabKey = 'local' | 'laptime' | 'calxpro' | 'calxpro-contatos';

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

const calxproColumns: readonly DataTableColumn<ClienteCalXPro>[] = [
  { key: 'nome', label: 'Nome' },
  { key: 'email', label: 'E-mail', render: (cliente) => cliente.email ?? '—' },
  { key: 'telefone', label: 'Telefone', render: (cliente) => cliente.telefone ?? '—' },
  { key: 'documento', label: 'CPF', render: (cliente) => cliente.documento ?? '—' },
  { key: 'cidade', label: 'Cidade', render: (cliente) => cliente.cidade ?? '—' },
  {
    key: 'criadoEm',
    label: 'Cadastrado em',
    render: (cliente) => (cliente.criadoEm ? dateFormatter.format(new Date(cliente.criadoEm)) : '—'),
  },
];

const contatoColumns: readonly DataTableColumn<ContatoCalXPro>[] = [
  { key: 'nome', label: 'Nome' },
  { key: 'telefone', label: 'Telefone', render: (contato) => contato.telefone ?? '—' },
  { key: 'celular', label: 'Celular', render: (contato) => contato.celular ?? '—' },
  { key: 'cidade', label: 'Cidade', render: (contato) => contato.cidade ?? '—' },
  {
    key: 'criadoEm',
    label: 'Cadastrado em',
    render: (contato) => (contato.criadoEm ? dateFormatter.format(new Date(contato.criadoEm)) : '—'),
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

  const [calxproRows, setCalxproRows] = useState<ClienteCalXPro[]>([]);
  const [calxproTotal, setCalxproTotal] = useState(0);
  const [calxproPage, setCalxproPage] = useState(0);
  const [calxproSearchInput, setCalxproSearchInput] = useState('');
  const [calxproQuery, setCalxproQuery] = useState('');
  const [calxproLoading, setCalxproLoading] = useState(true);
  const [calxproError, setCalxproError] = useState<string | null>(null);

  const [contatosRows, setContatosRows] = useState<ContatoCalXPro[]>([]);
  const [contatosTotal, setContatosTotal] = useState(0);
  const [contatosPage, setContatosPage] = useState(0);
  const [contatosSearchInput, setContatosSearchInput] = useState('');
  const [contatosQuery, setContatosQuery] = useState('');
  const [contatosLoading, setContatosLoading] = useState(true);
  const [contatosError, setContatosError] = useState<string | null>(null);

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

  const loadCalxpro = useCallback(async () => {
    setCalxproLoading(true);
    setCalxproError(null);
    try {
      const page = await listClientesCalXProPage(calxproQuery, calxproPage, PAGE_SIZE);
      setCalxproRows(page.data);
      setCalxproTotal(page.total);
    } catch (error: unknown) {
      setCalxproError(getErrorMessage(error));
    } finally {
      setCalxproLoading(false);
    }
  }, [calxproQuery, calxproPage]);

  const loadContatos = useCallback(async () => {
    setContatosLoading(true);
    setContatosError(null);
    try {
      const page = await listContatosCalXProPage(contatosQuery, contatosPage, PAGE_SIZE);
      setContatosRows(page.data);
      setContatosTotal(page.total);
    } catch (error: unknown) {
      setContatosError(getErrorMessage(error));
    } finally {
      setContatosLoading(false);
    }
  }, [contatosQuery, contatosPage]);

  useEffect(() => {
    void loadLocal();
  }, [loadLocal]);

  useEffect(() => {
    void loadLaptime();
  }, [loadLaptime]);

  useEffect(() => {
    void loadCalxpro();
  }, [loadCalxpro]);

  useEffect(() => {
    void loadContatos();
  }, [loadContatos]);

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

  useEffect(() => {
    const handle = setTimeout(() => {
      setCalxproQuery(calxproSearchInput);
      setCalxproPage(0);
    }, 350);
    return () => clearTimeout(handle);
  }, [calxproSearchInput]);

  useEffect(() => {
    const handle = setTimeout(() => {
      setContatosQuery(contatosSearchInput);
      setContatosPage(0);
    }, 350);
    return () => clearTimeout(handle);
  }, [contatosSearchInput]);

  return (
    <section>
      <PageHeader
        subtitle="Base unificada de clientes: sistema local (SRVKART), LapTime (CRONO1) e histórico do CalXPro (sistema anterior, até jan/2025)."
        title="Clientes"
      />

      <div className="mt-6">
        <Tabs
          items={[
            { key: 'local', label: 'Local (SRVKART)' },
            { key: 'laptime', label: 'LapTime (CRONO1)' },
            { key: 'calxpro', label: 'CalXPro (histórico)' },
            { key: 'calxpro-contatos', label: 'Contatos (CalXPro)' },
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

      {activeTab === 'calxpro' ? (
        <div className="mt-5 space-y-4">
          <Card className="p-4">
            <p className="text-sm text-zinc-400">
              Clientes cadastrados no sistema anterior (CalXPro), em uso de 2002 até jan/2025, quando a operação
              migrou para o LapTime. Somente leitura. Total: {calxproTotal.toLocaleString('pt-BR')}.
            </p>
            <input
              className={`${inputClassName} mt-3 sm:max-w-xs`}
              onChange={(event) => setCalxproSearchInput(event.target.value)}
              placeholder="Buscar por nome, e-mail, telefone ou CPF..."
              value={calxproSearchInput}
            />
          </Card>
          <DataTable
            columns={calxproColumns}
            emptyLabel="Nenhum cliente encontrado."
            error={calxproError}
            loading={calxproLoading}
            onRetry={() => void loadCalxpro()}
            rows={calxproRows}
          />
          <Pagination onPageChange={setCalxproPage} page={calxproPage} pageSize={PAGE_SIZE} total={calxproTotal} />
        </div>
      ) : null}

      {activeTab === 'calxpro-contatos' ? (
        <div className="mt-5 space-y-4">
          <Card className="p-4">
            <p className="text-sm text-zinc-400">
              Contatos cadastrados no sistema anterior (CalXPro), tabela separada do cadastro de clientes
              (orçamentos, leads, agenda de contatos). Somente leitura. Total: {contatosTotal.toLocaleString('pt-BR')}.
            </p>
            <input
              className={`${inputClassName} mt-3 sm:max-w-xs`}
              onChange={(event) => setContatosSearchInput(event.target.value)}
              placeholder="Buscar por nome, telefone ou celular..."
              value={contatosSearchInput}
            />
          </Card>
          <DataTable
            columns={contatoColumns}
            emptyLabel="Nenhum contato encontrado."
            error={contatosError}
            loading={contatosLoading}
            onRetry={() => void loadContatos()}
            rows={contatosRows}
          />
          <Pagination onPageChange={setContatosPage} page={contatosPage} pageSize={PAGE_SIZE} total={contatosTotal} />
        </div>
      ) : null}
    </section>
  );
};
