'use client';

import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  ClipboardCheck,
  Gauge,
  History,
  RefreshCw,
  Search,
  Settings2,
  ShieldAlert,
  Tag,
  Timer,
  UserRound,
  Wrench,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { formatDurationMs, parseDurationMs } from '@/lib/livetime/time-format';
import {
  EQUALIZATION_TOLERANCE_MS,
  KART_CATEGORY_LABELS,
  KART_CATEGORY_TARGETS_MS,
  equalizationDeltaMs,
  equalizationState,
  kartCategoryFromPlate,
  normalizedKartNumber,
  summarizeCategory,
  targetForKart,
  type KartCategory,
} from '@/lib/equalizacao/kart';
import { useAuth } from '../../auth/AuthContext';
import { canAccess } from '../../lib/rbac';
import { Badge, type BadgeVariant } from '../../ui/Badge';
import { Button } from '../../ui/Button';
import { FormField } from '../../ui/FormField';
import { Modal } from '../../ui/Modal';
import { PageHeader } from '../../ui/PageHeader';
import { StatCard } from '../../ui/StatCard';
import { useToast } from '../../ui/useToast';
import {
  createKart,
  createKartEqualization,
  createKartIdentityEvent,
  createKartMaintenance,
  getKartHistory,
  listKartEqualizations,
  listKartIdentityEvents,
  listKartMaintenances,
  listKarts,
  updateKart,
} from './equalizacao.api';
import type {
  HistoryWindow,
  Kart,
  KartEqualization,
  KartHistoryResponse,
  KartIdentityEvent,
  KartMaintenance,
} from './equalizacao.types';

type CategoryFilter = 'all' | KartCategory;
type StateFilter = 'all' | ReturnType<typeof equalizationState>;
type DetailTab = 'visao' | 'historico' | 'manutencao';

type KartFormState = {
  numero: string;
  chassi_numero: string;
  sensor_numero: string;
  redutor_antigo: string;
  redutor_novo: string;
  modelo: string;
  motor: string;
  status: string;
  km_total: string;
  proxima_manutencao: string;
  notes: string;
  ativo: boolean;
};

type EqualizationFormState = {
  piloto: string;
  traco: string;
  data: string;
  voltas_validas: string;
  melhor_volta: string;
  media: string;
  desvio: string;
  status: 'aprovada' | 'ajustar' | 'reteste';
  observacoes: string;
};

type MaintenanceFormState = {
  tipo: string;
  descricao: string;
  custo: string;
  data: string;
  proxima_manutencao: string;
  responsavel: string;
  status: 'pendente' | 'em_andamento' | 'concluida';
};

const inputClassName =
  'h-10 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100 outline-none transition focus:border-brand-500/60 focus:ring-2 focus:ring-brand-500/20';
const textareaClassName = `${inputClassName} h-auto min-h-24 py-2.5`;

const dateFormatter = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
const shortDateFormatter = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' });

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'Ocorreu um erro inesperado.';

const formatTime = (milliseconds: number | null | undefined): string =>
  milliseconds === null || milliseconds === undefined ? '—' : formatDurationMs(milliseconds) || '—';

const formatDelta = (milliseconds: number | null | undefined): string => {
  if (milliseconds === null || milliseconds === undefined) return '—';
  if (milliseconds === 0) return '0 ms';
  return `${milliseconds > 0 ? '+' : ''}${formatTime(Math.abs(milliseconds))}`;
};

const formatDate = (value: string | null | undefined, short = false): string => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return (short ? shortDateFormatter : dateFormatter).format(date);
};

const kartSensor = (kart: Pick<Kart, 'sensor_numero' | 'sensor_numero_fonte'>): string | null =>
  kart.sensor_numero?.trim() || kart.sensor_numero_fonte?.trim() || null;

const kartModel = (kart: Pick<Kart, 'modelo'>): string => kart.modelo?.trim() || 'Não informado';

const dateInputValue = (value?: string | null): string => {
  if (!value) return new Date().toISOString().slice(0, 10);
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString().slice(0, 10) : date.toISOString().slice(0, 10);
};

const optionalDateInputValue = (value?: string | null): string => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
};

const dateToIso = (value: string): string => new Date(`${value}T12:00:00`).toISOString();

const emptyKartForm: KartFormState = {
  numero: '',
  chassi_numero: '',
  sensor_numero: '',
  redutor_antigo: '',
  redutor_novo: '',
  modelo: '',
  motor: '',
  status: 'disponivel',
  km_total: '0',
  proxima_manutencao: '',
  notes: '',
  ativo: true,
};

const emptyMaintenanceForm: MaintenanceFormState = {
  tipo: 'Revisão geral',
  descricao: '',
  custo: '0',
  data: dateInputValue(),
  proxima_manutencao: '',
  responsavel: '',
  status: 'concluida',
};

const makeEqualizationForm = (kart: Kart | null): EqualizationFormState => {
  const target = targetForKart(kart?.numero) ?? 0;
  return {
    piloto: '',
    traco: kart?.traco_equalizacao || 'Traçado principal',
    data: dateInputValue(),
    voltas_validas: '5',
    melhor_volta: target ? formatTime(target) : '',
    media: target ? formatTime(target) : '',
    desvio: '0',
    status: 'reteste',
    observacoes: '',
  };
};

const statusLabel: Record<string, string> = {
  disponivel: 'Disponível',
  em_uso: 'Em uso',
  manutencao: 'Em manutenção',
  inativo: 'Inativo',
  aprovada: 'Aprovada',
  ajustar: 'Ajustar',
  reteste: 'Reteste',
  concluida: 'Concluída',
  em_andamento: 'Em andamento',
  pendente: 'Pendente',
};

const stateLabel: Record<ReturnType<typeof equalizationState>, string> = {
  equilibrado: 'Equilibrado',
  ajustar: 'Ajustar',
  critico: 'Crítico',
  pendente: 'Sem medição',
  fora_do_padrao: 'Conferir placa',
};

const stateVariant: Record<ReturnType<typeof equalizationState>, BadgeVariant> = {
  equilibrado: 'emerald',
  ajustar: 'amber',
  critico: 'red',
  pendente: 'zinc',
  fora_do_padrao: 'red',
};

const categoryVariant: Record<KartCategory, BadgeVariant> = {
  indoor: 'blue',
  super: 'emerald',
  unknown: 'red',
};

const makeKartForm = (kart?: Kart | null): KartFormState => ({
  numero: kart?.numero || '',
  chassi_numero: kart?.chassi_numero || '',
  sensor_numero: kart?.sensor_numero || '',
  redutor_antigo: kart?.redutor_antigo || '',
  redutor_novo: kart?.redutor_novo || '',
  modelo: kart?.modelo && kart.modelo !== 'Não informado' ? kart.modelo : '',
  motor: kart?.motor || '',
  status: kart?.status || 'disponivel',
  km_total: String(kart?.km_total ?? 0),
  proxima_manutencao: optionalDateInputValue(kart?.proxima_manutencao),
  notes: kart?.notes || '',
  ativo: kart?.ativo ?? true,
});

function KartCategoryBadge({ numero }: { numero: string }) {
  const category = kartCategoryFromPlate(numero);
  return <Badge variant={categoryVariant[category]}>{KART_CATEGORY_LABELS[category]}</Badge>;
}

function EqualizationStateBadge({ kart }: { kart: Kart }) {
  const state = equalizationState(kart.media_equalizacao_ms, kart.numero);
  return <Badge variant={stateVariant[state]}>{stateLabel[state]}</Badge>;
}

