import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { Button } from '../../ui/Button';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import { DataTable, type DataTableColumn } from '../../ui/DataTable';
import { FormField } from '../../ui/FormField';
import { Modal } from '../../ui/Modal';
import { PageHeader } from '../../ui/PageHeader';
import { Pagination } from '../../ui/Pagination';
import { useToast } from '../../ui/useToast';
import { CampeonatoInscricoesPanel } from './CampeonatoInscricoesPanel';
import {
  createCampeonato,
  createEtapa,
  createPiloto,
  listCampeonatos,
  listCampeonatosPage,
  listClassificacaoPage,
  listEtapasPage,
  listPilotosPage,
  removeCampeonato,
  removeEtapa,
  removePiloto,
  updateCampeonato,
  updateEtapa,
  updatePiloto,
 type EtapasFilters,
} from './campeonatos.api';
import type {
  Campeonato,
  CampeonatoPayload,
  CampeonatoStatus,
  ClassificacaoWithPiloto,
  EtapaPayload,
  EtapaStatus,
  EtapaWithCampeonato,
  Piloto,
  PilotoPayload,
} from './campeonatos.types';

type Tab = 'inscricoes' | 'campeonatos' | 'etapas' | 'pilotos' | 'classificacao';
type FormKind = Exclude<Tab, 'classificacao' | 'inscricoes'>;

const PAGE_SIZE = 10;

type CampeonatoFormState = {
  nome: string;
  slug: string;
  temporada: string;
  status: CampeonatoStatus;
};

type EtapaFormState = {
  campeonato_id: string;
  nome: string;
  data: string;
  round: string;
  status: EtapaStatus;
};

type PilotoFormState = {
  nome: string;
  numero: string;
  equipe: string;
  cliente_id: string;
};

type DeleteTarget =
  | { kind: 'campeonato'; item: Campeonato }
  | { kind: 'etapa'; item: EtapaWithCampeonato }
  | { kind: 'piloto'; item: Piloto };

const emptyCampeonatoForm: CampeonatoFormState = {
  nome: '',
  slug: '',
  temporada: String(new Date().getFullYear()),
  status: 'rascunho',
};

const emptyEtapaForm: EtapaFormState = {
  campeonato_id: '',
  nome: '',
  data: '',
  round: '1',
  status: 'agendada',
};

const emptyPilotoForm: PilotoFormState = {
  nome: '',
  numero: '',
  equipe: '',
  cliente_id: '',
};

const inputClassName =
  'w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20';

const campeonatoStatusLabels: Record<CampeonatoStatus, string> = {
  ativo: 'Ativo',
  encerrado: 'Encerrado',
  rascunho: 'Rascunho',
};

const campeonatoStatusClasses: Record<CampeonatoStatus, string> = {
  ativo: 'border-brand-800 bg-brand-950 text-brand-100',
  encerrado: 'border-zinc-700 bg-zinc-800 text-zinc-200',
  rascunho: 'border-amber-800 bg-amber-950 text-amber-200',
};

const etapaStatusLabels: Record<EtapaStatus, string> = {
  agendada: 'Agendada',
  realizada: 'Realizada',
  cancelada: 'Cancelada',
};

const etapaStatusClasses: Record<EtapaStatus, string> = {
  agendada: 'border-sky-900 bg-sky-950 text-sky-200',
  realizada: 'border-brand-800 bg-brand-950 text-brand-100',
  cancelada: 'border-red-900 bg-red-950 text-red-200',
};

const tabLabels: Record<Tab, string> = {
 inscricoes: 'Inscrições',
 campeonatos: 'Campeonatos',
 etapas: 'Etapas',
 pilotos: 'Pilotos',
  classificacao: 'Classificação',
};

const pointsFormatter = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const dateFormatter = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' });

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'Ocorreu um erro inesperado.';

const formatDate = (value: string | null): string =>
  value ? dateFormatter.format(new Date(`${value}T12:00:00`)) : '—';

const CampeonatosStatus = ({ status }: { status: CampeonatoStatus }) => (
  <span
    className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${campeonatoStatusClasses[status]}`}
  >
    {campeonatoStatusLabels[status]}
  </span>
);

const EtapasStatus = ({ status }: { status: EtapaStatus }) => (
  <span
    className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${etapaStatusClasses[status]}`}
  >
    {etapaStatusLabels[status]}
  </span>
);

