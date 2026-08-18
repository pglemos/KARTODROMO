import { existsSync, readFileSync } from 'node:fs';
import { fetchLapTimeApiSnapshot } from '@/lib/livetime/laptime-api';
import type { LiveTimingSnapshot } from '@/lib/livetime/types';

function isExpiredJwt(token: string): boolean {
  const payload = token.split('.')[1];
  if (!payload) return false;

  try {
    const normalizedPayload = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padding = '='.repeat((4 - (normalizedPayload.length % 4)) % 4);
    const decoded = JSON.parse(Buffer.from(`${normalizedPayload}${padding}`, 'base64').toString('utf8')) as { exp?: unknown };
    const exp = typeof decoded.exp === 'number' ? decoded.exp : Number(decoded.exp);

    return Number.isFinite(exp) && exp * 1000 <= Date.now();
  } catch {
    return false;
  }
}

export type ScraperOptions = {
  apiBaseUrl?: string;
  apiToken?: string;
  apiTokenFile?: string;
  pollMs?: number;
};

export class LiveTimeScraper {
  private snapshot: LiveTimingSnapshot | null = null;
  private timer: NodeJS.Timeout | null = null;
  private ticking = false;
  private stopped = false;

  constructor(private readonly options: ScraperOptions) {}

  getSnapshot(): LiveTimingSnapshot {
    return (
      this.snapshot || {
        status: 'waiting',
        source: 'rest',
        updatedAt: new Date().toISOString(),
        message: 'Scraper inicializando',
        drivers: [],
      }
    );
  }

  async start() {
    this.stopped = false;

    this.snapshot = {
      status: 'waiting',
      source: 'rest',
      updatedAt: new Date().toISOString(),
      message: this.hasApiSource() ? 'API LapTime inicializando' : 'API LapTime nao configurada',
      drivers: [],
    };

    await this.tick();
    this.timer = setInterval(() => {
      void this.tick();
    }, this.options.pollMs || 2000);
  }

  async stop() {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private hasApiSource() {
    const token = this.readApiToken();
    return Boolean(this.options.apiBaseUrl && token && !isExpiredJwt(token));
  }

  private readApiToken() {
    if (this.options.apiToken) return this.options.apiToken;
    if (!this.options.apiTokenFile || !existsSync(this.options.apiTokenFile)) return '';
    return readFileSync(this.options.apiTokenFile, 'utf8').trim();
  }

  private async tick() {
    if (this.stopped) return;
    if (this.ticking) return;

    this.ticking = true;
    try {
      await this.tickApi();
    } finally {
      this.ticking = false;
    }
  }

  private async tickApi() {
    if (!this.options.apiBaseUrl) return;

    const token = this.readApiToken();
    if (!token || isExpiredJwt(token)) {
      this.snapshot = {
        ...(this.snapshot || { drivers: [], source: 'rest' as const, updatedAt: new Date().toISOString() }),
        status: 'error',
        source: 'rest',
        updatedAt: new Date().toISOString(),
        message: 'Token API LapTime invalido ou expirado',
      };
      return;
    }

    try {
      const apiSnapshot = await fetchLapTimeApiSnapshot({
        baseUrl: this.options.apiBaseUrl,
        token,
        timeoutMs: Number(process.env.LAPTIME_API_TIMEOUT_MS || process.env.LIVETIME_TIMEOUT_MS || '3000'),
      });
      this.snapshot = apiSnapshot;
    } catch (error) {
      this.snapshot = {
        ...(this.snapshot || { drivers: [], source: 'rest' as const, updatedAt: new Date().toISOString() }),
        status: 'error',
        source: 'rest',
        updatedAt: new Date().toISOString(),
        message: error instanceof Error ? error.message : 'Erro na API LapTime',
      };
    }
  }
}