'use client';

import { type CSSProperties, useEffect, useMemo, useState } from 'react';
import { createDemoSnapshot } from '@/lib/livetime/demo-data';
import type { LiveTimingDriver, LiveTimingSnapshot } from '@/lib/livetime/types';
import { DEFAULT_TELAO_LAYOUT, normalizeTelaoLayoutConfig, TELAO_LAYOUT_PRESETS, type TelaoField, type TelaoLayoutConfig } from '@/lib/telao-layout-config';
import { hiddenRealDataFields, payloadMatchesTelaoLayout } from '@/lib/telao-layout-validation';
import { LiveTimingTable } from '@/components/telao/LiveTimingTable';
import '@/components/telao/telao.css';
import './designer.css';

const FIELDS: Array<{ id: TelaoField; label: string; short: string }> = [
  { id: 'position', label: 'Posição', short: 'P' },
  { id: 'kart', label: 'Kart', short: '#' },
  { id: 'name', label: 'Nome', short: 'N' },
  { id: 'time', label: 'Tempo', short: 'T' },
];

const NUMBER_FIELDS: Array<{ key: keyof Pick<TelaoLayoutConfig, 'columns' | 'rows' | 'cellGap' | 'borderWidth' | 'lineWidth' | 'positionFontSize' | 'kartFontSize' | 'nameFontSize' | 'timeFontSize' | 'headerFontSize'>; label: string; min: number; max: number; unit?: string }> = [
  { key: 'columns', label: 'Colunas', min: 1, max: 10 },
  { key: 'rows', label: 'Linhas', min: 1, max: 10 },
  { key: 'cellGap', label: 'Espaço', min: 0, max: 18, unit: 'px' },
  { key: 'borderWidth', label: 'Borda', min: 0, max: 6, unit: 'px' },
  { key: 'lineWidth', label: 'Grade', min: 0, max: 8, unit: 'px' },
  { key: 'positionFontSize', label: 'Posição', min: 10, max: 250, unit: 'px' },
  { key: 'kartFontSize', label: 'Kart', min: 10, max: 250, unit: 'px' },
  { key: 'nameFontSize', label: 'Nome', min: 10, max: 80, unit: 'px' },
  { key: 'timeFontSize', label: 'Tempo', min: 10, max: 80, unit: 'px' },
  { key: 'headerFontSize', label: 'Cabeçalho', min: 10, max: 48, unit: 'px' },
];

const COLOR_FIELDS: Array<{ key: keyof TelaoLayoutConfig['colors']; label: string }> = [
  { key: 'background', label: 'Fundo' },
  { key: 'grid', label: 'Grade' },
  { key: 'accent', label: 'Destaque' },
  { key: 'text', label: 'Texto' },
  { key: 'position', label: 'Posição' },
  { key: 'time', label: 'Tempo' },
  { key: 'topCell', label: 'Linha 1' },
  { key: 'bottomCell', label: 'Linha 2' },
];

const PREVIEW_SCALES = [0.16, 0.25, 0.35, 0.5, 0.65, 0.75];
const RTSP_URL = 'rtsp://192.168.20.13:8554/tb50';
const HLS_URL = 'http://192.168.20.13:8888/tb50/index.m3u8';
const REAL_TELAO_PREVIEW_URL = '/placar-telao-tb50?layout=designer&controls=true';
const DEMO_TELAO_PREVIEW_URL = '/placar-telao-tb50?layout=designer&demo=true';
const FINAL_REAL_PREVIEW_URL = '/placar-telao-tb50?layout=designer&final=real&controls=true';
const demoSnapshot = createDemoSnapshot('Preview do designer');

const PALETTES: Array<{ label: string; colors: Partial<TelaoLayoutConfig['colors']> }> = [
  { label: 'Verde LED', colors: { background: '#000000', grid: '#303030', accent: '#04ff00', text: '#ffffff', position: '#04ff00', time: '#ffffff', topCell: '#000000', bottomCell: '#000000' } },
  { label: 'Alto contraste', colors: { background: '#000000', grid: '#666666', accent: '#ffff00', text: '#ffffff', position: '#ffff00', time: '#ffffff', topCell: '#050505', bottomCell: '#050505' } },
  { label: 'Branco limpo', colors: { background: '#000000', grid: '#505050', accent: '#ffffff', text: '#ffffff', position: '#00ff66', time: '#ffffff', topCell: '#000000', bottomCell: '#080808' } },
  { label: 'Vermelho alerta', colors: { background: '#050000', grid: '#5c1c1c', accent: '#ff3030', text: '#ffffff', position: '#ff3030', time: '#ffffff', topCell: '#070000', bottomCell: '#120000' } },
];