export const CampeonatosPage = () => {
  const { role } = useAuth();
  const toast = useToast();
const [activeTab, setActiveTab] = useState<Tab>('inscricoes');

  // full, unpaginated campeonatos list — feeds the dropdowns (etapa form, classificacao filter)
  const [campeonatos, setCampeonatos] = useState<Campeonato[]>([]);

  // Campeonatos tab (own paginated/searchable view)
  const [campeonatosRows, setCampeonatosRows] = useState<Campeonato[]>([]);
  const [campeonatosTotal, setCampeonatosTotal] = useState(0);
  const [campeonatosPage, setCampeonatosPage] = useState(0);
  const [campeonatosSearchInput, setCampeonatosSearchInput] = useState('');
  const [campeonatosSearch, setCampeonatosSearch] = useState('');

  // Etapas tab
  const [etapasRows, setEtapasRows] = useState<EtapaWithCampeonato[]>([]);
  const [etapasTotal, setEtapasTotal] = useState(0);
  const [etapasPage, setEtapasPage] = useState(0);
  const [etapaCampeonatoId, setEtapaCampeonatoId] = useState('');
  const [etapaStatusFilter, setEtapaStatusFilter] = useState<EtapaStatus | ''>('');
  const [etapasSearchInput, setEtapasSearchInput] = useState('');
  const [etapasSearch, setEtapasSearch] = useState('');

  // Pilotos tab
  const [pilotosRows, setPilotosRows] = useState<Piloto[]>([]);
  const [pilotosTotal, setPilotosTotal] = useState(0);
  const [pilotosPage, setPilotosPage] = useState(0);
  const [pilotosSearchInput, setPilotosSearchInput] = useState('');
  const [pilotosSearch, setPilotosSearch] = useState('');

  // Classificacao tab
  const [classificacao, setClassificacao] = useState<ClassificacaoWithPiloto[]>([]);
  const [classificacaoTotal, setClassificacaoTotal] = useState(0);
  const [classificacaoPage, setClassificacaoPage] = useState(0);
  const [classificacaoCampeonatoId, setClassificacaoCampeonatoId] = useState('');
  const [classificacaoSearchInput, setClassificacaoSearchInput] = useState('');
  const [classificacaoSearch, setClassificacaoSearch] = useState('');

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [classificacaoLoading, setClassificacaoLoading] = useState(false);
  const [classificacaoError, setClassificacaoError] = useState<string | null>(null);
  const [formKind, setFormKind] = useState<FormKind | null>(null);
  const [editingCampeonato, setEditingCampeonato] = useState<Campeonato | null>(null);
  const [editingEtapa, setEditingEtapa] = useState<EtapaWithCampeonato | null>(null);
  const [editingPiloto, setEditingPiloto] = useState<Piloto | null>(null);
  const [campeonatoForm, setCampeonatoForm] =
    useState<CampeonatoFormState>(emptyCampeonatoForm);
  const [etapaForm, setEtapaForm] = useState<EtapaFormState>(emptyEtapaForm);
  const [pilotoForm, setPilotoForm] = useState<PilotoFormState>(emptyPilotoForm);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deleting, setDeleting] = useState(false);

  const canWrite = ['owner', 'admin'].includes(role);

  const PAGE_SIZE_LOCAL = PAGE_SIZE;

  // unpaginated campeonatos, for dropdowns + classificacao default selection
  const loadCampeonatosAll = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const campeonatosData = await listCampeonatos();
      setCampeonatos(campeonatosData);
      setClassificacaoCampeonatoId((current) => {
        if (campeonatosData.some((campeonato) => campeonato.id === current)) {
          return current;
        }
        return campeonatosData[0]?.id ?? '';
      });
    } catch (error: unknown) {
      setLoadError(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadCampeonatosTab = useCallback(async () => {
    try {
      const result = await listCampeonatosPage(campeonatosSearch, campeonatosPage, PAGE_SIZE_LOCAL);
      setCampeonatosRows(result.data);
      setCampeonatosTotal(result.total);
    } catch (error: unknown) {
      setLoadError(getErrorMessage(error));
    }
  }, [campeonatosSearch, campeonatosPage, PAGE_SIZE_LOCAL]);

  const loadEtapasTab = useCallback(async () => {
    const filters: EtapasFilters = {
      campeonato_id: etapaCampeonatoId || undefined,
      status: etapaStatusFilter,
      q: etapasSearch,
    };
    try {
      const result = await listEtapasPage(filters, etapasPage, PAGE_SIZE_LOCAL);
      setEtapasRows(result.data);
      setEtapasTotal(result.total);
    } catch (error: unknown) {
      setLoadError(getErrorMessage(error));
    }
  }, [etapaCampeonatoId, etapaStatusFilter, etapasSearch, etapasPage, PAGE_SIZE_LOCAL]);

  const loadPilotosTab = useCallback(async () => {
    try {
      const result = await listPilotosPage(pilotosSearch, pilotosPage, PAGE_SIZE_LOCAL);
      setPilotosRows(result.data);
      setPilotosTotal(result.total);
    } catch (error: unknown) {
      setLoadError(getErrorMessage(error));
    }
  }, [pilotosSearch, pilotosPage, PAGE_SIZE_LOCAL]);

  const loadClassificacao = useCallback(async () => {
    if (!classificacaoCampeonatoId) {
      setClassificacao([]);
      setClassificacaoTotal(0);
      setClassificacaoError(null);
      return;
    }

    setClassificacaoLoading(true);
    setClassificacaoError(null);
    try {
      const result = await listClassificacaoPage(
        classificacaoCampeonatoId,
        classificacaoSearch,
        classificacaoPage,
        PAGE_SIZE_LOCAL,
      );
      setClassificacao(result.data);
      setClassificacaoTotal(result.total);
    } catch (error: unknown) {
      setClassificacaoError(getErrorMessage(error));
    } finally {
      setClassificacaoLoading(false);
    }
  }, [classificacaoCampeonatoId, classificacaoSearch, classificacaoPage, PAGE_SIZE_LOCAL]);

  const reloadAll = useCallback(async () => {
    await Promise.all([loadCampeonatosAll(), loadCampeonatosTab(), loadEtapasTab(), loadPilotosTab(), loadClassificacao()]);
  }, [loadCampeonatosAll, loadCampeonatosTab, loadEtapasTab, loadPilotosTab, loadClassificacao]);

  useEffect(() => {
    void loadCampeonatosAll();
  }, [loadCampeonatosAll]);

  useEffect(() => {
    void loadCampeonatosTab();
  }, [loadCampeonatosTab]);

  useEffect(() => {
    void loadEtapasTab();
  }, [loadEtapasTab]);

  useEffect(() => {
    void loadPilotosTab();
  }, [loadPilotosTab]);

  useEffect(() => {
    void loadClassificacao();
  }, [loadClassificacao]);

  // debounced search inputs -> committed filters (resets to page 0)
  useEffect(() => {
    const handle = setTimeout(() => {
      setCampeonatosSearch(campeonatosSearchInput);
      setCampeonatosPage(0);
    }, 350);
    return () => clearTimeout(handle);
  }, [campeonatosSearchInput]);

  useEffect(() => {
    const handle = setTimeout(() => {
      setEtapasSearch(etapasSearchInput);
      setEtapasPage(0);
    }, 350);
    return () => clearTimeout(handle);
  }, [etapasSearchInput]);

  useEffect(() => {
    const handle = setTimeout(() => {
      setPilotosSearch(pilotosSearchInput);
      setPilotosPage(0);
    }, 350);
    return () => clearTimeout(handle);
  }, [pilotosSearchInput]);

  useEffect(() => {
    const handle = setTimeout(() => {
      setClassificacaoSearch(classificacaoSearchInput);
      setClassificacaoPage(0);
    }, 350);
    return () => clearTimeout(handle);
  }, [classificacaoSearchInput]);

  const etapasFiltradas = useMemo(
    () => etapasRows,
    [etapasRows],
  );

  const campeonatoColumns = useMemo<readonly DataTableColumn<Campeonato>[]>(
    () => [
      { key: 'nome', label: 'Nome' },
      { key: 'slug', label: 'Slug' },
      { key: 'temporada', label: 'Temporada' },
      {
        key: 'status',
        label: 'Status',
        render: (campeonato) => <CampeonatosStatus status={campeonato.status} />,
      },
    ],
    [],
  );

  const etapaColumns = useMemo<readonly DataTableColumn<EtapaWithCampeonato>[]>(
    () => [
      {
        key: 'campeonato_id',
        label: 'Campeonato',
        render: (etapa) => etapa.campeonatos?.nome ?? 'Campeonato removido',
      },
      { key: 'round', label: 'Etapa' },
      { key: 'nome', label: 'Nome' },
      { key: 'data', label: 'Data', render: (etapa) => formatDate(etapa.data) },
      {
        key: 'status',
        label: 'Status',
        render: (etapa) => <EtapasStatus status={etapa.status} />,
      },
    ],
    [],
  );

  const pilotoColumns = useMemo<readonly DataTableColumn<Piloto>[]>(
    () => [
      { key: 'numero', label: 'Número' },
      { key: 'nome', label: 'Nome' },
      {
        key: 'equipe',
        label: 'Equipe',
        render: (piloto) => piloto.equipe ?? 'Sem equipe',
      },
      {
        key: 'cliente_id',
        label: 'Cliente vinculado',
        render: (piloto) => piloto.cliente_id ?? 'Não vinculado',
      },
    ],
    [],
  );

  const classificacaoColumns = useMemo<
    readonly DataTableColumn<ClassificacaoWithPiloto>[]
  >(
    () => [
      { key: 'posicao', label: 'Posição' },
      {
        key: 'piloto_id',
        label: 'Piloto',
        render: (linha) => linha.pilotos?.nome ?? 'Piloto removido',
      },
      {
        key: 'pilotos',
        label: 'Número',
        render: (linha) => linha.pilotos?.numero ?? '—',
      },
      {
        key: 'campeonato_id',
        label: 'Equipe',
        render: (linha) => linha.pilotos?.equipe ?? 'Sem equipe',
      },
      {
        key: 'pontos',
        label: 'Pontos',
        render: (linha) => pointsFormatter.format(Number(linha.pontos)),
      },
    ],
    [],
  );

  const openCreateModal = (kind: FormKind) => {
    setEditingCampeonato(null);
    setEditingEtapa(null);
    setEditingPiloto(null);
    setFormErrors({});

    if (kind === 'campeonatos') {
      setCampeonatoForm(emptyCampeonatoForm);
    } else if (kind === 'etapas') {
      setEtapaForm({
        ...emptyEtapaForm,
        campeonato_id: etapaCampeonatoId || campeonatos[0]?.id || '',
      });
    } else {
      setPilotoForm(emptyPilotoForm);
    }
    setFormKind(kind);
  };

  const openEditCampeonato = (campeonato: Campeonato) => {
    setEditingCampeonato(campeonato);
    setCampeonatoForm({
      nome: campeonato.nome,
      slug: campeonato.slug ?? '',
      temporada: campeonato.temporada ?? '',
      status: campeonato.status,
    });
    setFormErrors({});
    setFormKind('campeonatos');
  };

  const openEditEtapa = (etapa: EtapaWithCampeonato) => {
    setEditingEtapa(etapa);
    setEtapaForm({
      campeonato_id: etapa.campeonato_id ?? '',
      nome: etapa.nome,
      data: etapa.data ?? '',
      round: etapa.round === null ? '' : String(etapa.round),
      status: etapa.status,
    });
    setFormErrors({});
    setFormKind('etapas');
  };

  const openEditPiloto = (piloto: Piloto) => {
    setEditingPiloto(piloto);
    setPilotoForm({
      nome: piloto.nome,
      numero: piloto.numero ?? '',
      equipe: piloto.equipe ?? '',
      cliente_id: piloto.cliente_id ?? '',
    });
    setFormErrors({});
    setFormKind('pilotos');
  };

  const closeFormModal = () => {
    if (!submitting) {
      setFormKind(null);
    }
  };

  const validateCampeonato = (): boolean => {
    const errors: Record<string, string> = {};
    if (!campeonatoForm.nome.trim()) errors.nome = 'Informe o nome.';
    if (!campeonatoForm.slug.trim()) errors.slug = 'Informe o slug.';
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(campeonatoForm.slug.trim())) {
      errors.slug = 'Use letras minúsculas, números e hífens.';
    }
    if (!campeonatoForm.temporada.trim()) errors.temporada = 'Informe a temporada.';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validateEtapa = (): boolean => {
    const errors: Record<string, string> = {};
    const round = Number(etapaForm.round);
    if (!etapaForm.campeonato_id) errors.campeonato_id = 'Selecione um campeonato.';
    if (!etapaForm.nome.trim()) errors.nome = 'Informe o nome.';
    if (!etapaForm.data) errors.data = 'Informe a data.';
    if (!Number.isInteger(round) || round < 1) errors.round = 'Informe uma etapa válida.';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validatePiloto = (): boolean => {
    const errors: Record<string, string> = {};
    if (!pilotoForm.nome.trim()) errors.nome = 'Informe o nome.';
    if (!pilotoForm.numero.trim()) errors.numero = 'Informe o número.';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCampeonatoSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validateCampeonato()) return;

    const payload: CampeonatoPayload = {
      nome: campeonatoForm.nome.trim(),
      slug: campeonatoForm.slug.trim(),
      temporada: campeonatoForm.temporada.trim(),
      status: campeonatoForm.status,
    };

    setSubmitting(true);
    try {
      if (editingCampeonato) {
        await updateCampeonato(editingCampeonato.id, payload);
        toast.success('Campeonato atualizado com sucesso.');
      } else {
        await createCampeonato(payload);
        toast.success('Campeonato criado com sucesso.');
      }
      setFormKind(null);
      await reloadAll();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const handleEtapaSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validateEtapa()) return;

    const payload: EtapaPayload = {
      campeonato_id: etapaForm.campeonato_id,
      nome: etapaForm.nome.trim(),
      data: etapaForm.data,
      round: Number(etapaForm.round),
      status: etapaForm.status,
    };

    setSubmitting(true);
    try {
      if (editingEtapa) {
        await updateEtapa(editingEtapa.id, payload);
        toast.success('Etapa atualizada com sucesso.');
      } else {
        await createEtapa(payload);
        toast.success('Etapa criada com sucesso.');
      }
      setFormKind(null);
      await reloadAll();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const handlePilotoSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validatePiloto()) return;

    const payload: PilotoPayload = {
      nome: pilotoForm.nome.trim(),
      numero: pilotoForm.numero.trim(),
      equipe: pilotoForm.equipe.trim() || null,
      cliente_id: pilotoForm.cliente_id.trim() || null,
    };

    setSubmitting(true);
    try {
      if (editingPiloto) {
        await updatePiloto(editingPiloto.id, payload);
        toast.success('Piloto atualizado com sucesso.');
      } else {
        await createPiloto(payload);
        toast.success('Piloto criado com sucesso.');
      }
      setFormKind(null);
      await reloadAll();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    setDeleting(true);
    try {
      if (deleteTarget.kind === 'campeonato') {
        await removeCampeonato(deleteTarget.item.id);
        toast.success('Campeonato excluído com sucesso.');
      } else if (deleteTarget.kind === 'etapa') {
        await removeEtapa(deleteTarget.item.id);
        toast.success('Etapa excluída com sucesso.');
      } else {
        await removePiloto(deleteTarget.item.id);
        toast.success('Piloto excluído com sucesso.');
      }
      setDeleteTarget(null);
      await reloadAll();
      await loadClassificacao();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
    } finally {
      setDeleting(false);
    }
  };

  const actionLabel = canWrite
    ? activeTab === 'campeonatos'
      ? 'Novo campeonato'
      : activeTab === 'etapas'
        ? 'Nova etapa'
        : activeTab === 'pilotos'
          ? 'Novo piloto'
          : undefined
    : undefined;

  const deleteMessage = deleteTarget
    ? `${deleteTarget.kind === 'campeonato' ? 'O campeonato' : deleteTarget.kind === 'etapa' ? 'A etapa' : 'O piloto'} “${deleteTarget.item.nome}” será ${deleteTarget.kind === 'etapa' ? 'excluída' : 'excluído'} permanentemente.`
    : '';

  return (
    <section>
      <PageHeader
        actionLabel={actionLabel}
        onAction={
          actionLabel && (activeTab === 'campeonatos' || activeTab === 'etapas' || activeTab === 'pilotos')
            ? () => openCreateModal(activeTab)
            : undefined
        }
        subtitle="Gerencie inscrições, campeonatos, etapas, pilotos e consulte a classificação geral."
        title="Campeonatos"
      />

      <div
        aria-label="Seções de campeonatos"
        className="mt-8 flex gap-2 overflow-x-auto border-b border-zinc-800"
        role="tablist"
      >
        {(Object.keys(tabLabels) as Tab[]).map((tab) => (
          <button
            aria-selected={activeTab === tab}
            className={`whitespace-nowrap border-b-2 px-4 py-3 text-sm font-bold transition-colors ${
              activeTab === tab
                ? 'border-brand-400 text-brand-200'
                : 'border-transparent text-zinc-400 hover:text-white'
            }`}
            key={tab}
            onClick={() => setActiveTab(tab)}
            role="tab"
            type="button"
          >
            {tabLabels[tab]}
          </button>
        ))}
      </div>

<div className="mt-6" role="tabpanel">
{activeTab === 'inscricoes' ? <CampeonatoInscricoesPanel /> : null}

{activeTab === 'campeonatos' ? (
          <div>
            <div className="mb-4 max-w-xs">
              <FormField htmlFor="campeonatos-busca" label="Buscar">
                <input
                  className={inputClassName}
                  id="campeonatos-busca"
                  onChange={(event) => setCampeonatosSearchInput(event.target.value)}
                  placeholder="Nome, slug ou temporada"
                  value={campeonatosSearchInput}
                />
              </FormField>
            </div>
            <DataTable
              columns={campeonatoColumns}
              emptyLabel="Nenhum campeonato encontrado."
              error={loadError}
              loading={loading}
              onDelete={
                canWrite
                  ? (item) => setDeleteTarget({ kind: 'campeonato', item })
                  : undefined
              }
              onEdit={canWrite ? openEditCampeonato : undefined}
              onRetry={() => void reloadAll()}
              rows={campeonatosRows}
            />
            <Pagination
              onPageChange={setCampeonatosPage}
              page={campeonatosPage}
              pageSize={PAGE_SIZE}
              total={campeonatosTotal}
            />
          </div>
        ) : null}

        {activeTab === 'etapas' ? (
          <div className="space-y-5">
            <div className="flex flex-wrap items-end gap-4">
              <div className="w-full max-w-xs">
                <FormField htmlFor="etapas-busca" label="Buscar">
                  <input
                    className={inputClassName}
                    id="etapas-busca"
                    onChange={(event) => setEtapasSearchInput(event.target.value)}
                    placeholder="Nome da etapa"
                    value={etapasSearchInput}
                  />
                </FormField>
              </div>
              <div className="w-full max-w-xs">
                <FormField htmlFor="etapas-filtro-campeonato" label="Filtrar por campeonato">
                  <select
                    className={inputClassName}
                    id="etapas-filtro-campeonato"
                    onChange={(event) => {
                      setEtapaCampeonatoId(event.target.value);
                      setEtapasPage(0);
                    }}
                    value={etapaCampeonatoId}
                  >
                    <option value="">Todos os campeonatos</option>
                    {campeonatos.map((campeonato) => (
                      <option key={campeonato.id} value={campeonato.id}>
                        {campeonato.nome} — {campeonato.temporada ?? 'Sem temporada'}
                      </option>
                    ))}
                  </select>
                </FormField>
              </div>
              <div className="w-full max-w-xs">
                <FormField htmlFor="etapas-filtro-status" label="Status">
                  <select
                    className={inputClassName}
                    id="etapas-filtro-status"
                    onChange={(event) => {
                      setEtapaStatusFilter(event.target.value as EtapaStatus | '');
                      setEtapasPage(0);
                    }}
                    value={etapaStatusFilter}
                  >
                    <option value="">Todos</option>
                    {Object.entries(etapaStatusLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </FormField>
              </div>
            </div>
            <DataTable
              columns={etapaColumns}
              emptyLabel="Nenhuma etapa encontrada."
              error={loadError}
              loading={loading}
              onDelete={
                canWrite ? (item) => setDeleteTarget({ kind: 'etapa', item }) : undefined
              }
              onEdit={canWrite ? openEditEtapa : undefined}
              onRetry={() => void reloadAll()}
              rows={etapasFiltradas}
            />
            <Pagination onPageChange={setEtapasPage} page={etapasPage} pageSize={PAGE_SIZE} total={etapasTotal} />
          </div>
        ) : null}

        {activeTab === 'pilotos' ? (
          <div>
            <div className="mb-4 max-w-xs">
              <FormField htmlFor="pilotos-busca" label="Buscar">
                <input
                  className={inputClassName}
                  id="pilotos-busca"
                  onChange={(event) => setPilotosSearchInput(event.target.value)}
                  placeholder="Nome, número ou equipe"
                  value={pilotosSearchInput}
                />
              </FormField>
            </div>
            <DataTable
              columns={pilotoColumns}
              emptyLabel="Nenhum piloto encontrado."
              error={loadError}
              loading={loading}
              onDelete={
                canWrite ? (item) => setDeleteTarget({ kind: 'piloto', item }) : undefined
              }
              onEdit={canWrite ? openEditPiloto : undefined}
              onRetry={() => void reloadAll()}
              rows={pilotosRows}
            />
            <Pagination onPageChange={setPilotosPage} page={pilotosPage} pageSize={PAGE_SIZE} total={pilotosTotal} />
          </div>
        ) : null}

        {activeTab === 'classificacao' ? (
          <div className="space-y-5">
            <div className="flex flex-wrap items-end gap-4">
              <div className="w-full max-w-xs">
                <FormField htmlFor="classificacao-campeonato" label="Campeonato">
                  <select
                    className={inputClassName}
                    id="classificacao-campeonato"
                    onChange={(event) => {
                      setClassificacaoCampeonatoId(event.target.value);
                      setClassificacaoPage(0);
                    }}
                    value={classificacaoCampeonatoId}
                  >
                    <option value="">Selecione</option>
                    {campeonatos.map((campeonato) => (
                      <option key={campeonato.id} value={campeonato.id}>
                        {campeonato.nome} — {campeonato.temporada ?? 'Sem temporada'}
                      </option>
                    ))}
                  </select>
                </FormField>
              </div>
              <div className="w-full max-w-xs">
                <FormField htmlFor="classificacao-busca" label="Buscar piloto">
                  <input
                    className={inputClassName}
                    id="classificacao-busca"
                    onChange={(event) => setClassificacaoSearchInput(event.target.value)}
                    placeholder="Nome do piloto"
                    value={classificacaoSearchInput}
                  />
                </FormField>
              </div>
            </div>
            <DataTable
              columns={classificacaoColumns}
              emptyLabel={
                classificacaoCampeonatoId
                  ? 'Nenhuma classificação disponível.'
                  : 'Selecione um campeonato.'
              }
              error={classificacaoError}
              loading={classificacaoLoading}
              onRetry={() => void loadClassificacao()}
              rows={classificacao}
            />
            <Pagination
              onPageChange={setClassificacaoPage}
              page={classificacaoPage}
              pageSize={PAGE_SIZE}
              total={classificacaoTotal}
            />
          </div>
        ) : null}
      </div>

      <Modal
        footer={
          <>
            <Button disabled={submitting} onClick={closeFormModal} variant="ghost">
              Cancelar
            </Button>
            <Button
              form={
                formKind === 'campeonatos'
                  ? 'campeonato-form'
                  : formKind === 'etapas'
                    ? 'etapa-form'
                    : 'piloto-form'
              }
              loading={submitting}
              type="submit"
            >
              Salvar
            </Button>
          </>
        }
        isOpen={formKind !== null}
        onClose={closeFormModal}
        title={
          formKind === 'campeonatos'
            ? editingCampeonato
              ? 'Editar campeonato'
              : 'Novo campeonato'
            : formKind === 'etapas'
              ? editingEtapa
                ? 'Editar etapa'
                : 'Nova etapa'
              : editingPiloto
                ? 'Editar piloto'
                : 'Novo piloto'
        }
      >
        {formKind === 'campeonatos' ? (
          <form className="grid gap-5 md:grid-cols-2" id="campeonato-form" onSubmit={handleCampeonatoSubmit}>
            <div className="md:col-span-2">
              <FormField error={formErrors.nome} htmlFor="campeonato-nome" label="Nome">
                <input
                  className={inputClassName}
                  id="campeonato-nome"
                  onChange={(event) =>
                    setCampeonatoForm((current) => ({ ...current, nome: event.target.value }))
                  }
                  required
                  value={campeonatoForm.nome}
                />
              </FormField>
            </div>
            <FormField error={formErrors.slug} htmlFor="campeonato-slug" label="Slug">
              <input
                className={inputClassName}
                id="campeonato-slug"
                onChange={(event) =>
                  setCampeonatoForm((current) => ({ ...current, slug: event.target.value }))
                }
                placeholder="campeonato-2026"
                required
                value={campeonatoForm.slug}
              />
            </FormField>
            <FormField error={formErrors.temporada} htmlFor="campeonato-temporada" label="Temporada">
              <input
                className={inputClassName}
                id="campeonato-temporada"
                onChange={(event) =>
                  setCampeonatoForm((current) => ({ ...current, temporada: event.target.value }))
                }
                required
                value={campeonatoForm.temporada}
              />
            </FormField>
            <FormField htmlFor="campeonato-status" label="Status">
              <select
                className={inputClassName}
                id="campeonato-status"
                onChange={(event) =>
                  setCampeonatoForm((current) => ({
                    ...current,
                    status: event.target.value as CampeonatoStatus,
                  }))
                }
                value={campeonatoForm.status}
              >
                {Object.entries(campeonatoStatusLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </FormField>
          </form>
        ) : null}

        {formKind === 'etapas' ? (
          <form className="grid gap-5 md:grid-cols-2" id="etapa-form" onSubmit={handleEtapaSubmit}>
            <div className="md:col-span-2">
              <FormField error={formErrors.campeonato_id} htmlFor="etapa-campeonato" label="Campeonato">
                <select
                  className={inputClassName}
                  id="etapa-campeonato"
                  onChange={(event) =>
                    setEtapaForm((current) => ({ ...current, campeonato_id: event.target.value }))
                  }
                  required
                  value={etapaForm.campeonato_id}
                >
                  <option value="">Selecione</option>
                  {campeonatos.map((campeonato) => (
                    <option key={campeonato.id} value={campeonato.id}>
                      {campeonato.nome} — {campeonato.temporada ?? 'Sem temporada'}
                    </option>
                  ))}
                </select>
              </FormField>
            </div>
            <FormField error={formErrors.nome} htmlFor="etapa-nome" label="Nome">
              <input
                className={inputClassName}
                id="etapa-nome"
                onChange={(event) =>
                  setEtapaForm((current) => ({ ...current, nome: event.target.value }))
                }
                required
                value={etapaForm.nome}
              />
            </FormField>
            <FormField error={formErrors.round} htmlFor="etapa-round" label="Número da etapa">
              <input
                className={inputClassName}
                id="etapa-round"
                min="1"
                onChange={(event) =>
                  setEtapaForm((current) => ({ ...current, round: event.target.value }))
                }
                required
                step="1"
                type="number"
                value={etapaForm.round}
              />
            </FormField>
            <FormField error={formErrors.data} htmlFor="etapa-data" label="Data">
              <input
                className={inputClassName}
                id="etapa-data"
                onChange={(event) =>
                  setEtapaForm((current) => ({ ...current, data: event.target.value }))
                }
                required
                type="date"
                value={etapaForm.data}
              />
            </FormField>
            <FormField htmlFor="etapa-status" label="Status">
              <select
                className={inputClassName}
                id="etapa-status"
                onChange={(event) =>
                  setEtapaForm((current) => ({
                    ...current,
                    status: event.target.value as EtapaStatus,
                  }))
                }
                value={etapaForm.status}
              >
                {Object.entries(etapaStatusLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </FormField>
          </form>
        ) : null}

        {formKind === 'pilotos' ? (
          <form className="grid gap-5 md:grid-cols-2" id="piloto-form" onSubmit={handlePilotoSubmit}>
            <FormField error={formErrors.nome} htmlFor="piloto-nome" label="Nome">
              <input
                className={inputClassName}
                id="piloto-nome"
                onChange={(event) =>
                  setPilotoForm((current) => ({ ...current, nome: event.target.value }))
                }
                required
                value={pilotoForm.nome}
              />
            </FormField>
            <FormField error={formErrors.numero} htmlFor="piloto-numero" label="Número">
              <input
                className={inputClassName}
                id="piloto-numero"
                onChange={(event) =>
                  setPilotoForm((current) => ({ ...current, numero: event.target.value }))
                }
                required
                value={pilotoForm.numero}
              />
            </FormField>
            <FormField htmlFor="piloto-equipe" label="Equipe">
              <input
                className={inputClassName}
                id="piloto-equipe"
                onChange={(event) =>
                  setPilotoForm((current) => ({ ...current, equipe: event.target.value }))
                }
                value={pilotoForm.equipe}
              />
            </FormField>
            <FormField
              hint="Identificador opcional do cliente relacionado."
              htmlFor="piloto-cliente"
              label="Cliente ID"
            >
              <input
                className={inputClassName}
                id="piloto-cliente"
                onChange={(event) =>
                  setPilotoForm((current) => ({ ...current, cliente_id: event.target.value }))
                }
                value={pilotoForm.cliente_id}
              />
            </FormField>
          </form>
        ) : null}
      </Modal>

      <ConfirmDialog
        isOpen={deleteTarget !== null}
        loading={deleting}
        message={deleteMessage}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void handleDelete()}
        title="Confirmar exclusão"
      />
    </section>
  );
};
