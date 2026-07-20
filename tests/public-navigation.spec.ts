import { expect, test } from '@playwright/test';

const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:4174';

test.describe('public navigation shell', () => {
  test('mobile menu traps focus, locks scroll and restores focus on Escape', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });

    const trigger = page.getByRole('button', { name: 'Abrir menu' });
    await trigger.click();

    const dialog = page.getByRole('dialog', { name: 'Menu principal' });
    await expect(dialog).toBeVisible();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('body')).toHaveCSS('overflow', 'hidden');

    const focusIsInside = await page.evaluate(() => {
      const active = document.activeElement;
      const menu = document.querySelector('[role="dialog"][aria-label="Menu principal"]');
      return Boolean(active && menu?.contains(active));
    });
    expect(focusIsInside).toBeTruthy();

    await page.keyboard.press('Escape');

    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden');
  });

  test('desktop navigation is concise and exposes one primary booking action', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });

    const navigation = page.getByRole('navigation', { name: 'Navegação principal' });
    await expect(navigation).toBeVisible();

    const links = navigation.getByRole('link');
    expect(await links.count()).toBeLessThanOrEqual(8);
    await expect(navigation.getByRole('link', { name: 'Reservar agora' })).toBeVisible();
  });
});
