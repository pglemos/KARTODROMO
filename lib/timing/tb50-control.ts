import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import https from 'node:https';
import { extname, join } from 'node:path';

export type Tb50LayoutId =
  | 'grid-14-ms'
  | 'grid-20-pos'
  | 'lista-laptime'
  | 'top3-live'
  | 'podio-final'
  | 'patrocinadores';

export type Tb50Mode = 'ao_vivo' | 'playlist' | 'manual';
export type Tb50PlaybackState = 'reproduzindo' | 'pausado' | 'parado';

export interface Tb50Camadas {
  cabecalho: boolean;
  placar: boolean;
  cronometro: boolean;
  patrocinadores: boolean;
  fundo: boolean;
}

export interface Tb50Patrocinador {
  id: string;
  nome: string;
  slogan: string;
  cor: string;
  mediaUrl?: string;
  ativo: boolean;
}

export interface Tb50PlaylistItem {
  id: string;
  ordem: number;
  nome: string;
  tipo: string;
  layoutOuMidia: string;
  mediaUrl?: string;
  duracaoSeg: number;
  transicao: 'Corte' | 'Fade' | 'Slide';
  ativo: boolean;
}

export interface Tb50BibliotecaItem {
  id: string;
  nome: string;
  categoria: 'Layouts' | 'Imagens' | 'Vídeos' | 'Patrocinadores' | 'Animações' | 'Starts/Transições' | 'Informativos' | 'Programas ViPlex';
  subtitulo: string;
  layoutOuMidia: string;
  mediaUrl?: string;
  duracaoSeg: number;
  resolucao: string;
  cor: string;
  protegido?: boolean;
}

export interface Tb50Agendamento {
  id: string;
  nome: string;
  horario: string; // HH:mm
  diasSemana: string; // Ex: Seg-Dom
  acao: 'layout' | 'playlist' | 'viplex';
  destino: string;
  ativo: boolean;
}

export interface Tb50Config {
  layout: Tb50LayoutId;
  mode: Tb50Mode;
  playbackState: Tb50PlaybackState;
  loopPlaylist: boolean;
  activePlaylistIndex: number;
  offset: number;
  autoPage: boolean;
  autoPageSec: number;
  autoPodioAoEncerrar: boolean;
  mostrarMilesimos: boolean;
  temaFundo: string;
  corPrimaria: string;
  corDestaque: string;
  tamanhoFonteEscala: number;
  tituloCustom: string;
  subtituloCustom: string;
  rodapeTexto: string;
  mediaAtivaUrl: string;
  mediaAtivaNome: string;
  qrCodeUrl: string;
  mostrarClima: boolean;
  mostrarHora: boolean;
  mostrarQrCode: boolean;
  climaTexto: string;
  camadas: Tb50Camadas;
  patrocinadores: Tb50Patrocinador[];
  playlist: Tb50PlaylistItem[];
  biblioteca: Tb50BibliotecaItem[];
  agendamentos: Tb50Agendamento[];
  hardware: {
    host: string;
    port: number;
    serial: string;
    username: string;
    brilho: number;
    volume: number;
    programaPadrao: string;
    viplexToken?: string;
    viplexPassword?: string;
  };
  reloadNonce: number;
  updatedAt: string;
}

const VALID_LAYOUTS = new Set<Tb50LayoutId>([
  'grid-14-ms',
  'grid-20-pos',
  'lista-laptime',
  'top3-live',
  'podio-final',
  'patrocinadores',
]);

