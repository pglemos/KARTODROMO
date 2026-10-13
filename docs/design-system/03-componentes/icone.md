# Ícone

**Status:** canônico · **Tema:** ambos

Regras completas (família, dicionário de conceitos, tamanhos): [01-fundamentos/iconografia.md](../01-fundamentos/iconografia.md).

## Variantes do componente
| Variante | Uso | Tamanho |
|---|---|---|
| **Inline** | dentro de botão, campo, selo, item de menu | 16 / 20 |
| **Botão só-ícone** | ação universal com dica obrigatória | ícone 16–20, alvo 32–40 (44 no toque) |
| **Quadradinho** | identidade da janela/área (cabeçalho) | 32 / 36 |
| **Estado vazio** | ilustração mínima | 48 |
| **Indicador** | bolinha de conexão/status com texto | 8–10 |

## Estados (quando é botão)
Normal `cor.texto.secundario` · hover `cor.texto.principal` + fundo `superficie.campo` · foco (anel) · ativo
`cor.acao.principal` · desabilitado `cor.texto.desabilitado`.

## Acessibilidade
Decorativo: oculto do leitor de tela (`aria-hidden`, `AccessibleRole = None`). Informativo/botão: nome acessível
obrigatório. Contraste do ícone informativo ≥ 3:1.

## Implementação
| Plataforma | Hoje | Destino |
|---|---|---|
| WinForms | `Icone.Tile` (glifo MDL2), `VisualPrincipal.Icone` (PNG 2×), `Forma.Icone`/`Forma.Tile(svg, cor)`, `CartaoModal.Icone`. **Traço Lucide pronto**: `Forma.DesenharSvg(g, IconesLucide.Lixeira, área, cor)` e `Botao.Svg` | `Icone.Tile` sai nas fases 2–3 |
| Web | `lucide-react` | mantém |
| timing-ui | `.tool-icon` (SVG inline) | SVG Lucide inline |
| Android | Material Icons | Lucide via vetor (fase 7) |
| Totem | `IconeSucesso` — travado |
