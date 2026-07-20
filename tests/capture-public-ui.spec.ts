import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';

const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:4174';
const outputDir = join(process.cwd(), 'artifacts', 'public-ui-baseline');

const viewports = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'tablet', width: 820, height: 1180 },
  { name: 'desktop', width: 1440, height: 900 },
] as const;

const pages = [
  { name: 'home', route: '/', reference: '/design/home.dc.html' },
  { name: 'pista', route: '/pista', reference: '/design/pista.dc.html' },
  { name: 'kart-locacao', route: '/kart-locacao', reference: '/design/kart-locacao.dc.html' },
  { name: 'reservas', route: '/reservas' },
  { name: 'eventos', route: '/eventos', reference: '/design/eventos.dc.html' },
  { name: 'campeonatos', route: '/campeonatos', reference: '/design/campeonatos.dc.html' },
  { name: 'historia', route: '/historia' },
  { name: 'duvidas', route: '/duvidas', reference: '/design/duvidas.dc.html' },
  { name: 'kac', route: '/kac', reference: '/design/kac.dc.html' },
  { name: 'kac-super', route: '/kac-super', reference: '/design/kac-super.dc.html' },
  { name: '200-milhas', route: '/200-milhas', reference: '/design/200-milhas.dc.html' },
  { name: '500-milhas', route: '/500-milhas', reference: '/design/500-milhas.dc.html' },
  { name: 'clube-vantagens', route: '/clube-vantagens', reference: '/design/clube-vantagens.dc.html' },
] as const;

const deterministicCss = `
  html { scroll-behavior: auto !important; }
  *, *::before, *::after {
    animation: none !important;
    transition: none !important;
    caret-color: transparent !important;
  }
`;

async function preparePage(page: Page, url: string, expectTemplatesResolved: boolean) {
  await page.route('**/*', async (route) => {
    const resourceType = route.request().resourceType();
    if (resourceType === 'media') {
      await route.abort();
      return;
    }
    await route.continue();
  });

  const response = await page.goto(url, { waitUntil: 'domcontentloaded' });
  expect(response?.status(), `${url} should load`).toBeLessThan(400);

  await page.addStyleTag({ content: deterministicCss });
  await page.evaluate(async () => {
    await document.fonts.ready;
    document.querySelectorAll('video').forEach((video) => {
      video.pause();
      try {
        video.currentTime = 0;
      } catch {
        // Cross-browser media implementations may reject seeking before metadata.
      }
    });
  });

  if (expectTemplatesResolved) {
    await page.waitForFunction(
      () => !document.body.innerText.includes('{{'),
      undefined,
      { timeout: 15_000 },
    ).catch(() => undefined);
  }

  await page.waitForTimeout(750);
}

test.describe.configure({ mode: 'serial' });
test.setTimeout(900_000);

mkdirSync(outputDir, { recursive: true });

for (const viewport of viewports) {
  test(`captures ${viewport.name} public UI baseline`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });

    for (const item of pages) {
      const currentUrl = new URL(item.route, baseUrl).href;
      await preparePage(page, currentUrl, false);
      await page.screenshot({
        path: join(outputDir, `${viewport.name}--${item.name}--next.jpg`),
        fullPage: true,
        type: 'jpeg',
        quality: 76,
      });

      if (item.reference) {
        const referenceUrl = new URL(item.reference, baseUrl).href;
        await preparePage(page, referenceUrl, true);
        await page.screenshot({
          path: join(outputDir, `${viewport.name}--${item.name}--reference.jpg`),
          fullPage: true,
          type: 'jpeg',
          quality: 76,
        });
      }
    }
  });
}

writeFileSync(
  join(outputDir, 'manifest.json'),
  JSON.stringify({
    generatedAt: new Date().toISOString(),
    baseUrl,
    viewports,
    pages,
    naming: '<viewport>--<page>--<next|reference>.jpg',
  }, null, 2),
  'utf8',
);
