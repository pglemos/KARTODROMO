import { test, expect, type Page } from '@playwright/test';

const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? 'https://aovivo.kartodromodebetim.com.br';

test.describe.configure({ timeout: 90_000 });

async function openLivePage(page: Page) {
  await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveTitle('Cronometragem · TV');
}

async function waitForRanking(page: Page) {
  await page.waitForSelector('.linha', { state: 'visible', timeout: 60_000 });
}

async function installStateFixture(page: Page, state: unknown, options: { blockStatePolling?: boolean } = {}) {
  await page.addInitScript(({ payload, blockStatePolling }) => {
    if (blockStatePolling) {
      const originalFetch = window.fetch.bind(window);
      window.fetch = (input, init) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
        if (url.includes('/api/state')) return Promise.reject(new Error('state polling disabled for fixture'));
        return originalFetch(input, init);
      };
    }
    class FixtureEventSource extends EventTarget {
      readyState = 1;
      constructor() {
        super();
        (window as unknown as { __fixtureEventSource?: FixtureEventSource }).__fixtureEventSource = this;
        setTimeout(() => this.dispatchEvent(new MessageEvent('state', { data: JSON.stringify(payload) })), 25);
      }
      close() { this.readyState = 2; }
    }
    // The live page only relies on addEventListener, close and readyState for the SSE surface.
    (window as unknown as { EventSource: typeof EventSource }).EventSource = FixtureEventSource as unknown as typeof EventSource;
  }, { payload: state, blockStatePolling: options.blockStatePolling ?? false });
}

test('public live page exposes connection freshness state', async ({ page }) => {
  await openLivePage(page);
  await expect(page.locator('#conexao')).toBeVisible();
  await expect(page.locator('#conexao')).toContainText(/ao vivo|atualizado|reconectando|desatualizado/i);
});

test('desktop keeps the mouse pointer visible over the live page', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openLivePage(page);
  await waitForRanking(page);
  const cursors = await page.evaluate(() => ({
    body: getComputedStyle(document.body).cursor,
    row: getComputedStyle(document.querySelector('.linha')).cursor,
  }));
  expect(cursors.body).not.toBe('none');
  expect(cursors.row).toBe('pointer');
});

test('pilot detail owns keyboard focus while open', async ({ page }) => {
  await openLivePage(page);
  await waitForRanking(page);
  const row = page.locator('.linha').first();
  await row.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#detalhe')).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.activeElement?.id)).toBe('detalheFechar');
  await page.keyboard.press('Tab');
  await expect.poll(() => page.evaluate(() => document.activeElement?.closest('#detalhe') != null)).toBeTruthy();
});

test('mobile public live page does not clip horizontally', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openLivePage(page);
  await page.evaluate(() => {
    const fim = document.querySelector<HTMLElement>('#fim');
    const podio = document.querySelector<HTMLElement>('#podio');
    if (!fim || !podio) throw new Error('podium surface is missing');
    fim.hidden = false;
    podio.hidden = false;
    podio.innerHTML = '<div class="faixa"><span>PÓDIO</span></div><div class="evento">Bateria 21:05 · Corrida</div><div class="degraus"><div class="degrau d2"><div class="quem num"><b>120</b><div>IGOR DA SILVA RIBEIRO</div><small>+1 volta</small></div><div class="bloco">2</div></div><div class="degrau d1"><div class="quem num"><b>121</b><div>CLAUDIA VALADARES MACHADO</div><small>55.609</small></div><div class="bloco">1</div></div><div class="degrau d3"><div class="quem num"><b>122</b><div>FERNANDO HENRIQUE OLIVEIRA</div><small>+2 voltas</small></div><div class="bloco">3</div></div></div>';
  });
  await expect.poll(() => page.evaluate(() => document.body.scrollWidth <= window.innerWidth + 2), { timeout: 60_000 }).toBeTruthy();
});

