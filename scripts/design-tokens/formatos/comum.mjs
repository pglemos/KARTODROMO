/** Peças usadas por todos os formatos. */
export const AVISO = 'AUTO-GERADO por scripts/design-tokens/build.mjs — NÃO EDITE. Fonte: tokens/kib.tokens.json (rode `npm run tokens`).';

/** Tokens que viram saída de tela: semânticos e de componente (primitivo e legado ficam de fora). */
export function ehSemantico(t) {
  return !t.caminho.startsWith('primitivo.') && !t.legado;
}

export function ehTematico(t) {
  return t.escuro !== undefined;
}

/** cubicBezier [a,b,c,d] → texto */
export function bezierCss(v) {
  return `cubic-bezier(${v.join(', ')})`;
}

/** Ordena por caminho para a saída ficar estável entre execuções. */
export function ordenar(tokens) {
  return [...tokens].sort((a, b) => a.caminho.localeCompare(b.caminho, 'pt-BR', { numeric: true }));
}
