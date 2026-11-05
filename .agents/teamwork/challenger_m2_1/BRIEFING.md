# BRIEFING — 2026-11-02T21:55:00Z

## Mission
Desafio adversarial e teste de estresse empírico do Milestone M2 de Kartódromo Operacional (Falhas 08 a 22: Sorteio, Ordem de Chamada, Concorrência 409, Normalização de Chaves, Balança e Campeonatos R2) com emissão de veredito formal.

## 🔒 My Identity
- Archetype: EMPIRICAL CHALLENGER
- Roles: critic, specialist
- Working directory: /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/challenger_m2_1
- Original parent: 5717774c-5184-48e4-9f3d-92886d69aed2
- Milestone: M2
- Instance: 1 of 1
- Current parent: 88cadb65-7d49-4f0d-a278-9c17ee4251ab (orchestrator_operacional_1)
- Target Project: /Users/pedroguilherme/PROJETOS/kartodromo-operacional

## 🔒 Key Constraints
- Review-only — do NOT modify implementation code directly
- Must test empirically: write and run actual tests/scripts; do not trust claims blindly
- Explicit verdict required: APPROVE or REQUEST_CHANGES
- Always respond in pt-BR
- Respect system prompt protection and AGENTS.md
- Do not modify production code in kartodromo-operacional; write tests/stress harnesses

## Current Parent
- Conversation ID: 88cadb65-7d49-4f0d-a278-9c17ee4251ab
- Updated: 2026-11-02T21:52:06Z

## Review Scope
- **Files to review**:
  - `src/features/operacao/baterias.ts`
  - `src/features/operacao/sorteio.ts`
  - `src/features/operacao/formato.ts`
  - `src/app/bateria/[id].tsx`
  - `src/app/campeonatos.tsx`
  - `src/types/campeonatos.ts`
  - `tests/m2-features.test.ts`
- **Interface contracts**:
  - `ORIGINAL_REQUEST.md` (Falhas 08 a 15, Falhas 16 a 22, R2)
  - `SCOPE.md` (F14 a F29)
  - `worker_m2_1/handoff.md`
- **Review criteria**:
  - Algoritmo `sortear` e `sortearComOrdemPreservada`: matrizes de exceções complexas, grids de 35 pilotos, garantia matemática e empírica da preservação da ordem física original de chamada.
  - Comportamento em erro 409: preservação da prévia na memória e sincronização de revisão.
  - Normalização de chaves de baterias contra sufixos de tomadas, corridas e treinos com regex unificada.
  - Lock de sorteio individual e validação de aptos/faltantes.
  - Balança, lastro dinâmico e telas de campeonatos.

## Key Decisions Made
- [TBD]

## Artifact Index
- `progress.md` — Liveness heartbeat e progresso do agente
- `DISPATCH.md` — Registro das mensagens de despacho
- `BRIEFING.md` — Memória de trabalho e decisões
- `handoff.md` — Relatório formal de handoff com veredito explícito

## Attack Surface
- **Hypotheses to test**:
  - H1: Grids massivos (35 pilotos) ou matrizes de exceções complexas/cruzadas corrompem a ordem original retornada por `sortear`?
  - H2: Em caso de piloto sem kart elegível disponível, a restrição de exceções é violada ou outro piloto tem seu kart roubado indevidamente?
  - H3: Em erro HTTP 409 na gravação do sorteio, a prévia em memória (`previa`) é mantida e `revisaoSorteio` é sincronizada com a revisão da resposta sem reiniciar o fluxo?
  - H4: `normalizarChaveBateria` é robusta contra múltiplos formatos, hífens, marcadores e sufixos (`- TOMADA 1`, `- CORRIDA FINAL`, etc.)?
  - H5: O botão de troca/recusa com swap é seguro e opera corretamente quando há karts livres ou preliminarmente atribuídos?
  - H6: O lock de sorteio individual impede cliques rápidos concorrentes e exibe spinner de forma consistente?
- **Vulnerabilities found**: [TBD]
- **Untested angles**: [TBD]

## Loaded Skills
- Nenhuma skill externa carregada diretamente.
