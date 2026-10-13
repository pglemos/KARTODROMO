# Telão e placar (CONGELADO)

**Não altere** estas telas sem pedido explícito do dono. Este documento só registra o que existe.

| Tela | Arquivo | Onde roda |
|---|---|---|
| TV da cronometragem | `desktop/src/Kartodromo.Cronometragem/FormTV.cs` (F11 / Shift+F8–F10) | monitor da sala |
| ~~Placar TV (web)~~ | `services/timing-ui/tv.html` — **refeita em 08/10/2026 a pedido do dono** (não está mais congelada): tema escuro dos tokens, linhas em cartões que DESLIZAM na ultrapassagem (▲/▼), varredura neon quando o kart passa, cartão "nova melhor volta" sobre o título, barra de tempo, cabeçalho amarelo/vermelho na bandeira, todas as linhas cabem (ou páginas de 8 s), relógio com "ÚLTIMA VOLTA", pódio, DC/penalidade, reduzir movimento respeitado | navegador da sala |
| Placar TB50 (LED grande) | `services/timing-ui/tb50.html` | PC .250, lê o `:4050` do ORBITS |
| Rotas do site | `app/telao`, `app/placar-telao*`, `app/podio-*-tb50`, `app/designer-telao` | telão público |

## Características (para não quebrar por acidente)
- Paleta própria (teal/amarelo), fontes grandes, alto contraste para leitura a distância.
- Bandeira verde zera o placar; pódio aparece ao fim da bateria.
- **Não importa** `tokens.css` (teste automático garante) e é contado mas nunca reprovado pelo `lint:design`
  (grupo congelado).

Se um dia for migrado, vira uma fase própria com fotos lado a lado aprovadas pelo dono.
