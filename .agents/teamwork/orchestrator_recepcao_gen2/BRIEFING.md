# BRIEFING — 2026-10-26T21:58:30Z

## Mission
Conduzir a orquestração a partir da Milestone M2 até a M6 para estabilização completa dos 36 problemas da recepção do Kartódromo de Betim, garantindo todos os critérios de aceitação e aprovação unânime nos Gates.

## 🔒 My Identity
- Archetype: orchestrator
- Roles: orchestrator, user_liaison, human_reporter, successor
- Working directory: /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/orchestrator_recepcao_gen2
- Original parent: parent
- Original parent conversation ID: 7590dcd7-8a53-4f05-a726-0d25bd6ce21f

## 🔒 My Workflow
- **Pattern**: Project
- **Scope document**: /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/orchestrator_recepcao_gen2/PROJECT.md
1. **Decompose**: Herdado da Survey do antecessor (36 itens catalogados em Feature Inventory). 6 Milestones definidas (M1 a M6) + Trilha Paralela E2E.
2. **Dispatch & Execute** (pick ONE):
   - **Direct (iteration loop)**: Para cada milestone: Explorer (se necessário) -> Worker -> Reviewers (2) + Challengers (2) -> Auditor (1) -> Gate.
3. **On failure** (in this order):
   - Retry: nudge stuck agent or re-send task
   - Replace: spawn fresh agent with partial progress
   - Skip: proceed without (only if non-critical)
   - Redistribute: split stuck agent's remaining work
   - Redesign: re-partition decomposition
   - Escalate: report to parent (sub-orchestrators only, last resort)
4. **Succession**: At 16 spawns, write handoff.md, cancel timers, spawn successor.
- **Work items**:
  1. Survey & Map 36 Items [done]
  2. Plan Milestones & PROJECT.md [done]
  3. Milestone M1: Banco de Dados & Migração 0011 [done - Gate PASS]
  4. Milestone M2: Servidor Backend Operacional [done - Gate PASS]
  5. Milestone M3: Desktop Comum & Periféricos [done - Gate PASS]
  6. Milestone M4: Desktop Recepção — Caixa & PDV [pending]
  7. Milestone M5: Desktop Recepção — Baterias, Clientes & UI [pending]
  8. Milestone M6: Validação Final E2E & Hardening [pending]
- **Current phase**: 2B (Execution Milestone M4)
- **Current focus**: Milestone M4 (Desktop Recepção — Caixa & PDV)

## 🔒 Key Constraints
- DISPATCH-ONLY: NEVER write, modify, or create source code files directly.
- NEVER run build/test commands yourself — require workers to do so.
- NEVER investigate or explore the problem at the code level — dispatch Explorers for technical investigation.
- You MAY use file-editing tools ONLY for metadata/state files (.md) in your .agents/teamwork/ folder.
- Always communicate with parent via send_message.
- pt-BR language.
- Do NOT touch FormTV (--tv).
- Keep native Windows apps (.NET 8 WinForms).
- Respect operating hours and clean test data.
- Hard audit veto: Forensic Auditor reporting INTEGRITY VIOLATION is an unconditional failure.
- Never reuse a subagent after it has delivered its handoff — always spawn fresh.

## Current Parent
- Conversation ID: 7590dcd7-8a53-4f05-a726-0d25bd6ce21f
- Updated: 2026-10-26T21:57:21Z

## Key Decisions Made
- Assumida a orquestração como Geração 2 (sucessor).
- Escopo herdado e validado de `orchestrator_1/PROJECT.md` e `ORIGINAL_REQUEST.md`.
- Milestone M1 concluída e aprovada.
- Milestone M2: despachar um Explorer ou Worker para verificar o estado atual das alterações em `services/ops-server.ts`, `lib/ops/termo.ts` etc., concluir a implementação se faltar algo, rodar testes de M2 e submeter ao Gate.

