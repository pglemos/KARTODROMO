import { readFileSync } from 'node:fs';
import { parse } from 'acorn';
import { describe, expect, it } from 'vitest';

// Páginas abertas em TVs com navegador antigo: o script tem que ser ES5 (senão a página fica parada e o vigia das TVs
// recarrega sem parar). sorteio.html: LG 65UK6540 de 2018 (13/10). tv-classica.html: LG Netcast 2013 (pipoca).
const scripts = (arquivo: string) =>
  [...readFileSync(`services/timing-ui/${arquivo}`, 'utf8').matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);

describe('páginas das TVs antigas em ES5', () => {
  for (const arquivo of ['sorteio.html', 'tv-classica.html']) {
    it(`${arquivo}: o script é ES5 puro`, () => {
      const lista = scripts(arquivo);
      expect(lista.length).toBeGreaterThan(0);
      for (const s of lista) expect(() => parse(s, { ecmaVersion: 5 })).not.toThrow();
    });
  }

  it('sorteio.html: sem CSS que o navegador de 2018 não entende (grid, gap no flex, min(), var())', () => {
    const css = readFileSync('services/timing-ui/sorteio.html', 'utf8').match(/<style>([\s\S]*?)<\/style>/)![1].replace(/\/\*[\s\S]*?\*\//g, '');
    expect(css).not.toMatch(/display:\s*grid|\bgap:|min\(|var\(--/);
  });
});