export function defaultTb50Config(offsetInicial = 0): Tb50Config {
  return {
    layout: 'grid-20-pos',
    mode: 'ao_vivo',
    playbackState: 'reproduzindo',
    loopPlaylist: true,
    activePlaylistIndex: 0,
    offset: Math.max(0, offsetInicial),
    autoPage: false,
    autoPageSec: 8,
    autoPodioAoEncerrar: true,
    mostrarMilesimos: true,
    temaFundo: 'carbono',
    corPrimaria: '#00E676', // design-lint-ignore: cor padrão do painel de LED (dado que o operador troca na tela, não estilo)
    corDestaque: '#FFB300', // design-lint-ignore: cor padrão do painel de LED (dado que o operador troca na tela, não estilo)
    tamanhoFonteEscala: 100,
    tituloCustom: '',
    subtituloCustom: '',
    rodapeTexto: 'Cronometragem ao vivo · Kartódromo Internacional de Betim',
    mediaAtivaUrl: '',
    mediaAtivaNome: '',
    qrCodeUrl: 'https://kartodromodebetim.com.br',
    mostrarClima: false,
    mostrarHora: true,
    mostrarQrCode: false,
    climaTexto: '26°C · Pista Seca',
    camadas: {
      cabecalho: true,
      placar: true,
      cronometro: true,
      patrocinadores: true,
      fundo: true,
    },
    patrocinadores: [
      { id: 'pat-kib', nome: 'Kartódromo de Betim', slogan: 'Tradição e Velocidade', cor: '#00E676', ativo: true }, // design-lint-ignore: cor padrão do painel de LED (dado que o operador troca na tela, não estilo)
      { id: 'pat-500m', nome: '500 Milhas KIB 2026', slogan: 'Endurance Oficial', cor: '#FFB300', ativo: true }, // design-lint-ignore: cor padrão do painel de LED (dado que o operador troca na tela, não estilo)
      { id: 'pat-ultras', nome: 'Academia & Performance', slogan: 'Parceiro Oficial', cor: '#38BDF8', ativo: true }, // design-lint-ignore: cor padrão do painel de LED (dado que o operador troca na tela, não estilo)
    ],
    playlist: [
      { id: 'pl-1', ordem: 1, nome: 'Placar 14 Karts (Kart + Tempo ms)', tipo: 'Layout Ao Vivo', layoutOuMidia: 'grid-14-ms', duracaoSeg: 120, transicao: 'Corte', ativo: true },
      { id: 'pl-2', ordem: 2, nome: 'Top 3 AO VIVO – Destaque Horizontal', tipo: 'Layout Ao Vivo', layoutOuMidia: 'top3-live', duracaoSeg: 45, transicao: 'Fade', ativo: true },
      { id: 'pl-3', ordem: 3, nome: 'Lista Completa LapTime (Milésimos)', tipo: 'Layout Ao Vivo', layoutOuMidia: 'lista-laptime', duracaoSeg: 60, transicao: 'Fade', ativo: true },
      { id: 'pl-4', ordem: 4, nome: 'Patrocinadores – Rotativo', tipo: 'Patrocinadores', layoutOuMidia: 'patrocinadores', duracaoSeg: 20, transicao: 'Slide', ativo: true },
      { id: 'pl-5', ordem: 5, nome: 'Placar 20 Karts (Posição + Kart)', tipo: 'Layout Ao Vivo', layoutOuMidia: 'grid-20-pos', duracaoSeg: 45, transicao: 'Corte', ativo: true },
      { id: 'pl-6', ordem: 6, nome: 'Resultado Final / Pódio Top 5', tipo: 'Resultado', layoutOuMidia: 'podio-final', duracaoSeg: 30, transicao: 'Fade', ativo: false },
    ],
    biblioteca: [
      { id: 'lib-top3', nome: 'Top 3 AO VIVO (Horizontal)', categoria: 'Layouts', subtitulo: 'P1-P3 destaque + ms + rodapé', layoutOuMidia: 'top3-live', duracaoSeg: 0, resolucao: '2048x512', cor: '#0B7A53', protegido: true }, // design-lint-ignore: cor padrão do painel de LED (dado que o operador troca na tela, não estilo)
      { id: 'lib-lista', nome: 'Lista Completa LapTime', categoria: 'Layouts', subtitulo: 'Cronômetro + Pos + Kart + Piloto + ms', layoutOuMidia: 'lista-laptime', duracaoSeg: 0, resolucao: '2048x512', cor: '#0063B1', protegido: true }, // design-lint-ignore: cor padrão do painel de LED (dado que o operador troca na tela, não estilo)
      { id: 'lib-14', nome: 'Placar 14 Karts (Kart + ms)', categoria: 'Layouts', subtitulo: 'Grade 7x2 grande em milésimos', layoutOuMidia: 'grid-14-ms', duracaoSeg: 0, resolucao: '2048x512', cor: '#00A859', protegido: true }, // design-lint-ignore: cor padrão do painel de LED (dado que o operador troca na tela, não estilo)
      { id: 'lib-20', nome: 'Placar 20 Karts (Pos + Kart)', categoria: 'Layouts', subtitulo: 'Grade 10x2 clássico alta leitura', layoutOuMidia: 'grid-20-pos', duracaoSeg: 0, resolucao: '2048x512', cor: '#1D4ED8', protegido: true }, // design-lint-ignore: cor padrão do painel de LED (dado que o operador troca na tela, não estilo)
      { id: 'lib-podio', nome: 'Resultado Final / Pódio', categoria: 'Layouts', subtitulo: 'Top 5 + Campeão em destaque', layoutOuMidia: 'podio-final', duracaoSeg: 0, resolucao: '2048x512', cor: '#D97706', protegido: true }, // design-lint-ignore: cor padrão do painel de LED (dado que o operador troca na tela, não estilo)
      { id: 'lib-pat', nome: 'Patrocinadores & Informativo', categoria: 'Patrocinadores', subtitulo: 'Marcas parceiras e chamadas', layoutOuMidia: 'patrocinadores', duracaoSeg: 20, resolucao: '2048x512', cor: '#7C3AED', protegido: true }, // design-lint-ignore: cor padrão do painel de LED (dado que o operador troca na tela, não estilo)
      { id: 'lib-vp-crono', nome: 'ViPlex: CRONOMETRAGEM', categoria: 'Programas ViPlex', subtitulo: 'Programa HTML tempo real TB50', layoutOuMidia: 'viplex:CRONOMETRAGEM', duracaoSeg: 0, resolucao: '2048x512', cor: '#0B7A53', protegido: true }, // design-lint-ignore: cor padrão do painel de LED (dado que o operador troca na tela, não estilo)
      { id: 'lib-vp-video', nome: 'ViPlex: VIDEOS / Institucional', categoria: 'Programas ViPlex', subtitulo: 'Vídeos locais armazenados na TB50', layoutOuMidia: 'viplex:VIDEOS', duracaoSeg: 0, resolucao: '2048x512', cor: '#334155', protegido: true }, // design-lint-ignore: cor padrão do painel de LED (dado que o operador troca na tela, não estilo)
      { id: 'lib-info-largada', nome: 'Chamada: Próxima Bateria', categoria: 'Informativos', subtitulo: 'Aviso de briefing e pista', layoutOuMidia: 'patrocinadores', duracaoSeg: 15, resolucao: '2048x512', cor: '#EA580C' }, // design-lint-ignore: cor padrão do painel de LED (dado que o operador troca na tela, não estilo)
      { id: 'lib-trans-bandeira', nome: 'Vinheta: Bandeira Quadriculada', categoria: 'Starts/Transições', subtitulo: 'Abertura / Encerramento de prova', layoutOuMidia: 'podio-final', duracaoSeg: 10, resolucao: '2048x512', cor: '#111827' }, // design-lint-ignore: cor padrão do painel de LED (dado que o operador troca na tela, não estilo)
    ],
    agendamentos: [
      { id: 'ag-1', nome: 'Modo Pista Manhã (Placar 14 Karts ms)', horario: '09:00', diasSemana: 'Sáb-Dom', acao: 'layout', destino: 'grid-14-ms', ativo: false },
      { id: 'ag-2', nome: 'Modo Noite (Lista LapTime)', horario: '18:00', diasSemana: 'Ter-Sex', acao: 'layout', destino: 'lista-laptime', ativo: false },
    ],
    hardware: {
      host: process.env.TB50_HOST || '192.168.20.253',
      port: Number(process.env.TB50_VIPLEX_PORT || 16674),
      serial: process.env.VIPLEX_DEVICE_SERIAL || '25212A000010665',
      username: process.env.VIPLEX_DEVICE_USERNAME || 'admin',
      brilho: 85,
      volume: 70,
      programaPadrao: 'CRONOMETRAGEM',
    },
    reloadNonce: 0,
    updatedAt: new Date().toISOString(),
  };
}

