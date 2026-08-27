import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const designDir = join(process.cwd(), 'public', 'design');

const publicPages = [
  'home.dc.html',
  'pista.dc.html',
  'kart-locacao.dc.html',
  'campeonatos.dc.html',
  'eventos.dc.html',
  'duvidas.dc.html',
  'kac.dc.html',
  'kac-super.dc.html',
  '200-milhas.dc.html',
  '500-milhas.dc.html',
  'clube-vantagens.dc.html',
];

describe('navegação pública', () => {
  for (const page of publicPages) {
    it(`mantém Locação e Benefícios em ${page}`, () => {
      const html = readFileSync(join(designDir, page), 'utf8');

      expect(html).toContain("{ label: 'Locação', href: '/kart-locacao', id: 'locacao' }");
      expect(html).toContain("{ label: 'BENEFÍCIOS', href: '/clube-vantagens', id: 'clube' }");
    });
  }
});

describe('fidelidade ao design system', () => {
  it('public/design é gerado a partir de design-source', () => {
    expect(() =>
      execFileSync('node', ['scripts/sync-design.mjs', '--check'], { cwd: process.cwd() }),
    ).not.toThrow();
  }, 15_000);

  it('não reintroduz folhas de estilo fora do design original', () => {
    const overrides = ['beneficios-nav.css', 'clube-portal.css', 'clube-portal.js'];

    for (const file of readdirSync(designDir)) {
      const html = readFileSync(join(designDir, file), 'utf8');
      for (const override of overrides) {
        expect(html, `${file} referencia ${override}`).not.toContain(override);
      }
    }
  });
});
