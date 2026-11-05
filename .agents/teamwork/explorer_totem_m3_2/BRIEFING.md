# BRIEFING — 2026-10-27T03:09:00Z

## Mission
Exploração técnica detalhada de backend e banco de dados para Milestone M3 (R3: Validação de Dados e Cadastro no Totem - Itens 12 a 19).

## 🔒 My Identity
- Archetype: teamwork_preview_explorer
- Roles: Explorer / Investigator
- Working directory: /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/explorer_totem_m3_2
- Original parent: ede11c99-3091-44f8-9d3a-86b33770efcd
- Milestone: M3 (R3: Validação de Dados e Cadastro no Totem - Itens 12 a 19)

## 🔒 Key Constraints
- Read-only investigation — do NOT implement / do NOT modify source code
- Responder sempre em pt-BR
- Produzir relatório handoff.md estruturado com 5 componentes (Observation, Logic Chain, Caveats, Conclusion, Verification Method)
- Notificar parent via send_message

## Current Parent
- Conversation ID: ede11c99-3091-44f8-9d3a-86b33770efcd
- Updated: 2026-10-27T03:00:00Z

## Investigation State
- **Explored paths**:
  - `services/ops-server.ts` (rotas `/api/totem/cadastro`, `/api/totem/baterias`, `/api/totem/identificar`, error handling)
  - `lib/ops/cadastro-obrigatorio.ts` (`erroPesoCliente`, `erroCadastroObrigatorio`)
  - `lib/ops/instagram.ts` (`normalizarInstagram`, `erroInstagramCliente`)
  - `lib/ops/totem-baterias.ts` (`TOTEM_BATERIAS_SQL`, `bateriaDisponivelNoTotem`)
  - `lib/ops/db.ts` (`clienteColumns`, `insertCliente`, `updateCliente`, `onlyDigits`, `isValidCpf`)
  - `desktop/src/Kartodromo.Autoatendimento/FormTotem.cs`
  - `desktop/src/Kartodromo.Comum/ValidacaoCliente.cs`
  - `desktop/src/Kartodromo.Comum/Fmt.cs`
  - `tests/ops/*`
- **Key findings**:
  - Item 12: `erroInstagramCliente` aceita string vazia/null, mas `semInstagram` não está em `ClienteInput` nem em `clienteColumns` de `lib/ops/db.ts`. Em updates parciais (`partial = true`), valor vazio é ignorado e não limpa o Instagram no banco.
  - Item 13: `ops-server.ts:595` exige `onlyDigits(telefone).length >= 10`. Bloqueia turistas internacionais com números de 7 a 9 dígitos. Além disso, não há validação de telefone em updates de clientes existentes.
  - Item 14: `erroPesoCliente` valida 10 a 250 kg universalmente, enquanto `FormTotem.cs:539` tem validação inline rígida de 20 a 250 kg para adultos e 10 a 250 kg para menores (linha 750). Necessário harmonizar aceitando `isMenor` opcional.
  - Item 15: O antigo bug que executava `UPDATE dbo.Cliente SET Numero = NULL, Complemento = NULL` foi removido. Em `updateCliente` com `partial = true`, `Numero` e `Complemento` são preservados quando omitidos.
  - Item 17: No conflito de documento (409), `ops-server.ts:597` apenas lança `HttpError(409)` sem retornar `id` e `token`. O contrato de `PROJECT_TOTEM.md` exige `{ error: "documento_cadastrado", id, token }`.
  - Item 19: Consulta de grupos em `/api/totem/baterias` já está parametrizada com `@bat_N` e `@grp_N`, eliminando interpolação de strings.
- **Unexplored areas**: Nenhuma no escopo do backend M3.

## Key Decisions Made
- Estruturar `handoff.md` com detalhes exatos para orientar a implementação do Worker M3 e a criação da suíte `tests/ops/m3-totem-validacao.test.ts`.

## Artifact Index
- DISPATCH.md — Mensagem recebida do orchestrator
- BRIEFING.md — Memória de trabalho do subagente
- progress.md — Heartbeat de progresso
- handoff.md — Relatório final para o orchestrator / worker
