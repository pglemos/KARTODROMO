import { existsSync, readFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const root = process.cwd();
const output = join(root, '.premium-test-dist');
const expectedPages = [
  'index.html',
  'pista.html',
  'kart-locacao.html',
  'campeonatos.html',
  'eventos.html',
  'duvidas.html',
  'kac.html',
  'kac-super.html',
  '200-milhas.html',
  '500-milhas.html',
];

beforeAll(() => {
  rmSync(output, { recursive: true, force: true });
  execFileSync(process.execPath, ['scripts/build-premium-site.mjs', output], {
    cwd: root,
    stdio: 'pipe',
  });
});

afterAll(() => {
  rmSync(output, { recursive: true, force: true });
});

describe('premium static recovery', () => {
  it('gera exatamente as dez páginas premium esperadas', () => {
    for (const page of expectedPages) {
      expect(existsSync(join(output, page)), `${page} ausente`).toBe(true);
    }
  });

  it('não depende do runtime legado nem expõe placeholders', () => {
    for (const page of expectedPages) {
      const html = readFileSync(join(output, page), 'utf8');
      expect(html).not.toContain('/design/');
      expect(html).not.toContain('.dc');
      expect(html).not.toContain('{{');
      expect(html).not.toContain('<sc-for');
      expect(html).toMatch(/<h1[\s>]/i);
      expect(html).toMatch(/<meta name="description"/i);
      expect(html).toContain("document.documentElement.classList.add('js')");
    }
  });

  it('mantém conteúdo visível sem JavaScript e anima somente com progressive enhancement', () => {
    const css = readFileSync(join(output, 'assets/css/site.css'), 'utf8');
    expect(css).toMatch(/\.reveal\s*\{\s*opacity:\s*1;/s);
    expect(css).toMatch(/\.js\s+\.reveal\s*\{\s*opacity:\s*0;/s);
    const legacyScale = css.lastIndexOf('rotate(-1deg) scale(1.01)');
    const effectiveReset = css.lastIndexOf('.editorial-band {\n  transform: none;');
    expect(effectiveReset).toBeGreaterThan(legacyScale);
  });

  it('gera os recursos compartilhados e rotas limpas', () => {
    expect(existsSync(join(output, 'assets/css/site.css'))).toBe(true);
    expect(existsSync(join(output, 'assets/js/site.js'))).toBe(true);
    const worker = readFileSync(join(root, 'workers/premium-preview-worker.mjs'), 'utf8');
    for (const route of ['/', '/pista', '/kart-locacao', '/campeonatos', '/eventos', '/duvidas', '/kac', '/kac-super', '/200-milhas', '/500-milhas']) {
      expect(worker).toContain(JSON.stringify(route));
    }
  });
});
