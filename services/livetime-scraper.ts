import type { Browser, Page } from 'playwright';
import { chromium } from 'playwright';
import { extractDriversFromTable, extractEventNames, inferStatusFromText } from '@/lib/livetime/dom-extractor';
import type { LiveTimingSnapshot } from '@/lib/livetime/types';

const LIVETIME_BASE_URL = 'https://livetime.azurewebsites.net/';
const ROW_SELECTORS = ['table.table-livetime tbody tr', '.table-livetime tbody tr', 'tr.tr-livetime', 'table tbody tr'];
const HEADER_SELECTORS = ['table.table-livetime thead th', '.table-livetime thead th', '.th-livetime', 'table thead th'];

export type ScraperOptions = {
  uid: string;
  headless?: boolean;
  pollMs?: number;
};

export class LiveTimeScraper {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private snapshot: LiveTimingSnapshot | null = null;
  private timer: NodeJS.Timeout | null = null;
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
    await this.connect();
    await this.tick();
    this.timer = setInterval(() => {
      void this.tick();
    }, this.options.pollMs || 2000);
  }

  async stop() {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    await this.browser?.close();
    this.browser = null;
    this.page = null;
  }

  private liveTimeUrl() {
    const url = new URL(LIVETIME_BASE_URL);
    url.searchParams.set('uid', this.options.uid);
    return url.toString();
  }

  private async connect() {
    await this.browser?.close().catch(() => undefined);
    this.browser = await chromium.launch({ headless: this.options.headless ?? true });
    this.page = await this.browser.newPage({
      viewport: { width: 1280, height: 720 },
    });
    this.page.setDefaultTimeout(5000);
    await this.page.goto(this.liveTimeUrl(), { waitUntil: 'domcontentloaded' });
  }

  private async tick() {
    if (this.stopped) return;

    try {
      if (!this.page || this.page.isClosed()) {
        await this.connect();
      }

      const page = this.page;
      if (!page) return;

      const text = await page.locator('body').innerText().catch(() => '');
      const headers = await this.readFirstMatchingTexts(page, HEADER_SELECTORS);
      const rowTexts = await this.readRows(page);
      const drivers = extractDriversFromTable(headers, rowTexts);
      const names = extractEventNames(text);

      this.snapshot = {
        status: inferStatusFromText(text, drivers),
        source: 'dom-scraper',
        updatedAt: new Date().toISOString(),
        ...names,
        drivers,
      };
    } catch (error) {
      this.snapshot = {
        ...(this.snapshot || { drivers: [], source: 'dom-scraper' as const, updatedAt: new Date().toISOString() }),
        status: 'error',
        source: 'dom-scraper',
        updatedAt: new Date().toISOString(),
        message: error instanceof Error ? error.message : 'Erro no scraper DOM',
      };
      await this.connect().catch(() => undefined);
    }
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
