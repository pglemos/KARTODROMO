import { test } from '@playwright/test';

test('Open Headed Chrome Browser', async ({ page }) => {
  console.log('Opening Chrome window on desktop...');
  await page.goto('https://kartodromodebetim.com.br/admin', { waitUntil: 'domcontentloaded' });
  await page.fill('input[type="email"]', 'admin@kartbetim.com');
  await page.fill('input[type="password"]', 'KartBetim#2026');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(10000);
});
