import { test, expect } from '@playwright/test';

const TARGET_URL = process.env.PLAYWRIGHT_TARGET_URL || 'https://kartodromodebetim.com.br';

const adminModules = [
  { key: 'dashboard', href: '/admin', title: 'Dashboard' },
  { key: 'reservas', href: '/admin/reservas', title: 'Reservas' },
  { key: 'recepcao', href: '/admin/recepcao', title: 'Recepção' },
  { key: 'lanchonete', href: '/admin/lanchonete', title: 'Lanchonete' },
  { key: 'cronometragem', href: '/admin/cronometragem', title: 'Cronometragem' },
  { key: 'campeonatos', href: '/admin/campeonatos', title: 'Campeonatos' },
  { key: 'resultados', href: '/admin/resultados', title: 'Resultados' },
  { key: 'financeira', href: '/admin/financeira', title: 'Financeiro' },
  { key: 'clientes', href: '/admin/clientes', title: 'Clientes' },
  { key: 'administrativa', href: '/admin/administrativa', title: 'Administrativa' },
  { key: 'clube', href: '/admin/clube', title: 'Clube de Vantagens' },
];

test.describe('Live Admin Simulation', () => {
  test('tests live endpoints and login flow', async ({ page }) => {
    console.log(`\n=== Testing Target: ${TARGET_URL} ===`);

    // 1. Visit Home Page
    const homeRes = await page.goto(`${TARGET_URL}/`, { waitUntil: 'domcontentloaded' });
    console.log(`GET / -> Status: ${homeRes?.status()}`);

    // 2. Visit Login Page
    const loginRes = await page.goto(`${TARGET_URL}/login`, { waitUntil: 'domcontentloaded' });
    console.log(`GET /login -> Status: ${loginRes?.status()}`);

    // 3. Perform Admin Login
    await page.fill('input[type="email"]', 'admin@kartbetim.com');
    await page.fill('input[type="password"]', 'KartBetim#2026');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);

    console.log(`After Login URL: ${page.url()}`);

    // 4. Verify all 11 Admin Modules
    for (const mod of adminModules) {
      const res = await page.goto(`${TARGET_URL}${mod.href}`, { waitUntil: 'domcontentloaded' });
      console.log(`Module [${mod.title}] (${mod.href}) -> Status: ${res?.status()}, URL: ${page.url()}`);
      expect(res?.status()).toBe(200);
    }
  });
});
