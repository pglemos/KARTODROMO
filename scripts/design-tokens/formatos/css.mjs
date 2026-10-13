/**
 * CSS custom properties com prefixo --kib- (exclusivo: não colide com --admin-*, --font-* nem com os do telão).
 * :root = tema ESCURO (público). [data-tema="claro"] / .kib-tema-claro = operação. [data-tema="escuro"] / .kib-tema-escuro
 * volta ao escuro dentro de um trecho claro.
 */
import { AVISO, bezierCss, ehSemantico, ehTematico, ordenar } from './comum.mjs';

export function nomeCss(caminho) {
  return `--kib-${caminho.replace(/\./g, '-')}`;
}

function familia(v) {
  return (Array.isArray(v) ? v : [v]).map((f) => (/^[a-z-]+$/.test(f) ? f : `"${f}"`)).join(', ');
}

export function valorCss(tipo, v) {
  switch (tipo) {
    case 'color': return String(v).toLowerCase();
    case 'fontFamily': return familia(v);
    case 'cubicBezier': return bezierCss(v);
    case 'shadow': return `${v.offsetX} ${v.offsetY} ${v.blur} ${v.spread} ${String(v.color).toLowerCase()}`;
    default: return String(v);
  }
}

export function gerarCss({ tokens, temas }) {
  const lista = ordenar(tokens.filter(ehSemantico));
  const linhas = (tema, filtro) => lista.filter(filtro).map((t) => `  ${nomeCss(t.caminho)}: ${valorCss(t.tipo, temas[tema].get(t.caminho))};`).join('\n');
  return `/* ${AVISO} */

/* Tema ESCURO (público: site, totem, telão, tablet) — padrão */
:root {
${linhas('escuro', () => true)}
}

/* Tema CLARO (operação: cronometragem, recepção, admin, relatórios) */
[data-tema="claro"],
.kib-tema-claro {
${linhas('claro', ehTematico)}
}

/* Volta ao escuro dentro de um trecho claro */
[data-tema="escuro"],
.kib-tema-escuro {
${linhas('escuro', ehTematico)}
}

@media (prefers-reduced-motion: reduce) {
  :root, [data-tema], .kib-tema-claro, .kib-tema-escuro {
    --kib-movimento-duracao-rapido: 0ms;
    --kib-movimento-duracao-padrao: 0ms;
    --kib-movimento-duracao-lento: 0ms;
  }
}
`;
}
