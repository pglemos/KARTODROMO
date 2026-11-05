# BRIEFING — 2026-10-26T22:20:00Z

## Mission
Implementar integralmente a Milestone M2 (Servidor Backend Operacional), cobrindo persistência de fila de impressão em dbo.FilaImpressao, ajuste dinâmico de bobina térmica, proteção PII, integridade de endereço, bloqueio de baterias vencidas, parametrização SQL, estorno granular de vouchers, regras flexíveis de cadastro (Instagram/peso), otimização de busca de karts e estabilidade de runtime.

## 🔒 My Identity
- Archetype: worker
- Roles: implementer, qa, specialist
- Working directory: /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/worker_m2_gen2
- Original parent: 5717774c-5184-48e4-9f3d-92886d69aed2
- Milestone: M2 - Servidor Backend Operacional

## 🔒 Key Constraints
- Responder sempre em pt-BR.
- Respeitar regras do dono (AGENTS.md): sem telão (FormTV), sem senhas em código, programas nativos.
- Posse exclusiva de escrita:
  * `services/ops-server.ts`
  * `lib/ops/termo.ts`
  * `lib/ops/totem-baterias.ts`
  * `lib/ops/office.ts`
  * `lib/ops/db.ts`
  * `lib/ops/instagram.ts`
  * `lib/ops/cadastro-obrigatorio.ts`
  * `tests/ops/`
- Princípio de modificação mínima.
- Sem trapaças ou fachadas fictícias (Integrity Mandate).

## Current Parent
- Conversation ID: 5717774c-5184-48e4-9f3d-92886d69aed2
- Updated: 2026-10-26T22:20:00Z

## Task Summary
- **What to build**: M2 Backend Operacional
- **Success criteria**: 100% dos testes em `tests/ops/` e `tests/e2e-recepcao/` passando, `tsc --noEmit` sem erros novos no backend, todas as 10 frentes de M2 implementadas.
- **Interface contracts**: `orchestrator_recepcao_gen2/PROJECT.md`
- **Code layout**: `services/ops-server.ts`, `lib/ops/*`, `tests/ops/*`

## Key Decisions Made
- CTE atômica em `dbo.FilaImpressao` com `UPDATE TOP (1) WITH (UPDLOCK, READPAST)` em `proximaImpressao` seguindo fielmente `PROJECT.md`.
- Compatibilidade dupla no retorno de `GET /api/office/impressao/proxima`: devolve `{ ok: true, job }` conforme contrato e espelha propriedades no topo para compatibilidade com clientes desktop legados.
- Proteção PII com mascaramento de documento, e-mail, telefone e endereço na rota pública `/api/totem/identificar` e filtro contra sobrescrita com dados mascarados em `/api/totem/cadastro`.
- Remoção total do comando `UPDATE dbo.Cliente SET Numero = NULL, Complemento = NULL` preservando dados cadastrais.
- Tolerância de -30 min removida de `lib/ops/office.ts:426` e bloqueio de baterias vencidas em `lib/ops/totem-baterias.ts`.
- Parametrização segura SQL com `@bat_...` e `@grp_...` nas baterias do totem.
- Estorno cirúrgico de `VoucherUso` no loop de itens sem cancelar em lote todos os vouchers da venda.
- Instagram opcional em `lib/ops/instagram.ts` e faixa harmonizada de peso `10 <= peso <= 250` em `lib/ops/cadastro-obrigatorio.ts`.
- Otimização de `/api/crono/uso-karts` usando `WHERE KartNumero = @n`.
- Resiliência de conexão em `lib/ops/db.ts` e capturadores globais `uncaughtException`/`unhandledRejection` em `services/ops-server.ts`.

## Artifact Index
- `DISPATCH.md` — Despacho e requisitos da M2
- `BRIEFING.md` — Memória de trabalho
- `progress.md` — Heartbeat e progresso
- `handoff.md` — Relatório de entrega da Milestone M2
- `tests/ops/m2-backend.test.ts` — Nova suíte de 21 testes cobrindo todas as frentes da M2

## Change Tracker
- **Files modified**:
  * `services/ops-server.ts`: Fila relacional persistida, proteção PII, preservação de endereço, parametrização SQL, KartNumero, capturadores globais
  * `lib/ops/termo.ts`: `@page { size: 80mm auto; margin: 0; }` e `.page { min-height: auto; padding: 0 5.7mm 4mm; }`
  * `lib/ops/totem-baterias.ts`: Bloqueio de baterias vencidas e filtro por SYSDATETIME()
  * `lib/ops/office.ts`: Remoção de -30 min e estorno cirúrgico de voucher por item
  * `lib/ops/db.ts`: Listener de erro resiliente no pool MSSQL
  * `lib/ops/instagram.ts`: Instagram opcional
  * `lib/ops/cadastro-obrigatorio.ts`: Validação de peso de 10 a 250 kg
  * `tests/ops/termo.test.ts`: Asserção de min-height auto e padding dinâmico
  * `tests/ops/termo-challenger.test.ts`: Harmonização com novo layout dinâmico de bobina
  * `tests/ops/totem-baterias.test.ts`: Validação de bloqueio de baterias vencidas
  * `tests/ops/instagram.test.ts`: Testes para Instagram opcional e faixa de peso
  * `tests/ops/office-routes.test.ts`: Atualização para Instagram opcional e timeout de hash
  * `tests/ops/m2-backend.test.ts`: Nova suíte de 21 testes unitários e de integração para M2
- **Build status**: PASS (270/270 vitest tests/ops/, 87/87 vitest tests/e2e-recepcao/, tsc sem novos erros)
- **Pending issues**: nenhum

## Quality Status
- **Build/test result**: 100% PASS (270 testes em tests/ops/ e 87 testes em tests/e2e-recepcao/)
- **Lint status**: 0
- **Tests added/modified**: 21 testes novos em m2-backend.test.ts + atualizações em 5 suítes existentes

## Loaded Skills
- Nenhuma skill externa carregada diretamente.
