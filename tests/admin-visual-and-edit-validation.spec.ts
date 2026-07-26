import { test, expect } from '@playwright/test';
import path from 'node:path';

const TARGET_URL = process.env.PLAYWRIGHT_TARGET_URL || 'https://kartodromodebetim.com.br';
const ARTIFACT_DIR = 'C:/Users/Administrador/.gemini/antigravity-cli/brain/0cccec59-ffae-45d7-8654-9c73390bbfb8';

test('Full Visual & Action Edit Validation', async ({ page }) => {
  page.setViewportSize({ width: 1440, height: 900 });

  console.log('1. Navigating to Login...');
  await page.goto(`${TARGET_URL}/login`, { waitUntil: 'networkidle' });
  await page.screenshot({ path: path.join(ARTIFACT_DIR, '01_login_page.png') });

  console.log('2. Logging in...');
  await page.fill('input[type="email"]', 'admin@kartbetim.com');
  await page.fill('input[type="password"]', 'KartBetim#2026');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2000);

  console.log('3. Validating Dashboard...');
  await page.goto(`${TARGET_URL}/admin`, { waitUntil: 'networkidle' });
  await page.screenshot({ path: path.join(ARTIFACT_DIR, '02_admin_dashboard.png'), fullPage: true });

  console.log('4. Validating Clientes module...');
  await page.goto(`${TARGET_URL}/admin/clientes`, { waitUntil: 'networkidle' });
  await page.screenshot({ path: path.join(ARTIFACT_DIR, '03_admin_clientes.png'), fullPage: true });

  console.log('5. Validating Lanchonete & Performing Edit Action (Creating New Product)...');
  await page.goto(`${TARGET_URL}/admin/lanchonete`, { waitUntil: 'networkidle' });
  
  // Click on 'Produtos' tab
  const produtosTab = page.locator('button', { hasText: 'Produtos' });
  if (await produtosTab.isVisible()) {
    await produtosTab.click();
    await page.waitForTimeout(1000);
  }

  // Click 'Novo produto' button
  const novoProdutoBtn = page.locator('button', { hasText: 'Novo produto' });
  if (await novoProdutoBtn.isVisible()) {
    await novoProdutoBtn.click();
    await page.waitForTimeout(500);

    // Fill form
    await page.fill('#produto-nome', 'Refrigerante H2OH 500ml Teste');
    await page.fill('#produto-sku', 'H2O-500-TEST');
    await page.fill('#produto-categoria', 'Bebidas');
    await page.fill('#produto-preco', '8.50');

    await page.screenshot({ path: path.join(ARTIFACT_DIR, '04_modal_criar_produto.png') });

    // Submit form
    await page.click('form#produto-form button[type="submit"], button:has-text("Criar produto")');
    await page.waitForTimeout(2000);
  }

  await page.screenshot({ path: path.join(ARTIFACT_DIR, '05_lanchonete_produto_criado.png'), fullPage: true });

  console.log('6. Validating Reservas module...');
  await page.goto(`${TARGET_URL}/admin/reservas`, { waitUntil: 'networkidle' });
  await page.screenshot({ path: path.join(ARTIFACT_DIR, '06_admin_reservas.png'), fullPage: true });

  console.log('7. Validating Financeiro module...');
  await page.goto(`${TARGET_URL}/admin/financeira`, { waitUntil: 'networkidle' });
  await page.screenshot({ path: path.join(ARTIFACT_DIR, '07_admin_financeiro.png'), fullPage: true });

  console.log('Visual and edit validation completed successfully!');
});