export function sanitizeTb50Config(raw: unknown, fallback?: Tb50Config): Tb50Config {
  const base = fallback ?? defaultTb50Config();
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Record<string, unknown>;
  const layout = VALID_LAYOUTS.has(r.layout as Tb50LayoutId) ? (r.layout as Tb50LayoutId) : base.layout;
  const mode: Tb50Mode = r.mode === 'playlist' || r.mode === 'manual' ? r.mode : r.mode === 'ao_vivo' ? 'ao_vivo' : base.mode;
  const playbackState: Tb50PlaybackState =
    r.playbackState === 'pausado' || r.playbackState === 'parado' ? r.playbackState : r.playbackState === 'reproduzindo' ? 'reproduzindo' : base.playbackState;

  const camadasRaw = r.camadas && typeof r.camadas === 'object' ? (r.camadas as Record<string, unknown>) : {};
  const hwRaw = r.hardware && typeof r.hardware === 'object' ? (r.hardware as Record<string, unknown>) : {};

  return {
    layout,
    mode,
    playbackState,
    loopPlaylist: typeof r.loopPlaylist === 'boolean' ? r.loopPlaylist : base.loopPlaylist,
    activePlaylistIndex: Number.isFinite(Number(r.activePlaylistIndex)) ? Math.max(0, Math.floor(Number(r.activePlaylistIndex))) : base.activePlaylistIndex,
    offset: Number.isFinite(Number(r.offset)) ? Math.min(80, Math.max(0, Math.floor(Number(r.offset)))) : base.offset,
    autoPage: typeof r.autoPage === 'boolean' ? r.autoPage : base.autoPage,
    autoPageSec: Number.isFinite(Number(r.autoPageSec)) ? Math.min(60, Math.max(3, Math.floor(Number(r.autoPageSec)))) : base.autoPageSec,
    autoPodioAoEncerrar: typeof r.autoPodioAoEncerrar === 'boolean' ? r.autoPodioAoEncerrar : base.autoPodioAoEncerrar,
    mostrarMilesimos: typeof r.mostrarMilesimos === 'boolean' ? r.mostrarMilesimos : base.mostrarMilesimos,
    temaFundo: typeof r.temaFundo === 'string' && r.temaFundo ? r.temaFundo.slice(0, 32) : base.temaFundo,
    corPrimaria: typeof r.corPrimaria === 'string' && /^#[0-9A-Fa-f]{6}$/.test(r.corPrimaria) ? r.corPrimaria : base.corPrimaria,
    corDestaque: typeof r.corDestaque === 'string' && /^#[0-9A-Fa-f]{6}$/.test(r.corDestaque) ? r.corDestaque : base.corDestaque,
    tamanhoFonteEscala: Number.isFinite(Number(r.tamanhoFonteEscala)) ? Math.min(140, Math.max(70, Math.floor(Number(r.tamanhoFonteEscala)))) : base.tamanhoFonteEscala,
    tituloCustom: typeof r.tituloCustom === 'string' ? r.tituloCustom.slice(0, 80) : base.tituloCustom,
    subtituloCustom: typeof r.subtituloCustom === 'string' ? r.subtituloCustom.slice(0, 100) : base.subtituloCustom,
    rodapeTexto: typeof r.rodapeTexto === 'string' ? r.rodapeTexto.slice(0, 140) : base.rodapeTexto,
    mediaAtivaUrl: typeof r.mediaAtivaUrl === 'string' ? r.mediaAtivaUrl.slice(0, 260) : base.mediaAtivaUrl,
    mediaAtivaNome: typeof r.mediaAtivaNome === 'string' ? r.mediaAtivaNome.slice(0, 100) : base.mediaAtivaNome,
    qrCodeUrl: typeof r.qrCodeUrl === 'string' ? r.qrCodeUrl.slice(0, 220) : base.qrCodeUrl,
    mostrarClima: typeof r.mostrarClima === 'boolean' ? r.mostrarClima : base.mostrarClima,
    mostrarHora: typeof r.mostrarHora === 'boolean' ? r.mostrarHora : base.mostrarHora,
    mostrarQrCode: typeof r.mostrarQrCode === 'boolean' ? r.mostrarQrCode : base.mostrarQrCode,
    climaTexto: typeof r.climaTexto === 'string' ? r.climaTexto.slice(0, 60) : base.climaTexto,
    camadas: {
      cabecalho: typeof camadasRaw.cabecalho === 'boolean' ? camadasRaw.cabecalho : base.camadas.cabecalho,
      placar: typeof camadasRaw.placar === 'boolean' ? camadasRaw.placar : base.camadas.placar,
      cronometro: typeof camadasRaw.cronometro === 'boolean' ? camadasRaw.cronometro : base.camadas.cronometro,
      patrocinadores: typeof camadasRaw.patrocinadores === 'boolean' ? camadasRaw.patrocinadores : base.camadas.patrocinadores,
      fundo: typeof camadasRaw.fundo === 'boolean' ? camadasRaw.fundo : base.camadas.fundo,
    },
    patrocinadores: Array.isArray(r.patrocinadores) ? (r.patrocinadores as Tb50Patrocinador[]) : base.patrocinadores,
    playlist: Array.isArray(r.playlist) ? (r.playlist as Tb50PlaylistItem[]) : base.playlist,
    biblioteca: Array.isArray(r.biblioteca) ? (r.biblioteca as Tb50BibliotecaItem[]) : base.biblioteca,
    agendamentos: Array.isArray(r.agendamentos) ? (r.agendamentos as Tb50Agendamento[]) : base.agendamentos,
    hardware: {
      host: typeof hwRaw.host === 'string' && hwRaw.host.trim() ? hwRaw.host.trim().slice(0, 64) : base.hardware.host,
      port: Number.isFinite(Number(hwRaw.port)) ? Math.min(65535, Math.max(1, Math.floor(Number(hwRaw.port)))) : base.hardware.port,
      serial: typeof hwRaw.serial === 'string' && hwRaw.serial.trim() ? hwRaw.serial.trim().slice(0, 48) : base.hardware.serial,
      username: typeof hwRaw.username === 'string' && hwRaw.username.trim() ? hwRaw.username.trim().slice(0, 32) : base.hardware.username,
      brilho: Number.isFinite(Number(hwRaw.brilho)) ? Math.min(100, Math.max(5, Math.floor(Number(hwRaw.brilho)))) : base.hardware.brilho,
      volume: Number.isFinite(Number(hwRaw.volume)) ? Math.min(100, Math.max(0, Math.floor(Number(hwRaw.volume)))) : base.hardware.volume,
      programaPadrao: typeof hwRaw.programaPadrao === 'string' && hwRaw.programaPadrao.trim() ? hwRaw.programaPadrao.trim().slice(0, 64) : base.hardware.programaPadrao,
      viplexToken: typeof hwRaw.viplexToken === 'string' ? hwRaw.viplexToken.trim() : base.hardware.viplexToken,
      viplexPassword: typeof hwRaw.viplexPassword === 'string' ? hwRaw.viplexPassword : base.hardware.viplexPassword,
    },
    reloadNonce: Number.isFinite(Number(r.reloadNonce)) ? Number(r.reloadNonce) : base.reloadNonce,
    updatedAt: new Date().toISOString(),
  };
}

