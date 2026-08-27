import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Headphones,
  RefreshCw,
  UserRound,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { humanizeAdminError } from '@/lib/admin-error-messages';
import { useAuth } from '../../auth/AuthContext';
import { canAccess } from '../../lib/rbac';
import { Button } from '../../ui/Button';
import { FormField } from '../../ui/FormField';
import { Modal } from '../../ui/Modal';
import { PageHeader } from '../../ui/PageHeader';
import { useToast } from '../../ui/useToast';
import {
  createAtendimento,
  listAtendimentos,
  listClientes,
  listReservas,
  updateStatus,
} from './recepcao.api';
import type {
  AtendimentoPayload,
  AtendimentoStatus,
  AtendimentoWithRelations,
  ClienteOption,
  ReservaOption,
} from './recepcao.types';

type AtendimentoFormState = {
  nome: string;
  tipo: string;
  cliente_id: string;
  reserva_id: string;
  notes: string;
};

type AtendimentoFormErrors = Partial<Record<keyof AtendimentoFormState, string>>;

type KanbanColumn = {
  status: Exclude<AtendimentoStatus, 'cancelado'>;
  title: string;
  description: string;
  emptyLabel: string;
  icon: typeof Clock3;
  headerClassName: string;
};

const emptyForm: AtendimentoFormState = {
  nome: '',
  tipo: '',
  cliente_id: '',
  reserva_id: '',
  notes: '',
};

const inputClassName =
  'w-full rounded-lg border border-zinc-700 bg-zinc-950 min-h-[44px] px-3 py-2 sm:min-h-0 sm:py-2.5 text-sm text-white placeholder:text-zinc-600 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20';

const columns: readonly KanbanColumn[] = [
  {
    status: 'aguardando',
    title: 'Aguardando',
    description: 'Fila de chegada',
    emptyLabel: 'Ninguém aguardando.',
    icon: Clock3,
    headerClassName: 'border-amber-800/70 bg-amber-950/40 text-amber-200',
  },
  {
    status: 'em_atendimento',
    title: 'Em atendimento',
    description: 'Atendimentos em curso',
    emptyLabel: 'Nenhum atendimento em curso.',
    icon: Headphones,
    headerClassName: 'border-brand-800/70 bg-brand-950/40 text-brand-100',
  },
  {
    status: 'finalizado',
    title: 'Finalizado',
    description: 'Atendimentos concluídos',
    emptyLabel: 'Nenhum atendimento finalizado.',
    icon: CheckCircle2,
    headerClassName: 'border-sky-800/70 bg-sky-950/40 text-sky-100',
  },
];

const nextStatus: Readonly<
  Partial<Record<AtendimentoStatus, Exclude<AtendimentoStatus, 'aguardando' | 'cancelado'>>>
> = {
  aguardando: 'em_atendimento',
  em_atendimento: 'finalizado',
};

const advanceLabels: Readonly<Partial<Record<AtendimentoStatus, string>>> = {
  aguardando: 'Iniciar atendimento',
  em_atendimento: 'Finalizar atendimento',
};

const statusToastLabels: Record<AtendimentoStatus, string> = {
  aguardando: 'Atendimento movido para aguardando.',
  em_atendimento: 'Atendimento iniciado com sucesso.',
  finalizado: 'Atendimento finalizado com sucesso.',
  cancelado: 'Atendimento cancelado com sucesso.',
};

const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
});

const timeFormatter = new Intl.DateTimeFormat('pt-BR', {
  hour: '2-digit',
  minute: '2-digit',
});

const getErrorMessage = (error: unknown): string =>
  humanizeAdminError(error, 'Ocorreu um erro inesperado.');

const validateForm = (form: AtendimentoFormState): AtendimentoFormErrors => {
  const errors: AtendimentoFormErrors = {};

  if (!form.nome.trim()) {
    errors.nome = 'Informe o nome da pessoa atendida.';
  }

  if (!form.tipo.trim()) {
    errors.tipo = 'Informe o tipo de atendimento.';
  }

  return errors;
};

