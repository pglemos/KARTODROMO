# BRIEFING — 2026-11-02T20:16:30Z

## Mission
Investigar KARTODROMO e sua integração com kartodromo-operacional: simulador :4150 vs :4050, R2 (campeonatos e lastros), R3 (trocas/quebras e fluxo gerencial), R4 (cronometragem e alertas), R5 (pesagem pós-corrida e DSQ) e R6 (rastreabilidade e auditoria).

## 🔒 My Identity
- Archetype: explorer
- Roles: Backend & Integration Explorer
- Working directory: /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/explorer_survey_backend_flows_1
- Original parent: 88cadb65-7d49-4f0d-a278-9c17ee4251ab
- Milestone: initial-survey

## 🔒 Key Constraints
- Read-only investigation — do NOT implement
- Responder sempre em pt-BR (AGENTS.md)
- Não alterar telas de TV/painéis (`FormTV` / `--tv`)
- Nunca expor senhas em código versionado, commit ou log
- Validações contra o simulador `:4150` sem afetar a porta `:4050` de produção

## Current Parent
- Conversation ID: 88cadb65-7d49-4f0d-a278-9c17ee4251ab
- Updated: not yet

## Investigation State
- **Explored paths**:
  - `ORIGINAL_REQUEST.md`, `AGENTS.md`, `docs/operacao/HANDOFF-SISTEMA-PROPRIO.md`
  - `services/timing-server.ts`, `services/ops-server.ts`, `services/timing-email.ts`
  - `lib/timing/race-engine.ts`, `lib/timing/catalog.ts`, `lib/timing/ranking-peso.ts`, `lib/timing/decoder-client.ts`
  - `lib/race-formats.ts`, `lib/admin-d1.ts`
  - `KARTODROMO-snapshot/lib/app-v1/` (`store.ts`, `auth.ts`, `comandos.ts`, `operacao.ts`, `rotas.ts`, `regras.ts`)
  - `kartodromo-operacional/src/` (`cliente.ts`, `sessao.tsx`, `acao.ts`, `bateria/[id].tsx`, `frota.tsx`, `historico.tsx`, `dono.tsx`, `index.tsx`)
  - `kartodromo-operacional/tests/` (29 testes passando)
- **Key findings**:
  - Simulador :4150 está implementado em `services/timing-server.ts` via flag `TIMING_SIMULATE=1`, abrindo servidor TCP mock na porta 5199 que emite TRX text passings dos karts simulados (`TIMING_SIM_KARTS`).
  - O backend do app operacional `/api/app/v1/*` foi implementado no branch `alinhamento/base-app` (`KARTODROMO-snapshot/lib/app-v1/`), suportando SQLite nativo transacional (`app.db`), rotas autenticadas por JWT/HMAC, idempotência via `operationId` e fila por bateria.
  - R2: `lib/race-formats.ts` suporta pontuação e desempate, mas o cálculo de lastro em `regras.ts` e no app está fixado em 90 kg (Light) e 100 kg (Super). Precisa suportar meta customizada (80, 95, 110 kg) e nova aba de Campeonatos.
  - R3: O motivo de troca é genérico ('Kart quebrou', 'Kart ruim', 'Pedido do piloto'). Falta a seleção das 9 quebras específicas e dos 9 defeitos de desempenho, retenção gerencial até liberação formal no sistema, aba do Gerente e fluxo de O.S. com mecânico.
  - R4: Cronometragem não possui confirmação de troca nem alertas sonoros/visuais para trocas pendentes do galpão ou karts não autorizados na pista (`autoAdded: true`).
  - R5: `race-engine.ts` já implementa `dq: c.flag === 'black'` que joga o piloto para a última posição, mas falta a interface de convocação pela cronometragem, alerta na balança e comando automático de DSQ para "Peso NoK".
  - R6: `auditoria` no SQLite grava `actorUserId`, `actorRole`, `deviceId`, mas não expõe os dados do operador nos relatórios/telas do app e o app usa `ScrollView` em vez de `FlatList` paginada.
- **Unexplored areas**: Nenhuma pendente no escopo de backend/integração.

## Key Decisions Made
- Estruturação do relatório final cobrindo com exatidão a linha de código, os contratos de API, os modelos de banco de dados e os métodos de verificação no simulador :4150.

## Artifact Index
- DISPATCH.md — Mensagem original de despacho
- BRIEFING.md — Memória de trabalho persistente
- progress.md — Heartbeat de progresso
- handoff.md — Relatório de levantamento e integração técnica backend
