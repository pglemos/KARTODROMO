import type { Browser, Page } from 'playwright';
import { chromium } from 'playwright';
import { existsSync, readFileSync } from 'node:fs';
import {
  extractDriversFromLapTimeCards,
  extractDriversFromResultCards,
  extractDriversFromTable,
  extractEventNames,
  inferSessionTypeFromText,
  inferStatusFromText,
} from '@/lib/livetime/dom-extractor';
import { fetchLapTimeApiSnapshot } from '@/lib/livetime/laptime-api';
import { fetchLapTimeSqlSnapshot, type LapTimeSqlOptions } from '@/lib/livetime/laptime-sql';
import type { LiveTimingDriver, LiveTimingSnapshot } from '@/lib/livetime/types';
import { ensureWindowsSystemPath, resolvePreferredBrowserExecutablePath } from '@/lib/playwright-runtime';

const LIVETIME_BASE_URL = 'https://livetime.azurewebsites.net/';
const ROW_SELECTORS = ['table.table-livetime tbody tr', '.table-livetime tbody tr', 'tr.tr-livetime', 'table tbody tr'];
const HEADER_SELECTORS = ['table.table-livetime thead th', '.table-livetime thead th', '.th-livetime', 'table thead th'];
const LAPTIME_CARD_SELECTOR = '.live-competitor-card-ctn';
const RESULT_CARD_SELECTOR = '.pilot-card-container';
const PAGE_TIMEOUT_MS = Number(process.env.LIVETIME_PAGE_TIMEOUT_MS || '30000');
const PAGE_RELOAD_MS = Number(process.env.LIVETIME_SCRAPER_RELOAD_MS || '15000');
const DOM_BROWSER_MAX_AGE_MS = Number(process.env.LIVETIME_DOM_BROWSER_MAX_AGE_MS || '1800000');
ensureWindowsSystemPath();
const chromePath = resolvePreferredBrowserExecutablePath(process.env.LIVETIME_CHROME_PATH || process.env.TB50_CHROME_PATH);

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
  uid: string;
  sourceUrl?: string;
  apiBaseUrl?: string;
  apiToken?: string;
  apiTokenFile?: string;
  sql?: LapTimeSqlOptions;
  headless?: boolean;
  pollMs?: number;
};

export class LiveTimeScraper {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private snapshot: LiveTimingSnapshot | null = null;
  private lastKartDrivers: LiveTimingDriver[] = [];
  private lastPageLoadAt = 0;
  private domConnectedAt = 0;
  private timer: NodeJS.Timeout | null = null;
  private ticking = false;
  private stopped = false;

  constructor(private readonly options: ScraperOptions) {}

  getSnapshot(): LiveTimingSnapshot {
    return (
      this.snapshot || {
        status: 'waiting',
        source: 'dom-scraper',
        updatedAt: new Date().toISOString(),
        message: 'Scraper inicializando',
        drivers: [],
      }
    );
  }

  async start() {
    this.stopped = false;
    if (!this.hasSqlSource() && !this.hasApiSource()) {
      await this.connect().catch((error) => {
        this.snapshot = {
          status: 'waiting',
          source: 'dom-scraper',
          updatedAt: new Date().toISOString(),
          message: error instanceof Error ? error.message : 'Aguardando LiveTime carregar',
          drivers: [],
        };
      });
    } else {
      this.snapshot = {
        status: 'waiting',
        source: this.hasSqlSource() ? 'sql' : 'rest',
        updatedAt: new Date().toISOString(),
        message: this.hasSqlSource() ? 'SQL LapTime inicializando' : 'API LapTime inicializando',
        drivers: [],
      };
    }

    await this.tick();
    this.timer = setInterval(() => {
      void this.tick();
    }, this.options.pollMs || 2000);
  }

  async stop() {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    await this.closeDomBrowser();
  }

  private liveTimeUrl() {
    if (this.options.sourceUrl) return this.options.sourceUrl;

    const url = new URL(LIVETIME_BASE_URL);
    url.searchParams.set('uid', this.options.uid);
    return url.toString();
  }

  private async connect() {
    await this.browser?.close().catch(() => undefined);
    this.browser = await chromium.launch({
      headless: this.options.headless ?? true,
      executablePath: chromePath && existsSync(chromePath) ? chromePath : undefined,
      args: [
        '--disable-background-timer-throttling',
        '--disable-renderer-backgrounding',
        '--disable-backgrounding-occluded-windows',
        '--disable-dev-shm-usage',
      ],
    });
    this.page = await this.browser.newPage({
      viewport: { width: 2048, height: 512 },
    });
    this.page.setDefaultTimeout(PAGE_TIMEOUT_MS);
    await this.page.goto(this.liveTimeUrl(), { waitUntil: 'commit', timeout: PAGE_TIMEOUT_MS });
    this.domConnectedAt = Date.now();
    this.lastPageLoadAt = Date.now();
    await this.page.waitForTimeout(1000).catch(() => undefined);
  }

