# Bordas e divisórias

| Token | Valor | Uso |
|---|---|---|
| `borda-largura.padrao` | 1 px | borda de cartão, campo, tabela, divisória |
| `borda-largura.foco` | 2 px | anel de foco e campo focado |
| `cor.borda.sutil` | `#E5E5EA` / branco 10% | divisória, borda de cartão, linha de tabela |
| `cor.borda.campo` | `#DBDBDB` ⚠ / `#6B786E` | campo sem foco |
| `cor.borda.foco` | ação principal | campo focado e anel de foco |
| `cor.estado.perigo.solido` | — | campo com erro (sempre junto da mensagem) |

## Regras

1. **Separe por espaço antes de separar por linha.** Divisória só quando o espaço não basta (linhas de tabela,
   itens de menu, cabeçalho ↔ corpo de diálogo).
2. Cartão no claro: borda sutil 1 px **ou** elevação 1 — não os dois fortes ao mesmo tempo.
3. Campo: 1 px `cor.borda.campo` → focado 2 px `cor.borda.foco` → erro 2 px `perigo` (a mudança de largura avisa
   quem não distingue cor).
4. Nada de borda dupla (cartão com borda dentro de painel com borda), borda tracejada ou borda colorida decorativa.
5. Linha selecionada de tabela: fundo `cor.selecao.fundo`, sem borda extra. Barra lateral de 3–4 px na cor do estado
   é permitida só para indicar o item ativo da sidebar.