type PreviewMode = 'race' | 'long' | 'empty' | 'full';

type StoreStatus = {
  storage?: string;
  persistent?: boolean;
  blobConfigured?: boolean;
  remoteEndpoint?: string;
  lastBlobReadAt?: string | null;
  lastBlobWriteFailedAt?: string | null;
};

type DeliveryState = 'idle' | 'sending' | 'sent' | 'warning' | 'error';

type DeliveryStatus = {
  state: DeliveryState;
  title: string;
  detail: string;
  checkedAt?: string;
};

type TelaoPayloadVerification = {
  ok: boolean;
  hiddenFields: TelaoField[];
  driverCount: number;
  status?: LiveTimingSnapshot['status'];
};

type DisplayModeWriteResult = {
  persistent?: boolean;
};

const INITIAL_DELIVERY: DeliveryStatus = {
  state: 'idle',
  title: 'Aguardando envio',
  detail: 'Nenhum ajuste novo foi enviado nesta tela ainda.',
};

function updateLayout(layout: TelaoLayoutConfig, patch: Partial<TelaoLayoutConfig>): TelaoLayoutConfig {
  return normalizeTelaoLayoutConfig({ ...layout, ...patch });
}

function sameLayout(a: TelaoLayoutConfig, b: TelaoLayoutConfig | null): boolean {
  return Boolean(b) && JSON.stringify(a) === JSON.stringify(b);
}

function colorValue(value: string | undefined): string {
  return value && /^#[0-9a-fA-F]{6}$/.test(value) ? value : '#000000';
}

function variantLabel(layout: TelaoLayoutConfig): string {
  return layout.variant === 'cards' ? 'Cards' : 'Tabela';
}

function presetMatches(layout: TelaoLayoutConfig, preset: TelaoLayoutConfig): boolean {
  return (
    layout.id === preset.id &&
    layout.variant === preset.variant &&
    layout.columns === preset.columns &&
    layout.rows === preset.rows &&
    layout.nameMode === preset.nameMode &&
    layout.showHeader === preset.showHeader &&
    JSON.stringify(layout.fields) === JSON.stringify(preset.fields)
  );
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(Math.max(Math.round(value), min), max);
}

