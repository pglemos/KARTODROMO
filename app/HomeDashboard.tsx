'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { DEFAULT_TELAO_LAYOUT, type TelaoLayoutConfig } from '@/lib/telao-layout-config';
import type { LiveTimingSnapshot } from '@/lib/livetime/types';
import type { ViplexDeviceProgram } from '@/lib/viplex-programs';

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
  live: '/placar-telao-tb50?layout=designer',
  liveManual: '/placar-telao-tb50?layout=designer&controls=true',
  preview: '/placar-telao-tb50?layout=designer',
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
  if (normalizedProgramName(program) === 'CRONOMETRAGEM') return 'Programa 01';
  if (normalizedProgramName(program) === 'VIDEOS') return 'Programa 02';
  return `Programa ${String(index + 1).padStart(2, '0')}`;
}

function programActionLabel(program: ViplexDeviceProgram, busy: boolean): string {
  if (busy) return 'Publicando...';
  if (normalizedProgramName(program) === 'CRONOMETRAGEM') return 'Publicar corrida na TB50';
  return 'Publicar na TB50';
}

function formatCheckedAt(value: string | null) {
  if (!value) return 'Aguardando leitura';
  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(value));
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
  const response = await fetch(`${url}${url.includes('?') ? '&' : '?'}_ts=${Date.now()}`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json() as Promise<T>;
}

