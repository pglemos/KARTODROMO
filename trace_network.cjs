const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const results = [];
  page.on('response', response => {
    const url = response.url();
    if (url.includes('/api/admin/') || url.includes('favicon.ico') || url.includes('.mp4') || url.includes('{{')) {
      results.push(`URL: ${url} -> Status: ${response.status()}`);
    }
  });

  console.log('Navigating to https://kartodromodebetim.com.br ...');
  await page.goto('https://kartodromodebetim.com.br', { waitUntil: 'networkidle' });

  // Let's also go to the admin page to see if there's any API calls there.
  console.log('Navigating to https://kartodromodebetim.com.br/admin ...');
  try {
    await page.goto('https://kartodromodebetim.com.br/admin', { waitUntil: 'networkidle' });
  } catch(e) {}

  // Wait a bit to ensure all background fetches complete
  await page.waitForTimeout(3000);

  console.log('--- Network Results ---');
  results.forEach(r => console.log(r));

  await browser.close();
})();
