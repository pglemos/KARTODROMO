import { NextRequest, NextResponse } from 'next/server';
import { createDemoFinishedSnapshot, createDemoSnapshot, DEFAULT_UID } from '@/lib/livetime/demo-data';
import { driversByPosition } from '@/lib/livetime/layout';
import { canHoldLastSnapshot, canUseCachedSnapshot, getLastSnapshot, holdLastSnapshot, setLastSnapshot, shouldPreserveKartSnapshot } from '@/lib/livetime/snapshot-cache';
import { fetchExternalSnapshot } from '@/lib/livetime/snapshot-service';
import { isFinishedRaceSnapshot, isRaceSnapshot } from '@/lib/livetime/session-type';
import { DEFAULT_TELAO_LAYOUT, TELAO_LAYOUT_PRESETS, firstDriverName, type TelaoField, type TelaoLayoutConfig } from '@/lib/telao-layout-config';
import { readTelaoLayoutConfigFromRemote } from '@/lib/telao-layout-store';
import { fitCardNameFontSize } from '@/lib/telao-text-fit';
import { readTb50DisplayModeFromStore } from '@/lib/tb50-display-mode-store';
import { readTb50PageFromRemote, type Tb50PageState } from '@/lib/tb50-page-store';
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

const JSON_NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
  Expires: '0',
  Pragma: 'no-cache',
  'Surrogate-Control': 'no-store',
};

