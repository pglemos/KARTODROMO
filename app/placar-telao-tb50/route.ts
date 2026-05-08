import { NextRequest, NextResponse } from 'next/server';
import { createDemoSnapshot, DEFAULT_UID } from '@/lib/livetime/demo-data';
import { driversByPosition } from '@/lib/livetime/layout';
import { getLastSnapshot, isFresh, setLastSnapshot } from '@/lib/livetime/snapshot-cache';
import { fetchExternalSnapshot } from '@/lib/livetime/snapshot-service';
import { DEFAULT_TELAO_LAYOUT, TELAO_LAYOUT_PRESETS, firstDriverName, type TelaoField, type TelaoLayoutConfig } from '@/lib/telao-layout-config';
import { readTelaoLayoutConfig } from '@/lib/telao-layout-store';
import type { LiveTimingDriver, LiveTimingSnapshot } from '@/lib/livetime/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const NO_CACHE_HEADERS = {
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
  Expires: '0',
  Pragma: 'no-cache',
  'Surrogate-Control': 'no-store',
};

const LABELS: Record<LiveTimingSnapshot['status'], string> = {
  live: 'AO VIVO',
  demo: 'DEMO',
  waiting: 'SEM DADOS',
  empty: 'SEM DADOS',
  error: 'ERRO',
};

const FIELD_LABELS: Record<TelaoField, string> = {
  position: 'P',
  kart: '#',
  name: 'NOME',
  time: 'TIME',
};

const FIELD_WEIGHTS: Record<TelaoField, number> = {
  position: 10,
  kart: 14,
  name: 42,
  time: 34,
};

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function visibleFields(layout: TelaoLayoutConfig): TelaoField[] {
  return layout.fields.filter((field) => field !== 'name' || layout.nameMode !== 'hidden');
}

