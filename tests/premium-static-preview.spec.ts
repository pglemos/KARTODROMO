import { expect, test } from '@playwright/test';

const baseURL = process.env.PREMIUM_PREVIEW_URL;
const routes = [
  ['home', '/'],
  ['pista', '/pista'],
  ['locacao', '/kart-locacao'],
  ['campeonatos', '/campeonatos'],
  ['eventos', '/eventos'],
  ['duvidas', '/duvidas'],
  ['kac', '/kac'],
  ['kac-super', '/kac-super'],
  ['200-milhas', '/200-milhas'],
  ['500-milhas', '/500-milhas'],
] as const;

const viewports = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'desktop', width: 1440, height: 900 },
] as const;

test.describe('premium static preview', () => {
  test.skip(!baseURL, 'PREMIUM_PREVIEW_URL não informado');

  for (const viewport of viewports) {
    for (const [name, route] of routes) {
      test(`${name} ${viewport.name}`, async ({ page }) => {
        await page.setViewportSize(viewport);
        const response = await page.goto(`${baseURL}${route}`, { waitUntil: 'networkidle' });
        expect(response?.status()).toBe(200);
        expect(page.url()).not.toContain('/design/');
        await expect(page.locator('h1')).toBeVisible();
        await expect(page).toHaveTitle(/Kart|KAC|Milhas|Dúvidas|Eventos|Campeonatos|pista/i);
        const html = await page.content();
        expect(html).not.toContain('{{');
        expect(html).not.toContain('<sc-for');
        expect(html).not.toContain('.dc');
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow).toBeLessThanOrEqual(1);
        await page.screenshot({
          path: `test-results/premium-${name}-${viewport.name}.png`,
          fullPage: true,
        });
      });
    }
  }

  test('menu mobile controla foco, scroll e Escape', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${baseURL}/`, { waitUntil: 'networkidle' });
    const button = page.locator('.menu-toggle');
    await button.click();
    await expect(button).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('.mobile-nav')).toHaveClass(/open/);
    await expect(page.locator('body')).toHaveClass(/menu-open/);
    await page.keyboard.press('Escape');
    await expect(button).toHaveAttribute('aria-expanded', 'false');
    await expect(button).toBeFocused();
  });
});
