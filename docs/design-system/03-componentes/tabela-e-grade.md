# Tabela e grade

**Status:** canônico (consolidação na fase 1) · **Tema:** ambos

## Quando usar
Dados com várias colunas comparáveis (clientes, vendas, voltas, karts). Para itens com 1–2 informações use [lista](lista.md);
em celular, a tabela vira lista de cartões.

## Anatomia
```
┌──────────────────────────────────────────────────────────────────┐
│ ☐ │ Nome ▲          │ CPF           │   Saldo ▾  │ Situação  │ ⋯ │  cabeçalho 32 px, superficie.suave,
├───┼─────────────────┼───────────────┼────────────┼───────────┼───┤  legenda 11 semibold MAIÚSC. ou caixa
│ ☐ │ João Silva      │ 123.456.789-00│   R$ 80,00 │ (● Ativo) │ ⋯ │  linha 32 px, corpo 13
│ ☐ │ Maria Souza     │ …             │   R$ 0,00  │ (○ Inat.) │ ⋯ │  divisória cor.borda.sutil
└──────────────────────────────────────────────────────────────────┘
  37 clientes · página 1 de 3                         ‹  1  2  3  ›
```
Container em [cartão](cartao.md) (`raio.cartao`), sem borda dupla. Texto à esquerda, números à direita, status com
[selo](selo-e-pilula.md), ações por linha no fim (`⋯` ou ícones com dica).

## Variantes
| Variante | Uso | Implementação |
|---|---|---|
| **Padrão** | cadastros, relatórios na tela | `TabelaDesign` |
| **Densa** | muitos dados (financeiro) | `Grade` com `componente.tabela.linha-altura` 32 |
| **Ao vivo** | corrida (atualiza a cada passagem) | `LiveGrid` — especializada; ver [tela-ao-vivo](../04-padroes-de-tela/tela-ao-vivo.md) |
| **Editável** | metas, redutores, equalização | célula vira campo no duplo clique/F2 |

## Estados
| Estado | Aparência |
|---|---|
| Linha hover | fundo `superficie.suave` |
| Linha selecionada | `cor.selecao.fundo` + `cor.selecao.texto` |
| Linha com foco (teclado) | anel interno 2 px |
| Linha de alerta | selo de estado + texto (nunca só a cor da linha) |
| Carregando | 5 linhas-esqueleto; cabeçalho visível |
| Vazia | [estado vazio](estado-vazio.md) dentro do cartão, cabeçalho visível |
| Erro | mensagem + "Tentar de novo" no lugar das linhas |

## Comportamento
| Gatilho | Interface | Efeito |
|---|---|---|
| Clique na linha | seleciona | habilita ações da barra |
| Duplo clique / Enter | abre o detalhe/edição (diálogo) | — |
| Clique no título | ordena ▲, de novo ▼; terceira volta à ordem padrão | — |
| Clique no funil | abre filtro da coluna | — |
| Ctrl/Shift+clique | seleção múltipla (quando a tela permite ação em lote) | — |
| ↑ ↓ PgUp PgDn Home End | move a seleção; rolagem acompanha | — |
| Delete | igual ao botão Excluir (abre confirmação) | — |
| Clique direito | menu com as mesmas ações da barra (atalho, nunca a única forma) | — |
| Arrastar borda do título | redimensiona a coluna; largura lembrada | — |

## Regras
- Colunas com largura proporcional; coluna principal (nome) absorve o espaço que sobra.
- Texto longo corta com "…" e mostra completo na dica; **números nunca cortam** (coluna cresce).
- Mais de 50 linhas → paginação ou rolagem virtual; total sempre visível.
- Cabeçalho fixo ao rolar. Rolagem horizontal **dentro** do cartão, nunca na janela.
- Valores: `R$ 1.234,56`, datas `12/10/2026`, tempos `1:02.470` em fonte numérica.
- **Atualização automática (sincronização, polling) nunca atrapalha quem está usando** (Recepção 1.0.52, `Grade`):
  - mesma lista = **não refaz as colunas** — filtros do funil, ordenação e larguras ajustadas ficam;
  - dados iguais = **não redesenha** (nada pisca);
  - dados mudaram = troca as linhas **sem voltar ao topo**, mantendo a linha atual e a seleção;
  - a lista atual fica na tela até os dados novos chegarem (sem "Carregando…" por cima, sem ponteiro de espera).
- Filtros só são limpos quando a pessoa **troca de lista** (menu/árvore), nunca por recarga.

## Implementação
| Plataforma | Hoje | Destino |
|---|---|---|
| WinForms | 4 grades: `TabelaDesign`, `Grade` (+`GradeSelectionHeaderCell`), `LiveGrid` (Crono), `DataGridView` cru em telas antigas | `TabelaDesign` base (fase 1); `LiveGrid` fica, herdando tokens |
| Web admin | `.table-wrap` | componente `Tabela` com `--kib-*` |
| timing-ui | `.rdlc-table` (resultado), tabelas de `equalizacao.html` | `--kib-*` (fase 5) |
| Android | `LazyColumn` | — |
