const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('https://kartodromodebetim.com.br/login', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.fill('input[type="email"]', 'admin@kartbetim.com');
  await page.fill('input[type="password"]', 'KartBetim#2026');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2000);
  
  const pages = ['reservas', 'recepcao', 'lanchonete', 'cronometragem', 'campeonatos', 'resultados'];
  
  for (const p of pages) {
    console.log(`\n\n--- Checking ${p} ---`);
    await page.goto(`https://kartodromodebetim.com.br/admin/${p}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    const text = await page.evaluate(() => document.body.innerText);
    console.log(text.substring(0, 500));
  }
  await browser.close();
})();
