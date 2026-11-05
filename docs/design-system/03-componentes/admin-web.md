# Admin web (workers/admin) — componentes e regras

Fonte única: `tokens/kib.tokens.json` → `workers/admin/public/tokens.css` (`npm run tokens`). Tema `claro`
(`<html data-tema="claro">`). Componentes em `workers/admin/public/componentes.css`; base em `app.css`.

**Regra de ouro:** tela nova usa só `var(--kib-…)` e as classes abaixo. Nada de hex, `rgb()`, `px` de fonte ou
espaço fora da grade de 8 (o `npm run lint:design` falha). Se faltar um valor, crie o token e rode `npm run tokens`.

| Peça | Classes | Medidas (tokens) |
|---|---|---|
| Botão | `.btn` + `prim`/`sec`/`branco`/`escuro`/`perigo`/`aviso`/`verdeClaro`/`link`/`icone` | altura 40 (`.peq` 32, `.g` 48) |
| Campo | `.entrada` (`.peq`), `.campo`, `aria-invalid="true"` | altura 40 / 32 |
| Selo | `.chip` + `verde`/`laranja`/`vermelho`/`azul`/`cinza`, `.pill`, `.solido-ok` | sinal ✓ ! ✕ i junto da cor |
| Avatar | `.avatar` + `p` 28 / `m` 32 / `g` 40 / `xg` 64 | texto branco só sobre cores ≥ 4,5:1 |
| Cartão | `.cartao`, `.cartaoCab`, `.cartao-corpo`, `.cartao-rodape` | raio `cartao`, sombra `elevacao` |
| Estados | `.vazio`, `.vazio.erro`, `.esqueleto`, `.aviso-faixa` | mesmo desenho em todas as telas |
| Texto | `.t-titulo-grande` 22 · `.t-titulo` 17 · `.t-subtitulo` 15 · `.t-corpo` 13 · `.t-pequeno` 12 · `.t-rotulo` | escala `fonte.tamanho` |
| Layout | `.linha`, `.linha-quebra`, `.gap-meio/1/12`, `.empurra`, `.cresce`, `.pad-2` | espaço 4/8/12/16/24… |

## Acessibilidade
- Contraste mínimo 4,5:1 (texto até 17px e negrito < 14px) e 3:1 acima disso. Texto de apoio = `texto-apoio`; rótulos e
  cabeçalhos = `texto-discreto`; ambos ≥ 4,5:1 sobre `superficie-lateral`. Nunca use `icone-suave` ou `borda-campo` como cor de texto.
- A cor nunca vem sozinha: selos mostram ✓ ! ✕ i; tipos de bateria têm nome e legenda; indicadores têm texto.
- Alvo de toque: no celular botões ≥ 40px. Foco visível em tudo (`borda-foco`, 2px).
- Conferência: no navegador, percorrer as telas e medir o contraste de cada texto (script usado em 03/11/2026: 0 falhas
  fora texto desabilitado e blocos com degradê, que têm só ícone ou nome ao lado).
