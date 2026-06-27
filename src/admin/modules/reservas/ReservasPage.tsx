import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { canAccess } from '../../lib/rbac';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import { DataTable, type DataTableColumn } from '../../ui/DataTable';
import { FormField } from '../../ui/FormField';
import { Modal } from '../../ui/Modal';
import { PageHeader } from '../../ui/PageHeader';
import { Pagination } from '../../ui/Pagination';
import { Tabs } from '../../ui/Tabs';
import { useToast } from '../../ui/useToast';
import {
  listLapTimeBookingCustomers,
  listLapTimeBookingsPage,
  type LapTimeBooking,
  type LapTimeBookingCustomer,
  type LapTimeBookingsFilters,
} from './laptime-bookings.api';
import {
  createReserva,
  listClientes,
  listPistas,
  listReservasPage,
  removeReserva,
  updateReserva,
  type ReservasFilters,
} from './reservas.api';
import type {
  Cliente,
  Pista,
  ReservaPayload,
  ReservaStatus,
  ReservaWithRelations,
} from './reservas.types';

const PAGE_SIZE = 10;
type ReservasTabKey = 'agenda' | 'manual';

type ReservaFormState = {
  cliente_id: string;
  pista_id: string;
  data_inicio: string;
  data_fim: string;
  qtd_pilotos: string;
  valor: string;
  status: ReservaStatus;
  notes: string;
};

type ReservaFormErrors = Partial<Record<keyof ReservaFormState, string>>;

const emptyForm: ReservaFormState = {
  cliente_id: '',
  pista_id: '',
  data_inicio: '',
  data_fim: '',
  qtd_pilotos: '1',
  valor: '0',
  status: 'pendente',
  notes: '',
};

const inputClassName =
  'w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20';

const statusLabels: Record<ReservaStatus, string> = {
  pendente: 'Pendente',
  confirmada: 'Confirmada',
  cancelada: 'Cancelada',
  concluida: 'Concluída',
};

const statusClasses: Record<ReservaStatus, string> = {
  pendente: 'border-amber-800 bg-amber-950 text-amber-200',
  confirmada: 'border-brand-800 bg-brand-950 text-brand-100',
  cancelada: 'border-red-900 bg-red-950 text-red-200',
  concluida: 'border-sky-900 bg-sky-950 text-sky-200',
};

const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
});

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'Ocorreu um erro inesperado.';

const toDateTimeLocal = (value: string | null): string => {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  const localTime = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localTime.toISOString().slice(0, 16);
};

const reservaToForm = (reserva: ReservaWithRelations): ReservaFormState => ({
  cliente_id: reserva.cliente_id ?? '',
  pista_id: reserva.pista_id ?? '',
  data_inicio: toDateTimeLocal(reserva.data_inicio),
  data_fim: toDateTimeLocal(reserva.data_fim),
  qtd_pilotos: String(reserva.qtd_pilotos),
  valor: String(reserva.valor),
  status: reserva.status,
  notes: reserva.notes ?? '',
});

const validateForm = (form: ReservaFormState): ReservaFormErrors => {
  const errors: ReservaFormErrors = {};
  const pilots = Number(form.qtd_pilotos);
  const value = Number(form.valor);

  if (!form.cliente_id) errors.cliente_id = 'Selecione um cliente.';
  if (!form.pista_id) errors.pista_id = 'Selecione uma pista.';
  if (!form.data_inicio) errors.data_inicio = 'Informe a data de início.';
  if (!Number.isInteger(pilots) || pilots < 1) {
    errors.qtd_pilotos = 'Informe pelo menos um piloto.';
  }
  if (!Number.isFinite(value) || value < 0) {
    errors.valor = 'Informe um valor válido.';
  }
  if (
    form.data_inicio &&
    form.data_fim &&
    new Date(form.data_fim).getTime() <= new Date(form.data_inicio).getTime()
  ) {
    errors.data_fim = 'A data final deve ser posterior ao início.';
  }

  return errors;
};

