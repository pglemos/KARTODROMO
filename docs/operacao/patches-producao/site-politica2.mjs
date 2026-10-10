import { chromium } from 'file:///C:/repos/KARTODROMO/node_modules/playwright/index.mjs';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
await p.goto('http://localhost:3131/reservas', { waitUntil: 'networkidle', timeout: 120000 });
const el = p.locator('#politica-cancelamento'); await el.scrollIntoViewIfNeeded(); await p.waitForTimeout(1500);
const t = await el.innerText(); console.log(t.slice(-220));
await el.screenshot({ path: process.argv[2] + '/site-politica-1440b.png' });
await b.close();
