import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  Activity,
  Download,
  Lock,
  Pause,
  Play,
  Radio,
  Timer,
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
import {
  msParaTexto,
  type CampeonatoOption,
  type EtapaOption,
  type LiveSnapshot,
  type PilotoOption,
  type SessaoPayload,
  type SessaoStatus,
  type SessaoTipo,
  type SessaoWithCampeonato,
  type Volta,
  type VoltaPayload,
  type VoltaUpdate,
} from './cronometragem.types';

const PAGE_SIZE = 10;

type UnifiedItem = {
  id: string;
  nome: string;
  tipo: string | null;
  dataHora: string;
  source: 'laptime' | 'manual';
  participantes?: number;
  finalizada?: boolean;
  status?: SessaoStatus;
};

type SessaoFormState = {
  nome: string;
  campeonato_id: string;
  etapa_id: string;
  tipo: SessaoTipo;
  data: string;
  status: 'aberta' | 'encerrada';
  fonte: string;
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
  nome: '', campeonato_id: '', etapa_id: '', tipo: 'treino', data: '', status: 'aberta', fonte: 'manual',
};

const emptyVoltaForm: VoltaFormState = {
  piloto_id: '', piloto_nome: '', kart: '', numero: '1', tempo: '', setor1: '', setor2: '', setor3: '',
  posicao: '', melhor: false, valida: true,
};

const inputClassName =
  'w-full h-10 rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-brand-500/60 focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition';

const checkboxClassName =
  'h-4 w-4 rounded border-zinc-700 bg-zinc-950 text-brand-500 focus:ring-brand-500/30';

const dateFormatter = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

const formatDateSafe = (value: unknown): string => {
  if (!value) return '—';
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? '—' : dateFormatter.format(date);
};

const numberFormatter = new Intl.NumberFormat('pt-BR');

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
  if (!Number.isFinite(seconds) || !Number.isFinite(minutes) || seconds < 0 || minutes < 0) return null;
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
});

const tipoLabel: Record<SessaoTipo, string> = { treino: 'Treino', classificacao: 'Classificação', corrida: 'Corrida' };
const tipoVariant: Record<SessaoTipo, 'zinc' | 'blue' | 'emerald'> = { treino: 'zinc', classificacao: 'blue', corrida: 'emerald' };

const FONTE_LABELS: Record<string, string> = { laptime: 'LapTime', manual: 'Manual' };
const FONTE_COLORS: Record<string, string> = {
  laptime: 'border-emerald-700 bg-emerald-950 text-emerald-200',
  manual: 'border-zinc-600 bg-zinc-800 text-zinc-300',
};

