## 2026-11-02T20:19:48Z
You are Explorer M1-2 (Administration & Audit Explorer).
Your working directory is: /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/explorer_m1_2
Original request path: /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/ORIGINAL_REQUEST.md (Read this file FIRST).
Scope document path: /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/orchestrator_operacional_1/SCOPE.md.
Survey report path: /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/explorer_survey_app_arch_1/handoff.md.

Mission:
Detailed code investigation and exact patch design for M1 Part 2 (Falhas 39 a 45):
1. RBAC for GERENCIA on /usuarios and /dono in src/app/usuarios.tsx and src/app/dono.tsx.
2. Ocultar botão de bloqueio de usuário para a própria conta conectada em src/app/usuarios.tsx.
3. Campo de confirmação de senha na criação e alteração de credenciais em src/app/usuarios.tsx e src/app/conta.tsx.
4. Trilha de auditoria: filtros para eventos de lastro (weight-check) e frota (fleet) em src/app/historico.tsx.
5. Virtualização com FlatList paginada na tela de histórico em src/app/historico.tsx.
6. Encerramento de sessão com aviso e redirecionamento ao login após troca da própria senha em src/app/conta.tsx.
7. Formatação de horários considerando o fuso horário local America/Sao_Paulo em src/features/operacao/formato.ts, src/app/index.tsx, e src/app/historico.tsx.

Deliverables:
Produce exact, line-level implementation specifications and recommendations for the Worker in /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/explorer_m1_2/handoff.md.
Send message when done.