export const ReservasPage = () => {
  const { role } = useAuth();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<ReservasTabKey>('agenda');

  const [bookings, setBookings] = useState<LapTimeBooking[]>([]);
  const [bookingsTotal, setBookingsTotal] = useState(0);
  const [bookingsPage, setBookingsPage] = useState(0);
  const [bookingsSearchInput, setBookingsSearchInput] = useState('');
  const [bookingsFilters, setBookingsFilters] = useState<LapTimeBookingsFilters>({ status: 'aberta' });
  const [bookingsLoading, setBookingsLoading] = useState(true);
  const [bookingsError, setBookingsError] = useState<string | null>(null);
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [bookingCustomers, setBookingCustomers] = useState<LapTimeBookingCustomer[]>([]);
  const [bookingCustomersLoading, setBookingCustomersLoading] = useState(false);
  const [bookingCustomersError, setBookingCustomersError] = useState<string | null>(null);

  const [reservas, setReservas] = useState<ReservaWithRelations[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [filters, setFilters] = useState<ReservasFilters>({ status: '', q: '' });
  const [searchInput, setSearchInput] = useState('');
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [pistas, setPistas] = useState<Pista[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editingReserva, setEditingReserva] = useState<ReservaWithRelations | null>(null);
  const [deletingReserva, setDeletingReserva] = useState<ReservaWithRelations | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState<ReservaFormState>(emptyForm);
  const [formErrors, setFormErrors] = useState<ReservaFormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const canWrite =
    canAccess(role, 'reservas') && ['owner', 'admin', 'recepcao'].includes(role);

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    try {
      const [reservasPage, clientesData, pistasData] = await Promise.all([
        listReservasPage(filters, page, PAGE_SIZE),
        listClientes(),
        listPistas(),
      ]);
      setReservas(reservasPage.data);
      setTotal(reservasPage.total);
      setClientes(clientesData);
      setPistas(pistasData);
    } catch (error: unknown) {
      setLoadError(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [filters, page]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // debounce free-text search before it becomes a filter (and resets to page 0)
  useEffect(() => {
    const handle = setTimeout(() => {
      setFilters((current) => ({ ...current, q: searchInput }));
      setPage(0);
    }, 350);
    return () => clearTimeout(handle);
  }, [searchInput]);

  const updateStatusFilter = (status: ReservaStatus | '') => {
    setFilters((current) => ({ ...current, status }));
    setPage(0);
  };

  const loadBookings = useCallback(async () => {
    setBookingsLoading(true);
    setBookingsError(null);
    try {
      const result = await listLapTimeBookingsPage(bookingsFilters, bookingsPage, PAGE_SIZE);
      setBookings(result.data);
      setBookingsTotal(result.total);
      setSelectedBookingId((current) =>
        current && result.data.some((booking) => booking.id === current) ? current : result.data[0]?.id ?? null,
      );
    } catch (error: unknown) {
      setBookingsError(getErrorMessage(error));
    } finally {
      setBookingsLoading(false);
    }
  }, [bookingsFilters, bookingsPage]);

  const loadBookingCustomers = useCallback(async () => {
    if (!selectedBookingId) {
      setBookingCustomers([]);
      setBookingCustomersError(null);
      return;
    }
    setBookingCustomersLoading(true);
    setBookingCustomersError(null);
    try {
      setBookingCustomers(await listLapTimeBookingCustomers(selectedBookingId));
    } catch (error: unknown) {
      setBookingCustomersError(getErrorMessage(error));
    } finally {
      setBookingCustomersLoading(false);
    }
  }, [selectedBookingId]);

  useEffect(() => {
    if (activeTab === 'agenda') void loadBookings();
  }, [activeTab, loadBookings]);

  useEffect(() => {
    if (activeTab === 'agenda') void loadBookingCustomers();
  }, [activeTab, loadBookingCustomers]);

  useEffect(() => {
    const handle = setTimeout(() => {
      setBookingsFilters((current) => ({ ...current, q: bookingsSearchInput || undefined }));
      setBookingsPage(0);
    }, 350);
    return () => clearTimeout(handle);
  }, [bookingsSearchInput]);

  const updateBookingsStatusFilter = (status: 'aberta' | 'encerrada' | '') => {
    setBookingsFilters((current) => ({ ...current, status }));
    setBookingsPage(0);
  };

  const selectedBooking = useMemo(
    () => bookings.find((booking) => booking.id === selectedBookingId) ?? null,
    [bookings, selectedBookingId],
  );

  const bookingColumns = useMemo<readonly DataTableColumn<LapTimeBooking>[]>(
    () => [
      {
        key: 'nome',
        label: 'Bateria',
        render: (booking) => (
          <button
            className={`text-left font-bold underline-offset-4 hover:underline ${
              selectedBookingId === booking.id ? 'text-brand-300' : 'text-white'
            }`}
            onClick={() => setSelectedBookingId(booking.id)}
            type="button"
          >
            {booking.nome}
          </button>
        ),
      },
      {
        key: 'dataHora',
        label: 'Data/hora',
        render: (booking) => dateFormatter.format(new Date(booking.dataHora)),
      },
      {
        key: 'vagasTotal',
        label: 'Vagas',
        render: (booking) => `${booking.vagasTotal - booking.vagasLivres}/${booking.vagasTotal}`,
      },
      { key: 'pagos', label: 'Pagos' },
      { key: 'aprovados', label: 'Aprovados' },
      { key: 'pendentes', label: 'Pendentes' },
      {
        key: 'encerrada',
        label: 'Status',
        render: (booking) => (
          <span
            className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${
              booking.encerrada
                ? 'border-zinc-700 bg-zinc-900 text-zinc-400'
                : 'border-brand-800 bg-brand-950 text-brand-100'
            }`}
          >
            {booking.encerrada ? 'Encerrada' : 'Aberta'}
          </span>
        ),
      },
    ],
    [selectedBookingId],
  );

  const bookingCustomerColumns = useMemo<readonly DataTableColumn<LapTimeBookingCustomer>[]>(
    () => [
      { key: 'clienteNome', label: 'Cliente' },
      { key: 'clienteTelefone', label: 'Telefone', render: (item) => item.clienteTelefone ?? '—' },
      {
        key: 'preco',
        label: 'Valor',
        render: (item) => currencyFormatter.format(item.preco),
      },
      {
        key: 'pagou',
        label: 'Pagamento',
        render: (item) => (
          <span
            className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${
              item.pagou
                ? 'border-brand-800 bg-brand-950 text-brand-100'
                : 'border-amber-800 bg-amber-950 text-amber-200'
            }`}
          >
            {item.pagou ? 'Pago' : 'Pendente'}
          </span>
        ),
      },
      {
        key: 'aprovado',
        label: 'Aprovação',
        render: (item) => (
          <span
            className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${
              item.aprovado
                ? 'border-brand-800 bg-brand-950 text-brand-100'
                : 'border-amber-800 bg-amber-950 text-amber-200'
            }`}
          >
            {item.aprovado ? 'Aprovado' : 'Pendente'}
          </span>
        ),
      },
      {
        key: 'cancelado',
        label: 'Cancelado',
        render: (item) => (item.cancelado ? 'Sim' : 'Não'),
      },
    ],
    [],
  );

  const columns = useMemo<readonly DataTableColumn<ReservaWithRelations>[]>(
    () => [
      {
        key: 'cliente_id',
        label: 'Cliente',
        render: (reserva) => reserva.clientes?.nome ?? 'Cliente removido',
      },
      {
        key: 'pista_id',
        label: 'Pista',
        render: (reserva) => reserva.pistas?.nome ?? 'Pista não definida',
      },
      {
        key: 'data_inicio',
        label: 'Início',
        render: (reserva) => dateFormatter.format(new Date(reserva.data_inicio)),
      },
      { key: 'qtd_pilotos', label: 'Pilotos' },
      {
        key: 'valor',
        label: 'Valor',
        render: (reserva) => currencyFormatter.format(Number(reserva.valor)),
      },
      {
        key: 'status',
        label: 'Status',
        render: (reserva) => (
          <span
            className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${statusClasses[reserva.status]}`}
          >
            {statusLabels[reserva.status]}
          </span>
        ),
      },
    ],
    [],
  );

  const openCreateModal = () => {
    setEditingReserva(null);
    setForm(emptyForm);
    setFormErrors({});
    setIsFormOpen(true);
  };

  const openEditModal = (reserva: ReservaWithRelations) => {
    setEditingReserva(reserva);
    setForm(reservaToForm(reserva));
    setFormErrors({});
    setIsFormOpen(true);
  };

  const closeFormModal = () => {
    if (!submitting) {
      setIsFormOpen(false);
    }
  };

  const updateForm = <K extends keyof ReservaFormState>(
    field: K,
    value: ReservaFormState[K],
  ) => {
    setForm((current) => ({ ...current, [field]: value }));
    setFormErrors((current) => ({ ...current, [field]: undefined }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const errors = validateForm(form);
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    const payload: ReservaPayload = {
      cliente_id: form.cliente_id || null,
      pista_id: form.pista_id || null,
      data_inicio: new Date(form.data_inicio).toISOString(),
      data_fim: form.data_fim ? new Date(form.data_fim).toISOString() : null,
      qtd_pilotos: Number(form.qtd_pilotos),
      valor: Number(form.valor),
      status: form.status,
      notes: form.notes.trim() || null,
    };

    setSubmitting(true);
    try {
      if (editingReserva) {
        await updateReserva(editingReserva.id, payload);
        toast.success('Reserva atualizada com sucesso.');
      } else {
        await createReserva(payload);
        toast.success('Reserva criada com sucesso.');
      }
      setIsFormOpen(false);
      await loadData();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingReserva) {
      return;
    }

    setDeleting(true);
    try {
      await removeReserva(deletingReserva.id);
      toast.success('Reserva excluída com sucesso.');
      setDeletingReserva(null);
      await loadData();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <section>
      <PageHeader
        actionLabel={activeTab === 'manual' && canWrite ? 'Nova reserva' : undefined}
        onAction={activeTab === 'manual' && canWrite ? openCreateModal : undefined}
        subtitle="Agenda real de baterias do LapTime e cadastro manual local de reservas."
        title="Reservas"
      />

      <div className="mt-6">
        <Tabs
          items={[
            { key: 'agenda', label: 'Agenda real (LapTime)' },
            { key: 'manual', label: 'Manual (local)' },
          ]}
          onChange={(key) => setActiveTab(key as ReservasTabKey)}
          value={activeTab}
        />
      </div>

      {activeTab === 'agenda' ? (
        <div className="mt-6 space-y-5">
          <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
            <input
              className={`${inputClassName} sm:max-w-xs`}
              onChange={(event) => setBookingsSearchInput(event.target.value)}
              placeholder="Buscar por nome da bateria..."
              value={bookingsSearchInput}
            />
            <select
              className={`${inputClassName} sm:max-w-[180px]`}
              onChange={(event) => updateBookingsStatusFilter(event.target.value as 'aberta' | 'encerrada' | '')}
              value={bookingsFilters.status ?? ''}
            >
              <option value="">Todos os status</option>
              <option value="aberta">Aberta</option>
              <option value="encerrada">Encerrada</option>
            </select>
            <input
              className={`${inputClassName} sm:max-w-[180px]`}
              onChange={(event) =>
                setBookingsFilters((current) => ({ ...current, from: event.target.value || undefined }))
              }
              type="date"
              value={bookingsFilters.from ?? ''}
            />
            <input
              className={`${inputClassName} sm:max-w-[180px]`}
              onChange={(event) =>
                setBookingsFilters((current) => ({ ...current, to: event.target.value || undefined }))
              }
              type="date"
              value={bookingsFilters.to ?? ''}
            />
          </Card>

          <DataTable
            columns={bookingColumns}
            emptyLabel="Nenhuma bateria encontrada."
            error={bookingsError}
            loading={bookingsLoading}
            onRetry={() => void loadBookings()}
            rows={bookings}
          />
          <Pagination onPageChange={setBookingsPage} page={bookingsPage} pageSize={PAGE_SIZE} total={bookingsTotal} />

          <div className="border-t border-zinc-800 pt-6">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-300">
              Reservas da bateria selecionada
            </p>
            <h2 className="mt-2 text-xl font-black text-white">{selectedBooking?.nome ?? 'Selecione uma bateria'}</h2>
            <div className="mt-4">
              <DataTable
                columns={bookingCustomerColumns}
                emptyLabel={selectedBooking ? 'Nenhuma reserva para esta bateria.' : 'Selecione uma bateria na tabela acima.'}
                error={bookingCustomersError}
                loading={bookingCustomersLoading}
                onRetry={() => void loadBookingCustomers()}
                rows={bookingCustomers}
              />
            </div>
          </div>
        </div>
      ) : null}

      {activeTab === 'manual' ? (
        <>
          <div className="mt-6 flex flex-wrap items-end gap-4">
            <div className="w-full max-w-xs">
              <FormField htmlFor="reservas-busca" label="Buscar">
                <input
                  className={inputClassName}
                  id="reservas-busca"
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="Cliente ou pista"
                  value={searchInput}
                />
              </FormField>
            </div>
            <div className="w-full max-w-xs">
              <FormField htmlFor="reservas-status-filtro" label="Status">
                <select
                  className={inputClassName}
                  id="reservas-status-filtro"
                  onChange={(event) => updateStatusFilter(event.target.value as ReservaStatus | '')}
                  value={filters.status}
                >
                  <option value="">Todos</option>
                  {Object.entries(statusLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </FormField>
            </div>
          </div>

          <div className="mt-4">
            <DataTable
              columns={columns}
              emptyLabel="Nenhuma reserva encontrada."
              error={loadError}
              loading={loading}
              onDelete={canWrite ? setDeletingReserva : undefined}
              onEdit={canWrite ? openEditModal : undefined}
              onRetry={() => void loadData()}
              rows={reservas}
            />
            <Pagination onPageChange={setPage} page={page} pageSize={PAGE_SIZE} total={total} />
          </div>
        </>
      ) : null}

      <Modal
        footer={
          <>
            <Button disabled={submitting} onClick={closeFormModal} variant="ghost">
              Cancelar
            </Button>
            <Button form="reserva-form" loading={submitting} type="submit">
              {editingReserva ? 'Salvar alterações' : 'Criar reserva'}
            </Button>
          </>
        }
        isOpen={isFormOpen}
        onClose={closeFormModal}
        title={editingReserva ? 'Editar reserva' : 'Nova reserva'}
      >
        <form className="grid gap-5 md:grid-cols-2" id="reserva-form" onSubmit={handleSubmit}>
          <FormField error={formErrors.cliente_id} htmlFor="reserva-cliente" label="Cliente">
            <select
              className={inputClassName}
              id="reserva-cliente"
              onChange={(event) => updateForm('cliente_id', event.target.value)}
              required
              value={form.cliente_id}
            >
              <option value="">Selecione</option>
              {clientes.map((cliente) => (
                <option key={cliente.id} value={cliente.id}>
                  {cliente.nome}
                </option>
              ))}
            </select>
          </FormField>

          <FormField error={formErrors.pista_id} htmlFor="reserva-pista" label="Pista">
            <select
              className={inputClassName}
              id="reserva-pista"
              onChange={(event) => updateForm('pista_id', event.target.value)}
              required
              value={form.pista_id}
            >
              <option value="">Selecione</option>
              {pistas.map((pista) => (
                <option key={pista.id} value={pista.id}>
                  {pista.nome}{pista.ativa ? '' : ' (inativa)'}
                </option>
              ))}
            </select>
          </FormField>

          <FormField
            error={formErrors.data_inicio}
            htmlFor="reserva-inicio"
            label="Início"
          >
            <input
              className={inputClassName}
              id="reserva-inicio"
              onChange={(event) => updateForm('data_inicio', event.target.value)}
              required
              type="datetime-local"
              value={form.data_inicio}
            />
          </FormField>

          <FormField error={formErrors.data_fim} htmlFor="reserva-fim" label="Fim">
            <input
              className={inputClassName}
              id="reserva-fim"
              onChange={(event) => updateForm('data_fim', event.target.value)}
              type="datetime-local"
              value={form.data_fim}
            />
          </FormField>

          <FormField
            error={formErrors.qtd_pilotos}
            htmlFor="reserva-pilotos"
            label="Quantidade de pilotos"
          >
            <input
              className={inputClassName}
              id="reserva-pilotos"
              min="1"
              onChange={(event) => updateForm('qtd_pilotos', event.target.value)}
              required
              step="1"
              type="number"
              value={form.qtd_pilotos}
            />
          </FormField>

          <FormField error={formErrors.valor} htmlFor="reserva-valor" label="Valor (R$)">
            <input
              className={inputClassName}
              id="reserva-valor"
              min="0"
              onChange={(event) => updateForm('valor', event.target.value)}
              required
              step="0.01"
              type="number"
              value={form.valor}
            />
          </FormField>

          <FormField htmlFor="reserva-status" label="Status">
            <select
              className={inputClassName}
              id="reserva-status"
              onChange={(event) =>
                updateForm('status', event.target.value as ReservaStatus)
              }
              value={form.status}
            >
              {Object.entries(statusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </FormField>

          <div className="md:col-span-2">
            <FormField htmlFor="reserva-notes" label="Observações">
              <textarea
                className={`${inputClassName} min-h-28 resize-y`}
                id="reserva-notes"
                onChange={(event) => updateForm('notes', event.target.value)}
                placeholder="Informações adicionais sobre a reserva"
                value={form.notes}
              />
            </FormField>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(deletingReserva)}
        loading={deleting}
        message={`A reserva de ${deletingReserva?.clientes?.nome ?? 'este cliente'} será excluída permanentemente.`}
        onClose={() => setDeletingReserva(null)}
        onConfirm={() => void handleDelete()}
        title="Excluir reserva"
      />
    </section>
  );
};
