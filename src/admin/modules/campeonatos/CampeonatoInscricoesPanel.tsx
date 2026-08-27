import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { humanizeAdminError } from '@/lib/admin-error-messages';
import { Button } from '../../ui/Button';
import { DataTable, type DataTableColumn } from '../../ui/DataTable';
import { FormField } from '../../ui/FormField';
import { Modal } from '../../ui/Modal';
import { Pagination } from '../../ui/Pagination';
import { useToast } from '../../ui/useToast';
import {
  listCampeonatoInscricoesPage,
  updateCampeonatoInscricao,
  type CampeonatoInscricoesFilters,
} from './campeonatos.api';
import type { CampeonatoInscricao, CampeonatoInscricaoStatus } from './campeonatos.types';

const PAGE_SIZE = 10;

const inputClassName =
  'w-full rounded-lg border border-zinc-700 bg-zinc-950 min-h-[44px] px-3 py-2 sm:min-h-0 sm:py-2.5 text-sm text-white placeholder:text-zinc-600 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20';

const statusLabels: Record<CampeonatoInscricaoStatus, string> = {
  pendente: 'Pendente',
  em_analise: 'Em análise',
  confirmada: 'Confirmada',
  recusada: 'Recusada',
  cancelada: 'Cancelada',
};

const statusClasses: Record<CampeonatoInscricaoStatus, string> = {
  pendente: 'border-amber-800 bg-amber-950 text-amber-200',
  em_analise: 'border-sky-900 bg-sky-950 text-sky-200',
  confirmada: 'border-brand-800 bg-brand-950 text-brand-100',
  recusada: 'border-red-900 bg-red-950 text-red-200',
  cancelada: 'border-zinc-700 bg-zinc-800 text-zinc-200',
};

const dateTimeFormatter = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

const getErrorMessage = (error: unknown) =>
  humanizeAdminError(error, 'Ocorreu um erro inesperado.');

const formatDateTime = (value: string | null) => (value ? dateTimeFormatter.format(new Date(value)) : '—');