const LABELS: Record<LiveTimingSnapshot['status'], string> = {
  live: 'AO VIVO',
  demo: 'DEMO',
  finished: 'FIM',
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

function positionForCell(layout: TelaoLayoutConfig, rowIndex: number, columnIndex: number, pageOffset = 0): number {
  const basePosition = layout.variant === 'cards' ? rowIndex * layout.columns + columnIndex + 1 : columnIndex * layout.rows + rowIndex + 1;
  return pageOffset + basePosition;
}

function fieldValue(field: TelaoField, position: number, driver: LiveTimingDriver | undefined, layout: TelaoLayoutConfig): string {
  if (field === 'position') return String(position);
  if (field === 'kart') return driver?.kart || '-';
  if (field === 'name') return firstDriverName(driver?.name, layout.nameMode);
  return driver?.time || '';
}

function cardFieldAttrs(field: TelaoField, value: string, layout: TelaoLayoutConfig): string {
  if (field !== 'name' || !value) return '';
  const fontSize = fitCardNameFontSize({
    text: value,
    desiredFontSize: layout.nameFontSize,
    columns: layout.columns,
    cellGap: layout.cellGap,
    borderWidth: layout.borderWidth,
    lineWidth: layout.lineWidth,
  });

  return ` data-name-font-size="${layout.nameFontSize}" style="--fit-name-font-size:${fontSize}px"`;
}

async function layoutForRequest(request: NextRequest): Promise<TelaoLayoutConfig> {
  const requestedLayout = request.nextUrl.searchParams.get('layout') || request.nextUrl.searchParams.get('preset');

  if (!requestedLayout || requestedLayout === 'designer' || requestedLayout === 'custom' || requestedLayout === DEFAULT_TELAO_LAYOUT.id || requestedLayout === 'standard-30') {
    return readTelaoLayoutConfigFromRemote();
  }

  if (requestedLayout && TELAO_LAYOUT_PRESETS[requestedLayout]) {
    return TELAO_LAYOUT_PRESETS[requestedLayout];
  }

  return readTelaoLayoutConfigFromRemote();
}

function hasValueForField(driver: LiveTimingDriver, field: TelaoField, layout: TelaoLayoutConfig): boolean {
  if (field === 'position') return Number.isFinite(driver.position) && driver.position > 0;
  if (field === 'kart') return Boolean(driver.kart?.trim());
  if (field === 'name') return layout.nameMode === 'hidden' || Boolean(driver.name?.trim());
  return Boolean(driver.time?.trim());
}

function snapshotSupportsLayout(snapshot: LiveTimingSnapshot, layout: TelaoLayoutConfig): boolean {
  const fields = visibleFields(layout).filter((field) => field !== 'position');
  if (snapshot.drivers.length === 0) return false;
  if (fields.length === 0) return true;

  return snapshot.drivers.some((driver) => fields.every((field) => hasValueForField(driver, field, layout)));
}

function holdLayoutSnapshot(current: LiveTimingSnapshot, cached: LiveTimingSnapshot): LiveTimingSnapshot {
  return {
    ...holdLastSnapshot(current, cached),
    message: current.message || 'Mantendo ultimo resultado compativel com o layout do designer',
  };
}

async function loadSnapshot(uid: string, demoRequested: boolean, finalPreviewRequested: boolean, forceFinalFromLive: boolean, layout: TelaoLayoutConfig): Promise<LiveTimingSnapshot> {
  if (finalPreviewRequested) return createDemoFinishedSnapshot();
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
    if (snapshot.drivers.length > 0) {
      const cached = getLastSnapshot(uid);
      if (!snapshotSupportsLayout(snapshot, layout) && canUseCachedSnapshot(cached) && snapshotSupportsLayout(cached, layout)) {
        return holdLayoutSnapshot(snapshot, cached);
      }

      if (!shouldPreserveKartSnapshot(snapshot, cached)) setLastSnapshot(uid, snapshot);
      return snapshot;
    }

    const cached = getLastSnapshot(uid);
    if (cached?.drivers.length && snapshot.status === 'finished' && isRaceSnapshot(cached) && (forceFinalFromLive || isRaceSnapshot(snapshot))) {
      return {
        ...cached,
        status: 'finished',
        source: 'cache',
        message: snapshot.message || 'Resultado final usando ultimo grid valido',
      };
    }

    if (canHoldLastSnapshot(snapshot, cached)) {
      return holdLastSnapshot(snapshot, cached);
    }

    return snapshot;
  } catch (error) {
    const cached = getLastSnapshot(uid);
    if (canUseCachedSnapshot(cached)) {
      return forceFinalFromLive && isFinishedRaceSnapshot(cached)
        ? {
            ...cached,
            status: 'finished',
            source: 'cache',
            message: error instanceof Error ? error.message : 'Resultado final usando ultimo grid valido',
          }
        : {
            ...cached,
            status: 'error',
            source: 'cache',
            message: error instanceof Error ? error.message : 'Erro temporario no snapshot',
          };
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

async function resolveRequestedDisplayMode(request: NextRequest) {
  const finalParam = request.nextUrl.searchParams.get('final');
  const storedState = await readTb50DisplayModeFromStore();
  const storedMode = storedState.mode;
  const finalPreviewRequested = finalParam === 'true' || finalParam === 'demo' || (!finalParam && storedMode === 'final-demo');
  const forceFinalFromQuery = finalParam === 'real';
  const forceFinalFromStore = !finalParam && storedMode === 'final-real';
  // Modo automático desligado (auto=false) suprime o pódio automático — controla pelo /telao.
  const suppressAutoFinal = finalParam === 'live' || storedState.auto === false;

  return {
    finalPreviewRequested,
    forceFinalFromLive: forceFinalFromQuery || forceFinalFromStore,
    forceFinalFromStore,
    suppressAutoFinal,
  };
}

function shouldRenderFinalRaceVideo(snapshot: LiveTimingSnapshot, finalPreviewRequested: boolean, forceFinalFromLive: boolean, forceFinalFromStore: boolean, suppressAutoFinal: boolean): boolean {
  if (finalPreviewRequested) return true;
  if ((forceFinalFromLive || forceFinalFromStore) && isFinishedRaceSnapshot(snapshot)) return true;
  if (!suppressAutoFinal && isFinishedRaceSnapshot(snapshot)) return true;
  return false;
}

function renderTable(drivers: LiveTimingDriver[], layout: TelaoLayoutConfig, pageOffset = 0): string {
  const mapped = driversByPosition(drivers);
  const fields = visibleFields(layout);
  const totalWeight = fields.reduce((sum, field) => sum + FIELD_WEIGHTS[field], 0);
  const cols = Array.from({ length: layout.columns }, () =>
    fields.map((field) => `<col style="width:${FIELD_WEIGHTS[field] / totalWeight / layout.columns * 100}%">`).join(''),
  ).join('');
  const head = Array.from({ length: layout.columns }, () => fields.map((field) => `<th>${FIELD_LABELS[field]}</th>`).join('')).join('');
  const body = Array.from({ length: layout.rows }, (_, rowIndex) => {
    const cells = Array.from({ length: layout.columns }, (_, columnIndex) => {
      const position = positionForCell(layout, rowIndex, columnIndex, pageOffset);
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

function renderCards(drivers: LiveTimingDriver[], layout: TelaoLayoutConfig, pageOffset = 0): string {
  const mapped = driversByPosition(drivers);
  const fields = visibleFields(layout);

  return `<div class="cards">${Array.from({ length: layout.rows }, (_, rowIndex) =>
    Array.from({ length: layout.columns }, (_, columnIndex) => {
      const position = positionForCell(layout, rowIndex, columnIndex, pageOffset);
      const driver = mapped.get(position);
      const state = driver ? 'filled' : 'empty';
      const leader = position === 1 && driver ? ' leader' : '';
      const values = fields
        .map((field) => {
          const value = fieldValue(field, position, driver, layout);
          return `<span class="${field}"${cardFieldAttrs(field, value, layout)}>${escapeHtml(value)}</span>`;
        })
        .join('');
      return `<div class="card ${state}${leader}">${values}</div>`;
    }).join(''),
  ).join('')}</div>`;
}

function renderFinalRaceVideo(): string {
  return `<div class="final-race-stage final-race-frame-stage"><img class="final-race-frame" src="/final-race-frames/frame-000.jpg" alt=""></div>`;
}

function tableFontSizes(layout: TelaoLayoutConfig) {
  const crowdedTable = layout.variant === 'table' && layout.columns >= 6 && visibleFields(layout).length >= 4;
  if (!crowdedTable) {
    return {
      header: layout.headerFontSize,
      position: layout.positionFontSize,
      kart: layout.kartFontSize,
      name: layout.nameFontSize,
      time: layout.timeFontSize,
    };
  }

  return {
    header: Math.max(16, Math.floor(layout.headerFontSize * 0.9)),
    position: Math.max(18, Math.floor(layout.positionFontSize * 0.92)),
    kart: Math.max(20, Math.floor(layout.kartFontSize * 0.9)),
    name: Math.max(19, Math.floor(layout.nameFontSize * 0.86)),
    time: Math.max(18, Math.floor(layout.timeFontSize * 0.9)),
  };
}

function renderFinalSceneCss(): string {
  return `.final-race-stage{position:relative;width:2048px;height:512px;background:#000;overflow:hidden}.final-race-frame{position:absolute;inset:0;width:2048px;height:512px;display:block;background:#000;object-fit:fill}`;
}

function renderCss(layout: TelaoLayoutConfig, finalMode = false): string {
  const tableFonts = tableFontSizes(layout);
  const wrapHeight = finalMode || !layout.showHeader ? '512px' : '426px';
  const wrapPadding = finalMode ? '0' : layout.showHeader ? '10px 12px 12px' : '12px';
  return `*{box-sizing:border-box}html,body{width:2048px;height:512px;margin:0;overflow:hidden;background:${layout.colors.background};color:${layout.colors.text};font-family:'Rajdhani','Arial Narrow',Arial,Helvetica,sans-serif}.screen{width:2048px;height:512px;overflow:hidden;background:${layout.colors.background}}.top{height:86px;display:grid;grid-template-columns:330px 1fr 330px;gap:24px;align-items:center;padding:0 22px;border-bottom:1px solid ${layout.colors.grid};box-shadow:inset 0 -1px 0 ${layout.colors.accent};background:${layout.colors.background}}.logo{height:76px;width:auto;display:block}.info{min-width:0;padding-left:24px;border-left:1px solid ${layout.colors.accent};text-transform:uppercase;white-space:nowrap;overflow:hidden}.event{display:block;color:${layout.colors.accent};font-size:20px;font-weight:900;line-height:1;overflow:hidden;text-overflow:clip}.track{display:block;color:${layout.colors.text};font-size:34px;font-weight:900;line-height:1.12;margin-top:5px;overflow:hidden;text-overflow:clip}.state{display:grid;grid-template-columns:180px 126px;gap:12px;justify-content:end}.badge,.clock{height:46px;display:flex;align-items:center;justify-content:center;border:2px solid ${layout.colors.grid};border-radius:8px;background:${layout.colors.background};font-size:22px;font-weight:900;line-height:1;font-variant-numeric:tabular-nums}.badge{color:${layout.colors.time}}.clock{color:${layout.colors.text};border-color:rgba(255,255,255,.32)}.wrap{width:2048px;height:${wrapHeight};padding:${wrapPadding};background:${layout.colors.background};overflow:hidden}${finalMode ? renderFinalSceneCss() : ''}table{width:2024px;height:100%;table-layout:fixed;border-collapse:separate;border-spacing:0;border:${layout.borderWidth}px solid ${layout.colors.grid};background:${layout.colors.background};color:${layout.colors.text};text-transform:uppercase;font-weight:900;font-variant-numeric:tabular-nums}th,td{height:calc((100% - 36px) / ${layout.rows});border-right:${layout.lineWidth}px solid ${layout.colors.grid};border-bottom:${layout.lineWidth}px solid ${layout.colors.grid};padding:0 4px;overflow:hidden;white-space:nowrap;text-overflow:clip;line-height:1;vertical-align:middle;background:${layout.colors.background}}th{height:36px;color:${layout.colors.accent};font-size:${tableFonts.header}px;text-align:center;border-bottom:${Math.max(1, layout.lineWidth)}px solid ${layout.colors.accent}}.position{text-align:center;color:${layout.colors.position};font-size:${tableFonts.position}px}.kart{text-align:center;color:${layout.colors.text};font-size:${tableFonts.kart}px}.name{text-align:left;color:${layout.colors.text};font-size:${tableFonts.name}px;padding-left:8px;padding-right:8px}.time{text-align:center;color:${layout.colors.time};font-size:${tableFonts.time}px;padding-left:6px;padding-right:6px}.empty{color:${layout.colors.muted}}.cards{width:2024px;height:100%;display:grid;grid-template-columns:repeat(${layout.columns},minmax(0,1fr));grid-template-rows:repeat(${layout.rows},minmax(0,1fr));gap:${layout.cellGap}px;border:${layout.borderWidth}px solid ${layout.colors.grid};background:${layout.colors.background};font-weight:900;text-transform:uppercase;font-variant-numeric:tabular-nums}.card{min-width:0;min-height:0;display:grid;align-content:center;justify-items:center;gap:6px;padding:6px 8px;border-right:${layout.lineWidth}px solid ${layout.colors.grid};border-bottom:${layout.lineWidth}px solid ${layout.colors.grid};background:${layout.colors.topCell || layout.colors.background};overflow:hidden}.card:nth-child(n+${layout.columns + 1}){background:${layout.colors.bottomCell || layout.colors.background}}.card span{width:100%;max-width:100%;overflow:hidden;white-space:nowrap;text-overflow:clip;line-height:1}.card .position{font-size:${layout.positionFontSize}px}.card .kart{font-size:${layout.kartFontSize}px}.card .name{font-size:var(--fit-name-font-size,${layout.nameFontSize}px);text-align:center}.card .time{font-size:${layout.timeFontSize}px}.card.empty span{color:${layout.colors.muted}}`;
}

function renderHeader(snapshot: LiveTimingSnapshot, layout: TelaoLayoutConfig): string {
  if (!layout.showHeader) return '';
  const eventName = snapshot.eventName || 'CRONOMETRAGEM AO VIVO';
  const trackName = snapshot.trackName || 'Kartodromo de Betim';

  return `<header class="top"><img class="logo" src="/brand/kartodromo-betim-logo.png" alt="Kartodromo Internacional de Betim"><div class="info"><span class="event">${escapeHtml(eventName)}</span><strong class="track">${escapeHtml(trackName)}</strong></div><div class="state"><div class="badge status-${snapshot.status}">${escapeHtml(LABELS[snapshot.status])}</div><div class="clock">${escapeHtml(timeLabel(snapshot))}</div></div></header>`;
}

function renderContent(snapshot: LiveTimingSnapshot, layout: TelaoLayoutConfig, finalRaceVideoRequested: boolean, pageOffset = 0): string {
  if (finalRaceVideoRequested) {
    return renderFinalRaceVideo();
  }

  return layout.variant === 'cards' ? renderCards(snapshot.drivers, layout, pageOffset) : renderTable(snapshot.drivers, layout, pageOffset);
}

function pageHasDrivers(snapshot: LiveTimingSnapshot, start: number, end: number): boolean {
  return snapshot.drivers.some((driver) => driver.position >= start && driver.position <= end);
}

function resolvePageOffset(snapshot: LiveTimingSnapshot, layout: TelaoLayoutConfig, requestedOffset: number): number {
  if (requestedOffset <= 0 || snapshot.drivers.length === 0) return Math.max(0, requestedOffset);

  const capacity = layout.columns * layout.rows;
  const start = requestedOffset + 1;
  const end = requestedOffset + capacity;

  return pageHasDrivers(snapshot, start, end) ? requestedOffset : 0;
}

function renderUpdatePayload(snapshot: LiveTimingSnapshot, layout: TelaoLayoutConfig, finalRaceVideoRequested = false, pageState?: Tb50PageState) {
  const effectiveLayout = layout;
  const requestedOffset = pageState?.offset || 0;
  const pageOffset = finalRaceVideoRequested ? 0 : resolvePageOffset(snapshot, effectiveLayout, requestedOffset);
  const contentUsable = finalRaceVideoRequested || snapshotSupportsLayout(snapshot, effectiveLayout);

  return {
    css: renderCss(effectiveLayout, finalRaceVideoRequested),
    header: finalRaceVideoRequested ? '' : renderHeader(snapshot, effectiveLayout),
    content: renderContent(snapshot, effectiveLayout, finalRaceVideoRequested, pageOffset),
    contentUsable,
    finalRedirect: finalRaceVideoRequested,
    page: {
      offset: pageOffset,
      start: pageOffset + 1,
      end: pageOffset + effectiveLayout.columns * effectiveLayout.rows,
    },
  };
}

function renderClientScript(uid: string, demoRequested: boolean, request: NextRequest): string {
  const params = new URLSearchParams();
  const finalParam = request.nextUrl.searchParams.get('final');
  const realFinalRequested = finalParam === 'real';
  params.set('uid', uid);
  params.set('layout', request.nextUrl.searchParams.get('layout') || request.nextUrl.searchParams.get('preset') || '');
  params.set('_format', 'json');
  if (demoRequested) params.set('demo', 'true');
  if (finalParam) params.set('final', finalParam);

  const finalPageUrl = `/podio-final-tb50?${new URLSearchParams({ uid, ...(demoRequested ? { demo: 'true' } : {}), ...(realFinalRequested ? { force: 'true' } : { auto: 'true' }) }).toString()}`;
  return `(function(){var endpoint=${JSON.stringify(`${request.nextUrl.pathname}?${params.toString()}`)};var finalPageUrl=${JSON.stringify(finalPageUrl)};var busy=false;function scaleScreen(){var screen=document.querySelector('.screen');if(!screen)return;var scale=Math.min(window.innerWidth/2048,window.innerHeight/512,1);screen.style.transformOrigin='top left';screen.style.transform='scale('+scale+')';screen.style.position='absolute';screen.style.left=Math.max(0,Math.floor((window.innerWidth-2048*scale)/2))+'px';screen.style.top=Math.max(0,Math.floor((window.innerHeight-512*scale)/2))+'px';document.documentElement.style.width='100vw';document.documentElement.style.height='100vh';document.body.style.width='100vw';document.body.style.height='100vh';document.body.style.overflow='hidden';}function fitCardNames(){var nodes=document.querySelectorAll('.card .name');for(var i=0;i<nodes.length;i++){var el=nodes[i];var max=parseInt(el.getAttribute('data-name-font-size')||'',10);if(!max){max=parseFloat(window.getComputedStyle(el).fontSize)||42;}var size=max;el.style.fontSize=size+'px';var guard=0;while(el.scrollWidth>el.clientWidth+1&&size>14&&guard<8){size=Math.max(14,Math.floor(size*(el.clientWidth/Math.max(1,el.scrollWidth))*0.97));el.style.fontSize=size+'px';guard++;}}}function fitSoon(){scaleScreen();fitCardNames();setTimeout(function(){scaleScreen();fitCardNames();},30);}function setHtml(id,html){var el=document.getElementById(id);if(!el)return;if(el.innerHTML!==html){el.innerHTML=html;}}function hasFilledContent(){var slot=document.getElementById('content-slot');return !!(slot&&slot.querySelector('.filled'));}function update(){if(busy||!window.fetch)return;busy=true;fetch(endpoint+'&_ts='+Date.now(),{cache:'no-store'}).then(function(r){return r.ok?r.json():null;}).then(function(data){if(!data)return;if(data.finalRedirect){window.location.replace(finalPageUrl);return;}var style=document.getElementById('dynamic-style');if(style&&style.textContent!==data.css)style.textContent=data.css;setHtml('header-slot',data.header||'');if(data.contentUsable!==false||!hasFilledContent()){setHtml('content-slot',data.content||'');}fitSoon();}).catch(function(){}).then(function(){busy=false;});}window.addEventListener('resize',scaleScreen);fitSoon();setInterval(update,1000);setTimeout(update,1000);})();`;
}

function renderControlsCss(): string {
  return `.tb50-controls{position:fixed;right:16px;bottom:16px;z-index:20;display:flex;align-items:center;gap:8px;padding:8px;border:1px solid rgba(255,255,255,.22);border-radius:8px;background:rgba(0,0,0,.72);font-family:'Rajdhani','Arial Narrow',Arial,Helvetica,sans-serif}.tb50-controls button,.tb50-controls a{height:34px;display:inline-flex;align-items:center;justify-content:center;border:1px solid rgba(255,255,255,.28);border-radius:6px;padding:0 12px;color:#fff;background:#151515;font-size:12px;font-weight:900;line-height:1;text-decoration:none;cursor:pointer}.tb50-controls .primary{border-color:#00ff66;color:#051007;background:#00ff66}.tb50-controls .danger{border-color:#ffd84d;color:#ffd84d;background:#201a08}.tb50-controls-status{min-width:132px;color:#d7dddd;font-size:11px;font-weight:800;line-height:1.2}@media(max-width:720px){.tb50-controls{left:10px;right:10px;bottom:10px;flex-wrap:wrap}.tb50-controls button,.tb50-controls a{flex:1 1 calc(50% - 4px);height:40px}.tb50-controls-status{flex:1 1 100%}}`;
}

function renderControls(): string {
  return `<div class="tb50-controls"><button id="tb50-fullscreen" class="primary" type="button">Visualizacao completa</button><button id="tb50-send-final" class="danger" type="button">Enviar podio final</button><button id="tb50-send-live" type="button">Voltar placar ao vivo</button><span id="tb50-controls-status" class="tb50-controls-status">Controle manual</span></div>`;
}

function renderControlsScript(): string {
  return `(function(){var status=document.getElementById('tb50-controls-status');function say(text){if(status)status.textContent=text;}function setMode(mode,label){say('Enviando...');fetch('/api/tb50-display-mode',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({mode:mode})}).then(function(r){return r.ok?r.json():Promise.reject(new Error('HTTP '+r.status));}).then(function(){say(label);if(mode==='final-real')window.location.replace('/podio-final-tb50');if(mode==='live')window.location.replace('/placar-telao-tb50?layout=designer&controls=true');}).catch(function(error){say(error&&error.message?error.message:'Falha ao enviar');});}var full=document.getElementById('tb50-fullscreen');if(full){full.addEventListener('click',function(){var target=document.querySelector('.screen')||document.documentElement;var request=target.requestFullscreen||target.webkitRequestFullscreen||target.msRequestFullscreen;if(request)request.call(target);say('Visualizacao completa');});}var sendFinal=document.getElementById('tb50-send-final');if(sendFinal){sendFinal.addEventListener('click',function(){setMode('final-real','Podio final enviado');});}var sendLive=document.getElementById('tb50-send-live');if(sendLive){sendLive.addEventListener('click',function(){setMode('live','Placar ao vivo enviado');});}})();`;
}

function renderHtml(snapshot: LiveTimingSnapshot, uid: string, demoRequested: boolean, request: NextRequest, layout: TelaoLayoutConfig, finalRaceVideoRequested: boolean, pageState: Tb50PageState): string {
  if (finalRaceVideoRequested) {
    const params = new URLSearchParams();
    const finalParam = request.nextUrl.searchParams.get('final');
    params.set('uid', uid);
    if (demoRequested || finalParam === 'demo' || finalParam === 'true') params.set('demo', 'true');
    if (finalParam === 'real') params.set('force', 'true');
    if (!demoRequested && !finalParam) params.set('auto', 'true');
    return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=/podio-final-tb50?${params.toString()}"><script>location.replace('/podio-final-tb50?${params.toString()}');</script><title>Podio Final TB50</title></head><body></body></html>`;
  }

  const payload = renderUpdatePayload(snapshot, layout, finalRaceVideoRequested, pageState);
  const script = renderClientScript(uid, demoRequested, request);
  const controlsRequested = request.nextUrl.searchParams.get('controls') === 'true' || request.nextUrl.searchParams.get('manual') === 'true';

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="cache-control" content="no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0"><meta http-equiv="pragma" content="no-cache"><meta http-equiv="expires" content="0"><title>Placar Telao TB50</title><style id="dynamic-style">${payload.css}</style>${controlsRequested ? `<style>${renderControlsCss()}</style>` : ''}</head><body><main class="screen"><div id="header-slot">${payload.header}</div><section id="content-slot" class="wrap">${payload.content}</section></main>${controlsRequested ? renderControls() : ''}<script>${script}</script>${controlsRequested ? `<script>${renderControlsScript()}</script>` : ''}</body></html>`;
}

export async function GET(request: NextRequest) {
  const uid = request.nextUrl.searchParams.get('uid') || process.env.NEXT_PUBLIC_DEFAULT_UID || DEFAULT_UID;
  const demoRequested = request.nextUrl.searchParams.get('demo') === 'true' || process.env.LIVETIME_FORCE_DEMO === 'true';
  const { finalPreviewRequested, forceFinalFromLive, forceFinalFromStore, suppressAutoFinal } = await resolveRequestedDisplayMode(request);
  const [layout, pageState] = await Promise.all([layoutForRequest(request), readTb50PageFromRemote()]);
  const snapshot = await loadSnapshot(uid, demoRequested, finalPreviewRequested, forceFinalFromLive, layout);
  const finalRaceVideoRequested = shouldRenderFinalRaceVideo(snapshot, finalPreviewRequested, forceFinalFromLive, forceFinalFromStore, suppressAutoFinal);

  if (request.nextUrl.searchParams.get('_format') === 'json') {
    return NextResponse.json(renderUpdatePayload(snapshot, layout, finalRaceVideoRequested, pageState), { headers: JSON_NO_CACHE_HEADERS });
  }

  return new NextResponse(renderHtml(snapshot, uid, demoRequested, request, layout, finalRaceVideoRequested, pageState), { status: 200, headers: NO_CACHE_HEADERS });
}