function timeLabel(snapshot: LiveTimingSnapshot): string {
  const date = new Date(snapshot.updatedAt);
  const safeDate = Number.isNaN(date.getTime()) || snapshot.updatedAt === '1970-01-01T00:00:00.000Z' ? new Date() : date;
  return safeDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function positionForCell(layout: TelaoLayoutConfig, rowIndex: number, columnIndex: number): number {
  if (layout.variant === 'cards') return rowIndex * layout.columns + columnIndex + 1;
  return columnIndex * layout.rows + rowIndex + 1;
}

function fieldValue(field: TelaoField, position: number, driver: LiveTimingDriver | undefined, layout: TelaoLayoutConfig): string {
  if (field === 'position') return String(position);
  if (field === 'kart') return driver?.kart || '-';
  if (field === 'name') return firstDriverName(driver?.name, layout.nameMode);
  return driver?.time || '';
}

function layoutForRequest(request: NextRequest): TelaoLayoutConfig {
  const requestedLayout = request.nextUrl.searchParams.get('layout') || request.nextUrl.searchParams.get('preset');

  if (requestedLayout === 'designer' || requestedLayout === 'custom') {
    return readTelaoLayoutConfig();
  }

  if (requestedLayout && TELAO_LAYOUT_PRESETS[requestedLayout]) {
    return TELAO_LAYOUT_PRESETS[requestedLayout];
  }

  return DEFAULT_TELAO_LAYOUT;
}

async function loadSnapshot(uid: string, demoRequested: boolean): Promise<LiveTimingSnapshot> {
  if (demoRequested) return createDemoSnapshot('Demo solicitado');

  if (!process.env.LIVETIME_SNAPSHOT_ENDPOINT && process.env.NODE_ENV === 'production') {
    return {
      status: 'error',
      source: 'dom-scraper',
      updatedAt: new Date().toISOString(),
      message: 'LIVETIME_SNAPSHOT_ENDPOINT nao configurado em producao',
      drivers: [],
    };
  }

  try {
    const snapshot = await fetchExternalSnapshot(uid);
    if (snapshot.drivers.length > 0) setLastSnapshot(snapshot);
    return snapshot;
  } catch (error) {
    const cached = getLastSnapshot();
    if (cached && isFresh(cached, Number(process.env.LIVETIME_CACHE_TTL_MS || '10000'))) {
      return { ...cached, status: 'error', source: 'cache', message: error instanceof Error ? error.message : 'Erro temporario no snapshot' };
    }

    return {
      status: 'error',
      source: 'dom-scraper',
      updatedAt: new Date().toISOString(),
      message: error instanceof Error ? error.message : 'Erro ao obter snapshot',
      drivers: [],
    };
  }
}

function renderTable(drivers: LiveTimingDriver[], layout: TelaoLayoutConfig): string {
  const mapped = driversByPosition(drivers);
  const fields = visibleFields(layout);
  const totalWeight = fields.reduce((sum, field) => sum + FIELD_WEIGHTS[field], 0);
  const cols = Array.from({ length: layout.columns }, () =>
    fields.map((field) => `<col style="width:${FIELD_WEIGHTS[field] / totalWeight / layout.columns * 100}%">`).join(''),
  ).join('');
  const head = Array.from({ length: layout.columns }, () => fields.map((field) => `<th>${FIELD_LABELS[field]}</th>`).join('')).join('');
  const body = Array.from({ length: layout.rows }, (_, rowIndex) => {
    const cells = Array.from({ length: layout.columns }, (_, columnIndex) => {
      const position = positionForCell(layout, rowIndex, columnIndex);
      const driver = mapped.get(position);
      const state = driver ? 'filled' : 'empty';
      const leader = position === 1 && driver ? ' leader' : '';
      return fields
        .map((field) => `<td class="${state}${leader} ${field}">${escapeHtml(fieldValue(field, position, driver, layout))}</td>`)
        .join('');
    }).join('');
    return `<tr>${cells}</tr>`;
  }).join('');

  return `<table><colgroup>${cols}</colgroup><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

function renderCards(drivers: LiveTimingDriver[], layout: TelaoLayoutConfig): string {
  const mapped = driversByPosition(drivers);
  const fields = visibleFields(layout);

  return `<div class="cards">${Array.from({ length: layout.rows }, (_, rowIndex) =>
    Array.from({ length: layout.columns }, (_, columnIndex) => {
      const position = positionForCell(layout, rowIndex, columnIndex);
      const driver = mapped.get(position);
      const state = driver ? 'filled' : 'empty';
      const leader = position === 1 && driver ? ' leader' : '';
      const values = fields.map((field) => `<span class="${field}">${escapeHtml(fieldValue(field, position, driver, layout))}</span>`).join('');
      return `<div class="card ${state}${leader}">${values}</div>`;
    }).join(''),
  ).join('')}</div>`;
}

function renderCss(layout: TelaoLayoutConfig): string {
  return `*{box-sizing:border-box}html,body{width:2048px;height:512px;margin:0;overflow:hidden;background:${layout.colors.background};color:${layout.colors.text};font-family:Arial,Helvetica,sans-serif}.screen{width:2048px;height:512px;overflow:hidden;background:${layout.colors.background}}.top{height:86px;display:grid;grid-template-columns:330px 1fr 330px;gap:24px;align-items:center;padding:0 22px;border-bottom:3px solid ${layout.colors.grid};box-shadow:inset 0 -1px 0 ${layout.colors.accent};background:${layout.colors.background}}.logo{height:76px;width:auto;display:block}.info{min-width:0;padding-left:24px;border-left:2px solid ${layout.colors.accent};text-transform:uppercase;white-space:nowrap;overflow:hidden}.event{display:block;color:${layout.colors.accent};font-size:20px;font-weight:900;line-height:1;overflow:hidden;text-overflow:clip}.track{display:block;color:${layout.colors.text};font-size:34px;font-weight:900;line-height:1.12;margin-top:5px;overflow:hidden;text-overflow:clip}.state{display:grid;grid-template-columns:180px 126px;gap:12px;justify-content:end}.badge,.clock{height:46px;display:flex;align-items:center;justify-content:center;border:2px solid ${layout.colors.grid};border-radius:8px;background:${layout.colors.background};font-size:22px;font-weight:900;line-height:1;font-variant-numeric:tabular-nums}.badge{color:${layout.colors.time}}.clock{color:${layout.colors.text};border-color:rgba(255,255,255,.32)}.wrap{width:2048px;height:${layout.showHeader ? '426px' : '512px'};padding:${layout.showHeader ? '10px 12px 12px' : '12px'};background:${layout.colors.background};overflow:hidden}table{width:2024px;height:100%;table-layout:fixed;border-collapse:separate;border-spacing:0;border:${layout.borderWidth}px solid ${layout.colors.grid};background:${layout.colors.background};color:${layout.colors.text};text-transform:uppercase;font-weight:900;font-variant-numeric:tabular-nums}th,td{height:calc((100% - 36px) / ${layout.rows});border-right:1px solid ${layout.colors.grid};border-bottom:1px solid ${layout.colors.grid};padding:0 2px;overflow:hidden;white-space:nowrap;text-overflow:clip;line-height:1;vertical-align:middle;background:${layout.colors.background}}th{height:36px;color:${layout.colors.accent};font-size:${layout.headerFontSize}px;text-align:center;border-bottom:2px solid ${layout.colors.accent}}.position{text-align:center;color:${layout.colors.position};font-size:${layout.positionFontSize}px}.kart{text-align:center;color:${layout.colors.text};font-size:${layout.kartFontSize}px}.name{text-align:left;color:${layout.colors.text};font-size:${layout.nameFontSize}px;padding-left:6px;padding-right:4px}.time{text-align:center;color:${layout.colors.time};font-size:${layout.timeFontSize}px}.leader.position,.leader.kart,.leader.name{color:${layout.colors.position}}.leader.time{color:${layout.colors.text}}.empty{color:${layout.colors.muted}}.cards{width:2024px;height:100%;display:grid;grid-template-columns:repeat(${layout.columns},minmax(0,1fr));grid-template-rows:repeat(${layout.rows},minmax(0,1fr));gap:${layout.cellGap}px;border:${layout.borderWidth}px solid ${layout.colors.grid};background:${layout.colors.background};font-weight:900;text-transform:uppercase;font-variant-numeric:tabular-nums}.card{min-width:0;min-height:0;display:grid;align-content:center;justify-items:center;gap:6px;padding:6px 8px;border-right:1px solid ${layout.colors.grid};border-bottom:1px solid ${layout.colors.grid};background:${layout.colors.topCell || layout.colors.background};overflow:hidden}.card:nth-child(n+${layout.columns + 1}){background:${layout.colors.bottomCell || layout.colors.background}}.card span{max-width:100%;overflow:hidden;white-space:nowrap;text-overflow:clip;line-height:1}.card .position{font-size:${layout.positionFontSize}px}.card .kart{font-size:${layout.kartFontSize}px}.card .name{font-size:${layout.nameFontSize}px;text-align:center}.card .time{font-size:${layout.timeFontSize}px}.card.leader .position,.card.leader .kart,.card.leader .name{color:${layout.colors.position}}.card.empty span{color:${layout.colors.muted}}`;
}

function renderHtml(snapshot: LiveTimingSnapshot, uid: string, demoRequested: boolean, request: NextRequest, layout: TelaoLayoutConfig): string {
  const currentUrl = new URL(request.url);
  currentUrl.searchParams.set('uid', uid);
  currentUrl.searchParams.set('_r', String(Date.now() + 1000));
  if (demoRequested) currentUrl.searchParams.set('demo', 'true');
  const refreshUrl = `${currentUrl.pathname}${currentUrl.search}`;
  const eventName = snapshot.eventName || 'CRONOMETRAGEM AO VIVO';
  const trackName = snapshot.trackName || 'Kartodromo de Betim';
  const content = layout.variant === 'cards' ? renderCards(snapshot.drivers, layout) : renderTable(snapshot.drivers, layout);

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=2048,height=512,initial-scale=1,minimum-scale=1,maximum-scale=1,user-scalable=no"><meta http-equiv="cache-control" content="no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0"><meta http-equiv="pragma" content="no-cache"><meta http-equiv="expires" content="0"><meta http-equiv="refresh" content="1;url=${escapeHtml(refreshUrl)}"><title>Placar Telao TB50</title><style>${renderCss(layout)}</style></head><body><main class="screen">${layout.showHeader ? `<header class="top"><img class="logo" src="/brand/kartodromo-betim-logo.png" alt="Kartodromo Internacional de Betim"><div class="info"><span class="event">${escapeHtml(eventName)}</span><strong class="track">${escapeHtml(trackName)}</strong></div><div class="state"><div class="badge status-${snapshot.status}">${escapeHtml(LABELS[snapshot.status])}</div><div class="clock">${escapeHtml(timeLabel(snapshot))}</div></div></header>` : ''}<section class="wrap">${content}</section></main><script>setTimeout(function(){location.replace(${JSON.stringify(refreshUrl)});},1000);</script></body></html>`;
}

export async function GET(request: NextRequest) {
  const uid = request.nextUrl.searchParams.get('uid') || process.env.NEXT_PUBLIC_DEFAULT_UID || DEFAULT_UID;
  const demoRequested = request.nextUrl.searchParams.get('demo') === 'true' || process.env.LIVETIME_FORCE_DEMO === 'true';
  const layout = layoutForRequest(request);
  const snapshot = await loadSnapshot(uid, demoRequested);
  return new NextResponse(renderHtml(snapshot, uid, demoRequested, request, layout), { status: 200, headers: NO_CACHE_HEADERS });
}
