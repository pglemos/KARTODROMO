# Elevação, sombras e camadas

| Token | Claro | Escuro | Uso |
|---|---|---|---|
| `elevacao.1` | `0 1px 2px` preto 6% | `0 2px 6px` preto 40% | cartão em repouso |
| `elevacao.2` | `0 12px 32px` 8% | `0 22px 55px` 60% | menu, popover, lista suspensa, cartão destacado |
| `elevacao.3` | `0 24px 64px` 20% | `0 30px 90px` 55% | modal / diálogo |

No WinForms, `Tokens.Claro.Elevacao2` é um `Sombra` (deslocamento, desfoque, espalhamento, cor) para desenhar com
GDI+; na web, `box-shadow: var(--kib-elevacao-2)`.

## Camadas (ordem de empilhamento)

| Camada | z-index web | O que fica nela |
|---|---|---|
| Base | 0 | página, cartões |
| Fixos | 10 | cabeçalho, rodapé de status, sidebar |
| Suspenso | 100 | menu, lista suspensa, dica (tooltip), popover |
| Véu | 900 | `cor.sobreposicao` atrás do modal |
| Modal | 1000 | diálogo, confirmação |
| Aviso | 1100 | toast, banner de conexão perdida |

## Estilo 3D

**Não há componentes 3D** (sem modelos, sem perspectiva girando, sem relevo/chanfro de botão, sem sombra interna).
O "volume" do sistema vem de três recursos, nesta ordem:

1. **Camadas de superfície**: fundo → cartão em repouso (`elevacao.1`) → menu/cartão destacado (`elevacao.2`) → modal (`elevacao.3`).
2. **Sombra suave** só em cartão, menu e janela flutuante, nunca em texto, campo ou tabela.
3. **Ícone em quadradinho com degradê** (ver [cor.md › Degradês aprovados](cor.md#degradês-aprovados)) — o máximo de
   "relevo" permitido.

No público (site, TV), profundidade vem de foto da pista com camada escura por cima e de brilho neon discreto — não de
sombra. Uma exceção 3D (ex.: kart girando no site) só entra com protótipo, teste de desempenho no celular e
`prefers-reduced-motion` desligando o movimento, aprovado pelo dono.

## Regras

- Elevação comunica **camada**, não importância. Um botão importante não ganha sombra; ganha a cor de ação.
- Só um modal por vez. Se uma confirmação precisa abrir sobre um diálogo, ela é a camada Modal e o diálogo vira fundo
  (com véu).
- No escuro, a sombra quase não aparece: diferencie camadas também pela superfície (`superficie.padrao` sobre
  `fundo.app`) e por borda sutil.
- **Sem 3D, sem brilho, sem relevo** em controles (decisão da [identidade visual](../00-fundacao/identidade-visual.md)).
