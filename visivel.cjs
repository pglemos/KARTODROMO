const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  // ABRE O CHROME DE VERDADE NA TELA DO USUÁRIO
  const browser = await chromium.launch({ headless: false, slowMo: 1000 });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  await page.setViewportSize({ width: 1440, height: 900 });

  const results = [];
  page.on('response', response => {
    const url = response.url();
    if (url.includes('/api/') || url.includes('.mp4')) {
      results.push(`URL: ${url} -> Status: ${response.status()}`);
    }
  });

  console.log('Navegando para o site em produção...');
  await page.goto('https://kartodromodebetim.com.br/login', { waitUntil: 'networkidle' }).catch(() => {});
  
  await page.waitForTimeout(3000);

  // Fill login
  console.log('Fazendo login como admin...');
  try {
    await page.fill('input[type="email"]', 'admin@kartbetim.com');
    await page.fill('input[type="password"]', 'KartBetim#2026');
    await page.click('button[type="submit"]');
  } catch(e) {}
  
  await page.waitForTimeout(4000);
  
  console.log('Acessando o Dashboard...');
  await page.goto('https://kartodromodebetim.com.br/admin', { waitUntil: 'networkidle' }).catch(() => {});
  await page.waitForTimeout(3000);

  console.log('Acessando aba de Clientes...');
  await page.goto('https://kartodromodebetim.com.br/admin/clientes', { waitUntil: 'networkidle' }).catch(() => {});
  await page.waitForTimeout(4000);

  console.log('Fechando navegador...');
  await browser.close();
})();
