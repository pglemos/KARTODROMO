import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import https from 'node:https';
import { join } from 'node:path';

export type ViplexDeviceProgram = {
  id: string;
  identifier: string;
  name: string;
  width: number;
  height: number;
  duration: number;
  statusCode: number;
  source: number;
  thumbnailUrl?: string;
};

type ViplexProgramInfo = {
  id?: string;
  identifier?: string;
  name?: string;
  statusCode?: number;
  source?: number;
  thumbnailUrl?: string;
  programBaseInfo?: {
    width?: number;
    height?: number;
    duration?: number;
  };
};

const DEFAULT_DEVICE_BASE_URL = 'https://192.168.20.2:16674';
const DEFAULT_DB_PATH = 'C:\\Users\\Administrador\\AppData\\Local\\ViPlexExpress\\Config\\DB\\DBV2.sqlite';
const DEFAULT_VIDEO_FILES = [
  'C:\\Users\\Administrador\\Downloads\\K-LED-CAMP(1).mp4',
  'C:\\Users\\Administrador\\Downloads\\DRONE - MP4.mp4',
  'C:\\Users\\Administrador\\Downloads\\K-KAC-LED1.mp4',
];
const DEFAULT_STREAM_PROGRAM_NAME = 'CRONOMETRAGEM';
const DEFAULT_VIDEO_PROGRAM_NAME = 'VIDEOS';
const DEFAULT_VISIBLE_PROGRAM_NAMES = ['CRONOMETRAGEM', 'VIDEOS'];
const DEFAULT_STREAM_URL = 'rtsp://192.168.20.13:8554/tb50';
const DEFAULT_VIPLEX_STREAM_PLAYBACK_URL = 'http://192.168.20.13:8888/tb50/index.m3u8';
const DEFAULT_SCOREBOARD_URL = 'http://localhost:3000/placar-telao-tb50?layout=designer';
const DEFAULT_VIPLEX_DEVICE_IDENTIFIER = 'SRVKART';
const DEFAULT_VIPLEX_PUBLISH_DIR = 'C:\\Users\\Administrador\\AppData\\Local\\ViPlexExpress\\Config\\Publish';

function normalizeBaseUrl(value?: string) {
  return (value || DEFAULT_DEVICE_BASE_URL).replace(/\/+$/, '');
}

function findStoredAuthToken() {
  const dbPath = process.env.VIPLEX_DB_PATH || DEFAULT_DB_PATH;
  if (!existsSync(/* turbopackIgnore: true */ dbPath)) return null;

  try {
    const content = readFileSync(/* turbopackIgnore: true */ dbPath).toString('latin1');
    const matches = content.match(/\d{13}[A-Za-z0-9+/]{12,}={0,2}/g) || [];
    return matches.find((token) => token.length >= 30) || null;
  } catch {
    return null;
  }
}

function getAuthToken() {
  const token = process.env.VIPLEX_DEVICE_AUTH_TOKEN || findStoredAuthToken();
  if (!token) throw new Error('viplex_auth_missing');
  return token;
}

function viplexRequest<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const base = normalizeBaseUrl(process.env.VIPLEX_DEVICE_BASE_URL);
  const url = new URL(path, base);
  const body = init?.body === undefined ? undefined : JSON.stringify(init.body);

  return new Promise((resolve, reject) => {
    const request = https.request(
      url,
      {
        method: init?.method || 'GET',
        rejectUnauthorized: false,
          timeout: Number(process.env.VIPLEX_DEVICE_TIMEOUT_MS || '15000'),
        headers: {
          Authorization: getAuthToken(),
          Accept: 'application/json',
          ...(body
            ? {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body),
              }
            : {}),
        },
      },
      (response) => {
        let payload = '';
        response.setEncoding('utf8');
        response.on('data', (chunk) => {
          payload += chunk;
        });
        response.on('end', () => {
          try {
            const data = payload ? JSON.parse(payload) : {};
            if (response.statusCode && response.statusCode >= 400) {
              reject(new Error(`viplex_http_${response.statusCode}`));
              return;
            }
            resolve(data as T);
          } catch (error) {
            reject(error);
          }
        });
      },
    );

    request.on('timeout', () => request.destroy(new Error('viplex_timeout')));
    request.on('error', reject);
    if (body) request.write(body);
    request.end();
  });
}

