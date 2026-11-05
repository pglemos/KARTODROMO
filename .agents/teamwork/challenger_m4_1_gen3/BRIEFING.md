# BRIEFING — 2026-10-27T04:28:00Z

## Mission
Desafiar adversariamente e empiricamente a implementação da Milestone M4 (Caixa & PDV: Caixa.cs, TelasCaixa.cs e endpoints/regras relacionadas), executando testes de estresse, concorrência, troco impróprio, valores absurdos e validação E2E.

## 🔒 My Identity
- Archetype: EMPIRICAL CHALLENGER
- Roles: critic, specialist
- Working directory: /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/challenger_m4_1_gen3
- Original parent: a6d58f0d-4315-4219-ba93-0639e76230f8
- Milestone: M4 (Desktop Recepção — Caixa & PDV)
- Instance: 1 of 1

## 🔒 Key Constraints
- Review-only e desafio empírico — NÃO modificar o código de produção se não for expressamente atribuído como Worker (relatar bugs e falhas em handoff.md).
- Responder sempre em pt-BR.
- Apps são Windows nativos (`desktop/`), nunca app web/Chrome.
- Totem sem teclado na tela.
- Não mexer no telão (`FormTV` / `--tv`).
- Testes em produção só com "TESTE CODEX" (aqui executamos testes locais/isolados).
- Execuções de verificação mandatória: `npx vitest run tests/desktop-m4-caixa.test.ts`, `npx vitest run tests/e2e-recepcao/`, `npx tsc --noEmit`.

## Current Parent
- Conversation ID: a6d58f0d-4315-4219-ba93-0639e76230f8
- Updated: not yet

## Review Scope
- **Files to review**: `desktop/Recepcao/Caixa.cs`, `desktop/Recepcao/TelasCaixa.cs`, `tests/desktop-m4-caixa.test.ts`, `tests/e2e-recepcao/*`, arquivos de API backend do Caixa se houver.
- **Interface contracts**: `PROJECT.md`, `ORIGINAL_REQUEST.md`, `TEST_READY.md`, `worker_m4_1/handoff.md`.
- **Review criteria**: Robustez contra troco indevido, idempotência e concorrência, sangria/suprimento limites, fechamento cego e reabertura, desvinculação de voucher, precisão centavo a centavo.

## Attack Surface
- **Hypotheses tested**: [TBD]
- **Vulnerabilities found**: [TBD]
- **Untested angles**: [TBD]

## Loaded Skills
- None loaded yet.

## Key Decisions Made
- Iniciada leitura de contexto obrigatório.

## Artifact Index
- `DISPATCH.md` — Mensagem de despacho
- `BRIEFING.md` — Memória persistente do agente
- `progress.md` — Heartbeat de progresso
- `handoff.md` — Relatório final com veredito