/** Remove credenciais em repouso antes de enviar via HTTP/SSE para clientes ou internet. */
export function publicTb50Config(cfg: Tb50Config) {
  const { viplexPassword: _pw, viplexToken: _tk, ...safeHw } = cfg.hardware;
  return {
    ...cfg,
    hardware: {
      ...safeHw,
      autenticado: Boolean(_tk || _pw || process.env.VIPLEX_DEVICE_AUTH_TOKEN || process.env.VIPLEX_DEVICE_PASSWORD),
    },
  };
}

// ---------------------------------------------------------------- Media Storage (/tb50-media/*)

const SAFE_MEDIA_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.mp4', '.svg']);

export function sanitizeMediaFilename(name: string): string {
  const clean = name.replace(/[^A-Za-z0-9._-]/g, '_');
  const ext = extname(clean).toLowerCase();
  const safeExt = SAFE_MEDIA_EXTS.has(ext) ? ext : '.png';
  const base = clean.slice(0, clean.length - ext.length) || 'midia';
  return `${base.slice(0, 48)}_${Date.now()}${safeExt}`;
}

export function saveTb50MediaFile(mediaDir: string, originalName: string, base64Data: string): string {
  mkdirSync(mediaDir, { recursive: true });
  const pure = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
  const buf = Buffer.from(pure, 'base64');
  if (!buf.length || buf.length > 25 * 1024 * 1024) {
    throw new Error('Arquivo de mídia vazio ou maior que 25 MB.');
  }
  const fileName = sanitizeMediaFilename(originalName);
  writeFileSync(join(mediaDir, fileName), buf);
  return `/tb50-media/${fileName}`;
}