## Team Roster
| Agent | Type | Work Item | Status | Conv ID |
|-------|------|-----------|--------|---------|
| worker_m2_gen2 | teamwork_preview_worker | Milestone M2 Backend Operacional | completed | ee28ba38-76e4-4857-8e11-226fa5809216 |
| reviewer_m2_1 | teamwork_preview_reviewer | Revisão de Código e Testes M2 | completed (APPROVE) | da2cbb69-86ec-4c15-a340-30569e82fc41 |
| reviewer_m2_2 | teamwork_preview_reviewer | Revisão PII, SQL e Concorrência M2 | completed (APPROVE) | 02790fa1-1c8c-40f1-9d68-7ea73dd74d0d |
| challenger_m2_1 | teamwork_preview_challenger | Desafio Fila e Concorrência M2 | completed (APPROVE) | 3185ecba-a203-4fb0-bc35-b4d8d447cc24 |
| challenger_m2_2 | teamwork_preview_challenger | Desafio PII, Injeção SQL e Termos M2 | completed (APPROVE) | 8b925ca6-7c26-489c-b0b2-29c5bfcd1972 |
| auditor_m2_1 | teamwork_preview_auditor | Auditoria Forense de Integridade M2 | completed (CLEAN) | d2ef59bf-e95d-450d-9fb8-c7351e63c7eb |
| worker_m3_1 | teamwork_preview_worker | Milestone M3 Desktop Comum & Periféricos | completed | 9d092a75-1293-49df-8542-6e266202c684 |
| reviewer_m3_1 | teamwork_preview_reviewer | Revisão de Código e Testes M3 | completed (APPROVE) | 863bd76d-7c58-46f4-93b5-0f955d7c18d2 |
| reviewer_m3_2 | teamwork_preview_reviewer | Revisão Spooler, GDI e Rede M3 | completed (APPROVE) | 572c6aef-2059-4ff0-8794-04c43a0b7042 |
| challenger_m3_1 | teamwork_preview_challenger | Desafio Periféricos, Timeouts e GDI M3 | completed (APPROVE) | 6575ff75-439c-4c24-8cc9-f039e78150d1 |
| challenger_m3_2 | teamwork_preview_challenger | Desafio Cursor Jumping e Validações M3 | completed (APPROVE) | 05c151ce-edb2-4dda-9cac-467ac32e4f5a |
| auditor_m3_1 | teamwork_preview_auditor | Auditoria Forense de Integridade M3 | completed (CLEAN) | 7230464f-6887-4b3c-80e5-697cb64c4462 |
| worker_m4_1 | teamwork_preview_worker | Milestone M4 Desktop Caixa & PDV | completed | cd75efe5-7bb6-4ba2-ad94-9dec77213a3b |
| reviewer_m4_1 | teamwork_preview_reviewer | Revisão Caixa e PDV M4 | completed (APPROVE) | d543192a-8f47-4b35-92a6-902a24e22e7c |
| reviewer_m4_2 | teamwork_preview_reviewer | Revisão Sangria e Vouchers M4 | in-progress | 70da6ab8-4de8-4a59-9a08-2a3444376be3 |
| challenger_m4_1 | teamwork_preview_challenger | Desafio Troco e Vouchers M4 | in-progress | 4f42da9f-686b-48eb-aa2b-45b3fe20f9f9 |
| challenger_m4_2 | teamwork_preview_challenger | Desafio Sangria e Idempotência M4 | in-progress | a32f345f-59d8-4b9d-88c5-e101f3446fb5 |
| auditor_m4_1 | teamwork_preview_auditor | Auditoria Forense de Integridade M4 | completed (CLEAN) | f31a13ce-842d-47d7-964e-ee00d77bb630 |

## Succession Status
- Succession required: no
- Spawn count: 18 / 32
- Pending subagents: d543192a-8f47-4b35-92a6-902a24e22e7c, 70da6ab8-4de8-4a59-9a08-2a3444376be3, 4f42da9f-686b-48eb-aa2b-45b3fe20f9f9, a32f345f-59d8-4b9d-88c5-e101f3446fb5, f31a13ce-842d-47d7-964e-ee00d77bb630
- Predecessor: 7590dcd7-8a53-4f05-a726-0d25bd6ce21f (orchestrator_1)
- Successor: not needed

## Active Timers
- Heartbeat cron: 5717774c-5184-48e4-9f3d-92886d69aed2/task-297
- Safety timer: none
- On succession: kill all timers before spawning successor
- On context truncation: run manage_task(Action="list") — re-create if missing

## Artifact Index
- /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/ORIGINAL_REQUEST.md — Pedido original
- /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/orchestrator_recepcao_gen2/PROJECT.md — Escopo e Feature Inventory
- /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/orchestrator_recepcao_gen2/GATE_STATUS.md — Status do Gate
- /Users/pedroguilherme/PROJETOS/KARTODROMO/TEST_INFRA.md — Arquitetura de testes E2E
- /Users/pedroguilherme/PROJETOS/KARTODROMO/TEST_READY.md — Sinal de prontidão da suíte E2E
- /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/orchestrator_recepcao_gen2/DISPATCH.md — Log de despacho
- /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/orchestrator_recepcao_gen2/BRIEFING.md — Memória de trabalho
- /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/orchestrator_recepcao_gen2/progress.md — Heartbeat de progresso
