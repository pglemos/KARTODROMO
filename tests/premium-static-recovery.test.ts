import { existsSync, readFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const root = process.cwd();
const output = join(root, '.premium-test-dist');
const responsivePatch = readFileSync(
  join(root, 'premium-src/reference-responsive-patch.css'),
  'utf8',
);
const patchTag = `<style id="kib-reference-responsive-recovery">\n${responsivePatch}\n</style>`;
const expectedPages = [
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
];

beforeAll(() => {
  rmSync(output, { recursive: true, force: true });
  execFileSync(process.execPath, ['scripts/build-premium-reference.mjs', output], {
    cwd: root,
    stdio: 'pipe',
  });
});

afterAll(() => {
  rmSync(output, { recursive: true, force: true });
});

describe('premium reference recovery', () => {
  it('preserva cada página original e acrescenta somente o patch responsivo aprovado', () => {
    for (const page of expectedPages) {
      const source = readFileSync(join(root, 'public/design', page), 'utf8');
      const generated = readFileSync(join(output, 'design', page), 'utf8');
      const expected = source.includes('</helmet>')
        ? source.replace('</helmet>', `${patchTag}\n</helmet>`)
        : source.replace('</head>', `${patchTag}\n</head>`);
      expect(generated, `${page} recebeu alteração além do patch responsivo`).toBe(expected);
      expect(source).not.toContain('kib-reference-responsive-recovery');
      expect(generated).toContain('kib-reference-responsive-recovery');
    }
  });

  it('inclui o runtime e todos os recursos compartilhados obrigatórios', () => {
    expect(existsSync(join(output, 'support.js'))).toBe(true);
    expect(existsSync(join(output, 'motion.js'))).toBe(true);
    expect(existsSync(join(output, 'beneficios-nav.css'))).toBe(true);
    expect(existsSync(join(output, 'assets/brand/kib-logo.png'))).toBe(true);
    expect(existsSync(join(output, 'assets/posters/home-karting.jpg'))).toBe(true);
  });

  it('mapeia cada URL pública limpa para a referência correspondente', () => {
    const worker = readFileSync(join(root, 'workers/premium-preview-worker.mjs'), 'utf8');
    const mappings = [
      ['/', '/design/home.dc.html'],
      ['/pista', '/design/pista.dc.html'],
      ['/kart-locacao', '/design/kart-locacao.dc.html'],
      ['/campeonatos', '/design/campeonatos.dc.html'],
      ['/eventos', '/design/eventos.dc.html'],
      ['/duvidas', '/design/duvidas.dc.html'],
      ['/kac', '/design/kac.dc.html'],
      ['/kac-super', '/design/kac-super.dc.html'],
      ['/200-milhas', '/design/200-milhas.dc.html'],
      ['/500-milhas', '/design/500-milhas.dc.html'],
    ];
    for (const [route, reference] of mappings) {
      expect(worker).toContain(`[${JSON.stringify(route)}, ${JSON.stringify(reference)}]`);
    }
  });

  it('mantém as referências internas fora dos mecanismos de busca', () => {
    const robots = readFileSync(join(output, 'robots.txt'), 'utf8');
    expect(robots).toContain('Disallow: /design/');
    const worker = readFileSync(join(root, 'workers/premium-preview-worker.mjs'), 'utf8');
    expect(worker).toContain('noindex, nofollow, noarchive');
  });
});