export function removeTb50MediaFile(mediaDir: string, mediaUrl?: string) {
  if (!mediaUrl || !mediaUrl.startsWith('/tb50-media/')) return;
  const fileName = mediaUrl.slice('/tb50-media/'.length).replace(/[/\\]/g, '');
  const full = join(mediaDir, fileName);
  try {
    if (existsSync(full) && statSync(full).isFile()) unlinkSync(full);
  } catch {
    // ignore cleanup failures
  }
}

export function mediaMimeType(filePath: string): string {
  switch (extname(filePath).toLowerCase()) {
    case '.png': return 'image/png';
    case '.jpg':
    case '.jpeg': return 'image/jpeg';
    case '.webp': return 'image/webp';
    case '.gif': return 'image/gif';
    case '.mp4': return 'video/mp4';
    case '.svg': return 'image/svg+xml';
    default: return 'application/octet-stream';
  }
}

// ---------------------------------------------------------------- Direct NovaStar TB50 ViPlex API Client

const DEFAULT_DB_PATHS = [
  process.env.VIPLEX_DB_PATH || '',
  'C:\\Users\\Administrador\\AppData\\Local\\ViPlexExpress\\Config\\DB\\DBV2.sqlite',
].filter(Boolean);

let cachedViplexToken: string | null = null;