const getReservaLabel = (
  reserva: ReservaOption,
  clientes: readonly ClienteOption[],
): string => {
  const cliente =
    clientes.find((item) => item.id === reserva.cliente_id)?.nome ?? 'Sem cliente';
  return `${dateFormatter.format(new Date(reserva.data_inicio))} · ${cliente}`;
};

const AtendimentoCard = ({
  atendimento,
  canWrite,
  updatingStatus,
  onStatusChange,
}: {
  atendimento: AtendimentoWithRelations;
  canWrite: boolean;
  updatingStatus: AtendimentoStatus | null;
  onStatusChange: (status: AtendimentoStatus) => void;
}) => {
  const next = nextStatus[atendimento.status];
  const isUpdating = updatingStatus !== null;

  return (
    <article className="rounded-xl border border-zinc-700 bg-zinc-950/80 p-4 shadow-lg shadow-black/10">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-black text-white">{atendimento.nome}</h3>
          <p className="mt-1 text-xs font-bold uppercase tracking-[0.12em] text-brand-300">
            {atendimento.tipo ?? 'Tipo não informado'}
          </p>
        </div>
        <time
          className="shrink-0 rounded-full bg-zinc-800 px-2.5 py-1 text-xs font-bold text-zinc-300"
          dateTime={atendimento.created_at}
        >
          {timeFormatter.format(new Date(atendimento.created_at))}
        </time>
      </div>

      <div className="mt-4 space-y-2 text-sm text-zinc-300">
        {atendimento.cliente_id ? (
          <p className="flex items-center gap-2">
            <UserRound aria-hidden="true" className="shrink-0 text-zinc-500" size={15} />
            <span className="truncate">
              {atendimento.clientes?.nome ?? 'Cliente removido'}
            </span>
          </p>
        ) : null}
        {atendimento.reserva_id ? (
          <p className="flex items-center gap-2">
            <CalendarClock
              aria-hidden="true"
              className="shrink-0 text-zinc-500"
              size={15}
            />
            <span>
              {atendimento.reservas
                ? dateFormatter.format(new Date(atendimento.reservas.data_inicio))
                : 'Reserva removida'}
            </span>
          </p>
        ) : null}
      </div>

      {atendimento.notes ? (
        <p className="mt-4 whitespace-pre-wrap border-t border-zinc-800 pt-3 text-sm leading-6 text-zinc-400">
          {atendimento.notes}
        </p>
      ) : null}

      {canWrite ? (
        <div className="mt-4 flex flex-col gap-2 border-t border-zinc-800 pt-4 sm:flex-row">
          {next ? (
            <Button
              className="flex-1 px-3 py-2"
              disabled={isUpdating}
              loading={updatingStatus === next}
              onClick={() => onStatusChange(next)}
            >
              {advanceLabels[atendimento.status]}
            </Button>
          ) : null}
          <Button
            className="px-3 py-2"
            disabled={isUpdating}
            loading={updatingStatus === 'cancelado'}
            onClick={() => onStatusChange('cancelado')}
            variant="danger"
          >
            Cancelar
          </Button>
        </div>
      ) : null}
    </article>
  );
};

