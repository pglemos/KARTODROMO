const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const OUT_DIR = 'C:\\Users\\Administrador\\.gemini\\antigravity-cli\\brain\\a6df96a6-261d-4028-a858-74c9da4c8ef9';
if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.setDefaultTimeout(30000);

  console.log('Logging in...');
  await page.goto('http://localhost:3000/admin/login');
  
  try {
    await page.fill('input[type="email"], input[name="email"], [placeholder*="email" i]', 'admin@kartbetim.com');
    await page.fill('input[type="password"], input[name="password"], [placeholder*="senha" i], [placeholder*="password" i]', 'KartBetim#2026');
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle' }).catch(() => {}),
      page.click('button[type="submit"], button:has-text("Entrar"), button:has-text("Login")')
    ]);
  } catch (e) {
    console.log('Login form error or already logged in:', e.message);
  }

  console.log('Logged in. Navigating to pages...');
  
  const pages = [
    { url: 'http://localhost:3000/admin', name: 'dashboard' },
    { url: 'http://localhost:3000/admin/reservas', name: 'reservas' },
    { url: 'http://localhost:3000/admin/recepcao', name: 'recepcao' },
    { url: 'http://localhost:3000/admin/lanchonete', name: 'lanchonete' },
    { url: 'http://localhost:3000/admin/cronometragem', name: 'cronometragem' },
    { url: 'http://localhost:3000/admin/campeonatos', name: 'campeonatos' },
    { url: 'http://localhost:3000/admin/resultados', name: 'resultados' },
    { url: 'http://localhost:3000/admin/financeira', name: 'financeira' },
    { url: 'http://localhost:3000/admin/clientes', name: 'clientes' },
    { url: 'http://localhost:3000/admin/administrativa', name: 'administrativa' },
    { url: 'http://localhost:3000/admin/clube', name: 'clube' },
    { url: 'http://localhost:3000/admin/telao', name: 'telao' },
    { url: 'http://localhost:3000', name: 'homepage' }
  ];

  for (const p of pages) {
    console.log(`Navigating to ${p.name} (${p.url})...`);
    await page.goto(p.url, { waitUntil: 'networkidle' }).catch(e => console.log('Goto error:', e.message));
    
    await page.waitForTimeout(2000); // Wait for data tables/UI
    
    const outPath = path.join(OUT_DIR, `audit_final_${p.name}.png`);
    await page.screenshot({ path: outPath, fullPage: true });
    console.log(`Saved screenshot for ${p.name} at ${outPath}`);
  }

  await browser.close();
  console.log('Done.');
})();
