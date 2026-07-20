import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const baseURL = process.env.PREMIUM_PREVIEW_URL;
const outputDir = join(process.cwd(), 'test-results', 'premium-reference-comparison');

const pages = [
  { name: 'home', route: '/', reference: '/design/home.dc.html' },
  { name: 'pista', route: '/pista', reference: '/design/pista.dc.html' },
  { name: 'kart-locacao', route: '/kart-locacao', reference: '/design/kart-locacao.dc.html' },
  { name: 'campeonatos', route: '/campeonatos', reference: '/design/campeonatos.dc.html' },
  { name: 'eventos', route: '/eventos', reference: '/design/eventos.dc.html' },
  { name: 'duvidas', route: '/duvidas', reference: '/design/duvidas.dc.html' },
  { name: 'kac', route: '/kac', reference: '/design/kac.dc.html' },
  { name: 'kac-super', route: '/kac-super', reference: '/design/kac-super.dc.html' },
  { name: '200-milhas', route: '/200-milhas', reference: '/design/200-milhas.dc.html' },
  { name: '500-milhas', route: '/500-milhas', reference: '/design/500-milhas.dc.html' },
] as const;

const viewports = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'tablet', width: 820, height: 1180 },
  { name: 'desktop', width: 1440, height: 900 },
] as const;

const deterministicCss = `
  html { scroll-behavior: auto !important; }
  *, *::before, *::after {
    animation: none !important;
    transition: none !important;
    caret-color: transparent !important;
  }
  a[href="#conteudo"] {
    opacity: 0 !important;
    pointer-events: none !important;
  }
`;

type PixelComparison = {
  width: number;
  height: number;
  averageChannelDifference: number;
  significantPixelRatio: number;
  maximumChannelDifference: number;
};

function isTransientTemplateRequest(url: string) {
  try {
    const decodedURL = decodeURIComponent(url);
    return decodedURL.includes('{{') && decodedURL.includes('}}');
  } catch {
    return false;
  }
}

async function comparePngBuffers(
  page: Page,
  cleanScreenshot: Buffer,
  referenceScreenshot: Buffer,
): Promise<PixelComparison> {
  return page.evaluate(
    async ({ cleanBase64, referenceBase64 }) => {
      const decode = async (base64: string) => {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let index = 0; index < binary.length; index += 1) {
          bytes[index] = binary.charCodeAt(index);
        }
        return createImageBitmap(new Blob([bytes], { type: 'image/png' }));
      };

      const [cleanImage, referenceImage] = await Promise.all([
        decode(cleanBase64),
        decode(referenceBase64),
      ]);

      if (
        cleanImage.width !== referenceImage.width ||
        cleanImage.height !== referenceImage.height
      ) {
        return {
          width: cleanImage.width,
          height: cleanImage.height,
          averageChannelDifference: Number.POSITIVE_INFINITY,
          significantPixelRatio: 1,
          maximumChannelDifference: 255,
        };
      }

      const canvas = new OffscreenCanvas(cleanImage.width, cleanImage.height);
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) throw new Error('Canvas 2D indisponível para comparação visual');

      context.drawImage(cleanImage, 0, 0);
      const cleanPixels = context.getImageData(0, 0, cleanImage.width, cleanImage.height).data;
      context.clearRect(0, 0, cleanImage.width, cleanImage.height);
      context.drawImage(referenceImage, 0, 0);
      const referencePixels = context.getImageData(
        0,
        0,
        referenceImage.width,
        referenceImage.height,
      ).data;

      let absoluteDifference = 0;
      let significantPixels = 0;
      let maximumChannelDifference = 0;
      const pixelCount = cleanImage.width * cleanImage.height;

      for (let index = 0; index < cleanPixels.length; index += 4) {
        let pixelMaximum = 0;
        for (let channel = 0; channel < 3; channel += 1) {
          const difference = Math.abs(cleanPixels[index + channel] - referencePixels[index + channel]);
          absoluteDifference += difference;
          pixelMaximum = Math.max(pixelMaximum, difference);
          maximumChannelDifference = Math.max(maximumChannelDifference, difference);
        }
        if (pixelMaximum > 10) significantPixels += 1;
      }

      cleanImage.close();
      referenceImage.close();

      return {
        width: canvas.width,
        height: canvas.height,
        averageChannelDifference: absoluteDifference / (pixelCount * 3),
        significantPixelRatio: significantPixels / pixelCount,
        maximumChannelDifference,
      };
    },
    {
      cleanBase64: cleanScreenshot.toString('base64'),
      referenceBase64: referenceScreenshot.toString('base64'),
    },
  ) as Promise<PixelComparison>;
}

async function waitForRuntime(page: Page) {
  await page.waitForFunction(
    () => !document.body.innerText.includes('{{') && !document.body.innerText.includes('<sc-for'),
    undefined,
    { timeout: 20_000 },
  );
}

