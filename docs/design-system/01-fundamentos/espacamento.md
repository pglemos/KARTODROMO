# Espaçamento — grade de 8 pontos

Todo espaço (margem, padding, gap, distância entre blocos) é **múltiplo de 8**. O **4** é meio passo, para
distâncias mínimas (ícone ↔ texto, rótulo ↔ campo). A maioria das resoluções é divisível por 8, então a grade alinha
com a tela.

| Token | px | Uso típico |
|---|---|---|
| `espaco.0` | 0 | sem espaço |
| `espaco.meio` | 4 | ícone ↔ texto; rótulo ↔ campo |
| `espaco.1` | 8 | entre botões vizinhos; padding interno de selo |
| `espaco.2` | 16 | padding de cartão compacto; entre campos; margem lateral no celular |
| `espaco.3` | 24 | padding de cartão/diálogo; entre seções; margem da tela no desktop |
| `espaco.4` | 32 | entre blocos grandes |
| `espaco.5` | 40 | — |
| `espaco.6` | 48 | separação de seções no site |
| `espaco.8` | 64 | seção do site público |
| `espaco.denso-12` | 12 | **só operação densa**: barra de ferramentas, célula de tabela |
| `espaco.denso-20` | 20 | **só operação densa** |

## Regras

1. **Proximidade = relação.** Itens relacionados ficam mais perto entre si do que de itens não relacionados
   (rótulo a 4 do campo; campos a 16 entre si; seções a 24).
2. **Padding interno ≥ espaço externo** do mesmo bloco não faz sentido: o cartão respira por dentro (24) e se separa
   dos vizinhos por 16–24.
3. Margem lateral da tela: **24** no desktop (≥ 1280), **16** no tablet/celular.
4. Altura de controles: múltiplos de 8 (32 / 40 / 48) — ver [03-componentes/botao.md](../03-componentes/botao.md).
5. Nos apps nativos, os nomes antigos `Tokens.Espaco1..6` (4, 8, 12, 16, 20, 24) **não** seguem os nomes novos:
   `Espaco3` antigo = 12, `espaco.3` novo = 24. Na migração, troque pelo token semântico.