function findStoredViplexToken(): string | null {
  const all = new Set<string>();
  for (const basePath of DEFAULT_DB_PATHS) {
    for (const filePath of [`${basePath}-wal`, basePath]) {
      if (!existsSync(/* turbopackIgnore: true */ filePath)) continue;
      try {
        const content = readFileSync(/* turbopackIgnore: true */ filePath).toString('latin1');
        const matches = content.match(/\d{13}[A-Za-z0-9+/]{12,}={0,2}/g) || [];
        for (const t of matches) {
          if (t.length >= 30) all.add(t);
        }
      } catch {
        // ignore sqlite read lock
      }
    }
  }
  if (all.size === 0) return null;
  const sorted = [...all].sort((a, b) => b.slice(0, 13).localeCompare(a.slice(0, 13)));
  return sorted[0] || null;
}

function viplexHttp<T = Record<string, unknown>>(
  host: string,
  port: number,
  path: string,
  method: 'GET' | 'POST' | 'PUT',
  token?: string,
  body?: unknown,
  timeoutMs = 8000,
): Promise<{ statusCode: number; data: T }> {
  const jsonBody = body === undefined ? undefined : JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const req = https.request(
      `https://${host}:${port}${path}`,
      {
        method,
        rejectUnauthorized: false,
        timeout: timeoutMs,
        headers: {
          Accept: 'application/json',
          ...(token ? { Authorization: token } : {}),
          ...(jsonBody
            ? {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(jsonBody),
              }
            : {}),
        },
      },
      (resp) => {
        let raw = '';
        resp.setEncoding('utf8');
        resp.on('data', (chunk) => { raw += chunk; });
        resp.on('end', () => {
          try {
            const parsed = raw ? (JSON.parse(raw) as T) : ({} as T);
            resolve({ statusCode: resp.statusCode || 200, data: parsed });
          } catch (err) {
            reject(err);
          }
        });
      },
    );
    req.on('timeout', () => req.destroy(new Error('Tempo limite esgotado ao falar com a TB50.')));
    req.on('error', reject);
    if (jsonBody) req.write(jsonBody);
    req.end();
  });
}

