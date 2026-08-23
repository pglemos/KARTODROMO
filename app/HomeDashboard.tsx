'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clipboard,
  Copy,
  ExternalLink,
  Gauge,
  LayoutTemplate,
  Maximize2,
  Monitor,
  Play,
  RefreshCw,
  Send,
  Settings2,
  SlidersHorizontal,
  Timer,
  Trophy,
  Tv,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { DEFAULT_TELAO_LAYOUT, type TelaoLayoutConfig } from '@/lib/telao-layout-config';
import type { LiveTimingSnapshot } from '@/lib/livetime/types';
import type { ViplexDeviceProgram } from '@/lib/viplex-programs';
import { Badge } from '@/src/admin/ui/Badge';
import { Button } from '@/src/admin/ui/Button';
import { TelaoProgramacao } from './TelaoProgramacao';

type LayoutResponse = {
  layout?: TelaoLayoutConfig;
  store?: {
    storage?: string;
    persistent?: boolean;
    remoteEndpoint?: string;
    localEndpoint?: boolean;
  };
};

type DisplayModeResponse = {
  mode?: 'live' | 'final-real' | 'final-demo';
  updatedAt?: string | null;
  persistent?: boolean;
};

type PageResponse = {
  offset?: number;
  updatedAt?: string | null;
  persistent?: boolean;
};

type ViplexProgramsResponse = {
  programs?: ViplexDeviceProgram[];
  error?: string;
};

type HealthState = 'loading' | 'ok' | 'warning' | 'error';
type ActionMessage = { type: 'success' | 'error'; text: string };

const SNAPSHOT_STALE_AFTER_MS = 15_000;

type DashboardState = {
  snapshot: LiveTimingSnapshot | null;
  layout: TelaoLayoutConfig | null;
  displayMode: DisplayModeResponse | null;
  page: PageResponse | null;
  viplexPrograms: ViplexDeviceProgram[];
  store: LayoutResponse['store'] | null;
  checkedAt: string | null;
  health: {
    snapshot: HealthState;
    layout: HealthState;
    mode: HealthState;
    viplex: HealthState;
  };
  error: string | null;
};

const INITIAL_STATE: DashboardState = {
  snapshot: null,
  layout: null,
  displayMode: null,
  page: null,
  viplexPrograms: [],
  store: null,
  checkedAt: null,
  health: {
    snapshot: 'loading',
    layout: 'loading',
    mode: 'loading',
    viplex: 'loading',
  },
  error: null,
};

const LINKS = {
  designer: '/designer-telao',
  live: '/podio-live-tb50',
  liveManual: '/placar-telao-tb50?layout=designer&controls=true',
  preview: '/podio-live-tb50',
  final: '/placar-telao-tb50?layout=designer&final=real&controls=true',
  podium: '/podio-final-tb50',
  layoutApi: '/api/telao-layout',
  snapshotApi: '/api/livetime-snapshot',
  pageApi: '/api/tb50-page',
  viplexProgramsApi: '/api/viplex-programs',
};

const PAGE_STEP = 10;
const MAX_PAGE_OFFSET = 90;

/*
  {
    id: 'live-scoreboard',
    slot: 'Programa 01',
    label: 'Placar ao vivo',
    summary: 'Layout salvo no designer com dados reais do LiveTime.',
    href: LINKS.live,
    actionLabel: 'Enviar ao telão',
  },
  {
    id: 'qualifying-grid',
    slot: 'Programa 02',
    label: 'Tomada / Grid 5x2',
    summary: 'Página de 10 pilotos para tomada, grid e conferência.',
    href: LINKS.live,
    actionLabel: 'Enviar 5x2',
  },
  {
    id: 'final-podium',
    slot: 'Programa 03',
    label: 'Pódio final',
    summary: 'Cena final com Top classificados da corrida real.',
    href: LINKS.podium,
    actionLabel: 'Enviar pódio',
  },
*/

function statusLabel(state: HealthState) {
  if (state === 'ok') return 'Online';
  if (state === 'warning') return 'Atenção';
  if (state === 'error') return 'Erro';
  return 'Carregando';
}

function modeLabel(mode?: string) {
  if (mode === 'final-real') return 'Pódio final';
  if (mode === 'final-demo') return 'Pódio demo';
  return 'Ao vivo';
}