export function HomeDashboard({ uid }: { uid: string }) {
  const [state, setState] = useState<DashboardState>(INITIAL_STATE);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<ActionMessage | null>(null);

  const capacity = useMemo(() => (state.layout ? state.layout.columns * state.layout.rows : 0), [state.layout]);
  const activeDrivers = state.snapshot?.drivers.length || 0;
  const isStandardLayout = state.layout?.id === DEFAULT_TELAO_LAYOUT.id;
  const pageOffset = state.page?.offset || 0;
  const previewUrl = `${LINKS.live}&uid=${encodeURIComponent(uid)}`;
  const cronometragemProgram = state.viplexPrograms.find((program) => normalizedProgramName(program) === 'CRONOMETRAGEM');
  const activeProgram = state.viplexPrograms.find((program) => program.statusCode === 1);
  const isLiveReady = state.health.snapshot === 'ok' && state.health.layout === 'ok' && state.health.viplex === 'ok';
  const refresh = useCallback(async () => {
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
        snapshot: snapshot ? (snapshot.status === 'error' ? 'warning' : 'ok') : 'error',
        layout: layoutData?.layout ? 'ok' : 'error',
        mode: displayMode ? 'ok' : 'error',
        viplex: viplex?.programs?.length ? 'ok' : 'warning',
      },
      error: [viplex?.error, ...errors].filter(Boolean).join(' · ') || null,
    });
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

  async function runAction(actionId: string, action: () => Promise<void>, successText = 'Operacao concluida') {
    setBusyAction(actionId);
    setActionMessage(null);
    try {
      await action();
      await refresh();
      setActionMessage({ type: 'success', text: successText });
    } catch (error) {
      setActionMessage({ type: 'error', text: error instanceof Error ? error.message : 'Falha na operacao' });
    } finally {
      setBusyAction(null);
    }
  }

  async function setDisplayMode(mode: 'live' | 'final-real') {
    await runAction(mode, async () => writeDisplayMode(mode), mode === 'live' ? 'Placar ao vivo enviado' : 'Podio final enviado');
    if (mode === 'final-real') window.location.assign(LINKS.podium);
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
    await runAction(`viplex-${program.identifier}`, async () => {
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
    <main className="home-shell">
      <section className="home-command">
        <div className="home-title">
          <span>Kartódromo de Betim · TB50</span>
          <h1>Central do Telão</h1>
          <p>{isLiveReady ? 'Tudo pronto para operar a corrida em tempo real.' : 'Revise os status antes de publicar no painel.'}</p>
        </div>

        <div className="home-primary-actions" aria-label="Ações principais">
          {cronometragemProgram ? (
            <button
              className="home-button home-button-strong"
              type="button"
              onClick={() => void publishViplexProgram(cronometragemProgram)}
              disabled={Boolean(busyAction)}
            >
              {busyAction === `viplex-${cronometragemProgram.identifier}` ? 'Publicando...' : 'Publicar corrida na TB50'}
            </button>
          ) : null}
          <a className="home-button" href={LINKS.liveManual} target="_blank" rel="noreferrer">
            Abrir telão
          </a>
          <a className="home-button" href={LINKS.designer}>
            Designer
          </a>
          <button className="home-button" type="button" onClick={() => void refresh()}>
            Atualizar
          </button>
        </div>
      </section>

      <section className="home-overview" aria-label="Resumo operacional">
        <article className={`home-live-card home-live-card-${isLiveReady ? 'ready' : 'attention'}`}>
          <span>{isLiveReady ? 'Sistema pronto' : 'Atencao operacional'}</span>
          <strong>{state.snapshot?.eventName || 'Aguardando corrida'}</strong>
          <em>Fonte {state.snapshot?.source || '--'} / {activeDrivers} pilotos / leitura {formatCheckedAt(state.checkedAt)}</em>
        </article>
        <article className="home-live-card">
          <span>Agora na TB50</span>
          <strong>{activeProgram?.name || modeLabel(state.displayMode?.mode)}</strong>
          <em>{layoutShort(state.layout)} / pagina {pageLabel(pageOffset)}</em>
        </article>
      </section>

      <section className="home-status-grid" aria-label="Status operacional">
        <article className={`home-status home-status-${state.health.snapshot}`}>
          <span>LiveTime</span>
          <strong>{statusLabel(state.health.snapshot)}</strong>
          <em>{state.snapshot?.eventName || 'Aguardando dados'}</em>
        </article>
        <article className={`home-status home-status-${state.health.layout}`}>
          <span>Layout</span>
          <strong>{state.layout?.id || 'Indisponível'}</strong>
          <em>{layoutShort(state.layout)}</em>
        </article>
        <article className={`home-status home-status-${state.health.mode}`}>
          <span>Modo</span>
          <strong>{modeLabel(state.displayMode?.mode)}</strong>
          <em>{state.displayMode?.persistent ? 'Persistente' : 'Temporário'}</em>
        </article>
        <article className="home-status home-status-ok">
          <span>Página</span>
          <strong>{pageLabel(pageOffset)}</strong>
          <em>{activeDrivers} pilotos · {capacity || '--'} posições</em>
        </article>
        <article className={`home-status home-status-${state.health.viplex}`}>
          <span>Programas</span>
          <strong>{statusLabel(state.health.viplex)}</strong>
          <em>{state.viplexPrograms.length || '--'} disponíveis</em>
        </article>
      </section>

      {state.error ? <div className="home-alert">{state.error}</div> : null}
      {actionMessage ? <div className={`home-action-message home-action-message-${actionMessage.type}`}>{actionMessage.text}</div> : null}

      <section className="home-program-library" aria-label="Biblioteca de programas ViPlex Express">
        <header className="home-panel-header">
          <div>
            <span>ViPlex Express</span>
            <strong>Escolha o que sai na TB50</strong>
          </div>
        </header>
        <div className="home-program-grid">
          {state.viplexPrograms.map((program, index) => {
            const isActive = program.statusCode === 1;
            const isBusy = busyAction === `viplex-${program.identifier}`;

            return (
              <article className={`home-program ${isActive ? 'home-program-active' : ''}`} key={program.identifier}>
                <div className="home-program-copy">
                  <span>{isActive ? `${programSlotLabel(program, index)} em execucao` : programSlotLabel(program, index)}</span>
                  <strong>{program.name}</strong>
                  <em>{programSummary(program)}</em>
                </div>
                <div className="home-program-actions">
                  <button type="button" onClick={() => void publishViplexProgram(program)} disabled={Boolean(busyAction)}>
                    {programActionLabel(program, isBusy)}
                  </button>
                  <button type="button" onClick={() => void copyLink(program.name, `${LINKS.viplexProgramsApi}?program=${encodeURIComponent(program.identifier)}`)}>
                    {copied === program.name ? 'Copiado' : 'Copiar ID'}
                  </button>
                </div>
              </article>
            );
          })}
          {!state.viplexPrograms.length ? (
            <article className="home-program">
              <div className="home-program-copy">
                <span>Sem conexao</span>
                <strong>ViPlex indisponivel</strong>
                <em>Confirme o scraper local, o ngrok fixo e a controladora TB50 na rede.</em>
              </div>
            </article>
          ) : null}
        </div>
      </section>

      <section className="home-main-grid">
        <article className="home-preview-panel">
          <header className="home-panel-header">
            <div>
              <span>Preview</span>
              <strong>{state.layout?.label || 'Telão'}</strong>
            </div>
            <a href={LINKS.preview} target="_blank" rel="noreferrer">Tela cheia</a>
          </header>
          <div className="home-preview-frame">
            <iframe title="Preview do telão" src={previewUrl} />
          </div>
        </article>

        <aside className="home-operations">
          <section className="home-panel">
            <header className="home-panel-header">
              <div>
                <span>Operação</span>
                <strong>Controle rápido</strong>
              </div>
            </header>
            <div className="home-action-stack">
              <button type="button" onClick={() => void setDisplayMode('live')} disabled={Boolean(busyAction)}>
                Enviar placar ao vivo
              </button>
              <button type="button" onClick={() => void setDisplayMode('final-real')} disabled={Boolean(busyAction)}>
                Enviar pódio final
              </button>
              <button type="button" onClick={() => void standardizeLayout()} disabled={Boolean(busyAction) || isStandardLayout}>
                {isStandardLayout ? 'Layout padronizado' : 'Padronizar layout'}
              </button>
              <button type="button" onClick={() => void applyFiveByTwoLayout()} disabled={Boolean(busyAction)}>
                Layout 5x2 tomada
              </button>
              <div className="home-page-actions" aria-label="Paginar telão">
                <button type="button" onClick={() => void setTb50Page(0)} disabled={Boolean(busyAction) || pageOffset === 0}>
                  1-10
                </button>
                <button type="button" onClick={() => void setTb50Page(Math.max(0, pageOffset - PAGE_STEP))} disabled={Boolean(busyAction) || pageOffset === 0}>
                  -10
                </button>
                <button type="button" onClick={() => void nextTb50Page()} disabled={Boolean(busyAction)}>
                  Virar +10
                </button>
              </div>
            </div>
          </section>

          <section className="home-panel">
            <header className="home-panel-header">
              <div>
                <span>Corrida</span>
                <strong>{state.snapshot?.trackName || 'Cronometragem'}</strong>
              </div>
            </header>
            <div className="home-race-list">
              {(state.snapshot?.drivers || []).slice(0, 5).map((driver) => (
                <div key={`${driver.position}-${driver.kart}`}>
                  <span>{driver.position}</span>
                  <strong>{driver.kart}</strong>
                  <em>{driver.name || 'Piloto'}</em>
                  <small>{driver.time || '--'}</small>
                </div>
              ))}
              {!state.snapshot?.drivers.length ? <p>Sem pilotos no snapshot atual.</p> : null}
            </div>
          </section>
        </aside>
      </section>

      <section className="home-tools-grid" aria-label="Ferramentas">
        <a href={LINKS.designer}>Designer do telão</a>
        <a href={LINKS.live} target="_blank" rel="noreferrer">Placar ao vivo</a>
        <a href={LINKS.final} target="_blank" rel="noreferrer">Pódio final</a>
        <a href={LINKS.podium} target="_blank" rel="noreferrer">Página do pódio</a>
        <a href={LINKS.layoutApi} target="_blank" rel="noreferrer">API layout</a>
        <a href={`${LINKS.snapshotApi}?uid=${encodeURIComponent(uid)}`} target="_blank" rel="noreferrer">API LiveTime</a>
        <button type="button" onClick={() => void copyLink('RTSP', '/placar-telao-tb50?layout=designer')}>
          {copied === 'RTSP' ? 'Link copiado' : 'Copiar link telão'}
        </button>
        <button type="button" onClick={() => void copyLink('Designer', LINKS.designer)}>
          {copied === 'Designer' ? 'Link copiado' : 'Copiar link designer'}
        </button>
      </section>
    </main>
  );
}