async function resolveViplexToken(cfg: Tb50Config, overridePassword?: string, overrideToken?: string, skipStoredToken = false): Promise<string> {
  if (overrideToken?.trim()) {
    cachedViplexToken = overrideToken.trim();
    return cachedViplexToken;
  }
  if (!overridePassword && !skipStoredToken && cachedViplexToken) return cachedViplexToken;
  if (!overridePassword && !skipStoredToken && cfg.hardware.viplexToken) {
    cachedViplexToken = cfg.hardware.viplexToken;
    return cachedViplexToken;
  }
  const envTok = process.env.VIPLEX_DEVICE_AUTH_TOKEN?.trim();
  if (!overridePassword && !skipStoredToken && envTok) {
    cachedViplexToken = envTok;
    return cachedViplexToken;
  }
  const dbTok = !overridePassword && !skipStoredToken ? findStoredViplexToken() : null;
  if (dbTok) {
    cachedViplexToken = dbTok;
    return dbTok;
  }

  const pwd = overridePassword || cfg.hardware.viplexPassword || process.env.VIPLEX_DEVICE_PASSWORD;
  if (!pwd) {
    throw new Error('Token/senha da TB50 não encontrados neste computador. Informe a senha nas Configurações TB50 ou execute via ORBITS.');
  }
  const loginRes = await viplexHttp<{ code?: number; message?: string; token?: string; data?: { token?: string } }>(
    cfg.hardware.host,
    cfg.hardware.port,
    '/terminal/core/v1/login',
    'POST',
    undefined,
    {
      sn: cfg.hardware.serial,
      username: cfg.hardware.username,
      clientId: 'pingbossApp',
      clientName: 'pingBossApp_2.4.1.0501',
      loginType: 2,
      source: { type: 1, platform: 1 },
      rememberPwd: false,
      password: pwd,
    },
  );
  const token = loginRes.data?.data?.token || loginRes.data?.token;
  if (loginRes.data?.code !== 0 || !token) {
    throw new Error(loginRes.data?.message || 'Falha no login da TB50.');
  }
  cachedViplexToken = token;
  return token;
}

