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
import {
  DESEMPATE_CRITERIOS,
  DESEMPATE_LABELS,
  parsePontuacao,
  type DesempateCriterio,
  type PontuacaoConfig,
} from '@/lib/race-formats';
import { CampeonatoInscricoesPanel } from './CampeonatoInscricoesPanel';
import {
  createCampeonato,
  createEtapa,
  createFormato,
  createPiloto,
  listCampeonatos,
  listCampeonatosPage,
  listClassificacaoPage,
  listEtapasPage,
  listFormatos,
  listPilotosPage,
  removeCampeonato,
  removeEtapa,
  removeFormato,
  removePiloto,
  updateCampeonato,
  updateEtapa,
  updateFormato,
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
  FormatoCorridaRecord,
  Piloto,
  PilotoPayload,
} from './campeonatos.types';
import { FORMATO_CLASSIFICACAO_LABELS } from './campeonatos.types';

type Tab = 'inscricoes' | 'formatos' | 'campeonatos' | 'etapas' | 'pilotos' | 'classificacao';
type FormKind = Exclude<Tab, 'classificacao' | 'inscricoes' | 'formatos'>;

const PAGE_SIZE = 10;

type CampeonatoFormState = {
  nome: string;
  slug: string;
  temporada: string;
  status: CampeonatoStatus;
  formato_id: string;
  bonus_pole: string;
  bonus_melhor_volta: string;
  descartes: string;
  pontos: { pos1: string; pos2: string; pos3: string; pos4: string; pos5: string; pos6: string; pos7: string; pos8: string; pos9: string; pos10: string; demais: string };
  desempates: DesempateCriterio[];
};

const PONTOS_F1_PADRAO = ['25', '18', '15', '12', '10', '8', '6', '4', '2', '1'];

const emptyPontos = (): CampeonatoFormState['pontos'] => ({
  pos1: '25', pos2: '18', pos3: '15', pos4: '12', pos5: '10',
  pos6: '8', pos7: '6', pos8: '4', pos9: '2', pos10: '1', demais: '',
});

type EtapaFormState = {
  campeonato_id: string;
  nome: string;
  data: string;
  round: string;
  status: EtapaStatus;
  formato_id: string;
};

type PilotoFormState = {
  nome: string;
  numero: string;
  equipe: string;
  cliente_id: string;
};

type FormatoFormState = {
  nome: string;
  descricao: string;
  tt_habilitada: boolean;
  tt_duracao_min: string;
  tt_define_grid: boolean;
  tt_pontua: boolean;
  corrida_duracao_min: string;
  paradas_habilitadas: boolean;
  paradas_quantidade: string;
  parada_tempo_minimo_ms: string;
  boxes_abrem_apos_ms: string;
  boxes_fecham_apos_ms: string;
  paradas_adicionais_permitidas: string;
  classificacao_fonte: FormatoCorridaRecord['classificacao_fonte'];
  is_default: boolean;
};

type DeleteTarget =
  | { kind: 'campeonato'; item: Campeonato }
  | { kind: 'etapa'; item: EtapaWithCampeonato }
  | { kind: 'piloto'; item: Piloto }
  | { kind: 'formato'; item: FormatoCorridaRecord };

const emptyFormatoForm: FormatoFormState = {
  nome: '',
  descricao: '',
  tt_habilitada: true,
  tt_duracao_min: '5',
  tt_define_grid: true,
  tt_pontua: false,
  corrida_duracao_min: '20',
  paradas_habilitadas: false,
  paradas_quantidade: '0',
  parada_tempo_minimo_ms: '',
  boxes_abrem_apos_ms: '',
  boxes_fecham_apos_ms: '',
  paradas_adicionais_permitidas: '0',
  classificacao_fonte: 'corrida',
  is_default: false,
};

const emptyCampeonatoForm: CampeonatoFormState = {
  nome: '',
  slug: '',
  temporada: String(new Date().getFullYear()),
  status: 'rascunho',
  formato_id: '',
  bonus_pole: '',
  bonus_melhor_volta: '',
  descartes: '0',
  pontos: emptyPontos(),
  desempates: [...DESEMPATE_CRITERIOS],
};

