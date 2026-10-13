# Cartão

**Status:** canônico · **Tema:** ambos

## Para que serve
Agrupar conteúdo relacionado sobre `cor.fundo.app`. É o bloco básico de toda tela de operação.

## Anatomia
```
┌──────────────────────────────────────────────┐  raio.cartao 14 · superficie.padrao · elevacao.1 ou borda sutil
│ Título do cartão              [ação P] [⋯]   │  cabeçalho: subtitulo 15 semibold, padding 16–24
│ subtítulo/contexto                           │
├──────────────────────────────────────────────┤  divisória opcional
│ Corpo (campos, tabela, números)              │  padding espaco.3 (24) ou 2 (16) no compacto
├──────────────────────────────────────────────┤
│ rodapé: totais / ações          [Secundário] │  opcional
└──────────────────────────────────────────────┘
```

## Variantes
| Variante | Uso |
|---|---|
| **Padrão** | seções de tela |
| **Resumo (indicador)** | número grande (`fonte.tamanho.destaque`, numérico) + rótulo + variação; dashboards |
| **Selecionável** | escolha entre opções grandes (tipo de bateria, forma de pagamento): borda 2 px `acao.principal` quando escolhido + ✓ |
| **Inverso** | painel escuro dentro da operação (cronômetro): `cor.superficie.inversa` |
| **Pôster (site)** | `PosterCard`, `GlassPanel` — tema escuro |

## Estados
Normal · hover (só se clicável: `elevacao.2`) · selecionado · foco · desabilitado · carregando (esqueleto) · vazio · erro.

## Comportamento
Cartão **não é clicável por padrão**. Se for (selecionável/navegável), a área inteira é o alvo, com cursor de mão,
hover, foco e Enter/Espaço.

## Regras
- Não aninhar cartão em cartão; dentro de um cartão use seções com título e espaço.
- Cartões lado a lado têm a mesma altura na linha.
- Barra de ações do cabeçalho **quebra de linha** se faltar espaço (o cabeçalho cresce).

## Implementação
| Plataforma | Onde |
|---|---|
| WinForms | `PainelArredondado` (Crono), `Forma.AplicarRaio` em `Panel`; `DialogoDesign.Secao(...)` dentro de diálogos |
| Web | `GlassPanel`, `PosterCard` (site); admin `.panel` |
| timing-ui | `.panel` |
| Android | `Card` |
| Totem | `Cartao` — travado |
