## 2026-10-26T19:42:17Z
Você é worker_m2_1.
Seu diretório de trabalho é: /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/worker_m2_1
Você DEVE ler obrigatoriamente:
- /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/ORIGINAL_REQUEST.md (leia primeiro!)
- /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/orchestrator_1/PROJECT.md
- /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/explorer_backend_survey_1/handoff.md
- /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/worker_m1_1/handoff.md
- migrations/ops/0011_fila_impressao_indices.sql

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Posse exclusiva de escrita (Write ownership):
- `services/ops-server.ts`
- `lib/ops/termo.ts`
- `lib/ops/totem-baterias.ts`
- `lib/ops/office.ts`
- `lib/ops/db.ts`
- `lib/ops/instagram.ts`
- `lib/ops/cadastro-obrigatorio.ts`
- `tests/ops/` (testes relacionados)

Missão:
Implementar a Milestone M2 (Servidor Backend Operacional) cobrindo os itens de backend mapeados:
1. Persistência relacional da fila de impressão (`dbo.FilaImpressao`) em `services/ops-server.ts`:
   - Gravar jobs com INSERT em `dbo.FilaImpressao` em vez de apenas no array em memória.
   - Implementar `GET /api/office/impressao/proxima` usando a CTE atômica com `UPDATE TOP (1) WITH (UPDLOCK, READPAST)` definida no contrato de interface de `PROJECT.md`.
   - Implementar `POST /api/office/impressao/:id/feita` atualizando `Status = 'impressa'`, `FeitaEm = SYSDATETIME()`.
   - Implementar `POST /api/office/impressao/:id/falhou` atualizando `Status = 'falhou'`, `FalhouEm = SYSDATETIME()`.
   - Implementar `GET /api/office/impressao/fila` consultando `dbo.FilaImpressao`.
   - Manter contingência: nunca descartar silenciosamente trabalhos com mais de 3h, preservar histórico no banco.
2. Eliminar desperdício de bobina térmica em `lib/ops/termo.ts`:
   - Ajustar `@page { size: 80mm auto; margin: 0; }`.
   - Ajustar `.page { position: relative; width: 80mm; min-height: auto; padding: 0 5.7mm 4mm; margin: 0 auto; break-after: page; }`.
3. Proteger PII no endpoint público `POST /api/totem/identificar` (`services/ops-server.ts:310`):
   - Mascarar documento CPF (`123.***.***-00`), e-mail (`u***@***.com`), telefone (`(**) *****-1234`), endereço.
   - Não expor lista aberta de dados sensíveis de dependentes menores de idade sem validação prévia.
4. Preservação de dados de endereço (`services/ops-server.ts:369`):
   - Eliminar `UPDATE dbo.Cliente SET Numero = NULL, Complemento = NULL` na atualização do cadastro pelo totem.
5. Bloqueio de baterias vencidas:
   - Em `lib/ops/office.ts:426`, remover a tolerância de -30 minutos: `CASE WHEN b.Inicio < SYSDATETIME() THEN 1 ELSE 0 END passada`.
   - Em `lib/ops/totem-baterias.ts`, não disponibilizar baterias com horário de início inferior a `agora`.
6. Parametrização segura de SQL em `services/ops-server.ts:401`:
   - Parametrizar a query dinâmica de baterias usando parâmetros nomeados/posicionais em vez de interpolação direta.
7. Correção no estorno de vouchers em `lib/ops/office.ts:650`:
   - Ao estornar um item de venda, estornar apenas o `VoucherUso` vinculado especificamente àquele item/voucher, sem cancelar em lote todos os vouchers da venda.
8. Regras de cadastro flexíveis:
   - Tornar Instagram opcional em `lib/ops/instagram.ts`.
   - Harmonizar faixas de validação de peso em `lib/ops/cadastro-obrigatorio.ts` para aceitar `15 <= peso <= 250`.
9. Otimização de performance em `services/ops-server.ts:626`:
   - Atualizar a query de `/api/crono/uso-karts` para consultar `WHERE KartNumero = @n` ou `WHERE Kart = @str`, aproveitando os índices criados na M1.
10. Estabilidade de runtime:
    - Adicionar listener para evento `'error'` no pool de conexão em `lib/ops/db.ts`.
    - Registrar capturadores globais `uncaughtException` e `unhandledRejection` em `services/ops-server.ts`.
11. Verificação:
    - Executar todos os testes operacionais com `npx vitest run tests/ops/` e garantir 100% de sucesso.
    - Executar os testes E2E com `npx vitest run tests/e2e-recepcao/` e garantir 100% de sucesso.