function normalizeProgram(input: ViplexProgramInfo): ViplexDeviceProgram | null {
  if (!input.id || !input.identifier || !input.name) return null;

  return {
    id: input.id,
    identifier: input.identifier,
    name: input.name,
    width: Number(input.programBaseInfo?.width || 0),
    height: Number(input.programBaseInfo?.height || 0),
    duration: Number(input.programBaseInfo?.duration || 0),
    statusCode: Number(input.statusCode || 0),
    source: Number(input.source || 0),
    thumbnailUrl: input.thumbnailUrl,
  };
}

function viplexUploadFile(targetDir: string, fileName: string, filePath: string): Promise<void> {
  const base = normalizeBaseUrl(process.env.VIPLEX_DEVICE_BASE_URL);
  const url = new URL('/terminal/tools/v1/file/uploadUseBinary', base);
  url.searchParams.set('targetDir', targetDir);
  url.searchParams.set('fileName', fileName);

  return new Promise((resolve, reject) => {
    const request = https.request(
      url,
      {
        method: 'PUT',
        rejectUnauthorized: false,
        timeout: Number(process.env.VIPLEX_DEVICE_TIMEOUT_MS || '15000'),
        headers: {
          Authorization: getAuthToken(),
          Accept: 'application/json',
          'Content-Type': 'application/octet-stream',
          'Content-Length': statSync(/* turbopackIgnore: true */ filePath).size,
        },
      },
      (response) => {
        let payload = '';
        response.setEncoding('utf8');
        response.on('data', (chunk) => {
          payload += chunk;
        });
        response.on('end', () => {
          try {
            const data = payload ? (JSON.parse(payload) as { code?: number; message?: string }) : {};
            if ((response.statusCode && response.statusCode >= 400) || data.code !== 0) {
              reject(new Error(data.message || `viplex_upload_http_${response.statusCode}`));
              return;
            }
            resolve();
          } catch (error) {
            reject(error);
          }
        });
      },
    );

    request.on('timeout', () => request.destroy(new Error('viplex_upload_timeout')));
    request.on('error', reject);
    createReadStream(/* turbopackIgnore: true */ filePath).pipe(request);
  });
}

function runtimePath(...parts: string[]) {
  return join(/* turbopackIgnore: true */ process.cwd(), '.runtime', ...parts);
}

function md5File(filePath: string) {
  return createHash('md5').update(readFileSync(/* turbopackIgnore: true */ filePath)).digest('hex');
}

function readJsonFile<T>(filePath: string): T {
  return JSON.parse(readFileSync(/* turbopackIgnore: true */ filePath, 'utf8')) as T;
}

