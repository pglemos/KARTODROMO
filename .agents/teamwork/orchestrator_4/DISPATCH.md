## 2026-10-27T02:56:25Z
Você é o Project Orchestrator (teamwork_preview_orchestrator) encarregado de liderar e coordenar a auditoria, correção e validação ponta a ponta dos 39 itens do sistema de autoatendimento do Kartódromo de Betim.

Seu diretório de trabalho é: /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/orchestrator_4
O arquivo fidedigno da solicitação original do usuário é: /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/ORIGINAL_REQUEST.md (seção 2026-10-26T19:04:37Z).

Contexto da Execução Prévia:
- Matriz completa de 39 itens em: `/Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/orchestrator_2/PROJECT_TOTEM.md`.
- Milestone M1 (Impressão e Termos — Itens 1 a 6) 100% HOMOLOGADA com PASS formal em: `/Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/orchestrator_3/GATE_STATUS.md`.
- Milestone M2 (Segurança, Privacidade e LGPD — Itens 7 a 11): os 3 surveys foram concluídos e as implementações principais já estão no repositório (`desktop/src/Kartodromo.Autoatendimento/BloqueioTeclasKiosk.cs`, `migrations/ops/0012_lgpd_menor.sql`, mascaramento PII e token HMAC em `services/ops-server.ts`, e suporte a dados mascarados em `desktop/src/Kartodromo.Comum/ValidacaoCliente.cs`).
- Próximo passo imediato: submeter M2 aos testes e homologação do Gate Check M2, e em seguida avançar pelas Milestones M3 a M6 + M7 E2E.

Escopo dos 39 Itens:
R1. Impressão e Gestão de Termos (Itens 1 a 6) [HOMOLOGADO - PASS]
R2. Segurança, Privacidade e LGPD (Itens 7 a 11) [Implementado, pronto para homologação no Gate M2]
R3. Validação de Dados e Cadastro no Totem (Itens 12 a 19) [Milestone M3]
R4. Usabilidade, Hardware e Fluxo de Atendimento (Itens 20 a 27) [Milestone M4]
R5. Regras de Baterias, Agendamento e Concorrência (Itens 28 a 33) [Milestone M5]
R6. Infraestrutura, Deploy, Rede e Ciclo de Vida (Itens 34 a 39) [Milestone M6]
M7. Suíte E2E, Validação de Tipos, Release Build e Victory Audit.

Critérios de Aceite:
- npx vitest run sem falhas.
- npx tsc --noEmit sem erros.
- dotnet build desktop/Kartodromo.Desktop.sln -c Release sem erros.
- Autoteste visual do totem valida telas em 1366x768 e 1920x1080.
- Regras do dono (AGENTS.md) rigorosamente cumpridas: responder em pt-BR, totem sem teclado virtual por padrão (foco no teclado USB físico), não alterar FormTV/--tv, testes de produção apenas com "TESTE CODEX" e desfeitos, cronometragem de teste apenas no :4150.

Inicialize seu briefing e progress.md em seu workspace (.agents/teamwork/orchestrator_4/), coordene os especialistas e reporte o avanço das milestones.
