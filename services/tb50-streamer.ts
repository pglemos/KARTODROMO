import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, type Browser, type Page } from 'playwright';
import { ensureWindowsSystemPath, resolvePreferredBrowserExecutablePath } from '@/lib/playwright-runtime';

const repoRoot = process.cwd();
const width = Number(process.env.TB50_STREAM_WIDTH || '2048');
const height = Number(process.env.TB50_STREAM_HEIGHT || '512');
const captureFps = Number(process.env.TB50_CAPTURE_FPS || '8');
const outputFps = Number(process.env.TB50_OUTPUT_FPS || '8');
const bitrate = process.env.TB50_STREAM_BITRATE || '1400k';
const bufferSize = process.env.TB50_STREAM_BUFSIZE || '2800k';
const rtpPacketSize = process.env.TB50_RTP_PKT_SIZE || '1200';
const scoreboardUrl = process.env.TB50_SCOREBOARD_URL || 'http://127.0.0.1:3000/podio-live-tb50';
const streamUrl = process.env.TB50_STREAM_URL || 'rtsp://192.168.20.13:8554/tb50';
ensureWindowsSystemPath();
const chromePath = resolvePreferredBrowserExecutablePath(process.env.TB50_CHROME_PATH);
const pageRecycleMs = Number(process.env.TB50_PAGE_RECYCLE_MS || '1800000');
const browserRecycleMs = Number(process.env.TB50_BROWSER_RECYCLE_MS || '3600000');
const frameWriteTimeoutMs = Number(process.env.TB50_FRAME_WRITE_TIMEOUT_MS || '5000');

function findBundledFfmpeg(): string | null {
  const ffmpegRoot = join(repoRoot, '.tools', 'ffmpeg');
  if (!existsSync(ffmpegRoot)) return null;

  const pending = [ffmpegRoot];
  while (pending.length > 0) {
    const current = pending.pop();
    if (!current) continue;

    for (const item of readdirSync(current, { withFileTypes: true })) {
      const itemPath = join(current, item.name);
      if (item.isDirectory()) pending.push(itemPath);
      if (item.isFile() && item.name.toLowerCase() === 'ffmpeg.exe') return itemPath;
    }
  }

  return null;
}

const ffmpegPath = process.env.TB50_FFMPEG_PATH || findBundledFfmpeg() || 'ffmpeg';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timeout: NodeJS.Timeout | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => reject(new Error(message)), ms);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeout) clearTimeout(timeout);
  });
}

function startFfmpeg(onExit: (code: number | null, signal: NodeJS.Signals | null) => void): ChildProcessWithoutNullStreams {
  const outputArgs = streamUrl.startsWith('rtmp')
    ? ['-f', 'flv', streamUrl]
    : ['-f', 'rtsp', '-rtsp_transport', 'tcp', '-pkt_size', rtpPacketSize, streamUrl];

  const args = [
    '-hide_banner',
    '-loglevel',
    'warning',
    '-f',
    'image2pipe',
    '-framerate',
    String(captureFps),
    '-vcodec',
    'mjpeg',
    '-i',
    'pipe:0',
    '-an',
    '-vf',
    'scale=in_range=pc:out_range=tv,format=yuv420p,setparams=range=tv:colorspace=bt709:color_primaries=bt709:color_trc=bt709',
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
    '-color_range',
    'tv',
    '-colorspace',
    'bt709',
    '-color_primaries',
    'bt709',
    '-color_trc',
    'bt709',
    '-r',
    String(outputFps),
    '-g',
    String(outputFps * 2),
    '-b:v',
    bitrate,
    '-maxrate',
    bitrate,
    '-bufsize',
    bufferSize,
    ...outputArgs,
  ];

  const ffmpeg = spawn(ffmpegPath, args, { stdio: ['pipe', 'pipe', 'pipe'] });
  ffmpeg.stderr.on('data', (chunk) => process.stderr.write(chunk));
  ffmpeg.stdout.on('data', (chunk) => process.stdout.write(chunk));
  ffmpeg.stdin.on('error', (error) => {
    console.error(`FFmpeg stdin error: ${error.message}`);
  });
  ffmpeg.on('exit', (code, signal) => {
    console.error(`FFmpeg exited code=${code ?? 'null'} signal=${signal ?? 'null'}`);
    onExit(code, signal);
  });

  return ffmpeg;
}

