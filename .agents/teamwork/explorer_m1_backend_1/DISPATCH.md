# DISPATCH — Explorer M1 Backend 1

## Milestone M1: R1 — Impressão e Gestão de Termos de Responsabilidade (Itens 1 a 6)

### Arquivos Alvo
- `migrations/ops/0011_fila_impressao.sql` (Novo script DDL idempotente)
- `services/ops-server.ts` (desacoplamento da memória volátil `filaImpressao[]`, integração com `dbo.FilaImpressao`, contingência sem expurgo em 3h)
- `lib/ops/termo.ts` (altura automática/dinâmica TM-T20 em vez de 297 mm fixos)
- `tests/ops/termo.test.ts`

### Escopo e Missão
Investigar detalhadamente os pontos de alteração no backend para:
1. Definir o esquema SQL exato de `dbo.FilaImpressao` com status (`pendente`, `imprimindo`, `impressa`, `contingencia`, `cancelada`), timestamps (`CriadoEm`, `PegoEm`, `FeitaEm`) e contador de tentativas.
2. Definir a consulta atômica de retirada de trabalho com `WITH (UPDLOCK, READPAST)`.
3. Tratar a contingência: caso a recepção fique deslogada ou fechada, não apagar trabalhos após 3 horas; mantê-los no banco e marcá-los para contingência.
4. Ajustar `@page` em `lib/ops/termo.ts` para eliminar desperdício de bobina térmica na EPSON TM-T20 (80mm).
5. Fornecer plano cirúrgico para o Worker implementar sem introduzir regressões ou quebrar os testes do Vitest.

Gere seu relatório em: `.agents/teamwork/explorer_m1_backend_1/handoff.md`.


## 2026-10-26T19:26:39Z
Você é o Explorer Especialista em Backend para a Milestone M1 (Impressão e Gestão de Termos).
Seu diretório de trabalho é: /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/explorer_m1_backend_1

Você DEVE ler o arquivo da solicitação original do usuário:
/Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/ORIGINAL_REQUEST.md (consulte a seção sob o timestamp 2026-10-26T19:04:37Z).

Consulte também:
- /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/orchestrator_2/PROJECT_TOTEM.md
- /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/explorer_m1_backend_1/DISPATCH.md
- /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/explorer_totem_backend_1/handoff.md
- services/ops-server.ts
- lib/ops/termo.ts e tests/ops/termo.test.ts

Sua tarefa:
1. Elaborar a proposta técnica detalhada de código para:
   - Script de migração DDL `migrations/ops/0011_fila_impressao.sql` criando a tabela física `dbo.FilaImpressao`.
   - Modificações em `services/ops-server.ts`: substituir `filaImpressao[]` em memória por operações SQL com locks atômicos (`WITH (UPDLOCK, READPAST)`), retenção de contingência sem expurgo após 3 horas, e atualização das rotas de impressão.
   - Modificações em `lib/ops/termo.ts`: alterar o `@page` de 297 mm fixos para altura dinâmica/automática na TM-T20 de 80mm, ajustando `tests/ops/termo.test.ts`.
2. Detalhar as assinaturas de funções e código exato que o Worker deverá implementar.
3. Não implemente código de produção — apenas formule o plano de implementação.

Escreva seu relatório em:
/Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/explorer_m1_backend_1/handoff.md

Ao concluir, envie uma mensagem para o orquestrador (parent).
