/** docs/design-system/02-tokens/referencia.md — tabela de todos os tokens com os dois temas e o contraste. */
import { AVISO, ehSemantico, ordenar } from './comum.mjs';
import { nomeCss, valorCss } from './css.mjs';
import { nomePascal } from '../ler-tokens.mjs';

const amostra = (tipo, v) => (tipo === 'color' ? `<span style="display:inline-block;width:14px;height:14px;border:1px solid #888;background:${v};vertical-align:middle"></span> \`${v}\`` : `\`${typeof v === 'object' ? JSON.stringify(v) : v}\``);
const celula = (s) => String(s).replace(/\|/g, '\\|');

export function gerarMarkdown({ tokens, temas }, contrastes) {
  const grupos = new Map();
  for (const t of ordenar(tokens.filter(ehSemantico))) {
    const g = t.caminho.split('.').slice(0, 2).join('.');
    if (!grupos.has(g)) grupos.set(g, []);
    grupos.get(g).push(t);
  }
  const secoes = [...grupos].map(([g, lista]) => `### \`${g}\`

| Token | Claro (operação) | Escuro (público) | CSS | C# / Kotlin | Uso |
|---|---|---|---|---|---|
${lista.map((t) => `| \`${t.caminho}\` | ${amostra(t.tipo, valorCss(t.tipo, temas.claro.get(t.caminho)))} | ${amostra(t.tipo, valorCss(t.tipo, temas.escuro.get(t.caminho)))} | \`${nomeCss(t.caminho)}\` | \`Tokens.Claro.${nomePascal(t.caminho)}\` | ${celula(t.descricao)} |`).join('\n')}`).join('\n\n');

  const tabelaContraste = contrastes.map((r) => `| \`${r.token}\` | \`${r.sobre}\` | ${r.tema} | ${r.razao.toFixed(2)}:1 | ${r.min}:1 | ${r.ok ? '✅' : r.nivel === 'aviso' ? '⚠️ decisão pendente' : '❌'} |`).join('\n');

  const legado = tokens.filter((t) => t.legado).map((t) => `| \`Tokens.${t.caminho.split('.').pop()}\` | \`${valorCss(t.tipo, temas.claro.get(t.caminho))}\` | ${celula(t.obsoleto ?? '')} |`).join('\n');

  return `<!-- ${AVISO} -->
# Referência de tokens

Gerada a partir de \`tokens/kib.tokens.json\`. Para mudar um valor, edite o JSON e rode \`npm run tokens\`.
Nunca use o valor (hex/px) direto numa tela: use o nome do token.

## Tokens semânticos

${secoes}

## Contraste verificado (WCAG)

Texto normal ≥ 4.5:1 · texto grande (≥ 18px ou ≥ 14px negrito) e componentes de interface ≥ 3:1.
O build falha se um par reprovar (exceto os marcados como decisão pendente).

| Token | Sobre | Tema | Razão | Mínimo | Situação |
|---|---|---|---|---|---|
${tabelaContraste}

## Nomes legados do desktop (\`Kartodromo.Comum.Tokens\`)

Continuam com o valor de antes para não mudar nenhuma tela. Telas novas usam \`Tokens.Claro.*\` / \`Tokens.Escuro.*\`.

| Nome antigo | Valor | Substituto |
|---|---|---|
${legado}
`;
}
