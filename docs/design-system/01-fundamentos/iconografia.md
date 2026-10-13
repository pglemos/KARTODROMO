# Iconografia

## Família única

**Traço (outline), cantos arredondados, traço 1,75–2 px a 24 px**, estilo [Lucide](https://lucide.dev) — já é a
biblioteca da web (`lucide-react`). Os ícones dos apps nativos são **PNG em 2× gerados do SVG aprovado** e embutidos
como recurso. Um conceito = um ícone em todo o sistema (tabela abaixo).

| Hoje (três jeitos) | Destino |
|---|---|
| `Ui.cs → Icone.Tile(glifo MDL2, cor)` — glifo da fonte Segoe MDL2 sobre quadrado com degradê | **legado**; substituir por PNG do SVG na fase 1 |
| `Recepcao/VisualPrincipal.Icone(nome)` — PNG 2× embutido em `Icones\` | **padrão**; sobe para `Kartodromo.Comum` (`Forma.Icone(nome)`) |
| `Design.Icone(nome)` delegando para o app | ponto de entrada único depois da fase 1 |
| Web: `lucide-react` | **padrão** |
| Emoji/caracteres (■ ↻ ✉ ✓) em botão | proibido em tela nova (só ✕ do fechar até a fase 1) |

## Tamanhos

| Contexto | Tamanho | Área clicável |
|---|---|---|
| Dentro de botão/campo | 16 | a do controle |
| Barra de ferramentas | 20–24 | 36–40 |
| Ícone em quadradinho (cabeçalho de janela) | 32 | — |
| Ícone em quadradinho (cabeçalho de diálogo) | 36 | — |
| Estado vazio | 48 | — |
| Totem / tablet | 32–40 | ≥ 64 / ≥ 48 |

## Ícone em quadradinho (a "arte" de cada tela)

Quadrado com raio ≈ 20% do lado, preenchimento na cor de domínio da área (com degradê suave — é o **único** lugar dos
apps de operação onde degradê é permitido), glifo branco centralizado. Identifica a janela/área (Clientes, Caixa,
Bateria). Não é botão.

## Dicionário (um conceito → um ícone Lucide)

| Conceito | Ícone | Conceito | Ícone |
|---|---|---|---|
| Adicionar / novo | `plus` | Excluir | `trash-2` |
| Editar | `pencil` | Salvar | `check` (rótulo "Salvar") |
| Buscar | `search` | Filtrar | `filter` (funil) |
| Fechar | `x` | Voltar | `chevron-left` |
| Imprimir | `printer` | Exportar PDF | `file-down` |
| Cliente/piloto | `user` | Grupo/equipe | `users` |
| Bateria/corrida | `flag` | Cronômetro/tempo | `timer` |
| Kart | `car-front` (provisório) | Caixa/pagamento | `wallet` |
| Pix | `qr-code` | Cartão | `credit-card` |
| Dinheiro | `banknote` | Agenda/reserva | `calendar` |
| Configurações | `settings` | Atualizar | `refresh-cw` |
| On-line | `wifi` | Off-line | `wifi-off` |
| Aviso | `triangle-alert` | Erro | `circle-x` |
| Sucesso | `circle-check` | Informação | `info` |
| E-mail | `mail` | WhatsApp | ícone oficial monocromático |

## Regras

1. Ícone sozinho (sem texto) **só** para ações universais (✕ fechar, lupa, lixeira em linha de tabela) e **sempre com
   dica** (tooltip) e nome acessível (`AccessibleName` / `aria-label`).
2. Ícone herda a cor do texto ao lado; ícone de estado usa `cor.estado.*.texto`.
3. Não misture ícone preenchido e de traço no mesmo grupo.
4. Ícone não substitui rótulo em ação destrutiva ou financeira (Estornar, Excluir, Cobrar sempre com texto).