function layoutShort(layout: TelaoLayoutConfig | null) {
  if (!layout) return 'Sem layout';
  return `${layout.columns}x${layout.rows} · ${layout.fields.join(' + ')}`;
}

function pageLabel(offset?: number | null) {
  const start = (offset || 0) + 1;
  return `${start}-${start + PAGE_STEP - 1}`;
}

function programSummary(program: ViplexDeviceProgram) {
  const size = program.width && program.height ? `${program.width}x${program.height}` : 'Dimensao nao informada';
  const seconds = Math.round((program.duration || 0) / 1000);
  return `${size} / ${seconds || '--'}s / ID ${program.identifier.slice(0, 8)}`;
}

function normalizedProgramName(program: ViplexDeviceProgram): string {
  return program.name.trim().toUpperCase();
}

function programSlotLabel(program: ViplexDeviceProgram, index: number): string {
  return `Programa ${String(index + 1).padStart(2, '0')}`;
}

function programKey(program: ViplexDeviceProgram): string {
  return `${program.id}:${program.identifier}`;
}

function programActionLabel(program: ViplexDeviceProgram, busy: boolean): string {
  if (busy) return 'Publicando...';
  if (normalizedProgramName(program) === 'CRONOMETRAGEM') return 'Publicar corrida na TB50';
  return 'Publicar na TB50';
}

function formatCheckedAt(value: string | null) {
  if (!value) return 'Aguardando leitura';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Leitura sem horário';
  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(date);
}

function snapshotAgeMs(snapshot: LiveTimingSnapshot | null): number | null {
  if (!snapshot?.updatedAt) return null;
  const timestamp = Date.parse(snapshot.updatedAt);
  return Number.isFinite(timestamp) ? Math.max(0, Date.now() - timestamp) : null;
}

function snapshotHealth(snapshot: LiveTimingSnapshot | null): HealthState {
  if (!snapshot) return 'error';
  if (snapshot.status === 'error') return 'error';
  if (snapshot.status !== 'live') return 'warning';
  const age = snapshotAgeMs(snapshot);
  return age !== null && age > SNAPSHOT_STALE_AFTER_MS ? 'warning' : 'ok';
}

function snapshotStatusDetail(snapshot: LiveTimingSnapshot | null): string {
  if (!snapshot) return 'Aguardando dados';
  if (snapshot.status === 'live') {
    const age = snapshotAgeMs(snapshot);
    return age !== null && age > SNAPSHOT_STALE_AFTER_MS ? 'Leitura atrasada' : 'Corrida ao vivo';
  }
  if (snapshot.status === 'finished') return 'Sessão finalizada';
  if (snapshot.status === 'error') return snapshot.message || 'Falha na fonte';
  if (snapshot.status === 'demo') return 'Demonstração';
  return snapshot.message || 'Aguardando corrida ou tomada de tempo';
}

const panelClass = 'rounded-xl border border-zinc-800 bg-zinc-900/60 shadow-card';
const compactButtonClass = 'h-9';

const healthMeta: Record<HealthState, { label: string; variant: 'emerald' | 'amber' | 'red' | 'zinc' }> = {
  loading: { label: 'Carregando', variant: 'zinc' },
  ok: { label: 'Online', variant: 'emerald' },
  warning: { label: 'Atenção', variant: 'amber' },
  error: { label: 'Erro', variant: 'red' },
};

function HealthBadge({ state }: { state: HealthState }) {
  const meta = healthMeta[state];
  return <Badge variant={meta.variant}>{meta.label}</Badge>;
}

