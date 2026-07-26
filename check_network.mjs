import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('response', response => {
    const url = response.url();
    if (url.includes('/api/admin/laptime/bookings') || 
        url.includes('/api/admin/clientes') || 
        url.includes('favicon.ico')) {
      console.log(`[NETWORK] ${response.status()} ${response.request().method()} ${url}`);
    }
  });

  try {
    console.log('Navigating to https://kartodromodebetim.com.br ...');
    await page.goto('https://kartodromodebetim.com.br', { waitUntil: 'networkidle', timeout: 30000 });
    console.log('Navigated to home. Waiting a few seconds...');
    await page.waitForTimeout(3000);
    
    console.log('Navigating to https://kartodromodebetim.com.br/admin ...');
    await page.goto('https://kartodromodebetim.com.br/admin', { waitUntil: 'networkidle', timeout: 30000 });
    console.log('Navigated to /admin. Waiting a few seconds...');
    
    // Try to login if there is a form, just with dummy info to see if we get past
    const usernameInput = await page.$('input[name="email"], input[name="username"], input[type="email"], input[type="text"]');
    const passwordInput = await page.$('input[name="password"], input[type="password"]');
    
    if (usernameInput && passwordInput) {
      console.log('Found login form. Attempting dummy login...');
      await usernameInput.fill('admin@kartodromodebetim.com.br');
      await passwordInput.fill('admin123');
      
      const submitBtn = await page.$('button[type="submit"]');
      if (submitBtn) {
        await submitBtn.click();
        await page.waitForTimeout(5000); // wait for network calls after click
      }
    } else {
        await page.waitForTimeout(5000);
    }
    
  } catch (err) {
    console.error('Error during navigation:', err);
  } finally {
    await browser.close();
  }
})();
