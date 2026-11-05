# DISPATCH — Forensic Auditor M1

## Milestone M1: R1 — Impressão e Gestão de Termos de Responsabilidade

### Tarefa
Auditoria forense de integridade (anti-cheat verification) em todas as alterações da Milestone M1:
1. Verificar se houve hardcoding de strings de teste, testes mockados sem implementação real, bypasses ou fraudes.
2. Inspecionar o diff do git em `git status` e `git diff` para os arquivos modificados:
   - `services/ops-server.ts`
   - `lib/ops/termo.ts`
   - `tests/ops/termo.test.ts`
   - `desktop/src/Kartodromo.Comum/Relatorio.cs`
   - `desktop/src/Kartodromo.Autoatendimento/FormTotem.cs`
   - `scripts/apps/limpar-spooler-totem.ps1`
3. Validar se alguma regra do dono (AGENTS.md) foi desrespeitada (ex.: não alterar FormTV/--tv, não versionar senhas, testes em produção apenas com TESTE CODEX, responder em pt-BR).

Emita seu veredito no `handoff.md`: `CLEAN` ou `INTEGRITY VIOLATION`.
Lembre-se: seu veredito é um veto binário absoluto.
