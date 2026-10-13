# Auditoria de UX/UI — processo

## 1. Escopo
Defina o app, as abas e as telas (use [rotas](../07-arquitetura/rotas.md)) e quem usa cada uma.

## 2. Captura
Fotos de todas as telas nas 5 resoluções + degradado ([aceite-de-tela](aceite-de-tela.md)) e, na web, 3 larguras.
Inclua estados (vazio, erro, carregando) e diálogos.

## 3. Avaliação (por tela)
- **Heurísticas de Nielsen** — [00-fundacao/heuristicas-nielsen.md](../00-fundacao/heuristicas-nielsen.md).
- **Padrão visual** — tokens, componentes, grade de 8, tema certo (`npm run lint:design:relatorio`).
- **Acessibilidade** — contraste, teclado, só-cor, nomes ([roteiro](../01-fundamentos/acessibilidade.md)).
- **Responsividade** — corte, sobreposição, rolagem.
- **Texto** — glossário, mensagens de erro, botões.
- **Fluxo** — passos desnecessários, becos sem saída, confirmações faltando.

## 4. Registro de achados
| Id | App / tela | Achado | Heurística / regra | Severidade | Evidência | Impacto | Esforço |
|---|---|---|---|---|---|---|---|
| A01 | Recepção / Checkout | Troco em verde sobre verde-escuro escrito no código | Padrão / contraste | 2 | foto 1280 | médio | baixo |

**Severidade (Nielsen):** 0 não é problema · 1 cosmético · 2 menor · 3 grave (atrapalha a tarefa) · 4 catástrofe
(impede, perde dado ou dinheiro, afeta corrida ao vivo).

## 5. Matriz impacto × esforço
**Impacto** = severidade × frequência de uso da tela × quantas pessoas. **Esforço** = horas + risco (tela ao vivo pesa mais).

```
            esforço baixo            esforço alto
impacto   ┌────────────────────────┬────────────────────────┐
 alto     │  FAZER JÁ              │  PLANEJAR              │
          │  (próxima versão)      │  (fase da migração)    │
          ├────────────────────────┼────────────────────────┤
impacto   │  ENCAIXAR              │  DESCARTAR / ADIAR     │
 baixo    │  (junto com outra tela)│  (registrar e esquecer)│
          └────────────────────────┴────────────────────────┘
```

## 6. Plano
Lista ordenada (Fazer já → Planejar → Encaixar), cada item com tela, achado, correção e critério de aceite.
Severidade 4 vira correção imediata, fora da fila.

## 7. Repetir
Auditoria completa a cada fase de migração concluída e sempre que um app ganha tela nova. Resultado vai para
`10-inventario/` com a data.
