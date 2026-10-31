# BRIEFING — 2026-10-26T19:37:00Z

## Mission
Liderar e coordenar a auditoria, correção e validação ponta a ponta de todos os 39 itens de falhas, erros, vulnerabilidades e gargalos operacionais do sistema de autoatendimento (totem) do Kartódromo de Betim.

## 🔒 My Identity
- Archetype: teamwork_preview_orchestrator
- Roles: orchestrator, user_liaison, human_reporter, successor
- Working directory: /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/orchestrator_2
- Original parent: parent
- Original parent conversation ID: b543e145-043f-4b51-9175-deb1d70e0bf6

## 🔒 My Workflow
- **Pattern**: Project
- **Scope document**: /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/orchestrator_2/PROJECT_TOTEM.md
1. **Decompose**: Survey completo concluído com 39 itens catalogados no Feature Inventory. 6 Milestones (M1 a M6) + M7 (E2E) estruturadas.
2. **Dispatch & Execute**:
   - Loop em execução para M1: 3 Explorers (concluído) -> 1 Worker (em execução) -> 2 Reviewers + 2 Challengers + 1 Forensic Auditor -> Gate Check.
3. **On failure** (in this order):
   - Retry: nudge stuck agent or re-send task
   - Replace: spawn fresh agent with partial progress
   - Skip: proceed without (only if non-critical)
   - Redistribute: split stuck agent's remaining work
   - Redesign: re-partition decomposition
   - Escalate: report to parent (sub-orchestrators only, last resort)
4. **Succession**: Ao atingir 16 spawns, soft handoff.md, cancelar crons e invocar sucessor.
- **Work items**:
  1. Survey & Feature Inventory dos 39 itens [done]
  2. M1: R1 Impressão e Gestão de Termos (Itens 1-6) [in-progress]
  3. M2: R2 Segurança, Privacidade e LGPD (Itens 7-11) [pending]
  4. M3: R3 Validação de Dados e Cadastro (Itens 12-19) [pending]
  5. M4: R4 Usabilidade, Hardware e Fluxo (Itens 20-27) [pending]
  6. M5: R5 Regras de Baterias e Concorrência (Itens 28-33) [pending]
  7. M6: R6 Infra, Deploy, Rede e Ciclo de Vida (Itens 34-39) [pending]
  8. M7: Suíte E2E & Hardening Adversarial Final [pending]
- **Current phase**: 2B (Iteration Loop M1 — Implementação)
- **Current focus**: Worker M1 implementando persistência SQL, corte térmico, bloqueio de impressão cega e script de spooler

## 🔒 Key Constraints
- NUNCA editar arquivos de código-fonte diretamente (somente orquestrar via invoke_subagent).
- NUNCA rodar comandos de build/test diretamente — delegar aos workers e reviewers.
- NUNCA investigar diretamente no nível de código — despachar Explorers/Spec Miners.
- Veto do Auditor Forense é binário e intransponível (qualquer violação reprova o gate).
- Responder sempre em pt-BR.
- Apps são programas Windows nativos (desktop/); não mexer no telão (FormTV / --tv).
- Totem sem teclado virtual na tela por padrão (foco no teclado físico USB).
- Testes em produção somente com "TESTE CODEX" e desfeitos depois.
- Cronometragem de teste apenas no simulador :4150, nunca no :4050 real.

## Current Parent
- Conversation ID: b543e145-043f-4b51-9175-deb1d70e0bf6
- Updated: 2026-10-26T19:07:00Z

## Key Decisions Made
- PROJECT_TOTEM.md criado com 39 features e 100% de cobertura atribuída às Milestones M1 a M7.
- Milestone M1: Survey e exploração concluídos com 100% de consenso técnico.
- Worker M1 despachado com aviso mandatário anti-cheat e propriedade exclusiva de arquivos.

## Team Roster
| Agent | Type | Work Item | Status | Conv ID |
|-------|------|-----------|--------|---------|
| spec_miner_totem_survey_1 | teamwork_preview_spec_miner | Survey de especificações e regras operacionais | completed | 8d07a574-eaee-415f-bb14-54dd42765d56 |
| explorer_totem_backend_1 | teamwork_preview_explorer | Survey de backend Node.js, APIs e DB | completed | 05d10245-20e9-4847-bc8b-490f2af639f6 |
| explorer_totem_desktop_1 | teamwork_preview_explorer | Survey de WinForms .NET 8, Kiosk e scripts | completed | affc6064-81b7-48cb-bab5-f472ec4f3e84 |
| explorer_m1_backend_1 | teamwork_preview_explorer | M1: Proposta técnica backend e SQL dbo.FilaImpressao | completed | 90e5ffee-e45e-4ac9-a571-27406abbb463 |
| explorer_m1_desktop_2 | teamwork_preview_explorer | M1: Proposta técnica FormTotem e script spooler | completed | 5147f3c5-10ad-47c0-ab56-f9d06bc995f7 |
| spec_miner_m1_3 | teamwork_preview_spec_miner | M1: Contrato AgenteImpressao recepção e TM-T20 | completed | f0e24d2b-f87b-40b4-85a8-5715d33786c8 |
| worker_m1 | teamwork_preview_worker | M1: Implementação de código, build e testes | in-progress | 47effda4-7aa0-4f66-8e55-12d3b0423a81 |

## Succession Status
- Succession required: no
- Spawn count: 7 / 16
- Pending subagents: 47effda4-7aa0-4f66-8e55-12d3b0423a81
- Predecessor: none
- Successor: not yet spawned

## Active Timers
- Heartbeat cron: cc947e12-4c7c-48ad-93cf-a3cced581f33/task-22 (a cada 10 min)
- Safety timer: cron liveness

## Artifact Index
- /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/ORIGINAL_REQUEST.md — Solicitação original
- /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/orchestrator_2/DISPATCH.md — Registro de despachos
- /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/orchestrator_2/plan.md — Plano de trabalho
- /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/orchestrator_2/progress.md — Status e liveness
- /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/orchestrator_2/PROJECT_TOTEM.md — Documento mestre de arquitetura e milestones
