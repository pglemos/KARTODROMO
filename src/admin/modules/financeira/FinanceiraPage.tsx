import { LockKeyhole } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { canAccess, type Role } from '../../lib/rbac';
import { Button } from '../../ui/Button';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import { DataTable, type DataTableColumn } from '../../ui/DataTable';
import { FormField } from '../../ui/FormField';
import { Modal } from '../../ui/Modal';
import { PageHeader } from '../../ui/PageHeader';
import { Pagination } from '../../ui/Pagination';
import { useToast } from '../../ui/useToast';
import {
  createCategoria,
  createLancamento,
  getResumo,
  listCategorias,
  listLancamentosPage,
  removeCategoria,
  removeLancamento,
  updateCategoria,
  updateLancamento,
  type LancamentosFilters,
} from './financeira.api';
import type {
  Categoria,
  CategoriaPayload,
  FinanceiroTipo,
  LancamentoPayload,
  LancamentoStatus,
  LancamentoUpdate,
  LancamentoWithCategoria,
  ResumoFinanceiro,
} from './financeira.types';

type Section = 'lancamentos' | 'categorias';

const PAGE_SIZE = 10;

type LancamentoFormState = {
  descricao: string;
  valor: string;
  tipo: FinanceiroTipo;
  categoria_id: string;
  data: string;
  status: LancamentoStatus;
};

type CategoriaFormState = {
  nome: string;
  tipo: FinanceiroTipo;
};

type LancamentoFormErrors = Partial<Record<keyof LancamentoFormState, string>>;
type CategoriaFormErrors = Partial<Record<keyof CategoriaFormState, string>>;

const financeRoles: readonly Role[] = ['owner', 'admin', 'financeiro'];

const getTodayInputValue = (): string => {
  const now = new Date();
  const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 10);
};

const emptyLancamentoForm: LancamentoFormState = {
  descricao: '',
  valor: '',
  tipo: 'receita',
  categoria_id: '',
  data: getTodayInputValue(),
  status: 'previsto',
};

const emptyCategoriaForm: CategoriaFormState = {
  nome: '',
  tipo: 'receita',
};

const emptyResumo: ResumoFinanceiro = {
  receitas: 0,
  despesas: 0,
  saldo: 0,
};

const inputClassName =
  'w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20';

const tipoLabels: Record<FinanceiroTipo, string> = {
  receita: 'Receita',
  despesa: 'Despesa',
};

const tipoClasses: Record<FinanceiroTipo, string> = {
  receita: 'border-emerald-800 bg-emerald-950 text-emerald-200',
  despesa: 'border-red-900 bg-red-950 text-red-200',
};

const statusLabels: Record<LancamentoStatus, string> = {
  previsto: 'Previsto',
  confirmado: 'Confirmado',
  cancelado: 'Cancelado',
};

const statusClasses: Record<LancamentoStatus, string> = {
  previsto: 'border-amber-800 bg-amber-950 text-amber-200',
  confirmado: 'border-emerald-800 bg-emerald-950 text-emerald-200',
  cancelado: 'border-zinc-700 bg-zinc-800 text-zinc-300',
};

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeZone: 'UTC',
});

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'Ocorreu um erro inesperado.';

const formatDate = (value: string): string =>
  dateFormatter.format(new Date(`${value}T00:00:00Z`));

const lancamentoToForm = (lancamento: LancamentoWithCategoria): LancamentoFormState => ({
  descricao: lancamento.descricao,
  valor: String(lancamento.valor),
  tipo: lancamento.tipo,
  categoria_id: lancamento.categoria_id,
  data: lancamento.data,
  status: lancamento.status,
});

const validateLancamento = (form: LancamentoFormState): LancamentoFormErrors => {
  const errors: LancamentoFormErrors = {};
  const valor = Number(form.valor);

  if (!form.descricao.trim()) errors.descricao = 'Informe a descrição.';
  if (!Number.isFinite(valor) || valor <= 0) errors.valor = 'Informe um valor maior que zero.';
  if (!form.categoria_id) errors.categoria_id = 'Selecione uma categoria.';
  if (!form.data) errors.data = 'Informe a data.';

  return errors;
};

const validateCategoria = (form: CategoriaFormState): CategoriaFormErrors => {
  const errors: CategoriaFormErrors = {};
  if (!form.nome.trim()) errors.nome = 'Informe o nome da categoria.';
  return errors;
};