export const RecepcaoPage = () => {
  const { role } = useAuth();
  const toast = useToast();
  const [atendimentos, setAtendimentos] = useState<AtendimentoWithRelations[]>([]);
  const [clientes, setClientes] = useState<ClienteOption[]>([]);
  const [reservas, setReservas] = useState<ReservaOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState<AtendimentoFormState>(emptyForm);
  const [formErrors, setFormErrors] = useState<AtendimentoFormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [updatingStatuses, setUpdatingStatuses] = useState<
    Partial<Record<string, AtendimentoStatus>>
  >({});

  const canWrite =
    canAccess(role, 'recepcao') && ['owner', 'admin', 'recepcao'].includes(role);

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    try {
      const [atendimentosData, clientesData, reservasData] = await Promise.all([
        listAtendimentos(),
        listClientes(),
        listReservas(),
      ]);
      setAtendimentos(atendimentosData);
      setClientes(clientesData);
      setReservas(reservasData);
    } catch (error: unknown) {
      setLoadError(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const atendimentosByStatus = useMemo(
    () =>
      columns.reduce<Record<Exclude<AtendimentoStatus, 'cancelado'>, AtendimentoWithRelations[]>>(
        (grouped, column) => ({
          ...grouped,
          [column.status]: atendimentos.filter(
            (atendimento) => atendimento.status === column.status,
          ),
        }),
        {
          aguardando: [],
          em_atendimento: [],
          finalizado: [],
        },
      ),
    [atendimentos],
  );

  const openCreateModal = () => {
    setForm(emptyForm);
    setFormErrors({});
    setIsFormOpen(true);
  };

  const closeFormModal = () => {
    if (!submitting) {
      setIsFormOpen(false);
    }
  };

  const updateForm = <K extends keyof AtendimentoFormState>(
    field: K,
    value: AtendimentoFormState[K],
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

    const payload: AtendimentoPayload = {
      cliente_id: form.cliente_id || null,
      nome: form.nome.trim(),
      tipo: form.tipo.trim(),
      reserva_id: form.reserva_id || null,
      status: 'aguardando',
      notes: form.notes.trim() || null,
    };

    setSubmitting(true);
    try {
      const created = await createAtendimento(payload);
      const cliente = clientes.find((item) => item.id === created.cliente_id) ?? null;
      const reserva = reservas.find((item) => item.id === created.reserva_id) ?? null;

      setAtendimentos((current) => [
        ...current,
        {
          ...created,
          clientes: cliente ? { nome: cliente.nome } : null,
          reservas: reserva
            ? { data_inicio: reserva.data_inicio, status: reserva.status }
            : null,
        },
      ]);
      toast.success('Atendimento adicionado à fila com sucesso.');
      setIsFormOpen(false);
      setForm(emptyForm);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (
    atendimento: AtendimentoWithRelations,
    status: AtendimentoStatus,
  ) => {
    setUpdatingStatuses((current) => ({ ...current, [atendimento.id]: status }));

    try {
      await updateStatus(atendimento.id, status);
      setAtendimentos((current) =>
        current.map((item) => (item.id === atendimento.id ? { ...item, status } : item)),
      );
      toast.success(statusToastLabels[status]);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
    } finally {
      setUpdatingStatuses((current) => {
        const nextStatuses = { ...current };
        delete nextStatuses[atendimento.id];
        return nextStatuses;
      });
    }
  };

  return (
    <section>
      <PageHeader
        actionLabel={canWrite ? 'Novo atendimento' : undefined}
        onAction={canWrite ? openCreateModal : undefined}
        subtitle="Acompanhe a fila, inicie atendimentos e conclua o check-in da recepção."
        title="Recepção"
      />

      {loadError ? (
        <div className="mt-8 flex min-h-52 flex-col items-center justify-center rounded-xl border border-red-900/70 bg-red-950/30 p-6 text-center">
          <AlertCircle aria-hidden="true" className="text-red-300" size={28} />
          <p className="mt-3 text-sm text-red-200" role="alert">
            {loadError}
          </p>
          <Button className="mt-4" onClick={() => void loadData()} variant="ghost">
            <RefreshCw aria-hidden="true" size={16} />
            Tentar novamente
          </Button>
        </div>
      ) : (
        <div className="mt-8 grid items-start gap-5 xl:grid-cols-3">
          {columns.map((column) => {
            const Icon = column.icon;
            const columnAtendimentos = atendimentosByStatus[column.status];

            return (
              <section
                aria-labelledby={`recepcao-${column.status}`}
                className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/70"
                key={column.status}
              >
                <header className={`border-b px-4 py-4 ${column.headerClassName}`}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <Icon aria-hidden="true" size={20} />
                      <div>
                        <h2 className="font-black" id={`recepcao-${column.status}`}>
                          {column.title}
                        </h2>
                        <p className="mt-0.5 text-xs opacity-75">{column.description}</p>
                      </div>
                    </div>
                    <span className="rounded-full bg-black/25 px-2.5 py-1 text-xs font-black">
                      {loading ? '—' : columnAtendimentos.length}
                    </span>
                  </div>
                </header>

                <div className="space-y-3 p-3">
                  {loading
                    ? Array.from({ length: 2 }, (_, index) => (
                        <div
                          aria-hidden="true"
                          className="h-44 animate-pulse rounded-xl border border-zinc-800 bg-zinc-950/70"
                          key={`${column.status}-loading-${index}`}
                        />
                      ))
                    : columnAtendimentos.map((atendimento) => (
                        <AtendimentoCard
                          atendimento={atendimento}
                          canWrite={canWrite}
                          key={atendimento.id}
                          onStatusChange={(status) =>
                            void handleStatusChange(atendimento, status)
                          }
                          updatingStatus={updatingStatuses[atendimento.id] ?? null}
                        />
                      ))}

                  {!loading && columnAtendimentos.length === 0 ? (
                    <p className="px-4 py-12 text-center text-sm text-zinc-400">
                      {column.emptyLabel}
                    </p>
                  ) : null}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <Modal
        footer={
          <>
            <Button disabled={submitting} onClick={closeFormModal} variant="ghost">
              Cancelar
            </Button>
            <Button form="atendimento-form" loading={submitting} type="submit">
              Adicionar à fila
            </Button>
          </>
        }
        isOpen={isFormOpen}
        onClose={closeFormModal}
        title="Novo atendimento"
      >
        <form className="grid gap-5 md:grid-cols-2" id="atendimento-form" onSubmit={handleSubmit}>
          <FormField error={formErrors.nome} htmlFor="atendimento-nome" label="Nome">
            <input
              autoComplete="name"
              className={inputClassName}
              id="atendimento-nome"
              onChange={(event) => updateForm('nome', event.target.value)}
              placeholder="Nome da pessoa atendida"
              required
              value={form.nome}
            />
          </FormField>

          <FormField error={formErrors.tipo} htmlFor="atendimento-tipo" label="Tipo">
            <input
              className={inputClassName}
              id="atendimento-tipo"
              onChange={(event) => updateForm('tipo', event.target.value)}
              placeholder="Ex.: check-in, dúvidas, cadastro"
              required
              value={form.tipo}
            />
          </FormField>

          <FormField htmlFor="atendimento-cliente" label="Cliente (opcional)">
            <select
              className={inputClassName}
              id="atendimento-cliente"
              onChange={(event) => updateForm('cliente_id', event.target.value)}
              value={form.cliente_id}
            >
              <option value="">Não vincular cliente</option>
              {clientes.map((cliente) => (
                <option key={cliente.id} value={cliente.id}>
                  {cliente.nome}
                </option>
              ))}
            </select>
          </FormField>

          <FormField htmlFor="atendimento-reserva" label="Reserva (opcional)">
            <select
              className={inputClassName}
              id="atendimento-reserva"
              onChange={(event) => updateForm('reserva_id', event.target.value)}
              value={form.reserva_id}
            >
              <option value="">Não vincular reserva</option>
              {reservas.map((reserva) => (
                <option key={reserva.id} value={reserva.id}>
                  {getReservaLabel(reserva, clientes)}
                </option>
              ))}
            </select>
          </FormField>

          <div className="md:col-span-2">
            <FormField htmlFor="atendimento-notes" label="Observações">
              <textarea
                className={`${inputClassName} min-h-28 resize-y`}
                id="atendimento-notes"
                onChange={(event) => updateForm('notes', event.target.value)}
                placeholder="Informações adicionais para a equipe da recepção"
                value={form.notes}
              />
            </FormField>
          </div>
        </form>
      </Modal>
    </section>
  );
};
