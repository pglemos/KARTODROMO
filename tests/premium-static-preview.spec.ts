import { expect, test, type Page } from '@playwright/test';
import { createHash } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const baseURL = process.env.PREMIUM_PREVIEW_URL;
const outputDir = join(process.cwd(), 'test-results', 'premium-reference-comparison');

const pages = [
  { name: 'home', route: '/', reference: '/design/home.dc.html' },
  { name: 'pista', route: '/pista', reference: '/design/pista.dc.html' },
  { name: 'kart-locacao', route: '/kart-locacao', reference: '/design/kart-locacao.dc.html' },
  { name: 'campeonatos', route: '/campeonatos', reference: '/design/campeonatos.dc.html' },
  { name: 'eventos', route: '/eventos', reference: '/design/eventos.dc.html' },
  { name: 'duvidas', route: '/duvidas', reference: '/design/duvidas.dc.html' },
  { name: 'kac', route: '/kac', reference: '/design/kac.dc.html' },
  { name: 'kac-super', route: '/kac-super', reference: '/design/kac-super.dc.html' },
  { name: '200-milhas', route: '/200-milhas', reference: '/design/200-milhas.dc.html' },
  { name: '500-milhas', route: '/500-milhas', reference: '/design/500-milhas.dc.html' },
] as const;

const viewports = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'tablet', width: 820, height: 1180 },
  { name: 'desktop', width: 1440, height: 900 },
] as const;

const deterministicCss = `
  html { scroll-behavior: auto !important; }
  *, *::before, *::after {
    animation: none !important;
    transition: none !important;
    caret-color: transparent !important;
  }
`;

const sha256 = (buffer: Buffer) => createHash('sha256').update(buffer).digest('hex');

function isTransientTemplateRequest(url: string) {
  try {
    const decodedURL = decodeURIComponent(url);
    return decodedURL.includes('{{') && decodedURL.includes('}}');
  } catch {
    return false;
  }
}

async function preparePage(page: Page, url: string) {
  const failedResources: string[] = [];
  const listener = (response: { status(): number; url(): string }) => {
    if (response.status() >= 400 && !isTransientTemplateRequest(response.url())) {
      failedResources.push(`${response.status()} ${response.url()}`);
    }
  };
  page.on('response', listener);

  const response = await page.goto(url, { waitUntil: 'domcontentloaded' });
  expect(response?.status(), `${url} deveria carregar`).toBeLessThan(400);

  await page.waitForFunction(
    () => !document.body.innerText.includes('{{') && !document.body.innerText.includes('<sc-for'),
    undefined,
    { timeout: 20_000 },
  );

  await page.addStyleTag({ content: deterministicCss });
  await page.evaluate(async () => {
    await document.fonts.ready;
    document.querySelectorAll('[data-reveal]').forEach((element) => {
      const htmlElement = element as HTMLElement;
      htmlElement.style.opacity = '1';
      htmlElement.style.transform = 'none';
    });
    document.querySelectorAll('video').forEach((video) => {
      video.pause();
      try {
        video.currentTime = 0;
      } catch {
        // O navegador pode bloquear seek antes dos metadados; o vídeo permanece pausado.
      }
    });
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(250);

  await expect(page.locator('h1')).toBeVisible();
  const unresolvedTemplates = await page.locator('body').evaluate((body) => {
    const html = body.innerHTML;
    return html.includes('{{') || html.includes('<sc-for');
  });
  expect(unresolvedTemplates, `${url} manteve templates não resolvidos no DOM final`).toBe(false);

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, `${url} possui overflow horizontal`).toBeLessThanOrEqual(1);
  expect(failedResources, `Recursos reais quebrados em ${url}`).toEqual([]);
  page.off('response', listener);
}

test.describe.configure({ mode: 'serial' });
test.setTimeout(1_200_000);

test.describe('premium reference recovery', () => {
  test.skip(!baseURL, 'PREMIUM_PREVIEW_URL não informado');
  mkdirSync(outputDir, { recursive: true });

  for (const viewport of viewports) {
    test(`rotas limpas são visualmente idênticas às referências em ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });

      for (const item of pages) {
        const cleanURL = new URL(item.route, baseURL).href;
        await preparePage(page, cleanURL);
        expect(page.url()).not.toContain('/design/');
        const cleanScreenshot = await page.screenshot({
          path: join(outputDir, `${viewport.name}--${item.name}--clean.png`),
          fullPage: true,
          animations: 'disabled',
        });

        const referenceURL = new URL(item.reference, baseURL).href;
        await preparePage(page, referenceURL);
        const referenceScreenshot = await page.screenshot({
          path: join(outputDir, `${viewport.name}--${item.name}--reference.png`),
          fullPage: true,
          animations: 'disabled',
        });

        expect(
          sha256(cleanScreenshot),
          `${item.name} em ${viewport.name} divergiu visualmente da página original`,
        ).toBe(sha256(referenceScreenshot));
      }
    });
  }

  test('menu mobile e modal continuam funcionais pelo runtime original', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await preparePage(page, new URL('/', baseURL).href);

    const menuButton = page.locator('button[aria-controls="mobile-navigation"]');
    await menuButton.click();
    await expect(menuButton).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('#mobile-navigation')).toHaveAttribute('aria-hidden', 'false');
    await page.keyboard.press('Escape');
    await expect(menuButton).toHaveAttribute('aria-expanded', 'false');

    const modalButton = page.locator('button[aria-controls="event-modal"]').first();
    await modalButton.click();
    await expect(page.locator('#event-modal')).toHaveAttribute('aria-hidden', 'false');
    await page.keyboard.press('Escape');
    await expect(page.locator('#event-modal')).toHaveAttribute('aria-hidden', 'true');
  });
});