test('mobile ranking keeps scrolling manual and exposes the full list', async ({ page, request }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const response = await request.get(`${baseUrl}/api/state`);
  expect(response.ok()).toBeTruthy();
  const state = await response.json();
  const fixture = structuredClone(state);
  const session = fixture.focus;
  session.type = 'corrida';
  session.state = 'em_andamento';
  session.currentFlag = 'green';
  session.startedAt = fixture.now - 90_000;
  session.greenAt = fixture.now - 90_000;
  session.elapsedMs = 90_000;
  session.remainingMs = 510_000;
  session.competitors = Array.from({ length: 18 }, (_, index) => ({
    kart: String(index + 1),
    name: `Piloto ${index + 1}`,
    flag: 'none',
    crossings: [],
    finished: false,
  }));
  session.standings = session.competitors.map((competitor, index) => ({
    position: index + 1,
    kart: competitor.kart,
    name: competitor.name,
    laps: 12 - Math.floor(index / 6),
    lastLapMs: 56_000 + index * 100,
    bestLapMs: 55_123 + index * 100,
    bestLapNumber: 8,
    totalMs: 720_000 + index * 1_500,
    gapMs: index ? index * 1_500 : null,
    gapLaps: 0,
    finished: false,
    autoAdded: false,
    lastCrossingWallMs: fixture.now - index * 1_000,
    penaltyMs: 0,
    advertencias: 0,
    desclassificado: false,
    racingStatus: 0,
  }));
  fixture.runningId = session.id;
  fixture.lastFinished = null;
  await installStateFixture(page, fixture, { blockStatePolling: true });
  await openLivePage(page);
  await expect(page.locator('.linha')).toHaveCount(18);

  const lista = page.locator('#lista');
  await expect(page.locator('#legendaToggle')).toBeVisible();
  await expect(page.locator('#legendaResumo')).toContainText('Dif. líder');
  await expect(lista).toHaveAttribute('aria-label', 'Lista de classificação');
  const firstRow = page.locator('.linha').first();
  const rowGeometry = await firstRow.evaluate((el) => ({
    height: el.getBoundingClientRect().height,
    metaFontSize: parseFloat(getComputedStyle(el.querySelector('.linha-metas')!).fontSize),
    metaText: el.querySelector('.linha-metas')?.textContent || '',
  }));
  expect(rowGeometry.height).toBeGreaterThanOrEqual(58);
  expect(rowGeometry.metaFontSize).toBeGreaterThanOrEqual(11);
  expect(rowGeometry.metaText).toContain('Melhor');
  expect(rowGeometry.metaText).toContain('Total');
  expect(rowGeometry.metaText).toContain('Dif. líder');
  await expect(firstRow).toHaveAttribute('aria-label', /melhor volta.*tempo total.*diferença do líder/i);
  const legendaGeometry = await page.evaluate(() => {
    const lista = document.querySelector<HTMLElement>('#lista')?.getBoundingClientRect();
    const legenda = document.querySelector<HTMLElement>('#legenda')?.getBoundingClientRect();
    if (!lista || !legenda) throw new Error('mobile ranking geometry is missing');
    return { listBottom: lista.bottom, legendTop: legenda.top };
  });
  expect(legendaGeometry.listBottom).toBeLessThanOrEqual(legendaGeometry.legendTop + 1);
  const antes = await lista.evaluate((el) => ({
    scrollTop: el.scrollTop,
    overflowY: getComputedStyle(el).overflowY,
    transform: getComputedStyle(document.querySelector('#rolo')!).transform,
  }));
  await page.waitForTimeout(7_000);
  const depois = await lista.evaluate((el) => ({
    scrollTop: el.scrollTop,
    overflowY: getComputedStyle(el).overflowY,
    transform: getComputedStyle(document.querySelector('#rolo')!).transform,
  }));
  expect(antes.overflowY).toBe('auto');
  expect(antes.transform).toBe('none');
  expect(depois.scrollTop).toBe(0);
  expect(depois.transform).toBe('none');
  await expect(page.locator('#rolagem')).toBeVisible();
  await expect(page.locator('#rolagemTexto')).toContainText('deslize');

  await lista.evaluate((el) => { el.scrollTop = el.scrollHeight; el.dispatchEvent(new Event('scroll')); });
  await expect.poll(() => lista.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
  await expect.poll(() => page.locator('#rolagemBarra').evaluate((el) => parseFloat(getComputedStyle(el).width))).toBeGreaterThan(0);

  const beforeOrder = await firstRow.evaluate((el) => getComputedStyle(el).transform);
  const nextFixture = structuredClone(fixture);
  nextFixture.focus.standings = nextFixture.focus.standings.map((row, index, rows) => ({
    ...row,
    position: rows.length - index,
  }));
  await page.evaluate((next) => {
    const eventSource = (window as unknown as { __fixtureEventSource?: EventTarget }).__fixtureEventSource;
    eventSource?.dispatchEvent(new MessageEvent('state', { data: JSON.stringify(next) }));
  }, nextFixture);
  await expect(page.locator('#atualizacoes')).toBeVisible();
  await expect.poll(() => firstRow.evaluate((el) => getComputedStyle(el).transform)).toBe(beforeOrder);
  await page.locator('#atualizacoes').click();
  await expect.poll(() => lista.evaluate((el) => el.scrollTop)).toBe(0);
  await expect(page.locator('#atualizacoes')).toBeHidden();
});

test('continuous race clock freezes at the last fresh value when the stream goes stale', async ({ page, request }) => {
  const response = await request.get(`${baseUrl}/api/state`);
  expect(response.ok()).toBeTruthy();
  expect(response.status()).toBe(200);
  const state = await response.json();
  const fixture = structuredClone(state);
  fixture.runningId = fixture.focus.id;
  fixture.focus.state = 'em_andamento';
  fixture.focus.currentFlag = 'green';
  fixture.focus.startedAt = fixture.now - 20_000;
  fixture.focus.greenAt = fixture.now - 20_000;
  fixture.focus.elapsedMs = 20_000;
  fixture.focus.remainingMs = 60_000;
  fixture.focus.tempoEsgotado = false;
  fixture.lastFinished = null;
  await installStateFixture(page, fixture, { blockStatePolling: true });
  await openLivePage(page);
  await expect(page.locator('#relogio .num')).toBeVisible();
  const before = await page.locator('#relogio .num').textContent();
  await page.waitForTimeout(1_400);
  const after = await page.locator('#relogio .num').textContent();
  expect(after).not.toBe(before);
  await page.waitForTimeout(4_400);
  const stale = await page.locator('#relogio .num').textContent();
  await expect(page.locator('#conexao')).toContainText('desatualizados', { timeout: 2_000 });
  expect(stale).not.toBe('01:00');
  await page.waitForTimeout(1_200);
  expect(await page.locator('#relogio .num').textContent()).toBe(stale);
});

test('finished race keeps classification reachable during podium sequence', async ({ page, request }) => {
  const response = await request.get(`${baseUrl}/api/state`);
  expect(response.ok()).toBeTruthy();
  expect(response.status()).toBe(200);
  const state = await response.json();
  const fixture = structuredClone(state);
  const finished = structuredClone(fixture.lastFinished ?? fixture.focus);
  finished.id = finished.id || 'fixture-finished-race';
  finished.name = finished.name || 'Corrida de validação';
  finished.type = 'corrida';
  finished.state = 'encerrada';
  finished.finishedAt = fixture.now - 1_000;
  finished.standings = [
    { position: 1, kart: '7', name: 'Ana Souza', laps: 12, bestLapMs: 55_123, totalMs: 720_000, gapMs: null, gapLaps: 0, desclassificado: false },
    { position: 2, kart: '9', name: 'Bia Lima', laps: 12, bestLapMs: 56_000, totalMs: 721_500, gapMs: 1_500, gapLaps: 0, desclassificado: false },
    { position: 3, kart: '11', name: 'Caio Melo', laps: 11, bestLapMs: 57_000, totalMs: 721_500, gapMs: null, gapLaps: 1, desclassificado: false },
  ];
  fixture.runningId = null;
  fixture.lastFinished = finished;
  fixture.focus = finished;
  fixture.now = finished.finishedAt + 1_000;
  await installStateFixture(page, fixture);
  await openLivePage(page);
  await expect(page.locator('#verClassificacao')).toBeVisible();
  await expect(page.locator('#verClassificacao')).toHaveText('Fixar classificação');
  await page.locator('#verClassificacao').click();
  await expect(page.locator('#quadro')).toBeVisible();
  await expect(page.locator('#verClassificacao')).toHaveText('Retomar apresentação');
  const gap = await page.evaluate(() => {
    const controle = document.querySelector<HTMLElement>('#verClassificacao')?.getBoundingClientRect();
    const titulos = document.querySelector<HTMLElement>('#titulos')?.getBoundingClientRect();
    if (!controle || !titulos) throw new Error('classification geometry is missing');
    return titulos.top - controle.bottom;
  });
  expect(gap).toBeGreaterThanOrEqual(0);
});

test('ranking table exposes race timing columns and the reading guide', async ({ page, request }) => {
  const response = await request.get(`${baseUrl}/api/state`);
  expect(response.ok()).toBeTruthy();
  const state = await response.json();
  const fixture = structuredClone(state);
  const session = fixture.focus;
  session.type = 'corrida';
  session.state = 'em_andamento';
  session.currentFlag = 'green';
  session.startedAt = fixture.now - 90_000;
  session.greenAt = fixture.now - 90_000;
  session.elapsedMs = 90_000;
  session.remainingMs = 510_000;
  session.competitors = [
    { kart: '7', name: 'Ana Souza', flag: 'none', crossings: [], finished: false },
    { kart: '9', name: 'Bia Lima', flag: 'none', crossings: [], finished: false },
  ];
  session.standings = [
    { position: 1, kart: '7', name: 'Ana Souza', laps: 12, lastLapMs: 56_000, bestLapMs: 55_123, bestLapNumber: 8, totalMs: 720_000, gapMs: null, gapLaps: 0, finished: false, autoAdded: false, lastCrossingWallMs: fixture.now - 2_000, penaltyMs: 0, advertencias: 0, desclassificado: false, racingStatus: 0 },
    { position: 2, kart: '9', name: 'Bia Lima', laps: 12, lastLapMs: 57_000, bestLapMs: 56_000, bestLapNumber: 7, totalMs: 721_500, gapMs: 1_500, gapLaps: 0, finished: false, autoAdded: false, lastCrossingWallMs: fixture.now - 1_000, penaltyMs: 0, advertencias: 0, desclassificado: false, racingStatus: 0 },
  ];
  fixture.runningId = session.id;
  fixture.lastFinished = null;
  await installStateFixture(page, fixture, { blockStatePolling: true });
  await openLivePage(page);

  await expect(page.locator('#titulos')).toContainText('Voltas');
  await expect(page.locator('#titulos')).toContainText('Melhor volta');
  await expect(page.locator('#titulos')).toContainText('Tempo total');
  await expect(page.locator('#titulos')).toContainText('Diferença do líder');
  await expect(page.locator('#legenda')).toContainText('COMO LER');
  await expect(page.locator('#legenda')).toContainText('voltas válidas concluídas');

  const firstRow = page.locator('.linha').first();
  await expect(firstRow.locator(':scope > span').nth(3)).toHaveText('12');
  await expect(firstRow.locator(':scope > span').nth(4)).toHaveText('55.123');
  await expect(firstRow.locator(':scope > span').nth(5)).toHaveText('12:00.000');
  await expect(page.locator('.linha').nth(1).locator(':scope > span').nth(6)).toHaveText('+1.500');
});