const emptyEtapaForm: EtapaFormState = {
  campeonato_id: '',
  nome: '',
  data: '',
  round: '1',
  status: 'agendada',
  formato_id: '',
};

const emptyPilotoForm: PilotoFormState = {
  nome: '',
  numero: '',
  equipe: '',
  cliente_id: '',
};

const inputClassName =
  'w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20';

const checkboxClass =
  'h-4 w-4 rounded border-zinc-700 bg-zinc-950 text-brand-500 focus:ring-brand-500/30';

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
 formatos: 'Formatos & Regras',
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

  // Formatos & Regras tab
  const [formatos, setFormatos] = useState<FormatoCorridaRecord[]>([]);
  const [formatoFormOpen, setFormatoFormOpen] = useState(false);
  const [editingFormato, setEditingFormato] = useState<FormatoCorridaRecord | null>(null);
  const [formatoForm, setFormatoForm] = useState<FormatoFormState>(emptyFormatoForm);
  const [formatoErrors, setFormatoErrors] = useState<Record<string, string>>({});
  const [formatoSaving, setFormatoSaving] = useState(false);

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
  const [editingPiloto, setEditingPiloto] = useState<Piloto | null>(null);  const [campeonatoForm, setCampeonatoForm] =
    useState<CampeonatoFormState>(emptyCampeonatoForm);
  const [etapaForm, setEtapaForm] = useState<EtapaFormState>(emptyEtapaForm);
  const [pilotoForm, setPilotoForm] = useState<PilotoFormState>(emptyPilotoForm);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deleting, setDeleting] = useState(false);

  const canWrite = ['owner', 'admin', 'operador_telao'].includes(role);

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

  const loadFormatos = useCallback(async () => {
    try {
      setFormatos(await listFormatos());
    } catch (error: unknown) {
      setLoadError(getErrorMessage(error));
    }
  }, []);

  const reloadAll = useCallback(async () => {
    await Promise.all([loadCampeonatosAll(), loadCampeonatosTab(), loadEtapasTab(), loadPilotosTab(), loadFormatos()]);
    await loadClassificacao();
  }, [loadCampeonatosAll, loadCampeonatosTab, loadEtapasTab, loadPilotosTab, loadClassificacao, loadFormatos]);

  useEffect(() => {
    void loadFormatos();
  }, [loadFormatos]);

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
      {
        key: 'formato_id',
        label: 'Formato',
        render: (campeonato) => formatos.find((f) => f.id === campeonato.formato_id)?.nome ?? 'Padrão Betim (default)',
      },
    ],
    [formatos],
  );

  const formatoColumns = useMemo<readonly DataTableColumn<FormatoCorridaRecord>[]>(
    () => [
      {
        key: 'nome',
        label: 'Formato',
        render: (formato) => (
          <div>
            <strong className="block text-sm text-zinc-100">
              {formato.nome}
              {formato.is_default ? <span className="ml-2 rounded-full border border-brand-800 bg-brand-950 px-2 py-0.5 text-[10px] font-bold text-brand-200">DEFAULT</span> : null}
            </strong>
            <span className="text-xs text-zinc-500">{formato.descricao ?? '—'}</span>
          </div>
        ),
      },
      {
        key: 'tt_habilitada',
        label: 'Tomada de tempo',
        render: (formato) => (formato.tt_habilitada ? `${formato.tt_duracao_min ?? '—'} min${formato.tt_pontua ? ' · pontua' : formato.tt_define_grid ? ' · define grid' : ''}` : '—'),
      },
      {
        key: 'paradas_habilitadas',
        label: 'Paradas obrigatórias',
        render: (formato) =>
          formato.paradas_habilitadas
            ? `${formato.paradas_quantidade}× ≥ ${Math.round((formato.parada_tempo_minimo_ms ?? 420000) / 60000)}min`
            : 'Sem paradas',
      },
      {
        key: 'classificacao_fonte',
        label: 'Classificação',
        render: (formato) => FORMATO_CLASSIFICACAO_LABELS[formato.classificacao_fonte],
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

  // ---------- Formatos & Regras ----------

  const openCreateFormato = () => {
    setEditingFormato(null);
    setFormatoForm(emptyFormatoForm);
    setFormatoErrors({});
    setFormatoFormOpen(true);
  };

  const openEditFormato = (formato: FormatoCorridaRecord) => {
    setEditingFormato(formato);
    setFormatoForm({
      nome: formato.nome,
      descricao: formato.descricao ?? '',
      tt_habilitada: formato.tt_habilitada,
      tt_duracao_min: formato.tt_duracao_min === null ? '' : String(formato.tt_duracao_min),
      tt_define_grid: formato.tt_define_grid,
      tt_pontua: formato.tt_pontua,
      corrida_duracao_min: formato.corrida_duracao_min === null ? '' : String(formato.corrida_duracao_min),
      paradas_habilitadas: formato.paradas_habilitadas,
      paradas_quantidade: String(formato.paradas_quantidade ?? 0),
      parada_tempo_minimo_ms: formato.parada_tempo_minimo_ms === null ? '' : String(formato.parada_tempo_minimo_ms),
      boxes_abrem_apos_ms: formato.boxes_abrem_apos_ms === null ? '' : String(formato.boxes_abrem_apos_ms),
      boxes_fecham_apos_ms: formato.boxes_fecham_apos_ms === null ? '' : String(formato.boxes_fecham_apos_ms),
      paradas_adicionais_permitidas: String(formato.paradas_adicionais_permitidas ?? 0),
      classificacao_fonte: formato.classificacao_fonte,
      is_default: formato.is_default,
    });
    setFormatoErrors({});
    setFormatoFormOpen(true);
  };

  const validateFormato = (): boolean => {
    const errors: Record<string, string> = {};
    if (!formatoForm.nome.trim()) errors.nome = 'Informe o nome do formato.';
    if (formatoForm.classificacao_fonte === 'combinada' && !formatoForm.tt_habilitada) {
      errors.classificacao_fonte = 'Classificação combinada exige tomada de tempo habilitada.';
    }
    setFormatoErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleFormatoSubmit = async () => {
    if (!validateFormato()) return;
    setFormatoSaving(true);
    try {
      const payload = {
        nome: formatoForm.nome.trim(),
        descricao: formatoForm.descricao.trim() || null,
        tt_habilitada: formatoForm.tt_habilitada,
        tt_duracao_min: Number(formatoForm.tt_duracao_min) || null,
        tt_define_grid: formatoForm.tt_define_grid && formatoForm.tt_habilitada,
        tt_pontua: formatoForm.tt_pontua && formatoForm.tt_habilitada,
        corrida_duracao_min: Number(formatoForm.corrida_duracao_min) || null,
        paradas_habilitadas: formatoForm.paradas_habilitadas,
        paradas_quantidade: formatoForm.paradas_habilitadas ? Number(formatoForm.paradas_quantidade) || 0 : 0,
        parada_tempo_minimo_ms: formatoForm.paradas_habilitadas ? Number(formatoForm.parada_tempo_minimo_ms) || null : null,
        boxes_abrem_apos_ms: formatoForm.paradas_habilitadas ? Number(formatoForm.boxes_abrem_apos_ms) || null : null,
        boxes_fecham_apos_ms: formatoForm.paradas_habilitadas ? Number(formatoForm.boxes_fecham_apos_ms) || null : null,
        paradas_adicionais_permitidas: formatoForm.paradas_habilitadas ? Number(formatoForm.paradas_adicionais_permitidas) || 0 : 0,
        punicoes_fonte: 'cronometragem' as const,
        classificacao_fonte: formatoForm.classificacao_fonte,
        desempate: [...DESEMPATE_CRITERIOS],
        is_default: formatoForm.is_default,
      };
      if (editingFormato) {
        await updateFormato(editingFormato.id, payload);
        toast.success('Formato atualizado com sucesso.');
      } else {
        await createFormato(payload);
        toast.success('Formato criado com sucesso.');
      }
      setFormatoFormOpen(false);
      await loadFormatos();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
    } finally {
      setFormatoSaving(false);
    }
  };

  const moverDesempate = (index: number, direcao: -1 | 1) => {
    setCampeonatoForm((current) => {
      const lista = [...current.desempates];
      const alvo = index + direcao;
      if (alvo < 0 || alvo >= lista.length) return current;
      [lista[index], lista[alvo]] = [lista[alvo], lista[index]];
      return { ...current, desempates: lista };
    });
  };

  const openEditCampeonato = (campeonato: Campeonato) => {
    setEditingCampeonato(campeonato);
    const pontuacao = parsePontuacao(campeonato.pontos_json);
    const ponto = (pos: number): string => {
      const valor = pontuacao?.posicoes[String(pos)];
      return valor !== undefined ? String(valor) : PONTOS_F1_PADRAO[pos - 1];
    };
    let desempatesSalvos: unknown = campeonato.desempate_json;
    if (typeof desempatesSalvos === 'string') {
      try { desempatesSalvos = JSON.parse(desempatesSalvos); } catch { desempatesSalvos = null; }
    }
    const ordemSalva = Array.isArray(desempatesSalvos)
      ? (desempatesSalvos as DesempateCriterio[]).filter((c) => (DESEMPATE_CRITERIOS as readonly string[]).includes(c))
      : [];
    setCampeonatoForm({
      nome: campeonato.nome,
      slug: campeonato.slug ?? '',
      temporada: campeonato.temporada ?? '',
      status: campeonato.status,
      formato_id: campeonato.formato_id ?? '',
      bonus_pole: campeonato.bonus_pole === null || campeonato.bonus_pole === undefined ? '' : String(campeonato.bonus_pole),
      bonus_melhor_volta: campeonato.bonus_melhor_volta === null || campeonato.bonus_melhor_volta === undefined ? '' : String(campeonato.bonus_melhor_volta),
      descartes: String(campeonato.descartes ?? 0),
      pontos: {
        pos1: ponto(1), pos2: ponto(2), pos3: ponto(3), pos4: ponto(4), pos5: ponto(5),
        pos6: ponto(6), pos7: ponto(7), pos8: ponto(8), pos9: ponto(9), pos10: ponto(10),
        demais: pontuacao?.foraDaTabela !== undefined ? String(pontuacao.foraDaTabela) : '',
      },
      desempates: ordemSalva.length
        ? [...DESEMPATE_CRITERIOS].sort((a, b) => ordemSalva.indexOf(a) - ordemSalva.indexOf(b))
        : [...DESEMPATE_CRITERIOS],
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
      formato_id: etapa.formato_id ?? '',
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

    const pontos: PontuacaoConfig['posicoes'] = {};
    (['pos1', 'pos2', 'pos3', 'pos4', 'pos5', 'pos6', 'pos7', 'pos8', 'pos9', 'pos10'] as const).forEach((campo, indice) => {
      const bruto = campeonatoForm.pontos[campo];
      if (bruto !== '') {
        pontos[String(indice + 1)] = Number(bruto) || 0;
      }
    });
    const pontuacaoCustom = Object.keys(pontos).length
      ? {
          posicoes: pontos,
          ...(campeonatoForm.pontos.demais !== '' ? { foraDaTabela: Number(campeonatoForm.pontos.demais) || 0 } : {}),
        }
      : null;

    const desempatesCustom =
      campeonatoForm.desempates.length === DESEMPATE_CRITERIOS.length &&
      campeonatoForm.desempates.every((criterio, index) => criterio === DESEMPATE_CRITERIOS[index])
        ? null
        : campeonatoForm.desempates;

    const payload: CampeonatoPayload = {
      nome: campeonatoForm.nome.trim(),
      slug: campeonatoForm.slug.trim(),
      temporada: campeonatoForm.temporada.trim(),
      status: campeonatoForm.status,
      formato_id: campeonatoForm.formato_id || null,
      pontos_json: pontuacaoCustom,
      desempate_json: desempatesCustom,
      bonus_pole: campeonatoForm.bonus_pole === '' ? null : Number(campeonatoForm.bonus_pole),
      bonus_melhor_volta: campeonatoForm.bonus_melhor_volta === '' ? null : Number(campeonatoForm.bonus_melhor_volta),
      descartes: campeonatoForm.descartes === '' ? null : Number(campeonatoForm.descartes),
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
      formato_id: etapaForm.formato_id || null,
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
      } else if (deleteTarget.kind === 'formato') {
        await removeFormato(deleteTarget.item.id);
        toast.success('Formato excluído com sucesso.');
        setDeleteTarget(null);
        await loadFormatos();
        return;
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
          : activeTab === 'formatos'
            ? 'Novo formato'
            : undefined
    : undefined;

  const deleteMessage = deleteTarget
    ? `${deleteTarget.kind === 'campeonato' ? 'O campeonato' : deleteTarget.kind === 'etapa' ? 'A etapa' : deleteTarget.kind === 'formato' ? 'O formato' : 'O piloto'} “${deleteTarget.item.nome}” será ${deleteTarget.kind === 'etapa' ? 'excluída' : 'excluído'} permanentemente.`
    : '';

  return (
    <section>
      <PageHeader
        actionLabel={actionLabel}
        onAction={
          actionLabel && (activeTab === 'campeonatos' || activeTab === 'etapas' || activeTab === 'pilotos')
            ? () => openCreateModal(activeTab)
            : actionLabel && activeTab === 'formatos'
              ? openCreateFormato
              : undefined
        }
        subtitle="Gerencie inscrições, formatos de prova, campeonatos, etapas, pilotos e consulte a classificação geral."
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

{activeTab === 'formatos' ? (
          <div className="space-y-4">
            <p className="text-sm text-zinc-400">
              Templates de regulamento reutilizáveis. O formato define tomada de tempo, paradas obrigatórias e
              critério de classificação — aplicado por campeonato, com override por etapa ou corrida.
            </p>
            <DataTable
              columns={formatoColumns}
              emptyLabel="Nenhum formato cadastrado."
              error={loadError}
              loading={loading}
              onDelete={canWrite ? (item) => setDeleteTarget({ kind: 'formato', item }) : undefined}
              onEdit={canWrite ? openEditFormato : undefined}
              onRetry={() => void loadFormatos()}
              rows={formatos}
            />
          </div>
        ) : null}

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
            <FormField hint="Usado nas corridas do campeonato que não tenham override próprio." htmlFor="campeonato-formato" label="Formato das corridas">
              <select
                className={inputClassName}
                id="campeonato-formato"
                onChange={(event) =>
                  setCampeonatoForm((current) => ({ ...current, formato_id: event.target.value }))
                }
                value={campeonatoForm.formato_id}
              >
                <option value="">Padrão Betim (default)</option>
                {formatos.map((formato) => (
                  <option key={formato.id} value={formato.id}>
                    {formato.nome}
                  </option>
                ))}
              </select>
            </FormField>
          </form>
        ) : null}

        {formKind === 'campeonatos' ? (
          <div className="mt-5 space-y-4 rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-brand-300">Regulamento esportivo</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <FormField htmlFor="camp-pontos-1" label="1º lugar">
                <input className={inputClassName} id="camp-pontos-1" inputMode="decimal" onChange={(e) => setCampeonatoForm((c) => ({ ...c, pontos: { ...c.pontos, pos1: e.target.value } }))} value={campeonatoForm.pontos.pos1} />
              </FormField>
              <FormField htmlFor="camp-pontos-2" label="2º lugar">
                <input className={inputClassName} id="camp-pontos-2" inputMode="decimal" onChange={(e) => setCampeonatoForm((c) => ({ ...c, pontos: { ...c.pontos, pos2: e.target.value } }))} value={campeonatoForm.pontos.pos2} />
              </FormField>
              <FormField htmlFor="camp-pontos-3" label="3º lugar">
                <input className={inputClassName} id="camp-pontos-3" inputMode="decimal" onChange={(e) => setCampeonatoForm((c) => ({ ...c, pontos: { ...c.pontos, pos3: e.target.value } }))} value={campeonatoForm.pontos.pos3} />
              </FormField>
              <FormField htmlFor="camp-pontos-4" label="4º lugar">
                <input className={inputClassName} id="camp-pontos-4" inputMode="decimal" onChange={(e) => setCampeonatoForm((c) => ({ ...c, pontos: { ...c.pontos, pos4: e.target.value } }))} value={campeonatoForm.pontos.pos4} />
              </FormField>
              <FormField htmlFor="camp-pontos-5" label="5º lugar">
                <input className={inputClassName} id="camp-pontos-5" inputMode="decimal" onChange={(e) => setCampeonatoForm((c) => ({ ...c, pontos: { ...c.pontos, pos5: e.target.value } }))} value={campeonatoForm.pontos.pos5} />
              </FormField>
              <FormField htmlFor="camp-pontos-6" label="6º lugar">
                <input className={inputClassName} id="camp-pontos-6" inputMode="decimal" onChange={(e) => setCampeonatoForm((c) => ({ ...c, pontos: { ...c.pontos, pos6: e.target.value } }))} value={campeonatoForm.pontos.pos6} />
              </FormField>
              <FormField htmlFor="camp-pontos-7" label="7º lugar">
                <input className={inputClassName} id="camp-pontos-7" inputMode="decimal" onChange={(e) => setCampeonatoForm((c) => ({ ...c, pontos: { ...c.pontos, pos7: e.target.value } }))} value={campeonatoForm.pontos.pos7} />
              </FormField>
              <FormField htmlFor="camp-pontos-8" label="8º lugar">
                <input className={inputClassName} id="camp-pontos-8" inputMode="decimal" onChange={(e) => setCampeonatoForm((c) => ({ ...c, pontos: { ...c.pontos, pos8: e.target.value } }))} value={campeonatoForm.pontos.pos8} />
              </FormField>
              <FormField htmlFor="camp-pontos-9" label="9º lugar">
                <input className={inputClassName} id="camp-pontos-9" inputMode="decimal" onChange={(e) => setCampeonatoForm((c) => ({ ...c, pontos: { ...c.pontos, pos9: e.target.value } }))} value={campeonatoForm.pontos.pos9} />
              </FormField>
              <FormField htmlFor="camp-pontos-10" label="10º lugar">
                <input className={inputClassName} id="camp-pontos-10" inputMode="decimal" onChange={(e) => setCampeonatoForm((c) => ({ ...c, pontos: { ...c.pontos, pos10: e.target.value } }))} value={campeonatoForm.pontos.pos10} />
              </FormField>
              <FormField hint="Pontos fixos além da última posição configurada." htmlFor="camp-pontos-demais" label="Demais posições">
                <input className={inputClassName} id="camp-pontos-demais" inputMode="decimal" onChange={(e) => setCampeonatoForm((c) => ({ ...c, pontos: { ...c.pontos, demais: e.target.value } }))} placeholder="0" value={campeonatoForm.pontos.demais} />
              </FormField>
              <div className="grid grid-cols-2 gap-2 sm:col-span-1">
                <Button onClick={() => setCampeonatoForm((c) => ({ ...c, pontos: emptyPontos() }))} type="button" variant="ghost">F1 padrão</Button>
                <Button onClick={() => setCampeonatoForm((c) => ({ ...c, pontos: { pos1: '', pos2: '', pos3: '', pos4: '', pos5: '', pos6: '', pos7: '', pos8: '', pos9: '', pos10: '', demais: '' } }))} type="button" variant="ghost">Limpar</Button>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <FormField hint="Ex.: premiação pela pole." htmlFor="camp-bonus-pole" label="Bônus pole (pontos)">
                <input className={inputClassName} id="camp-bonus-pole" inputMode="decimal" onChange={(e) => setCampeonatoForm((c) => ({ ...c, bonus_pole: e.target.value }))} placeholder="0" value={campeonatoForm.bonus_pole} />
              </FormField>
              <FormField htmlFor="camp-bonus-mv" label="Bônus melhor volta (pontos)">
                <input className={inputClassName} id="camp-bonus-mv" inputMode="decimal" onChange={(e) => setCampeonatoForm((c) => ({ ...c, bonus_melhor_volta: e.target.value }))} placeholder="0" value={campeonatoForm.bonus_melhor_volta} />
              </FormField>
              <FormField htmlFor="camp-descartes" label="Descartes (piores etapas)">
                <input className={inputClassName} id="camp-descartes" min="0" step="1" type="number" onChange={(e) => setCampeonatoForm((c) => ({ ...c, descartes: e.target.value }))} value={campeonatoForm.descartes} />
              </FormField>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-zinc-500">Ordem de desempate</p>
              <ol className="mt-2 space-y-1">
                {campeonatoForm.desempates.map((criterio, index) => (
                  <li className="flex items-center justify-between gap-2 rounded-md border border-zinc-800 px-3 py-1.5 text-sm text-zinc-200" key={criterio}>
                    <span>{index + 1}. {DESEMPATE_LABELS[criterio]}</span>
                    <span className="flex gap-1">
                      <button aria-label={`Subir ${DESEMPATE_LABELS[criterio]}`} className="rounded px-2 py-0.5 text-zinc-400 hover:bg-zinc-800 hover:text-white disabled:opacity-30" disabled={index === 0} onClick={() => moverDesempate(index, -1)} type="button">↑</button>
                      <button aria-label={`Descer ${DESEMPATE_LABELS[criterio]}`} className="rounded px-2 py-0.5 text-zinc-400 hover:bg-zinc-800 hover:text-white disabled:opacity-30" disabled={index === campeonatoForm.desempates.length - 1} onClick={() => moverDesempate(index, 1)} type="button">↓</button>
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
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
            <FormField hint="Deixe em branco para herdar do campeonato." htmlFor="etapa-formato" label="Formato (override da etapa)">
              <select
                className={inputClassName}
                id="etapa-formato"
                onChange={(event) =>
                  setEtapaForm((current) => ({ ...current, formato_id: event.target.value }))
                }
                value={etapaForm.formato_id}
              >
                <option value="">Herdar do campeonato</option>
                {formatos.map((formato) => (
                  <option key={formato.id} value={formato.id}>
                    {formato.nome}
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

      <Modal
        footer={
          <>
            <Button disabled={formatoSaving} onClick={() => setFormatoFormOpen(false)} variant="ghost">
              Cancelar
            </Button>
            <Button form="formato-form" loading={formatoSaving} type="submit">
              {editingFormato ? 'Salvar formato' : 'Criar formato'}
            </Button>
          </>
        }
        isOpen={formatoFormOpen}
        onClose={formatoSaving ? () => undefined : () => setFormatoFormOpen(false)}
        title={editingFormato ? `Editar formato · ${editingFormato.nome}` : 'Novo formato de corrida'}
      >
        <form className="grid gap-4 md:grid-cols-2" id="formato-form" onSubmit={(event) => { event.preventDefault(); void handleFormatoSubmit(); }}>
          <div className="md:col-span-2">
            <FormField error={formatoErrors.nome} htmlFor="formato-nome" label="Nome">
              <input className={inputClassName} id="formato-nome" onChange={(e) => setFormatoForm((c) => ({ ...c, nome: e.target.value }))} placeholder="Ex.: Endurance 6h com 8 paradas" required value={formatoForm.nome} />
            </FormField>
          </div>
          <div className="md:col-span-2">
            <FormField htmlFor="formato-descricao" label="Descrição">
              <input className={inputClassName} id="formato-descricao" onChange={(e) => setFormatoForm((c) => ({ ...c, descricao: e.target.value }))} value={formatoForm.descricao} />
            </FormField>
          </div>
          <FormField error={formatoErrors.classificacao_fonte} htmlFor="formato-classificacao" label="Classificação final por">
            <select className={inputClassName} id="formato-classificacao" onChange={(e) => setFormatoForm((c) => ({ ...c, classificacao_fonte: e.target.value as FormatoCorridaRecord['classificacao_fonte'] }))} value={formatoForm.classificacao_fonte}>
              {Object.entries(FORMATO_CLASSIFICACAO_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </FormField>
          <FormField htmlFor="formato-corrida-duracao" label="Duração estimada da corrida (min)">
            <input className={inputClassName} id="formato-corrida-duracao" inputMode="numeric" onChange={(e) => setFormatoForm((c) => ({ ...c, corrida_duracao_min: e.target.value }))} value={formatoForm.corrida_duracao_min} />
          </FormField>

          <div className="rounded-lg border border-zinc-800 p-3 md:col-span-2">
            <label className="flex items-center gap-2 text-sm font-bold text-zinc-200">
              <input checked={formatoForm.tt_habilitada} className={checkboxClass} onChange={(e) => setFormatoForm((c) => ({ ...c, tt_habilitada: e.target.checked }))} type="checkbox" />
              Tem fase de tomada de tempo
            </label>
            {formatoForm.tt_habilitada ? (
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <FormField htmlFor="formato-tt-duracao" label="Duração (min)">
                  <input className={inputClassName} id="formato-tt-duracao" inputMode="numeric" onChange={(e) => setFormatoForm((c) => ({ ...c, tt_duracao_min: e.target.value }))} value={formatoForm.tt_duracao_min} />
                </FormField>
                <label className="flex items-center gap-2 self-end pb-2 text-sm text-zinc-300">
                  <input checked={formatoForm.tt_define_grid} className={checkboxClass} onChange={(e) => setFormatoForm((c) => ({ ...c, tt_define_grid: e.target.checked }))} type="checkbox" />
                  Define o grid da corrida
                </label>
                <label className="flex items-center gap-2 self-end pb-2 text-sm text-zinc-300">
                  <input checked={formatoForm.tt_pontua} className={checkboxClass} onChange={(e) => setFormatoForm((c) => ({ ...c, tt_pontua: e.target.checked }))} type="checkbox" />
                  Pontua separadamente
                </label>
              </div>
            ) : null}
          </div>

          <div className="rounded-lg border border-zinc-800 p-3 md:col-span-2">
            <label className="flex items-center gap-2 text-sm font-bold text-zinc-200">
              <input checked={formatoForm.paradas_habilitadas} className={checkboxClass} onChange={(e) => setFormatoForm((c) => ({ ...c, paradas_habilitadas: e.target.checked }))} type="checkbox" />
              Paradas obrigatórias (endurance)
            </label>
            {formatoForm.paradas_habilitadas ? (
              <div className="mt-3 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
                <FormField htmlFor="formato-paradas-qtd" label="Qtd. obrigatórias">
                  <input className={inputClassName} id="formato-paradas-qtd" inputMode="numeric" min="0" onChange={(e) => setFormatoForm((c) => ({ ...c, paradas_quantidade: e.target.value }))} value={formatoForm.paradas_quantidade} />
                </FormField>
                <FormField htmlFor="formato-parada-min" label="Mínimo parada (ms)">
                  <input className={inputClassName} id="formato-parada-min" inputMode="numeric" onChange={(e) => setFormatoForm((c) => ({ ...c, parada_tempo_minimo_ms: e.target.value }))} placeholder="420000 = 7:00" value={formatoForm.parada_tempo_minimo_ms} />
                </FormField>
                <FormField htmlFor="formato-boxes-abrem" label="Boxes abrem após (ms)">
                  <input className={inputClassName} id="formato-boxes-abrem" inputMode="numeric" onChange={(e) => setFormatoForm((c) => ({ ...c, boxes_abrem_apos_ms: e.target.value }))} placeholder="600000 = 10:00" value={formatoForm.boxes_abrem_apos_ms} />
                </FormField>
                <FormField htmlFor="formato-boxes-fecham" label="Boxes fecham após (ms)">
                  <input className={inputClassName} id="formato-boxes-fecham" inputMode="numeric" onChange={(e) => setFormatoForm((c) => ({ ...c, boxes_fecham_apos_ms: e.target.value }))} placeholder="42000000 = 11h40" value={formatoForm.boxes_fecham_apos_ms} />
                </FormField>
                <FormField htmlFor="formato-paradas-adicionais" label="Adicionais permitidas">
                  <input className={inputClassName} id="formato-paradas-adicionais" inputMode="numeric" min="0" onChange={(e) => setFormatoForm((c) => ({ ...c, paradas_adicionais_permitidas: e.target.value }))} value={formatoForm.paradas_adicionais_permitidas} />
                </FormField>
              </div>
            ) : (
              <p className="mt-2 text-xs text-zinc-500">Corrida sem pit stop obrigatório — painéis não exibem colunas de box.</p>
            )}
          </div>

          <label className="flex items-center gap-2 text-sm font-bold text-zinc-200 md:col-span-2">
            <input checked={formatoForm.is_default} className={checkboxClass} onChange={(e) => setFormatoForm((c) => ({ ...c, is_default: e.target.checked }))} type="checkbox" />
            Definir como formato padrão do kartódromo
          </label>
          <p className="text-xs text-zinc-500 md:col-span-2">
            Punições são sempre aplicadas em tempo real pela cronometragem (LapTime); este sistema apenas as exibe.
          </p>
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