const StatusBadge = ({ status }: { status: CampeonatoInscricaoStatus }) => (
  <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${statusClasses[status]}`}>
    {statusLabels[status]}
  </span>
);

const primaryName = (registration: CampeonatoInscricao) =>
  registration.modalidade === 'equipe'
    ? registration.nome_equipe || registration.nome_chefe || 'Equipe sem nome'
    : registration.nome_completo || 'Piloto sem nome';

const contactLine = (registration: CampeonatoInscricao) =>
  [registration.telefone, registration.email].filter(Boolean).join(' · ') || 'Sem contato';

export function CampeonatoInscricoesPanel() {
  const toast = useToast();
  const [rows, setRows] = useState<CampeonatoInscricao[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [statusFilter, setStatusFilter] = useState<CampeonatoInscricaoStatus | ''>('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<CampeonatoInscricao | null>(null);
  const [form, setForm] = useState({ status: 'pendente' as CampeonatoInscricaoStatus, admin_notes: '' });
  const [saving, setSaving] = useState(false);

  const loadRows = useCallback(async () => {
    const filters: CampeonatoInscricoesFilters = { status: statusFilter, q: search };
    setLoading(true);
    setError(null);
    try {
      const result = await listCampeonatoInscricoesPage(filters, page, PAGE_SIZE);
      setRows(result.data);
      setTotal(result.total);
    } catch (loadError: unknown) {
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  useEffect(() => {
    const handle = setTimeout(() => {
      setSearch(searchInput);
      setPage(0);
    }, 350);
    return () => clearTimeout(handle);
  }, [searchInput]);

  const columns = useMemo<readonly DataTableColumn<CampeonatoInscricao>[]>(
    () => [
      { key: 'protocol', label: 'Protocolo' },
      { key: 'evento', label: 'Campeonato' },
      {
        key: 'nome_equipe',
        label: 'Inscrito',
        render: (registration) => (
          <div>
            <strong className="block text-sm text-zinc-100">{primaryName(registration)}</strong>
            <span className="text-xs text-zinc-500">
              {registration.modalidade === 'equipe' ? registration.nome_chefe || 'Chefe não informado' : 'Piloto individual'}
            </span>
          </div>
        ),
      },
      { key: 'telefone', label: 'Contato', render: contactLine },
      { key: 'status', label: 'Status', render: (registration) => <StatusBadge status={registration.status} /> },
      { key: 'created_at', label: 'Recebida em', render: (registration) => formatDateTime(registration.created_at) },
    ],
    [],
  );

  const openRegistration = (registration: CampeonatoInscricao) => {
    setSelected(registration);
    setForm({ status: registration.status, admin_notes: registration.admin_notes ?? '' });
  };

  const closeRegistration = () => {
    if (!saving) setSelected(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selected) return;

    setSaving(true);
    try {
      await updateCampeonatoInscricao(selected.id, {
        status: form.status,
        admin_notes: form.admin_notes,
      });
      toast.success('Inscrição atualizada com sucesso.');
      setSelected(null);
      await loadRows();
    } catch (saveError: unknown) {
      toast.error(getErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
        <FormField htmlFor="inscricoes-busca" label="Buscar inscrição">
          <input
            className={inputClassName}
            id="inscricoes-busca"
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Protocolo, campeonato, nome, e-mail ou telefone"
            value={searchInput}
          />
        </FormField>
        <FormField htmlFor="inscricoes-status" label="Status">
          <select
            className={inputClassName}
            id="inscricoes-status"
            onChange={(event) => {
              setStatusFilter(event.target.value as CampeonatoInscricaoStatus | '');
              setPage(0);
            }}
            value={statusFilter}
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

      <DataTable
        columns={columns}
        emptyLabel="Nenhuma inscrição de campeonato encontrada."
        error={error}
        loading={loading}
        onEdit={openRegistration}
        onRetry={() => void loadRows()}
        rows={rows}
      />
      <Pagination onPageChange={setPage} page={page} pageSize={PAGE_SIZE} total={total} />

      <Modal
        footer={
          <>
            <Button disabled={saving} onClick={closeRegistration} variant="ghost">
              Cancelar
            </Button>
            <Button form="campeonato-inscricao-form" loading={saving} type="submit">
              Salvar
            </Button>
          </>
        }
        isOpen={selected !== null}
        onClose={closeRegistration}
        title={selected ? `Inscrição ${selected.protocol}` : 'Inscrição'}
      >
        {selected ? (
          <form className="grid gap-5" id="campeonato-inscricao-form" onSubmit={handleSubmit}>
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-brand-300">{selected.evento}</p>
              <h3 className="mt-1 text-lg font-black text-white">{primaryName(selected)}</h3>
              <p className="mt-1 text-sm text-zinc-400">{contactLine(selected)}</p>
              {selected.pilotos.length ? (
                <div className="mt-4">
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-zinc-500">Pilotos</p>
                  <ul className="mt-2 grid gap-1 text-sm text-zinc-300">
                    {selected.pilotos.map((pilot, index) => (
                      <li key={`${pilot.nome}-${index}`}>
                        {pilot.nome}
                        {pilot.peso_kg ? ` · ${pilot.peso_kg} kg` : ''}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>

            <FormField htmlFor="inscricao-status" label="Status">
              <select
                className={inputClassName}
                id="inscricao-status"
                onChange={(event) =>
                  setForm((current) => ({ ...current, status: event.target.value as CampeonatoInscricaoStatus }))
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

            <FormField htmlFor="inscricao-notas" label="Anotações administrativas">
              <textarea
                className={`${inputClassName} min-h-28 resize-y`}
                id="inscricao-notas"
                onChange={(event) => setForm((current) => ({ ...current, admin_notes: event.target.value }))}
                placeholder="Pagamento, contato, pendências ou observações internas."
                value={form.admin_notes}
              />
            </FormField>
          </form>
        ) : null}
      </Modal>
    </div>
  );
}
