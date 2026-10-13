# Lista

**Status:** canônico · **Tema:** ambos

## Quando usar
Itens com 1 informação principal + 1–2 secundárias: pilotos de uma bateria, baterias do dia, participantes, menus.
Para comparar colunas use [tabela](tabela-e-grade.md).

## Anatomia
```
┌────────────────────────────────────────────┐
│ [ícone/avatar 32]  Nome principal     [selo] │  item 48 px (2 linhas) ou 36 px (1 linha)
│                    detalhe secundário   ›  │  divisória cor.borda.sutil
└────────────────────────────────────────────┘
```
Título `fonte.tamanho.corpo` semibold; detalhe `pequeno` `cor.texto.secundario`; `›` só se abre algo.

## Estados
Normal · hover · selecionado (`cor.selecao.*`, barra 3 px à esquerda opcional) · foco · desabilitado · arrastando
(sombra `elevacao.2`) · vazia ([estado vazio](estado-vazio.md)) · carregando (itens-esqueleto).

## Comportamento
| Gatilho | Interface | Efeito |
|---|---|---|
| Clique | seleciona (e mostra detalhe ao lado, se houver painel) | — |
| Duplo clique / Enter | abre/edita | — |
| ↑ ↓ | navega | — |
| Arrastar (quando reordenável) | item segue o ponteiro; linha-guia mostra o destino | grava a nova ordem ao soltar |
| Delete | excluir com confirmação | — |

## Implementação
| Plataforma | Onde |
|---|---|
| WinForms | `ListBox` desenhado / `ListaDesign`; árvore lateral `ArvoreSemRolagemLateral` (Crono); `FormListaParticipantes` (Recepção) |
| Web | `<ul role="list">` |
| timing-ui | `.list`/`.row` (operador.html) |
| Android | `LazyColumn` + `ListItem` |
