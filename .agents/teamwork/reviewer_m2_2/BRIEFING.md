# BRIEFING — 2026-11-02T21:55:00Z

## Mission
Revisão adversária independente da Milestone M2 (Falhas 08 a 22 e Requisito R2) em `/Users/pedroguilherme/PROJETOS/kartodromo-operacional`, focando em edge cases, concorrência, robustez matemática, integridade e regras operacionais.

## 🔒 My Identity
- Archetype: reviewer_critic
- Roles: reviewer, critic
- Working directory: /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/reviewer_m2_2
- Original parent: 5717774c-5184-48e4-9f3d-92886d69aed2
- Milestone: M2
- Instance: 2 of 2 (reviewer_m2_2)
- Dispatched by orchestrator_operacional_1: 88cadb65-7d49-4f0d-a278-9c17ee4251ab (2026-11-02T21:51:58Z)

## 🔒 Key Constraints
- Review-only — do NOT modify implementation code
- Responder sempre em pt-BR
- Verificar integridade estrita (sem atalhos, sem mocks falsos, sem mascaramento frouxo)
- Veredito explícito: APPROVE ou REQUEST_CHANGES
- Proibição de tocar em telas de TV (FormTV / --tv)
- Nunca expor senhas em código ou logs
- Não usar servidor real :4050, apenas simulador :4150 se aplicável

## Current Parent
- Conversation ID: 88cadb65-7d49-4f0d-a278-9c17ee4251ab
- Updated: 2026-11-02T21:51:58Z

## Review Scope
- **Files to review**:
  - `src/features/operacao/baterias.ts`
  - `src/features/operacao/sorteio.ts`
  - `src/features/operacao/formato.ts`
  - `src/app/bateria/[id].tsx`
  - `src/types/campeonatos.ts`
  - `src/app/campeonatos.tsx`
  - `src/app/index.tsx`
  - `tests/m2-features.test.ts`
- **Interface contracts**: `ORIGINAL_REQUEST.md`, `SCOPE.md`, `worker_m2_1/handoff.md`
- **Review criteria**: Robustez contra corner cases (baterias vazias, exceções sem karts, OCC 409, limites de peso, divisões por zero), integridade (sem facades/cheats), não violação de regras operacionais.

## Review Checklist
- **Items reviewed**: [Iniciando auditoria de código e testes]
- **Verdict**: pending
- **Unverified claims**: Todas as claims do worker_m2_1 serão testadas e verificadas.

## Attack Surface
- **Hypotheses tested**:
  - Baterias vazias ou sem pilotos aptos no sorteio
  - Pilotos com exceções severas onde karts elegíveis acabam
  - Erro OCC 409 e preservação da prévia
  - Concorrência de múltiplos toques no modo um a um (lock de piloto)
  - Limites de peso e dízimas periódicas no cálculo de lastro
  - Injeção ou alteração em telas de TV
- **Vulnerabilities found**: TBD
- **Untested angles**: TBD

## Key Decisions Made
- Iniciada revisão adversarial e verificação independente dos testes.

## Artifact Index
- DISPATCH.md — Mensagem recebida do orquestrador
- BRIEFING.md — Memória de trabalho
- progress.md — Heartbeat de execução
- handoff.md — Relatório e veredito final
