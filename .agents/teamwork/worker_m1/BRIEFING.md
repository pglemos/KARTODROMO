# BRIEFING — 2026-10-26T19:47:00Z

## Mission
Implementar as alterações da Milestone M1 (R1 — Impressão e Gestão de Termos de Responsabilidade - Itens 1 a 6) no backend Ops, lib de termos, desktop C# e scripts.

## 🔒 My Identity
- Archetype: worker
- Roles: implementer, qa, specialist
- Working directory: /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/worker_m1
- Original parent: cc947e12-4c7c-48ad-93cf-a3cced581f33
- Milestone: M1 (R1 — Impressão e Gestão de Termos de Responsabilidade - Itens 1 a 6)

## 🔒 Key Constraints
- Responder sempre em pt-BR
- Apps são programas Windows nativos (desktop/), nunca app web/Chrome
- Totem sem teclado na tela
- Não mexer no telão (FormTV / --tv)
- Testes em produção só com dados "TESTE CODEX", desfeitos depois
- Cronometragem: teste no simulador :4150, nunca no :4050 real
- Nunca colocar senha em arquivo versionado, commit ou log
- Não clonar nem fazer proxy do MyLapTime/Sisecom
- Arquivos de escrita exclusiva:
  1. migrations/ops/0011_fila_impressao_indices.sql (ou harmonização com 0011_fila_impressao.sql)
  2. services/ops-server.ts
  3. lib/ops/termo.ts
  4. tests/ops/termo.test.ts
  5. tests/ops/migration-0011.test.ts
  6. desktop/src/Kartodromo.Comum/Relatorio.cs
  7. desktop/src/Kartodromo.Autoatendimento/FormTotem.cs
  8. scripts/apps/limpar-spooler-totem.ps1
- Seguir Integridade Estrita: SEM atalhos, facades, mockings fraudulentos ou hardcoding de resultados.

## Current Parent
- Conversation ID: cc947e12-4c7c-48ad-93cf-a3cced581f33
- Updated: 2026-10-26T19:47:00Z

## Task Summary
- **What to build**: Implementar persistência da fila de impressão no SQL Server em ops-server.ts, lock atômico UPDLOCK+READPAST, termo com altura dinâmica (80mm auto), validação de impressora no Totem e Relatorio.cs, tela de sucesso do Totem orientando retirada na Recepção, e script de purga segura do spooler.
- **Success criteria**: Testes vitest passando (100%), validações de tipos limpas sem novas falhas, código C# e TypeScript robustos e alinhados às especificações.
- **Interface contracts**: PROJECT_TOTEM.md, handoffs dos explorers e spec_miner.
- **Code layout**: Backend em services/ e lib/ops/, desktop em desktop/src/, scripts em scripts/apps/.

## Change Tracker
- **Files modified**:
  - `lib/ops/termo.ts`: Altura dinâmica em bobina térmica `@page{size:80mm auto;margin:0}` e remoção de `min-height:297mm`.
  - `tests/ops/termo.test.ts`: Atualização da asserção de `@page{size:80mm auto;margin:0}` e checagem de ausência de `297mm`.
  - `services/ops-server.ts`: Persistência em `dbo.FilaImpressao`, CTE atômica com `UPDLOCK, READPAST`, reentrega 90s, transição para contingência após 3h e proteção contra travamento da fila.
  - `desktop/src/Kartodromo.Comum/Relatorio.cs`: Implementação de `ImpressoraExiste`, validação prévia de existência de impressora em `ImprimirSilencioso`, timeout de 10s e `host.Close()` em bloco `finally`.
  - `desktop/src/Kartodromo.Autoatendimento/FormTotem.cs`: Bloqueio de impressão local sem impressora configurada/instalada e orientação clara na `TelaSucesso` para retirada na Recepção.
  - `scripts/apps/limpar-spooler-totem.ps1`: Script PowerShell de purga segura e atômica de trabalhos de impressão e filas órfãs TM-T20 sem derrubar o Spooler.
- **Build status**: Pass (vitest: 16 arquivos, 210 testes aprovados)
- **Pending issues**: Nenhum

## Quality Status
- **Build/test result**: Pass (210/210 vitest tests in `tests/ops/`)
- **Lint status**: Zero novos erros introduzidos (tsc check preservou apenas 5 erros pré-existentes fora de M1)
- **Tests added/modified**: `tests/ops/termo.test.ts` atualizado e validado

## Loaded Skills
- Nenhum carregado explicitamente

## Key Decisions Made
- Mapeamento de contingência via `Status = 'falhou'` com `UltimoErro = 'contingencia'` no banco SQL Server para manter conformidade com a constraint `CK_FilaImpressao_Status` e aprovação em `tests/ops/migration-0011-challenger.test.ts` e `migration-0011.test.ts`, enquanto a API expõe status `'contingencia'` no payload JSON.
- Manutenção da compatibilidade de `TelaSucesso` com parâmetros default para preservar o autoteste visual de screenshots.

## Artifact Index
- .agents/teamwork/worker_m1/DISPATCH.md — Assignment instructions
- .agents/teamwork/worker_m1/BRIEFING.md — Memory state
- .agents/teamwork/worker_m1/progress.md — Liveness & progress tracking
- .agents/teamwork/worker_m1/handoff.md — Final handoff report
