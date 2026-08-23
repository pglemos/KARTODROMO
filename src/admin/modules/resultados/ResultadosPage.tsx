import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useAuth } from '../../auth/AuthContext';
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
  listCampeonatos,
  listEtapas,
  listPilotos,
} from '../campeonatos/campeonatos.api';
import type {
  Campeonato,
  EtapaWithCampeonato,
  Piloto,
} from '../campeonatos/campeonatos.types';
import {
  listLapTimeRacingsPage,
  type LapTimeRacing,
  type LapTimeRacingsFilters,
} from './laptime-racings.api';
import {
  listCalXProCorridaCompetidores,
  listCalXProCorridasPage,
  type CalXProCorrida,
  type CalXProCorridaCompetidor,
  type CalXProCorridasFilters,
} from './calxpro-corridas.api';
import {
  createCorrida,
  createResultado,
  listCorridasPage,
  listResultados,
  removeCorrida,
  removeResultado,
  updateCorrida,
  updateResultado,
  type CorridasFilters,
} from './resultados.api';
import type {
  CorridaPayload,
  CorridaStatus,
  CorridaWithRelations,
  ResultadoPayload,
  ResultadoWithPiloto,
} from './resultados.types';

const PAGE_SIZE = 10;
type ResultadosTabKey = 'reais' | 'manual' | 'calxpro';

type CorridaFormState = {
  campeonato_id: string;
  etapa_id: string;
  titulo: string;
  data: string;
  status: CorridaStatus;
  source: string;
};

type ResultadoFormState = {
  piloto_id: string;
  piloto_nome: string;
  posicao: string;
  melhor_volta: string;
  voltas: string;
  pontos: string;
  gap: string;
};

type DeleteTarget =
  | { kind: 'corrida'; item: CorridaWithRelations }
  | { kind: 'resultado'; item: ResultadoWithPiloto };

const emptyCorridaForm: CorridaFormState = {
  campeonato_id: '',
  etapa_id: '',
  titulo: '',
  data: '',
  status: 'rascunho',
  source: '',
};

const emptyResultadoForm: ResultadoFormState = {
  piloto_id: '',
  piloto_nome: '',
  posicao: '1',
  melhor_volta: '',
  voltas: '0',
  pontos: '0',
  gap: '',
};

const inputClassName =
  'w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20';

const corridaStatusLabels: Record<CorridaStatus, string> = {
  rascunho: 'Rascunho',
  publicada: 'Publicada',
};

const corridaStatusClasses: Record<CorridaStatus, string> = {
  rascunho: 'border-amber-800 bg-amber-950 text-amber-200',
  publicada: 'border-brand-800 bg-brand-950 text-brand-100',
};

const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
});

const formatDateSafe = (value: unknown): string => {
  if (!value) return '—';
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? '—' : dateFormatter.format(date);
};

const pointsFormatter = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'Ocorreu um erro inesperado.';

const toDateTimeLocal = (value: string | null): string => {
  if (!value) return '';
  const date = new Date(value);
  const localTime = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localTime.toISOString().slice(0, 16);
};

