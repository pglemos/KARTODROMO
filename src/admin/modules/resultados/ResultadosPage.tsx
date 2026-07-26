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
  listLapTimePassings,
  listLapTimeRacingCompetitors,
  listLapTimeRacingsPage,
  type LapTimePassing,
  type LapTimeRacing,
  type LapTimeRacingCompetitor,
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

type UnifiedRacing = {
  id: string;
  nome: string;
  tipo: string | null;
  dataHora: string;
  participantes: number;
  fonte: 'laptime' | 'calxpro' | 'manual';
  finalizada?: boolean;
  status?: string;
};

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

const FONTE_LABELS: Record<string, string> = {
  laptime: 'LapTime',
  calxpro: 'Histórico',
  manual: 'Manual',
};

const FONTE_COLORS: Record<string, string> = {
  laptime: 'border-emerald-700 bg-emerald-950 text-emerald-200',
  calxpro: 'border-blue-700 bg-blue-950 text-blue-200',
  manual: 'border-zinc-600 bg-zinc-800 text-zinc-300',
};

export const ResultadosPage = () => {
  const { role } = useAuth();
  const toast = useToast();

  const [unifiedData, setUnifiedData] = useState<UnifiedRacing[]>([]);
  const [unifiedTotal, setUnifiedTotal] = useState(0);
  const [unifiedPage, setUnifiedPage] = useState(0);
  const [unifiedLoading, setUnifiedLoading] = useState(true);
  const [unifiedError, setUnifiedError] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState('');
  const [sourceFilter, setSourceFilter] = useState<string>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [selectedRacingId, setSelectedRacingId] = useState<string | null>(null);
  const [selectedSource, setSelectedSource] = useState<string | null>(null);

  const [competitors, setCompetitors] = useState<(LapTimeRacingCompetitor | CalXProCorridaCompetidor)[]>([]);
  const [competitorsLoading, setCompetitorsLoading] = useState(false);
  const [competitorsError, setCompetitorsError] = useState<string | null>(null);

  const [selectedCompetitorId, setSelectedCompetitorId] = useState<string | null>(null);
  const [passings, setPassings] = useState<LapTimePassing[]>([]);
  const [passingsLoading, setPassingsLoading] = useState(false);
  const [passingsError, setPassingsError] = useState<string | null>(null);

  const [corridas, setCorridas] = useState<CorridaWithRelations[]>([]);
  const [corridasTotal, setCorridasTotal] = useState(0);
  const [corridasPage, setCorridasPage] = useState(0);
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
  const [resultadoForm, setResultadoForm] = useState<ResultadoFormState>(emptyResultadoForm);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deleting, setDeleting] = useState(false);

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

  const loadUnifiedData = useCallback(async () => {
    setUnifiedLoading(true);
    setUnifiedError(null);
    try {
      const lapTimeParams = new URLSearchParams({ limit: String(200), offset: '0' });
      if (searchInput) lapTimeParams.set('q', searchInput);
      if (dateFrom) lapTimeParams.set('from', dateFrom);
      if (dateTo) lapTimeParams.set('to', dateTo);

      const promises: Promise<{ rows: UnifiedRacing[] }>[] = [];

      if (!sourceFilter || sourceFilter === 'laptime') {
        promises.push(
          listLapTimeRacingsPage(
            { q: searchInput || undefined, from: dateFrom || undefined, to: dateTo || undefined },
            0,
            200,
          ).then((r) => ({
            rows: r.data.map((item) => ({
              id: `lt_${item.id}`,
              nome: item.nome,
              tipo: item.tipo,
              dataHora: item.dataHora,
              participantes: item.participantes,
              fonte: 'laptime' as const,
              finalizada: item.finalizada,
            })),
          })),
        );
      }

      if (!sourceFilter || sourceFilter === 'calxpro') {
        promises.push(
          listCalXProCorridasPage(
            { q: searchInput || undefined, from: dateFrom || undefined, to: dateTo || undefined },
            0,
            200,
          ).then((r) => ({
            rows: r.data.map((item) => ({
              id: `cx_${item.id}`,
              nome: item.nome,
              tipo: null,
              dataHora: item.dataHora,
              participantes: item.participantes,
              fonte: 'calxpro' as const,
            })),
          })),
        );
      }

      if (!sourceFilter || sourceFilter === 'manual') {
        promises.push(
          (async () => {
            const r = await listCorridasPage(
              { q: searchInput || undefined, status: undefined },
              0,
              200,
            );
            return {
              rows: r.data.map((item) => ({
                id: `manual_${item.id}`,
                nome: item.titulo,
                tipo: null,
                dataHora: item.data || '',
                participantes: 0,
                fonte: 'manual' as const,
                status: item.status,
              })),
            };
          })(),
        );
      }

      const results = await Promise.all(promises);
      let all = results.flatMap((r) => r.rows);
      all.sort((a, b) => new Date(b.dataHora).getTime() - new Date(a.dataHora).getTime());

      const total = all.length;
      const offset = unifiedPage * PAGE_SIZE;
      const paged = all.slice(offset, offset + PAGE_SIZE);

      setUnifiedData(paged);
      setUnifiedTotal(total);
    } catch (error: unknown) {
      setUnifiedError(getErrorMessage(error));
    } finally {
      setUnifiedLoading(false);
    }
  }, [searchInput, sourceFilter, dateFrom, dateTo, unifiedPage]);

  useEffect(() => {
    void loadUnifiedData();
  }, [loadUnifiedData]);

  useEffect(() => {
    const handle = setTimeout(() => setUnifiedPage(0), 350);
    return () => clearTimeout(handle);
  }, [searchInput, sourceFilter, dateFrom, dateTo]);

  const loadCompetitors = useCallback(async () => {
    if (!selectedRacingId || !selectedSource) {
      setCompetitors([]);
      setPassings([]);
      setSelectedCompetitorId(null);
      return;
    }
    setCompetitorsLoading(true);
    setCompetitorsError(null);
    setPassings([]);
    setSelectedCompetitorId(null);
    try {
      const [prefix, id] = selectedRacingId.split('_');
      if (prefix === 'lt') {
        const data = await listLapTimeRacingCompetitors(id);
        setCompetitors(data);
      } else if (prefix === 'cx') {
        const data = await listCalXProCorridaCompetidores(id);
        setCompetitors(data);
      } else {
        setCompetitors([]);
      }
    } catch (error: unknown) {
      setCompetitorsError(getErrorMessage(error));
    } finally {
      setCompetitorsLoading(false);
    }
  }, [selectedRacingId, selectedSource]);

  useEffect(() => {
    void loadCompetitors();
  }, [loadCompetitors]);

  const loadPassings = useCallback(async () => {
    if (!selectedCompetitorId || !selectedRacingId) {
      setPassings([]);
      return;
    }
    setPassingsLoading(true);
    setPassingsError(null);
    try {
      const [prefix, racingId] = selectedRacingId.split('_');
      if (prefix === 'lt') {
        const data = await listLapTimePassings(selectedCompetitorId, racingId);
        setPassings(data);
      } else {
        setPassings([]);
      }
    } catch (error: unknown) {
      setPassingsError(getErrorMessage(error));
    } finally {
      setPassingsLoading(false);
    }
  }, [selectedCompetitorId, selectedRacingId]);

  useEffect(() => {
    void loadPassings();
  }, [loadPassings]);

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
    void loadData();
  }, [loadData]);

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
    void loadResultados();
  }, [loadResultados]);

  const selectedRacing = useMemo(
    () => unifiedData.find((r) => r.id === selectedRacingId) ?? null,
    [unifiedData, selectedRacingId],
  );

  const columns = useMemo<readonly DataTableColumn<UnifiedRacing>[]>(
    () => [
      {
        key: 'nome',
        label: 'Corrida',
        render: (racing) => (
          <button
            className={`text-left font-bold underline-offset-4 hover:underline ${
              selectedRacingId === racing.id ? 'text-brand-300' : 'text-white'
            }`}
            onClick={() => {
              setSelectedRacingId(racing.id);
              setSelectedSource(racing.fonte);
            }}
            type="button"
          >
            {racing.nome}
          </button>
        ),
      },
      { key: 'tipo', label: 'Tipo', render: (racing) => racing.tipo ?? '—' },
      {
        key: 'dataHora',
        label: 'Data/hora',
        render: (racing) => formatDateSafe(racing.dataHora),
      },
      { key: 'participantes', label: 'Pilotos', render: (r) => r.participantes || '—' },
      {
        key: 'fonte',
        label: 'Fonte',
        render: (racing) => (
          <span
            className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${FONTE_COLORS[racing.fonte]}`}
          >
            {FONTE_LABELS[racing.fonte]}
          </span>
        ),
      },
      {
        key: 'finalizada',
        label: 'Status',
        render: (racing) =>
          racing.fonte === 'laptime' ? (
            <span
              className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${
                racing.finalizada
                  ? 'border-brand-800 bg-brand-950 text-brand-100'
                  : 'border-amber-800 bg-amber-950 text-amber-200'
              }`}
            >
              {racing.finalizada ? 'Finalizada' : 'Em andamento'}
            </span>
          ) : racing.fonte === 'manual' ? (
            <span
              className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${
                corridaStatusClasses[racing.status as CorridaStatus] || ''
              }`}
            >
              {corridaStatusLabels[racing.status as CorridaStatus] || racing.status}
            </span>
          ) : (
            <span className="text-sm text-zinc-500">—</span>
          ),
      },
    ],
    [selectedRacingId],
  );

  const competitorColumns = useMemo<readonly DataTableColumn<any>[]>(
    () => [
      { key: 'posicao', label: 'Pos.', render: (item: any) => item.posicao ?? '—' },
      {
        key: 'numero',
        label: 'Kart',
        render: (item: any) => {
          const num = item.numero ?? item.number ?? '—';
          return <span>{num}</span>;
        },
      },
      {
        key: 'nome',
        label: 'Piloto',
        render: (item: any) =>
          selectedSource === 'laptime' ? (
            <button
              className={`text-left font-bold underline-offset-4 hover:underline ${
                selectedCompetitorId === item.id ? 'text-brand-300' : 'text-white'
              }`}
              onClick={() => setSelectedCompetitorId(item.id)}
              type="button"
            >
              {item.nome}
            </button>
          ) : (
            <span>{item.nome}</span>
          ),
      },
      { key: 'voltas', label: 'Voltas', render: (item: any) => item.voltas ?? '—' },
      { key: 'melhorVolta', label: 'Melhor volta', render: (item: any) => item.melhorVolta ?? '—' },
      { key: 'tempoTotal', label: 'Tempo total', render: (item: any) => item.tempoTotal ?? '—' },
    ],
    [selectedSource, selectedCompetitorId],
  );

  const passingColumns = useMemo<readonly DataTableColumn<LapTimePassing>[]>(
    () => [
      { key: 'lapNumber', label: 'Volta' },
      {
        key: 'lapTime',
        label: 'Tempo',
        render: (p) => p.lapTime ?? '—',
      },
      {
        key: 'speed',
        label: 'Velocidade',
        render: (p) => (p.speed != null ? `${p.speed.toFixed(1)} km/h` : '—'),
      },
      { key: 'pos', label: 'Pos.', render: (p) => p.pos ?? '—' },
      {
        key: 'passTime',
        label: 'Horário',
        render: (p) => (p.passTime ? formatDateSafe(p.passTime) : '—'),
      },
    ],
    [],
  );

  const openCreateCorrida = () => {
    const campeonatoId = campeonatos[0]?.id ?? '';
    const etapaId = etapas.find((etapa) => etapa.campeonato_id === campeonatoId)?.id ?? '';
    setEditingCorrida(null);
    setCorridaForm({ ...emptyCorridaForm, campeonato_id: campeonatoId, etapa_id: etapaId });
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

  const closeCorridaModal = () => { if (!submitting) setCorridaFormOpen(false); };
  const closeResultadoModal = () => { if (!submitting) setResultadoFormOpen(false); };

  const handleCampeonatoChange = (campeonatoId: string) => {
    const etapaId = etapas.find((etapa) => etapa.campeonato_id === campeonatoId)?.id ?? '';
    setCorridaForm((current) => ({ ...current, campeonato_id: campeonatoId, etapa_id: etapaId }));
  };

  const handlePilotoChange = (pilotoId: string) => {
    const piloto = pilotos.find((item) => item.id === pilotoId);
    setResultadoForm((current) => ({ ...current, piloto_id: pilotoId, piloto_nome: piloto?.nome ?? '' }));
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
      ? `A corrida "${deleteTarget.item.titulo}" será excluída permanentemente.`
      : `O resultado de "${deleteTarget.item.piloto_nome}" será excluído permanentemente.`
    : '';

  return (
    <section>
      <PageHeader
        actionLabel={canWrite ? 'Nova corrida' : undefined}
        onAction={canWrite ? openCreateCorrida : undefined}
        subtitle="Corridas em tempo real, histórico e cadastro manual."
        title="Corridas"
      />

      <div className="mt-6 space-y-5">
        <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <input
            className={`${inputClassName} sm:max-w-xs`}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Buscar por nome..."
            value={searchInput}
          />
          <select
            className={`${inputClassName} sm:max-w-[160px]`}
            onChange={(event) => setSourceFilter(event.target.value)}
            value={sourceFilter}
          >
            <option value="">Todas as fontes</option>
            <option value="laptime">LapTime (ao vivo)</option>
            <option value="calxpro">Histórico</option>
            <option value="manual">Manual</option>
          </select>
          <input
            className={`${inputClassName} sm:max-w-[160px]`}
            onChange={(event) => setDateFrom(event.target.value)}
            type="date"
            value={dateFrom}
          />
          <input
            className={`${inputClassName} sm:max-w-[160px]`}
            onChange={(event) => setDateTo(event.target.value)}
            type="date"
            value={dateTo}
          />
        </Card>

        <DataTable
          columns={columns}
          emptyLabel="Nenhuma corrida encontrada."
          error={unifiedError}
          loading={unifiedLoading}
          onRetry={() => void loadUnifiedData()}
          rows={unifiedData}
        />
        <Pagination onPageChange={setUnifiedPage} page={unifiedPage} pageSize={PAGE_SIZE} total={unifiedTotal} />

        <div className="border-t border-zinc-800 pt-6">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-300">
            Pilotos
          </p>
          <h2 className="mt-2 text-xl font-black text-white">
            {selectedRacing?.nome ?? 'Selecione uma corrida'}
          </h2>
          <div className="mt-4">
            <DataTable
              columns={competitorColumns}
              emptyLabel={selectedRacing ? 'Nenhum piloto encontrado.' : 'Selecione uma corrida na tabela acima.'}
              error={competitorsError}
              loading={competitorsLoading}
              onRetry={() => void loadCompetitors()}
              rows={competitors}
            />
          </div>
        </div>

        {selectedSource === 'laptime' && selectedCompetitorId ? (
          <div className="border-t border-zinc-800 pt-6">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-300">
              Voltas
            </p>
            <h2 className="mt-2 text-xl font-black text-white">
              {competitors.find((c: any) => c.id === selectedCompetitorId)?.nome ?? 'Piloto'}
            </h2>
            <div className="mt-4">
              <DataTable
                columns={passingColumns}
                emptyLabel="Nenhum registro de volta encontrado."
                error={passingsError}
                loading={passingsLoading}
                onRetry={() => void loadPassings()}
                rows={passings}
              />
            </div>
          </div>
        ) : null}
      </div>

      <Modal
        footer={
          <>
            <Button disabled={submitting} onClick={closeCorridaModal} variant="ghost">Cancelar</Button>
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
            <select className={inputClassName} id="corrida-campeonato"
              onChange={(event) => handleCampeonatoChange(event.target.value)} required value={corridaForm.campeonato_id}>
              <option value="">Selecione</option>
              {campeonatos.map((campeonato) => (
                <option key={campeonato.id} value={campeonato.id}>{campeonato.nome} — {campeonato.temporada ?? 'Sem temporada'}</option>
              ))}
            </select>
          </FormField>
          <FormField error={formErrors.etapa_id} htmlFor="corrida-etapa" label="Etapa">
            <select className={inputClassName} id="corrida-etapa"
              onChange={(event) => setCorridaForm((current) => ({ ...current, etapa_id: event.target.value }))}
              required value={corridaForm.etapa_id}>
              <option value="">Selecione</option>
              {etapasDoFormulario.map((etapa) => (
                <option key={etapa.id} value={etapa.id}>{etapa.round}. {etapa.nome}</option>
              ))}
            </select>
          </FormField>
          <div className="md:col-span-2">
            <FormField error={formErrors.titulo} htmlFor="corrida-titulo" label="Título">
              <input className={inputClassName} id="corrida-titulo"
                onChange={(event) => setCorridaForm((current) => ({ ...current, titulo: event.target.value }))}
                required value={corridaForm.titulo} />
            </FormField>
          </div>
          <FormField error={formErrors.data} htmlFor="corrida-data" label="Data e hora">
            <input className={inputClassName} id="corrida-data" required type="datetime-local"
              onChange={(event) => setCorridaForm((current) => ({ ...current, data: event.target.value }))}
              value={corridaForm.data} />
          </FormField>
          <FormField htmlFor="corrida-status" label="Status">
            <select className={inputClassName} id="corrida-status"
              onChange={(event) => setCorridaForm((current) => ({ ...current, status: event.target.value as CorridaStatus }))}
              value={corridaForm.status}>
              {Object.entries(corridaStatusLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </FormField>
          <div className="md:col-span-2">
            <FormField hint="Origem opcional dos dados." htmlFor="corrida-source" label="Origem">
              <input className={inputClassName} id="corrida-source"
                onChange={(event) => setCorridaForm((current) => ({ ...current, source: event.target.value }))}
                value={corridaForm.source} />
            </FormField>
          </div>
        </form>
      </Modal>

      <Modal
        footer={
          <>
            <Button disabled={submitting} onClick={closeResultadoModal} variant="ghost">Cancelar</Button>
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
            <select className={inputClassName} id="resultado-piloto" required
              onChange={(event) => handlePilotoChange(event.target.value)} value={resultadoForm.piloto_id}>
              <option value="">Selecione</option>
              {pilotos.map((piloto) => (
                <option key={piloto.id} value={piloto.id}>{piloto.numero ? `#${piloto.numero}` : 'Sem número'} — {piloto.nome}</option>
              ))}
            </select>
          </FormField>
          <FormField error={formErrors.piloto_nome} htmlFor="resultado-piloto-nome" label="Nome exibido">
            <input className={inputClassName} id="resultado-piloto-nome" required
              onChange={(event) => setResultadoForm((current) => ({ ...current, piloto_nome: event.target.value }))}
              value={resultadoForm.piloto_nome} />
          </FormField>
          <FormField error={formErrors.posicao} htmlFor="resultado-posicao" label="Posição">
            <input className={inputClassName} id="resultado-posicao" required type="number" min="1" step="1"
              onChange={(event) => setResultadoForm((current) => ({ ...current, posicao: event.target.value }))}
              value={resultadoForm.posicao} />
          </FormField>
          <FormField error={formErrors.voltas} htmlFor="resultado-voltas" label="Voltas">
            <input className={inputClassName} id="resultado-voltas" required type="number" min="0" step="1"
              onChange={(event) => setResultadoForm((current) => ({ ...current, voltas: event.target.value }))}
              value={resultadoForm.voltas} />
          </FormField>
          <FormField htmlFor="resultado-melhor-volta" label="Melhor volta">
            <input className={inputClassName} id="resultado-melhor-volta" placeholder="00:45.123"
              onChange={(event) => setResultadoForm((current) => ({ ...current, melhor_volta: event.target.value }))}
              value={resultadoForm.melhor_volta} />
          </FormField>
          <FormField error={formErrors.pontos} htmlFor="resultado-pontos" label="Pontos">
            <input className={inputClassName} id="resultado-pontos" required type="number" min="0" step="0.01"
              onChange={(event) => setResultadoForm((current) => ({ ...current, pontos: event.target.value }))}
              value={resultadoForm.pontos} />
          </FormField>
          <div className="md:col-span-2">
            <FormField htmlFor="resultado-gap" label="Gap">
              <input className={inputClassName} id="resultado-gap" placeholder="+2.345 ou +1 volta"
                onChange={(event) => setResultadoForm((current) => ({ ...current, gap: event.target.value }))}
                value={resultadoForm.gap} />
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