async function openBrowser(): Promise<Browser> {
  if (chromePath) {
    console.log(`TB50 streamer using browser ${chromePath}`);
  }

  return chromium.launch({
    headless: true,
    executablePath: chromePath,
    args: [
      '--autoplay-policy=no-user-gesture-required',
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding',
      '--disable-backgrounding-occluded-windows',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--no-proxy-server',
      '--proxy-server=direct://',
      '--proxy-bypass-list=*',
      '--host-resolver-rules=MAP localhost 127.0.0.1',
      '--disable-ipv6',
      '--disable-features=UseDnsHttpsSvcbAlpn',
    ],
  });
}

async function openScoreboardPage(browser: Browser): Promise<Page> {
  const page = await browser.newPage({
    viewport: { width, height },
    deviceScaleFactor: 1,
    bypassCSP: true,
  });

  page.setDefaultTimeout(15000);
  await page.setExtraHTTPHeaders({
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
    Pragma: 'no-cache',
  });

  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await page.goto(scoreboardUrl, { waitUntil: 'commit', timeout: 15000 });
      await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => undefined);
      await page.waitForSelector('.screen, .final-screen, .final-screen-viewport', { timeout: 15000 });
      return page;
    } catch (error) {
      lastError = error;
      console.warn(`TB50 streamer page open attempt ${attempt} failed: ${(error as Error).message}`);
      await delay(1000);
    }
  }

  throw lastError;
}

async function isScoreboardPageHealthy(page: Page): Promise<boolean> {
  if (page.isClosed()) return false;

  return page
    .evaluate(() => {
      return window.location.href.startsWith('http') && Boolean(document.querySelector('.screen, .final-screen, .final-screen-viewport'));
    })
    .catch(() => false);
}

async function writeFrame(
  ffmpeg: ChildProcessWithoutNullStreams,
  image: Buffer,
  timeoutMs: number,
): Promise<boolean> {
  if (ffmpeg.exitCode !== null || !ffmpeg.stdin.writable || ffmpeg.stdin.destroyed) return false;
  if (ffmpeg.stdin.write(image)) return true;

  return withTimeout(
    new Promise<boolean>((resolve) => {
      const cleanup = () => {
        ffmpeg.stdin.off('drain', onDrain);
        ffmpeg.stdin.off('error', onError);
        ffmpeg.off('exit', onExit);
      };
      const onDrain = () => {
        cleanup();
        resolve(ffmpeg.exitCode === null && ffmpeg.stdin.writable);
      };
      const onError = () => {
        cleanup();
        resolve(false);
      };
      const onExit = () => {
        cleanup();
        resolve(false);
      };

      ffmpeg.stdin.once('drain', onDrain);
      ffmpeg.stdin.once('error', onError);
      ffmpeg.once('exit', onExit);
    }),
    timeoutMs,
    `Timed out writing frame to FFmpeg after ${timeoutMs}ms`,
  ).catch((error) => {
    console.error(error instanceof Error ? error.message : 'Timed out writing frame to FFmpeg');
    return false;
  });
}