export async function executeTb50ViplexAction(
  cfg: Tb50Config,
  params: {
    acao: string;
    identifier?: string;
    nome?: string;
    password?: string;
    token?: string;
  },
) {
  const token = await resolveViplexToken(cfg, params.password, params.token);
  const { host, port } = cfg.hardware;

  async function callWithRetry<T>(path: string, method: 'GET' | 'POST' | 'PUT', body?: unknown): Promise<T> {
    let tok = token;
    let resp: { statusCode: number; data: T & { code?: number; message?: string } };
    try {
      resp = await viplexHttp<T & { code?: number; message?: string }>(host, port, path, method, tok, body);
    } catch {
      await new Promise((r) => setTimeout(r, 350));
      cachedViplexToken = null;
      tok = await resolveViplexToken(cfg, params.password, undefined, true);
      resp = await viplexHttp<T & { code?: number; message?: string }>(host, port, path, method, tok, body);
    }
    const expired =
      Number(resp.data?.code) === 18 ||
      String(resp.data?.message || '').toLowerCase().includes('login expired');
    if (resp.data && expired) {
      cachedViplexToken = null;
      tok = await resolveViplexToken(cfg, params.password, undefined, true);
      resp = await viplexHttp<T & { code?: number; message?: string }>(host, port, path, method, tok, body);
    }
    if (resp.statusCode >= 400) {
      throw new Error(`TB50 HTTP ${resp.statusCode}`);
    }
    return resp.data;
  }

  if (params.acao === 'status' || params.acao === 'listar_programas') {
    const progResp = await callWithRetry<{
      code?: number;
      message?: string;
      data?: { programInfos?: Array<{ id?: string; identifier?: string; name?: string; uri?: string; statusCode?: number; source?: number; programBaseInfo?: { width?: number; height?: number; duration?: number } }> };
    }>('/terminal/core/v1/play/program/page?page=1&pageSize=30&sourceList=0&sortType=0&sortOrder=DESC', 'GET');
    if (progResp.code !== 0) throw new Error(progResp.message || 'Erro ao consultar programas da TB50.');
    const programas = (progResp.data?.programInfos || []).map((p) => ({
      id: p.id || '',
      identifier: p.identifier || '',
      name: p.name || '',
      uri: p.uri || '',
      statusCode: p.statusCode ?? 0,
      width: p.programBaseInfo?.width ?? 0,
      height: p.programBaseInfo?.height ?? 0,
      duration: p.programBaseInfo?.duration ?? 0,
    }));
    return { ok: true, programas };
  }

  let targetIdentifier = params.identifier?.trim() || '';
  if (!targetIdentifier) {
    const listResp = await executeTb50ViplexAction(cfg, { acao: 'listar_programas', password: params.password, token: params.token }) as {
      ok: boolean;
      programas: Array<{ identifier: string; name: string; statusCode?: number }>;
    };
    const desiredName = (params.nome || (params.acao === 'ativar_cronometragem' ? 'CRONOMETRAGEM' : '')).trim().toLowerCase();
    const matched =
      listResp.programas.find((p) => p.name.toLowerCase() === desiredName && p.statusCode === 1) ??
      (desiredName === 'cronometragem'
        ? listResp.programas.find((p) => p.identifier === '3cb236f21ada3cdd9c15456f6e8b2e0c')
        : undefined) ??
      listResp.programas.find((p) => p.name.toLowerCase() === desiredName) ??
      listResp.programas.find((p) => p.name.toLowerCase().includes(desiredName));
    if (matched) targetIdentifier = matched.identifier;
    else if (params.acao === 'ativar_cronometragem') targetIdentifier = '3cb236f21ada3cdd9c15456f6e8b2e0c';
  }

  if (!targetIdentifier) {
    throw new Error('Identificador do programa ViPlex não encontrado na TB50.');
  }

  if (params.acao === 'parar') {
    const r = await callWithRetry<{ code?: number; message?: string }>('/terminal/core/v1/play/stop', 'PUT', { identifier: targetIdentifier });
    if (r.code !== 0) throw new Error(r.message || 'Falha ao parar programa na TB50.');
    return { ok: true, identifier: targetIdentifier, stopped: true };
  }

  // Stop + brief pause + Start ensures WebView cleanly reloads and takes focus immediately
  try {
    await callWithRetry('/terminal/core/v1/play/stop', 'PUT', { identifier: targetIdentifier });
    await new Promise((r) => setTimeout(r, 450));
  } catch {
    // ignore stop failure when program is not running
  }
  const startResp = await callWithRetry<{ code?: number; message?: string }>('/terminal/core/v1/play/start', 'PUT', { identifier: targetIdentifier });
  if (startResp.code !== 0) throw new Error(startResp.message || 'Falha ao iniciar programa na TB50.');
  return { ok: true, identifier: targetIdentifier, started: true };
}

export function hashConfigFingerprint(cfg: Tb50Config): string {
  return createHash('md5').update(JSON.stringify(cfg)).digest('hex').slice(0, 12);
}
