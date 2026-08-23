import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import {
  Activity,
  AlertTriangle,
  Download,
  List,
  Lock,
  Pause,
  Play,
  Radio,
  Timer,
  TrendingUp,
  Trophy,
  Users,
  WifiOff,
} from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { canAccess } from '../../lib/rbac';
import { Badge, StatusBadge } from '../../ui/Badge';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import { DataTable, type DataTableColumn } from '../../ui/DataTable';
import { FormField } from '../../ui/FormField';
import { Modal } from '../../ui/Modal';
import { PageHeader } from '../../ui/PageHeader';
import { Pagination } from '../../ui/Pagination';
import { StatCard } from '../../ui/StatCard';
import { Tabs } from '../../ui/Tabs';
import { useToast } from '../../ui/useToast';
import {
  listLapTimeRacingCompetitors,
  listLapTimeRacingsPage,
  type LapTimeRacing,
  type LapTimeRacingCompetitor,
  type LapTimeRacingsFilters,
} from '../resultados/laptime-racings.api';
import {
  DEFAULT_LIVE_URL,
  createSessao,
  createVolta,
  fetchLiveSnapshot,
  gerarResultados,
  importarSnapshot,
  listCampeonatos,
  listEtapas,
  listPilotos,
  listSessoes,
  listSessoesPage,
  listVoltas,
  removeSessao,
  removeVolta,
  updateSessao,
  updateVolta,
  type SessoesFilters,
} from './cronometragem.api';
import { listFormatos } from '../campeonatos/campeonatos.api';
import {
  msParaTexto,
  type CampeonatoOption,
  type EtapaOption,
  type LiveSnapshot,
  type LivePitStopStatus,
  type LivePiloto,
  type PilotoOption,
  type SessaoPayload,
  type SessaoStatus,
  type SessaoTipo,
  type SessaoWithCampeonato,
  type Volta,
  type VoltaPayload,
  type VoltaUpdate,
} from './cronometragem.types';
import type { FormatoCorridaRecord } from '../campeonatos/campeonatos.types';
import { pitRulesDoFormato, resolverFormatoCorrida, normalizarFormato as normalizarFormatoRecord } from '@/lib/race-formats';

type TabKey = 'ao-vivo' | 'historico' | 'sessoes' | 'voltas';
const PAGE_SIZE = 10;
const MANDATORY_STOP_MS = 7 * 60 * 1_000;

type LiveTableRow = {
  piloto: LivePiloto;
  posicao: number;
  voltasProjetadas: number | null;
};

type SessaoFormState = {
  nome: string;
  campeonato_id: string;
  etapa_id: string;
  tipo: SessaoTipo;
  data: string;
  status: 'aberta' | 'encerrada';
  fonte: string;
  formato_id: string;
};

type VoltaFormState = {
  piloto_id: string;
  piloto_nome: string;
  kart: string;
  numero: string;
  tempo: string;
  setor1: string;
  setor2: string;
  setor3: string;
  posicao: string;
  melhor: boolean;
  valida: boolean;
};

type DeleteTarget =
  | { kind: 'sessao'; item: SessaoWithCampeonato }
  | { kind: 'volta'; item: Volta };

const LIVE_URL_STORAGE_KEY = 'cronometragem_live_url';

const emptySessaoForm: SessaoFormState = {
  nome: '',
  campeonato_id: '',
  etapa_id: '',
  tipo: 'treino',
  data: '',
  status: 'aberta',
  fonte: 'manual',
  formato_id: '',
};

const emptyVoltaForm: VoltaFormState = {
  piloto_id: '',
  piloto_nome: '',
  kart: '',
  numero: '1',
  tempo: '',
  setor1: '',
  setor2: '',
  setor3: '',
  posicao: '',
  melhor: false,
  valida: true,
};

const inputClassName =
  'w-full h-10 rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-brand-500/60 focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition';

const checkboxClassName =
  'h-4 w-4 rounded border-zinc-700 bg-zinc-950 text-brand-500 focus:ring-brand-500/30';

const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
});

const numberFormatter = new Intl.NumberFormat('pt-BR');

const pitStopStatusLabel: Record<LivePitStopStatus, string> = {
  mandatory: 'Obrigatória válida',
  additional: 'Adicional',
  short: 'Abaixo de 7 min',
  invalid: 'Registro inválido',
  'outside-window': 'Fora da janela dos boxes',
};

const pitStopStatusVariant: Record<LivePitStopStatus, 'emerald' | 'amber' | 'red' | 'blue' | 'zinc'> = {
  mandatory: 'emerald',
  additional: 'blue',
  short: 'amber',
  invalid: 'red',
  'outside-window': 'red',
};

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'Ocorreu um erro inesperado.';

const toDateTimeLocal = (value?: string | null): string => {
  if (!value) return '';
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
};

const textoParaMs = (value: string): number | null => {
  const normalized = value.trim().replace(',', '.');
  if (!normalized) return null;
  const parts = normalized.split(':');
  if (parts.length > 2) return null;
  const seconds = Number(parts[parts.length - 1]);
  const minutes = parts.length === 2 ? Number(parts[0]) : 0;
  if (!Number.isFinite(seconds) || !Number.isFinite(minutes) || seconds < 0 || minutes < 0) {
    return null;
  }
  return Math.round((minutes * 60 + seconds) * 1_000);
};

const sessionPayload = (form: SessaoFormState): SessaoPayload => ({
  campeonato_id: form.campeonato_id || null,
  etapa_id: form.etapa_id || null,
  nome: form.nome.trim(),
  tipo: form.tipo,
  data: new Date(form.data).toISOString(),
  status: form.status,
  fonte: form.fonte.trim() || null,
  formato_id: form.formato_id || null,
});

const tipoLabel: Record<SessaoTipo, string> = {
  treino: 'Treino',
  classificacao: 'Classificação',
  corrida: 'Corrida',
};

const tipoVariant: Record<SessaoTipo, 'zinc' | 'blue' | 'emerald'> = {
  treino: 'zinc',
  classificacao: 'blue',
  corrida: 'emerald',
};