  private async closeDomBrowser() {
    await this.browser?.close().catch(() => undefined);
    this.browser = null;
    this.page = null;
    this.domConnectedAt = 0;
    this.lastPageLoadAt = 0;
  }

  private async reloadIfNeeded(page: Page) {
    if (PAGE_RELOAD_MS <= 0 || Date.now() - this.lastPageLoadAt < PAGE_RELOAD_MS) return;

    await page.goto(this.liveTimeUrl(), { waitUntil: 'commit', timeout: PAGE_TIMEOUT_MS });
    this.lastPageLoadAt = Date.now();
    await page.waitForTimeout(1000).catch(() => undefined);
  }

  private async tick() {
    if (this.stopped) return;
    if (this.ticking) return;

    this.ticking = true;
    try {
      if (await this.tickSql()) {
        await this.closeDomBrowser();
        return;
      }

      if (await this.tickApi()) {
        await this.closeDomBrowser();
        return;
      }

      await this.tickDom();
    } finally {
      this.ticking = false;
    }
  }

  private hasSqlSource() {
    return Boolean(this.options.sql?.server && this.options.sql.database && this.options.sql.user && this.options.sql.password);
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

  private async tickSql() {
    if (!this.options.sql || !this.hasSqlSource()) return false;

    try {
      const sqlSnapshot = await fetchLapTimeSqlSnapshot(this.options.sql);
      this.snapshot = sqlSnapshot;

      if (this.options.sourceUrl && !sqlSnapshot.drivers.some((driver) => driver.kart.trim())) {
        return false;
      }

      return true;
    } catch (error) {
      if (this.options.sourceUrl) {
        return false;
      }

      this.snapshot = {
        ...(this.snapshot || { drivers: [], source: 'sql' as const, updatedAt: new Date().toISOString() }),
        status: 'error',
        source: 'sql',
        updatedAt: new Date().toISOString(),
        message: error instanceof Error ? error.message : 'Erro no SQL LapTime',
      };

      return false;
    }
  }

  private async tickApi() {
    if (!this.options.apiBaseUrl) return false;

    const token = this.readApiToken();
    if (!token) return false;
    if (isExpiredJwt(token)) return false;

    try {
      const apiSnapshot = await fetchLapTimeApiSnapshot({
        baseUrl: this.options.apiBaseUrl,
        token,
        timeoutMs: Number(process.env.LAPTIME_API_TIMEOUT_MS || process.env.LIVETIME_TIMEOUT_MS || '3000'),
      });
      this.snapshot = apiSnapshot;

      if (this.options.sourceUrl && !apiSnapshot.drivers.some((driver) => driver.kart.trim())) {
        return false;
      }

      return true;
    } catch (error) {
      if (this.options.sourceUrl) {
        return false;
      }

      this.snapshot = {
        ...(this.snapshot || { drivers: [], source: 'rest' as const, updatedAt: new Date().toISOString() }),
        status: 'error',
        source: 'rest',
        updatedAt: new Date().toISOString(),
        message: error instanceof Error ? error.message : 'Erro na API LapTime',
      };

      return false;
    }
  }

  private async tickDom() {
    try {
      if (
        !this.page ||
        this.page.isClosed() ||
        (DOM_BROWSER_MAX_AGE_MS > 0 && this.domConnectedAt > 0 && Date.now() - this.domConnectedAt > DOM_BROWSER_MAX_AGE_MS)
      ) {
        await this.connect();
      }

      const page = this.page;
      if (!page) return;

      await this.reloadIfNeeded(page);
      const text = await page.locator('body').innerText().catch(() => '');
      const headers = await this.readFirstMatchingTexts(page, HEADER_SELECTORS);
      const rowTexts = await this.readRows(page);
      const cardRows = await this.readLapTimeCards(page);
      const resultRows = cardRows.length > 0 ? [] : await this.readResultCards(page);
      const extractedDrivers =
        cardRows.length > 0
          ? extractDriversFromLapTimeCards(cardRows)
          : resultRows.length > 0
            ? extractDriversFromResultCards(resultRows)
            : extractDriversFromTable(headers, rowTexts);
      const drivers = this.hydrateMissingKarts(extractedDrivers);
      const hasKartNumbers = drivers.some((driver) => driver.kart.trim());
      const names = extractEventNames(text);
      const inferredSessionType = inferSessionTypeFromText(text);
      const sessionType = inferredSessionType === 'unknown' ? this.snapshot?.sessionType || 'unknown' : inferredSessionType;

      if (drivers.length > 0 && !hasKartNumbers && this.options.apiBaseUrl) {
        this.snapshot = this.snapshot?.drivers.some((driver) => driver.kart.trim())
          ? {
              ...this.snapshot,
              updatedAt: new Date().toISOString(),
              message: 'Fonte atual sem numero de kart; mantendo ultimo grid com kart',
            }
          : {
              status: 'waiting',
              source: 'dom-scraper',
              updatedAt: new Date().toISOString(),
              message: 'Fonte atual sem numero de kart',
              drivers: [],
            };
        return true;
      }

      this.snapshot = {
        status: inferStatusFromText(text, drivers, resultRows.length > 0),
        source: 'dom-scraper',
        updatedAt: new Date().toISOString(),
        sessionType,
        ...names,
        drivers,
      };

      if (hasKartNumbers) {
        this.lastKartDrivers = drivers.filter((driver) => driver.kart.trim());
      }

      return true;
    } catch (error) {
      this.snapshot = {
        ...(this.snapshot || { drivers: [], source: 'dom-scraper' as const, updatedAt: new Date().toISOString() }),
        status: 'error',
        source: 'dom-scraper',
        updatedAt: new Date().toISOString(),
        message: error instanceof Error ? error.message : 'Erro no scraper DOM',
      };
      await this.connect().catch(() => undefined);
      return false;
    }
  }

  private hydrateMissingKarts(drivers: LiveTimingDriver[]): LiveTimingDriver[] {
    if (drivers.length === 0 || drivers.some((driver) => driver.kart.trim()) || this.lastKartDrivers.length === 0) return drivers;

    const byPosition = new Map(this.lastKartDrivers.map((driver) => [driver.position, driver.kart]));
    const byName = new Map(this.lastKartDrivers.map((driver) => [this.nameKey(driver.name), driver.kart]));

    return drivers.map((driver) => ({
      ...driver,
      kart: byPosition.get(driver.position) || byName.get(this.nameKey(driver.name)) || driver.kart,
    }));
  }

  private nameKey(name: string): string {
    return name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toUpperCase();
  }

  private async readFirstMatchingTexts(page: Page, selectors: string[]) {
    for (const selector of selectors) {
      const locator = page.locator(selector);
      const count = await locator.count().catch(() => 0);
      if (count > 0) {
        return locator.evaluateAll((nodes) => nodes.map((node) => (node.textContent || '').trim()));
      }
    }

    return [];
  }

  private async readLapTimeCards(page: Page) {
    const locator = page.locator(LAPTIME_CARD_SELECTOR);
    const count = await locator.count().catch(() => 0);
    if (count <= 0) return [];

    return locator.evaluateAll((cards) =>
      cards.map((card) => {
        return {
          cells: [
            (card.querySelector('.c-pos')?.textContent || '').trim(),
            (card.querySelector('.c-name')?.textContent || '').trim(),
            (card.querySelector('.c-laptime')?.textContent || '').trim(),
            (card.querySelector('.c-bestlaptime')?.textContent || '').trim(),
            (card.querySelector('.c-diff')?.textContent || '').trim(),
            (card.querySelector('.c-diffleader')?.textContent || '').trim(),
            card.textContent || '',
          ],
        };
      }),
    );
  }

  private async readResultCards(page: Page) {
    const locator = page.locator(RESULT_CARD_SELECTOR);
    const count = await locator.count().catch(() => 0);
    if (count <= 0) return [];

    return locator.evaluateAll((cards) =>
      cards.map((card) => {
        return {
          cells: [
            (card.querySelector('.pos-text')?.textContent || '').trim(),
            (card.querySelector('.competitor-time')?.textContent || '').trim(),
            (card.querySelector('.competitor-name-h1')?.textContent || '').trim(),
            (card.querySelector('.kart-number, .competitor-kart, .kart')?.textContent || '').trim(),
          ],
        };
      }),
    );
  }

  private async readRows(page: Page) {
    for (const selector of ROW_SELECTORS) {
      const locator = page.locator(selector);
      const count = await locator.count().catch(() => 0);
      if (count > 0) {
        return locator.evaluateAll((rows) =>
          rows.map((row) => ({
            cells: Array.from(row.querySelectorAll('th,td')).map((cell) => (cell.textContent || '').trim()),
          })),
        );
      }
    }

    return [];
  }
}
