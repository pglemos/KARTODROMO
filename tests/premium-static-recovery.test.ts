import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const root = process.cwd();
const output = join(root, '.premium-test-dist');
const sourceRoot = join(root, 'premium-src', 'kartodromo-betim-premium-revisado-final');
const pages = [
  'index.html', 'pista.html', 'kart-locacao.html', 'campeonatos.html', 'eventos.html',
  'duvidas.html', 'kac.html', 'kac-super.html', '200-milhas.html', '500-milhas.html',
];
const sha256 = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');

beforeAll(() => {
  rmSync(output, { recursive: true, force: true });
  execFileSync(process.execPath, ['scripts/build-premium-reference.mjs', output], {
    cwd: root,
    stdio: 'pipe',
  });
});

afterAll(() => rmSync(output, { recursive: true, force: true }));

describe('build do pacote premium final', () => {
  it('publica as dez páginas sem alterar um byte', () => {
    for (const page of pages) {
      expect(sha256(join(output, 'site', page))).toBe(sha256(join(sourceRoot, page)));
    }
  });

  it('publica CSS e JavaScript exatos nas rotas limpa e de referência', () => {
    for (const asset of ['assets/css/site.css', 'assets/js/site.js']) {
      const expected = sha256(join(sourceRoot, asset));
      expect(sha256(join(output, asset))).toBe(expected);
      expect(sha256(join(output, 'site', asset))).toBe(expected);
    }
  });

  it('inclui os ativos binários exigidos pelo manifesto do ZIP', () => {
    for (const asset of [
      'assets/brand/kib-logo.png',
      'assets/posters/home-karting.jpg',
      'assets/videos/home-karting.mp4',
      'assets/regulamentos/kac-iniciantes-betim-2026.pdf',
      'assets/championships/500-milhas-logo.png',
    ]) {
      expect(existsSync(join(output, asset)), `${asset} ausente na raiz`).toBe(true);
      expect(existsSync(join(output, 'site', asset)), `${asset} ausente na referência`).toBe(true);
    }
  });

  it('não publica páginas .dc nem o patch responsivo descartado', () => {
    expect(existsSync(join(output, 'design'))).toBe(false);
    expect(existsSync(join(output, 'support.js'))).toBe(false);
    expect(existsSync(join(output, 'beneficios-nav.css'))).toBe(false);
  });

  it('mantém as referências internas fora dos mecanismos de busca', () => {
    const robots = readFileSync(join(output, 'robots.txt'), 'utf8');
    expect(robots).toContain('Disallow: /site/');
    const worker = readFileSync(join(root, 'workers', 'premium-preview-worker.mjs'), 'utf8');
    expect(worker).toContain('noindex, nofollow, noarchive');
  });
});
