# Raio de borda e formas

| Token | Claro | Escuro | Onde |
|---|---|---|---|
| `raio.chip` | 6 | 3 | selo, chip de filtro, etiqueta de tipo |
| `raio.campo` | 9 | 8 | campo de texto, lista, data, busca |
| `raio.botao` | 10 | 8 | botão (P/M/G), segmentado |
| `raio.cartao` | 14 | 14 | cartão, painel, tabela em cartão |
| `raio.janela` | 18 | 16 | diálogo, modal, janela sem borda (CartaoModal) |
| `raio.pilula` | 999 | 999 | botão pílula do totem, contador redondo, bolinha |

## Regras

- **Raio interno = raio externo − padding**: um botão dentro de um cartão de raio 14 com padding 4 usa raio 10.
- O raio cresce com o tamanho do objeto: selo < campo < botão < cartão < janela.
- Site público: botão principal **chanfrado** (clip-path em polígono) — é a forma da marca no escuro; não usar
  chanfro nos apps de operação.
- WinForms: aplicar com `Forma.AplicarRaio(controle, Tokens.Claro.RaioBotao)` (acompanha mudança de tamanho);
  desenhar com `Forma.Redondo(retangulo, raio)`.
- Raios hoje fora da escala (4, 7, 11, 12, 13, 16 espalhados no código) são defeito a migrar.

## Proporções

Ícone em quadradinho 1:1 (32 px no cabeçalho de janela, 36 px no cabeçalho de diálogo); logo nunca deformada;
fotos do site 16:9 (hero) e 4:3 (cartão).
