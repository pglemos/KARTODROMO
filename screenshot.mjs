import { chromium } from 'playwright';
import fs from 'fs';

const urls = [
  { name: 'homepage', url: 'http://localhost:3000/' },
  { name: 'admin_dashboard', url: 'http://localhost:3000/admin' },
  { name: 'admin_login', url: 'http://localhost:3000/admin/login' },
  { name: 'admin_reservas', url: 'http://localhost:3000/admin/reservas' },
  { name: 'admin_recepcao', url: 'http://localhost:3000/admin/recepcao' },
  { name: 'admin_lanchonete', url: 'http://localhost:3000/admin/lanchonete' },
  { name: 'admin_cronometragem', url: 'http://localhost:3000/admin/cronometragem' },
  { name: 'admin_campeonatos', url: 'http://localhost:3000/admin/campeonatos' },
  { name: 'admin_resultados', url: 'http://localhost:3000/admin/resultados' },
  { name: 'admin_financeira', url: 'http://localhost:3000/admin/financeira' },
  { name: 'admin_clientes', url: 'http://localhost:3000/admin/clientes' },
  { name: 'admin_administrativa', url: 'http://localhost:3000/admin/administrativa' },
  { name: 'admin_clube', url: 'http://localhost:3000/admin/clube' },
  { name: 'admin_telao', url: 'http://localhost:3000/admin/telao' }
];

async function run() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  for (const item of urls) {
    try {
      console.log(`Navigating to ${item.url}...`);
      await page.goto(item.url, { waitUntil: 'load', timeout: 15000 });
      await page.waitForTimeout(2000); // Wait for spinners to show data or error
      await page.screenshot({ path: `C:\\KARTODROMO\\screenshots\\${item.name}.png` });
      console.log(`Screenshot saved: ${item.name}.png`);
    } catch (e) {
      console.error(`Failed on ${item.url}: ${e.message}`);
      try {
        await page.screenshot({ path: `C:\\KARTODROMO\\screenshots\\${item.name}_error.png` });
      } catch (err) {}
    }
  }
  
  await browser.close();
}

fs.mkdirSync('C:\\KARTODROMO\\screenshots', { recursive: true });
run().catch(console.error);