export const CronometragemPage = () => {
  const { role } = useAuth();
  const toast = useToast();
  const canWrite =
    canAccess(role, 'cronometragem') && ['owner', 'admin', 'operador_telao'].includes(role);

  const [activeTab, setActiveTab] = useState<TabKey>('ao-vivo');

  const [historico, setHistorico] = useState<LapTimeRacing[]>([]);
  const [historicoTotal, setHistoricoTotal] = useState(0);
  const [historicoPage, setHistoricoPage] = useState(0);
  const [historicoSearchInput, setHistoricoSearchInput] = useState('');
  const [historicoFilters, setHistoricoFilters] = useState<LapTimeRacingsFilters>({});
  const [historicoLoading, setHistoricoLoading] = useState(true);
  const [historicoError, setHistoricoError] = useState<string | null>(null);
  const [selectedHistoricoId, setSelectedHistoricoId] = useState<string | null>(null);
  const [historicoCompetitors, setHistoricoCompetitors] = useState<LapTimeRacingCompetitor[]>([]);
  const [historicoCompetitorsLoading, setHistoricoCompetitorsLoading] = useState(false);
  const [historicoCompetitorsError, setHistoricoCompetitorsError] = useState<string | null>(null);

  const [sessoes, setSessoes] = useState<SessaoWithCampeonato[]>([]);
  const [sessoesRows, setSessoesRows] = useState<SessaoWithCampeonato[]>([]);
  const [sessoesTotal, setSessoesTotal] = useState(0);
  const [sessoesPage, setSessoesPage] = useState(0);
  const [sessoesSearchInput, setSessoesSearchInput] = useState('');
  const [sessoesFilters, setSessoesFilters] = useState<SessoesFilters>({});
  const [sessoesTabLoading, setSessoesTabLoading] = useState(true);
  const [sessoesTabError, setSessoesTabError] = useState<string | null>(null);
  const [campeonatos, setCampeonatos] = useState<CampeonatoOption[]>([]);
  const [etapas, setEtapas] = useState<EtapaOption[]>([]);
  const [pilotos, setPilotos] = useState<PilotoOption[]>([]);
  const [formatos, setFormatos] = useState<FormatoCorridaRecord[]>([]);
  const [selectedSessaoId, setSelectedSessaoId] = useState('');
  const [voltas, setVoltas] = useState<Volta[]>([]);
  const [voltasLoading, setVoltasLoading] = useState(false);
  const [voltasError, setVoltasError] = useState<string | null>(null);

  const [liveUrl, setLiveUrl] = useState(() => {
    try {
      return localStorage.getItem(LIVE_URL_STORAGE_KEY) || DEFAULT_LIVE_URL;
    } catch {
      return DEFAULT_LIVE_URL;
    }
  });
  const [connected, setConnected] = useState(true);
  const [projectionMode, setProjectionMode] = useState(false);
  const [liveLoading, setLiveLoading] = useState(false);
  const [snapshot, setSnapshot] = useState<LiveSnapshot>({
    status: 'pausado',
    pilotos: [],
  });
  const liveRequestInFlight = useRef(false);
  const [selectedPitPiloto, setSelectedPitPiloto] = useState<LivePiloto | null>(null);

  const [sessaoModalOpen, setSessaoModalOpen] = useState(false);
  const [editingSessao, setEditingSessao] = useState<SessaoWithCampeonato | null>(null);
  const [sessaoForm, setSessaoForm] = useState<SessaoFormState>(emptySessaoForm);
  const [voltaModalOpen, setVoltaModalOpen] = useState(false);
  const [editingVolta, setEditingVolta] = useState<Volta | null>(null);
  const [voltaForm, setVoltaForm] = useState<VoltaFormState>(emptyVoltaForm);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importMode, setImportMode] = useState<'existente' | 'nova'>('existente');
  const [importSessaoId, setImportSessaoId] = useState('');
  const [importSessaoForm, setImportSessaoForm] = useState<SessaoFormState>(emptySessaoForm);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);

  const selectedSessao = useMemo(
    () => sessoes.find((sessao) => sessao.id === selectedSessaoId) ?? null,
    [selectedSessaoId, sessoes],
  );

  const etapasDaSessao = useMemo(
    () => etapas.filter((etapa) => etapa.campeonato_id === sessaoForm.campeonato_id),
    [etapas, sessaoForm.campeonato_id],
  );

  const etapasDaImportacao = useMemo(
    () => etapas.filter((etapa) => etapa.campeonato_id === importSessaoForm.campeonato_id),
    [etapas, importSessaoForm.campeonato_id],
  );

  const loadData = useCallback(async () => {
    try {
      const [sessoesData, campeonatosData, etapasData, pilotosData, formatosData] = await Promise.all([
        listSessoes(),
        listCampeonatos(),
        listEtapas(),
        listPilotos(),
        listFormatos(),
      ]);
      setSessoes(sessoesData);
      setCampeonatos(campeonatosData);
      setEtapas(etapasData);
      setPilotos(pilotosData);
      setFormatos(formatosData);
      setSelectedSessaoId((current) =>
        sessoesData.some((sessao) => sessao.id === current)
          ? current
          : (sessoesData[0]?.id ?? ''),
      );
      setImportSessaoId((current) =>
        sessoesData.some((sessao) => sessao.id === current)
          ? current
          : (sessoesData[0]?.id ?? ''),
      );
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
    }
  }, [toast]);

  const loadSessoesTab = useCallback(async () => {
    setSessoesTabLoading(true);
    setSessoesTabError(null);
    try {
      const page = await listSessoesPage(sessoesFilters, sessoesPage, PAGE_SIZE);
      setSessoesRows(page.data);
      setSessoesTotal(page.total);
    } catch (error: unknown) {
      setSessoesTabError(getErrorMessage(error));
    } finally {
      setSessoesTabLoading(false);
    }
  }, [sessoesFilters, sessoesPage]);

  useEffect(() => {
    void loadSessoesTab();
  }, [loadSessoesTab]);

  useEffect(() => {
    const handle = setTimeout(() => {
      setSessoesFilters((current) => ({ ...current, q: sessoesSearchInput || undefined }));
      setSessoesPage(0);
    }, 350);
    return () => clearTimeout(handle);
  }, [sessoesSearchInput]);

  const updateSessoesStatusFilter = (status: SessaoStatus | '') => {
    setSessoesFilters((current) => ({ ...current, status }));
    setSessoesPage(0);
  };

  const updateSessoesTipoFilter = (tipo: SessaoTipo | '') => {
    setSessoesFilters((current) => ({ ...current, tipo }));
    setSessoesPage(0);
  };

  const loadHistorico = useCallback(async () => {
    setHistoricoLoading(true);
    setHistoricoError(null);
    try {
      const result = await listLapTimeRacingsPage(historicoFilters, historicoPage, PAGE_SIZE);
      setHistorico(result.data);
      setHistoricoTotal(result.total);
      setSelectedHistoricoId((current) =>
        current && result.data.some((racing) => racing.id === current) ? current : result.data[0]?.id ?? null,
      );
    } catch (error: unknown) {
      setHistoricoError(getErrorMessage(error));
    } finally {
      setHistoricoLoading(false);
    }
  }, [historicoFilters, historicoPage]);

  const loadHistoricoCompetitors = useCallback(async () => {
    if (!selectedHistoricoId) {
      setHistoricoCompetitors([]);
      setHistoricoCompetitorsError(null);
      return;
    }
    setHistoricoCompetitorsLoading(true);
    setHistoricoCompetitorsError(null);
    try {
      setHistoricoCompetitors(await listLapTimeRacingCompetitors(selectedHistoricoId));
    } catch (error: unknown) {
      setHistoricoCompetitorsError(getErrorMessage(error));
    } finally {
      setHistoricoCompetitorsLoading(false);
    }
  }, [selectedHistoricoId]);

  useEffect(() => {
    if (activeTab === 'historico') void loadHistorico();
  }, [activeTab, loadHistorico]);

  useEffect(() => {
    if (activeTab === 'historico') void loadHistoricoCompetitors();
  }, [activeTab, loadHistoricoCompetitors]);

  useEffect(() => {
    const handle = setTimeout(() => {
      setHistoricoFilters((current) => ({ ...current, q: historicoSearchInput || undefined }));
      setHistoricoPage(0);
    }, 350);
    return () => clearTimeout(handle);
  }, [historicoSearchInput]);

  const selectedHistorico = useMemo(
    () => historico.find((racing) => racing.id === selectedHistoricoId) ?? null,
    [historico, selectedHistoricoId],
  );

  const historicoColumns = useMemo<readonly DataTableColumn<LapTimeRacing>[]>(
    () => [
      {
        key: 'nome',
        label: 'Corrida',
        render: (racing) => (
          <button
            className={`text-left font-bold underline-offset-4 hover:underline ${
              selectedHistoricoId === racing.id ? 'text-brand-300' : 'text-white'
            }`}
            onClick={() => setSelectedHistoricoId(racing.id)}
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
        render: (racing) => dateFormatter.format(new Date(racing.dataHora)),
      },
      { key: 'participantes', label: 'Participantes' },
    ],
    [selectedHistoricoId],
  );

  const historicoCompetitorColumns = useMemo<readonly DataTableColumn<LapTimeRacingCompetitor>[]>(
    () => [
      { key: 'posicao', label: 'Pos.', render: (item) => item.posicao ?? '—' },
      { key: 'numero', label: 'Kart', render: (item) => item.numero ?? '—' },
      { key: 'nome', label: 'Piloto' },
      { key: 'voltas', label: 'Voltas', render: (item) => item.voltas ?? '—' },
      { key: 'melhorVolta', label: 'Melhor volta', render: (item) => item.melhorVolta ?? '—' },
    ],
    [],
  );

  const loadVoltas = useCallback(async () => {
    if (!selectedSessaoId) {
      setVoltas([]);
      setVoltasError(null);
      return;
    }
    setVoltasLoading(true);
    setVoltasError(null);
    try {
      setVoltas(await listVoltas(selectedSessaoId));
    } catch (error: unknown) {
      setVoltasError(getErrorMessage(error));
    } finally {
      setVoltasLoading(false);
    }
  }, [selectedSessaoId]);

  // Formato efetivo da sessão vinculada ao painel Ao Vivo (herança sessão → etapa → campeonato → default).
  const formatoAovivo = useMemo(() => {
    const sessao = sessoes.find((item) => item.id === selectedSessaoId) ?? null;
    const etapa = etapas.find((item) => item.id === sessao?.etapa_id) ?? null;
    const campeonato = campeonatos.find((item) => item.id === sessao?.campeonato_id) ?? null;
    return resolverFormatoCorrida({
      formatoSessao: sessao?.formato_id ? formatos.map(normalizarFormatoRecord).find((f) => f.id === sessao.formato_id) ?? null : null,
      formatoEtapa: etapa?.formato_id ? formatos.map(normalizarFormatoRecord).find((f) => f.id === etapa.formato_id) ?? null : null,
      formatoCampeonato: campeonato?.formato_id ? formatos.map(normalizarFormatoRecord).find((f) => f.id === campeonato.formato_id) ?? null : null,
      formatosDisponiveis: formatos.length ? formatos.map(normalizarFormatoRecord) : null,
    });
  }, [sessoes, selectedSessaoId, etapas, campeonatos, formatos]);

  const regrasAovivo = useMemo(() => pitRulesDoFormato(formatoAovivo.formato), [formatoAovivo]);
  const paradasHabilitadas = regrasAovivo !== null;

  // Alerta quando o regulamento configurado diverge do que a cronometragem reporta.
  const divergenciaRegras = useMemo(() => {
    const recebidas = snapshot.corrida?.regras;
    if (!recebidas || !regrasAovivo) return null;
    const diferencas: string[] = [];
    if (recebidas.paradasObrigatorias !== regrasAovivo.requiredStops) {
      diferencas.push(`paradas obrigatórias: cronometragem ${recebidas.paradasObrigatorias} × regulamento ${regrasAovivo.requiredStops}`);
    }
    if (Math.abs(recebidas.minimoParadaMs - regrasAovivo.minimumStopMs) > 999) {
      diferencas.push(`mínimo por parada: ${msParaTexto(recebidas.minimoParadaMs)} × ${msParaTexto(regrasAovivo.minimumStopMs)}`);
    }
    if (Math.abs(recebidas.boxesAbremAposMs - regrasAovivo.boxOpenAfterMs) > 59_999) {
      diferencas.push('janela de abertura dos boxes');
    }
    if (Math.abs(recebidas.boxesFechamAposMs - regrasAovivo.boxCloseAfterMs) > 59_999) {
      diferencas.push('janela de fechamento dos boxes');
    }
    return diferencas.length ? diferencas.join(' · ') : null;
  }, [snapshot.corrida, regrasAovivo]);

  const pollLive = useCallback(async () => {
    if (liveRequestInFlight.current) return;
    liveRequestInFlight.current = true;
    setLiveLoading(true);
    try {
      let url = liveUrl;
      if (url !== 'cloud' && regrasAovivo) {
        url = `${url}${url.includes('?') ? '&' : '?'}rules=${encodeURIComponent(JSON.stringify(regrasAovivo))}`;
      }
      setSnapshot(await fetchLiveSnapshot(url));
    } finally {
      liveRequestInFlight.current = false;
      setLiveLoading(false);
    }
  }, [liveUrl, regrasAovivo]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    void loadVoltas();
  }, [loadVoltas]);

  useEffect(() => {
    try {
      localStorage.setItem(LIVE_URL_STORAGE_KEY, liveUrl);
    } catch {
      // O módulo continua funcional quando o armazenamento do navegador está bloqueado.
    }
  }, [liveUrl]);

  useEffect(() => {
    if (!connected) return undefined;
    void pollLive();
    const timer = window.setInterval(() => void pollLive(), 2_000);
    return () => window.clearInterval(timer);
  }, [connected, pollLive]);

  const openCreateSessao = () => {
    const campeonatoId = campeonatos[0]?.id ?? '';
    const etapaId = etapas.find((etapa) => etapa.campeonato_id === campeonatoId)?.id ?? '';
    setEditingSessao(null);
    setSessaoForm({
      ...emptySessaoForm,
      campeonato_id: campeonatoId,
      etapa_id: etapaId,
      data: toDateTimeLocal(new Date().toISOString()),
    });
    setFormErrors({});
    setSessaoModalOpen(true);
  };

  const openEditSessao = (sessao: SessaoWithCampeonato) => {
    setEditingSessao(sessao);
    setSessaoForm({
      nome: sessao.nome,
      campeonato_id: sessao.campeonato_id ?? '',
      etapa_id: sessao.etapa_id ?? '',
      tipo: sessao.tipo,
      data: toDateTimeLocal(sessao.data),
      status: sessao.status,
      fonte: sessao.fonte ?? '',
      formato_id: sessao.formato_id ?? '',
    });
    setFormErrors({});
    setSessaoModalOpen(true);
  };

  const openCreateVolta = () => {
    if (!selectedSessaoId) return;
    const piloto = pilotos[0];
    setEditingVolta(null);
    setVoltaForm({
      ...emptyVoltaForm,
      piloto_id: piloto?.id ?? '',
      piloto_nome: piloto?.nome ?? '',
      kart: piloto?.numero ?? '',
      numero: String((voltas[voltas.length - 1]?.numero ?? 0) + 1),
    });
    setFormErrors({});
    setVoltaModalOpen(true);
  };

  const openEditVolta = (volta: Volta) => {
    setEditingVolta(volta);
    setVoltaForm({
      piloto_id: volta.piloto_id ?? '',
      piloto_nome: volta.piloto_nome,
      kart: volta.kart ?? '',
      numero: String(volta.numero),
      tempo: msParaTexto(volta.tempo_ms),
      setor1: volta.setor1_ms === null ? '' : msParaTexto(volta.setor1_ms),
      setor2: volta.setor2_ms === null ? '' : msParaTexto(volta.setor2_ms),
      setor3: volta.setor3_ms === null ? '' : msParaTexto(volta.setor3_ms),
      posicao: volta.posicao === null ? '' : String(volta.posicao),
      melhor: volta.melhor,
      valida: volta.valida,
    });
    setFormErrors({});
    setVoltaModalOpen(true);
  };

  const openImportModal = () => {
    const campeonatoId = campeonatos[0]?.id ?? '';
    const etapaId = etapas.find((etapa) => etapa.campeonato_id === campeonatoId)?.id ?? '';
    setImportMode(sessoes.length ? 'existente' : 'nova');
    setImportSessaoId(selectedSessaoId || sessoes[0]?.id || '');
    setImportSessaoForm({
      ...emptySessaoForm,
      nome: `LiveTime ${dateFormatter.format(new Date())}`,
      campeonato_id: campeonatoId,
      etapa_id: etapaId,
      data: toDateTimeLocal(new Date().toISOString()),
      fonte: 'livetime',
    });
    setFormErrors({});
    setImportModalOpen(true);
  };

  const validateSessao = (form: SessaoFormState): Record<string, string> => {
    const errors: Record<string, string> = {};
    if (!form.nome.trim()) errors.nome = 'Informe o nome da sessão.';
    if (!form.campeonato_id) errors.campeonato_id = 'Selecione um campeonato.';
    if (!form.etapa_id) errors.etapa_id = 'Selecione uma etapa.';
    if (!form.data) errors.data = 'Informe a data e hora.';
    return errors;
  };

  const handleSessaoSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canWrite) return;
    const errors = validateSessao(sessaoForm);
    setFormErrors(errors);
    if (Object.keys(errors).length) return;

    setSubmitting(true);
    try {
      if (editingSessao) {
        await updateSessao(editingSessao.id, sessionPayload(sessaoForm));
        toast.success('Sessão atualizada com sucesso.');
      } else {
        const created = await createSessao(sessionPayload(sessaoForm));
        setSelectedSessaoId(created.id);
        toast.success('Sessão criada com sucesso.');
      }
      setSessaoModalOpen(false);
      await Promise.all([loadData(), loadSessoesTab()]);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const validateVolta = (): Record<string, string> => {
    const errors: Record<string, string> = {};
    const numero = Number(voltaForm.numero);
    const posicao = voltaForm.posicao ? Number(voltaForm.posicao) : null;
    if (!voltaForm.piloto_nome.trim()) errors.piloto_id = 'Selecione um piloto.';
    if (!Number.isInteger(numero) || numero < 1) errors.numero = 'Informe uma volta válida.';
    if (textoParaMs(voltaForm.tempo) === null) errors.tempo = 'Use o formato m:ss.mmm.';
    if (posicao !== null && (!Number.isInteger(posicao) || posicao < 1)) {
      errors.posicao = 'Informe uma posição válida.';
    }
    return errors;
  };

  const handleVoltaSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canWrite || !selectedSessaoId) return;
    const errors = validateVolta();
    setFormErrors(errors);
    if (Object.keys(errors).length) return;

    const tempo = textoParaMs(voltaForm.tempo);
    if (tempo === null) return;
    const payload: VoltaPayload = {
      sessao_id: selectedSessaoId,
      piloto_id: voltaForm.piloto_id || null,
      piloto_nome: voltaForm.piloto_nome.trim(),
      kart: voltaForm.kart.trim() || null,
      numero: Number(voltaForm.numero),
      tempo_ms: tempo,
      setor1_ms: textoParaMs(voltaForm.setor1),
      setor2_ms: textoParaMs(voltaForm.setor2),
      setor3_ms: textoParaMs(voltaForm.setor3),
      posicao: voltaForm.posicao ? Number(voltaForm.posicao) : null,
      melhor: voltaForm.melhor,
      valida: voltaForm.valida,
    };

    setSubmitting(true);
    try {
      if (editingVolta) {
        const updatePayload: VoltaUpdate = {
          piloto_id: payload.piloto_id,
          piloto_nome: payload.piloto_nome,
          kart: payload.kart,
          numero: payload.numero,
          tempo_ms: payload.tempo_ms,
          setor1_ms: payload.setor1_ms,
          setor2_ms: payload.setor2_ms,
          setor3_ms: payload.setor3_ms,
          posicao: payload.posicao,
          melhor: payload.melhor,
          valida: payload.valida,
        };
        await updateVolta(editingVolta.id, updatePayload);
        toast.success('Volta atualizada com sucesso.');
      } else {
        await createVolta(payload);
        toast.success('Volta criada com sucesso.');
      }
      setVoltaModalOpen(false);
      await loadVoltas();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const handleImport = async () => {
    if (!canWrite || snapshot.status !== 'online') return;
    if (importMode === 'existente' && !importSessaoId) {
      setFormErrors({ sessao_id: 'Selecione uma sessão.' });
      return;
    }
    if (importMode === 'nova') {
      const errors = validateSessao(importSessaoForm);
      setFormErrors(errors);
      if (Object.keys(errors).length) return;
    }

    setSubmitting(true);
    try {
      let targetId = importSessaoId;
      if (importMode === 'nova') {
        const created = await createSessao(sessionPayload(importSessaoForm));
        targetId = created.id;
      }
      const count = await importarSnapshot(targetId, snapshot);
      setSelectedSessaoId(targetId);
      setImportModalOpen(false);
      toast.success(`${numberFormatter.format(count)} pilotos importados para a sessão.`);
      await Promise.all([loadData(), loadSessoesTab()]);
      await listVoltas(targetId).then(setVoltas);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget || !canWrite) return;
    setDeleting(true);
    try {
      if (deleteTarget.kind === 'sessao') {
        await removeSessao(deleteTarget.item.id);
        toast.success('Sessão excluída com sucesso.');
        await Promise.all([loadData(), loadSessoesTab()]);
      } else {
        await removeVolta(deleteTarget.item.id);
        toast.success('Volta excluída com sucesso.');
        await loadVoltas();
      }
      setDeleteTarget(null);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
    } finally {
      setDeleting(false);
    }
  };

  const handleEncerrar = async (sessao: SessaoWithCampeonato) => {
    if (!canWrite || sessao.status === 'encerrada') return;
    try {
      await updateSessao(sessao.id, { status: 'encerrada' });
      toast.success('Sessão encerrada.');
      await Promise.all([loadData(), loadSessoesTab()]);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleGerarResultados = async (sessao: SessaoWithCampeonato) => {
    if (!canWrite) return;
    setGeneratingId(sessao.id);
    try {
      const corridaId = await gerarResultados(sessao.id);
      const link = `/admin/resultados?corrida=${encodeURIComponent(corridaId)}`;
      setGeneratedLink(link);
      toast.success(`Resultados gerados em ${link}`);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
    } finally {
      setGeneratingId(null);
    }
  };

  const openVoltas = (sessao: SessaoWithCampeonato) => {
    setSelectedSessaoId(sessao.id);
    setActiveTab('voltas');
  };

  const handleSessaoCampeonato = (campeonatoId: string) => {
    setSessaoForm((current) => ({
      ...current,
      campeonato_id: campeonatoId,
      etapa_id: etapas.find((etapa) => etapa.campeonato_id === campeonatoId)?.id ?? '',
    }));
  };

  const handleImportCampeonato = (campeonatoId: string) => {
    setImportSessaoForm((current) => ({
      ...current,
      campeonato_id: campeonatoId,
      etapa_id: etapas.find((etapa) => etapa.campeonato_id === campeonatoId)?.id ?? '',
    }));
  };

  const handlePiloto = (pilotoId: string) => {
    const piloto = pilotos.find((item) => item.id === pilotoId);
    setVoltaForm((current) => ({
      ...current,
      piloto_id: pilotoId,
      piloto_nome: piloto?.nome ?? '',
      kart: piloto?.numero ?? current.kart,
    }));
  };

  const sessaoColumns: readonly DataTableColumn<SessaoWithCampeonato>[] = [
      {
        key: 'nome',
        label: 'Sessão',
        render: (sessao) => (
          <button
            className="font-medium text-zinc-100 underline-offset-4 hover:text-brand-300 hover:underline"
            onClick={() => openVoltas(sessao)}
            type="button"
          >
            {sessao.nome}
          </button>
        ),
      },
      {
        key: 'tipo',
        label: 'Tipo',
        render: (sessao) => <Badge variant={tipoVariant[sessao.tipo]}>{tipoLabel[sessao.tipo]}</Badge>,
      },
      { key: 'data', label: 'Data', render: (sessao) => dateFormatter.format(new Date(sessao.data)) },
      { key: 'status', label: 'Status', render: (sessao) => <StatusBadge status={sessao.status} /> },
      {
        key: 'campeonato_id',
        label: 'Campeonato',
        render: (sessao) => sessao.campeonatos?.nome ?? 'Não vinculado',
      },
      {
        key: 'id',
        label: 'Operações',
        render: (sessao) =>
          canWrite ? (
            <div className="flex items-center gap-2">
              <Button
                className="h-8 px-2.5 text-xs"
                loading={generatingId === sessao.id}
                onClick={() => void handleGerarResultados(sessao)}
                variant="secondary"
              >
                <Trophy aria-hidden="true" size={14} />
                Gerar resultados
              </Button>
              <Button
                className="h-8 px-2.5 text-xs"
                disabled={sessao.status === 'encerrada'}
                onClick={() => void handleEncerrar(sessao)}
                variant="ghost"
              >
                <Lock aria-hidden="true" size={14} />
                Encerrar
              </Button>
            </div>
          ) : (
            '—'
          ),
      },
    ];

  const voltaColumns: readonly DataTableColumn<Volta>[] = [
      { key: 'posicao', label: 'Pos.' },
      { key: 'piloto_nome', label: 'Piloto' },
      { key: 'kart', label: 'Kart' },
      {
        key: 'tempo_ms',
        label: 'Tempo',
        render: (volta) => (
          <span className={volta.melhor ? 'font-semibold text-brand-300' : undefined}>
            {msParaTexto(volta.tempo_ms)}
          </span>
        ),
      },
      { key: 'setor1_ms', label: 'Setor 1', render: (volta) => msParaTexto(volta.setor1_ms) },
      { key: 'setor2_ms', label: 'Setor 2', render: (volta) => msParaTexto(volta.setor2_ms) },
      { key: 'setor3_ms', label: 'Setor 3', render: (volta) => msParaTexto(volta.setor3_ms) },
      {
        key: 'valida',
        label: 'Válida',
        render: (volta) => (
          <Badge variant={volta.valida ? 'emerald' : 'red'}>{volta.valida ? 'Sim' : 'Não'}</Badge>
        ),
      },
    ];

  const fastestLive = snapshot.pilotos.reduce<number | undefined>(
    (fastest, piloto) =>
      piloto.melhorVoltaMs !== undefined &&
      (fastest === undefined || piloto.melhorVoltaMs < fastest)
        ? piloto.melhorVoltaMs
        : fastest,
    undefined,
  );

  const liveRows = useMemo<LiveTableRow[]>(() => {
    if (!projectionMode) {
      return snapshot.pilotos.map((piloto) => ({ piloto, posicao: piloto.posicao, voltasProjetadas: null }));
    }

    const lapTimes = snapshot.pilotos
      .map((piloto) => piloto.melhorVoltaMs)
      .filter((time): time is number => time !== undefined && time > 0)
      .sort((left, right) => left - right);
    const ritmoMedianoMs = lapTimes.length ? lapTimes[Math.floor(lapTimes.length / 2)] : 66_000;

    return snapshot.pilotos
      .map((piloto) => {
        const paradasFaltantes = piloto.paradas?.faltam ?? 0;
        const voltaAtual = piloto.paradas?.voltaAtual;
        return {
          piloto,
          posicao: 0,
          voltasProjetadas:
            voltaAtual !== null && voltaAtual !== undefined
              ? voltaAtual - (paradasFaltantes * MANDATORY_STOP_MS) / ritmoMedianoMs
              : null,
        };
      })
      .sort(
        (left, right) =>
          (right.voltasProjetadas ?? Number.MIN_SAFE_INTEGER) - (left.voltasProjetadas ?? Number.MIN_SAFE_INTEGER) ||
          left.piloto.posicao - right.piloto.posicao,
      )
      .map((row, index) => ({ ...row, posicao: index + 1 }));
  }, [projectionMode, snapshot.pilotos]);

  const headerAction =
    activeTab === 'sessoes'
      ? { label: 'Nova sessão', action: openCreateSessao }
      : activeTab === 'voltas' && selectedSessaoId
        ? { label: 'Nova volta', action: openCreateVolta }
        : null;

  return (
    <section className="space-y-6">
      <PageHeader
        actionLabel={canWrite ? headerAction?.label : undefined}
        eyebrow="Competição"
        onAction={canWrite ? headerAction?.action : undefined}
        subtitle="Sessões, voltas, timing ao vivo e publicação integrada de resultados."
        title="Cronometragem"
      />

      <Tabs
        items={[
          { key: 'ao-vivo', label: 'Ao Vivo' },
          { key: 'historico', label: 'Histórico real (LapTime)' },
          { key: 'sessoes', label: 'Sessões' },
          { key: 'voltas', label: 'Voltas' },
        ]}
        onChange={(key) => setActiveTab(key as TabKey)}
        value={activeTab}
      />

      {generatedLink ? (
        <Card className="flex flex-wrap items-center justify-between gap-3 border-brand-500/30 p-4">
          <p className="text-sm text-zinc-300">Resultados publicados e classificação recalculada.</p>
          <a className="text-sm font-medium text-brand-400 hover:text-brand-300" href={generatedLink}>
            Abrir resultados
          </a>
        </Card>
      ) : null}

      {activeTab === 'ao-vivo' ? (
        <div className="space-y-5">
          <Card className="p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
              <FormField htmlFor="live-url" label="URL do snapshot">
                <input
                  className={inputClassName}
                  id="live-url"
                  onChange={(event) => setLiveUrl(event.target.value)}
                  placeholder={DEFAULT_LIVE_URL}
                  type="url"
                  value={liveUrl}
                />
              </FormField>
              <div className="flex shrink-0 gap-2">
                <Button
                  disabled={!liveUrl.trim()}
                  onClick={() => {
                    if (connected) {
                      setConnected(false);
                      setSnapshot((current) => ({ ...current, status: 'pausado' }));
                    } else {
                      setConnected(true);
                    }
                  }}
                  variant={connected ? 'secondary' : 'primary'}
                >
                  {connected ? <Pause aria-hidden="true" size={16} /> : <Play aria-hidden="true" size={16} />}
                  {connected ? 'Pausar' : 'Conectar'}
                </Button>
                {paradasHabilitadas ? (
                  <Button
                    onClick={() => setProjectionMode((current) => !current)}
                    variant={projectionMode ? 'primary' : 'ghost'}
                  >
                    <TrendingUp aria-hidden="true" size={16} />
                    PROJEÇÃO FUTURA
                  </Button>
                ) : null}
                {canWrite ? (
                  <Button
                    disabled={snapshot.status !== 'online' || snapshot.pilotos.length === 0}
                    onClick={openImportModal}
                    variant="ghost"
                  >
                    <Download aria-hidden="true" size={16} />
                    Importar p/ sessão
                  </Button>
                ) : null}
              </div>
            </div>
          </Card>

          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard
              icon={Radio}
              label="Conexão"
              loading={liveLoading && !snapshot.atualizadoEm}
              sub={snapshot.atualizadoEm ? `Atualizado ${dateFormatter.format(new Date(snapshot.atualizadoEm))}` : 'Aguardando conexão'}
              value={snapshot.status === 'online' ? 'Online' : snapshot.status === 'offline' ? 'Offline' : 'Pausado'}
            />
            <StatCard
              icon={Users}
              label="Pilotos"
              value={numberFormatter.format(snapshot.pilotos.length)}
            />
            <StatCard
              icon={Timer}
              label="Melhor volta"
              value={msParaTexto(fastestLive)}
            />
          </div>

          {snapshot.corrida ? (
            <Card aria-live="polite" className="border-brand-500/30 p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-300">Sessão atual</p>
                  <h2 className="mt-1 text-xl font-bold text-zinc-50">{snapshot.corrida.nome}</h2>
                  <p className="mt-1 text-sm text-zinc-400">
                    {snapshot.corrida.tipo ?? 'Timing LapTime'} · ID {snapshot.corrida.id}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-zinc-300">
                  {paradasHabilitadas && snapshot.corrida.regras ? (
                    <>
                      <Badge variant="emerald">
                        {snapshot.corrida.regras.paradasObrigatorias} paradas de{' '}
                        {msParaTexto(snapshot.corrida.regras.minimoParadaMs)}
                      </Badge>
                      <Badge variant="blue">
                        Boxes: {msParaTexto(snapshot.corrida.regras.boxesAbremAposMs)} -{' '}
                        {msParaTexto(snapshot.corrida.regras.boxesFechamAposMs)} de prova
                      </Badge>
                    </>
                  ) : (
                    <Badge variant="zinc">Corrida sem parada obrigatória · {formatoAovivo.formato.nome}</Badge>
                  )}
                </div>
              </div>
              {divergenciaRegras ? (
                <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-800/50 bg-amber-950/20 p-3 text-xs text-amber-200" role="alert">
                  <AlertTriangle aria-hidden="true" className="mt-0.5 shrink-0" size={14} />
                  <span>
                    <strong>Divergência de regulamento</strong> entre o formato configurado e a cronometragem: {divergenciaRegras}.
                  </span>
                </div>
              ) : null}
            </Card>
          ) : null}

          {projectionMode && paradasHabilitadas ? (
            <Card aria-live="polite" className="border-blue-500/30 bg-blue-500/5 p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-bold text-blue-200">PROJEÇÃO FUTURA</p>
                  <p className="mt-1 text-xs text-zinc-300">
                    Simulação com todos os karts completando as paradas obrigatórias do regulamento ({regrasAovivo?.requiredStops}× {msParaTexto(regrasAovivo?.minimumStopMs)}).
                  </p>
                </div>
                <Badge variant="blue">Classificação simulada</Badge>
              </div>
            </Card>
          ) : null}

          {snapshot.status === 'offline' ? (
            <Card className="flex min-h-56 flex-col items-center justify-center border-amber-900/50 p-8 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10 text-amber-300">
                <WifiOff aria-hidden="true" size={23} />
              </span>
              <h2 className="mt-4 text-base font-semibold text-zinc-100">LiveTime offline</h2>
              <p className="mt-1 max-w-lg text-sm text-zinc-400">
                {snapshot.erro ?? 'Não foi possível acessar o endpoint. O polling continuará tentando.'}
              </p>
            </Card>
          ) : (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-[1280px] text-left">
                  <thead className="border-b border-zinc-800">
                    <tr>
                      {[projectionMode ? 'Pos. futura' : 'Pos', 'Piloto', 'Kart', 'Melhor volta', 'Última', 'Voltas', 'Gap'].map((label) => (
                        <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-zinc-500" key={label}>
                          {label}
                        </th>
                      ))}
                      {projectionMode ? (
                        <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-zinc-500">Voltas projetadas</th>
                      ) : null}
                      {paradasHabilitadas ? (
                        <>
                          <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-zinc-500">Paradas &gt;= {msParaTexto(regrasAovivo?.minimumStopMs)}</th>
                          <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-zinc-500">Faltam obrigatórias</th>
                          <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-zinc-500">Curtas</th>
                          <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-zinc-500">Total</th>
                          <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-zinc-500">Punição</th>
                        </>
                      ) : null}
                    </tr>
                  </thead>
                  <tbody>
                    {liveRows.map(({ piloto, posicao, voltasProjetadas }) => (
                      <tr
                        className={
                          posicao === 1
                            ? 'border-b border-brand-500/20 bg-brand-500/10'
                            : 'border-b border-zinc-800/60 last:border-0'
                        }
                        key={`${piloto.posicao}-${piloto.nome}-${piloto.kart ?? ''}`}
                      >
                        <td className="px-4 py-3 text-sm font-semibold text-zinc-100">{posicao}</td>
                        <td className="px-4 py-3 text-sm text-zinc-200">{piloto.nome}</td>
                        <td className="px-4 py-3 text-sm text-zinc-300">{piloto.kart ?? '—'}</td>
                        <td className="px-4 py-3 text-sm font-medium text-brand-300">
                          {piloto.melhorVoltaMs !== undefined
                            ? msParaTexto(piloto.melhorVoltaMs)
                            : (piloto.melhorVoltaTexto ?? '—')}
                        </td>
                        <td className="px-4 py-3 text-sm text-zinc-300">{piloto.ultimaVolta ?? '—'}</td>
                        <td className="px-4 py-3 text-sm text-zinc-300">{piloto.voltas ?? piloto.paradas?.voltaAtual ?? '—'}</td>
                        <td className="px-4 py-3 text-sm text-zinc-400">{piloto.gap ?? (posicao === 1 ? 'Líder' : '—')}</td>
                        {projectionMode ? (
                          <td className="px-4 py-3 text-sm font-semibold text-blue-200">
                            {voltasProjetadas !== null ? `${voltasProjetadas.toFixed(1)} v` : '—'}
                          </td>
                        ) : null}
                        {paradasHabilitadas ? (
                          <>
                            <td className="px-4 py-3 text-sm text-zinc-200">
                              <button
                                aria-label={`Ver paradas do kart ${piloto.kart ?? piloto.nome}`}
                                className="inline-flex items-center gap-2 rounded-md px-2 py-1 font-semibold text-brand-300 transition-colors hover:bg-brand-500/10 hover:text-brand-200 disabled:cursor-not-allowed disabled:text-zinc-600"
                                disabled={!piloto.paradas}
                                onClick={() => setSelectedPitPiloto(piloto)}
                                title="Ver paradas por volta e tempo de prova"
                                type="button"
                              >
                                <List aria-hidden="true" size={15} />
                                {piloto.paradas?.validas ?? '—'}
                              </button>
                            </td>
                            <td className="px-4 py-3 text-sm font-semibold text-amber-300">{piloto.paradas?.faltam ?? '—'}</td>
                            <td className="px-4 py-3 text-sm text-amber-300">{piloto.paradas?.curtas ?? '—'}</td>
                            <td className="px-4 py-3 text-sm text-zinc-300">{piloto.paradas?.total ?? '—'}</td>
                            <td className="px-4 py-3 text-sm">
                              {piloto.paradas ? (
                                <span className={piloto.paradas.penalidadeVoltas > 0 ? 'font-semibold text-red-300' : 'text-emerald-300'}>
                                  {piloto.paradas.penalidadeVoltas > 0 ? `+${piloto.paradas.penalidadeVoltas} voltas` : 'Nenhuma'}
                                </span>
                              ) : (
                                '—'
                              )}
                            </td>
                          </>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!snapshot.pilotos.length ? (
                <div className="flex min-h-48 flex-col items-center justify-center p-8 text-center">
                  <Activity aria-hidden="true" className="text-zinc-600" size={28} />
                  <p className="mt-3 text-sm text-zinc-400">Aguardando dados do timing em tempo real.</p>
                </div>
              ) : null}
            </Card>
          )}
        </div>
      ) : null}

      {activeTab === 'historico' ? (
        <div className="space-y-5">
          <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
            <input
              className={`${inputClassName} sm:max-w-xs`}
              onChange={(event) => setHistoricoSearchInput(event.target.value)}
              placeholder="Buscar por nome da corrida..."
              value={historicoSearchInput}
            />
            <input
              className={`${inputClassName} sm:max-w-[180px]`}
              onChange={(event) =>
                setHistoricoFilters((current) => ({ ...current, from: event.target.value || undefined }))
              }
              type="date"
              value={historicoFilters.from ?? ''}
            />
            <input
              className={`${inputClassName} sm:max-w-[180px]`}
              onChange={(event) =>
                setHistoricoFilters((current) => ({ ...current, to: event.target.value || undefined }))
              }
              type="date"
              value={historicoFilters.to ?? ''}
            />
          </Card>
          <DataTable
            columns={historicoColumns}
            emptyLabel="Nenhuma corrida encontrada."
            error={historicoError}
            loading={historicoLoading}
            onRetry={() => void loadHistorico()}
            rows={historico}
          />
          <Pagination onPageChange={setHistoricoPage} page={historicoPage} pageSize={PAGE_SIZE} total={historicoTotal} />

          <div className="border-t border-zinc-800 pt-6">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-300">Resultado da corrida</p>
            <h2 className="mt-2 text-xl font-black text-white">{selectedHistorico?.nome ?? 'Selecione uma corrida'}</h2>
            <div className="mt-4">
              <DataTable
                columns={historicoCompetitorColumns}
                emptyLabel={selectedHistorico ? 'Nenhum participante registrado.' : 'Selecione uma corrida na tabela acima.'}
                error={historicoCompetitorsError}
                loading={historicoCompetitorsLoading}
                onRetry={() => void loadHistoricoCompetitors()}
                rows={historicoCompetitors}
              />
            </div>
          </div>
        </div>
      ) : null}

      {activeTab === 'sessoes' ? (
        <div className="space-y-4">
          <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
            <input
              className={`${inputClassName} sm:max-w-xs`}
              onChange={(event) => setSessoesSearchInput(event.target.value)}
              placeholder="Buscar por nome..."
              value={sessoesSearchInput}
            />
            <select
              className={`${inputClassName} sm:max-w-[180px]`}
              onChange={(event) => updateSessoesTipoFilter(event.target.value as SessaoTipo | '')}
              value={sessoesFilters.tipo ?? ''}
            >
              <option value="">Todos os tipos</option>
              <option value="treino">Treino</option>
              <option value="classificacao">Classificação</option>
              <option value="corrida">Corrida</option>
            </select>
            <select
              className={`${inputClassName} sm:max-w-[180px]`}
              onChange={(event) => updateSessoesStatusFilter(event.target.value as SessaoStatus | '')}
              value={sessoesFilters.status ?? ''}
            >
              <option value="">Todos os status</option>
              <option value="aberta">Aberta</option>
              <option value="encerrada">Encerrada</option>
            </select>
          </Card>
          <DataTable
            columns={sessaoColumns}
            emptyLabel="Nenhuma sessão encontrada."
            error={sessoesTabError}
            loading={sessoesTabLoading}
            onDelete={canWrite ? (sessao) => setDeleteTarget({ kind: 'sessao', item: sessao }) : undefined}
            onEdit={canWrite ? openEditSessao : undefined}
            onRetry={() => void loadSessoesTab()}
            rows={sessoesRows}
          />
          <Pagination onPageChange={setSessoesPage} page={sessoesPage} pageSize={PAGE_SIZE} total={sessoesTotal} />
        </div>
      ) : null}

      {activeTab === 'voltas' ? (
        <div className="space-y-5">
          <Card className="p-5">
            <FormField htmlFor="voltas-sessao" label="Sessão selecionada">
              <select
                className={inputClassName}
                id="voltas-sessao"
                onChange={(event) => setSelectedSessaoId(event.target.value)}
                value={selectedSessaoId}
              >
                <option value="">Selecione uma sessão</option>
                {sessoes.map((sessao) => (
                  <option key={sessao.id} value={sessao.id}>
                    {sessao.nome} · {dateFormatter.format(new Date(sessao.data))}
                  </option>
                ))}
              </select>
            </FormField>
            {selectedSessao ? (
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                <StatusBadge status={selectedSessao.status} />
                <span>{selectedSessao.campeonatos?.nome ?? 'Sem campeonato'}</span>
              </div>
            ) : null}
          </Card>
          <DataTable
            columns={voltaColumns}
            emptyLabel={selectedSessaoId ? 'Nenhuma volta registrada.' : 'Selecione uma sessão.'}
            error={voltasError}
            loading={voltasLoading}
            onDelete={canWrite ? (volta) => setDeleteTarget({ kind: 'volta', item: volta }) : undefined}
            onEdit={canWrite ? openEditVolta : undefined}
            onRetry={() => void loadVoltas()}
            rows={voltas}
          />
        </div>
      ) : null}

      <Modal
        footer={<Button onClick={() => setSelectedPitPiloto(null)} variant="ghost">Fechar</Button>}
        isOpen={Boolean(selectedPitPiloto)}
        onClose={() => setSelectedPitPiloto(null)}
        title={selectedPitPiloto ? `Paradas do kart ${selectedPitPiloto.kart ?? '—'}` : 'Paradas do kart'}
      >
        {selectedPitPiloto && selectedPitPiloto.paradas ? (
          <div className="space-y-5">
            <div>
              <p className="text-sm font-semibold text-zinc-100">{selectedPitPiloto.nome}</p>
              <p className="mt-1 text-xs text-zinc-400">
                {snapshot.corrida?.nome ?? 'Sessão atual'} · parada registrada por passagem na cronometragem
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
                <p className="text-xs text-zinc-400">Obrigatórias válidas</p>
                <p className="mt-1 text-xl font-bold text-emerald-300">{selectedPitPiloto.paradas.validas}/{regrasAovivo?.requiredStops ?? 11}</p>
              </div>
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
                <p className="text-xs text-zinc-400">Faltam obrigatórias</p>
                <p className="mt-1 text-xl font-bold text-amber-300">{selectedPitPiloto.paradas.faltam}</p>
              </div>
              <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3">
                <p className="text-xs text-zinc-400">Punição calculada</p>
                <p className="mt-1 text-xl font-bold text-red-300">+{selectedPitPiloto.paradas.penalidadeVoltas} voltas</p>
              </div>
            </div>

            <div className="overflow-x-auto rounded-lg border border-zinc-800">
              <table className="min-w-[640px] w-full text-left">
                <thead className="border-b border-zinc-800 bg-zinc-950/40">
                  <tr>
                    {['Volta', 'Tempo da parada', 'Tempo de prova', 'Posição', 'Classificação'].map((label) => (
                      <th className="px-3 py-3 text-xs font-medium uppercase tracking-wider text-zinc-500" key={label}>
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {selectedPitPiloto.paradas.paradas.map((parada) => (
                    <tr className="border-b border-zinc-800/60 last:border-0" key={parada.id}>
                      <td className="px-3 py-3 text-sm font-semibold text-zinc-100">{parada.volta ?? '—'}</td>
                      <td className="px-3 py-3 text-sm text-zinc-200">{parada.tempoParada ?? '—'}</td>
                      <td className="px-3 py-3 text-sm text-zinc-300">{parada.tempoCorrida ?? '—'}</td>
                      <td className="px-3 py-3 text-sm text-zinc-400">{parada.posicao ?? '—'}</td>
                      <td className="px-3 py-3 text-sm">
                        <Badge variant={pitStopStatusVariant[parada.status]}>
                          {parada.status === 'mandatory' && parada.numeroObrigatoria
                            ? `Obrigatória ${parada.numeroObrigatoria}`
                            : pitStopStatusLabel[parada.status]}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-zinc-400">
              <span>Paradas de 4:00-6:59: {selectedPitPiloto.paradas.curtas}</span>
              <span>Total registrado: {selectedPitPiloto.paradas.total}</span>
              <span>Excedentes acima de 15: {selectedPitPiloto.paradas.excedentes}</span>
              {selectedPitPiloto.paradas.foraJanela > 0 ? (
                <span className="text-red-300">Fora da janela dos boxes: {selectedPitPiloto.paradas.foraJanela}</span>
              ) : null}
            </div>
          </div>
        ) : (
          <p className="text-sm text-zinc-400">Nenhuma parada foi recebida para este kart.</p>
        )}
      </Modal>

      <Modal
        footer={
          <>
            <Button disabled={submitting} onClick={() => setSessaoModalOpen(false)} variant="ghost">
              Cancelar
            </Button>
            <Button form="sessao-form" loading={submitting} type="submit">
              Salvar sessão
            </Button>
          </>
        }
        isOpen={sessaoModalOpen}
        onClose={submitting ? () => undefined : () => setSessaoModalOpen(false)}
        title={editingSessao ? 'Editar sessão' : 'Nova sessão'}
      >
        <form className="grid gap-4 sm:grid-cols-2" id="sessao-form" onSubmit={(event) => void handleSessaoSubmit(event)}>
          <div className="sm:col-span-2">
            <FormField error={formErrors.nome} htmlFor="sessao-nome" label="Nome">
              <input className={inputClassName} id="sessao-nome" onChange={(event) => setSessaoForm((current) => ({ ...current, nome: event.target.value }))} value={sessaoForm.nome} />
            </FormField>
          </div>
          <FormField error={formErrors.campeonato_id} htmlFor="sessao-campeonato" label="Campeonato">
            <select className={inputClassName} id="sessao-campeonato" onChange={(event) => handleSessaoCampeonato(event.target.value)} value={sessaoForm.campeonato_id}>
              <option value="">Selecione</option>
              {campeonatos.map((campeonato) => <option key={campeonato.id} value={campeonato.id}>{campeonato.nome}</option>)}
            </select>
          </FormField>
          <FormField error={formErrors.etapa_id} htmlFor="sessao-etapa" label="Etapa">
            <select className={inputClassName} id="sessao-etapa" onChange={(event) => setSessaoForm((current) => ({ ...current, etapa_id: event.target.value }))} value={sessaoForm.etapa_id}>
              <option value="">Selecione</option>
              {etapasDaSessao.map((etapa) => <option key={etapa.id} value={etapa.id}>{etapa.nome}</option>)}
            </select>
          </FormField>
          <FormField htmlFor="sessao-tipo" label="Tipo">
            <select className={inputClassName} id="sessao-tipo" onChange={(event) => setSessaoForm((current) => ({ ...current, tipo: event.target.value as SessaoTipo }))} value={sessaoForm.tipo}>
              <option value="treino">Treino</option><option value="classificacao">Classificação</option><option value="corrida">Corrida</option>
            </select>
          </FormField>
          <FormField error={formErrors.data} htmlFor="sessao-data" label="Data e hora">
            <input className={inputClassName} id="sessao-data" onChange={(event) => setSessaoForm((current) => ({ ...current, data: event.target.value }))} type="datetime-local" value={sessaoForm.data} />
          </FormField>
          <FormField htmlFor="sessao-status" label="Status">
            <select className={inputClassName} id="sessao-status" onChange={(event) => setSessaoForm((current) => ({ ...current, status: event.target.value as SessaoFormState['status'] }))} value={sessaoForm.status}>
              <option value="aberta">Aberta</option><option value="encerrada">Encerrada</option>
            </select>
          </FormField>
          <FormField htmlFor="sessao-fonte" label="Fonte">
            <input className={inputClassName} id="sessao-fonte" onChange={(event) => setSessaoForm((current) => ({ ...current, fonte: event.target.value }))} value={sessaoForm.fonte} />
          </FormField>
          <FormField hint="Deixe em branco para herdar do campeonato." htmlFor="sessao-formato" label="Formato (override da sessão)">
            <select className={inputClassName} id="sessao-formato" onChange={(event) => setSessaoForm((current) => ({ ...current, formato_id: event.target.value }))} value={sessaoForm.formato_id}>
              <option value="">Herdar do campeonato</option>
              {formatos.map((formato) => <option key={formato.id} value={formato.id}>{formato.nome}</option>)}
            </select>
          </FormField>
        </form>
      </Modal>

      <Modal
        footer={
          <>
            <Button disabled={submitting} onClick={() => setVoltaModalOpen(false)} variant="ghost">Cancelar</Button>
            <Button form="volta-form" loading={submitting} type="submit">Salvar volta</Button>
          </>
        }
        isOpen={voltaModalOpen}
        onClose={submitting ? () => undefined : () => setVoltaModalOpen(false)}
        title={editingVolta ? 'Editar volta' : 'Nova volta'}
      >
        <form className="grid gap-4 sm:grid-cols-2" id="volta-form" onSubmit={(event) => void handleVoltaSubmit(event)}>
          <div className="sm:col-span-2">
            <FormField error={formErrors.piloto_id} htmlFor="volta-piloto" label="Piloto">
              <select className={inputClassName} id="volta-piloto" onChange={(event) => handlePiloto(event.target.value)} value={voltaForm.piloto_id}>
                <option value="">Selecione</option>
                {pilotos.map((piloto) => <option key={piloto.id} value={piloto.id}>{piloto.nome}{piloto.equipe ? ` · ${piloto.equipe}` : ''}</option>)}
              </select>
            </FormField>
          </div>
          <FormField htmlFor="volta-kart" label="Kart">
            <input className={inputClassName} id="volta-kart" onChange={(event) => setVoltaForm((current) => ({ ...current, kart: event.target.value }))} value={voltaForm.kart} />
          </FormField>
          <FormField error={formErrors.numero} htmlFor="volta-numero" label="Número da volta">
            <input className={inputClassName} id="volta-numero" min="1" onChange={(event) => setVoltaForm((current) => ({ ...current, numero: event.target.value }))} type="number" value={voltaForm.numero} />
          </FormField>
          <FormField error={formErrors.tempo} htmlFor="volta-tempo" label="Tempo (m:ss.mmm)">
            <input className={inputClassName} id="volta-tempo" onChange={(event) => setVoltaForm((current) => ({ ...current, tempo: event.target.value }))} placeholder="1:02.345" value={voltaForm.tempo} />
          </FormField>
          <FormField error={formErrors.posicao} htmlFor="volta-posicao" label="Posição">
            <input className={inputClassName} id="volta-posicao" min="1" onChange={(event) => setVoltaForm((current) => ({ ...current, posicao: event.target.value }))} type="number" value={voltaForm.posicao} />
          </FormField>
          {(['setor1', 'setor2', 'setor3'] as const).map((field, index) => (
            <FormField htmlFor={`volta-${field}`} key={field} label={`Setor ${index + 1}`}>
              <input className={inputClassName} id={`volta-${field}`} onChange={(event) => setVoltaForm((current) => ({ ...current, [field]: event.target.value }))} placeholder="0:20.123" value={voltaForm[field]} />
            </FormField>
          ))}
          <div className="flex items-center gap-6 pt-6">
            <label className="flex items-center gap-2 text-sm text-zinc-300"><input checked={voltaForm.melhor} className={checkboxClassName} onChange={(event) => setVoltaForm((current) => ({ ...current, melhor: event.target.checked }))} type="checkbox" />Melhor</label>
            <label className="flex items-center gap-2 text-sm text-zinc-300"><input checked={voltaForm.valida} className={checkboxClassName} onChange={(event) => setVoltaForm((current) => ({ ...current, valida: event.target.checked }))} type="checkbox" />Válida</label>
          </div>
        </form>
      </Modal>

      <Modal
        footer={
          <>
            <Button disabled={submitting} onClick={() => setImportModalOpen(false)} variant="ghost">Cancelar</Button>
            <Button loading={submitting} onClick={() => void handleImport()}><Download aria-hidden="true" size={16} />Importar snapshot</Button>
          </>
        }
        isOpen={importModalOpen}
        onClose={submitting ? () => undefined : () => setImportModalOpen(false)}
        title="Importar timing para sessão"
      >
        <div className="space-y-4">
          <FormField htmlFor="import-mode" label="Destino">
            <select className={inputClassName} id="import-mode" onChange={(event) => setImportMode(event.target.value as 'existente' | 'nova')} value={importMode}>
              <option value="existente">Sessão existente</option><option value="nova">Criar nova sessão</option>
            </select>
          </FormField>
          {importMode === 'existente' ? (
            <FormField error={formErrors.sessao_id} htmlFor="import-sessao" label="Sessão">
              <select className={inputClassName} id="import-sessao" onChange={(event) => setImportSessaoId(event.target.value)} value={importSessaoId}>
                <option value="">Selecione</option>{sessoes.map((sessao) => <option key={sessao.id} value={sessao.id}>{sessao.nome}</option>)}
              </select>
            </FormField>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2"><FormField error={formErrors.nome} htmlFor="import-nome" label="Nome"><input className={inputClassName} id="import-nome" onChange={(event) => setImportSessaoForm((current) => ({ ...current, nome: event.target.value }))} value={importSessaoForm.nome} /></FormField></div>
              <FormField error={formErrors.campeonato_id} htmlFor="import-campeonato" label="Campeonato"><select className={inputClassName} id="import-campeonato" onChange={(event) => handleImportCampeonato(event.target.value)} value={importSessaoForm.campeonato_id}><option value="">Selecione</option>{campeonatos.map((campeonato) => <option key={campeonato.id} value={campeonato.id}>{campeonato.nome}</option>)}</select></FormField>
              <FormField error={formErrors.etapa_id} htmlFor="import-etapa" label="Etapa"><select className={inputClassName} id="import-etapa" onChange={(event) => setImportSessaoForm((current) => ({ ...current, etapa_id: event.target.value }))} value={importSessaoForm.etapa_id}><option value="">Selecione</option>{etapasDaImportacao.map((etapa) => <option key={etapa.id} value={etapa.id}>{etapa.nome}</option>)}</select></FormField>
              <FormField htmlFor="import-tipo" label="Tipo"><select className={inputClassName} id="import-tipo" onChange={(event) => setImportSessaoForm((current) => ({ ...current, tipo: event.target.value as SessaoTipo }))} value={importSessaoForm.tipo}><option value="treino">Treino</option><option value="classificacao">Classificação</option><option value="corrida">Corrida</option></select></FormField>
              <FormField error={formErrors.data} htmlFor="import-data" label="Data e hora"><input className={inputClassName} id="import-data" onChange={(event) => setImportSessaoForm((current) => ({ ...current, data: event.target.value }))} type="datetime-local" value={importSessaoForm.data} /></FormField>
              <FormField hint="Deixe em branco para herdar do campeonato." htmlFor="import-formato" label="Formato"><select className={inputClassName} id="import-formato" onChange={(event) => setImportSessaoForm((current) => ({ ...current, formato_id: event.target.value }))} value={importSessaoForm.formato_id}><option value="">Herdar do campeonato</option>{formatos.map((formato) => <option key={formato.id} value={formato.id}>{formato.nome}</option>)}</select></FormField>
            </div>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        loading={deleting}
        message={
          deleteTarget?.kind === 'sessao'
            ? `A sessão ${deleteTarget.item.nome} e seus vínculos poderão ser removidos permanentemente.`
            : `A volta de ${deleteTarget?.item.piloto_nome ?? 'este piloto'} será removida permanentemente.`
        }
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void handleDelete()}
        title={deleteTarget?.kind === 'sessao' ? 'Excluir sessão' : 'Excluir volta'}
      />
    </section>
  );
};