const CorridaStatusBadge = ({ status }: { status: CorridaStatus }) => (
  <span
    className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${corridaStatusClasses[status]}`}
  >
    {corridaStatusLabels[status]}
  </span>
);

export const ResultadosPage = () => {
  const { role } = useAuth();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<ResultadosTabKey>('reais');

  const [racings, setRacings] = useState<LapTimeRacing[]>([]);
  const [racingsTotal, setRacingsTotal] = useState(0);
  const [racingsPage, setRacingsPage] = useState(0);
  const [racingsSearchInput, setRacingsSearchInput] = useState('');
  const [racingsFilters, setRacingsFilters] = useState<LapTimeRacingsFilters>({});
  const [racingsLoading, setRacingsLoading] = useState(true);
  const [racingsError, setRacingsError] = useState<string | null>(null);

  const [corridas, setCorridas] = useState<CorridaWithRelations[]>([]);
  const [corridasTotal, setCorridasTotal] = useState(0);
  const [corridasPage, setCorridasPage] = useState(0);
  const [corridasSearchInput, setCorridasSearchInput] = useState('');
  const [corridasFilters, setCorridasFilters] = useState<CorridasFilters>({});
  const [campeonatos, setCampeonatos] = useState<Campeonato[]>([]);
  const [etapas, setEtapas] = useState<EtapaWithCampeonato[]>([]);
  const [pilotos, setPilotos] = useState<Piloto[]>([]);
  const [selectedCorridaId, setSelectedCorridaId] = useState('');
  const [resultados, setResultados] = useState<ResultadoWithPiloto[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [resultadosLoading, setResultadosLoading] = useState(false);
  const [resultadosError, setResultadosError] = useState<string | null>(null);
  const [corridaFormOpen, setCorridaFormOpen] = useState(false);
  const [resultadoFormOpen, setResultadoFormOpen] = useState(false);
  const [editingCorrida, setEditingCorrida] = useState<CorridaWithRelations | null>(null);
  const [editingResultado, setEditingResultado] = useState<ResultadoWithPiloto | null>(null);
  const [corridaForm, setCorridaForm] = useState<CorridaFormState>(emptyCorridaForm);
  const [resultadoForm, setResultadoForm] =
    useState<ResultadoFormState>(emptyResultadoForm);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [calxproCorridas, setCalxproCorridas] = useState<CalXProCorrida[]>([]);
  const [calxproCorridasTotal, setCalxproCorridasTotal] = useState(0);
  const [calxproCorridasPage, setCalxproCorridasPage] = useState(0);
  const [calxproSearchInput, setCalxproSearchInput] = useState('');
  const [calxproFilters, setCalxproFilters] = useState<CalXProCorridasFilters>({});
  const [calxproCorridasLoading, setCalxproCorridasLoading] = useState(true);
  const [calxproCorridasError, setCalxproCorridasError] = useState<string | null>(null);
  const [selectedCalxproCorridaId, setSelectedCalxproCorridaId] = useState<string | null>(null);
  const [calxproCompetidores, setCalxproCompetidores] = useState<CalXProCorridaCompetidor[]>([]);
  const [calxproCompetidoresLoading, setCalxproCompetidoresLoading] = useState(false);
  const [calxproCompetidoresError, setCalxproCompetidoresError] = useState<string | null>(null);

  const canWrite = ['owner', 'admin', 'operador_telao'].includes(role);

  const selectedCorrida = useMemo(
    () => corridas.find((corrida) => corrida.id === selectedCorridaId) ?? null,
    [corridas, selectedCorridaId],
  );

  const etapasDoFormulario = useMemo(
    () =>
      corridaForm.campeonato_id
        ? etapas.filter((etapa) => etapa.campeonato_id === corridaForm.campeonato_id)
        : etapas,
    [corridaForm.campeonato_id, etapas],
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    try {
      const [corridasPageData, campeonatosData, etapasData, pilotosData] = await Promise.all([
        listCorridasPage(corridasFilters, corridasPage, PAGE_SIZE),
        listCampeonatos(),
        listEtapas(),
        listPilotos(),
      ]);
      setCorridas(corridasPageData.data);
      setCorridasTotal(corridasPageData.total);
      setCampeonatos(campeonatosData);
      setEtapas(etapasData);
      setPilotos(pilotosData);
      setSelectedCorridaId((current) => {
        if (corridasPageData.data.some((corrida) => corrida.id === current)) return current;
        return corridasPageData.data[0]?.id ?? '';
      });
    } catch (error: unknown) {
      setLoadError(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [corridasFilters, corridasPage]);

  useEffect(() => {
    const handle = setTimeout(() => {
      setCorridasFilters((current) => ({ ...current, q: corridasSearchInput || undefined }));
      setCorridasPage(0);
    }, 350);
    return () => clearTimeout(handle);
  }, [corridasSearchInput]);

  const updateCorridasStatusFilter = (status: CorridaStatus | '') => {
    setCorridasFilters((current) => ({ ...current, status }));
    setCorridasPage(0);
  };

  const loadRacings = useCallback(async () => {
    setRacingsLoading(true);
    setRacingsError(null);
    try {
      const result = await listLapTimeRacingsPage(racingsFilters, racingsPage, PAGE_SIZE);
      setRacings(result.data);
      setRacingsTotal(result.total);
    } catch (error: unknown) {
      setRacingsError(getErrorMessage(error));
    } finally {
      setRacingsLoading(false);
    }
  }, [racingsFilters, racingsPage]);

  useEffect(() => {
    if (activeTab === 'reais') void loadRacings();
  }, [activeTab, loadRacings]);

  useEffect(() => {
    const handle = setTimeout(() => {
      setRacingsFilters((current) => ({ ...current, q: racingsSearchInput || undefined }));
      setRacingsPage(0);
    }, 350);
    return () => clearTimeout(handle);
  }, [racingsSearchInput]);

  const loadCalxproCorridas = useCallback(async () => {
    setCalxproCorridasLoading(true);
    setCalxproCorridasError(null);
    try {
      const result = await listCalXProCorridasPage(calxproFilters, calxproCorridasPage, PAGE_SIZE);
      setCalxproCorridas(result.data);
      setCalxproCorridasTotal(result.total);
      setSelectedCalxproCorridaId((current) =>
        current && result.data.some((corrida) => corrida.id === current) ? current : result.data[0]?.id ?? null,
      );
    } catch (error: unknown) {
      setCalxproCorridasError(getErrorMessage(error));
    } finally {
      setCalxproCorridasLoading(false);
    }
  }, [calxproFilters, calxproCorridasPage]);

  const loadCalxproCompetidores = useCallback(async () => {
    if (!selectedCalxproCorridaId) {
      setCalxproCompetidores([]);
      setCalxproCompetidoresError(null);
      return;
    }
    setCalxproCompetidoresLoading(true);
    setCalxproCompetidoresError(null);
    try {
      setCalxproCompetidores(await listCalXProCorridaCompetidores(selectedCalxproCorridaId));
    } catch (error: unknown) {
      setCalxproCompetidoresError(getErrorMessage(error));
    } finally {
      setCalxproCompetidoresLoading(false);
    }
  }, [selectedCalxproCorridaId]);

  useEffect(() => {
    if (activeTab === 'calxpro') void loadCalxproCorridas();
  }, [activeTab, loadCalxproCorridas]);

  useEffect(() => {
    if (activeTab === 'calxpro') void loadCalxproCompetidores();
  }, [activeTab, loadCalxproCompetidores]);

  useEffect(() => {
    const handle = setTimeout(() => {
      setCalxproFilters((current) => ({ ...current, q: calxproSearchInput || undefined }));
      setCalxproCorridasPage(0);
    }, 350);
    return () => clearTimeout(handle);
  }, [calxproSearchInput]);

  const updateRacingsStatusFilter = (status: 'finalizada' | 'aberta' | '') => {
    setRacingsFilters((current) => ({ ...current, status }));
    setRacingsPage(0);
  };

  const racingColumns = useMemo<readonly DataTableColumn<LapTimeRacing>[]>(
    () => [
      {
        key: 'nome',
        label: 'Corrida',
        render: (racing) => (
          <a
            className="text-left font-bold text-white underline-offset-4 hover:text-brand-300 hover:underline"
            href={`/admin/resultados/${encodeURIComponent(racing.id)}`}
          >
            {racing.nome}
          </a>
        ),
      },
      { key: 'tipo', label: 'Tipo', render: (racing) => racing.tipo ?? '—' },
      {
        key: 'dataHora',
        label: 'Data/hora',
        render: (racing) => formatDateSafe(racing.dataHora),
      },
      { key: 'participantes', label: 'Participantes' },
      {
        key: 'estado',
        label: 'Status',
        render: (racing) => (
          <span
            className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${
              racing.situacao === 'finalizada'
                ? 'border-brand-800 bg-brand-950 text-brand-100'
                : racing.situacao === 'agendada'
                  ? 'border-zinc-700 bg-zinc-900 text-zinc-300'
                  : 'border-amber-800 bg-amber-950 text-amber-200'
            }`}
          >
            {racing.situacao === 'finalizada'
              ? 'Finalizada'
              : racing.situacao === 'agendada'
                ? 'Agendada'
                : 'Em andamento'}
          </span>
        ),
      },
    ],
    [],
  );

  const calxproCorridaColumns = useMemo<readonly DataTableColumn<CalXProCorrida>[]>(
    () => [
      {
        key: 'nome',
        label: 'Corrida',
        render: (corrida) => (
          <button
            className={`text-left font-bold underline-offset-4 hover:underline ${
              selectedCalxproCorridaId === corrida.id ? 'text-brand-300' : 'text-white'
            }`}
            onClick={() => setSelectedCalxproCorridaId(corrida.id)}
            type="button"
          >
            {corrida.nome}
          </button>
        ),
      },
      {
        key: 'dataHora',
        label: 'Data/hora',
        render: (corrida) => dateFormatter.format(new Date(corrida.dataHora)),
      },
      { key: 'participantes', label: 'Participantes' },
    ],
    [selectedCalxproCorridaId],
  );

  const calxproCompetidorColumns = useMemo<readonly DataTableColumn<CalXProCorridaCompetidor>[]>(
    () => [
      { key: 'posicao', label: 'Pos.', render: (item) => item.posicao ?? '—' },
      { key: 'nome', label: 'Piloto' },
      { key: 'cidade', label: 'Cidade', render: (item) => item.cidade ?? '—' },
      { key: 'voltas', label: 'Voltas', render: (item) => item.voltas ?? '—' },
      { key: 'melhorVolta', label: 'Melhor volta', render: (item) => item.melhorVolta ?? '—' },
      { key: 'tempoTotal', label: 'Tempo total', render: (item) => item.tempoTotal ?? '—' },
    ],
    [],
  );

  const loadResultados = useCallback(async () => {
    if (!selectedCorridaId) {
      setResultados([]);
      setResultadosError(null);
      return;
    }

    setResultadosLoading(true);
    setResultadosError(null);
    try {
      setResultados(await listResultados(selectedCorridaId));
    } catch (error: unknown) {
      setResultadosError(getErrorMessage(error));
    } finally {
      setResultadosLoading(false);
    }
  }, [selectedCorridaId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    void loadResultados();
  }, [loadResultados]);

  const corridaColumns = useMemo<readonly DataTableColumn<CorridaWithRelations>[]>(
    () => [
      {
        key: 'titulo',
        label: 'Corrida',
        render: (corrida) => (
          <button
            className={`text-left font-bold underline-offset-4 hover:underline ${
              selectedCorridaId === corrida.id ? 'text-brand-300' : 'text-white'
            }`}
            onClick={() => setSelectedCorridaId(corrida.id)}
            type="button"
          >
            {corrida.titulo}
          </button>
        ),
      },
      {
        key: 'campeonato_id',
        label: 'Campeonato',
        render: (corrida) => corrida.campeonatos?.nome ?? 'Campeonato removido',
      },
      {
        key: 'etapa_id',
        label: 'Etapa',
        render: (corrida) => corrida.etapas?.nome ?? 'Etapa removida',
      },
      {
        key: 'data',
        label: 'Data',
        render: (corrida) =>
          corrida.data ? dateFormatter.format(new Date(corrida.data)) : '—',
      },
      {
        key: 'status',
        label: 'Status',
        render: (corrida) => <CorridaStatusBadge status={corrida.status} />,
      },
    ],
    [selectedCorridaId],
  );

  const resultadoColumns = useMemo<
    readonly DataTableColumn<ResultadoWithPiloto>[]
  >(
    () => [
      { key: 'posicao', label: 'Posição' },
      { key: 'piloto_nome', label: 'Piloto' },
      {
        key: 'melhor_volta',
        label: 'Melhor volta',
        render: (resultado) => resultado.melhor_volta ?? '—',
      },
      { key: 'voltas', label: 'Voltas' },
      {
        key: 'pontos',
        label: 'Pontos',
        render: (resultado) => pointsFormatter.format(Number(resultado.pontos)),
      },
      { key: 'gap', label: 'Gap', render: (resultado) => resultado.gap ?? '—' },
    ],
    [],
  );

  const openCreateCorrida = () => {
    const campeonatoId = campeonatos[0]?.id ?? '';
    const etapaId = etapas.find((etapa) => etapa.campeonato_id === campeonatoId)?.id ?? '';
    setEditingCorrida(null);
    setCorridaForm({
      ...emptyCorridaForm,
      campeonato_id: campeonatoId,
      etapa_id: etapaId,
    });
    setFormErrors({});
    setCorridaFormOpen(true);
  };

  const openEditCorrida = (corrida: CorridaWithRelations) => {
    setEditingCorrida(corrida);
    setCorridaForm({
      campeonato_id: corrida.campeonato_id ?? '',
      etapa_id: corrida.etapa_id ?? '',
      titulo: corrida.titulo,
      data: toDateTimeLocal(corrida.data),
      status: corrida.status,
      source: corrida.source ?? '',
    });
    setFormErrors({});
    setCorridaFormOpen(true);
  };

  const openCreateResultado = () => {
    if (!selectedCorrida) return;
    const piloto = pilotos[0];
    setEditingResultado(null);
    setResultadoForm({
      ...emptyResultadoForm,
      piloto_id: piloto?.id ?? '',
      piloto_nome: piloto?.nome ?? '',
    });
    setFormErrors({});
    setResultadoFormOpen(true);
  };

  const openEditResultado = (resultado: ResultadoWithPiloto) => {
    setEditingResultado(resultado);
    setResultadoForm({
      piloto_id: resultado.piloto_id ?? '',
      piloto_nome: resultado.piloto_nome,
      posicao: resultado.posicao === null ? '' : String(resultado.posicao),
      melhor_volta: resultado.melhor_volta ?? '',
      voltas: resultado.voltas === null ? '' : String(resultado.voltas),
      pontos: resultado.pontos === null ? '' : String(resultado.pontos),
      gap: resultado.gap ?? '',
    });
    setFormErrors({});
    setResultadoFormOpen(true);
  };

  const closeCorridaModal = () => {
    if (!submitting) setCorridaFormOpen(false);
  };

  const closeResultadoModal = () => {
    if (!submitting) setResultadoFormOpen(false);
  };

  const handleCampeonatoChange = (campeonatoId: string) => {
    const etapaId = etapas.find((etapa) => etapa.campeonato_id === campeonatoId)?.id ?? '';
    setCorridaForm((current) => ({
      ...current,
      campeonato_id: campeonatoId,
      etapa_id: etapaId,
    }));
  };

  const handlePilotoChange = (pilotoId: string) => {
    const piloto = pilotos.find((item) => item.id === pilotoId);
    setResultadoForm((current) => ({
      ...current,
      piloto_id: pilotoId,
      piloto_nome: piloto?.nome ?? '',
    }));
  };

  const validateCorrida = (): boolean => {
    const errors: Record<string, string> = {};
    if (!corridaForm.campeonato_id) errors.campeonato_id = 'Selecione um campeonato.';
    if (!corridaForm.etapa_id) errors.etapa_id = 'Selecione uma etapa.';
    if (!corridaForm.titulo.trim()) errors.titulo = 'Informe o título.';
    if (!corridaForm.data) errors.data = 'Informe a data e hora.';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validateResultado = (): boolean => {
    const errors: Record<string, string> = {};
    const posicao = Number(resultadoForm.posicao);
    const voltas = Number(resultadoForm.voltas);
    const pontos = Number(resultadoForm.pontos);
    if (!resultadoForm.piloto_id) errors.piloto_id = 'Selecione um piloto.';
    if (!resultadoForm.piloto_nome.trim()) errors.piloto_nome = 'Informe o nome do piloto.';
    if (!Number.isInteger(posicao) || posicao < 1) errors.posicao = 'Informe uma posição válida.';
    if (!Number.isInteger(voltas) || voltas < 0) errors.voltas = 'Informe um total de voltas válido.';
    if (!Number.isFinite(pontos) || pontos < 0) errors.pontos = 'Informe uma pontuação válida.';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCorridaSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validateCorrida()) return;

    const payload: CorridaPayload = {
      campeonato_id: corridaForm.campeonato_id,
      etapa_id: corridaForm.etapa_id,
      titulo: corridaForm.titulo.trim(),
      data: new Date(corridaForm.data).toISOString(),
      status: corridaForm.status,
      source: corridaForm.source.trim() || null,
    };

    setSubmitting(true);
    try {
      if (editingCorrida) {
        await updateCorrida(editingCorrida.id, payload);
        toast.success('Corrida atualizada com sucesso.');
      } else {
        const corrida = await createCorrida(payload);
        setSelectedCorridaId(corrida.id);
        toast.success('Corrida criada com sucesso.');
      }
      setCorridaFormOpen(false);
      await loadData();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const handleResultadoSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedCorrida || !validateResultado()) return;

    const payload: ResultadoPayload = {
      corrida_id: selectedCorrida.id,
      piloto_id: resultadoForm.piloto_id,
      piloto_nome: resultadoForm.piloto_nome.trim(),
      posicao: Number(resultadoForm.posicao),
      melhor_volta: resultadoForm.melhor_volta.trim() || null,
      voltas: Number(resultadoForm.voltas),
      pontos: Number(resultadoForm.pontos),
      gap: resultadoForm.gap.trim() || null,
    };

    setSubmitting(true);
    try {
      if (editingResultado) {
        await updateResultado(editingResultado.id, payload);
        toast.success('Resultado atualizado com sucesso.');
      } else {
        await createResultado(payload);
        toast.success('Resultado criado com sucesso.');
      }
      setResultadoFormOpen(false);
      await loadResultados();
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
      if (deleteTarget.kind === 'corrida') {
        await removeCorrida(deleteTarget.item.id);
        toast.success('Corrida excluída com sucesso.');
        setDeleteTarget(null);
        await loadData();
      } else {
        await removeResultado(deleteTarget.item.id);
        toast.success('Resultado excluído com sucesso.');
        setDeleteTarget(null);
        await loadResultados();
      }
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
    } finally {
      setDeleting(false);
    }
  };

  const deleteMessage = deleteTarget
    ? deleteTarget.kind === 'corrida'
      ? `A corrida “${deleteTarget.item.titulo}” será excluída permanentemente.`
      : `O resultado de “${deleteTarget.item.piloto_nome}” será excluído permanentemente.`
    : '';

  return (
    <section>
      <PageHeader
        actionLabel={activeTab === 'manual' && canWrite ? 'Nova corrida' : undefined}
        onAction={activeTab === 'manual' && canWrite ? openCreateCorrida : undefined}
        subtitle="Corridas e resultados reais do LapTime, além do cadastro manual local de provas."
        title="Resultados"
      />

      <div className="mt-6">
        <Tabs
          items={[
            { key: 'reais', label: 'Corridas reais (LapTime)' },
            { key: 'calxpro', label: 'Corridas (CalXPro histórico)' },
            { key: 'manual', label: 'Manual (local)' },
          ]}
          onChange={(key) => setActiveTab(key as ResultadosTabKey)}
          value={activeTab}
        />
      </div>

      {activeTab === 'reais' ? (
        <div className="mt-6 space-y-5">
          <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
            <input
              className={`${inputClassName} sm:max-w-xs`}
              onChange={(event) => setRacingsSearchInput(event.target.value)}
              placeholder="Buscar por nome da corrida..."
              value={racingsSearchInput}
            />
            <select
              className={`${inputClassName} sm:max-w-[180px]`}
              onChange={(event) => updateRacingsStatusFilter(event.target.value as 'finalizada' | 'aberta' | '')}
              value={racingsFilters.status ?? ''}
            >
              <option value="">Todos os status</option>
              <option value="finalizada">Finalizada</option>
              <option value="aberta">Em andamento</option>
            </select>
            <input
              className={`${inputClassName} sm:max-w-[180px]`}
              onChange={(event) =>
                setRacingsFilters((current) => ({ ...current, from: event.target.value || undefined }))
              }
              type="date"
              value={racingsFilters.from ?? ''}
            />
            <input
              className={`${inputClassName} sm:max-w-[180px]`}
              onChange={(event) =>
                setRacingsFilters((current) => ({ ...current, to: event.target.value || undefined }))
              }
              type="date"
              value={racingsFilters.to ?? ''}
            />
          </Card>

          <DataTable
            columns={racingColumns}
            emptyLabel="Nenhuma corrida encontrada."
            error={racingsError}
            loading={racingsLoading}
            onRetry={() => void loadRacings()}
            rows={racings}
          />
          <Pagination onPageChange={setRacingsPage} page={racingsPage} pageSize={PAGE_SIZE} total={racingsTotal} />
        </div>
      ) : null}

      {activeTab === 'calxpro' ? (
        <div className="mt-6 space-y-5">
          <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
            <p className="text-sm text-zinc-400">
              Corridas do sistema anterior (CalXPro), ativo até jan/2025. Somente leitura. Total:{' '}
              {calxproCorridasTotal.toLocaleString('pt-BR')}.
            </p>
            <input
              className={`${inputClassName} sm:max-w-xs`}
              onChange={(event) => setCalxproSearchInput(event.target.value)}
              placeholder="Buscar por nome da corrida..."
              value={calxproSearchInput}
            />
          </Card>

          <DataTable
            columns={calxproCorridaColumns}
            emptyLabel="Nenhuma corrida encontrada."
            error={calxproCorridasError}
            loading={calxproCorridasLoading}
            onRetry={() => void loadCalxproCorridas()}
            rows={calxproCorridas}
          />
          <Pagination
            onPageChange={setCalxproCorridasPage}
            page={calxproCorridasPage}
            pageSize={PAGE_SIZE}
            total={calxproCorridasTotal}
          />

          <div className="border-t border-zinc-800 pt-6">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-300">
              Resultado da corrida selecionada
            </p>
            <h2 className="mt-2 text-xl font-black text-white">
              {calxproCorridas.find((corrida) => corrida.id === selectedCalxproCorridaId)?.nome ??
                'Selecione uma corrida'}
            </h2>
            <div className="mt-4">
              <DataTable
                columns={calxproCompetidorColumns}
                emptyLabel={
                  selectedCalxproCorridaId ? 'Nenhum participante registrado.' : 'Selecione uma corrida na tabela acima.'
                }
                error={calxproCompetidoresError}
                loading={calxproCompetidoresLoading}
                onRetry={() => void loadCalxproCompetidores()}
                rows={calxproCompetidores}
              />
            </div>
          </div>
        </div>
      ) : null}

      {activeTab === 'manual' ? (
        <>
          <div className="mt-6">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
              <input
                className={`${inputClassName} sm:max-w-xs`}
                onChange={(event) => setCorridasSearchInput(event.target.value)}
                placeholder="Buscar por título..."
                value={corridasSearchInput}
              />
              <select
                className={`${inputClassName} sm:max-w-[180px]`}
                onChange={(event) => updateCorridasStatusFilter(event.target.value as CorridaStatus | '')}
                value={corridasFilters.status ?? ''}
              >
                <option value="">Todos os status</option>
                {Object.entries(corridaStatusLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <DataTable
              columns={corridaColumns}
              emptyLabel="Nenhuma corrida encontrada."
              error={loadError}
              loading={loading}
              onDelete={
                canWrite ? (item) => setDeleteTarget({ kind: 'corrida', item }) : undefined
              }
              onEdit={canWrite ? openEditCorrida : undefined}
              onRetry={() => void loadData()}
              rows={corridas}
            />
            <Pagination
              onPageChange={setCorridasPage}
              page={corridasPage}
              pageSize={PAGE_SIZE}
              total={corridasTotal}
            />
          </div>

          <div className="mt-10 border-t border-zinc-800 pt-8">
            <div className="mb-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-300">
                  Corrida selecionada
                </p>
                <h2 className="mt-2 text-2xl font-black text-white">
                  {selectedCorrida?.titulo ?? 'Selecione uma corrida'}
                </h2>
                {selectedCorrida ? (
                  <p className="mt-1 text-sm text-zinc-400">
                    {selectedCorrida.campeonatos?.nome ?? 'Campeonato não informado'} ·{' '}
                    {selectedCorrida.etapas?.nome ?? 'Etapa não informada'}
                  </p>
                ) : null}
              </div>
              {canWrite && selectedCorrida ? (
                <Button onClick={openCreateResultado}>Novo resultado</Button>
              ) : null}
            </div>

            <DataTable
              columns={resultadoColumns}
              emptyLabel={
                selectedCorrida
                  ? 'Nenhum resultado cadastrado para esta corrida.'
                  : 'Selecione uma corrida na tabela acima.'
              }
              error={resultadosError}
              loading={resultadosLoading}
              onDelete={
                canWrite && selectedCorrida
                  ? (item) => setDeleteTarget({ kind: 'resultado', item })
                  : undefined
              }
              onEdit={canWrite && selectedCorrida ? openEditResultado : undefined}
              onRetry={() => void loadResultados()}
              rows={resultados}
            />
          </div>
        </>
      ) : null}

      <Modal
        footer={
          <>
            <Button disabled={submitting} onClick={closeCorridaModal} variant="ghost">
              Cancelar
            </Button>
            <Button form="corrida-form" loading={submitting} type="submit">
              {editingCorrida ? 'Salvar alterações' : 'Criar corrida'}
            </Button>
          </>
        }
        isOpen={corridaFormOpen}
        onClose={closeCorridaModal}
        title={editingCorrida ? 'Editar corrida' : 'Nova corrida'}
      >
        <form className="grid gap-5 md:grid-cols-2" id="corrida-form" onSubmit={handleCorridaSubmit}>
          <FormField error={formErrors.campeonato_id} htmlFor="corrida-campeonato" label="Campeonato">
            <select
              className={inputClassName}
              id="corrida-campeonato"
              onChange={(event) => handleCampeonatoChange(event.target.value)}
              required
              value={corridaForm.campeonato_id}
            >
              <option value="">Selecione</option>
              {campeonatos.map((campeonato) => (
                <option key={campeonato.id} value={campeonato.id}>
                  {campeonato.nome} — {campeonato.temporada ?? 'Sem temporada'}
                </option>
              ))}
            </select>
          </FormField>
          <FormField error={formErrors.etapa_id} htmlFor="corrida-etapa" label="Etapa">
            <select
              className={inputClassName}
              id="corrida-etapa"
              onChange={(event) =>
                setCorridaForm((current) => ({ ...current, etapa_id: event.target.value }))
              }
              required
              value={corridaForm.etapa_id}
            >
              <option value="">Selecione</option>
              {etapasDoFormulario.map((etapa) => (
                <option key={etapa.id} value={etapa.id}>
                  {etapa.round}. {etapa.nome}
                </option>
              ))}
            </select>
          </FormField>
          <div className="md:col-span-2">
            <FormField error={formErrors.titulo} htmlFor="corrida-titulo" label="Título">
              <input
                className={inputClassName}
                id="corrida-titulo"
                onChange={(event) =>
                  setCorridaForm((current) => ({ ...current, titulo: event.target.value }))
                }
                required
                value={corridaForm.titulo}
              />
            </FormField>
          </div>
          <FormField error={formErrors.data} htmlFor="corrida-data" label="Data e hora">
            <input
              className={inputClassName}
              id="corrida-data"
              onChange={(event) =>
                setCorridaForm((current) => ({ ...current, data: event.target.value }))
              }
              required
              type="datetime-local"
              value={corridaForm.data}
            />
          </FormField>
          <FormField htmlFor="corrida-status" label="Status">
            <select
              className={inputClassName}
              id="corrida-status"
              onChange={(event) =>
                setCorridaForm((current) => ({
                  ...current,
                  status: event.target.value as CorridaStatus,
                }))
              }
              value={corridaForm.status}
            >
              {Object.entries(corridaStatusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </FormField>
          <div className="md:col-span-2">
            <FormField
              hint="Origem opcional dos dados, por exemplo importação manual ou sistema de cronometragem."
              htmlFor="corrida-source"
              label="Origem"
            >
              <input
                className={inputClassName}
                id="corrida-source"
                onChange={(event) =>
                  setCorridaForm((current) => ({ ...current, source: event.target.value }))
                }
                value={corridaForm.source}
              />
            </FormField>
          </div>
        </form>
      </Modal>

      <Modal
        footer={
          <>
            <Button disabled={submitting} onClick={closeResultadoModal} variant="ghost">
              Cancelar
            </Button>
            <Button form="resultado-form" loading={submitting} type="submit">
              {editingResultado ? 'Salvar alterações' : 'Criar resultado'}
            </Button>
          </>
        }
        isOpen={resultadoFormOpen}
        onClose={closeResultadoModal}
        title={editingResultado ? 'Editar resultado' : 'Novo resultado'}
      >
        <form className="grid gap-5 md:grid-cols-2" id="resultado-form" onSubmit={handleResultadoSubmit}>
          <FormField error={formErrors.piloto_id} htmlFor="resultado-piloto" label="Piloto">
            <select
              className={inputClassName}
              id="resultado-piloto"
              onChange={(event) => handlePilotoChange(event.target.value)}
              required
              value={resultadoForm.piloto_id}
            >
              <option value="">Selecione</option>
              {pilotos.map((piloto) => (
                <option key={piloto.id} value={piloto.id}>
                  {piloto.numero ? `#${piloto.numero}` : 'Sem número'} — {piloto.nome}
                </option>
              ))}
            </select>
          </FormField>
          <FormField error={formErrors.piloto_nome} htmlFor="resultado-piloto-nome" label="Nome exibido">
            <input
              className={inputClassName}
              id="resultado-piloto-nome"
              onChange={(event) =>
                setResultadoForm((current) => ({ ...current, piloto_nome: event.target.value }))
              }
              required
              value={resultadoForm.piloto_nome}
            />
          </FormField>
          <FormField error={formErrors.posicao} htmlFor="resultado-posicao" label="Posição">
            <input
              className={inputClassName}
              id="resultado-posicao"
              min="1"
              onChange={(event) =>
                setResultadoForm((current) => ({ ...current, posicao: event.target.value }))
              }
              required
              step="1"
              type="number"
              value={resultadoForm.posicao}
            />
          </FormField>
          <FormField error={formErrors.voltas} htmlFor="resultado-voltas" label="Voltas">
            <input
              className={inputClassName}
              id="resultado-voltas"
              min="0"
              onChange={(event) =>
                setResultadoForm((current) => ({ ...current, voltas: event.target.value }))
              }
              required
              step="1"
              type="number"
              value={resultadoForm.voltas}
            />
          </FormField>
          <FormField htmlFor="resultado-melhor-volta" label="Melhor volta">
            <input
              className={inputClassName}
              id="resultado-melhor-volta"
              onChange={(event) =>
                setResultadoForm((current) => ({ ...current, melhor_volta: event.target.value }))
              }
              placeholder="00:45.123"
              value={resultadoForm.melhor_volta}
            />
          </FormField>
          <FormField error={formErrors.pontos} htmlFor="resultado-pontos" label="Pontos">
            <input
              className={inputClassName}
              id="resultado-pontos"
              min="0"
              onChange={(event) =>
                setResultadoForm((current) => ({ ...current, pontos: event.target.value }))
              }
              required
              step="0.01"
              type="number"
              value={resultadoForm.pontos}
            />
          </FormField>
          <div className="md:col-span-2">
            <FormField htmlFor="resultado-gap" label="Gap">
              <input
                className={inputClassName}
                id="resultado-gap"
                onChange={(event) =>
                  setResultadoForm((current) => ({ ...current, gap: event.target.value }))
                }
                placeholder="+2.345 ou +1 volta"
                value={resultadoForm.gap}
              />
            </FormField>
          </div>
        </form>
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
