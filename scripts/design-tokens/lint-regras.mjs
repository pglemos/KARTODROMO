/**
 * Regras do verificador de "hardcode" visual: cor, fonte e tamanho escritos direto no código em vez de token.
 * Cada regra vale para algumas extensões de arquivo. Contagem por arquivo (aguenta edições sem mudar linhas).
 */

export const REGRAS = [
  { id: 'cs-cor-literal', ext: ['.cs'], re: /Color\.FromArgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+(?:\s*,\s*\d+)?\s*\)/g, ajuda: 'use Tokens.Claro.Cor… / Tokens.Escuro.Cor…' },
  { id: 'cs-cor-nomeada', ext: ['.cs'], re: /\bColor\.(?!FromArgb\b|Transparent\b|Empty\b|FromName\b|FromKnownColor\b)[A-Z][A-Za-z]+\b/g, ajuda: 'use um token de cor (Color.Transparent é permitido)' },
  { id: 'cs-cor-html', ext: ['.cs'], re: /ColorTranslator\.FromHtml\(/g, ajuda: 'use um token de cor' },
  { id: 'cs-fonte', ext: ['.cs'], re: /\bnew\s+Font\(/g, ajuda: 'use Tokens.Fonte(Tokens.Claro.FonteTamanho…)' },
  { id: 'css-hex', ext: ['.css', '.html', '.ts', '.tsx', '.js', '.jsx'], re: /(?<![\w&/[])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b(?![-\w])/g, ajuda: 'use var(--kib-cor-…)' },
  { id: 'css-rgb-hsl', ext: ['.css', '.html', '.ts', '.tsx', '.js', '.jsx'], re: /\b(?:rgba?|hsla?)\(/g, ajuda: 'use var(--kib-cor-…)' },
  { id: 'css-font-family', ext: ['.css', '.html', '.ts', '.tsx', '.js', '.jsx'], re: /\bfont-family\s*:|\bfontFamily\s*:/g, ajuda: 'use var(--kib-fonte-familia-…)' },
  { id: 'tw-arbitrario', ext: ['.ts', '.tsx', '.js', '.jsx'], re: /\b(?:bg|text|border|from|to|via|fill|stroke|ring|shadow|rounded|p|px|py|m|mx|my|gap|w|h)-\[(?:#|rgb|hsl|\d)/g, ajuda: 'use classes ligadas aos tokens' },
  { id: 'tw-paleta-crua', ext: ['.ts', '.tsx', '.js', '.jsx'], re: /\b(?:bg|text|border|ring|from|to|via|fill|stroke|divide|outline)-(?:zinc|neutral|gray|slate|stone|red|green|emerald|amber|yellow|blue|sky|orange|lime|teal)-\d{2,3}\b/g, ajuda: 'use primary/ink ou var(--kib-…)' },
  { id: 'kt-cor', ext: ['.kt'], re: /\bColor\(\s*0x[0-9A-Fa-f]{6,8}\s*\)/g, ajuda: 'use Tokens.Escuro.Cor… (pacote …sorteio.design)' },
  { id: 'xml-cor', ext: ['.xml'], re: /#(?:[0-9A-Fa-f]{8}|[0-9A-Fa-f]{6})\b/g, ajuda: 'use @color/kib_…' },
];

/** Tira comentários mantendo a contagem de linhas (para o código ignorar só o que é código). */
export function semComentarios(texto, ext) {
  let s = texto;
  if (['.html', '.xml'].includes(ext)) s = s.replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, ' '));
  if (['.cs', '.ts', '.tsx', '.js', '.jsx', '.kt', '.css', '.html'].includes(ext)) {
    s = s.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  }
  if (['.cs', '.ts', '.tsx', '.js', '.jsx', '.kt'].includes(ext)) {
    // comentário de linha: // fora de URL (http://) e fora de texto entre aspas no começo do trecho
    s = s.split('\n').map((l) => {
      const i = l.search(/(?<![:"'`\w])\/\//);
      return i >= 0 ? l.slice(0, i) : l;
    }).join('\n');
  }
  return s;
}

/** Linhas marcadas para ignorar: `design-lint-ignore: <motivo>` (o motivo é obrigatório). */
export function linhasIgnoradas(texto) {
  const ignoradas = new Set();
  texto.split('\n').forEach((l, i) => { if (/design-lint-ignore:\s*\S/.test(l)) ignoradas.add(i); });
  return ignoradas;
}

/** Conta as ocorrências de cada regra num texto. */
export function contarHardcode(texto, ext) {
  const ignoradas = linhasIgnoradas(texto);
  const linhas = semComentarios(texto, ext).split('\n');
  const contagem = {};
  for (const regra of REGRAS) {
    if (!regra.ext.includes(ext)) continue;
    let n = 0;
    linhas.forEach((l, i) => {
      if (ignoradas.has(i)) return;
      regra.re.lastIndex = 0;
      n += (l.match(regra.re) ?? []).length;
    });
    if (n) contagem[regra.id] = n;
  }
  return contagem;
}
