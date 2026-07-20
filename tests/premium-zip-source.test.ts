import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const sourceRoot = join(root, 'premium-src', 'kartodromo-betim-premium-revisado-final');

const expectedTextHashes: Record<string, string> = {
  'index.html': 'c170e929806b11b57ca5945836ab59d4439a1dfcc6971cd0dcaf7297a3136768',
  'pista.html': '8678185fe9b884fe15de94052b6bdc0bee1bb3d01ddd9ffae47659c0aea706b4',
  'kart-locacao.html': '701dc26c7b63875b5f3be85c41fea008ede628f861d549694f426f410d85df8a',
  'campeonatos.html': '75dc3ccf6370c063029d0c71e00664fb5ff1eef0c9971274072dd7b6827d8fbc',
  'eventos.html': '68b1a9aac9afa8ec340b2800ecabba2cf5a602a75311f004052bdc7858583ffc',
  'duvidas.html': '31682d717bc9d15bb79887be746984db77dc69e3c9e8302db3d3be1a3ac012c4',
  'kac.html': '703e4c8a6adfe1937dea4a6e61607626c5941e6d3b51823d019700cac3cd7e6e',
  'kac-super.html': '9070f7a02f85bf5f1ae9b2cf4ecefbd690d1181c6744e7c8e3990dcd368df083',
  '200-milhas.html': '9f617f4754502aa823422ba13af1d7fef074f8342b0bce04fdac8db8c312bdd3',
  '500-milhas.html': '2856976ef81563739d9e9a133735d8d4b2a3f2b50fcf29478614338016af6d01',
  'assets/css/site.css': 'bc4c441f07851e48f75925a460b9f2d182242e9b46417a3f924820eb4fff606b',
  'assets/js/site.js': '815193b9b80cfd29d748ff0a4b732e1d4aa9e5d389dfb30953dc9d23200d9b7b',
  'README.md': '900f43238942dd66de5dabe02662d5371185eb28721aec07ebffcb8670e203ba',
  'QA.md': '1d972cffee52221a033c15dd336dd8e4efc83d6dbbcaaa07501f3f334c70ee44',
  'qa_check.py': '9831e380d95a8e9f1e914bb99126dcf5f4c378072dc6a73d71f477aefd43997d',
};

const routeMappings: Record<string, string> = {
  '/': '/site/index.html',
  '/pista': '/site/pista.html',
  '/kart-locacao': '/site/kart-locacao.html',
  '/campeonatos': '/site/campeonatos.html',
  '/eventos': '/site/eventos.html',
  '/duvidas': '/site/duvidas.html',
  '/kac': '/site/kac.html',
  '/kac-super': '/site/kac-super.html',
  '/200-milhas': '/site/200-milhas.html',
  '/500-milhas': '/site/500-milhas.html',
};

const sha256 = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');

describe('pacote premium final fornecido no ZIP', () => {
  it('preserva byte a byte os HTMLs, CSS, JavaScript e documentos de QA', () => {
    for (const [relativePath, expectedHash] of Object.entries(expectedTextHashes)) {
      const absolutePath = join(sourceRoot, relativePath);
      expect(existsSync(absolutePath), `${relativePath} não foi importado do ZIP final`).toBe(true);
      expect(sha256(absolutePath), `${relativePath} divergiu do arquivo anexado`).toBe(expectedHash);
    }
  });

  it('não usa as páginas .dc como fonte de publicação', () => {
    const buildScript = readFileSync(join(root, 'scripts', 'build-premium-reference.mjs'), 'utf8');
    expect(buildScript).toContain('kartodromo-betim-premium-revisado-final');
    expect(buildScript).not.toContain("join(publicDir, 'design')");
    expect(buildScript).not.toContain('reference-responsive-patch.css');
  });

  it('mapeia cada rota limpa para o HTML correspondente do pacote final', () => {
    const worker = readFileSync(join(root, 'workers', 'premium-preview-worker.mjs'), 'utf8');
    for (const [route, html] of Object.entries(routeMappings)) {
      expect(worker).toContain(`[${JSON.stringify(route)}, ${JSON.stringify(html)}]`);
    }
    expect(worker).not.toContain('/design/');
  });
});