function DeltaIndicator({ deltaMs }: { deltaMs: number | null }) {
  if (deltaMs === null) return <span className="text-xs text-zinc-500">Sem medição</span>;
  if (deltaMs === 0) return <span className="text-xs text-zinc-500">Dentro do alvo</span>;
  const Icon = deltaMs > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold ${deltaMs > 0 ? 'text-amber-300' : 'text-sky-300'}`}>
      <Icon aria-hidden="true" size={13} />
      {formatDelta(deltaMs)} do alvo
    </span>
  );
}

function HistoryMetric({ label, value, sub }: { label: string; value: string; sub?: ReactNode }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
      <p className="text-[10px] font-bold uppercase tracking-[.12em] text-zinc-500">{label}</p>
      <strong className="mt-1 block text-lg font-semibold text-zinc-50">{value}</strong>
      {sub ? <span className="mt-1 block text-xs text-zinc-500">{sub}</span> : null}
    </div>
  );
}

export const EqualizacaoPage = () => {
  const { role } = useAuth();
  const toast = useToast();
  const canWrite = canAccess(role, 'equalizacao') && (role === 'owner' || role === 'admin');

  const [karts, setKarts] = useState<Kart[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [stateFilter, setStateFilter] = useState<StateFilter>('all');
  const [selectedKartId, setSelectedKartId] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>('visao');
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [history, setHistory] = useState<KartHistoryResponse>({ rows: [], windows: {} as KartHistoryResponse['windows'] });
  const [equalizations, setEqualizations] = useState<KartEqualization[]>([]);
  const [maintenances, setMaintenances] = useState<KartMaintenance[]>([]);
  const [identityEvents, setIdentityEvents] = useState<KartIdentityEvent[]>([]);
  const [activeWindow, setActiveWindow] = useState<7 | 15 | 30 | 60>(7);

  const [kartModalOpen, setKartModalOpen] = useState(false);
  const [editingKart, setEditingKart] = useState<Kart | null>(null);
  const [kartForm, setKartForm] = useState<KartFormState>(emptyKartForm);
  const [kartFormError, setKartFormError] = useState<string | null>(null);
  const [equalizationModalOpen, setEqualizationModalOpen] = useState(false);
  const [equalizationForm, setEqualizationForm] = useState<EqualizationFormState>(makeEqualizationForm(null));
  const [maintenanceModalOpen, setMaintenanceModalOpen] = useState(false);
  const [maintenanceForm, setMaintenanceForm] = useState<MaintenanceFormState>(emptyMaintenanceForm);
  const [submitting, setSubmitting] = useState(false);

  const selectedKart = useMemo(
    () => karts.find((kart) => kart.id === selectedKartId) ?? null,
    [karts, selectedKartId],
  );

  const loadKarts = useCallback(async () => {
    setLoading(true);
    setError(null);
    let lastError: unknown = null;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const rows = await listKarts();
        setKarts(rows);
        setSelectedKartId((current) => (current && rows.some((kart) => kart.id === current) ? current : rows[0]?.id ?? null));
        setLoading(false);
        return;
      } catch (loadError) {
        lastError = loadError;
        if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 1500));
      }
    }
    setError(getErrorMessage(lastError));
    setLoading(false);
  }, []);

  const loadDetails = useCallback(async (kart: Kart) => {
    setDetailLoading(true);
    setDetailError(null);
    const results = await Promise.allSettled([
      getKartHistory(kart),
      listKartEqualizations(kart.id),
      listKartMaintenances(kart.id),
      listKartIdentityEvents(kart.id),
    ]);
    const [historyResult, equalizationResult, maintenanceResult, identityResult] = results;
    if (historyResult.status === 'fulfilled') setHistory(historyResult.value);
    else setHistory({ rows: [], windows: {} as KartHistoryResponse['windows'] });
    if (equalizationResult.status === 'fulfilled') setEqualizations(equalizationResult.value);
    else setEqualizations([]);
    if (maintenanceResult.status === 'fulfilled') setMaintenances(maintenanceResult.value);
    else setMaintenances([]);
    if (identityResult.status === 'fulfilled') setIdentityEvents(identityResult.value);
    else setIdentityEvents([]);
    const failed = results.find((result) => result.status === 'rejected');
    if (failed?.status === 'rejected') setDetailError(getErrorMessage(failed.reason));
    setDetailLoading(false);
  }, []);

  useEffect(() => {
    void loadKarts();
  }, [loadKarts]);

  useEffect(() => {
    if (selectedKart) void loadDetails(selectedKart);
  }, [loadDetails, selectedKart]);

  const filteredKarts = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('pt-BR');
    return karts
      .filter((kart) => {
        const category = kartCategoryFromPlate(kart.numero);
        const state = equalizationState(kart.media_equalizacao_ms, kart.numero);
        const haystack = [kart.numero, kart.chassi_numero, kart.sensor_numero, kart.sensor_numero_fonte, kart.modelo, kart.motor].filter(Boolean).join(' ').toLocaleLowerCase('pt-BR');
        return (!query || haystack.includes(query)) &&
          (categoryFilter === 'all' || category === categoryFilter) &&
          (stateFilter === 'all' || state === stateFilter);
      })
      .sort((left, right) => (normalizedKartNumber(left.numero) ?? 999) - (normalizedKartNumber(right.numero) ?? 999));
  }, [categoryFilter, karts, search, stateFilter]);

  const categorySummaries = useMemo(
    () => ({
      indoor: summarizeCategory(karts, 'indoor'),
      super: summarizeCategory(karts, 'super'),
    }),
    [karts],
  );

  const alertKarts = useMemo(
    () => karts.filter((kart) => equalizationState(kart.media_equalizacao_ms, kart.numero) !== 'equilibrado'),
    [karts],
  );

  const activeHistoryRows = useMemo(
    () => history.rows.slice(0, activeWindow).filter((row) => row.bestLapMs !== null),
    [activeWindow, history.rows],
  );

  const activeHistoryWindow: HistoryWindow | null = history.windows[String(activeWindow) as '7' | '15' | '30' | '60'] ?? null;
  const chartRows = useMemo(() => activeHistoryRows.slice(0, 18).reverse(), [activeHistoryRows]);
  const chartValues = chartRows.map((row) => row.bestLapMs as number);
  const chartMin = chartValues.length ? Math.min(...chartValues) : 0;
  const chartMax = chartValues.length ? Math.max(...chartValues) : 1;
  const chartRange = Math.max(chartMax - chartMin, 1);
  const selectedKartSensor = selectedKart ? kartSensor(selectedKart) : null;
  const selectedKartSensorSource = selectedKart?.sensor_numero ? 'Cadastro local' : selectedKart?.sensor_numero_fonte ? 'LapTime / TransponderRenumber' : null;
  const historyMatchedBy = history.rows.find((row) => row.bestLapMs !== null)?.matchedBy ?? (selectedKartSensor ? 'sensor' : 'plate');
  const historyIdentityLabel = historyMatchedBy === 'sensor' && selectedKartSensor ? `sensor ${selectedKartSensor}` : `placa ${selectedKart?.numero || '—'}`;

  const refreshSelected = useCallback(async () => {
    if (selectedKart) await loadDetails(selectedKart);
  }, [loadDetails, selectedKart]);

  const openNewKart = () => {
    setEditingKart(null);
    setKartForm(emptyKartForm);
    setKartFormError(null);
    setKartModalOpen(true);
  };

  const openEditKart = (kart: Kart) => {
    setEditingKart(kart);
    setKartForm(makeKartForm(kart));
    setKartFormError(null);
    setKartModalOpen(true);
  };

  const openEqualization = () => {
    setEqualizationForm(makeEqualizationForm(selectedKart));
    setEqualizationModalOpen(true);
  };

  const openMaintenance = () => {
    setMaintenanceForm({ ...emptyMaintenanceForm, proxima_manutencao: optionalDateInputValue(selectedKart?.proxima_manutencao) });
    setMaintenanceModalOpen(true);
  };

  const handleKartSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const number = normalizedKartNumber(kartForm.numero);
    if (number === null || number < 1 || number > 200) {
      setKartFormError('A placa deve ser numérica entre 01 e 200 para a equalização.');
      return;
    }
    if (!kartForm.chassi_numero.trim()) {
      setKartFormError('Informe o número do chassi para manter a identidade física rastreável.');
      return;
    }
    setSubmitting(true);
    setKartFormError(null);
    try {
      const category = kartCategoryFromPlate(kartForm.numero);
      const payload = {
        numero: kartForm.numero.trim().padStart(number < 100 ? 2 : 3, '0'),
        chassi_numero: kartForm.chassi_numero.trim(),
        sensor_numero: kartForm.sensor_numero.trim() || null,
        redutor_antigo: kartForm.redutor_antigo.trim() || null,
        redutor_novo: kartForm.redutor_novo.trim() || null,
        modelo: kartForm.modelo.trim() || 'Não informado',
        categoria: category === 'super' ? 'super' : 'adulto',
        motor: kartForm.motor.trim() || null,
        status: kartForm.status,
        km_total: Number(kartForm.km_total) || 0,
        proxima_manutencao: kartForm.proxima_manutencao ? dateToIso(kartForm.proxima_manutencao) : null,
        notes: kartForm.notes.trim() || null,
        ativo: kartForm.ativo,
      };
      const saved = editingKart ? await updateKart(editingKart.id, payload) : await createKart(payload);
      const identityChanged = !editingKart ||
        editingKart.numero !== payload.numero ||
        (editingKart.chassi_numero || '') !== payload.chassi_numero ||
        (editingKart.sensor_numero || '') !== (payload.sensor_numero || '');
      if (identityChanged) {
        await createKartIdentityEvent({
          kart_id: saved.id,
          data: new Date().toISOString(),
          acao: editingKart ? 'troca_identidade' : 'cadastro',
          chassi_anterior: editingKart?.chassi_numero || null,
          chassi_novo: payload.chassi_numero,
          placa_anterior: editingKart?.numero || null,
          placa_nova: payload.numero,
          sensor_anterior: editingKart?.sensor_numero || null,
          sensor_novo: payload.sensor_numero,
          observacoes: editingKart ? 'Identidade física atualizada na equalização.' : 'Cadastro inicial do kart.',
          responsavel: role,
        });
      }
      setKartModalOpen(false);
      setSelectedKartId(saved.id);
      await loadKarts();
      toast.success(editingKart ? 'Ficha do kart atualizada.' : 'Kart cadastrado na frota.');
    } catch (submitError) {
      setKartFormError(getErrorMessage(submitError));
    } finally {
      setSubmitting(false);
    }
  };

  const handleEqualizationSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedKart) return;
    const target = targetForKart(selectedKart.numero);
    const bestLapMs = parseDurationMs(equalizationForm.melhor_volta);
    const averageMs = parseDurationMs(equalizationForm.media);
    const deviationMs = parseDurationMs(equalizationForm.desvio) ?? 0;
    const validLaps = Number(equalizationForm.voltas_validas);
    if (!target) {
      toast.error('A placa precisa estar entre 01-99 ou 100-200 antes da medição.');
      return;
    }
    if (!equalizationForm.piloto.trim() || !equalizationForm.traco.trim() || !bestLapMs || !averageMs || !Number.isInteger(validLaps) || validLaps < 1) {
      toast.error('Preencha piloto, traçado, voltas válidas e os tempos no formato 1:05.700.');
      return;
    }
    setSubmitting(true);
    try {
      await createKartEqualization({
        kart_id: selectedKart.id,
        categoria: kartCategoryFromPlate(selectedKart.numero),
        piloto: equalizationForm.piloto.trim(),
        traco: equalizationForm.traco.trim(),
        data: dateToIso(equalizationForm.data),
        voltas_validas: validLaps,
        melhor_volta_ms: bestLapMs,
        media_ms: averageMs,
        desvio_ms: deviationMs,
        alvo_ms: target,
        status: equalizationForm.status,
        observacoes: equalizationForm.observacoes.trim() || null,
      });
      await updateKart(selectedKart.id, {
        media_equalizacao_ms: averageMs,
        melhor_equalizacao_ms: bestLapMs,
        desvio_equalizacao_ms: deviationMs,
        ultima_equalizacao: dateToIso(equalizationForm.data),
        ultimo_piloto_equalizacao: equalizationForm.piloto.trim(),
        traco_equalizacao: equalizationForm.traco.trim(),
      });
      setEqualizationModalOpen(false);
      await loadKarts();
      await refreshSelected();
      toast.success('Medição de equalização registrada.');
    } catch (submitError) {
      toast.error(getErrorMessage(submitError));
    } finally {
      setSubmitting(false);
    }
  };

  const handleMaintenanceSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedKart || !maintenanceForm.descricao.trim()) {
      toast.error('Informe a descrição do serviço de manutenção.');
      return;
    }
    setSubmitting(true);
    try {
      await createKartMaintenance({
        kart_id: selectedKart.id,
        tipo: maintenanceForm.tipo.trim() || 'Manutenção',
        descricao: maintenanceForm.descricao.trim(),
        custo: Number(maintenanceForm.custo) || 0,
        data: dateToIso(maintenanceForm.data),
        responsavel: maintenanceForm.responsavel.trim() || role,
        status: maintenanceForm.status,
      });
      await updateKart(selectedKart.id, {
        ultima_manutencao: maintenanceForm.status === 'concluida' ? dateToIso(maintenanceForm.data) : selectedKart.ultima_manutencao,
        proxima_manutencao: maintenanceForm.proxima_manutencao ? dateToIso(maintenanceForm.proxima_manutencao) : selectedKart.proxima_manutencao,
      });
      setMaintenanceModalOpen(false);
      await loadKarts();
      await refreshSelected();
      toast.success('Manutenção registrada no histórico do kart.');
    } catch (submitError) {
      toast.error(getErrorMessage(submitError));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid gap-5">
      <PageHeader
        eyebrow="Gestão da frota"
        title="Equalização de karts"
        subtitle="Padronize o desempenho por categoria e preserve a identidade do chassi, placa e sensor mesmo após trocas."
        actionLabel={canWrite ? 'Novo kart' : undefined}
        onAction={canWrite ? openNewKart : undefined}
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard icon={Gauge} label="Karts cadastrados" value={String(karts.length)} sub={`${karts.filter((kart) => kart.ativo).length} ativos na frota`} loading={loading} />
        <StatCard icon={Activity} label="Super Kart" value={String(categorySummaries.super.total)} sub={`Alvo ${formatTime(KART_CATEGORY_TARGETS_MS.super)}`} loading={loading} />
        <StatCard icon={Timer} label="Kart Indoor" value={String(categorySummaries.indoor.total)} sub={`Alvo ${formatTime(KART_CATEGORY_TARGETS_MS.indoor)}`} loading={loading} />
        <StatCard icon={CheckCircle2} label="Equilibrados" value={String(karts.filter((kart) => equalizationState(kart.media_equalizacao_ms, kart.numero) === 'equilibrado').length)} sub="Dentro da tolerância de 1,5 s" loading={loading} />
        <StatCard icon={ShieldAlert} label="Alertas" value={String(alertKarts.length)} sub="Sem medição ou fora do alvo" loading={loading} />
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 shadow-card md:p-5">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row">
            <label className="relative block min-w-0 flex-1">
              <span className="sr-only">Buscar kart</span>
              <Search aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={17} />
              <input className={`${inputClassName} pl-10`} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por placa, chassi, sensor ou modelo" value={search} />
            </label>
            <select aria-label="Filtrar categoria" className={`${inputClassName} sm:w-44`} onChange={(event) => setCategoryFilter(event.target.value as CategoryFilter)} value={categoryFilter}>
              <option value="all">Todas as categorias</option>
              <option value="indoor">Kart Indoor</option>
              <option value="super">Super Kart</option>
              <option value="unknown">Fora do padrão</option>
            </select>
            <select aria-label="Filtrar situação" className={`${inputClassName} sm:w-44`} onChange={(event) => setStateFilter(event.target.value as StateFilter)} value={stateFilter}>
              <option value="all">Todas as situações</option>
              <option value="equilibrado">Equilibrados</option>
              <option value="ajustar">Ajustar</option>
              <option value="critico">Críticos</option>
              <option value="pendente">Sem medição</option>
            </select>
          </div>
          <Button onClick={() => void loadKarts()} variant="ghost">
            <RefreshCw aria-hidden="true" size={15} />
            Atualizar
          </Button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2 text-xs text-zinc-500">
          <span className="inline-flex items-center gap-1.5"><Tag aria-hidden="true" size={13} /> Placa 01–99 = Indoor</span>
          <span className="inline-flex items-center gap-1.5"><Tag aria-hidden="true" size={13} /> Placa 100–200 = Super Kart</span>
          <span className="inline-flex items-center gap-1.5"><Activity aria-hidden="true" size={13} /> Tolerância: ±{formatTime(EQUALIZATION_TOLERANCE_MS)}</span>
        </div>
      </section>

      {error ? (
        <div className="flex items-center justify-between gap-4 rounded-xl border border-red-900/60 bg-red-950/20 p-4 text-sm text-red-200" role="alert">
          <span>{error}</span>
          <Button onClick={() => void loadKarts()} variant="ghost"><RefreshCw aria-hidden="true" size={15} /> Tentar novamente</Button>
        </div>
      ) : null}

      <section className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/60 shadow-card">
        <div className="flex items-center justify-between gap-3 border-b border-zinc-800 px-4 py-4 md:px-5">
          <div>
            <h2 className="text-base font-semibold text-zinc-50">Frota e estado de equalização</h2>
            <p className="mt-1 text-xs text-zinc-500">Selecione um kart para abrir a ficha, o histórico e os alertas de manutenção.</p>
          </div>
          <span className="text-xs font-semibold text-zinc-500">{filteredKarts.length} exibidos</span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[980px] w-full text-left">
            <thead className="border-b border-zinc-800">
              <tr>
                {['Kart / categoria', 'Chassi', 'Placa / sensor', 'Uso no LapTime', 'Média da equalização', 'Manutenção', 'Situação', 'Ações'].map((label) => <th className="whitespace-nowrap px-4 py-3 text-[10px] font-bold uppercase tracking-[.1em] text-zinc-500" key={label}>{label}</th>)}
              </tr>
            </thead>
            <tbody>
              {loading ? Array.from({ length: 6 }, (_, index) => <tr className="border-b border-zinc-800/60" key={`loading-${index}`}><td className="px-4 py-4" colSpan={8}><span className="block h-5 animate-pulse rounded bg-zinc-800/70" /></td></tr>) : null}
              {!loading && filteredKarts.map((kart) => {
                const delta = equalizationDeltaMs(kart.media_equalizacao_ms, kart.numero);
                const isSelected = selectedKartId === kart.id;
                return (
                  <tr className={`border-b border-zinc-800/60 transition-colors last:border-0 ${isSelected ? 'bg-brand-500/5' : 'hover:bg-zinc-800/30'}`} key={kart.id}>
                    <td className="px-4 py-3.5">
                      <button className="text-left" onClick={() => { setSelectedKartId(kart.id); setDetailTab('visao'); }} type="button">
                        <strong className="block text-sm font-semibold text-zinc-50">Kart {kart.numero}</strong>
                        <span className="mt-1 block"><KartCategoryBadge numero={kart.numero} /></span>
                      </button>
                    </td>
                    <td className="px-4 py-3.5 text-sm text-zinc-300">{kart.chassi_numero || <span className="text-amber-300">Não informado</span>}</td>
                    <td className="px-4 py-3.5 text-sm text-zinc-300"><span className="block">Placa {kart.numero}</span><span className={kartSensor(kart) ? 'text-zinc-500' : 'text-amber-300'}>Sensor {kartSensor(kart) || 'não informado'}</span><span className="block text-[10px] text-zinc-600">{kart.sensor_numero ? 'Cadastro local' : kart.sensor_numero_fonte ? 'Fonte LapTime' : 'Sem sensor'}</span></td>
                    <td className="px-4 py-3.5 text-sm text-zinc-300"><span className="block">{kart.laptime_quantity ?? '—'} registros</span><span className="text-zinc-500">{formatTime(kart.laptime_time_of_use_ms)} de uso</span></td>
                    <td className="px-4 py-3.5"><strong className="block text-sm font-semibold text-zinc-100">{formatTime(kart.media_equalizacao_ms)}</strong><DeltaIndicator deltaMs={delta} /></td>
                    <td className="px-4 py-3.5 text-sm text-zinc-400"><span className="block">{statusLabel[kart.status] || kart.status}</span><span className={kart.manutencoes_pendentes > 0 ? 'text-amber-300' : 'text-zinc-500'}>{kart.manutencoes_pendentes || 0} pendente(s)</span></td>
                    <td className="px-4 py-3.5"><EqualizationStateBadge kart={kart} /></td>
                    <td className="px-4 py-3.5"><div className="flex items-center gap-1"><button aria-label={`Abrir ficha do kart ${kart.numero}`} className="rounded-md p-2 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100" onClick={() => { setSelectedKartId(kart.id); setDetailTab('visao'); }} title="Abrir ficha" type="button"><Settings2 aria-hidden="true" size={16} /></button>{canWrite ? <button aria-label={`Editar kart ${kart.numero}`} className="rounded-md p-2 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100" onClick={() => openEditKart(kart)} title="Editar ficha" type="button"><Wrench aria-hidden="true" size={16} /></button> : null}</div></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!loading && filteredKarts.length === 0 ? <div className="p-12 text-center text-sm text-zinc-500">Nenhum kart encontrado com os filtros atuais.</div> : null}
      </section>

      {selectedKart ? (
        <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 shadow-card" id="ficha-kart">
          <header className="flex flex-col gap-4 border-b border-zinc-800 px-4 py-5 md:flex-row md:items-start md:justify-between md:px-5">
            <div className="flex min-w-0 items-start gap-3">
              <span className="flex h-11 w-11 flex-none items-center justify-center rounded-lg bg-brand-500/10 text-brand-400"><Gauge aria-hidden="true" size={21} /></span>
              <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-semibold text-zinc-50">Kart {selectedKart.numero}</h2><KartCategoryBadge numero={selectedKart.numero} /><EqualizationStateBadge kart={selectedKart} /></div><p className="mt-1 text-sm text-zinc-400">Chassi {selectedKart.chassi_numero || 'não informado'} · Sensor {selectedKartSensor || 'não informado'} · {kartModel(selectedKart)} · {selectedKart.data_source === 'laptime' ? 'Fonte LapTime' : 'Cadastro local'}</p></div>
            </div>
            <div className="flex flex-wrap gap-2">{canWrite ? <><Button onClick={openEqualization}><ClipboardCheck aria-hidden="true" size={15} /> Registrar equalização</Button><Button onClick={openMaintenance} variant="secondary"><Wrench aria-hidden="true" size={15} /> Registrar manutenção</Button><Button onClick={() => openEditKart(selectedKart)} variant="ghost"><Settings2 aria-hidden="true" size={15} /> Editar ficha</Button></> : null}</div>
          </header>
          <div className="flex gap-1 overflow-x-auto border-b border-zinc-800 px-4 md:px-5"><button className={`whitespace-nowrap border-b-2 px-3 py-3 text-xs font-semibold ${detailTab === 'visao' ? 'border-brand-400 text-brand-300' : 'border-transparent text-zinc-500 hover:text-zinc-200'}`} onClick={() => setDetailTab('visao')} type="button">Visão geral</button><button className={`whitespace-nowrap border-b-2 px-3 py-3 text-xs font-semibold ${detailTab === 'historico' ? 'border-brand-400 text-brand-300' : 'border-transparent text-zinc-500 hover:text-zinc-200'}`} onClick={() => setDetailTab('historico')} type="button">Histórico de voltas</button><button className={`whitespace-nowrap border-b-2 px-3 py-3 text-xs font-semibold ${detailTab === 'manutencao' ? 'border-brand-400 text-brand-300' : 'border-transparent text-zinc-500 hover:text-zinc-200'}`} onClick={() => setDetailTab('manutencao')} type="button">Manutenção e identidade</button></div>

          {detailLoading ? <div className="flex items-center gap-2 px-5 py-12 text-sm text-zinc-500"><RefreshCw aria-hidden="true" className="animate-spin" size={17} /> Carregando histórico do sensor e ficha técnica...</div> : null}
          {detailError ? <div className="mx-5 mt-5 rounded-lg border border-amber-900/60 bg-amber-950/20 p-3 text-sm text-amber-200">Histórico LapTime indisponível no momento: {detailError}. A ficha D1 continua disponível.</div> : null}

          {!detailLoading && detailTab === 'visao' ? <div className="grid gap-5 p-4 md:p-5 xl:grid-cols-[1.15fr_.85fr]">
            <div className="grid gap-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><HistoryMetric label="Alvo da categoria" value={formatTime(targetForKart(selectedKart.numero))} sub={KART_CATEGORY_LABELS[kartCategoryFromPlate(selectedKart.numero)]} /><HistoryMetric label="Média registrada" value={formatTime(selectedKart.media_equalizacao_ms)} sub={<DeltaIndicator deltaMs={equalizationDeltaMs(selectedKart.media_equalizacao_ms, selectedKart.numero)} />} /><HistoryMetric label="Melhor equalização" value={formatTime(selectedKart.melhor_equalizacao_ms)} sub={`${selectedKart.desvio_equalizacao_ms ?? 0} ms de desvio`} /><HistoryMetric label="Última medição" value={formatDate(selectedKart.ultima_equalizacao, true)} sub={selectedKart.ultimo_piloto_equalizacao || 'Piloto não informado'} /></div>
              <div className="rounded-lg border border-zinc-800 p-4"><div className="flex items-center justify-between gap-3"><div><h3 className="text-sm font-semibold text-zinc-50">Comparativo da categoria</h3><p className="mt-1 text-xs text-zinc-500">Média das medições registradas para a mesma categoria.</p></div><Activity aria-hidden="true" className="text-brand-400" size={18} /></div><div className="mt-4 grid gap-3 sm:grid-cols-2">{(['indoor', 'super'] as const).map((category) => { const summary = categorySummaries[category]; return <div className="rounded-lg bg-zinc-950/50 p-3" key={category}><div className="flex items-center justify-between gap-2"><span className="text-xs font-semibold text-zinc-300">{KART_CATEGORY_LABELS[category]}</span><Badge variant={categoryVariant[category]}>{summary.measured}/{summary.total} medidos</Badge></div><strong className="mt-2 block text-lg text-zinc-50">{formatTime(summary.averageMs)}</strong><span className="text-xs text-zinc-500">Alvo {formatTime(KART_CATEGORY_TARGETS_MS[category])} · {formatDelta(summary.averageDeltaMs)} do alvo</span></div>; })}</div></div>
              <div className="rounded-lg border border-zinc-800 p-4"><div className="flex items-center gap-2"><Tag aria-hidden="true" className="text-brand-400" size={17} /><h3 className="text-sm font-semibold text-zinc-50">Identidade física rastreável</h3></div><dl className="mt-4 grid gap-x-5 gap-y-3 sm:grid-cols-2"><div><dt className="text-[10px] font-bold uppercase tracking-[.1em] text-zinc-500">Número do chassi</dt><dd className="mt-1 text-sm text-zinc-100">{selectedKart.chassi_numero || 'Não informado'}</dd></div><div><dt className="text-[10px] font-bold uppercase tracking-[.1em] text-zinc-500">Placa do kart</dt><dd className="mt-1 text-sm text-zinc-100">{selectedKart.numero}</dd></div><div><dt className="text-[10px] font-bold uppercase tracking-[.1em] text-zinc-500">Sensor / transponder</dt><dd className="mt-1 text-sm text-zinc-100">{selectedKartSensor || 'Não informado'}</dd><span className="mt-1 block text-[11px] text-zinc-500">{selectedKartSensorSource || 'Nenhuma fonte vinculada'}</span></div><div><dt className="text-[10px] font-bold uppercase tracking-[.1em] text-zinc-500">Redutor</dt><dd className="mt-1 text-sm text-zinc-100">{selectedKart.redutor_antigo || '—'} <span className="text-zinc-500">→</span> {selectedKart.redutor_novo || '—'}</dd></div><div><dt className="text-[10px] font-bold uppercase tracking-[.1em] text-zinc-500">Última manutenção</dt><dd className="mt-1 text-sm text-zinc-100">{formatDate(selectedKart.ultima_manutencao, true)}</dd></div><div><dt className="text-[10px] font-bold uppercase tracking-[.1em] text-zinc-500">Próxima manutenção</dt><dd className="mt-1 text-sm text-zinc-100">{formatDate(selectedKart.proxima_manutencao, true)}</dd></div><div><dt className="text-[10px] font-bold uppercase tracking-[.1em] text-zinc-500">Uso registrado no LapTime</dt><dd className="mt-1 text-sm text-zinc-100">{selectedKart.laptime_quantity ?? 'Não informado'} registros</dd><span className="mt-1 block text-[11px] text-zinc-500">{formatTime(selectedKart.laptime_time_of_use_ms)} de tempo de uso · atualizado {formatDate(selectedKart.laptime_updated_at, true)}</span></div></dl></div>
            </div>
            <aside className="rounded-lg border border-zinc-800 p-4"><div className="flex items-center justify-between gap-3"><div><h3 className="text-sm font-semibold text-zinc-50">Alertas de ação</h3><p className="mt-1 text-xs text-zinc-500">Pendências que podem afetar a comparação entre karts.</p></div><AlertTriangle aria-hidden="true" className="text-amber-300" size={18} /></div><div className="mt-4 grid gap-2">{equalizationState(selectedKart.media_equalizacao_ms, selectedKart.numero) !== 'equilibrado' ? <div className="flex gap-3 rounded-lg border border-amber-900/50 bg-amber-950/20 p-3"><AlertTriangle aria-hidden="true" className="mt-0.5 flex-none text-amber-300" size={16} /><div><strong className="block text-xs text-amber-200">{stateLabel[equalizationState(selectedKart.media_equalizacao_ms, selectedKart.numero)]}</strong><p className="mt-1 text-xs leading-5 text-amber-100/70">{selectedKart.media_equalizacao_ms ? `A média está ${formatDelta(equalizationDeltaMs(selectedKart.media_equalizacao_ms, selectedKart.numero))} do alvo ${formatTime(targetForKart(selectedKart.numero))}.` : 'Registre uma medição com o mesmo piloto e traçado antes de liberar o kart para comparação.'}</p></div></div> : <div className="flex gap-3 rounded-lg border border-emerald-900/50 bg-emerald-950/20 p-3"><CheckCircle2 aria-hidden="true" className="mt-0.5 flex-none text-emerald-300" size={16} /><p className="text-xs leading-5 text-emerald-100/80">Média dentro da tolerância de ±{formatTime(EQUALIZATION_TOLERANCE_MS)}.</p></div>}{!selectedKartSensor ? <div className="flex gap-3 rounded-lg border border-amber-900/50 bg-amber-950/20 p-3"><ShieldAlert aria-hidden="true" className="mt-0.5 flex-none text-amber-300" size={16} /><p className="text-xs leading-5 text-amber-100/80">Sensor não encontrado no cadastro local nem no vínculo do LapTime. O histórico usará a placa.</p></div> : null}{selectedKart.manutencoes_pendentes > 0 ? <div className="flex gap-3 rounded-lg border border-red-900/50 bg-red-950/20 p-3"><Wrench aria-hidden="true" className="mt-0.5 flex-none text-red-300" size={16} /><p className="text-xs leading-5 text-red-100/80">{selectedKart.manutencoes_pendentes} manutenção(ões) pendente(s) na ficha.</p></div> : null}</div><div className="mt-5 border-t border-zinc-800 pt-4"><h3 className="text-sm font-semibold text-zinc-50">Últimas medições</h3><div className="mt-3 grid gap-2">{equalizations.slice(0, 5).map((item) => <div className="flex items-center justify-between gap-3 rounded-lg bg-zinc-950/50 px-3 py-2.5" key={item.id}><div className="min-w-0"><strong className="block truncate text-xs text-zinc-200">{item.piloto}</strong><span className="block truncate text-[11px] text-zinc-500">{formatDate(item.data, true)} · {item.traco}</span></div><div className="text-right"><strong className="block text-xs text-zinc-100">{formatTime(item.media_ms)}</strong><Badge variant={item.status === 'aprovada' ? 'emerald' : item.status === 'ajustar' ? 'amber' : 'zinc'}>{statusLabel[item.status] || item.status}</Badge></div></div>)}{equalizations.length === 0 ? <p className="text-xs text-zinc-500">Nenhuma medição registrada.</p> : null}</div></div></aside>
          </div> : null}

          {!detailLoading && detailTab === 'historico' ? <div className="grid gap-5 p-4 md:p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div><h3 className="text-sm font-semibold text-zinc-50">Melhor volta por corrida</h3><p className="mt-1 text-xs text-zinc-500">Consulta por {historyIdentityLabel} · somente corridas encerradas.</p></div><div className="flex flex-wrap gap-1">{([7, 15, 30, 60] as const).map((size) => <button className={`rounded-md px-3 py-2 text-xs font-semibold transition-colors ${activeWindow === size ? 'bg-brand-500 text-zinc-950' : 'bg-zinc-800 text-zinc-400 hover:text-zinc-100'}`} key={size} onClick={() => setActiveWindow(size)} type="button">Últimas {size}</button>)}</div></div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><HistoryMetric label="Corridas encontradas" value={String(activeHistoryWindow?.count ?? 0)} sub={`de ${activeWindow} solicitadas`} /><HistoryMetric label="Melhor volta" value={formatTime(activeHistoryWindow?.bestLapMs)} /><HistoryMetric label="Média das melhores" value={formatTime(activeHistoryWindow?.averageBestLapMs)} sub={`Alvo ${formatTime(targetForKart(selectedKart.numero))}`} /><HistoryMetric label="Tendência" value={formatDelta(activeHistoryWindow?.trendMs)} sub="Mais recente vs. mais antiga" /><HistoryMetric label="Fonte da identidade" value={historyMatchedBy === 'sensor' ? 'Sensor' : 'Placa'} sub={historyMatchedBy === 'sensor' ? selectedKartSensor || selectedKart.numero : selectedKart.numero} /></div>
            <div className="rounded-lg border border-zinc-800 p-4"><div className="flex items-center justify-between gap-3"><div><h3 className="text-sm font-semibold text-zinc-50">Gráfico das últimas voltas</h3><p className="mt-1 text-xs text-zinc-500">Barras mais altas representam voltas mais rápidas.</p></div><History aria-hidden="true" className="text-brand-400" size={18} /></div>{chartRows.length ? <div className="mt-5 flex h-52 items-end gap-2 overflow-x-auto border-b border-zinc-800 pb-1" role="img" aria-label={`Gráfico com ${chartRows.length} melhores voltas`}>{chartRows.map((row) => { const value = row.bestLapMs as number; const height = 28 + Math.round(((chartMax - value) / chartRange) * 72); return <div className="flex h-full min-w-9 flex-1 flex-col items-center justify-end gap-1" key={row.raceId}><span className="text-[9px] font-semibold text-zinc-400">{formatTime(value)}</span><div className="w-full max-w-9 rounded-t bg-brand-500/70 transition-colors hover:bg-brand-400" style={{ height: `${height}%` }} title={`${row.raceName}: ${formatTime(value)}`} /><span className="max-w-12 truncate text-[9px] text-zinc-600">{formatDate(row.raceDate, true)}</span></div>; })}</div> : <div className="flex h-52 items-center justify-center text-sm text-zinc-500">Nenhuma melhor volta encontrada para esta identidade.</div>}</div>
            <div className="overflow-hidden rounded-lg border border-zinc-800"><div className="border-b border-zinc-800 px-4 py-3"><h3 className="text-sm font-semibold text-zinc-50">Histórico detalhado</h3></div><div className="overflow-x-auto"><table className="min-w-[860px] w-full text-left"><thead className="border-b border-zinc-800"><tr>{['Corrida', 'Data', 'Traçado', 'Piloto', 'Identidade', 'Melhor volta', 'Voltas'].map((label) => <th className="whitespace-nowrap px-4 py-3 text-[10px] font-bold uppercase tracking-[.1em] text-zinc-500" key={label}>{label}</th>)}</tr></thead><tbody>{activeHistoryRows.map((row) => <tr className="border-b border-zinc-800/60 last:border-0" key={row.raceId}><td className="px-4 py-3 text-sm font-semibold text-zinc-200">{row.raceName}</td><td className="px-4 py-3 text-xs text-zinc-400">{formatDate(row.raceDate)}</td><td className="px-4 py-3 text-xs text-zinc-400">{row.trackName || '—'}</td><td className="px-4 py-3 text-xs text-zinc-400">{row.driver || '—'}</td><td className="px-4 py-3"><Badge variant={row.matchedBy === 'sensor' ? 'emerald' : 'amber'}>{row.matchedBy === 'sensor' ? `Sensor ${row.sensor || '—'}` : `Placa ${row.plate || selectedKart.numero}`}</Badge></td><td className="px-4 py-3 text-sm font-semibold tabular-nums text-zinc-100">{row.bestLap || formatTime(row.bestLapMs)}</td><td className="px-4 py-3 text-xs text-zinc-400">{row.laps ?? '—'}</td></tr>)}{activeHistoryRows.length === 0 ? <tr><td className="px-4 py-12 text-center text-sm text-zinc-500" colSpan={7}>Nenhum registro nesta janela.</td></tr> : null}</tbody></table></div></div>
          </div> : null}

          {!detailLoading && detailTab === 'manutencao' ? <div className="grid gap-5 p-4 md:p-5 xl:grid-cols-[1fr_1fr]">
            <div className="rounded-lg border border-zinc-800"><div className="flex items-center justify-between gap-3 border-b border-zinc-800 px-4 py-3"><div><h3 className="text-sm font-semibold text-zinc-50">Manutenções registradas</h3><p className="mt-1 text-xs text-zinc-500">Serviços, custos e próximos vencimentos.</p></div>{canWrite ? <Button onClick={openMaintenance}><Wrench aria-hidden="true" size={15} /> Nova manutenção</Button> : null}</div><div className="divide-y divide-zinc-800/70">{maintenances.map((item) => <div className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start sm:justify-between" key={item.id}><div><div className="flex flex-wrap items-center gap-2"><strong className="text-sm text-zinc-200">{item.tipo}</strong><Badge variant={item.status === 'concluida' ? 'emerald' : item.status === 'pendente' ? 'amber' : 'blue'}>{statusLabel[item.status] || item.status}</Badge></div><p className="mt-1 text-xs leading-5 text-zinc-400">{item.descricao}</p><span className="mt-1 block text-[11px] text-zinc-600">{formatDate(item.data, true)} · {item.responsavel || 'Responsável não informado'}</span></div><strong className="text-sm tabular-nums text-zinc-200">R$ {Number(item.custo || 0).toFixed(2).replace('.', ',')}</strong></div>)}{maintenances.length === 0 ? <p className="px-4 py-10 text-center text-sm text-zinc-500">Nenhuma manutenção registrada.</p> : null}</div></div>
            <div className="rounded-lg border border-zinc-800"><div className="border-b border-zinc-800 px-4 py-3"><div className="flex items-center gap-2"><History aria-hidden="true" className="text-brand-400" size={17} /><div><h3 className="text-sm font-semibold text-zinc-50">Histórico de placa e sensor</h3><p className="mt-1 text-xs text-zinc-500">Registros automáticos de troca de identidade.</p></div></div></div><div className="divide-y divide-zinc-800/70">{identityEvents.map((item) => <div className="px-4 py-3" key={item.id}><div className="flex items-center justify-between gap-3"><Badge variant={item.acao === 'troca_identidade' ? 'amber' : 'blue'}>{statusLabel[item.acao] || item.acao}</Badge><span className="text-[11px] text-zinc-600">{formatDate(item.data)}</span></div><div className="mt-3 grid gap-2 text-xs sm:grid-cols-3"><span className="text-zinc-400">Chassi <strong className="text-zinc-200">{item.chassi_anterior || '—'} → {item.chassi_novo || '—'}</strong></span><span className="text-zinc-400">Placa <strong className="text-zinc-200">{item.placa_anterior || '—'} → {item.placa_nova || '—'}</strong></span><span className="text-zinc-400">Sensor <strong className="text-zinc-200">{item.sensor_anterior || '—'} → {item.sensor_novo || '—'}</strong></span></div>{item.observacoes ? <p className="mt-2 text-xs text-zinc-500">{item.observacoes}</p> : null}</div>)}{identityEvents.length === 0 ? <p className="px-4 py-10 text-center text-sm text-zinc-500">Nenhuma troca registrada.</p> : null}</div></div>
          </div> : null}
        </section>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-2">
        {(['super', 'indoor'] as const).map((category) => { const summary = categorySummaries[category]; return <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 shadow-card md:p-5" key={category}><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[.12em] text-zinc-500">Padrão de referência</p><h2 className="mt-1 text-base font-semibold text-zinc-50">{KART_CATEGORY_LABELS[category]}</h2></div><Badge variant={categoryVariant[category]}>{summary.total} karts</Badge></div><div className="mt-4 grid gap-3 sm:grid-cols-3"><HistoryMetric label="Alvo médio" value={formatTime(KART_CATEGORY_TARGETS_MS[category])} /><HistoryMetric label="Média da frota" value={formatTime(summary.averageMs)} sub={formatDelta(summary.averageDeltaMs)} /><HistoryMetric label="Medições" value={`${summary.measured}/${summary.total}`} sub="com equalização registrada" /></div></div>; })}
      </section>

      <Modal isOpen={kartModalOpen} onClose={() => setKartModalOpen(false)} title={editingKart ? `Editar ficha do kart ${editingKart.numero}` : 'Cadastrar kart'} footer={<><Button onClick={() => setKartModalOpen(false)} variant="ghost">Cancelar</Button><Button form="kart-form" loading={submitting} type="submit">Salvar ficha</Button></>}>
        <form className="grid gap-4" id="kart-form" onSubmit={handleKartSubmit}>
          <div className="rounded-lg border border-brand-800/40 bg-brand-950/20 p-3 text-sm text-brand-100"><strong>Categoria automática:</strong> {KART_CATEGORY_LABELS[kartCategoryFromPlate(kartForm.numero)]}. A classificação usa exclusivamente a placa.</div>
          {kartFormError ? <p className="rounded-lg border border-red-900/60 bg-red-950/20 p-3 text-xs text-red-200" role="alert">{kartFormError}</p> : null}
          <div className="grid gap-4 sm:grid-cols-2"><FormField htmlFor="kart-numero" label="Número do kart / placa"><input className={inputClassName} id="kart-numero" inputMode="numeric" maxLength={3} onChange={(event) => setKartForm((current) => ({ ...current, numero: event.target.value }))} required value={kartForm.numero} /></FormField><FormField htmlFor="kart-chassi" label="Número do chassi"><input className={inputClassName} id="kart-chassi" onChange={(event) => setKartForm((current) => ({ ...current, chassi_numero: event.target.value }))} required value={kartForm.chassi_numero} /></FormField><FormField htmlFor="kart-sensor" label="Sensor / transponder" hint="O histórico de desempenho prioriza este identificador."><input className={inputClassName} id="kart-sensor" onChange={(event) => setKartForm((current) => ({ ...current, sensor_numero: event.target.value }))} value={kartForm.sensor_numero} /></FormField><FormField htmlFor="kart-modelo" label="Modelo"><input className={inputClassName} id="kart-modelo" onChange={(event) => setKartForm((current) => ({ ...current, modelo: event.target.value }))} value={kartForm.modelo} /></FormField><FormField htmlFor="kart-redutor-antigo" label="Redutor antigo"><input className={inputClassName} id="kart-redutor-antigo" onChange={(event) => setKartForm((current) => ({ ...current, redutor_antigo: event.target.value }))} value={kartForm.redutor_antigo} /></FormField><FormField htmlFor="kart-redutor-novo" label="Redutor novo"><input className={inputClassName} id="kart-redutor-novo" onChange={(event) => setKartForm((current) => ({ ...current, redutor_novo: event.target.value }))} value={kartForm.redutor_novo} /></FormField><FormField htmlFor="kart-motor" label="Motor"><input className={inputClassName} id="kart-motor" onChange={(event) => setKartForm((current) => ({ ...current, motor: event.target.value }))} value={kartForm.motor} /></FormField><FormField htmlFor="kart-km" label="Quilometragem total"><input className={inputClassName} id="kart-km" min="0" onChange={(event) => setKartForm((current) => ({ ...current, km_total: event.target.value }))} step="0.1" type="number" value={kartForm.km_total} /></FormField><FormField htmlFor="kart-proxima" label="Próxima manutenção"><input className={inputClassName} id="kart-proxima" onChange={(event) => setKartForm((current) => ({ ...current, proxima_manutencao: event.target.value }))} type="date" value={kartForm.proxima_manutencao} /></FormField><FormField htmlFor="kart-status" label="Status"><select className={inputClassName} id="kart-status" onChange={(event) => setKartForm((current) => ({ ...current, status: event.target.value }))} value={kartForm.status}><option value="disponivel">Disponível</option><option value="em_uso">Em uso</option><option value="manutencao">Em manutenção</option><option value="inativo">Inativo</option></select></FormField></div>
          <FormField htmlFor="kart-notes" label="Observações"><textarea className={textareaClassName} id="kart-notes" onChange={(event) => setKartForm((current) => ({ ...current, notes: event.target.value }))} value={kartForm.notes} /></FormField>
          <label className="flex items-center gap-2 text-sm text-zinc-300"><input checked={kartForm.ativo} className="h-4 w-4 rounded border-zinc-700 bg-zinc-950 text-brand-500" onChange={(event) => setKartForm((current) => ({ ...current, ativo: event.target.checked }))} type="checkbox" /> Participa da frota ativa</label>
        </form>
      </Modal>

      <Modal isOpen={equalizationModalOpen} onClose={() => setEqualizationModalOpen(false)} title={`Registrar equalização · Kart ${selectedKart?.numero || ''}`} footer={<><Button onClick={() => setEqualizationModalOpen(false)} variant="ghost">Cancelar</Button><Button form="equalization-form" loading={submitting} type="submit">Registrar medição</Button></>}>
        <form className="grid gap-4" id="equalization-form" onSubmit={handleEqualizationSubmit}><div className="rounded-lg border border-brand-800/40 bg-brand-950/20 p-3 text-xs leading-5 text-brand-100">Use o mesmo piloto ou pilotos com traçado idêntico. Alvo desta categoria: <strong>{formatTime(targetForKart(selectedKart?.numero))}</strong>. A média será usada no painel de equilíbrio.</div><div className="grid gap-4 sm:grid-cols-2"><FormField htmlFor="eq-piloto" label="Piloto de referência"><div className="relative"><UserRound aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} /><input className={`${inputClassName} pl-9`} id="eq-piloto" onChange={(event) => setEqualizationForm((current) => ({ ...current, piloto: event.target.value }))} required value={equalizationForm.piloto} /></div></FormField><FormField htmlFor="eq-traco" label="Traçado da pista"><input className={inputClassName} id="eq-traco" onChange={(event) => setEqualizationForm((current) => ({ ...current, traco: event.target.value }))} required value={equalizationForm.traco} /></FormField><FormField htmlFor="eq-data" label="Data da medição"><input className={inputClassName} id="eq-data" onChange={(event) => setEqualizationForm((current) => ({ ...current, data: event.target.value }))} required type="date" value={equalizationForm.data} /></FormField><FormField htmlFor="eq-voltas" label="Voltas válidas"><input className={inputClassName} id="eq-voltas" min="1" onChange={(event) => setEqualizationForm((current) => ({ ...current, voltas_validas: event.target.value }))} required type="number" value={equalizationForm.voltas_validas} /></FormField><FormField htmlFor="eq-best" label="Melhor volta" hint="Formato: 1:05.700 ou 1:14.500"><input className={inputClassName} id="eq-best" onChange={(event) => setEqualizationForm((current) => ({ ...current, melhor_volta: event.target.value }))} required value={equalizationForm.melhor_volta} /></FormField><FormField htmlFor="eq-average" label="Média das voltas" hint="A métrica principal da equalização."><input className={inputClassName} id="eq-average" onChange={(event) => setEqualizationForm((current) => ({ ...current, media: event.target.value }))} required value={equalizationForm.media} /></FormField><FormField htmlFor="eq-deviation" label="Desvio medido" hint="Opcional. Ex.: 0:00.850"><input className={inputClassName} id="eq-deviation" onChange={(event) => setEqualizationForm((current) => ({ ...current, desvio: event.target.value }))} value={equalizationForm.desvio} /></FormField><FormField htmlFor="eq-status" label="Resultado"><select className={inputClassName} id="eq-status" onChange={(event) => setEqualizationForm((current) => ({ ...current, status: event.target.value as EqualizationFormState['status'] }))} value={equalizationForm.status}><option value="reteste">Reteste necessário</option><option value="ajustar">Ajustar kart</option><option value="aprovada">Aprovada</option></select></FormField></div><FormField htmlFor="eq-notes" label="Observações"><textarea className={textareaClassName} id="eq-notes" onChange={(event) => setEqualizationForm((current) => ({ ...current, observacoes: event.target.value }))} value={equalizationForm.observacoes} /></FormField></form>
      </Modal>

      <Modal isOpen={maintenanceModalOpen} onClose={() => setMaintenanceModalOpen(false)} title={`Registrar manutenção · Kart ${selectedKart?.numero || ''}`} footer={<><Button onClick={() => setMaintenanceModalOpen(false)} variant="ghost">Cancelar</Button><Button form="maintenance-form" loading={submitting} type="submit">Salvar manutenção</Button></>}>
        <form className="grid gap-4" id="maintenance-form" onSubmit={handleMaintenanceSubmit}><div className="grid gap-4 sm:grid-cols-2"><FormField htmlFor="maintenance-type" label="Tipo"><input className={inputClassName} id="maintenance-type" onChange={(event) => setMaintenanceForm((current) => ({ ...current, tipo: event.target.value }))} required value={maintenanceForm.tipo} /></FormField><FormField htmlFor="maintenance-date" label="Data"><input className={inputClassName} id="maintenance-date" onChange={(event) => setMaintenanceForm((current) => ({ ...current, data: event.target.value }))} required type="date" value={maintenanceForm.data} /></FormField><FormField htmlFor="maintenance-next" label="Próxima manutenção"><input className={inputClassName} id="maintenance-next" onChange={(event) => setMaintenanceForm((current) => ({ ...current, proxima_manutencao: event.target.value }))} type="date" value={maintenanceForm.proxima_manutencao} /></FormField><FormField htmlFor="maintenance-cost" label="Custo"><input className={inputClassName} id="maintenance-cost" min="0" onChange={(event) => setMaintenanceForm((current) => ({ ...current, custo: event.target.value }))} step="0.01" type="number" value={maintenanceForm.custo} /></FormField><FormField htmlFor="maintenance-owner" label="Responsável"><input className={inputClassName} id="maintenance-owner" onChange={(event) => setMaintenanceForm((current) => ({ ...current, responsavel: event.target.value }))} value={maintenanceForm.responsavel} /></FormField><FormField htmlFor="maintenance-status" label="Status"><select className={inputClassName} id="maintenance-status" onChange={(event) => setMaintenanceForm((current) => ({ ...current, status: event.target.value as MaintenanceFormState['status'] }))} value={maintenanceForm.status}><option value="concluida">Concluída</option><option value="em_andamento">Em andamento</option><option value="pendente">Pendente</option></select></FormField></div><FormField htmlFor="maintenance-description" label="Descrição do serviço"><textarea className={textareaClassName} id="maintenance-description" onChange={(event) => setMaintenanceForm((current) => ({ ...current, descricao: event.target.value }))} required value={maintenanceForm.descricao} /></FormField></form>
      </Modal>
    </div>
  );
};
