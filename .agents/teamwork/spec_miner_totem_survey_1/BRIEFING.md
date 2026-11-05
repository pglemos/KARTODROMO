# BRIEFING — 2026-10-26T19:18:00Z

## Mission
Mapear integralmente as regras operacionais, especificações de negócio e exigências da operação para os 39 itens do totem de autoatendimento (R1 a R6), com foco em R1, R2 e R5, respeitando as restrições inegociáveis do dono.

## 🔒 My Identity
- Archetype: specification-miner
- Roles: Specification Miner, Domain Expert
- Working directory: /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/spec_miner_totem_survey_1
- Original parent: cc947e12-4c7c-48ad-93cf-a3cced581f33
- Milestone: survey-totem-spec-mining

## 🔒 Key Constraints
- Responder sempre em pt-BR.
- Aplicativos são programas Windows nativos (`desktop/`), nunca web/Chrome.
- Totem sem teclado na tela (sem teclado virtual).
- Não mexer no telão (`FormTV` / `--tv`).
- Testes em produção só com dados "TESTE CODEX", desfeitos depois.
- Cronometragem: teste no simulador `:4150`, nunca no `:4050` real.
- Nunca colocar senha em arquivo versionado, commit ou log.
- Não clonar nem fazer proxy do MyLapTime/Sisecom.
- Não instalar app nem reiniciar servidor no horário de funcionamento.
- Regra de ouro: SPECIFICATION MINER NÃO IMPLEMENTA CÓDIGO (read-only em relação ao código de produção).

## Current Parent
- Conversation ID: cc947e12-4c7c-48ad-93cf-a3cced581f33
- Updated: not yet

## Task Summary
- **What to build**: Levantamento exaustivo de requisitos e regras de negócio para os 39 itens do totem (R1 a R6), detalhando impressão térmica, contingência, LGPD, tokens de totem, regras de baterias, agendamento, concorrência e Pix.
- **Success criteria**: Relatório `handoff.md` contendo as seções do Handoff Protocol + tabelas `## Features Discovered` e `## Edge Cases`, cobrindo todos os itens R1 a R6.
- **Interface contracts**: `docs/operacao/HANDOFF-SISTEMA-PROPRIO.md`, `AGENTS.md`, `ORIGINAL_REQUEST.md`.
- **Code layout**: `desktop/` (WinForms/C#), `services/` (Node.js), `lib/ops/`.

## Key Decisions Made
- Investigar os 39 itens agrupados por R1 (Impressão/Termos), R2 (Segurança/LGPD/Sessão), R3 (Fluxo/UX Totem), R4 (Hardware/Periféricos), R5 (Baterias/Agendamento/Pix), R6 (Operação/Resiliência).
- Descoberta exata dos gargalos no código: `filaImpressao` volátil em `ops-server.ts:212`, descarte de 3h em linha 219, IP socket binding em linha 240, 297mm fixo em `termo.ts:192`, tolerância indevida de -30min em `office.ts:426`, colunas `Numero`/`Complemento` anuladas em `ops-server.ts:369`, falta de intercepção do `WM_MOUSEWHEEL` em `FormTotem.cs:144`, vazamento de `ContextMenuStrip` em `Controles.cs:375`, e sintaxe corrompida em `habilitar-admin-remoto-totem1.ps1:58-68`.

## Artifact Index
- `/Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/spec_miner_totem_survey_1/BRIEFING.md` — Memória de trabalho
- `/Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/spec_miner_totem_survey_1/progress.md` — Batimentos e progresso
- `/Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/spec_miner_totem_survey_1/handoff.md` — Relatório final
