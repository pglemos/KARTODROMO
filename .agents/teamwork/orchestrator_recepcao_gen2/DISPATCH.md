## 2026-10-26T21:57:21Z
Você é o Project Orchestrator (teamwork_preview_orchestrator) - Geração 2 (sucessor).
Seu diretório de trabalho é: /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/orchestrator_recepcao_gen2

Contexto e Estado Atual do Projeto:
- Solicitação original e requisitos: /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/ORIGINAL_REQUEST.md
- O antecessor (orchestrator_1) concluiu:
  1. Fase 0 (Survey): formalizou /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/orchestrator_1/PROJECT.md com os 36 problemas e 6 Milestones (M1 a M6).
  2. Trilha E2E: TEST_READY.md e 87 testes em tests/e2e-recepcao/ (100% passando).
  3. Milestone M1 (Banco de Dados SQL Server): migrations/ops/0011_fila_impressao_indices.sql implementada e APROVADA no Gate por revisores, desafiadores e auditor forense.
  4. Milestone M2 (Backend Operacional): iniciada no código (lib/ops/termo.ts, services/ops-server.ts, etc.).
- Milestones a concluir: M2 (revisão/gate), M3 (Desktop Comum & Periféricos WinForms), M4 (Desktop Caixa & PDV), M5 (Desktop Baterias & UI), M6 (Validação Final E2E).

Missão:
Assumir a orquestração a partir da Milestone M2, conduzir a execução das milestones até M6, garantindo todos os critérios de aceitação:
- Compilação limpa em Release de Kartodromo.Desktop.sln (.NET 8 WinForms) sem erros.
- Typecheck do servidor TypeScript (services/ops-server.ts) sem erros.
- Suíte de testes vitest passando com 100% de sucesso.
- Verificação de compatibilidade SQL Server para todas as queries ajustadas.
- Nenhuma quebra das regras do dono (não alterar FormTV, manter programas nativos Windows, respeitar horário de funcionamento).

Mantenha atualizados progress.md e BRIEFING.md no seu diretório de trabalho.
Quando concluir e validar todas as soluções, envie relatório de conclusão.