function writeJsonFile(filePath: string, value: unknown) {
  writeFileSync(/* turbopackIgnore: true */ filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function latestPublishedProgramDir(programName: string) {
  const publishDir = process.env.VIPLEX_PUBLISH_DIR || DEFAULT_VIPLEX_PUBLISH_DIR;
  if (!existsSync(/* turbopackIgnore: true */ publishDir)) return null;

  const candidates = readdirSync(/* turbopackIgnore: true */ publishDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(publishDir, entry.name))
    .filter((dir) => existsSync(/* turbopackIgnore: true */ join(dir, 'planlist.json')) && existsSync(/* turbopackIgnore: true */ join(dir, 'playlist0.json')))
    .filter((dir) => {
      try {
        return normalizeProgramName(readJsonFile<{ name?: string }>(join(dir, 'planlist.json')).name || '') === normalizeProgramName(programName);
      } catch {
        return false;
      }
    })
    .sort((a, b) => statSync(/* turbopackIgnore: true */ b).mtimeMs - statSync(/* turbopackIgnore: true */ a).mtimeMs);

  return candidates[0] || null;
}

function streamMediaSettings(playbackUrl: string) {
  const normalized = playbackUrl.trim().toLowerCase();
  if (normalized.startsWith('rtsp://')) {
    return { type: 'rtsp', protocol: 'rtsp' };
  }
  if (normalized.startsWith('rtmp://')) {
    return { type: 'rtmp', protocol: 'rtmp' };
  }
  return { type: 'm3u8', protocol: 'hls' };
}

function updateStreamWidgets(value: unknown, playbackUrl: string): number {
  if (!value || typeof value !== 'object') return 0;

  let count = 0;
  const record = value as Record<string, unknown>;
  const metadata = record.metadata as { modelData?: Record<string, unknown> } | undefined;
  const modelData = metadata?.modelData;
  if (modelData && (record.type === 'STREAM_MEDIA' || modelData.stream_media_type || modelData.stream_media_protocol_type)) {
    const media = streamMediaSettings(playbackUrl);
    record.enable = true;
    modelData.src = playbackUrl;
    modelData.stream_media_type = media.type;
    modelData.stream_media_protocol_type = media.protocol;
    count += 1;
  }

  for (const child of Object.values(record)) {
    if (Array.isArray(child)) {
      for (const item of child) count += updateStreamWidgets(item, playbackUrl);
    } else {
      count += updateStreamWidgets(child, playbackUrl);
    }
  }

  if (count > 0 && Object.prototype.hasOwnProperty.call(record, 'enable')) {
    record.enable = true;
  }

  return count;
}

async function publishFixedStreamProgram(identifier: string, programName: string) {
  if (process.env.VIPLEX_REPAIR_STREAM_PROGRAM === 'false') return;

  const sourceDir = latestPublishedProgramDir(programName);
  if (!sourceDir) throw new Error('viplex_stream_publish_source_missing');

  mkdirSync(/* turbopackIgnore: true */ runtimePath(), { recursive: true });
  const workDir = mkdtempSync(/* turbopackIgnore: true */ runtimePath('viplex-cronometragem-hls-'));
  const fileNames = ['schedule_constraint.json', 'play_solution.json', 'playSolutionRelation.json', 'playlist0.json', 'planlist.json'];
  for (const fileName of fileNames) {
    const source = join(sourceDir, fileName);
    if (!existsSync(/* turbopackIgnore: true */ source)) throw new Error(`viplex_publish_file_missing:${fileName}`);
    writeFileSync(/* turbopackIgnore: true */ join(workDir, fileName), readFileSync(/* turbopackIgnore: true */ source));
  }

  const playlistPath = join(workDir, 'playlist0.json');
  const planlistPath = join(workDir, 'planlist.json');
  const playlist = readJsonFile<{
    uuid?: string;
    width?: number;
    height?: number;
    thumbpath?: string;
    sceneItems?: { duration?: number }[];
  }>(playlistPath);
  const playbackUrl = process.env.VIPLEX_STREAM_PLAYBACK_URL || DEFAULT_VIPLEX_STREAM_PLAYBACK_URL;
  const updatedWidgets = updateStreamWidgets(playlist, playbackUrl);
  if (!updatedWidgets) throw new Error('viplex_stream_widget_missing');
  writeJsonFile(playlistPath, playlist);

  const planlist = readJsonFile<{
    playlists?: { fileName?: string; md5?: string; Md5Suffixes?: string }[];
    thumbnails?: { fileName?: string }[];
  }>(planlistPath);
  const playlistMd5 = md5File(playlistPath);
  for (const playlistItem of planlist.playlists || []) {
    if (playlistItem.fileName === 'playlist0.json') {
      playlistItem.md5 = playlistMd5;
      playlistItem.Md5Suffixes = `${playlistMd5}.json`;
    }
  }
  writeJsonFile(planlistPath, planlist);

  const thumbnailName = planlist.thumbnails?.[0]?.fileName;
  const uploadFiles = fileNames.map((fileName) => ({ fileName, path: join(workDir, fileName) }));
  if (thumbnailName && playlist.thumbpath && existsSync(/* turbopackIgnore: true */ playlist.thumbpath)) {
    const thumbnailPath = join(workDir, thumbnailName);
    writeFileSync(/* turbopackIgnore: true */ thumbnailPath, readFileSync(/* turbopackIgnore: true */ playlist.thumbpath));
    uploadFiles.push({ fileName: thumbnailName, path: thumbnailPath });
  }

  const totalSize = uploadFiles.reduce((sum, file) => sum + statSync(/* turbopackIgnore: true */ file.path).size, 0);
  const start = await viplexRequest<{
    code?: number;
    message?: string;
    data?: { canTranster?: boolean; appliedInfos?: { uploadUrl?: string } };
  }>('/terminal/core/v1/play/transfer/start', {
    method: 'PUT',
    body: {
      deviceIdentifier: process.env.VIPLEX_DEVICE_IDENTIFIER || DEFAULT_VIPLEX_DEVICE_IDENTIFIER,
      totalSize,
      type: 'DEFAULT',
      local: false,
      source: 0,
      solutions: { name: programName, identifier },
      checkFiles: [],
      totalMediaSize: 0,
      judgeForDevice: true,
    },
  });

  if (start.code !== 0 || !start.data?.canTranster || !start.data.appliedInfos?.uploadUrl) {
    throw new Error(start.message || 'viplex_transfer_start_failed');
  }

  const uploadUrl = start.data.appliedInfos.uploadUrl;
  for (const file of uploadFiles) {
    await viplexUploadFile(uploadUrl, file.fileName, file.path);
  }

  const duration = Number(playlist.sceneItems?.[0]?.duration || 10000);
  const width = Number(playlist.width || 2048);
  const height = Number(playlist.height || 512);
  const thumbnailUrl = thumbnailName ? `${uploadUrl}/${thumbnailName}` : undefined;
  const end = await viplexRequest<{ code?: number; message?: string }>('/terminal/core/v1/play/transfer/end', {
    method: 'PUT',
    body: {
      source: { type: 1, platform: 2 },
      delayTime: 0,
      playTime: 0,
      playImmediately: true,
      isSupportMd5Checkout: true,
      confirmedInfos: {
        identifier,
        name: programName,
        planListUrl: `${uploadUrl}/planlist.json`,
        ...(thumbnailUrl ? { thumbnailUrl } : {}),
        type: 'DEFAULT',
        programBaseInfo: {
          uuid: playlist.uuid || identifier,
          size: statSync(/* turbopackIgnore: true */ playlistPath).size,
          duration,
          programName,
          width,
          height,
          publishTime: Date.now(),
          isSchedule: false,
        },
      },
    },
  });

  if (end.code !== 0) throw new Error(end.message || 'viplex_transfer_end_failed');
}

function normalizeProgramName(name: string) {
  return name.trim().toUpperCase();
}

function visibleProgramNames() {
  const configured = process.env.VIPLEX_VISIBLE_PROGRAM_NAMES;
  if (!configured) return DEFAULT_VISIBLE_PROGRAM_NAMES;

  return configured
    .split(',')
    .map((name) => normalizeProgramName(name))
    .filter(Boolean);
}

function filterVisiblePrograms(programs: ViplexDeviceProgram[]) {
  const names = visibleProgramNames();
  if (names.includes('*')) return programs;

  return programs.filter((program) => names.includes(normalizeProgramName(program.name)));
}

function videoFiles() {
  const configured = process.env.VIPLEX_VIDEO_STREAM_FILES
    ?.split(';')
    .map((file) => file.trim())
    .filter(Boolean);

  return configured?.length ? configured : DEFAULT_VIDEO_FILES;
}

function ffmpegPath() {
  const configured = process.env.TB50_FFMPEG_PATH;
  if (configured && existsSync(/* turbopackIgnore: true */ configured)) return configured;

  const bundled = join(
    /* turbopackIgnore: true */ process.cwd(),
    '.tools',
    'ffmpeg',
    'ffmpeg-8.1-essentials_build',
    'bin',
    'ffmpeg.exe',
  );
  if (existsSync(/* turbopackIgnore: true */ bundled)) return bundled;

  return 'ffmpeg';
}

function windowsCmdPath() {
  return process.env.ComSpec || join(process.env.WINDIR || 'C:\\Windows', 'System32', 'cmd.exe');
}

function npmCommand(args: string[]) {
  return process.platform === 'win32'
    ? { command: windowsCmdPath(), args: ['/c', 'npm.cmd', ...args] }
    : { command: 'npm', args };
}

function stopExistingTb50Publishers() {
  if (process.platform !== 'win32') return;

  spawnSync(
    'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',
    [
      '-NoProfile',
      '-Command',
      [
        'Get-CimInstance Win32_Process -Filter "name = \'node.exe\' OR name = \'cmd.exe\' OR name = \'ffmpeg.exe\'"',
        "| Where-Object { $_.CommandLine -match 'tb50-streamer|stream:tb50|videos-rtsp.ffconcat|rtsp://.*tb50|rtmp://.*tb50' }",
        '| ForEach-Object { Stop-Process -Id $_.ProcessId -Force }',
      ].join(' '),
    ],
    { stdio: 'ignore' },
  );
}

function stopExistingViplexKeepAlives() {
  if (process.platform !== 'win32') return;

  spawnSync(
    'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',
    [
      '-NoProfile',
      '-Command',
      [
        'Get-CimInstance Win32_Process -Filter "name = \'node.exe\'"',
        "| Where-Object { $_.CommandLine -match 'viplex-rtsp-keepalive' }",
        '| ForEach-Object { Stop-Process -Id $_.ProcessId -Force }',
      ].join(' '),
    ],
    { stdio: 'ignore' },
  );
}

async function delay(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function endpointOk(url: string, timeoutMs = 2500) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { cache: 'no-store', signal: controller.signal });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

async function ensureNextServer() {
  if (await endpointOk('http://localhost:3000/', 1500)) return;

  const out = createWriteStream(runtimePath('next-prod.out.log'), { flags: 'a' });
  const err = createWriteStream(runtimePath('next-prod.err.log'), { flags: 'a' });
  const npm = npmCommand(['run', 'start', '--', '-p', '3000']);
  const next = spawn(npm.command, npm.args, {
    cwd: process.cwd(),
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });

  next.stdout.pipe(out);
  next.stderr.pipe(err);
  next.unref();

  for (let i = 0; i < 15; i += 1) {
    await delay(1000);
    if (await endpointOk('http://localhost:3000/', 1500)) return;
  }

  throw new Error('next_server_unavailable');
}

async function forceLiveDisplayMode() {
  const endpoint = process.env.TB50_DISPLAY_MODE_ENDPOINT || 'http://localhost:3000/api/tb50-display-mode';
  const response = await fetch(endpoint, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'live' }),
  });

  if (!response.ok) throw new Error(`display_mode_http_${response.status}`);
}

