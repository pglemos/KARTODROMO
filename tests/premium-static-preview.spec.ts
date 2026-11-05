import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const baseURL = process.env.PREMIUM_PREVIEW_URL;
const outputDir = join(process.cwd(), 'test-results', 'premium-zip-comparison');
const pages = [
  { name: 'home', route: '/', reference: '/site/index.html' },
  { name: 'pista', route: '/pista', reference: '/site/pista.html' },
  { name: 'kart-locacao', route: '/kart-locacao', reference: '/site/kart-locacao.html' },
  { name: 'campeonatos', route: '/campeonatos', reference: '/site/campeonatos.html' },
  { name: 'eventos', route: '/eventos', reference: '/site/eventos.html' },
  { name: 'duvidas', route: '/duvidas', reference: '/site/duvidas.html' },
  { name: 'kac', route: '/kac', reference: '/site/kac.html' },
  { name: 'kac-super', route: '/kac-super', reference: '/site/kac-super.html' },
  { name: '200-milhas', route: '/200-milhas', reference: '/site/200-milhas.html' },
  { name: '500-milhas', route: '/500-milhas', reference: '/site/500-milhas.html' },
] as const;
const viewports = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'tablet', width: 820, height: 1180 },
  { name: 'desktop', width: 1440, height: 900 },
] as const;
const stableCss = `html{scroll-behavior:auto!important}*,*:before,*:after{animation:none!important;transition:none!important;caret-color:transparent!important}a[href="#conteudo"]{opacity:0!important;pointer-events:none!important}`;

async function prepare(page: Page, url: string) {
  const broken: string[] = [];
  const listener = (response: { status(): number; url(): string }) => {
    if (response.status() >= 400) broken.push(`${response.status()} ${response.url()}`);
  };
  page.on('response', listener);
  const response = await page.goto(url, { waitUntil: 'networkidle' });
  expect(response?.status()).toBeLessThan(400);
  await page.addStyleTag({ content: stableCss });
  await page.evaluate(async () => {
    await document.fonts.ready;
    document.documentElement.style.scrollBehavior = 'auto';
    document.body.style.scrollBehavior = 'auto';
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    document.querySelectorAll<HTMLElement>('.reveal').forEach((element) => {
      element.classList.add('in');
      element.style.opacity = '1';
      element.style.transform = 'none';
    });
    document.querySelectorAll('video').forEach((video) => {
      video.pause();
      try { video.currentTime = 0; } catch { /* vídeo ainda sem metadados */ }
    });
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  });
  await page.waitForFunction(() => window.scrollX === 0 && window.scrollY === 0);
  await expect(page.locator('h1')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  expect(broken).toEqual([]);
  page.off('response', listener);
}

test.describe.configure({ mode: 'serial' });
test.setTimeout(1_200_000);

test.describe('fidelidade ao ZIP final', () => {
  test.skip(!baseURL, 'PREMIUM_PREVIEW_URL não informado');
  mkdirSync(outputDir, { recursive: true });

  for (const viewport of viewports) {
    test(`rotas limpas igualam o HTML do ZIP em ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      for (const item of pages) {
        await prepare(page, new URL(item.route, baseURL).href);
        expect(page.url()).not.toContain('/site/');
        const clean = await page.screenshot({
          path: join(outputDir, `${viewport.name}--${item.name}--clean.png`),
          fullPage: true,
          animations: 'disabled',
        });

        await prepare(page, new URL(item.reference, baseURL).href);
        const reference = await page.screenshot({
          path: join(outputDir, `${viewport.name}--${item.name}--reference.png`),
          fullPage: true,
          animations: 'disabled',
        });
        expect(clean.equals(reference), `${item.name} divergiu em ${viewport.name}`).toBe(true);
      }
    });
  }

  test('menu, modal, FAQ e mapa continuam interativos', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await prepare(page, new URL('/', baseURL).href);
    const menu = page.locator('.menu-toggle');
    await menu.click();
    await expect(menu).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('Escape');
    await expect(menu).toHaveAttribute('aria-expanded', 'false');

    await page.locator('[data-modal-open]').first().click();
    await expect(page.locator('#event-modal')).toHaveClass(/open/);
    await page.keyboard.press('Escape');
    await expect(page.locator('#event-modal')).not.toHaveClass(/open/);

    await prepare(page, new URL('/duvidas', baseURL).href);
    const faq = page.locator('.faq-q').first();
    await faq.click();
    await expect(faq).toHaveAttribute('aria-expanded', 'true');

    await prepare(page, new URL('/pista', baseURL).href);
    const track = page.locator('.track-tab').nth(1);
    await track.click();
    await expect(track).toHaveAttribute('aria-selected', 'true');
  });
});
