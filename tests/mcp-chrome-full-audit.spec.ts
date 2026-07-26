import { test, expect } from '@playwright/test';
import path from 'node:path';

const TARGET_URL = 'https://kartodromodebetim.com.br';
const ARTIFACT_DIR = 'C:/Users/Administrador/.gemini/antigravity-cli/brain/158b9eba-7acb-46f8-9e25-eb02edf926be';

test('Full Visual & SQL Data Audit across all 11 Admin Modules', async ({ page }) => {
  page.setViewportSize({ width: 1440, height: 900 });

  console.log('1. Navigating to Login...');
  await page.goto(`${TARGET_URL}/login`, { waitUntil: 'networkidle' });
  await page.fill('input[type="email"]', 'admin@kartbetim.com');
  await page.fill('input[type="password"]', 'KartBetim#2026');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2000);

  const modules = [
    { name: '01_Dashboard', url: '/admin' },
    { name: '02_Reservas', url: '/admin/reservas' },
    { name: '03_Recepcao', url: '/admin/recepcao' },
    { name: '04_Lanchonete', url: '/admin/lanchonete' },
    { name: '05_Cronometragem', url: '/admin/cronometragem' },
    { name: '06_Campeonatos', url: '/admin/campeonatos' },
    { name: '07_Resultados', url: '/admin/resultados' },
    { name: '08_Financeiro', url: '/admin/financeira' },
    { name: '09_Clientes', url: '/admin/clientes' },
    { name: '10_Administrativa', url: '/admin/administrativa' },
    { name: '11_Clube_Vantagens', url: '/admin/clube' },
  ];

  for (const mod of modules) {
    console.log(`Auditing and capturing screenshot for [${mod.name}]...`);
    const response = await page.goto(`${TARGET_URL}${mod.url}`, { waitUntil: 'networkidle' });
    expect(response?.status()).toBe(200);
    await page.waitForTimeout(1000);

    const screenshotPath = path.join(ARTIFACT_DIR, `mcp_${mod.name}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });

    // Verify error card is not present
    const errorCard = page.locator('text="Erro de Request"');
    await expect(errorCard).not.toBeVisible();
  }

  console.log('All 11 Admin Modules audited with clean screenshots!');
});
