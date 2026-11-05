# BRIEFING — 2026-10-26T19:22:00Z

## Mission
Mineração aprofundada de requisitos e mapeamento detalhado dos 36 problemas do sistema de Recepção do Kartódromo de Betim (R1 a R6) e correlação com autoatendimento/totem.

## 🔒 My Identity
- Archetype: Specification Miner
- Roles: Teamwork specialist, Specification Miner
- Working directory: /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/spec_miner_survey_1
- Original parent: 5c17e886-4fbe-41e6-80a1-62db6f4ee87a
- Milestone: Mapeamento de Requisitos e Especificação da Recepção (36 itens)

## 🔒 Key Constraints
- Responder sempre em pt-BR.
- Aplicativos nativos Windows (desktop/ C# WinForms), nunca app web/Chrome para operação local.
- Totem sem teclado na tela.
- Não mexer no telão (FormTV / --tv).
- Testes em produção só com dados "TESTE CODEX", desfeitos depois.
- Cronometragem: teste no simulador :4150, nunca no :4050 real.
- Nunca colocar senha em arquivo versionado, commit ou log.
- Não clonar nem fazer proxy do MyLapTime/Sisecom.
- Não instalar app nem reiniciar servidor em horário de funcionamento.
- Respeitar patches de produção (política de reembolso e uma vaga por pessoa).
- Apenas descoberta e documentação de requisitos (read-only, não implementar código produtivo).

## Current Parent
- Conversation ID: 5c17e886-4fbe-41e6-80a1-62db6f4ee87a
- Updated: 2026-10-26T19:22:00Z

## Task Summary
- **What to build**: Relatório de especificação detalhada (handoff.md) cobrindo os 36 problemas/requisitos da Recepção (R1 a R6) e correlação com autoatendimento/totem (itens 1 a 39).
- **Success criteria**: Documentação exaustiva com identificador (#1 a #36), grupo (R1 a R6), falha atual, critério de aceitação, componentes afetados, regras do dono, e correlação com autoatendimento/totem.
- **Interface contracts**: HANDOFF-SISTEMA-PROPRIO.md, AUDITORIA-RECEPCAO-2026-09-26.md, ORIGINAL_REQUEST.md.
- **Code layout**: desktop/ (Recepção WinForms C#), server/ops-server (Node/TS), SQL Server KartodromoOps.

## Loaded Skills
- Nenhuma skill externa injetada no prompt além das regras padrão.

## Key Decisions Made
- Estruturação completa em handoff.md contendo as seções obrigatórias do Handoff Protocol (Observation, Logic Chain, Caveats, Conclusion, Verification Method) integrando as tabelas e detalhamento dos 36 itens.
- Todos os 36 itens foram minuciosamente analisados com referências exatas aos arquivos e linhas do código-fonte (ops-server.ts, office.ts, db.ts, termo.ts, AgenteImpressao.cs, Caixa.cs, Baterias.cs, FormCliente.cs, Relatorio.cs, Api.cs, Ui.cs).
- Correlação detalhada com os 39 itens do autoatendimento documentada na Seção 7 de handoff.md.

## Artifact Index
- /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/spec_miner_survey_1/DISPATCH.md — Mensagem de despacho
- /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/spec_miner_survey_1/BRIEFING.md — Memória de trabalho
- /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/spec_miner_survey_1/progress.md — Heartbeat e progresso
- /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/spec_miner_survey_1/handoff.md — Relatório final
