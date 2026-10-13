# Totem de autoatendimento

App nativo `desktop/src/Kartodromo.Autoatendimento` (`FormTotem`, `Controles`, `Estilo`). **Visual aprovado — não
refazer.** Fluxo: [04-padroes-de-tela/fluxo-totem.md](../04-padroes-de-tela/fluxo-totem.md).

| Regra | Valor |
|---|---|
| Tema | escuro (fundo `#030504`, ação `#00E676`) — `componente.totem.*` |
| Alvo de toque | ≥ 64 px (`componente.totem.alvo-toque`) |
| Entrada | teclado USB; **nunca** teclado virtual |
| Inatividade | 90 s → volta ao início e limpa |
| Resolução | testada em 1366×768 e 1920×1080 (fotos do autoteste) |

## Migração (fase 6)
Trocar as cores/fontes escritas em `Estilo` e `Controles` por `Tokens.Escuro.*`/`componente.totem.*` **com os mesmos
valores**; aceitar só se as fotos antes/depois forem idênticas.
