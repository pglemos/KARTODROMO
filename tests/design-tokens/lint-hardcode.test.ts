import { describe, expect, it } from 'vitest';
import { contarHardcode } from '../../scripts/design-tokens/lint-regras.mjs';
import { comparar, CONGELADO, contarTudo } from '../../scripts/design-tokens/lint-hardcode.mjs';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('regras do verificador de hardcode', () => {
  it('C#: cor literal, cor nomeada e fonte contam; Color.Transparent e cor derivada de token não', () => {
    const cs = [
      'var a = Color.FromArgb(11, 122, 83);',
      'var b = Color.White;',
      'var c = new Font("Segoe UI", 9F);',
      'var d = Color.Transparent;',
      'var e = Color.FromArgb(40, Tokens.Verde);',
    ].join('\n');
    expect(contarHardcode(cs, '.cs')).toEqual({ 'cs-cor-literal': 1, 'cs-cor-nomeada': 1, 'cs-fonte': 1 });
  });

  it('comentários e linhas com design-lint-ignore (com motivo) não contam', () => {
    const cs = [
      '// Color.FromArgb(1, 2, 3) no comentário',
      '/* new Font("x", 9) */',
      'var x = Color.FromArgb(1, 2, 3); // design-lint-ignore: arte do ícone',
    ].join('\n');
    expect(contarHardcode(cs, '.cs')).toEqual({});
    expect(contarHardcode('var x = Color.FromArgb(1, 2, 3); // design-lint-ignore:', '.cs')).toEqual({ 'cs-cor-literal': 1 });
  });

  it('CSS/TSX: hex, rgb() e fonte literal contam; var(--kib-…) e âncora de link não', () => {
    expect(contarHardcode('a { color: #0b7a53; background: rgba(0,0,0,.5); font-family: Arial; }', '.css'))
      .toEqual({ 'css-hex': 1, 'css-rgb-hsl': 1, 'css-font-family': 1 });
    expect(contarHardcode('a { color: var(--kib-cor-acao-principal); }', '.css')).toEqual({});
    expect(contarHardcode('<a href="#topo">Topo</a>', '.html')).toEqual({});
  });

  it('Tailwind: valor arbitrário e paleta crua contam', () => {
    expect(contarHardcode('<div className="bg-[#030504] text-zinc-500 p-4" />', '.tsx')).toEqual({ 'tw-arbitrario': 1, 'tw-paleta-crua': 1 });
  });

  it('Kotlin e XML do Android', () => {
    expect(contarHardcode('val v = Color(0xFF087F5B)', '.kt')).toEqual({ 'kt-cor': 1 });
    expect(contarHardcode('<color name="x">#FF087F5B</color>', '.xml')).toEqual({ 'xml-cor': 1 });
  });
});

describe('catraca da baseline', () => {
  it('falha quando um arquivo piora ou surge arquivo novo com hardcode; melhora só avisa', () => {
    const r = comparar(
      { 'desktop/src/A.cs': { 'cs-fonte': 3 }, 'app/novo.tsx': { 'css-hex': 1 }, 'desktop/src/B.cs': { 'cs-fonte': 1 } },
      { 'desktop/src/A.cs': { 'cs-fonte': 2 }, 'desktop/src/B.cs': { 'cs-fonte': 4 } },
    );
    expect(r.piorou.map((p) => p.arquivo).sort()).toEqual(['app/novo.tsx', 'desktop/src/A.cs']);
    expect(r.melhorou.map((p) => p.arquivo)).toEqual(['desktop/src/B.cs']);
  });

  it('o telão congelado conta mas nunca falha', () => {
    expect(CONGELADO.test('desktop/src/Kartodromo.Cronometragem/FormTV.cs')).toBe(true);
    expect(CONGELADO.test('services/timing-ui/tb50.html')).toBe(true);
    expect(comparar({ 'services/timing-ui/tv.html': { 'css-hex': 99 } }, {}).piorou).toEqual([]);
  });

  it('o repositório atual não tem hardcode novo em relação à baseline', () => {
    const baseline = JSON.parse(readFileSync(join(__dirname, '..', '..', 'tokens', 'hardcode-baseline.json'), 'utf8')).arquivos;
    expect(comparar(contarTudo(), baseline).piorou).toEqual([]);
  });
});