async function preparePage(page: Page, url: string) {
  const failedResources: string[] = [];
  const listener = (response: { status(): number; url(): string }) => {
    if (response.status() >= 400 && !isTransientTemplateRequest(response.url())) {
      failedResources.push(`${response.status()} ${response.url()}`);
    }
  };
  page.on('response', listener);

  const response = await page.goto(url, { waitUntil: 'domcontentloaded' });
  expect(response?.status(), `${url} deveria carregar`).toBeLessThan(400);
  await waitForRuntime(page);
  await page.addStyleTag({ content: deterministicCss });

  await page.evaluate(async () => {
    const delay = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));
    document.documentElement.style.scrollBehavior = 'auto';
    document.body.style.scrollBehavior = 'auto';

    const images = Array.from(document.images).filter((image) => {
      const source = image.currentSrc || image.getAttribute('src') || '';
      return source && !source.includes('{{');
    });

    images.forEach((image) => {
      image.loading = 'eager';
    });

    await Promise.race([
      Promise.allSettled(images.map((image) => image.decode())),
      delay(30_000),
    ]);

    const step = Math.max(360, Math.floor(window.innerHeight * 0.78));
    const limit = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    for (let position = 0; position <= limit; position += step) {
      window.scrollTo({ top: position, left: 0, behavior: 'instant' });
      await delay(35);
    }
    window.scrollTo({ top: limit, left: 0, behavior: 'instant' });
    await delay(250);
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    await delay(100);
  });

  await page.evaluate(async () => {
    await document.fonts.ready;
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    document.querySelectorAll('[data-reveal]').forEach((element) => {
      const htmlElement = element as HTMLElement;
      htmlElement.style.opacity = '1';
      htmlElement.style.transform = 'none';
    });
    document.querySelectorAll('video').forEach((video) => {
      video.pause();
      try {
        video.currentTime = 0;
      } catch {
        // O navegador pode bloquear seek antes dos metadados; o vídeo permanece pausado.
      }
    });
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  });
  await page.waitForFunction(() => window.scrollY === 0 && window.scrollX === 0);
  await page.waitForTimeout(500);

  await expect(page.locator('h1')).toBeVisible();
  const unresolvedTemplates = await page.locator('body').evaluate((body) => {
    const html = body.innerHTML;
    return html.includes('{{') || html.includes('<sc-for');
  });
  expect(unresolvedTemplates, `${url} manteve templates não resolvidos no DOM final`).toBe(false);

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, `${url} possui overflow horizontal`).toBeLessThanOrEqual(1);
  expect(failedResources, `Recursos reais quebrados em ${url}`).toEqual([]);
  page.off('response', listener);
}

test.describe.configure({ mode: 'serial' });
test.setTimeout(1_200_000);

test.describe('premium reference recovery', () => {
  test.skip(!baseURL, 'PREMIUM_PREVIEW_URL não informado');
  mkdirSync(outputDir, { recursive: true });

  for (const viewport of viewports) {
    test(`rotas limpas são visualmente idênticas às referências em ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });

      for (const item of pages) {
        const cleanURL = new URL(item.route, baseURL).href;
        await preparePage(page, cleanURL);
        expect(page.url()).not.toContain('/design/');
        const cleanScreenshot = await page.screenshot({
          path: join(outputDir, `${viewport.name}--${item.name}--clean.png`),
          fullPage: true,
          animations: 'disabled',
        });

        const referenceURL = new URL(item.reference, baseURL).href;
        await preparePage(page, referenceURL);
        const referenceScreenshot = await page.screenshot({
          path: join(outputDir, `${viewport.name}--${item.name}--reference.png`),
          fullPage: true,
          animations: 'disabled',
        });

        const comparison = await comparePngBuffers(page, cleanScreenshot, referenceScreenshot);
        expect(
          comparison.averageChannelDifference,
          `${item.name} em ${viewport.name} alterou cor/composição além do ruído de renderização`,
        ).toBeLessThanOrEqual(0.5);
        expect(
          comparison.significantPixelRatio,
          `${item.name} em ${viewport.name} possui pixels visualmente diferentes`,
        ).toBeLessThanOrEqual(0.005);
        expect(
          comparison.maximumChannelDifference,
          `${item.name} em ${viewport.name} possui divergência extrema de cor`,
        ).toBeLessThanOrEqual(110);
      }
    });
  }

  test('menu mobile e modal continuam funcionais pelo runtime original', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await preparePage(page, new URL('/', baseURL).href);

    const menuButton = page.locator('button[aria-controls="mobile-navigation"]');
    await menuButton.click();
    await expect(menuButton).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('#mobile-navigation')).toHaveAttribute('aria-hidden', 'false');
    await page.keyboard.press('Escape');
    await expect(menuButton).toHaveAttribute('aria-expanded', 'false');

    const modalButton = page.locator('button[aria-controls="event-modal"]').first();
    await modalButton.click();
    await expect(page.locator('#event-modal')).toHaveAttribute('aria-hidden', 'false');
    await page.keyboard.press('Escape');
    await expect(page.locator('#event-modal')).toHaveAttribute('aria-hidden', 'true');
  });

  test('skip link aparece ao navegar por teclado', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const response = await page.goto(new URL('/', baseURL).href, { waitUntil: 'domcontentloaded' });
    expect(response?.status()).toBe(200);
    await waitForRuntime(page);

    const skipLink = page.locator('a[href="#conteudo"]');
    await page.keyboard.press('Tab');
    await expect(skipLink).toBeFocused();
    await expect(skipLink).toBeVisible();
  });
});
