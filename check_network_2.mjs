import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('response', response => {
    const url = response.url();
    const status = response.status();
    if (status >= 400 || url.includes('favicon.ico') || url.includes('/api/admin/laptime/bookings') || url.includes('/api/admin/clientes')) {
      console.log(`[NETWORK] ${status} ${response.request().method()} ${url}`);
    }
  });

  try {
    console.log('Navigating to https://kartodromodebetim.com.br ...');
    await page.goto('https://kartodromodebetim.com.br', { waitUntil: 'networkidle', timeout: 30000 });
    
    console.log('Navigating to https://kartodromodebetim.com.br/admin ...');
    await page.goto('https://kartodromodebetim.com.br/admin', { waitUntil: 'networkidle', timeout: 30000 });
    
    const usernameInput = await page.$('input[name="email"], input[type="email"], input[type="text"]');
    const passwordInput = await page.$('input[name="password"], input[type="password"]');
    
    if (usernameInput && passwordInput) {
      console.log('Found login form. Attempting dummy login admin@kartodromodebetim.com.br...');
      await usernameInput.fill('admin@kartodromodebetim.com.br');
      await passwordInput.fill('admin'); // Try a common one
      const submitBtn = await page.$('button[type="submit"]');
      if (submitBtn) {
        await submitBtn.click();
        await page.waitForTimeout(5000); 
      }
    }
    
    // Explicitly navigate to the APIs directly to see their status
    console.log('Navigating directly to API 1: /api/admin/laptime/bookings');
    await page.goto('https://kartodromodebetim.com.br/api/admin/laptime/bookings', { timeout: 30000 }).catch(() => {});
    
    console.log('Navigating directly to API 2: /api/admin/clientes');
    await page.goto('https://kartodromodebetim.com.br/api/admin/clientes', { timeout: 30000 }).catch(() => {});

    console.log('Navigating directly to favicon.ico');
    await page.goto('https://kartodromodebetim.com.br/favicon.ico', { timeout: 30000 }).catch(() => {});
    
  } catch (err) {
    console.error('Error during navigation:', err);
  } finally {
    await browser.close();
  }
})();