export const CronometragemPage = () => {
  const { role } = useAuth();
  const toast = useToast();
  const canWrite =
    canAccess(role, 'cronometragem') && ['owner', 'admin', 'operador_telao'].includes(role);

  const [unifiedData, setUnifiedData] = useState<UnifiedItem[]>([]);
  const [unifiedTotal, setUnifiedTotal] = useState(0);
  const [unifiedPage, setUnifiedPage] = useState(0);
  const [unifiedLoading, setUnifiedLoading] = useState(true);
  const [unifiedError, setUnifiedError] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState('');
  const [sourceFilter, setSourceFilter] = useState<string>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [selectedSource, setSelectedSource] = useState<string | null>(null);

  const [lapTimeCompetitors, setLapTimeCompetitors] = useState<LapTimeRacingCompetitor[]>([]);
  const [lapTimeCompetitorsLoading, setLapTimeCompetitorsLoading] = useState(false);
  const [lapTimeCompetitorsError, setLapTimeCompetitorsError] = useState<string | null>(null);

  const [sessaoVoltas, setSessaoVoltas] = useState<Volta[]>([]);
  const [sessaoVoltasLoading, setSessaoVoltasLoading] = useState(false);
  const [sessaoVoltasError, setSessaoVoltasError] = useState<string | null>(null);

  const [liveUrl, setLiveUrl] = useState(() => {
    try { return localStorage.getItem(LIVE_URL_STORAGE_KEY) || DEFAULT_LIVE_URL; }
    catch { return DEFAULT_LIVE_URL; }
  });
  const [connected, setConnected] = useState(false);
  const [liveLoading, setLiveLoading] = useState(false);
  const [snapshot, setSnapshot] = useState<LiveSnapshot>({ status: 'pausado', pilotos: [] });
  const liveRequestInFlight = useRef(false);

  const [sessoes, setSessoes] = useState<SessaoWithCampeonato[]>([]);
  const [campeonatos, setCampeonatos] = useState<CampeonatoOption[]>([]);
  const [etapas, setEtapas] = useState<EtapaOption[]>([]);
  const [pilotos, setPilotos] = useState<PilotoOption[]>([]);
  const [selectedSessaoId, setSelectedSessaoId] = useState('');

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

  const loadUnifiedData = useCallback(async () => {
    setUnifiedLoading(true);
    setUnifiedError(null);
    try {
      const promises: Promise<{ rows: UnifiedItem[] }>[] = [];

      if (!sourceFilter || sourceFilter === 'laptime') {
        promises.push(
          listLapTimeRacingsPage(
            { q: searchInput || undefined, from: dateFrom || undefined, to: dateTo || undefined },
            0, 200,
          ).then((r) => ({
            rows: r.data.map((item) => ({
              id: `lt_${item.id}`, nome: item.nome, tipo: item.tipo, dataHora: item.dataHora,
              participantes: item.participantes, source: 'laptime' as const, finalizada: item.finalizada,
            })),
          })),
        );
      }

      if (!sourceFilter || sourceFilter === 'manual') {
        promises.push(
          listSessoesPage(
            { q: searchInput || undefined, status: undefined, tipo: undefined },
            0, 200,
          ).then((r) => ({
            rows: r.data.map((item) => ({
              id: `d1_${item.id}`, nome: item.nome, tipo: tipoLabel[item.tipo],
              dataHora: item.data, participantes: 0, source: 'manual' as const, status: item.status,
            })),
          })),
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

  useEffect(() => { void loadUnifiedData(); }, [loadUnifiedData]);

  useEffect(() => {
    const handle = setTimeout(() => setUnifiedPage(0), 350);
    return () => clearTimeout(handle);
  }, [searchInput, sourceFilter, dateFrom, dateTo]);

  const loadSessaoVoltas = useCallback(async () => {
    setSessaoVoltasLoading(true);
    setSessaoVoltasError(null);
    try {
      const prefix = selectedItemId?.split('_')[0];
      if (prefix === 'd1') {
        const sessaoId = selectedItemId!.slice(3);
        setSessaoVoltas(await listVoltas(sessaoId));
      } else {
        setSessaoVoltas([]);
      }
    } catch (error: unknown) {
      setSessaoVoltasError(getErrorMessage(error));
    } finally {
      setSessaoVoltasLoading(false);
    }
  }, [selectedItemId]);

  useEffect(() => { void loadSessaoVoltas(); }, [loadSessaoVoltas]);

  const loadLapTimeCompetitors = useCallback(async () => {
    if (!selectedItemId || selectedItemId.split('_')[0] !== 'lt') {
      setLapTimeCompetitors([]);
      return;
    }
    setLapTimeCompetitorsLoading(true);
    setLapTimeCompetitorsError(null);
    try {
      const racingId = selectedItemId.slice(3);
      setLapTimeCompetitors(await listLapTimeRacingCompetitors(racingId));
    } catch (error: unknown) {
      setLapTimeCompetitorsError(getErrorMessage(error));
    } finally {
      setLapTimeCompetitorsLoading(false);
    }
  }, [selectedItemId]);

  useEffect(() => { void loadLapTimeCompetitors(); }, [loadLapTimeCompetitors]);

  const loadData = useCallback(async () => {
    try {
      const [sessoesData, campeonatosData, etapasData, pilotosData] = await Promise.all([
        listSessoes(), listCampeonatos(), listEtapas(), listPilotos(),
      ]);
      setSessoes(sessoesData);
      setCampeonatos(campeonatosData);
      setEtapas(etapasData);
      setPilotos(pilotosData);
      setSelectedSessaoId((current) =>
        sessoesData.some((sessao) => sessao.id === current) ? current : (sessoesData[0]?.id ?? ''),
      );
      setImportSessaoId((current) =>
        sessoesData.some((sessao) => sessao.id === current) ? current : (sessoesData[0]?.id ?? ''),
      );
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
    }
  }, [toast]);

  const pollLive = useCallback(async () => {
    if (liveRequestInFlight.current) return;
    liveRequestInFlight.current = true;
    setLiveLoading(true);
    try {
      setSnapshot(await fetchLiveSnapshot(liveUrl));
    } finally {
      liveRequestInFlight.current = false;
      setLiveLoading(false);
    }
  }, [liveUrl]);

  useEffect(() => { void loadData(); }, [loadData]);

  useEffect(() => {
    try { localStorage.setItem(LIVE_URL_STORAGE_KEY, liveUrl); } catch { /* ok */ }
  }, [liveUrl]);

  useEffect(() => {
    if (!connected) return;
    void pollLive();
    const timer = window.setInterval(() => void pollLive(), 2_000);
    return () => window.clearInterval(timer);
  }, [connected, pollLive]);

  const openCreateSessao = () => {
    const campeonatoId = campeonatos[0]?.id ?? '';
    const etapaId = etapas.find((etapa) => etapa.campeonato_id === campeonatoId)?.id ?? '';
    setEditingSessao(null);
    setSessaoForm({ ...emptySessaoForm, campeonato_id: campeonatoId, etapa_id: etapaId, data: toDateTimeLocal(new Date().toISOString()) });
    setFormErrors({});
    setSessaoModalOpen(true);
  };

  const openEditSessao = (sessao: SessaoWithCampeonato) => {
    setEditingSessao(sessao);
    setSessaoForm({
      nome: sessao.nome, campeonato_id: sessao.campeonato_id ?? '', etapa_id: sessao.etapa_id ?? '',
      tipo: sessao.tipo, data: toDateTimeLocal(sessao.data), status: sessao.status, fonte: sessao.fonte ?? '',
    });
    setFormErrors({});
    setSessaoModalOpen(true);
  };

  const openCreateVolta = () => {
    if (!selectedSessaoId) return;
    const piloto = pilotos[0];
    setEditingVolta(null);
    setVoltaForm({
      ...emptyVoltaForm, piloto_id: piloto?.id ?? '', piloto_nome: piloto?.nome ?? '',
      kart: piloto?.numero ?? '', numero: '1',
    });
    setFormErrors({});
    setVoltaModalOpen(true);
  };

  const openEditVolta = (volta: Volta) => {
    setEditingVolta(volta);
    setVoltaForm({
      piloto_id: volta.piloto_id ?? '', piloto_nome: volta.piloto_nome, kart: volta.kart ?? '',
      numero: String(volta.numero), tempo: msParaTexto(volta.tempo_ms),
      setor1: volta.setor1_ms === null ? '' : msParaTexto(volta.setor1_ms),
      setor2: volta.setor2_ms === null ? '' : msParaTexto(volta.setor2_ms),
      setor3: volta.setor3_ms === null ? '' : msParaTexto(volta.setor3_ms),
      posicao: volta.posicao === null ? '' : String(volta.posicao), melhor: volta.melhor, valida: volta.valida,
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
      ...emptySessaoForm, nome: `LiveTime ${dateFormatter.format(new Date())}`,
      campeonato_id: campeonatoId, etapa_id: etapaId, data: toDateTimeLocal(new Date().toISOString()), fonte: 'livetime',
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
      await Promise.all([loadData(), loadUnifiedData()]);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
    } finally { setSubmitting(false); }
  };

  const validateVolta = (): Record<string, string> => {
    const errors: Record<string, string> = {};
    const numero = Number(voltaForm.numero);
    if (!voltaForm.piloto_nome.trim()) errors.piloto_id = 'Selecione um piloto.';
    if (!Number.isInteger(numero) || numero < 1) errors.numero = 'Informe uma volta válida.';
    if (textoParaMs(voltaForm.tempo) === null) errors.tempo = 'Use o formato m:ss.mmm.';
    const posicao = voltaForm.posicao ? Number(voltaForm.posicao) : null;
    if (posicao !== null && (!Number.isInteger(posicao) || posicao < 1)) errors.posicao = 'Informe uma posição válida.';
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
      sessao_id: selectedSessaoId, piloto_id: voltaForm.piloto_id || null,
      piloto_nome: voltaForm.piloto_nome.trim(), kart: voltaForm.kart.trim() || null,
      numero: Number(voltaForm.numero), tempo_ms: tempo,
      setor1_ms: textoParaMs(voltaForm.setor1), setor2_ms: textoParaMs(voltaForm.setor2),
      setor3_ms: textoParaMs(voltaForm.setor3), posicao: voltaForm.posicao ? Number(voltaForm.posicao) : null,
      melhor: voltaForm.melhor, valida: voltaForm.valida,
    };
    setSubmitting(true);
    try {
      if (editingVolta) {
        await updateVolta(editingVolta.id, payload);
        toast.success('Volta atualizada com sucesso.');
      } else {
        await createVolta(payload);
        toast.success('Volta criada com sucesso.');
      }
      setVoltaModalOpen(false);
      await loadSessaoVoltas();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
    } finally { setSubmitting(false); }
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
      await Promise.all([loadData(), loadUnifiedData()]);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
    } finally { setSubmitting(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget || !canWrite) return;
    setDeleting(true);
    try {
      if (deleteTarget.kind === 'sessao') {
        await removeSessao(deleteTarget.item.id);
        toast.success('Sessão excluída com sucesso.');
        await Promise.all([loadData(), loadUnifiedData()]);
      } else {
        await removeVolta(deleteTarget.item.id);
        toast.success('Volta excluída com sucesso.');
        await loadSessaoVoltas();
      }
      setDeleteTarget(null);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
    } finally { setDeleting(false); }
  };

  const handleEncerrar = async (sessao: SessaoWithCampeonato) => {
    if (!canWrite || sessao.status === 'encerrada') return;
    try {
      await updateSessao(sessao.id, { status: 'encerrada' });
      toast.success('Sessão encerrada.');
      await Promise.all([loadData(), loadUnifiedData()]);
    } catch (error: unknown) { toast.error(getErrorMessage(error)); }
  };

  const handleGerarResultados = async (sessao: SessaoWithCampeonato) => {
    if (!canWrite) return;
    setGeneratingId(sessao.id);
    try {
      const corridaId = await gerarResultados(sessao.id);
      setGeneratedLink(`/admin/resultados?corrida=${encodeURIComponent(corridaId)}`);
      toast.success('Resultados gerados com sucesso.');
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
    } finally { setGeneratingId(null); }
  };

  const handleSessaoCampeonato = (campeonatoId: string) => {
    setSessaoForm((current) => ({
      ...current, campeonato_id: campeonatoId,
      etapa_id: etapas.find((etapa) => etapa.campeonato_id === campeonatoId)?.id ?? '',
    }));
  };

  const handleImportCampeonato = (campeonatoId: string) => {
    setImportSessaoForm((current) => ({
      ...current, campeonato_id: campeonatoId,
      etapa_id: etapas.find((etapa) => etapa.campeonato_id === campeonatoId)?.id ?? '',
    }));
  };

  const handlePiloto = (pilotoId: string) => {
    const piloto = pilotos.find((item) => item.id === pilotoId);
    setVoltaForm((current) => ({
      ...current, piloto_id: pilotoId, piloto_nome: piloto?.nome ?? '', kart: piloto?.numero ?? current.kart,
    }));
  };

  const selectedItem = useMemo(
    () => unifiedData.find((item) => item.id === selectedItemId) ?? null,
    [unifiedData, selectedItemId],
  );

  const selectedSessaoForVoltas = useMemo(
    () => {
      if (!selectedItemId || selectedItemId.split('_')[0] !== 'd1') return null;
      return sessoes.find((s) => s.id === selectedItemId.slice(3)) ?? null;
    },
    [selectedItemId, sessoes],
  );

  const etapasDaSessao = useMemo(
    () => etapas.filter((etapa) => etapa.campeonato_id === sessaoForm.campeonato_id),
    [etapas, sessaoForm.campeonato_id],
  );

  const etapasDaImportacao = useMemo(
    () => etapas.filter((etapa) => etapa.campeonato_id === importSessaoForm.campeonato_id),
    [etapas, importSessaoForm.campeonato_id],
  );

  const fastestLive = snapshot.pilotos.reduce<number | undefined>(
    (fastest, piloto) =>
      piloto.melhorVoltaMs !== undefined && (fastest === undefined || piloto.melhorVoltaMs < fastest)
        ? piloto.melhorVoltaMs : fastest,
    undefined,
  );

  const columns = useMemo<readonly DataTableColumn<UnifiedItem>[]>(
    () => [
      {
        key: 'nome', label: 'Corrida / Sessão',
        render: (item) => (
          <button
            className={`text-left font-bold underline-offset-4 hover:underline ${selectedItemId === item.id ? 'text-brand-300' : 'text-white'}`}
            onClick={() => { setSelectedItemId(item.id); setSelectedSource(item.source); }}
            type="button"
          >
            {item.nome}
          </button>
        ),
      },
      { key: 'tipo', label: 'Tipo', render: (item) => item.tipo ?? '—' },
      { key: 'dataHora', label: 'Data/hora', render: (item) => formatDateSafe(item.dataHora) },
      { key: 'participantes', label: 'Pilotos', render: (item) => item.participantes || '—' },
      {
        key: 'source', label: 'Fonte',
        render: (item) => (
          <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${FONTE_COLORS[item.source]}`}>
            {FONTE_LABELS[item.source]}
          </span>
        ),
      },
      {
        key: 'status', label: 'Status',
        render: (item) =>
          item.source === 'laptime' ? (
            <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${item.finalizada ? 'border-brand-800 bg-brand-950 text-brand-100' : 'border-amber-800 bg-amber-950 text-amber-200'}`}>
              {item.finalizada ? 'Finalizada' : 'Em andamento'}
            </span>
          ) : (
            <StatusBadge status={item.status ?? 'aberta'} />
          ),
      },
    ],
    [selectedItemId],
  );

  const competitorColumns = useMemo<readonly DataTableColumn<LapTimeRacingCompetitor>[]>(
    () => [
      { key: 'posicao', label: 'Pos.', render: (item) => item.posicao ?? '—' },
      { key: 'numero', label: 'Kart', render: (item) => item.numero ?? '—' },
      { key: 'nome', label: 'Piloto' },
      { key: 'voltas', label: 'Voltas', render: (item) => item.voltas ?? '—' },
      { key: 'melhorVolta', label: 'Melhor volta', render: (item) => item.melhorVolta ?? '—' },
    ],
    [],
  );

  const voltaColumns = useMemo<readonly DataTableColumn<Volta>[]>(
    () => [
      { key: 'posicao', label: 'Pos.' },
      { key: 'piloto_nome', label: 'Piloto' },
      { key: 'kart', label: 'Kart' },
      {
        key: 'tempo_ms', label: 'Tempo',
        render: (volta) => <span className={volta.melhor ? 'font-semibold text-brand-300' : ''}>{msParaTexto(volta.tempo_ms)}</span>,
      },
      { key: 'setor1_ms', label: 'Setor 1', render: (volta) => msParaTexto(volta.setor1_ms) },
      { key: 'setor2_ms', label: 'Setor 2', render: (volta) => msParaTexto(volta.setor2_ms) },
      { key: 'setor3_ms', label: 'Setor 3', render: (volta) => msParaTexto(volta.setor3_ms) },
      {
        key: 'valida', label: 'Válida',
        render: (volta) => <Badge variant={volta.valida ? 'emerald' : 'red'}>{volta.valida ? 'Sim' : 'Não'}</Badge>,
      },
    ],
    [],
  );

  return (
    <section className="space-y-6">
      <PageHeader
        actionLabel={canWrite ? 'Nova sessão' : undefined}
        onAction={canWrite ? openCreateSessao : undefined}
        subtitle="Timing ao vivo, corridas em tempo real, histórico LapTime e sessões manuais."
        title="Cronometragem"
      />

      {generatedLink ? (
        <Card className="flex flex-wrap items-center justify-between gap-3 border-brand-500/30 p-4">
          <p className="text-sm text-zinc-300">Resultados publicados e classificação recalculada.</p>
          <a className="text-sm font-medium text-brand-400 hover:text-brand-300" href={generatedLink}>Abrir resultados</a>
        </Card>
      ) : null}

      {/* === AO VIVO === */}
      <Card className="p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
          <FormField htmlFor="live-url" label="URL do snapshot">
            <input className={inputClassName} id="live-url" onChange={(event) => setLiveUrl(event.target.value)}
              placeholder={DEFAULT_LIVE_URL} type="url" value={liveUrl} />
          </FormField>
          <div className="flex shrink-0 gap-2">
            <Button disabled={!liveUrl.trim()} onClick={() => {
              if (connected) { setConnected(false); setSnapshot((current) => ({ ...current, status: 'pausado' })); }
              else setConnected(true);
            }} variant={connected ? 'secondary' : 'primary'}>
              {connected ? <Pause aria-hidden="true" size={16} /> : <Play aria-hidden="true" size={16} />}
              {connected ? 'Pausar' : 'Conectar'}
            </Button>
            {canWrite ? (
              <Button disabled={snapshot.status !== 'online' || snapshot.pilotos.length === 0}
                onClick={openImportModal} variant="ghost">
                <Download aria-hidden="true" size={16} />Importar p/ sessão
              </Button>
            ) : null}
          </div>
        </div>
      </Card>

      {connected ? (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard icon={Radio} label="Conexão"
              loading={liveLoading && !snapshot.atualizadoEm}
              sub={snapshot.atualizadoEm ? `Atualizado ${dateFormatter.format(new Date(snapshot.atualizadoEm))}` : 'Aguardando conexão'}
              value={snapshot.status === 'online' ? 'Online' : snapshot.status === 'offline' ? 'Offline' : 'Pausado'} />
            <StatCard icon={Users} label="Pilotos" value={numberFormatter.format(snapshot.pilotos.length)} />
            <StatCard icon={Timer} label="Melhor volta" value={msParaTexto(fastestLive)} />
          </div>

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
          ) : snapshot.pilotos.length > 0 ? (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full text-left">
                  <thead className="border-b border-zinc-800">
                    <tr>
                      {['Pos', 'Piloto', 'Kart', 'Melhor volta', 'Última', 'Voltas', 'Gap'].map((label) => (
                        <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-zinc-500" key={label}>{label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {snapshot.pilotos.map((piloto) => (
                      <tr className={piloto.posicao === 1 ? 'border-b border-brand-500/20 bg-brand-500/10' : 'border-b border-zinc-800/60 last:border-0'}
                        key={`${piloto.posicao}-${piloto.nome}-${piloto.kart ?? ''}`}>
                        <td className="px-4 py-3 text-sm font-semibold text-zinc-100">{piloto.posicao}</td>
                        <td className="px-4 py-3 text-sm text-zinc-200">{piloto.nome}</td>
                        <td className="px-4 py-3 text-sm text-zinc-300">{piloto.kart ?? '—'}</td>
                        <td className="px-4 py-3 text-sm font-medium text-brand-300">
                          {piloto.melhorVoltaMs !== undefined ? msParaTexto(piloto.melhorVoltaMs) : (piloto.melhorVoltaTexto ?? '—')}
                        </td>
                        <td className="px-4 py-3 text-sm text-zinc-300">{piloto.ultimaVolta ?? '—'}</td>
                        <td className="px-4 py-3 text-sm text-zinc-300">{piloto.voltas ?? '—'}</td>
                        <td className="px-4 py-3 text-sm text-zinc-400">{piloto.gap ?? (piloto.posicao === 1 ? 'Líder' : '—')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ) : (
            <Card className="flex min-h-48 flex-col items-center justify-center p-8 text-center">
              <Activity aria-hidden="true" className="text-zinc-600" size={28} />
              <p className="mt-3 text-sm text-zinc-400">Conectado, aguardando dados de cronometragem...</p>
            </Card>
          )}
        </div>
      ) : null}

      {/* === HISTÓRICO / SESSÕES === */}
      <div className="space-y-5">
        <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <input className={`${inputClassName} sm:max-w-xs`}
            onChange={(event) => setSearchInput(event.target.value)} placeholder="Buscar por nome..." value={searchInput} />
          <select className={`${inputClassName} sm:max-w-[160px]`}
            onChange={(event) => setSourceFilter(event.target.value)} value={sourceFilter}>
            <option value="">Todas as fontes</option>
            <option value="laptime">LapTime (ao vivo)</option>
            <option value="manual">Manual</option>
          </select>
          <input className={`${inputClassName} sm:max-w-[160px]`}
            onChange={(event) => setDateFrom(event.target.value)} type="date" value={dateFrom} />
          <input className={`${inputClassName} sm:max-w-[160px]`}
            onChange={(event) => setDateTo(event.target.value)} type="date" value={dateTo} />
        </Card>

        <DataTable columns={columns} emptyLabel="Nenhuma corrida ou sessão encontrada."
          error={unifiedError} loading={unifiedLoading} onRetry={() => void loadUnifiedData()} rows={unifiedData} />
        <Pagination onPageChange={setUnifiedPage} page={unifiedPage} pageSize={PAGE_SIZE} total={unifiedTotal} />
      </div>

      {/* === DETALHE: competidores LapTime === */}
      {selectedSource === 'laptime' && selectedItemId ? (
        <div className="border-t border-zinc-800 pt-6">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-300">Resultado</p>
          <h2 className="mt-2 text-xl font-black text-white">{selectedItem?.nome ?? 'Selecione uma corrida'}</h2>
          <div className="mt-4">
            <DataTable columns={competitorColumns} emptyLabel="Nenhum participante registrado."
              error={lapTimeCompetitorsError} loading={lapTimeCompetitorsLoading}
              onRetry={() => void loadLapTimeCompetitors()} rows={lapTimeCompetitors} />
          </div>
        </div>
      ) : null}

      {/* === DETALHE: voltas da sessão D1 === */}
      {selectedSource === 'manual' && selectedItemId ? (
        <div className="border-t border-zinc-800 pt-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-300">Detalhe da sessão</p>
              <h2 className="mt-2 text-xl font-black text-white">{selectedItem?.nome ?? 'Sessão'}</h2>
              {selectedSessaoForVoltas ? (
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                  <StatusBadge status={selectedSessaoForVoltas.status} />
                  <span>{selectedSessaoForVoltas.campeonatos?.nome ?? 'Sem campeonato'}</span>
                </div>
              ) : null}
            </div>
            {canWrite && selectedSessaoForVoltas ? (
              <div className="flex flex-wrap items-center gap-2">
                <Button className="h-8 px-2.5 text-xs" loading={generatingId === selectedSessaoForVoltas.id}
                  onClick={() => void handleGerarResultados(selectedSessaoForVoltas)} variant="secondary">
                  <Trophy aria-hidden="true" size={14} />Gerar resultados
                </Button>
                <Button className="h-8 px-2.5 text-xs"
                  disabled={selectedSessaoForVoltas.status === 'encerrada'}
                  onClick={() => void handleEncerrar(selectedSessaoForVoltas)} variant="ghost">
                  <Lock aria-hidden="true" size={14} />Encerrar
                </Button>
                <Button className="h-8 px-2.5 text-xs"
                  onClick={openCreateVolta} variant="primary">
                  Nova volta
                </Button>
                <Button className="h-8 px-2.5 text-xs"
                  onClick={() => { openEditSessao(selectedSessaoForVoltas); }} variant="ghost">
                  Editar sessão
                </Button>
              </div>
            ) : null}
          </div>
          <div className="mt-4">
            <DataTable columns={voltaColumns} emptyLabel="Nenhuma volta registrada para esta sessão."
              error={sessaoVoltasLoading ? null : sessaoVoltasError} loading={sessaoVoltasLoading}
              onDelete={canWrite ? (volta) => setDeleteTarget({ kind: 'volta', item: volta }) : undefined}
              onEdit={canWrite ? openEditVolta : undefined}
              onRetry={() => void loadSessaoVoltas()} rows={sessaoVoltas} />
          </div>
        </div>
      ) : null}

      {/* === MODAIS === */}
      <Modal footer={
        <>
          <Button disabled={submitting} onClick={() => setSessaoModalOpen(false)} variant="ghost">Cancelar</Button>
          <Button form="sessao-form" loading={submitting} type="submit">Salvar sessão</Button>
        </>
      } isOpen={sessaoModalOpen} onClose={submitting ? () => undefined : () => setSessaoModalOpen(false)}
        title={editingSessao ? 'Editar sessão' : 'Nova sessão'}>
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
        </form>
      </Modal>

      <Modal footer={
        <>
          <Button disabled={submitting} onClick={() => setVoltaModalOpen(false)} variant="ghost">Cancelar</Button>
          <Button form="volta-form" loading={submitting} type="submit">Salvar volta</Button>
        </>
      } isOpen={voltaModalOpen} onClose={submitting ? () => undefined : () => setVoltaModalOpen(false)}
        title={editingVolta ? 'Editar volta' : 'Nova volta'}>
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

      <Modal footer={
        <>
          <Button disabled={submitting} onClick={() => setImportModalOpen(false)} variant="ghost">Cancelar</Button>
          <Button loading={submitting} onClick={() => void handleImport()}><Download aria-hidden="true" size={16} />Importar snapshot</Button>
        </>
      } isOpen={importModalOpen} onClose={submitting ? () => undefined : () => setImportModalOpen(false)}
        title="Importar timing para sessão">
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
            </div>
          )}
        </div>
      </Modal>

      <ConfirmDialog isOpen={Boolean(deleteTarget)} loading={deleting}
        message={deleteTarget?.kind === 'sessao'
          ? `A sessão ${deleteTarget.item.nome} e seus vínculos poderão ser removidos permanentemente.`
          : `A volta de ${deleteTarget?.item.piloto_nome ?? 'este piloto'} será removida permanentemente.`}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void handleDelete()}
        title={deleteTarget?.kind === 'sessao' ? 'Excluir sessão' : 'Excluir volta'} />
    </section>
  );
};