async function main() {
  console.log(`TB50 streamer rendering ${scoreboardUrl}`);
  console.log(`TB50 streamer publishing ${streamUrl}`);

  let stopped = false;
  let ffmpeg: ChildProcessWithoutNullStreams | null = null;
  function launchFfmpeg(): ChildProcessWithoutNullStreams {
    const publisher = startFfmpeg(() => {
      if (ffmpeg !== publisher) return;
      ffmpeg = null;
      void restartFfmpeg();
    });
    ffmpeg = publisher;
    return publisher;
  }
  let restarting = false;
  const restartFfmpeg = async () => {
    if (restarting || stopped) return;
    restarting = true;
    await delay(1000);
    if (!stopped) {
      console.log(`Restarting FFmpeg publisher for ${streamUrl}`);
      launchFfmpeg();
    }
    restarting = false;
  };

  ffmpeg = launchFfmpeg();
  let browser = await openBrowser();
  let browserOpenedAt = Date.now();
  let page = await openScoreboardPage(browser);
  let pageOpenedAt = Date.now();
  let pageCrashed = false;
  const markPageCrashed = () => {
    pageCrashed = true;
  };
  page.on('crash', markPageCrashed);

  const recreateBrowser = async (reason: string) => {
    console.error(`Recycling TB50 browser: ${reason}`);
    page.removeListener('crash', markPageCrashed);
    await page.close().catch(() => undefined);
    await browser.close().catch(() => undefined);
    browser = await openBrowser();
    browserOpenedAt = Date.now();
    page = await openScoreboardPage(browser);
    pageOpenedAt = Date.now();
    page.on('crash', markPageCrashed);
    pageCrashed = false;
  };

  const recreatePage = async (reason: string) => {
    console.error(`Reloading TB50 scoreboard page: ${reason}`);
    page.removeListener('crash', markPageCrashed);
    await page.close().catch(() => undefined);
    if (!browser.isConnected()) {
      await recreateBrowser('browser disconnected');
      return;
    }
    page = await openScoreboardPage(browser);
    pageOpenedAt = Date.now();
    page.on('crash', markPageCrashed);
    pageCrashed = false;
  };

  const shutdown = async () => {
    if (stopped) return;
    stopped = true;
    try {
      ffmpeg?.stdin.end();
    } catch {
      // process may already be closed
    }
    await browser.close().catch(() => undefined);
  };

  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());

  const frameDelayMs = Math.max(1, Math.floor(1000 / captureFps));
  let lastHeartbeatAt = 0;

  while (!stopped) {
    if (!ffmpeg || ffmpeg.exitCode !== null || !ffmpeg.stdin.writable) {
      await restartFfmpeg();
      await delay(frameDelayMs);
      continue;
    }

    const start = Date.now();
    if (browserRecycleMs > 0 && Date.now() - browserOpenedAt >= browserRecycleMs) {
      await recreateBrowser(`scheduled ${browserRecycleMs}ms recycle`);
    } else if (pageRecycleMs > 0 && Date.now() - pageOpenedAt >= pageRecycleMs) {
      await recreatePage(`scheduled ${pageRecycleMs}ms recycle`);
    }

    if (pageCrashed || !(await isScoreboardPageHealthy(page))) {
      await recreatePage(pageCrashed ? 'page crashed' : 'scoreboard DOM missing');
    }

    const image = await page
      .screenshot({
        type: 'jpeg',
        quality: 90,
        animations: 'allow',
        caret: 'hide',
      })
      .catch(async (error) => {
        await recreatePage(error instanceof Error ? error.message : 'screenshot failed');
        return page.screenshot({
          type: 'jpeg',
          quality: 90,
          animations: 'allow',
          caret: 'hide',
        });
      });

    const activeFfmpeg: ChildProcessWithoutNullStreams = ffmpeg;
    const frameWritten = await writeFrame(activeFfmpeg, image, frameWriteTimeoutMs);
    if (!frameWritten) {
      console.error('FFmpeg publisher is not accepting frames; restarting publisher.');
      activeFfmpeg.kill();
      if (ffmpeg === activeFfmpeg) ffmpeg = null;
      await restartFfmpeg();
      await delay(frameDelayMs);
      continue;
    }

    if (Date.now() - lastHeartbeatAt > 60000) {
      const rssMb = Math.round(process.memoryUsage().rss / 1024 / 1024);
      console.log(`TB50 streamer heartbeat rss=${rssMb}MB`);
      lastHeartbeatAt = Date.now();
    }

    const elapsed = Date.now() - start;
    const wait = frameDelayMs - elapsed;
    if (wait > 0) await delay(wait);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
