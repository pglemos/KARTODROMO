# BRIEFING — 2026-10-26T19:43:00Z

## Mission
Implementar a Milestone M2 (Servidor Backend Operacional): fila de impressão relacional no SQL Server, segurança PII no totem, bloqueio de baterias vencidas, correção de estorno de vouchers, regras de cadastro flexíveis, parametrização SQL e estabilidade de runtime com testes 100% passando.

## 🔒 My Identity
- Archetype: worker
- Roles: implementer, qa, specialist
- Working directory: /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/worker_m2_1
- Original parent: 5c17e886-4fbe-41e6-80a1-62db6f4ee87a
- Milestone: M2 - Backend Operacional

## 🔒 Key Constraints
- Não quebrar contratos de API existentes (desktop, totem, recepção).
- Não hardcodear testes ou falsificar resultados.
- Responder sempre em pt-BR.
- Respeitar estritamente o Write Ownership:
  - `services/ops-server.ts`
  - `lib/ops/termo.ts`
  - `lib/ops/totem-baterias.ts`
  - `lib/ops/office.ts`
  - `lib/ops/db.ts`
  - `lib/ops/instagram.ts`
  - `lib/ops/cadastro-obrigatorio.ts`
  - `tests/ops/` (testes relacionados)

## Current Parent
- Conversation ID: 5c17e886-4fbe-41e6-80a1-62db6f4ee87a
- Updated: 2026-10-26T19:43:00Z

## Task Summary
- **What to build**:
  1. Fila de impressão persistente em `dbo.FilaImpressao` via `services/ops-server.ts`.
  2. Ajuste de CSS em `lib/ops/termo.ts` para evitar desperdício de bobina térmica.
  3. Mascaramento de PII em `POST /api/totem/identificar` e proteção a dependentes.
  4. Preservação de campos `Numero` e `Complemento` no totem.
  5. Bloqueio estrito de baterias vencidas em `lib/ops/office.ts` e `lib/ops/totem-baterias.ts`.
  6. Parametrização SQL segura na busca de baterias em `services/ops-server.ts`.
  7. Estorno cirúrgico de vouchers por item em `lib/ops/office.ts`.
  8. Instagram opcional e validação de peso [15, 250] kg.
  9. Otimização de busca em `/api/crono/uso-karts`.
  10. Captura de erros não tratados e reconexão/listener no pool MSSQL.
- **Success criteria**: Todos os testes em `tests/ops/` e `tests/e2e-recepcao/` executam e passam com 100% de sucesso.
- **Interface contracts**: `.agents/teamwork/orchestrator_1/PROJECT.md`
- **Code layout**: Raiz do repositório (`services/`, `lib/ops/`, `tests/ops/`)

## Key Decisions Made
- [TBD após leitura dos documentos obrigatórios]

## Change Tracker
- **Files modified**: [Nenhum ainda]
- **Build status**: Pendente
- **Pending issues**: Nenhum

## Quality Status
- **Build/test result**: Pendente
- **Lint status**: Pendente
- **Tests added/modified**: Pendente

## Loaded Skills
- Nenhuma skill externa carregada diretamente.

## Artifact Index
- `.agents/teamwork/worker_m2_1/DISPATCH.md` — Despacho do orquestrador
- `.agents/teamwork/worker_m2_1/BRIEFING.md` — Memória persistente do worker
- `.agents/teamwork/worker_m2_1/progress.md` — Heartbeat de progresso
- `.agents/teamwork/worker_m2_1/handoff.md` — Relatório de handoff final