export const FinanceiraPage = () => {
  const { role } = useAuth();
  const toast = useToast();
  const hasFinanceAccess = canAccess(role, 'financeira') && financeRoles.includes(role);
  const [section, setSection] = useState<Section>('lancamentos');
  const [lancamentos, setLancamentos] = useState<LancamentoWithCategoria[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [filters, setFilters] = useState<LancamentosFilters>({ status: '', tipo: '', q: '' });
  const [searchInput, setSearchInput] = useState('');
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [resumo, setResumo] = useState<ResumoFinanceiro>(emptyResumo);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editingLancamento, setEditingLancamento] = useState<LancamentoWithCategoria | null>(null);
  const [deletingLancamento, setDeletingLancamento] = useState<LancamentoWithCategoria | null>(null);
  const [isLancamentoFormOpen, setIsLancamentoFormOpen] = useState(false);
  const [lancamentoForm, setLancamentoForm] = useState<LancamentoFormState>(emptyLancamentoForm);
  const [lancamentoErrors, setLancamentoErrors] = useState<LancamentoFormErrors>({});
  const [editingCategoria, setEditingCategoria] = useState<Categoria | null>(null);
  const [deletingCategoria, setDeletingCategoria] = useState<Categoria | null>(null);
  const [isCategoriaFormOpen, setIsCategoriaFormOpen] = useState(false);
  const [categoriaForm, setCategoriaForm] = useState<CategoriaFormState>(emptyCategoriaForm);
  const [categoriaErrors, setCategoriaErrors] = useState<CategoriaFormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const loadData = useCallback(async () => {
    if (!hasFinanceAccess) {
      return;
    }

    setLoading(true);
    setLoadError(null);
    try {
      const [lancamentosPage, categoriasData, resumoData] = await Promise.all([
        listLancamentosPage(filters, page, PAGE_SIZE),
        listCategorias(),
        getResumo(),
      ]);
      setLancamentos(lancamentosPage.data);
      setTotal(lancamentosPage.total);
      setCategorias(categoriasData);
      setResumo(resumoData);
    } catch (error: unknown) {
      setLoadError(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [hasFinanceAccess, filters, page]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    const handle = setTimeout(() => {
      setFilters((current) => ({ ...current, q: searchInput }));
      setPage(0);
    }, 350);
    return () => clearTimeout(handle);
  }, [searchInput]);

  const updateStatusFilter = (status: LancamentoStatus | '') => {
    setFilters((current) => ({ ...current, status }));
    setPage(0);
  };

  const updateTipoFilter = (tipo: FinanceiroTipo | '') => {
    setFilters((current) => ({ ...current, tipo }));
    setPage(0);
  };

  const lancamentoColumns = useMemo<readonly DataTableColumn<LancamentoWithCategoria>[]>(
    () => [
      { key: 'data', label: 'Data', render: (item) => formatDate(item.data) },
      { key: 'descricao', label: 'Descrição' },
      {
        key: 'categoria_id',
        label: 'Categoria',
        render: (item) => item.financeiro_categorias?.nome ?? 'Categoria removida',
      },
      {
        key: 'tipo',
        label: 'Tipo',
        render: (item) => (
          <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${tipoClasses[item.tipo]}`}>
            {tipoLabels[item.tipo]}
          </span>
        ),
      },
      {
        key: 'valor',
        label: 'Valor',
        render: (item) => (
          <span className={item.tipo === 'receita' ? 'font-bold text-emerald-300' : 'font-bold text-red-300'}>
            {currencyFormatter.format(Number(item.valor))}
          </span>
        ),
      },
      {
        key: 'status',
        label: 'Status',
        render: (item) => (
          <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${statusClasses[item.status]}`}>
            {statusLabels[item.status]}
          </span>
        ),
      },
    ],
    [],
  );

  const categoriaColumns = useMemo<readonly DataTableColumn<Categoria>[]>(
    () => [
      { key: 'nome', label: 'Nome' },
      {
        key: 'tipo',
        label: 'Tipo',
        render: (categoria) => (
          <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${tipoClasses[categoria.tipo]}`}>
            {tipoLabels[categoria.tipo]}
          </span>
        ),
      },
    ],
    [],
  );

  const categoriasDoTipo = useMemo(
    () => categorias.filter((categoria) => categoria.tipo === lancamentoForm.tipo),
    [categorias, lancamentoForm.tipo],
  );

  if (!hasFinanceAccess) {
    return (
      <section>
        <PageHeader title="Financeira" subtitle="Controle de receitas, despesas e categorias." />
        <div className="mt-8 flex min-h-64 flex-col items-center justify-center rounded-xl border border-amber-900/70 bg-amber-950/30 p-8 text-center">
          <LockKeyhole aria-hidden="true" className="text-amber-300" size={32} />
          <h2 className="mt-4 text-lg font-black text-white">Acesso restrito</h2>
          <p className="mt-2 max-w-lg text-sm leading-6 text-amber-100">
            Este módulo contém dados sensíveis e está disponível somente para proprietário, administrador ou financeiro.
          </p>
        </div>
      </section>
    );
  }

  const openCreateLancamento = () => {
    setEditingLancamento(null);
    setLancamentoForm({ ...emptyLancamentoForm, data: getTodayInputValue() });
    setLancamentoErrors({});
    setIsLancamentoFormOpen(true);
  };

  const openEditLancamento = (lancamento: LancamentoWithCategoria) => {
    setEditingLancamento(lancamento);
    setLancamentoForm(lancamentoToForm(lancamento));
    setLancamentoErrors({});
    setIsLancamentoFormOpen(true);
  };

  const openCreateCategoria = () => {
    setEditingCategoria(null);
    setCategoriaForm(emptyCategoriaForm);
    setCategoriaErrors({});
    setIsCategoriaFormOpen(true);
  };

  const openEditCategoria = (categoria: Categoria) => {
    setEditingCategoria(categoria);
    setCategoriaForm({ nome: categoria.nome, tipo: categoria.tipo });
    setCategoriaErrors({});
    setIsCategoriaFormOpen(true);
  };

  const updateLancamentoForm = <K extends keyof LancamentoFormState>(
    field: K,
    value: LancamentoFormState[K],
  ) => {
    setLancamentoForm((current) => ({ ...current, [field]: value }));
    setLancamentoErrors((current) => ({ ...current, [field]: undefined }));
  };

  const handleTipoLancamentoChange = (tipo: FinanceiroTipo) => {
    setLancamentoForm((current) => ({ ...current, tipo, categoria_id: '' }));
    setLancamentoErrors((current) => ({ ...current, categoria_id: undefined }));
  };

  const handleLancamentoSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const errors = validateLancamento(lancamentoForm);
    if (Object.keys(errors).length > 0) {
      setLancamentoErrors(errors);
      return;
    }

    const payload: LancamentoUpdate = {
      descricao: lancamentoForm.descricao.trim(),
      valor: Number(lancamentoForm.valor),
      tipo: lancamentoForm.tipo,
      categoria_id: lancamentoForm.categoria_id,
      data: lancamentoForm.data,
      status: lancamentoForm.status,
    };

    setSubmitting(true);
    try {
      if (editingLancamento) {
        await updateLancamento(editingLancamento.id, payload);
        toast.success('Lançamento atualizado com sucesso.');
      } else {
        const createPayload: LancamentoPayload = {
          descricao: lancamentoForm.descricao.trim(),
          valor: Number(lancamentoForm.valor),
          tipo: lancamentoForm.tipo,
          categoria_id: lancamentoForm.categoria_id,
          data: lancamentoForm.data,
          status: lancamentoForm.status,
          origem: null,
          origem_ref: null,
        };
        await createLancamento(createPayload);
        toast.success('Lançamento criado com sucesso.');
      }
      setIsLancamentoFormOpen(false);
      await loadData();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCategoriaSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const errors = validateCategoria(categoriaForm);
    if (Object.keys(errors).length > 0) {
      setCategoriaErrors(errors);
      return;
    }

    const payload: CategoriaPayload = {
      nome: categoriaForm.nome.trim(),
      tipo: categoriaForm.tipo,
    };

    setSubmitting(true);
    try {
      if (editingCategoria) {
        await updateCategoria(editingCategoria.id, payload);
        toast.success('Categoria atualizada com sucesso.');
      } else {
        await createCategoria(payload);
        toast.success('Categoria criada com sucesso.');
      }
      setIsCategoriaFormOpen(false);
      await loadData();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteLancamento = async () => {
    if (!deletingLancamento) return;
    setDeleting(true);
    try {
      await removeLancamento(deletingLancamento.id);
      toast.success('Lançamento excluído com sucesso.');
      setDeletingLancamento(null);
      await loadData();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteCategoria = async () => {
    if (!deletingCategoria) return;
    setDeleting(true);
    try {
      await removeCategoria(deletingCategoria.id);
      toast.success('Categoria excluída com sucesso.');
      setDeletingCategoria(null);
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
        actionLabel={section === 'lancamentos' ? 'Novo lançamento' : 'Nova categoria'}
        onAction={section === 'lancamentos' ? openCreateLancamento : openCreateCategoria}
        subtitle="Acompanhe receitas, despesas, saldo e categorias financeiras."
        title="Financeira"
      />

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {[
          { label: 'Receitas', value: resumo.receitas, className: 'border-emerald-900/70 text-emerald-300' },
          { label: 'Despesas', value: resumo.despesas, className: 'border-red-900/70 text-red-300' },
          { label: 'Saldo', value: resumo.saldo, className: 'border-zinc-700 text-white' },
        ].map((card) => (
          <article className={`rounded-xl border bg-zinc-900/80 p-5 ${card.className}`} key={card.label}>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-zinc-400">{card.label}</p>
            <p className="mt-3 text-2xl font-black">{loading ? '—' : currencyFormatter.format(card.value)}</p>
          </article>
        ))}
      </div>

      <div className="mt-8 flex flex-wrap gap-3 border-b border-zinc-800 pb-4">
        <Button onClick={() => setSection('lancamentos')} variant={section === 'lancamentos' ? 'primary' : 'ghost'}>
          Lançamentos
        </Button>
        <Button onClick={() => setSection('categorias')} variant={section === 'categorias' ? 'primary' : 'ghost'}>
          Categorias
        </Button>
      </div>

      <div className="mt-6">
        {section === 'lancamentos' ? (
          <div>
            <div className="mb-4 flex flex-wrap items-end gap-4">
              <div className="w-full max-w-xs">
                <FormField htmlFor="financeira-busca" label="Buscar">
                  <input
                    className={inputClassName}
                    id="financeira-busca"
                    onChange={(event) => setSearchInput(event.target.value)}
                    placeholder="Descrição"
                    value={searchInput}
                  />
                </FormField>
              </div>
              <div className="w-full max-w-xs">
                <FormField htmlFor="financeira-tipo-filtro" label="Tipo">
                  <select
                    className={inputClassName}
                    id="financeira-tipo-filtro"
                    onChange={(event) => updateTipoFilter(event.target.value as FinanceiroTipo | '')}
                    value={filters.tipo}
                  >
                    <option value="">Todos</option>
                    {Object.entries(tipoLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </FormField>
              </div>
              <div className="w-full max-w-xs">
                <FormField htmlFor="financeira-status-filtro" label="Status">
                  <select
                    className={inputClassName}
                    id="financeira-status-filtro"
                    onChange={(event) => updateStatusFilter(event.target.value as LancamentoStatus | '')}
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
            <DataTable
              columns={lancamentoColumns}
              emptyLabel="Nenhum lançamento encontrado."
              error={loadError}
              loading={loading}
              onDelete={setDeletingLancamento}
              onEdit={openEditLancamento}
              onRetry={() => void loadData()}
              rows={lancamentos}
            />
            <Pagination onPageChange={setPage} page={page} pageSize={PAGE_SIZE} total={total} />
          </div>
        ) : (
          <DataTable
            columns={categoriaColumns}
            emptyLabel="Nenhuma categoria cadastrada."
            error={loadError}
            loading={loading}
            onDelete={setDeletingCategoria}
            onEdit={openEditCategoria}
            onRetry={() => void loadData()}
            rows={categorias}
          />
        )}
      </div>

      <Modal
        footer={
          <>
            <Button disabled={submitting} onClick={() => setIsLancamentoFormOpen(false)} variant="ghost">Cancelar</Button>
            <Button form="lancamento-form" loading={submitting} type="submit">
              {editingLancamento ? 'Salvar alterações' : 'Criar lançamento'}
            </Button>
          </>
        }
        isOpen={isLancamentoFormOpen}
        onClose={submitting ? () => undefined : () => setIsLancamentoFormOpen(false)}
        title={editingLancamento ? 'Editar lançamento' : 'Novo lançamento'}
      >
        <form className="grid gap-5 md:grid-cols-2" id="lancamento-form" onSubmit={handleLancamentoSubmit}>
          <div className="md:col-span-2">
            <FormField error={lancamentoErrors.descricao} htmlFor="financeira-descricao" label="Descrição">
              <input className={inputClassName} id="financeira-descricao" maxLength={160} onChange={(event) => updateLancamentoForm('descricao', event.target.value)} required value={lancamentoForm.descricao} />
            </FormField>
          </div>
          <FormField error={lancamentoErrors.valor} htmlFor="financeira-valor" label="Valor (R$)">
            <input className={inputClassName} id="financeira-valor" min="0.01" onChange={(event) => updateLancamentoForm('valor', event.target.value)} required step="0.01" type="number" value={lancamentoForm.valor} />
          </FormField>
          <FormField htmlFor="financeira-tipo" label="Tipo">
            <select className={inputClassName} id="financeira-tipo" onChange={(event) => handleTipoLancamentoChange(event.target.value as FinanceiroTipo)} value={lancamentoForm.tipo}>
              {Object.entries(tipoLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </FormField>
          <FormField error={lancamentoErrors.categoria_id} htmlFor="financeira-categoria" label="Categoria">
            <select className={inputClassName} id="financeira-categoria" onChange={(event) => updateLancamentoForm('categoria_id', event.target.value)} required value={lancamentoForm.categoria_id}>
              <option value="">Selecione</option>
              {categoriasDoTipo.map((categoria) => <option key={categoria.id} value={categoria.id}>{categoria.nome}</option>)}
            </select>
          </FormField>
          <FormField error={lancamentoErrors.data} htmlFor="financeira-data" label="Data">
            <input className={inputClassName} id="financeira-data" onChange={(event) => updateLancamentoForm('data', event.target.value)} required type="date" value={lancamentoForm.data} />
          </FormField>
          <FormField htmlFor="financeira-status" label="Status">
            <select className={inputClassName} id="financeira-status" onChange={(event) => updateLancamentoForm('status', event.target.value as LancamentoStatus)} value={lancamentoForm.status}>
              {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </FormField>
        </form>
      </Modal>

      <Modal
        footer={
          <>
            <Button disabled={submitting} onClick={() => setIsCategoriaFormOpen(false)} variant="ghost">Cancelar</Button>
            <Button form="categoria-form" loading={submitting} type="submit">
              {editingCategoria ? 'Salvar alterações' : 'Criar categoria'}
            </Button>
          </>
        }
        isOpen={isCategoriaFormOpen}
        onClose={submitting ? () => undefined : () => setIsCategoriaFormOpen(false)}
        title={editingCategoria ? 'Editar categoria' : 'Nova categoria'}
      >
        <form className="grid gap-5 md:grid-cols-2" id="categoria-form" onSubmit={handleCategoriaSubmit}>
          <FormField error={categoriaErrors.nome} htmlFor="categoria-nome" label="Nome">
            <input className={inputClassName} id="categoria-nome" maxLength={100} onChange={(event) => { setCategoriaForm((current) => ({ ...current, nome: event.target.value })); setCategoriaErrors((current) => ({ ...current, nome: undefined })); }} required value={categoriaForm.nome} />
          </FormField>
          <FormField htmlFor="categoria-tipo" label="Tipo">
            <select className={inputClassName} id="categoria-tipo" onChange={(event) => setCategoriaForm((current) => ({ ...current, tipo: event.target.value as FinanceiroTipo }))} value={categoriaForm.tipo}>
              {Object.entries(tipoLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </FormField>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(deletingLancamento)}
        loading={deleting}
        message={`O lançamento “${deletingLancamento?.descricao ?? ''}” será excluído permanentemente.`}
        onClose={() => setDeletingLancamento(null)}
        onConfirm={() => void handleDeleteLancamento()}
        title="Excluir lançamento"
      />
      <ConfirmDialog
        isOpen={Boolean(deletingCategoria)}
        loading={deleting}
        message={`A categoria “${deletingCategoria?.nome ?? ''}” será excluída permanentemente. Categorias em uso não podem ser removidas.`}
        onClose={() => setDeletingCategoria(null)}
        onConfirm={() => void handleDeleteCategoria()}
        title="Excluir categoria"
      />
    </section>
  );
};
