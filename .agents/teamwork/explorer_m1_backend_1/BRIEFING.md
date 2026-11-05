# BRIEFING — 2026-10-26T19:33:30Z

## Mission
Elaborar a proposta técnica detalhada de código para a Milestone M1 Backend (Impressão e Gestão de Termos), cobrindo migração DDL de dbo.FilaImpressao, refatoração de services/ops-server.ts para fila em banco com lock atômico e contingência sem expurgo, e lib/ops/termo.ts com altura dinâmica na TM-T20.

## 🔒 My Identity
- Archetype: explorer
- Roles: Explorer Especialista em Backend para Milestone M1
- Working directory: /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/explorer_m1_backend_1
- Original parent: cc947e12-4c7c-48ad-93cf-a3cced581f33
- Milestone: M1 (Impressão e Gestão de Termos)

## 🔒 Key Constraints
- Read-only investigation — do NOT implement production code
- Respostas sempre em pt-BR (AGENTS.md)
- Arquivos de código de produção não devem ser alterados diretamente por este agente
- Saída principal em handoff.md com 5 seções obrigatórias
- Manter progress.md atualizado como heartbeat

## Current Parent
- Conversation ID: cc947e12-4c7c-48ad-93cf-a3cced581f33
- Updated: 2026-10-26T19:33:30Z

## Investigation State
- **Explored paths**:
  - `services/ops-server.ts` (linhas 207-234, 430-480, 560-598)
  - `lib/ops/termo.ts` (linhas 188-219)
  - `tests/ops/termo.test.ts` (todas as linhas)
  - `desktop/src/Kartodromo.Recepcao/AgenteImpressao.cs` (todas as linhas)
  - `migrations/ops/0011_fila_impressao_indices.sql` e `tests/ops/migration-0011.test.ts`
  - `docs/operacao/HANDOFF-SISTEMA-PROPRIO.md` (seção 4.2)
- **Key findings**:
  - `filaImpressao[]` na RAM do Node.js é vulnerável a reinícios e expurgo em 3h via `splice()`.
  - Agente de impressão em `AgenteImpressao.cs` consome `GET /api/office/impressao/proxima` e confirma via `POST /api/office/impressao/{id}/feita` ou `falhou`.
  - `lib/ops/termo.ts` fixa `size:80mm 297mm` e `.page { min-height: 297mm }`, gastando 297mm de bobina em vez de altura dinâmica.
  - Tabela `dbo.FilaImpressao` deve suportar status `pendente`, `imprimindo`, `impressa`, `contingencia`, `falhou`, `cancelada` com índices adequados.
- **Unexplored areas**: Nenhuma área pendente para a Milestone M1 Backend.

## Key Decisions Made
- Definir especificação SQL com atomicidade via CTE `WITH Prox AS (...) UPDATE Prox SET ... WITH (UPDLOCK, READPAST)`.
- Substituir expurgo de 3 horas por transição automática para status `contingencia`, sem deleção de registros.
- Ajustar CSS de `termo.ts` para `@page{size:80mm auto;margin:0}` e remover `min-height: 297mm`.
- Atualizar assertion correspondente em `tests/ops/termo.test.ts` para garantir 100% de aprovação no Vitest.

## Artifact Index
- /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/explorer_m1_backend_1/DISPATCH.md — Mensagens recebidas
- /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/explorer_m1_backend_1/BRIEFING.md — Memória situacional
- /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/explorer_m1_backend_1/progress.md — Heartbeat de progresso
- /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/explorer_m1_backend_1/handoff.md — Relatório técnico final
