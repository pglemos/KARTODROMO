# Tipografia

## Famílias

| Token | Claro (operação) | Escuro (público) | Observação |
|---|---|---|---|
| `fonte.familia.interface` | Segoe UI | Rajdhani | admin web usa Rajdhani mesmo no claro (já carregada como `--font-admin`) |
| `fonte.familia.destaque` | Segoe UI (negrito) | **Anton** (MAIÚSCULAS, peso 400) | Anton só tem peso 400: use `font-synthesis-weight: none` |
| `fonte.familia.numero` | Cascadia Mono → Consolas | idem | tempos de volta, contadores, placas de kart; na web pode ser `font-variant-numeric: tabular-nums` |

Decidido 10/10/2026: a fonte **Oswald** (`--font-race`, carregada em `app/[[...slug]]/layout.tsx`) fica **legitimada** como
fonte numérica/esportiva do público (placares, tempos e chamadas de corrida em /reservas e /historia). Não usar na operação.

## Escala (px; no WinForms use `Tokens.Fonte(px)`, que converte px × 0,75 = pt)

| Token | px | Uso | Peso usual |
|---|---|---|---|
| `fonte.tamanho.legenda` | 11 | legenda, rótulo de coluna, selo | semibold |
| `fonte.tamanho.pequeno` | 12 | texto auxiliar, rodapé de status | regular |
| `fonte.tamanho.corpo` | 13 | **corpo padrão das telas de operação**, campos, tabelas | regular |
| `fonte.tamanho.corpo-leitura` | 16 | texto corrido na web pública | médio |
| `fonte.tamanho.subtitulo` | 15 | título de seção, título de cartão | semibold |
| `fonte.tamanho.titulo` | 17 | título de janela/diálogo | negrito |
| `fonte.tamanho.titulo-grande` | 22 | título de página, número de destaque | negrito |
| `fonte.tamanho.destaque` | 28 | cronômetro secundário, cartão de resumo | negrito / mono |
| `fonte.tamanho.display-p` | 34 | título de seção do site, placar | Anton |
| `fonte.tamanho.display-g` | 48 | hero do site (na web: `clamp()` fluido) | Anton |

**Nada abaixo de 11 px** em tela de operação e **nada abaixo de 12 px** na web pública. Tamanhos fora da escala
(9,4F, 8,8F, 10,1F… — existem 60 combinações hoje) são defeito a migrar.

## Hierarquia de uma tela (sempre nesta ordem)

1. Título da janela/página — `titulo` (17) ou `titulo-grande` (22), negrito.
2. Subtítulo/contexto — `pequeno` (12), `cor.texto.secundario`.
3. Título de seção/cartão — `subtitulo` (15), semibold.
4. Rótulo de campo — `legenda`/`pequeno`, semibold, `cor.texto.secundario`, **acima** do campo.
5. Conteúdo/campo — `corpo` (13).
6. Ajuda/nota — `pequeno` (12), `cor.texto.secundario`.

## Altura de linha

`fonte.altura-linha.titulo` 1,1 (nunca abaixo de 1: acentos encavalam) · `corpo` 1,45 · `leitura` 1,55.
Títulos com `text-wrap: balance`; nunca `overflow-wrap: anywhere`.

## Números

Tempos sempre em fonte numérica, alinhados à direita, com casas fixas (`1:02.470`, `55.214`). Valores em R$ com 2
casas, alinhados à direita. Não misture fonte proporcional e numérica na mesma coluna.
