const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  await page.setViewportSize({ width: 1440, height: 900 });

  console.log('Navigating to login...');
  await page.goto('https://kartodromodebetim.com.br/login', { waitUntil: 'networkidle' });
  
  await page.waitForTimeout(2000);

  try {
    await page.fill('input[type="email"]', 'admin@kartbetim.com');
    await page.fill('input[type="password"]', 'KartBetim#2026');
    await page.click('button[type="submit"]');
  } catch(e) {
    console.log('Error logging in:', e.message);
  }
  
  await page.waitForTimeout(3000);
  
  console.log('Navigating to admin dashboard...');
  await page.goto('https://kartodromodebetim.com.br/admin', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  
  const dashboardText = await page.evaluate(() => document.body.innerText);
  console.log('--- DASHBOARD TEXT ---');
  console.log(dashboardText.substring(0, 1000));
  
  console.log('Navigating to admin clientes...');
  await page.goto('https://kartodromodebetim.com.br/admin/clientes', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  
  const clientesText = await page.evaluate(() => document.body.innerText);
  console.log('--- CLIENTES TEXT ---');
  console.log(clientesText.substring(0, 1000));

  await browser.close();
})();