function deliveryTime(): string {
  return new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function hiddenFieldsLabel(fields: TelaoField[]): string {
  return fields.map((field) => FIELDS.find((item) => item.id === field)?.label || field).join(', ');
}

function verificationMessage(target: string, verification: TelaoPayloadVerification): string {
  if (verification.driverCount <= 0) {
    return `Layout salvo no ${target}, mas o snapshot real ainda não confirmou pilotos.`;
  }

  if (verification.hiddenFields.length > 0) {
    return `Layout salvo no ${target} e usando dados reais (${verification.driverCount} pilotos), mas ocultando: ${hiddenFieldsLabel(verification.hiddenFields)}.`;
  }

  return `Layout salvo no ${target}, confirmado em /placar-telao-tb50 e usando dados reais (${verification.driverCount} pilotos).`;
}

function makePreviewDrivers(mode: PreviewMode, capacity: number): LiveTimingDriver[] {
  if (mode === 'empty') return [];
  if (mode === 'race') return demoSnapshot.drivers.slice(0, capacity);

  const names =
    mode === 'long'
      ? ['ALEXANDRE MONTENEGRO', 'MARIA EDUARDA CASTRO', 'GUILHERME ALBUQUERQUE', 'ANA CLARA FIGUEIREDO', 'JOAO PEDRO NASCIMENTO']
      : ['THIAGO', 'MARCELLO', 'THIERRY', 'RAFAEL', 'VALERIA', 'JOAO', 'MARIA', 'LILLIAN', 'DAYANE', 'ERICA'];

  return Array.from({ length: capacity }, (_, index) => ({
    position: index + 1,
    kart: String(80 + index),
    name: names[index % names.length],
    time: `01:${String(16 + (index % 38)).padStart(2, '0')}.${String(38 + index).padStart(3, '0')}`,
  }));
}

function NumberControl({
  field,
  layout,
  onChange,
}: {
  field: (typeof NUMBER_FIELDS)[number];
  layout: TelaoLayoutConfig;
  onChange: (patch: Partial<TelaoLayoutConfig>) => void;
}) {
  const value = Number(layout[field.key]);

  return (
    <label className="designer-range">
      <span>
        <strong>{field.label}</strong>
        <em>
          {value}
          {field.unit || ''}
        </em>
      </span>
      <input type="range" min={field.min} max={field.max} value={value} onChange={(event) => onChange({ [field.key]: Number(event.target.value) } as Partial<TelaoLayoutConfig>)} />
      <input type="number" min={field.min} max={field.max} value={value} onChange={(event) => onChange({ [field.key]: Number(event.target.value) } as Partial<TelaoLayoutConfig>)} />
    </label>
  );
}

export function DesignerTelaoClient() {
  const [layout, setLayout] = useState<TelaoLayoutConfig>(DEFAULT_TELAO_LAYOUT);
  const [savedLayout, setSavedLayout] = useState<TelaoLayoutConfig | null>(null);
  const [store, setStore] = useState<StoreStatus>({});
  const [message, setMessage] = useState('Carregando configuração...');
  const [activePanel, setActivePanel] = useState<'layout' | 'fields' | 'colors' | 'json'>('layout');
  const [jsonText, setJsonText] = useState('');
  const [previewScale, setPreviewScale] = useState(0.35);
  const [previewMode, setPreviewMode] = useState<PreviewMode>('race');
  const [history, setHistory] = useState<TelaoLayoutConfig[]>([]);
  const [future, setFuture] = useState<TelaoLayoutConfig[]>([]);
  const [saving, setSaving] = useState(false);
  const [displaySending, setDisplaySending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [delivery, setDelivery] = useState<DeliveryStatus>(INITIAL_DELIVERY);

  const capacity = layout.columns * layout.rows;
  const previewRows = useMemo(() => makePreviewDrivers(previewMode, capacity), [previewMode, capacity]);
  const activePreset = useMemo(() => Object.values(TELAO_LAYOUT_PRESETS).find((preset) => presetMatches(layout, preset)), [layout]);
  const dirty = !sameLayout(layout, savedLayout);
  const canUndo = history.length > 0;
  const canRedo = future.length > 0;
  const storageLabel = store.remoteEndpoint ? 'Servidor local' : store.persistent ? 'Blob ativo' : store.storage || 'Storage';
  const previewStyle = {
    '--header-bg': layout.colors.grid,
    '--border-strong': layout.colors.accent,
    '--success': layout.colors.position,
    '--text': layout.colors.text,
    '--muted': layout.colors.muted,
    background: layout.colors.background,
  } as CSSProperties;

  async function load() {
    setLoading(true);
    try {
      const response = await fetch(`/api/telao-layout?_ts=${Date.now()}`, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      const nextLayout = normalizeTelaoLayoutConfig(data.layout);
      setLayout(nextLayout);
      setSavedLayout(nextLayout);
      setStore(data.store || {});
      setHistory([]);
      setFuture([]);
      setJsonText(JSON.stringify(nextLayout, null, 2));
      setMessage(data.store?.remoteEndpoint ? 'Configuração carregada do servidor local' : data.store?.persistent ? 'Configuração persistente carregada' : 'Configuração temporária carregada');
      setDelivery({
        state: 'idle',
        title: 'Layout carregado',
        detail: data.store?.remoteEndpoint ? 'Fonte atual: servidor local conectado à TB50.' : 'Fonte atual carregada; envie novamente para confirmar no telão.',
        checkedAt: deliveryTime(),
      });
    } catch (error) {
      setMessage(error instanceof Error ? `Falha ao carregar: ${error.message}` : 'Falha ao carregar');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 560px)');
    if (mediaQuery.matches) setPreviewScale(0.16);
  }, []);

  function applyLayout(nextLayout: TelaoLayoutConfig, nextMessage?: string) {
    setLayout((current) => {
      setHistory((items) => [...items.slice(-24), current]);
      setFuture([]);
      return normalizeTelaoLayoutConfig(nextLayout);
    });

    if (nextMessage) setMessage(nextMessage);
    setDelivery({
      state: 'idle',
      title: 'Ajuste pendente',
      detail: 'O preview mudou. Envie para atualizar a TB50 e o painel.',
    });
  }

  function patchLayout(patch: Partial<TelaoLayoutConfig>) {
    setLayout((current) => {
      const next = updateLayout(current, patch);
      setHistory((items) => [...items.slice(-24), current]);
      setFuture([]);
      return next;
    });
    setDelivery({
      state: 'idle',
      title: 'Ajuste pendente',
      detail: 'O preview mudou. Envie para atualizar a TB50 e o painel.',
    });
  }

  function patchColors(patch: Partial<TelaoLayoutConfig['colors']>) {
    setLayout((current) => {
      const next = normalizeTelaoLayoutConfig({ ...current, colors: { ...current.colors, ...patch } });
      setHistory((items) => [...items.slice(-24), current]);
      setFuture([]);
      return next;
    });
    setDelivery({
      state: 'idle',
      title: 'Ajuste pendente',
      detail: 'O preview mudou. Envie para atualizar a TB50 e o painel.',
    });
  }

  function undo() {
    if (!canUndo) return;
    setLayout((current) => {
      const previous = history[history.length - 1];
      setHistory((items) => items.slice(0, -1));
      setFuture((items) => [current, ...items].slice(0, 25));
      setMessage('Alteração desfeita');
      return previous;
    });
  }

  function redo() {
    if (!canRedo) return;
    setLayout((current) => {
      const [next, ...rest] = future;
      setFuture(rest);
      setHistory((items) => [...items.slice(-24), current]);
      setMessage('Alteração refeita');
      return next;
    });
  }

  async function verifyPublished() {
    setMessage('Verificando publicação...');
    setDelivery({
      state: 'sending',
      title: 'Verificando TB50',
      detail: 'Conferindo o layout salvo e o payload servido para o telão.',
    });
    try {
      const response = await fetch(`/api/telao-layout?_ts=${Date.now()}`, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      const remoteLayout = normalizeTelaoLayoutConfig(data.layout);
      setStore(data.store || {});
      const target = data.store?.remoteEndpoint ? 'servidor local' : 'storage publicado';
      const verification = await verifyTelaoPayload(remoteLayout);
      const verified = sameLayout(layout, remoteLayout);
      const layoutOk = verified && verification.ok;
      const hasHiddenRealData = verification.hiddenFields.length > 0;
      setMessage(layoutOk ? verificationMessage(target, verification) : `O ${target} ou o telão tem um layout diferente do preview atual`);
      setDelivery(
        layoutOk && !hasHiddenRealData
          ? {
              state: 'sent',
              title: 'Enviado para TB50 / painel LED',
              detail: verificationMessage(target, verification),
              checkedAt: deliveryTime(),
            }
          : layoutOk && hasHiddenRealData
            ? {
                state: 'warning',
                title: 'Dados reais ocultos pelo layout',
                detail: verificationMessage(target, verification),
                checkedAt: deliveryTime(),
              }
          : {
              state: 'warning',
              title: 'Envio não confirmado',
              detail: 'O layout salvo ou a rota do telão ainda não bate com o preview.',
              checkedAt: deliveryTime(),
            },
      );
    } catch (error) {
      setMessage(error instanceof Error ? `Falha na verificação: ${error.message}` : 'Falha na verificação');
      setDelivery({
        state: 'error',
        title: 'Falha ao verificar envio',
        detail: error instanceof Error ? error.message : 'Erro desconhecido',
        checkedAt: deliveryTime(),
      });
    }
  }

  function adjustFonts(delta: number) {
    patchLayout({
      positionFontSize: clampNumber(layout.positionFontSize + delta, 10, 250),
      kartFontSize: clampNumber(layout.kartFontSize + delta, 10, 250),
      nameFontSize: clampNumber(layout.nameFontSize + delta, 10, 80),
      timeFontSize: clampNumber(layout.timeFontSize + delta, 10, 80),
    });
  }

  function compactLayout() {
    patchLayout({
      cellGap: 0,
      borderWidth: Math.max(1, layout.borderWidth - 1),
      lineWidth: Math.max(1, layout.lineWidth - 1),
      positionFontSize: clampNumber(layout.positionFontSize - 2, 10, 250),
      kartFontSize: clampNumber(layout.kartFontSize - 2, 10, 250),
      nameFontSize: clampNumber(layout.nameFontSize - 2, 10, 80),
      timeFontSize: clampNumber(layout.timeFontSize - 2, 10, 80),
    });
  }

  async function copyText(text: string, label: string) {
    await navigator.clipboard?.writeText(text).catch(() => undefined);
    setMessage(`${label} copiado`);
  }

  async function save(targetLayout: TelaoLayoutConfig = layout) {
    setSaving(true);
    setMessage('Salvando...');
    setDelivery({
      state: 'sending',
      title: 'Enviando para TB50',
      detail: 'Salvando layout, voltando a rota para cronometragem ao vivo e conferindo o telão.',
    });

    try {
      const response = await fetch('/api/telao-layout', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(targetLayout),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) throw new Error(data?.error ? `HTTP ${response.status}: ${data.error}` : `HTTP ${response.status}`);

      await writeDisplayMode('live');
      const nextLayout = normalizeTelaoLayoutConfig(data.layout);
      setLayout(nextLayout);
      setSavedLayout(nextLayout);
      setStore(data.store || { storage: data.storage, persistent: data.persistent });
      setHistory([]);
      setFuture([]);
      setJsonText(JSON.stringify(nextLayout, null, 2));
      const verifyResponse = await fetch(`/api/telao-layout?_ts=${Date.now()}`, { cache: 'no-store' });
      const verifyData = verifyResponse.ok ? await verifyResponse.json() : null;
      const verified = verifyData ? sameLayout(nextLayout, normalizeTelaoLayoutConfig(verifyData.layout)) : false;
      const verification = verified ? await verifyTelaoPayload(nextLayout) : { ok: false, hiddenFields: [], driverCount: 0 };
      const target = data.store?.remoteEndpoint ? 'servidor local' : 'storage publicado';
      const layoutOk = data.persistent && verified && verification.ok;
      const hasHiddenRealData = verification.hiddenFields.length > 0;
      setMessage(layoutOk ? verificationMessage(target, verification) : data.persistent ? `Configuração salva no ${target}, mas a rota do telão ainda não confirmou` : 'Configuração temporária enviada');
      setDelivery(
        layoutOk && !hasHiddenRealData
          ? {
              state: 'sent',
              title: 'Enviado para TB50 / painel LED',
              detail: verificationMessage(target, verification),
              checkedAt: deliveryTime(),
            }
          : layoutOk && hasHiddenRealData
            ? {
                state: 'warning',
                title: 'Dados reais ocultos pelo layout',
                detail: verificationMessage(target, verification),
                checkedAt: deliveryTime(),
              }
          : {
              state: 'warning',
              title: 'Envio parcialmente confirmado',
              detail: data.persistent ? 'Layout salvo, mas a rota do telão ainda não confirmou esse ajuste.' : 'Layout não ficou persistente no servidor.',
              checkedAt: deliveryTime(),
            },
      );
    } catch (error) {
      setMessage(error instanceof Error ? `Falha ao salvar: ${error.message}` : 'Falha ao salvar');
      setDelivery({
        state: 'error',
        title: 'Não enviado para TB50',
        detail: error instanceof Error ? error.message : 'Falha ao salvar layout.',
        checkedAt: deliveryTime(),
      });
    } finally {
      setSaving(false);
    }
  }

  async function standardizeDefaultLayout() {
    const nextLayout = normalizeTelaoLayoutConfig(DEFAULT_TELAO_LAYOUT);
    setLayout(nextLayout);
    setJsonText(JSON.stringify(nextLayout, null, 2));
    await save(nextLayout);
  }

  async function writeDisplayMode(mode: 'live' | 'final-real'): Promise<DisplayModeWriteResult> {
    const response = await fetch('/api/tb50-display-mode', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode }),
    });
    const data = (await response.json().catch(() => ({}))) as DisplayModeWriteResult & { error?: string };

    if (!response.ok) throw new Error(data?.error ? `HTTP ${response.status}: ${data.error}` : `HTTP ${response.status}`);

    return data;
  }

  async function sendDisplayMode(mode: 'live' | 'final-real', successTitle: string, successDetail: string) {
    setDisplaySending(true);
    setMessage('Enviando modo do telão...');
    setDelivery({
      state: 'sending',
      title: 'Enviando para TB50',
      detail: 'Atualizando o modo manual servido pela rota do telão.',
    });

    try {
      const data = await writeDisplayMode(mode);

      setMessage(successTitle);
      setDelivery({
        state: data.persistent ? 'sent' : 'warning',
        title: successTitle,
        detail: data.persistent ? successDetail : 'Modo aplicado em memória; confirme no preview do telão.',
        checkedAt: deliveryTime(),
      });
    } catch (error) {
      setMessage(error instanceof Error ? `Falha ao enviar modo: ${error.message}` : 'Falha ao enviar modo');
      setDelivery({
        state: 'error',
        title: 'Modo não enviado',
        detail: error instanceof Error ? error.message : 'Falha ao atualizar o modo do telão.',
        checkedAt: deliveryTime(),
      });
    } finally {
      setDisplaySending(false);
    }
  }

  async function verifyTelaoPayload(targetLayout: TelaoLayoutConfig): Promise<TelaoPayloadVerification> {
    const [payloadResponse, snapshotResponse] = await Promise.all([
      fetch(`/placar-telao-tb50?layout=designer&_format=json&_ts=${Date.now()}`, { cache: 'no-store' }),
      fetch(`/api/livetime-snapshot?_ts=${Date.now()}`, { cache: 'no-store' }).catch(() => null),
    ]);
    const snapshot = snapshotResponse?.ok ? ((await snapshotResponse.json().catch(() => null)) as LiveTimingSnapshot | null) : null;

    if (!payloadResponse.ok) {
      return {
        ok: false,
        hiddenFields: hiddenRealDataFields(snapshot, targetLayout),
        driverCount: snapshot?.drivers.length || 0,
        status: snapshot?.status,
      };
    }

    return {
      ok: payloadMatchesTelaoLayout(await payloadResponse.json(), targetLayout) && Boolean(snapshot?.drivers.length),
      hiddenFields: hiddenRealDataFields(snapshot, targetLayout),
      driverCount: snapshot?.drivers.length || 0,
      status: snapshot?.status,
    };
  }

  function toggleField(field: TelaoField) {
    const fields = layout.fields.includes(field) ? layout.fields.filter((item) => item !== field) : [...layout.fields, field];
    patchLayout({ fields });
  }

  function moveField(field: TelaoField, direction: -1 | 1) {
    const index = layout.fields.indexOf(field);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= layout.fields.length) return;

    const fields = [...layout.fields];
    const [removed] = fields.splice(index, 1);
    fields.splice(nextIndex, 0, removed);
    patchLayout({ fields });
  }

  function applyJson() {
    try {
      const parsed = JSON.parse(jsonText);
      const nextLayout = normalizeTelaoLayoutConfig(parsed);
      applyLayout(nextLayout);
      setJsonText(JSON.stringify(nextLayout, null, 2));
      setMessage('JSON aplicado ao preview');
    } catch (error) {
      setMessage(error instanceof Error ? `JSON inválido: ${error.message}` : 'JSON inválido');
    }
  }

  async function copyJson() {
    const text = JSON.stringify(layout, null, 2);
    setJsonText(text);
    await navigator.clipboard?.writeText(text).catch(() => undefined);
    setMessage('JSON atualizado');
  }

  return (
    <main className="designer-page">
      <section className="designer-controls" aria-label="Controles do designer">
        <header className="designer-hero">
          <div>
            <span className="designer-kicker">TB50 / 2048 × 512</span>
            <h1>Designer do telão</h1>
          </div>
          <div className={`designer-status ${dirty ? 'designer-status-dirty' : 'designer-status-saved'}`}>{dirty ? 'Não enviado' : 'Publicado'}</div>
        </header>

        <div className="designer-summary" aria-label="Resumo do layout">
          <span>{variantLabel(layout)}</span>
          <strong>
            {layout.columns} x {layout.rows}
          </strong>
          <span>{capacity} pilotos</span>
          <span>{activePreset ? 'Preset' : 'Personalizado'}</span>
          <span>{storageLabel}</span>
        </div>

        <div className="designer-actions">
          <button className="designer-save" type="button" aria-busy={saving} disabled={saving || loading} onClick={() => void save()}>
            {saving ? 'Enviando…' : 'Enviar para o telão'}
          </button>
          <button type="button" onClick={() => void standardizeDefaultLayout()} disabled={saving || loading}>
            Padronizar layout
          </button>
          <button type="button" onClick={() => void load()} disabled={loading || saving}>
            Recarregar
          </button>
          <button type="button" onClick={undo} disabled={!canUndo || saving}>
            Desfazer
          </button>
          <button type="button" onClick={redo} disabled={!canRedo || saving}>
            Refazer
          </button>
          <button type="button" onClick={() => void verifyPublished()} disabled={saving}>
            Verificar
          </button>
          <a href={REAL_TELAO_PREVIEW_URL} target="_blank" rel="noreferrer">
            Abrir preview
          </a>
          <a href={FINAL_REAL_PREVIEW_URL} target="_blank" rel="noreferrer">
            Visualização pódio final
          </a>
          <button type="button" onClick={() => void sendDisplayMode('final-real', 'Pódio final enviado ao telão', 'A rota do telão foi alternada para o pódio final da corrida com dados reais.')} disabled={saving || displaySending}>
            Enviar pódio final ao telão
          </button>
          <button type="button" onClick={() => void sendDisplayMode('live', 'Placar ao vivo enviado ao telão', 'A rota do telão voltou para a cronometragem ao vivo.')} disabled={saving || displaySending}>
            Voltar ao vivo
          </button>
        </div>

        <p className="designer-message">{message}</p>
        <div className={`designer-delivery designer-delivery-${delivery.state}`} role="status" aria-live="polite">
          <strong>{delivery.title}</strong>
          <span>{delivery.detail}</span>
          {delivery.checkedAt ? <em>{delivery.checkedAt}</em> : null}
        </div>

        <section className="designer-section">
          <h2>Ajustes rápidos</h2>
          <div className="designer-quick-grid">
            <button type="button" onClick={() => applyLayout(TELAO_LAYOUT_PRESETS['tb50-live-21'], 'Preset TB50 aplicado ao preview')}>
              TB50 21
            </button>
            <button type="button" onClick={() => applyLayout(DEFAULT_TELAO_LAYOUT, 'Padrão 20 pilotos aplicado ao preview')}>
              Padrão 20
            </button>
            <button type="button" onClick={() => adjustFonts(2)}>
              Fonte +2
            </button>
            <button type="button" onClick={() => adjustFonts(-2)}>
              Fonte -2
            </button>
            <button type="button" onClick={compactLayout}>
              Compactar
            </button>
            <button type="button" onClick={() => patchLayout({ showHeader: !layout.showHeader })}>
              {layout.showHeader ? 'Sem logo' : 'Com logo'}
            </button>
            <button type="button" onClick={() => patchLayout({ nameMode: layout.nameMode === 'hidden' ? 'first' : 'hidden' })}>
              {layout.nameMode === 'hidden' ? 'Mostrar nome' : 'Ocultar nome'}
            </button>
          </div>
        </section>

        <section className="designer-section">
          <h2>Presets</h2>
          <div className="designer-preset-grid">
            {Object.values(TELAO_LAYOUT_PRESETS).map((preset) => (
              <button className={presetMatches(layout, preset) ? 'active' : ''} key={preset.id} type="button" onClick={() => applyLayout(preset)}>
                <strong>{preset.label}</strong>
                <span>
                  {preset.columns} x {preset.rows} / {variantLabel(preset)}
                </span>
              </button>
            ))}
          </div>
        </section>

        <nav className="designer-tabs" aria-label="Paineis">
          {[
            ['layout', 'Layout'],
            ['fields', 'Campos'],
            ['colors', 'Cores'],
            ['json', 'JSON'],
          ].map(([id, label]) => (
            <button className={activePanel === id ? 'active' : ''} key={id} type="button" onClick={() => setActivePanel(id as typeof activePanel)}>
              {label}
            </button>
          ))}
        </nav>

        {activePanel === 'layout' ? (
          <section className="designer-section">
            <h2>Layout</h2>
            <label className="designer-field designer-field-wide">
              <span>Nome</span>
              <input value={layout.label} onChange={(event) => patchLayout({ label: event.target.value })} />
            </label>
            <div className="designer-segment">
              <button className={layout.variant === 'table' ? 'active' : ''} type="button" onClick={() => patchLayout({ variant: 'table' })}>
                Tabela
              </button>
              <button className={layout.variant === 'cards' ? 'active' : ''} type="button" onClick={() => patchLayout({ variant: 'cards' })}>
                Cards
              </button>
            </div>
            {NUMBER_FIELDS.slice(0, 5).map((field) => (
              <NumberControl field={field} key={field.key} layout={layout} onChange={patchLayout} />
            ))}
            <label className="designer-check">
              <input type="checkbox" checked={layout.showHeader} onChange={(event) => patchLayout({ showHeader: event.target.checked })} />
              <span>Cabeçalho com logo</span>
            </label>
          </section>
        ) : null}

        {activePanel === 'fields' ? (
          <section className="designer-section">
            <h2>Campos</h2>
            <div className="designer-field-list">
              {FIELDS.map((field) => {
                const enabled = layout.fields.includes(field.id);
                return (
                  <div className={enabled ? 'enabled' : ''} key={field.id}>
                    <label className="designer-check">
                      <input type="checkbox" checked={enabled} onChange={() => toggleField(field.id)} />
                      <span>
                        <strong>{field.short}</strong>
                        {field.label}
                      </span>
                    </label>
                    <button type="button" disabled={!enabled} onClick={() => moveField(field.id, -1)}>
                      Subir
                    </button>
                    <button type="button" disabled={!enabled} onClick={() => moveField(field.id, 1)}>
                      Descer
                    </button>
                  </div>
                );
              })}
            </div>
            <label className="designer-field">
              <span>Exibição do nome</span>
              <select value={layout.nameMode} onChange={(event) => patchLayout({ nameMode: event.target.value as TelaoLayoutConfig['nameMode'] })}>
                <option value="hidden">Não mostrar</option>
                <option value="first">Primeiro nome</option>
                <option value="full">Nome completo</option>
              </select>
            </label>
            {NUMBER_FIELDS.slice(5).map((field) => (
              <NumberControl field={field} key={field.key} layout={layout} onChange={patchLayout} />
            ))}
          </section>
        ) : null}

        {activePanel === 'colors' ? (
          <section className="designer-section">
            <h2>Cores</h2>
            <div className="designer-palette-grid">
              {PALETTES.map((palette) => (
                <button key={palette.label} type="button" onClick={() => patchColors(palette.colors)}>
                  <span className="designer-palette-swatch" style={{ background: palette.colors.accent }} />
                  {palette.label}
                </button>
              ))}
            </div>
            <div className="designer-color-grid">
              {COLOR_FIELDS.map((field) => {
                const value = layout.colors[field.key] || '';
                return (
                  <label className="designer-color" key={field.key}>
                    <span>{field.label}</span>
                    <input type="color" value={colorValue(value)} onChange={(event) => patchColors({ [field.key]: event.target.value })} />
                    <input value={value} onChange={(event) => patchColors({ [field.key]: event.target.value })} />
                  </label>
                );
              })}
            </div>
            <label className="designer-field designer-field-wide">
              <span>Vazio</span>
              <input value={layout.colors.muted} onChange={(event) => patchColors({ muted: event.target.value })} />
            </label>
          </section>
        ) : null}

        {activePanel === 'json' ? (
          <section className="designer-section">
            <h2>JSON</h2>
            <textarea className="designer-json" value={jsonText} spellCheck={false} onChange={(event) => setJsonText(event.target.value)} />
            <div className="designer-actions">
              <button type="button" onClick={() => void copyJson()}>
                Exportar
              </button>
              <button type="button" onClick={applyJson}>
                Aplicar
              </button>
              <button type="button" onClick={() => applyLayout(DEFAULT_TELAO_LAYOUT)}>
                Padrao
              </button>
            </div>
          </section>
        ) : null}
      </section>

      <section className="designer-preview-area" aria-label="Preview do telão">
        <div className="designer-preview-toolbar">
          <div>
            <strong>{layout.label}</strong>
            <span>
              {layout.columns} x {layout.rows} / {capacity} pilotos / {layout.fields.join(' + ')}
            </span>
          </div>
          <div className="designer-scale">
            {[
              ['race', 'Corrida'],
              ['long', 'Nomes longos'],
              ['empty', 'Vazio'],
              ['full', 'Cheio'],
            ].map(([mode, label]) => (
              <button className={previewMode === mode ? 'active' : ''} key={mode} type="button" onClick={() => setPreviewMode(mode as PreviewMode)}>
                {label}
              </button>
            ))}
            {PREVIEW_SCALES.map((scale) => (
              <button className={previewScale === scale ? 'active' : ''} key={scale} type="button" onClick={() => setPreviewScale(scale)}>
                {Math.round(scale * 100)}%
              </button>
            ))}
          </div>
        </div>

        <div className="designer-preview-scroll">
          <div className="designer-preview-shell" style={{ width: 2048 * previewScale, height: 512 * previewScale }}>
            <div className="designer-preview-scale" style={{ transform: `scale(${previewScale})` }}>
              <div className={`telao-page telao-theme-dark ${layout.showHeader ? '' : 'telao-no-header'}`} style={previewStyle}>
                {layout.showHeader ? (
                  <header className="telao-status" style={{ background: layout.colors.background }}>
                    <div className="telao-brand" aria-label="Kartódromo de Betim">
                      <img className="telao-logo" src="/brand/kartodromo-betim-logo.png" alt="Kartódromo Internacional de Betim" />
                    </div>
                    <div className="telao-track">
                      <span>PREVIEW DO DESIGNER</span>
                      <strong>TELÃO LED 2048×512</strong>
                    </div>
                    <div className="telao-race-state">
                      <div className="telao-badge telao-badge-demo">DEMO</div>
                      <div className="telao-updated">00:00:00</div>
                    </div>
                  </header>
                ) : null}
                <section className="telao-table-wrap" style={{ background: layout.colors.background }}>
                  <LiveTimingTable drivers={previewRows} layout={layout} />
                </section>
              </div>
            </div>
          </div>
        </div>

        <div className="designer-output-grid">
          <a href="/api/telao-layout" target="_blank" rel="noreferrer">
            API layout
          </a>
          <a href={DEMO_TELAO_PREVIEW_URL} target="_blank" rel="noreferrer">
            Telão demo
          </a>
          <a href={FINAL_REAL_PREVIEW_URL} target="_blank" rel="noreferrer">
            Pódio final real
          </a>
          <button type="button" onClick={() => void copyText(RTSP_URL, 'RTSP')}>
            RTSP: {RTSP_URL}
          </button>
          <button type="button" onClick={() => void copyText(HLS_URL, 'HLS')}>
            HLS: {HLS_URL}
          </button>
        </div>
      </section>
    </main>
  );
}