function StatusTile({
  detail,
  icon: Icon,
  label,
  state,
  value,
}: {
  detail: string;
  icon: LucideIcon;
  label: string;
  state: HealthState;
  value: string;
}) {
  return (
    <article className={`${panelClass} min-w-0 p-4`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[.12em] text-zinc-500">{label}</p>
          <strong className="mt-2 block truncate text-base font-semibold text-zinc-50">{value}</strong>
        </div>
        <span className="grid h-8 w-8 flex-none place-items-center rounded-lg bg-brand-500/10 text-brand-400">
          <Icon aria-hidden="true" size={16} />
        </span>
      </div>
      <div className="mt-3 flex min-w-0 items-center justify-between gap-2">
        <span className="truncate text-xs text-zinc-500">{detail}</span>
        <HealthBadge state={state} />
      </div>
    </article>
  );
}

function PanelHeader({
  eyebrow,
  title,
  action,
}: {
  eyebrow: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <header className="flex min-w-0 items-start justify-between gap-3 border-b border-zinc-800 px-4 py-3.5 md:px-5">
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-[.12em] text-zinc-500">{eyebrow}</p>
        <h2 className="mt-1 truncate text-base font-semibold text-zinc-50">{title}</h2>
      </div>
      {action ? <div className="flex flex-none items-center gap-2">{action}</div> : null}
    </header>
  );
}

function buildFiveByTwoLayout(base: TelaoLayoutConfig): TelaoLayoutConfig {
  return {
    ...base,
    id: 'tb50-5x2-grid',
    label: 'TB50 5x2 - tomada/grid',
    variant: 'cards',
    columns: 5,
    rows: 2,
    showHeader: false,
  };
}

async function readJson<T>(url: string): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 12_000);
  let response: Response;

  try {
    response = await fetch(`${url}${url.includes('?') ? '&' : '?'}_ts=${Date.now()}`, {
      cache: 'no-store',
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw new Error('Tempo limite da leitura');
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const message = data && typeof data === 'object' && 'error' in data ? String(data.error) : `HTTP ${response.status}`;
    throw new Error(message);
  }
  return data as T;
}

export function HomeDashboard({ uid }: { uid: string }) {
  const [state, setState] = useState<DashboardState>(INITIAL_STATE);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<ActionMessage | null>(null);
  const refreshingRef = useRef(false);

  const capacity = useMemo(() => (state.layout ? state.layout.columns * state.layout.rows : 0), [state.layout]);
  const activeDrivers = state.snapshot?.drivers.length || 0;
  const isStandardLayout = state.layout?.id === DEFAULT_TELAO_LAYOUT.id;
  const pageOffset = state.page?.offset || 0;
  const previewUrl = `${LINKS.live}?uid=${encodeURIComponent(uid)}`;
  const cronometragemProgram = state.viplexPrograms.find((program) => normalizedProgramName(program) === 'CRONOMETRAGEM' && program.statusCode === 1)
    || state.viplexPrograms.find((program) => normalizedProgramName(program) === 'CRONOMETRAGEM');
  const activeProgram = state.viplexPrograms.find((program) => program.statusCode === 1);
  const isLiveReady = state.snapshot?.status === 'live'
    && state.health.snapshot === 'ok'
    && state.health.layout === 'ok'
    && state.health.viplex === 'ok';
  const refresh = useCallback(async () => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    setState((current) => ({
      ...current,
      health: {
        snapshot: 'loading',
        layout: 'loading',
        mode: 'loading',
        viplex: 'loading',
      },
      error: null,
    }));

    try {
      const [snapshotResult, layoutResult, modeResult, pageResult, viplexResult] = await Promise.allSettled([
        readJson<LiveTimingSnapshot>(`${LINKS.snapshotApi}?uid=${encodeURIComponent(uid)}`),
        readJson<LayoutResponse>(LINKS.layoutApi),
        readJson<DisplayModeResponse>('/api/tb50-display-mode'),
        readJson<PageResponse>(LINKS.pageApi),
        readJson<ViplexProgramsResponse>(LINKS.viplexProgramsApi),
      ]);

      const snapshot = snapshotResult.status === 'fulfilled' ? snapshotResult.value : null;
      const layoutData = layoutResult.status === 'fulfilled' ? layoutResult.value : null;
      const displayMode = modeResult.status === 'fulfilled' ? modeResult.value : null;
      const page = pageResult.status === 'fulfilled' ? pageResult.value : null;
      const viplex = viplexResult.status === 'fulfilled' ? viplexResult.value : null;

      const errors = [snapshotResult, layoutResult, modeResult, pageResult, viplexResult]
        .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
        .map((result) => result.reason instanceof Error ? result.reason.message : 'Falha ao carregar');

      setState({
        snapshot,
        layout: layoutData?.layout || null,
        displayMode,
        page,
        viplexPrograms: viplex?.programs || [],
        store: layoutData?.store || null,
        checkedAt: new Date().toISOString(),
        health: {
          snapshot: snapshotHealth(snapshot),
          layout: layoutData?.layout ? 'ok' : 'error',
          mode: displayMode ? 'ok' : 'error',
          viplex: viplex?.programs?.length ? 'ok' : 'warning',
        },
        error: [viplex?.error, ...errors].filter(Boolean).join(' · ') || null,
      });
    } finally {
      refreshingRef.current = false;
    }
  }, [uid]);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 10000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  async function writeDisplayMode(mode: 'live' | 'final-real') {
    const response = await fetch('/api/tb50-display-mode', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode }),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
  }

  async function writeTelaoLayout(layout: TelaoLayoutConfig) {
    const response = await fetch('/api/telao-layout', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(layout),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
  }

  async function writeTb50Page(offset: number) {
    const response = await fetch(LINKS.pageApi, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ offset }),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
  }

  async function runAction(actionId: string, action: () => Promise<void>, successText = 'Operacao concluida'): Promise<boolean> {
    setBusyAction(actionId);
    setActionMessage(null);
    try {
      await action();
      await refresh();
      setActionMessage({ type: 'success', text: successText });
      return true;
    } catch (error) {
      setActionMessage({ type: 'error', text: error instanceof Error ? error.message : 'Falha na operacao' });
      return false;
    } finally {
      setBusyAction(null);
    }
  }

  async function setDisplayMode(mode: 'live' | 'final-real') {
    const success = await runAction(mode, async () => writeDisplayMode(mode), mode === 'live' ? 'Placar ao vivo enviado' : 'Podio final enviado');
    if (success && mode === 'final-real') window.location.assign(LINKS.podium);
  }

  async function setTb50Page(offset: number) {
    await runAction(`page-${offset}`, async () => writeTb50Page(offset), `Pagina ${pageLabel(offset)} enviada`);
  }

  async function nextTb50Page() {
    await setTb50Page(pageOffset >= MAX_PAGE_OFFSET ? 0 : pageOffset + PAGE_STEP);
  }

  async function standardizeLayout() {
    await runAction('standardize', async () => writeTelaoLayout(DEFAULT_TELAO_LAYOUT), 'Layout padrao enviado');
  }

  async function applyFiveByTwoLayout() {
    const base = state.layout || DEFAULT_TELAO_LAYOUT;
    const nextLayout = buildFiveByTwoLayout(base);

    await runAction('layout-5x2', async () => {
      await writeTelaoLayout(nextLayout);
      await writeTb50Page(0);
    }, 'Layout 5x2 enviado');
  }

  async function publishViplexProgram(program: ViplexDeviceProgram) {
    await runAction(`viplex-${programKey(program)}`, async () => {
      const response = await fetch(LINKS.viplexProgramsApi, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: program.identifier }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
    }, `${program.name} publicado na TB50`);
  }

  async function copyLink(label: string, value: string) {
    await navigator.clipboard?.writeText(`${window.location.origin}${value}`).catch(() => undefined);
    setCopied(label);
    window.setTimeout(() => setCopied(null), 1600);
  }

  return (
    <main className="grid gap-5 pb-10">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wider text-brand-400">Operação · TB50</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-50">Central do telão</h2>
          <p className="mt-1.5 max-w-2xl text-sm text-zinc-400">
            {isLiveReady ? 'Sinal real conectado e pronto para publicação.' : 'Confira os estados antes de publicar conteúdo na TB50.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {cronometragemProgram ? (
            <Button
              className={compactButtonClass}
              onClick={() => void publishViplexProgram(cronometragemProgram)}
              disabled={Boolean(busyAction)}
            >
              <Send aria-hidden="true" size={15} />
              {busyAction === `viplex-${programKey(cronometragemProgram)}` ? 'Publicando...' : 'Publicar na TB50'}
            </Button>
          ) : null}
          <a className="inline-flex h-9 items-center gap-2 rounded-lg border border-zinc-800 px-3.5 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-800/70 hover:text-zinc-100" href={LINKS.liveManual} target="_blank" rel="noreferrer">
            <ExternalLink aria-hidden="true" size={15} />
            Abrir telão
          </a>
          <Link className="inline-flex h-9 items-center gap-2 rounded-lg border border-zinc-800 px-3.5 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-800/70 hover:text-zinc-100" href={LINKS.designer}>
            <LayoutTemplate aria-hidden="true" size={15} />
            Designer
          </Link>
          <Button className={compactButtonClass} onClick={() => void refresh()} variant="ghost">
            <RefreshCw aria-hidden="true" size={15} />
            Atualizar
          </Button>
        </div>
      </header>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,.65fr)]" aria-label="Resumo operacional">
        <article className={`${panelClass} border-l-4 ${isLiveReady ? 'border-l-emerald-500' : 'border-l-amber-500'} p-5`}>
          <div className="flex items-start gap-4">
            <span className={`grid h-11 w-11 flex-none place-items-center rounded-xl ${isLiveReady ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
              {isLiveReady ? <CheckCircle2 aria-hidden="true" size={22} /> : <AlertTriangle aria-hidden="true" size={22} />}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[10px] font-bold uppercase tracking-[.12em] text-zinc-500">Sinal LiveTime</p>
                <HealthBadge state={state.health.snapshot} />
              </div>
              <h2 className="mt-2 break-words text-lg font-semibold text-zinc-50">{state.snapshot?.eventName || snapshotStatusDetail(state.snapshot)}</h2>
              <p className="mt-1.5 text-sm text-zinc-400">
                Fonte {state.snapshot?.source || '--'} · {activeDrivers} pilotos · leitura {formatCheckedAt(state.snapshot?.updatedAt || state.checkedAt)}
              </p>
            </div>
          </div>
        </article>
        <article className={`${panelClass} p-5`}>
          <div className="flex items-start gap-4">
            <span className="grid h-11 w-11 flex-none place-items-center rounded-xl bg-blue-500/10 text-blue-400">
              <Tv aria-hidden="true" size={22} />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[.12em] text-zinc-500">Agora na TB50</p>
              <h2 className="mt-2 truncate text-lg font-semibold text-zinc-50">{activeProgram?.name || modeLabel(state.displayMode?.mode)}</h2>
              <p className="mt-1.5 text-sm text-zinc-400">{layoutShort(state.layout)} · página {pageLabel(pageOffset)}</p>
            </div>
          </div>
        </article>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5" aria-label="Status operacional">
        <StatusTile detail={snapshotStatusDetail(state.snapshot)} icon={Gauge} label="LiveTime" state={state.health.snapshot} value={statusLabel(state.health.snapshot)} />
        <StatusTile detail={layoutShort(state.layout)} icon={LayoutTemplate} label="Layout" state={state.health.layout} value={state.layout?.id || 'Indisponível'} />
        <StatusTile detail={state.displayMode?.persistent ? 'Persistente' : 'Temporário'} icon={Settings2} label="Modo" state={state.health.mode} value={modeLabel(state.displayMode?.mode)} />
        <StatusTile detail={`${activeDrivers} pilotos · ${capacity || '--'} posições`} icon={SlidersHorizontal} label="Página" state="ok" value={pageLabel(pageOffset)} />
        <StatusTile detail={`${state.viplexPrograms.length || '--'} disponíveis`} icon={Monitor} label="Programas" state={state.health.viplex} value={statusLabel(state.health.viplex)} />
      </section>

      {state.error ? (
        <div className="flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-200" role="alert">
          <XCircle aria-hidden="true" className="mt-0.5 flex-none text-red-400" size={18} />
          <span>{state.error}</span>
        </div>
      ) : null}
      {actionMessage ? (
        <div className={`flex items-start gap-3 rounded-xl border p-4 text-sm ${actionMessage.type === 'success' ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-200' : 'border-red-500/30 bg-red-500/5 text-red-200'}`} role="status">
          {actionMessage.type === 'success' ? <CheckCircle2 aria-hidden="true" className="mt-0.5 flex-none text-emerald-400" size={18} /> : <XCircle aria-hidden="true" className="mt-0.5 flex-none text-red-400" size={18} />}
          <span>{actionMessage.text}</span>
        </div>
      ) : null}

      <section className={`${panelClass} overflow-hidden`} aria-label="Biblioteca de programas ViPlex Express">
        <PanelHeader
          action={<Badge variant={state.health.viplex === 'ok' ? 'emerald' : 'amber'}>{state.viplexPrograms.length || 0} disponíveis</Badge>}
          eyebrow="ViPlex Express"
          title="Programas disponíveis para a TB50"
        />
        <div className="grid gap-3 p-4 md:grid-cols-2 md:p-5">
          {state.viplexPrograms.map((program, index) => {
            const isActive = program.statusCode === 1;
            const isBusy = busyAction === `viplex-${programKey(program)}`;

            return (
              <article className={`rounded-lg border p-4 ${isActive ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-zinc-800 bg-zinc-950/20'}`} key={programKey(program)}>
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-[.1em] text-zinc-500">{programSlotLabel(program, index)}</span>
                      {isActive ? <Badge variant="emerald">Em execução</Badge> : null}
                    </div>
                    <h3 className="mt-2 truncate text-base font-semibold text-zinc-50">{program.name}</h3>
                    <p className="mt-1 text-xs text-zinc-500">{programSummary(program)}</p>
                  </div>
                  <Play aria-hidden="true" className={isActive ? 'text-emerald-400' : 'text-zinc-500'} size={17} />
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button className={compactButtonClass} onClick={() => void publishViplexProgram(program)} disabled={Boolean(busyAction)}>
                    <Send aria-hidden="true" size={14} />
                    {programActionLabel(program, isBusy)}
                  </Button>
                  <Button className={compactButtonClass} onClick={() => void copyLink(programKey(program), `${LINKS.viplexProgramsApi}?program=${encodeURIComponent(program.identifier)}`)} variant="ghost">
                    <Copy aria-hidden="true" size={14} />
                    {copied === programKey(program) ? 'Copiado' : 'Copiar ID'}
                  </Button>
                </div>
              </article>
            );
          })}
          {!state.viplexPrograms.length ? (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 md:col-span-2">
              <div className="flex items-start gap-3">
                <AlertTriangle aria-hidden="true" className="mt-0.5 flex-none text-amber-400" size={18} />
                <div>
                  <strong className="block text-sm font-semibold text-zinc-50">ViPlex indisponível</strong>
                  <p className="mt-1 text-xs leading-5 text-zinc-400">Confirme o bridge local e a conexão da controladora TB50 antes de publicar.</p>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <article className={`${panelClass} min-w-0 self-start overflow-hidden`}>
          <PanelHeader
            action={<a className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-zinc-800 px-2.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-800/70 hover:text-zinc-100" href={LINKS.preview} target="_blank" rel="noreferrer"><Maximize2 aria-hidden="true" size={14} />Tela cheia</a>}
            eyebrow="Preview"
            title={state.layout?.label || 'Telão'}
          />
          <div className="bg-zinc-950/40 p-3 md:p-4">
            <div className="aspect-[4/1] min-h-[150px] overflow-hidden rounded-lg border border-zinc-800 bg-black">
              <iframe className="h-full w-full border-0" title="Preview do telão" src={previewUrl} />
            </div>
          </div>
        </article>

        <aside className="grid content-start gap-5">
          <section className={`${panelClass} overflow-hidden`}>
            <PanelHeader eyebrow="Operação" title="Controle rápido" />
            <div className="grid gap-2 p-4">
              <Button className="h-10 justify-start" onClick={() => void setDisplayMode('live')} disabled={Boolean(busyAction)}>
                <Play aria-hidden="true" size={15} />
                Enviar placar ao vivo
              </Button>
              <Button className="h-10 justify-start" onClick={() => void setDisplayMode('final-real')} disabled={Boolean(busyAction)} variant="secondary">
                <Trophy aria-hidden="true" size={15} />
                Enviar pódio final
              </Button>
              <Button className="h-10 justify-start" onClick={() => void standardizeLayout()} disabled={Boolean(busyAction) || isStandardLayout} variant="ghost">
                <LayoutTemplate aria-hidden="true" size={15} />
                {isStandardLayout ? 'Layout padronizado' : 'Padronizar layout'}
              </Button>
              <Button className="h-10 justify-start" onClick={() => void applyFiveByTwoLayout()} disabled={Boolean(busyAction)} variant="ghost">
                <SlidersHorizontal aria-hidden="true" size={15} />
                Layout 5x2 para tomada
              </Button>
              <div className="mt-2 border-t border-zinc-800 pt-3" aria-label="Paginar telão">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-[.1em] text-zinc-500">Página exibida</p>
                <div className="grid grid-cols-3 gap-2">
                  <Button aria-label="Voltar para a primeira página" className="h-9 px-2" onClick={() => void setTb50Page(0)} disabled={Boolean(busyAction) || pageOffset === 0} variant="ghost"><ChevronLeft aria-hidden="true" size={15} />1–10</Button>
                  <Button aria-label="Página anterior" className="h-9 px-2" onClick={() => void setTb50Page(Math.max(0, pageOffset - PAGE_STEP))} disabled={Boolean(busyAction) || pageOffset === 0} variant="ghost"><ChevronLeft aria-hidden="true" size={15} />-10</Button>
                  <Button aria-label="Próxima página" className="h-9 px-2" onClick={() => void nextTb50Page()} disabled={Boolean(busyAction)} variant="ghost">+10<ChevronRight aria-hidden="true" size={15} /></Button>
                </div>
              </div>
            </div>
          </section>

          <section className={`${panelClass} overflow-hidden`}>
            <PanelHeader eyebrow="Corrida atual" title={state.snapshot?.trackName || 'Cronometragem'} />
            <div className="divide-y divide-zinc-800">
              {(state.snapshot?.drivers || []).slice(0, 5).map((driver) => (
                <div className="grid grid-cols-[32px_48px_minmax(0,1fr)_72px] items-center gap-2 px-4 py-2.5" key={`${driver.position}-${driver.kart}`}>
                  <span className="text-center text-sm font-semibold tabular-nums text-zinc-500">{driver.position}</span>
                  <strong className="text-center text-sm font-semibold tabular-nums text-brand-400">{driver.kart}</strong>
                  <span className="truncate text-sm text-zinc-200">{driver.name || 'Piloto'}</span>
                  <span className="text-right text-xs font-medium tabular-nums text-zinc-500">{driver.time || '--'}</span>
                </div>
              ))}
              {!state.snapshot?.drivers.length ? <p className="px-4 py-5 text-sm text-zinc-500">Sem pilotos no snapshot atual.</p> : null}
            </div>
          </section>
        </aside>
      </section>

      <TelaoProgramacao />

      <section className={`${panelClass} overflow-hidden`} aria-label="Ferramentas">
        <PanelHeader eyebrow="Acesso rápido" title="Ferramentas do telão" />
        <div className="grid gap-2 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <Link className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-zinc-800 px-3 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-800/70 hover:text-zinc-100" href={LINKS.designer}><LayoutTemplate aria-hidden="true" size={15} />Designer</Link>
          <a className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-zinc-800 px-3 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-800/70 hover:text-zinc-100" href={LINKS.live} target="_blank" rel="noreferrer"><Monitor aria-hidden="true" size={15} />Placar ao vivo</a>
          <a className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-zinc-800 px-3 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-800/70 hover:text-zinc-100" href={LINKS.final} target="_blank" rel="noreferrer"><Trophy aria-hidden="true" size={15} />Pódio final</a>
          <a className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-zinc-800 px-3 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-800/70 hover:text-zinc-100" href={LINKS.layoutApi} target="_blank" rel="noreferrer"><Clipboard aria-hidden="true" size={15} />API layout</a>
          <a className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-zinc-800 px-3 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-800/70 hover:text-zinc-100" href={`${LINKS.snapshotApi}?uid=${encodeURIComponent(uid)}`} target="_blank" rel="noreferrer"><Timer aria-hidden="true" size={15} />API LiveTime</a>
          <Button className="min-h-10" onClick={() => void copyLink('RTSP', '/placar-telao-tb50?layout=designer')} variant="ghost"><Copy aria-hidden="true" size={15} />{copied === 'RTSP' ? 'Link copiado' : 'Copiar link telão'}</Button>
          <Button className="min-h-10" onClick={() => void copyLink('Designer', LINKS.designer)} variant="ghost"><Copy aria-hidden="true" size={15} />{copied === 'Designer' ? 'Link copiado' : 'Copiar link designer'}</Button>
        </div>
      </section>
    </main>
  );
}
