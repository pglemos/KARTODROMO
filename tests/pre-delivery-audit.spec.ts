import { test, expect, type Page } from '@playwright/test';

const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:4174';
const canonicalOrigin = 'https://kartodromodebetim.com.br';
const viewports = [
  { width: 375, height: 812 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1440, height: 900 },
];
const paths = [
  '/',
  '/pista',
  '/kart-locacao',
  '/reservas',
  '/eventos',
  '/campeonatos',
  '/historia',
  '/duvidas',
  '/kac',
  '/kac-super',
  '/200-milhas',
  '/500-milhas',
  '/clube-vantagens',
  '/clube-cadastro',
  '/clube-consulta',
  '/clube-painel',
  '/clube-corridas',
  '/clube-pontuacao',
  '/clube-catalogo',
  '/clube-resgates',
  '/clube-perfil',
  '/clube-regulamento',
  '/clube-campanhas',
];
const unavailableClubPaths = new Set([
  '/clube-cadastro',
  '/clube-consulta',
  '/clube-painel',
  '/clube-corridas',
  '/clube-pontuacao',
  '/clube-catalogo',
  '/clube-resgates',
  '/clube-perfil',
  '/clube-campanhas',
]);

const auditPage = async (page: Page) => page.evaluate(() => {
  const isVisible = (element: Element) => {
    const htmlElement = element as HTMLElement;
    const rect = htmlElement.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;

    let current: Element | null = htmlElement;
    while (current) {
      const style = window.getComputedStyle(current);
      if (style.visibility === 'hidden' || style.display === 'none' || Number(style.opacity) === 0) return false;
      current = current.parentElement;
    }

    return true;
  };

  const parseRgb = (value: string) => {
    const match = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([.\d]+))?\)/);
    if (!match) return null;
    return { r: Number(match[1]), g: Number(match[2]), b: Number(match[3]), a: match[4] === undefined ? 1 : Number(match[4]) };
  };

  const luminance = ({ r, g, b }: { r: number; g: number; b: number }) => {
    const values = [r, g, b].map((channel) => {
      const normalized = channel / 255;
      return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * values[0] + 0.7152 * values[1] + 0.0722 * values[2];
  };

  const contrast = (foreground: { r: number; g: number; b: number }, background: { r: number; g: number; b: number }) => {
    const lighter = Math.max(luminance(foreground), luminance(background));
    const darker = Math.min(luminance(foreground), luminance(background));
    return (lighter + 0.05) / (darker + 0.05);
  };

  const effectiveBackground = (element: Element) => {
    let current: Element | null = element;
    while (current) {
      const style = window.getComputedStyle(current);
      if (style.backgroundImage !== 'none') return null;
      const bg = parseRgb(style.backgroundColor);
      if (bg && bg.a > 0.95) return bg;
      current = current.parentElement;
    }
    return { r: 255, g: 255, b: 255, a: 1 };
  };

  const clickableSelector = 'a[href], button, [role="button"], summary, input[type="button"], input[type="submit"], input[type="reset"]';
  const clickableIssues = Array.from(document.querySelectorAll<HTMLElement>(clickableSelector))
    .filter((element) => isVisible(element) && !element.hasAttribute('disabled') && element.getAttribute('aria-disabled') !== 'true')
    .map((element) => {
      const style = window.getComputedStyle(element);
      const transitionDurations = style.transitionDuration.split(',').map((value) => Number.parseFloat(value) * (value.includes('ms') ? 1 : 1000));
      return {
        tag: element.tagName.toLowerCase(),
        text: element.textContent?.replace(/\s+/g, ' ').trim().slice(0, 80) || element.getAttribute('aria-label') || '',
        cursor: style.cursor,
        transitionMax: Math.max(...transitionDurations, 0),
      };
    })
    .filter((item) => item.cursor !== 'pointer' || item.transitionMax > 700);

  const isDecorative = (element: Element) => {
    let current: Element | null = element;
    while (current) {
      if (current.getAttribute('aria-hidden') === 'true') return true;
      current = current.parentElement;
    }
    return false;
  };

  const contrastIssues = Array.from(document.querySelectorAll<HTMLElement>('body *'))
    .filter((element) => isVisible(element))
    .filter((element) => !isDecorative(element))
    .filter((element) => {
      const text = element.textContent?.replace(/\s+/g, ' ').trim() ?? '';
      return text.length > 0 && Array.from(element.children).every((child) => !child.textContent?.trim());
    })
    .map((element) => {
      const style = window.getComputedStyle(element);
      const foreground = parseRgb(style.color);
      const background = effectiveBackground(element);
      if (!foreground || !background) return null;
      const fontSize = Number.parseFloat(style.fontSize);
      const fontWeight = Number.parseInt(style.fontWeight, 10);
      const required = fontSize >= 24 || (fontSize >= 18.66 && fontWeight >= 700) ? 3 : 4.5;
      const ratio = contrast(foreground, background);
      return {
        text: element.textContent?.replace(/\s+/g, ' ').trim().slice(0, 80),
        tag: element.tagName.toLowerCase(),
        ratio: Number(ratio.toFixed(2)),
        required,
        color: style.color,
        background: `rgb(${background.r}, ${background.g}, ${background.b})`,
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .filter((item) => item.ratio < item.required)
    .slice(0, 20);

  const html = document.documentElement.innerHTML;
  const emojiMatches = document.body.textContent?.match(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu) ?? [];
  const designLinks = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href]'))
    .map((link) => link.getAttribute('href') || '')
    .filter((href) => href.includes('/design/') || href.includes('.dc.html'));

  return {
    overflowX: document.documentElement.scrollWidth - window.innerWidth,
    clickableIssues,
    contrastIssues,
    emojiMatches,
    unresolvedTemplates: html.match(/\{\{[^}]+\}\}/g) ?? [],
    designLinks,
    canonical: document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href ?? '',
    title: document.title,
    bodyText: document.body.innerText,
  };
});

test.describe('pre-delivery checklist', () => {
  test.setTimeout(360_000);

  for (const viewport of viewports) {
    test(`responsive/accessibility audit ${viewport.width}`, async ({ page }) => {
      await page.route('**/*', async (route) => {
        if (route.request().resourceType() === 'media') await route.abort();
        else await route.continue();
      });
      await page.setViewportSize(viewport);

      for (const path of paths) {
        await page.goto(`${baseUrl}${path}`, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(100);
        const result = await auditPage(page);
        const expectedCanonical = new URL(path, canonicalOrigin).href;

        expect(result.title, `${path} needs a route title`).not.toBe('');
        expect(result.canonical, `${path} needs a canonical URL`).toBe(expectedCanonical);
        expect(result.unresolvedTemplates, `${path} exposes template expressions`).toEqual([]);
        expect(result.designLinks, `${path} links to design documents`).toEqual([]);
        expect(result.emojiMatches, `${path} has emoji text/icons`).toHaveLength(0);
        expect(result.overflowX, `${path} overflows horizontally at ${viewport.width}px`).toBeLessThanOrEqual(2);
        expect(result.clickableIssues, `${path} clickable cursor/transition issues`).toEqual([]);
        expect(result.contrastIssues, `${path} contrast issues`).toEqual([]);

        if (unavailableClubPaths.has(path)) {
          const normalizedBodyText = result.bodyText.toLocaleLowerCase('pt-BR');
          expect(normalizedBodyText, `${path} must disclose its status`).toContain('portal em implantação');
          expect(normalizedBodyText, `${path} must not pretend to process data`).toContain('nenhum cadastro, saldo, alteração de perfil ou resgate é processado');
        }
      }
    });
  }

  test('focus states and reduced motion', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    const result = await page.evaluate(() => {
      const maxDurationMs = (value: string) => Math.max(...value.split(',').map((part) => {
        const trimmed = part.trim();
        const numeric = Number.parseFloat(trimmed);
        if (!Number.isFinite(numeric)) return 0;
        return trimmed.endsWith('ms') ? numeric : numeric * 1000;
      }));
      const first = document.querySelector<HTMLElement>('a[href], button:not([disabled])');
      first?.focus();
      const focusStyle = first ? window.getComputedStyle(first) : null;
      const animated = Array.from(document.querySelectorAll<HTMLElement>('*'))
        .map((element) => window.getComputedStyle(element))
        .filter((style) => style.animationName !== 'none' || style.transitionDuration !== '0s')
        .slice(0, 30)
        .map((style) => ({
          animationDuration: style.animationDuration,
          transitionDuration: style.transitionDuration,
        }));

      return {
        focusedTag: first?.tagName,
        outline: focusStyle?.outlineStyle,
        outlineWidth: focusStyle?.outlineWidth,
        reducedMotionOk: animated.every((item) => maxDurationMs(item.animationDuration) <= 0.02 && maxDurationMs(item.transitionDuration) <= 0.02),
      };
    });

    expect(result.focusedTag).toBeTruthy();
    expect(result.outline).not.toBe('none');
    expect(result.outlineWidth).not.toBe('0px');
    expect(result.reducedMotionOk).toBeTruthy();
  });

  test('legacy routes permanently redirect to canonical pages', async ({ request }) => {
    const values = await request.get(`${baseUrl}/valores`, { maxRedirects: 0 });
    expect([301, 308]).toContain(values.status());
    expect(values.headers().location).toBe('/kart-locacao');

    const championship = await request.get(`${baseUrl}/campeonatos/kac`, { maxRedirects: 0 });
    expect([301, 308]).toContain(championship.status());
    expect(championship.headers().location).toBe('/kac');
  });

  test('unknown public routes return a real 404', async ({ request }) => {
    const response = await request.get(`${baseUrl}/rota-publica-inexistente`);
    expect(response.status()).toBe(404);
    expect(await response.text()).toContain('Essa rota não existe');
  });
});