async function startLiveScoreboardStream() {
  stopExistingTb50Publishers();
  await ensureNextServer();
  await forceLiveDisplayMode();

  const out = createWriteStream(runtimePath('tb50-streamer.out.log'), { flags: 'a' });
  const err = createWriteStream(runtimePath('tb50-streamer.err.log'), { flags: 'a' });
  const npm = npmCommand(['run', 'stream:tb50']);
  const stream = spawn(npm.command, npm.args, {
    cwd: process.cwd(),
    detached: true,
    env: {
      ...process.env,
      TB50_SCOREBOARD_URL: process.env.TB50_SCOREBOARD_URL || DEFAULT_SCOREBOARD_URL,
      TB50_STREAM_URL: process.env.TB50_STREAM_URL || DEFAULT_STREAM_URL,
      TB50_STREAM_WIDTH: process.env.TB50_STREAM_WIDTH || '2048',
      TB50_STREAM_HEIGHT: process.env.TB50_STREAM_HEIGHT || '512',
      TB50_CAPTURE_FPS: process.env.TB50_CAPTURE_FPS || '8',
      TB50_OUTPUT_FPS: process.env.TB50_OUTPUT_FPS || '8',
      TB50_STREAM_BITRATE: process.env.TB50_STREAM_BITRATE || '1400k',
      TB50_STREAM_BUFSIZE: process.env.TB50_STREAM_BUFSIZE || '2800k',
      TB50_RTP_PKT_SIZE: process.env.TB50_RTP_PKT_SIZE || '1200',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });

  stream.stdout.pipe(out);
  stream.stderr.pipe(err);
  stream.unref();

  await delay(Number(process.env.TB50_STREAM_WARMUP_MS || '8000'));
}

async function startVideoPlaylistStream() {
  const files = videoFiles();
  const missing = files.filter((file) => !existsSync(/* turbopackIgnore: true */ file));
  if (missing.length) throw new Error(`viplex_video_files_missing:${missing.join(',')}`);

  const runtimeDir = runtimePath();
  mkdirSync(/* turbopackIgnore: true */ runtimeDir, { recursive: true });

  const playlistPath = runtimePath('videos-rtsp.ffconcat');
  writeFileSync(/* turbopackIgnore: true */ playlistPath, files.map((file) => `file '${file.replace(/\\/g, '/')}'`).join('\n'), 'ascii');

  stopExistingTb50Publishers();

  const out = createWriteStream(runtimePath('videos-rtsp.out.log'), { flags: 'a' });
  const err = createWriteStream(runtimePath('videos-rtsp.err.log'), { flags: 'a' });
  const streamUrl = process.env.TB50_VIDEO_STREAM_URL || process.env.TB50_STREAM_URL || DEFAULT_STREAM_URL;

  const ffmpeg = spawn(
    ffmpegPath(),
    [
      '-hide_banner',
      '-loglevel',
      'warning',
      '-stream_loop',
      '-1',
      '-f',
      'concat',
      '-safe',
      '0',
      '-re',
      '-i',
      playlistPath,
      '-an',
      '-vf',
      'scale=2048:512:force_original_aspect_ratio=increase,crop=2048:512,fps=24,format=yuv420p',
      '-c:v',
      'libx264',
      '-profile:v',
      'baseline',
      '-level:v',
      '3.2',
      '-preset',
      'veryfast',
      '-tune',
      'zerolatency',
      '-bf',
      '0',
      '-pix_fmt',
      'yuv420p',
      '-r',
      '24',
      '-g',
      '48',
      '-b:v',
      process.env.TB50_VIDEO_STREAM_BITRATE || process.env.TB50_STREAM_BITRATE || '4500k',
      '-maxrate',
      process.env.TB50_VIDEO_STREAM_BITRATE || process.env.TB50_STREAM_BITRATE || '4500k',
      '-bufsize',
      '9000k',
      '-f',
      'rtsp',
      '-rtsp_transport',
      'tcp',
      streamUrl,
    ],
    { detached: true, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true },
  );

  ffmpeg.stdout.pipe(out);
  ffmpeg.stderr.pipe(err);
  ffmpeg.unref();

  await delay(2500);
}

async function startViplexProgramNative(identifier: string) {
  await stopViplexProgramNative(identifier);

  const data = await viplexRequest<{ code?: number; message?: string }>('/terminal/core/v1/play/start', {
    method: 'PUT',
    body: { identifier },
  });

  if (data.code !== 0) throw new Error(data.message || 'viplex_start_failed');
}

function startViplexProgramKeepAlive(identifier: string) {
  stopExistingViplexKeepAlives();

  const script = `
const marker = 'viplex-rtsp-keepalive';
const https = require('node:https');
const identifier = process.env.VIPLEX_KEEPALIVE_IDENTIFIER;
const base = (process.env.VIPLEX_DEVICE_BASE_URL || '${DEFAULT_DEVICE_BASE_URL}').replace(/\\/+$/, '');
const token = process.env.VIPLEX_DEVICE_AUTH_TOKEN;
const interval = Number(process.env.VIPLEX_KEEPALIVE_MS || '45000');
function pulse() {
  if (!identifier || !token) return;
  const body = JSON.stringify({ identifier });
  const request = https.request(new URL('/terminal/core/v1/play/start', base), {
    method: 'PUT',
    rejectUnauthorized: false,
    timeout: 5000,
    headers: {
      Authorization: token,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
    },
  }, (response) => response.resume());
  request.on('timeout', () => request.destroy());
  request.on('error', () => undefined);
  request.write(body);
  request.end();
}
setInterval(pulse, interval);
`;

  const keepAlive = spawn(process.execPath, ['-e', script], {
    detached: true,
    env: {
      ...process.env,
      VIPLEX_KEEPALIVE_IDENTIFIER: identifier,
      VIPLEX_DEVICE_AUTH_TOKEN: getAuthToken(),
    },
    stdio: 'ignore',
    windowsHide: true,
  });
  keepAlive.unref();
}

async function stopViplexProgramNative(identifier: string) {
  try {
    await viplexRequest<{ code?: number; message?: string }>('/terminal/core/v1/play/stop', {
      method: 'PUT',
      body: { identifier },
    });
    await delay(700);
  } catch {
    // Stop is best-effort; start below is the source of truth for operator action.
  }
}

export async function listViplexPrograms(): Promise<ViplexDeviceProgram[]> {
  const data = await viplexRequest<{
    code?: number;
    message?: string;
    data?: {
      programInfos?: ViplexProgramInfo[];
    };
  }>('/terminal/core/v1/play/program/page?page=1&pageSize=30&sourceList=0&sortType=0&sortOrder=DESC');

  if (data.code !== 0) throw new Error(data.message || 'viplex_programs_failed');

  return filterVisiblePrograms(
    (data.data?.programInfos || [])
      .map(normalizeProgram)
      .filter((program): program is ViplexDeviceProgram => Boolean(program)),
  );
}

export async function startViplexProgram(identifier: string): Promise<{ ok: true; identifier: string; routedTo?: string; mode?: string }> {
  if (!identifier || typeof identifier !== 'string') throw new Error('viplex_identifier_missing');

  const programs = await listViplexPrograms();
  const requestedProgram = programs.find((program) => program.identifier === identifier);
  const videoProgramName = normalizeProgramName(process.env.VIPLEX_VIDEO_PROGRAM_NAME || DEFAULT_VIDEO_PROGRAM_NAME);
  const streamProgramName = normalizeProgramName(process.env.VIPLEX_STREAM_PROGRAM_NAME || DEFAULT_STREAM_PROGRAM_NAME);

  if (requestedProgram && normalizeProgramName(requestedProgram.name) === streamProgramName) {
    await startLiveScoreboardStream();
    await publishFixedStreamProgram(identifier, requestedProgram.name);
    await startViplexProgramNative(identifier);
    startViplexProgramKeepAlive(identifier);
    return { ok: true, identifier, mode: 'live-scoreboard' };
  }

  if (requestedProgram && normalizeProgramName(requestedProgram.name) === videoProgramName && process.env.VIPLEX_USE_NATIVE_VIDEO_PROGRAM !== 'true') {
    const streamProgram = programs.find((program) => normalizeProgramName(program.name) === streamProgramName);
    if (!streamProgram) throw new Error('viplex_stream_program_missing');

    await startVideoPlaylistStream();
    await publishFixedStreamProgram(streamProgram.identifier, streamProgram.name);
    await startViplexProgramNative(streamProgram.identifier);
    startViplexProgramKeepAlive(streamProgram.identifier);
    return { ok: true, identifier, routedTo: streamProgram.identifier, mode: 'video-stream' };
  }

  stopExistingViplexKeepAlives();
  await startViplexProgramNative(identifier);
  return { ok: true, identifier };
}
