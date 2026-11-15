import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium, type Browser, type Locator } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const ROOT = path.resolve(__dirname, '..');

function contentType(filePath: string): string {
  if (filePath.endsWith('.html')) return 'text/html; charset=utf-8';
  if (filePath.endsWith('.js')) return 'application/javascript; charset=utf-8';
  if (filePath.endsWith('.css')) return 'text/css; charset=utf-8';
  if (filePath.endsWith('.svg')) return 'image/svg+xml';
  if (filePath.endsWith('.png')) return 'image/png';
  if (filePath.endsWith('.webp')) return 'image/webp';
  return 'application/octet-stream';
}

async function waitVisible(loc: Locator, timeout = 5000) {
  try {
    await loc.waitFor({ state: 'visible', timeout });
  } catch (e) {
    const main = await loc.page().evaluate(() => document.querySelector('main')?.innerHTML || 'NO MAIN').catch(() => '');
    throw new Error(`${(e as Error).message}\nMAIN: ${main}`);
  }
}

describe('apps/reservas hardening E2E', () => {
  let tmpDist = '';
  let server: http.Server;
  let baseUrl = '';
  let browser: Browser;

  beforeAll(async () => {
    tmpDist = fs.mkdtempSync(path.join(os.tmpdir(), 'kib-reservas-test-'));
    execFileSync(
      'npx',
      ['vite', 'build', '--config', 'apps/reservas/vite.config.ts', '--outDir', tmpDist],
      { cwd: ROOT, stdio: 'pipe', env: { ...process.env, NODE_ENV: 'production' } },
    );

    server = http.createServer((req, res) => {
      const reqPath = (req.url || '/').split('?')[0];
      if (reqPath.startsWith('/booking-media/')) {
        res.writeHead(200, { 'content-type': 'image/png' });
        res.end(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64'));
        return;
      }
      const rel = reqPath === '/' ? 'index.html' : reqPath.replace(/^\/+/, '');
      const full = path.resolve(tmpDist, rel);
      if (full.startsWith(tmpDist) && fs.existsSync(full) && fs.statSync(full).isFile()) {
        res.writeHead(200, { 'content-type': contentType(full) });
        fs.createReadStream(full).pipe(res);
        return;
      }
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      fs.createReadStream(path.join(tmpDist, 'index.html')).pipe(res);
    });

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const addr = server.address();
    if (!addr || typeof addr === 'string') throw new Error('Falha ao iniciar servidor de teste');
    baseUrl = `http://127.0.0.1:${addr.port}`;
    browser = await chromium.launch();
  }, 60000);

  afterAll(async () => {
    await browser?.close();
    if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
    if (tmpDist && fs.existsSync(tmpDist)) fs.rmSync(tmpDist, { recursive: true, force: true });
  });

  const fixtureAgenda = () => {
    const future = new Date(Date.now() + 72 * 3_600_000);
    const yyyy = future.getUTCFullYear();
    const mm = String(future.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(future.getUTCDate()).padStart(2, '0');
    const dia = `${yyyy}-${mm}-${dd}`;
    return {
      atualizadoEm: new Date().toISOString(),
      precoCentavos: 11900,
      maxPilotos: 10,
      prazoMin: 15,
      antecedenciaMin: 120,
      pagamentoOnline: true,
      grupoSite: true,
      horarios: [
        { id: 101, inicio: `${dia}T19:00`, nome: 'BATERIA 19:00', livres: 6, precoCentavos: 11900, precoPrimeiraVezCentavos: 8990 },
      ],
    };
  };

  it('recupera rascunho corrompido, agenda 500, valida no blur/submit, protege duplo clique, modais e 429', async () => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await context.addInitScript(() => {
      sessionStorage.setItem('kib-rascunho', JSON.stringify({
        bateriaId: 'broken',
        quantidade: 999999,
        euPiloto: 'sim',
        forma: 'cripto',
        modo: 'outro',
        comprador: { nome: 123, email: null },
        acomp: 'nao-e-array',
      }));
    });
    const page = await context.newPage();
    const pageErrors: string[] = [];
    page.on('pageerror', (e) => pageErrors.push(e.message));
    await page.route(/^https:\/\/fonts\./, (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));

    let agendaShouldFail = true;
    let politicaShouldFail = true;
    let termoShouldFail = true;
    let reservaPostHits = 0;
    const pedidoId = '11111111-2222-4333-8444-555555555555';

    await page.route('**/api/**', async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === '/api/aviso') {
        await route.fulfill({ json: null });
        return;
      }
      if (url.pathname === '/api/agenda') {
        if (agendaShouldFail) {
          await route.fulfill({ status: 500, json: { erro: 'Falha simulada na agenda' } });
          return;
        }
        await route.fulfill({ json: fixtureAgenda() });
        return;
      }
      if (url.pathname === '/api/reservas/politica') {
        if (politicaShouldFail) {
          await route.fulfill({ status: 503, json: { erro: 'Erro temporário política' } });
          return;
        }
        await route.fulfill({
          json: {
            versao: '2026',
            titulo: 'Política de Cancelamento',
            aceite: 'Li e aceito a Política de Cancelamento.',
            secoes: [{ titulo: 'Regras', paragrafos: ['Cancelamento com 48h tem reembolso de 90%.'] }],
          },
        });
        return;
      }
      if (url.pathname === '/api/termo') {
        if (termoShouldFail) {
          await route.fulfill({ status: 500, json: { erro: 'Erro termo' } });
          return;
        }
        await route.fulfill({
          json: {
            versao: '2026',
            titulo: 'Termo de Responsabilidade',
            empresa: 'Kartódromo Betim',
            paragrafos: [{ titulo: 'Cláusula 1', texto: 'Pilotar com equipamento fechado.' }],
          },
        });
        return;
      }
      if (url.pathname === '/api/reservas' && route.request().method() === 'POST') {
        reservaPostHits += 1;
        if (reservaPostHits === 1) {
          await route.fulfill({ status: 429, body: '' });
          return;
        }
        await new Promise((r) => setTimeout(r, 150));
        await route.fulfill({ json: { id: pedidoId, codigo: 'KRT123' } });
        return;
      }
      if (url.pathname === `/api/reservas/${pedidoId}`) {
        await route.fulfill({
          json: {
            id: pedidoId,
            codigo: 'KRT123',
            status: 'aguardando_pagamento',
            forma: 'pix',
            quantidade: 1,
            nome: 'João Kart',
            descricao: 'Bateria 19:00',
            inicio: fixtureAgenda().horarios[0].inicio,
            valorCentavos: 11900,
            expiraEm: new Date(Date.now() + 600_000).toISOString(),
            pix: { payload: '000201010212', imagem: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==' },
            invoiceUrl: null,
            preparandoPagamento: false,
            erro: null,
          },
        });
        return;
      }
      await route.fulfill({ status: 404, json: { erro: 'Não encontrado' } });
    });

    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    await waitVisible(page.getByText('Não foi possível carregar a agenda'));
    agendaShouldFail = false;
    await page.getByRole('button', { name: 'Tentar de novo' }).click();
    await waitVisible(page.getByRole('button', { name: /19:00/ }));

    // Filtro vazio + botão reset
    await page.getByRole('radio', { name: 'Antes das 18h' }).click();
    await waitVisible(page.getByRole('button', { name: 'Ver todos os horários' }));
    await page.getByRole('button', { name: 'Ver todos os horários' }).click();
    await page.getByRole('button', { name: /19:00/ }).click();

    // Etapa 2 -> confirma clamping (999999 -> 6 vagas livres) e reduz para 1 piloto
    await waitVisible(page.getByRole('heading', { name: 'Quem vai para a pista?' }));
    expect(await page.locator('.qtd output').textContent()).toBe('6');
    for (let i = 0; i < 5; i++) await page.getByRole('button', { name: 'Menos um piloto' }).click();
    expect(await page.locator('.qtd output').textContent()).toBe('1');
    await page.getByRole('button', { name: 'Ir para o cadastro' }).click();
    await waitVisible(page.getByRole('heading', { name: 'Dados de quem reserva e dos pilotos.' }));

    // Não mostra erro antes de sair do campo (blur)
    const nomeInput = page.locator('#c-nome');
    await nomeInput.fill('Ana');
    expect(await page.locator('#c-nome-e').count()).toBe(0);

    // Ao sair (blur) exibe erro e no submit foca no primeiro inválido
    await nomeInput.blur();
    await waitVisible(page.locator('#c-nome-e'));
    expect(await page.locator('#c-nome-e').textContent()).toBe('Digite nome e sobrenome.');
    await page.getByRole('button', { name: 'Ir para o pagamento' }).click();
    await page.waitForFunction(() => document.activeElement?.id === 'c-nome', undefined, { timeout: 2000 });

    // +55 telefone e data ISO YYYY-MM-DD (autofill) + nome longo multilíngue/emoji
    await nomeInput.fill('João 🚀 ' + 'Piloto '.repeat(18) + '田中');
    const nomeVal = await nomeInput.inputValue();
    expect(nomeVal.startsWith('João 🚀 ')).toBe(true);
    expect(nomeVal.length).toBeLessThanOrEqual(120);

    await page.locator('#c-documento').fill('52998224725');
    await page.locator('#c-nascimento').fill('1990-05-20');
    expect(await page.locator('#c-nascimento').inputValue()).toBe('20/05/1990');
    await page.locator('#c-telefone').fill('+55 31 99888-7766');
    expect(await page.locator('#c-telefone').inputValue()).toBe('(31) 99888-7766');
    await page.locator('#c-email').fill('joao@kartodromoteste.com');
    await page.locator('#c-instagram').fill('@joao.kart');
    await page.locator('#c-peso').fill('72.5');
    await page.getByRole('button', { name: 'Ir para o pagamento' }).click();

    await waitVisible(page.getByRole('heading', { name: 'Confira e finalize.' }));

    // Modal política falha e recupera via Tentar novamente, fecha no Escape
    await page.getByRole('button', { name: 'Ler a política' }).click();
    await waitVisible(page.getByText('Não foi possível carregar a política agora.'));
    politicaShouldFail = false;
    await page.getByRole('button', { name: 'Tentar novamente' }).click();
    await waitVisible(page.getByText('Cancelamento com 48h tem reembolso de 90%.'));
    await page.keyboard.press('Escape');
    await page.locator('dialog.modal').waitFor({ state: 'detached', timeout: 2000 });

    // Modal termo falha e recupera via Tentar novamente
    await page.getByRole('button', { name: 'Ver modelo do termo' }).click();
    await waitVisible(page.getByRole('button', { name: 'Tentar novamente' }));
    termoShouldFail = false;
    await page.getByRole('button', { name: 'Tentar novamente' }).click();
    await waitVisible(page.getByText('Pilotar com equipamento fechado.'));
    await page.getByRole('button', { name: 'Fechar termo' }).click();
    await page.locator('dialog.modal').waitFor({ state: 'detached', timeout: 2000 });

    // Aceita política e testa 429 rate-limit + bloqueio de duplo clique
    await page.getByRole('checkbox').check();
    const payBtn = page.locator('.acoes .btn.grande');
    await payBtn.click();
    await waitVisible(page.getByText('Muitas tentativas em sequência. Aguarde alguns segundos e tente novamente.'), 12000);

    // Disparo duplo rápido antes do próximo frame deve enviar apenas 1 POST adicional (total = 2)
    await payBtn.evaluate((b: HTMLButtonElement) => {
      b.click();
      b.click();
    });
    await waitVisible(page.getByRole('heading', { name: 'Pague com Pix' }), 10000);
    expect(reservaPostHits).toBe(2);
    expect(pageErrors).toEqual([]);

    await context.close();
  }, 35000);

  it('mobile 360px: recuperação de pedido 503, banner offline, fontes >=16px e zero overflow horizontal', async () => {
    const context = await browser.newContext({ viewport: { width: 360, height: 800 } });
    const page = await context.newPage();
    const pageErrors: string[] = [];
    page.on('pageerror', (e) => pageErrors.push(e.message));
    await page.route(/^https:\/\/fonts\./, (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));

    const pedidoId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
    let pedidoShouldFail = true;
    await page.route('**/api/**', async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === '/api/aviso') {
        await route.fulfill({ json: { texto: 'AVISOLONGOSUPEREXTREMO'.repeat(6), tom: 'info' } });
        return;
      }
      if (url.pathname === `/api/reservas/${pedidoId}`) {
        if (pedidoShouldFail) {
          await route.fulfill({ status: 503, body: '' });
          return;
        }
        await route.fulfill({
          json: {
            id: pedidoId,
            codigo: 'K99887',
            status: 'aguardando_pagamento',
            forma: 'pix',
            quantidade: 1,
            nome: 'NomeExtremamenteLongoSemEspacosParaTestarQuebraNoMobile1234567890',
            descricao: 'Bateria 19:00',
            inicio: fixtureAgenda().horarios[0].inicio,
            valorCentavos: 11900,
            expiraEm: new Date(Date.now() + 600_000).toISOString(),
            pix: { payload: '000201010212' + 'X'.repeat(180), imagem: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==' },
            invoiceUrl: null,
            preparandoPagamento: false,
            erro: null,
          },
        });
        return;
      }
      await route.fulfill({ status: 404, json: {} });
    });

    await page.goto(`${baseUrl}/#p=${pedidoId}`, { waitUntil: 'domcontentloaded' });
    await waitVisible(page.getByText('Não foi possível carregar sua reserva'));
    pedidoShouldFail = false;
    await page.getByRole('button', { name: 'Tentar novamente' }).click();
    await waitVisible(page.getByRole('heading', { name: 'Pague com Pix' }));

    const metrics = await page.evaluate(() => {
      const ta = document.querySelector('textarea') as HTMLTextAreaElement | null;
      return {
        scrollW: document.documentElement.scrollWidth,
        innerW: window.innerWidth,
        textareaFont: ta ? parseFloat(getComputedStyle(ta).fontSize) : 0,
      };
    });
    expect(metrics.scrollW).toBeLessThanOrEqual(metrics.innerW);
    expect(metrics.textareaFont).toBeGreaterThanOrEqual(16);

    await context.setOffline(true);
    await waitVisible(page.getByText('Você está sem internet. Reconecte-se para atualizar horários e concluir o pagamento.'));
    await context.setOffline(false);

    expect(pageErrors).toEqual([]);
    await context.close();
  }, 20000);
});
