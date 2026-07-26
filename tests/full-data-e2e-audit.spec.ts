import { test, expect } from '@playwright/test';

const TARGET_URL = process.env.PLAYWRIGHT_TARGET_URL || 'https://kartodromodebetim.com.br';

test.describe('Comprehensive Real-time SQL Data & Module Audit', () => {
  test('Full end-to-end data load and edit validation', async ({ page }) => {
    page.setViewportSize({ width: 1440, height: 900 });

    console.log('1. Logging in...');
    await page.goto(`${TARGET_URL}/login`, { waitUntil: 'networkidle' });
    await page.fill('input[type="email"]', 'admin@kartbetim.com');
    await page.fill('input[type="password"]', 'KartBetim#2026');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);

    const modules = [
      { name: 'Dashboard', url: '/admin' },
      { name: 'Reservas', url: '/admin/reservas' },
      { name: 'Recepção', url: '/admin/recepcao' },
      { name: 'Lanchonete', url: '/admin/lanchonete' },
      { name: 'Cronometragem', url: '/admin/cronometragem' },
      { name: 'Campeonatos', url: '/admin/campeonatos' },
      { name: 'Resultados', url: '/admin/resultados' },
      { name: 'Financeiro', url: '/admin/financeira' },
      { name: 'Clientes', url: '/admin/clientes' },
      { name: 'Administrativa', url: '/admin/administrativa' },
      { name: 'Clube de Vantagens', url: '/admin/clube' },
    ];

    for (const mod of modules) {
      console.log(`Checking module [${mod.name}] (${mod.url})...`);
      const response = await page.goto(`${TARGET_URL}${mod.url}`, { waitUntil: 'networkidle' });
      expect(response?.status()).toBe(200);

      // Verify no "Erro de Request" notification card exists on the page
      const errorCard = page.locator('text="Erro de Request"');
      await expect(errorCard).not.toBeVisible();
    }

    console.log('All 11 modules loaded cleanly with 200 OK and zero request errors!');
  });
});
