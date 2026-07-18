import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

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
      const html = readFileSync(join(process.cwd(), 'public', 'design', page), 'utf8');

      expect(html).toContain("{ label: 'Locação', href: '/kart-locacao', id: 'locacao' }");
      expect(html).toContain("{ label: 'BENEFÍCIOS', href: '/clube-vantagens', id: 'clube' }");
      expect(html).toContain('<link href="./beneficios-nav.css" rel="stylesheet">');
    });
  }
});
