const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  await page.setViewportSize({ width: 1280, height: 800 });

  const results = [];
  page.on('response', response => {
    const url = response.url();
    if (url.includes('/api/') || url.includes('.mp4')) {
      results.push(`URL: ${url} -> Status: ${response.status()}`);
    }
  });

  console.log('Navigating to login...');
  await page.goto('https://kartodromodebetim.com.br/login', { waitUntil: 'networkidle' }).catch(() => {});
  
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'C:/Users/Administrador/.gemini/antigravity-cli/brain/158b9eba-7acb-46f8-9e25-eb02edf926be/scratch/login.png', fullPage: true });

  // Fill login
  try {
    await page.fill('input[type="email"]', 'admin@kartbetim.com');
    await page.fill('input[type="password"]', 'KartBetim#2026');
    await page.click('button[type="submit"]');
  } catch(e) {}
  
  await page.waitForTimeout(3000);
  
  console.log('Navigating to admin dashboard...');
  await page.goto('https://kartodromodebetim.com.br/admin', { waitUntil: 'networkidle' }).catch(() => {});
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'C:/Users/Administrador/.gemini/antigravity-cli/brain/158b9eba-7acb-46f8-9e25-eb02edf926be/scratch/admin.png', fullPage: true });

  console.log('Navigating to admin clientes...');
  await page.goto('https://kartodromodebetim.com.br/admin/clientes', { waitUntil: 'networkidle' }).catch(() => {});
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'C:/Users/Administrador/.gemini/antigravity-cli/brain/158b9eba-7acb-46f8-9e25-eb02edf926be/scratch/clientes.png', fullPage: true });

  fs.writeFileSync('C:/Users/Administrador/.gemini/antigravity-cli/brain/158b9eba-7acb-46f8-9e25-eb02edf926be/scratch/network.txt', results.join('\n'));
  console.log('Done!');
  await browser.close();
})();
